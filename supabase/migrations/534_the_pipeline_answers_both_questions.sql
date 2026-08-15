-- Every reader and writer of the index scalar moves onto the pipeline.
--
-- §5 step 5, first half. 533 took the legacy arm out of the readiness
-- predicate; seven routines still spoke Phonograph's vocabulary underneath it.
-- The column drops in the next migration, once nothing reads it.
--
-- ── STALENESS WAS THE HARD HALF ─────────────────────────────────────────────
-- `status` carried two facts, not one. "This index succeeded" is answered by
-- the job already. "This index is stale" was answered by three triggers
-- writing 'not started', and that needed a v2 home before the column could go.
--
-- The page names the mechanism:
--
--   "When the schema of an object type changes and the previous pipeline's
--    schema is no longer up-to-date, a new replacement pipeline must be
--    provisioned for orchestrating object type updates. Schema changes can
--    include adding a new property type to an object type, changing an
--    existing property type, or replacing the input datasource of an object
--    type with another datasource."
--                             (object-indexing/funnel-batch-pipelines)
--
-- **The object type's `version` is already that schema version.** It bumps on
-- a type edit and on any property change (`bump_object_type_on_property_change`),
-- which is why `mark_index_stale_properties` was dead code rather than merely
-- unattached — the type-level trigger had been covering it.
--
-- So a replacement pipeline needs no new state at all. `job_spec_fresh`
-- already compares `bj.spec_version` against the spec's version; for an index
-- spec that version IS the object type's, and "the previous pipeline's schema
-- is no longer up-to-date" is exactly `bj.spec_version <> ot.version`. One
-- small function says which version a spec is at, and the comparison that was
-- already there does the rest.
--
-- I first built this as a trigger that copied the type's version onto the
-- spec. It tripped `guard_job_spec` — publishing a spec takes the editor
-- role, and provisioning a pipeline is not a person publishing anything. The
-- refusal was right and the design was wrong: a second copy of a version that
-- already exists is state to keep in step, and comparing against the original
-- needs no trigger, no write, and no weakening of the guard.
--
-- Each of the page's three causes now lands somewhere already built:
--
--   adding or changing a property  → `object_types.version` moves
--   replacing the input datasource → `job_spec_input_state` keys by dataset
--   a datasource committing        → the same, by transaction
--
-- The third is why `mark_index_stale_on_commit` goes entirely: a data change
-- was never a schema change, and freshness has answered it since 513. Three
-- trigger functions are deleted and nothing replaces them.
--
-- ── AND THE INDEXER STOPS SWALLOWING ────────────────────────────────────────
-- It caught its own failure to write 'failed' into the scalar, which
-- `run_build_job` read back to decide the job had failed. With the scalar gone
-- the round trip goes too: the indexer raises and the job records it, which is
-- where the page puts it anyway — "indexing jobs will not succeed and will
-- report the underlying problem in the pipeline graph in the Ontology Manager
-- application" (object-indexing/faq).
--
-- The six restated bodies below were taken from the LIVE definitions and
-- patched, not retyped from the migrations that created them. Restating 446
-- from its own file is how the submission-criteria gate got clobbered in 511.

-- ── which version a pipeline is at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_spec_version(p_spec uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $fn$
  -- A dataset spec versions its own logic. An INDEX spec has no authored
  -- logic — its schema is the object type's — so the type's version is the
  -- pipeline's, and a schema change provisions the replacement by moving it.
  SELECT coalesce(ot.version, js.version)
    FROM public.job_specs js
    LEFT JOIN public.object_types ot ON ot.id = js.output_object_type_id
   WHERE js.id = p_spec
$fn$;
REVOKE ALL ON FUNCTION public.job_spec_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_spec_version(uuid) TO authenticated;
COMMENT ON FUNCTION public.job_spec_version(uuid) IS
  'The schema version of a JobSpec''s pipeline: its own for a dataset spec, the object type''s for an index spec. A job recorded at an older one is running an out-of-date pipeline.';

CREATE OR REPLACE FUNCTION public.index_object_type(p_object_type uuid, p_job uuid)
 RETURNS object_type_indexes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ont      uuid;
  tbl      text := 'ot_' || replace(p_object_type::text, '-', '');
  cols     text;
  pk_prop  text;
  n        bigint := 0;
  ds       record;
  rows_sql text;
  merged   record;
  staged   record;
  bad      text;
  result   public.object_type_indexes;
BEGIN
  -- An index is what a pipeline produces. "The Funnel service is responsible
  -- for orchestrating Funnel pipelines that create and modify object instances
  -- in the Ontology" (object-indexing/overview) — there is no supported state
  -- in which an OSv2 object type has an index and no pipeline.
  --
  -- The job is therefore the ticket, and it is checked rather than trusted: it
  -- must be a RUNNING build job for THIS object type. A caller cannot forge one
  -- without creating a build, which is the point — 526 tried to close this hole
  -- by census and the read path went dark, because a fixture could still make
  -- an index with no build at any moment. A signature closes it by
  -- construction.
  IF NOT EXISTS (
    SELECT 1 FROM public.build_jobs bj
     WHERE bj.id = p_job
       AND bj.output_object_type_id = p_object_type
       AND bj.state = 'RUNNING'
  ) THEN
    RAISE EXCEPTION 'Builds:IndexNeedsAJob — an object type is indexed by a build job, not directly'
      USING HINT = 'Call run_index_build(ARRAY[object_type], force) instead.';
  END IF;

  SELECT ontology_id INTO ont FROM public.object_types WHERE id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;

  INSERT INTO public.object_type_indexes (object_type_id)
  VALUES (p_object_type)
  ON CONFLICT (object_type_id) DO NOTHING;

  -- A plain block, no longer a handler. The indexer used to catch its own
  -- failure and write it to a scalar; now it raises and the JOB records it:
  -- "indexing jobs will not succeed and will report the underlying problem in
  -- the pipeline graph in the Ontology Manager application" (object-indexing/faq).
  BEGIN
    -- Well-formedness first: an index of a type with no primary key is not a
    -- thing that can fail later; it is a thing that cannot start.
    SELECT string_agg(problem, '; ') INTO bad
      FROM public.object_type_problems(p_object_type) v;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION '%', bad;
    END IF;

    SELECT property_id INTO pk_prop FROM public.object_type_properties
     WHERE object_type_id = p_object_type AND is_primary_key;

    -- The staging area the merge-changes job writes: one row per primary key,
    -- keyed the way the edit log keys properties.
    CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb) ON COMMIT DROP;

    -- Changelog + gather, per datasource: the current view's rows only. A
    -- restricted-view datasource indexes through to its input dataset — the
    -- policy gates reads, never the build.
    FOR ds IN
      SELECT COALESCE(d.dataset_id, v.input_dataset_id) AS dataset_id,
             COALESCE(d.branch_id, mb.id) AS branch_id,
             ds2.physical_table
        FROM public.object_type_datasources d
        LEFT JOIN public.restricted_views v ON v.id = d.restricted_view_id
        LEFT JOIN public.dataset_branches mb
          ON mb.dataset_id = v.input_dataset_id AND mb.name = 'master'
        JOIN public.datasets ds2 ON ds2.id = COALESCE(d.dataset_id, v.input_dataset_id)
       WHERE d.object_type_id = p_object_type AND ds2.physical_table IS NOT NULL
    LOOP
      -- Each physical row becomes jsonb keyed by property_id via its
      -- backing_column, which is the shape object_state() replays edits onto.
      SELECT string_agg(format('%L, r.%I', p.property_id, p.backing_column), ', ')
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type AND p.source = 'column'
         AND p.backing_column IS NOT NULL;
      CONTINUE WHEN cols IS NULL;

      rows_sql := format(
        'SELECT jsonb_build_object(%s) AS row FROM datasets.%I r
          WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
        cols, ds.physical_table, ds.branch_id);

      FOR merged IN EXECUTE rows_sql LOOP
        IF merged.row ->> pk_prop IS NULL THEN
          RAISE EXCEPTION 'a datasource row has no value in the primary key column';
        END IF;
        -- "You may not have duplicate primary keys" — the failure the deep
        -- dive names ("such as non-unique primary keys").
        BEGIN
          INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row);
        EXCEPTION WHEN unique_violation THEN
          RAISE EXCEPTION 'non-unique primary keys: "%" appears more than once in the backing datasources',
            merged.row ->> pk_prop;
        END;
      END LOOP;
    END LOOP;

    -- "it is possible for users to create additional objects that do not exist
    --  in the backing datasource" — edit-only objects join the merge by pk.
    INSERT INTO _staged
    SELECT DISTINCT e.primary_key, NULL::jsonb
      FROM public.object_edits e
     WHERE e.object_type_id = p_object_type
    ON CONFLICT (pk) DO NOTHING;

    -- The index dataset: a real table, real columns, one per property.
    SELECT string_agg(format('%I %s', p.property_id, public.property_column_type(p.base_type)),
                      ', ' ORDER BY p.position)
      INTO cols
      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;

    EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
    EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);

    -- Merge changes: the datasource row replayed through the edit log, per
    -- object, dropping the deleted.
    FOR staged IN SELECT s.pk, s.row FROM _staged s LOOP
      SELECT * INTO merged FROM public.object_state(p_object_type, staged.pk, staged.row);
      CONTINUE WHEN merged.deleted;
      -- Value types enforce at index time; a violation fails the whole build.
      PERFORM 1 FROM public.object_type_properties vp
        JOIN public.value_types vvt ON vvt.id = vp.value_type_id
       WHERE vp.object_type_id = p_object_type
         AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id);
      IF FOUND THEN
        SELECT format('property "%s" of object "%s": %s', vp.property_id, staged.pk, vvt.failure_message)
          INTO bad
          FROM public.object_type_properties vp
          JOIN public.value_types vvt ON vvt.id = vp.value_type_id
         WHERE vp.object_type_id = p_object_type
           AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id)
         LIMIT 1;
        RAISE EXCEPTION '%', bad;
      END IF;
      EXECUTE format(
        'INSERT INTO objects.%I SELECT * FROM jsonb_populate_record(NULL::objects.%I, $1)',
        tbl, tbl) USING merged.properties;
      n := n + 1;
    END LOOP;

    DROP TABLE _staged;

    UPDATE public.object_type_indexes
       SET object_count = n, index_table = tbl,
           indexed_at = now(), updated_at = now()
     WHERE object_type_id = p_object_type;
  END;

  SELECT * INTO result FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  RETURN result;
END $function$;


CREATE OR REPLACE FUNCTION public.run_build_job(p_job uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  job record; q text; txn uuid; fid uuid; fields jsonb; cols text; phys text;
  n bigint; col record; src text;
BEGIN
  SELECT bj.*, b.force AS build_force, b.abort_on_failure
    INTO job
    FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
   WHERE bj.id = p_job;
  IF job IS NULL THEN RAISE EXCEPTION 'Builds:JobNotFound — %', p_job; END IF;

  -- The same right run_build demands at resolution, re-asked here: computing
  -- an output writes it, whoever asked.
  IF job.output_object_type_id IS NOT NULL THEN
    IF NOT public.can_index_object_type(job.output_object_type_id) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — reindexing % takes the editor role on its project',
        job.output_object_type_id;
    END IF;
  ELSIF NOT public.can_write_dataset(job.output_dataset_id) THEN
    RAISE EXCEPTION 'Builds:NotAuthorized — building % takes the editor role on its project',
      job.output_dataset_id;
  END IF;

  IF job.state <> 'WAITING' THEN RETURN job.state; END IF;
  IF public.job_blocked_by(p_job) IS NOT NULL THEN RETURN 'WAITING'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.build_jobs up
     WHERE up.build_id = job.build_id AND up.state IN ('FAILED', 'ABORTED')
       AND up.output_dataset_id IN (
         SELECT di.input_dataset_id FROM public.dataset_inputs di
          WHERE di.dataset_id = job.output_dataset_id)
  ) THEN
    UPDATE public.build_jobs SET state = 'ABORTED', finished_at = clock_timestamp()
     WHERE id = p_job;
    RETURN 'ABORTED';
  END IF;

  IF NOT job.build_force AND public.job_spec_fresh(job.job_spec_id) THEN
    UPDATE public.build_jobs SET state = 'COMPLETED', finished_at = clock_timestamp(),
           spec_version = public.job_spec_version(job.job_spec_id),
           input_transactions = public.job_spec_input_state(job.job_spec_id)
     WHERE id = p_job;
    RETURN 'COMPLETED';
  END IF;

  UPDATE public.build_jobs SET state = 'RUNNING', started_at = clock_timestamp()
   WHERE id = p_job;

  -- The Funnel branch. "A Funnel batch pipeline is comprised of a series of
  -- Foundry build jobs", so indexing an object type IS a build job: same
  -- seven states, same contention queue, same ledger. 442 collapsed Foundry's
  -- four jobs (changelog, merge changes, indexing, hydration) into the one
  -- Postgres can do honestly and that collapse stands — what changes is that
  -- something now runs it.
  IF job.output_object_type_id IS NOT NULL THEN
    BEGIN
      PERFORM public.index_object_type(job.output_object_type_id, p_job);
      UPDATE public.build_jobs
         SET state = 'COMPLETED', finished_at = clock_timestamp(),
             spec_version = public.job_spec_version(job.job_spec_id),
             input_transactions = public.job_spec_input_state(job.job_spec_id)
       WHERE id = p_job;
      RETURN 'COMPLETED';
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.build_jobs
         SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
       WHERE id = p_job;
      RETURN 'FAILED';
    END;
  END IF;

  BEGIN
    SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = job.output_dataset_id;
    -- "materializations of indexed data from the Ontology that contains the
    -- latest state of each object by combining data from both input
    -- datasources and user edits" — which is what the index table already
    -- holds, keyed by property API name because 442 built it that way and the
    -- page requires exactly that: "the API Name metadata of each property is
    -- used as the schema of the materialized dataset".
    IF job.source_object_type_id IS NOT NULL THEN
      SELECT i.index_table INTO src FROM public.object_type_indexes i
       WHERE i.object_type_id = job.source_object_type_id
         AND public.object_type_index_ready(i.object_type_id);
      IF src IS NULL THEN
        RAISE EXCEPTION 'Builds:NotIndexed — the object type has no successful index to copy';
      END IF;
      -- "the API Name metadata of each property is used as the schema of the
      -- materialized dataset". The index keys its columns by PROPERTY ID, so
      -- the copy renames them; selecting * shipped property ids and made that
      -- sentence false.
      SELECT string_agg(format('%I AS %I', p.property_id, p.api_name), ', '
                        ORDER BY p.is_primary_key DESC, p.api_name)
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = job.source_object_type_id
         AND EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'objects' AND c.table_name = src
                        AND c.column_name = p.property_id);
      IF cols IS NULL THEN
        RAISE EXCEPTION 'Builds:NotIndexed — the index has no columns to copy';
      END IF;
      EXECUTE format('CREATE TEMP TABLE _result ON COMMIT DROP AS SELECT %s FROM objects.%I', cols, src);
    ELSE
      q := public.job_spec_query(job.job_spec_id);
      EXECUTE 'CREATE TEMP TABLE _result ON COMMIT DROP AS ' || q;
    END IF;

    fields := '[]'::jsonb;
    FOR col IN
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS t
        FROM pg_attribute a
       WHERE a.attrelid = '_result'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum
    LOOP
      IF public.build_field_of(col.t) IS NULL THEN
        RAISE EXCEPTION 'Builds:UnsupportedOutputType — column %s is %s, which no dataset field can hold', col.attname, col.t;
      END IF;
      fields := fields || jsonb_build_array(
        public.build_field_of(col.t) || jsonb_build_object('name', col.attname));
    END LOOP;

    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    SELECT job.output_dataset_id, b.id, 'SNAPSHOT'
      FROM public.dataset_branches b
     WHERE b.dataset_id = job.output_dataset_id AND b.name = 'master'
    RETURNING id INTO txn;
    UPDATE public.build_jobs SET transaction_id = txn WHERE id = p_job;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (job.output_dataset_id, txn, fields);

    phys := public.dataset_rematerialize(job.output_dataset_id, txn);

    SELECT count(*) INTO n FROM _result;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (job.output_dataset_id, txn, format('build/%s.rows', job.build_id), n)
    RETURNING id INTO fid;
    SELECT string_agg(format('%I', f->>'name'), ', ') INTO cols
      FROM jsonb_array_elements(fields) f;
    EXECUTE format('INSERT INTO datasets.%I (_file, %s) SELECT %L, %s FROM _result',
                   phys, cols, fid, cols);
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;

    -- "materialized datasets are subject to a retention that is not
    -- customizable. Historical transactions are constantly deleted and only
    -- the latest snapshot is guaranteed to be available."
    IF job.source_object_type_id IS NOT NULL THEN
      DELETE FROM public.dataset_transactions old
       WHERE old.dataset_id = job.output_dataset_id AND old.id <> txn;
    END IF;
    DROP TABLE _result;

    UPDATE public.build_jobs
       SET state = 'COMPLETED', finished_at = clock_timestamp(),
           spec_version = public.job_spec_version(job.job_spec_id),
           input_transactions = public.job_spec_input_state(job.job_spec_id)
     WHERE id = p_job;
    RETURN 'COMPLETED';
  EXCEPTION WHEN OTHERS THEN
    DROP TABLE IF EXISTS _result;
    UPDATE public.dataset_transactions SET status = 'ABORTED' WHERE id = txn AND status = 'OPEN';
    UPDATE public.build_jobs
       SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
     WHERE id = p_job;
    RETURN 'FAILED';
  END;
END $function$
;

CREATE OR REPLACE FUNCTION public.job_spec_fresh(p_spec uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.build_jobs bj
    WHERE bj.job_spec_id = p_spec
      AND bj.state = 'COMPLETED'
      AND bj.spec_version = public.job_spec_version(p_spec)
      AND bj.input_transactions = public.job_spec_input_state(p_spec)
      AND bj.finished_at = (SELECT max(b2.finished_at) FROM public.build_jobs b2
                             WHERE b2.job_spec_id = p_spec AND b2.state = 'COMPLETED'))
$function$
;

CREATE OR REPLACE FUNCTION public.run_stale_indexes(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-stale-indexes')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR t IN
    SELECT ot.id, p.organization_id
      FROM public.object_types ot
      JOIN public.object_type_indexes i ON i.object_type_id = ot.id
      -- An object type reaches its organization through its project. A type
      -- with no project has no editor to impersonate, so it is skipped rather
      -- than indexed by nobody.
      JOIN public.projects p ON p.id = ot.project_id
      -- The pipeline itself. A type with no spec has never been built, and
      -- there is nothing to find stale.
      JOIN public.job_specs js ON js.output_object_type_id = ot.id
     WHERE EXISTS (SELECT 1 FROM public.object_type_datasources ds
                    WHERE ds.object_type_id = ot.id)
       -- Arm one: the datasource moved. Arm two: six hours have passed and
       -- there are edits to persist. Both from the pages, both asked here.
       AND (NOT public.job_spec_fresh(js.id)
            -- A failed pipeline is retried, which the scalar did by holding
            -- 'failed'. The job holds it now.
            OR public.object_type_index_state(ot.id) IN ('FAILED', 'ABORTED')
            OR i.indexed_at IS NULL
            OR (EXISTS (SELECT 1 FROM public.object_edits e
                         WHERE e.object_type_id = ot.id AND e.applied_at > i.indexed_at)
                AND i.indexed_at < p_at - interval '6 hours'))
       -- Nothing already in flight for this type.
       AND NOT EXISTS (
         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
          WHERE bj.output_object_type_id = ot.id
            AND b.status = 'RUNNING' AND bj.state IN ('WAITING', 'RUN_PENDING', 'RUNNING'))
     ORDER BY i.updated_at
     LIMIT 25
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = t.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_index_build(ARRAY[t.id], false);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    END;
  END LOOP;
  RETURN ran;
END $function$
;

CREATE OR REPLACE FUNCTION public.run_due_object_datasets(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE d record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-object-datasets')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR d IN
    SELECT od.id, p.organization_id
      FROM public.object_datasets od
      JOIN public.object_types ot ON ot.id = od.object_type_id
      JOIN public.projects p ON p.id = ot.project_id
      JOIN public.object_type_indexes i ON i.object_type_id = ot.id
     WHERE public.object_type_index_ready(ot.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
          WHERE bj.output_dataset_id = od.dataset_id
            AND b.status = 'RUNNING' AND bj.state IN ('WAITING', 'RUN_PENDING', 'RUNNING'))
       AND CASE od.build_interval
             -- "built whenever updates to objects are detected" — the index
             -- moving IS the update; never-built coalesces to -infinity and
             -- so is always due.
             WHEN 'automatic' THEN i.indexed_at > public.object_dataset_built_at(od.dataset_id)
             -- "built when input datasources update or every 6 hours". The
             -- first arm is job_spec_fresh's business and is asked by
             -- run_object_dataset_build; this is the clock.
             ELSE public.object_dataset_built_at(od.dataset_id) < p_at - interval '6 hours'
           END
     ORDER BY od.created_at
     LIMIT 25
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = d.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_object_dataset_build(d.id, false);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    END;
  END LOOP;
  RETURN ran;
END $function$
;

CREATE OR REPLACE FUNCTION public.build_materialization(p_materialization uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m       record;
  x       record;
  ds      record;
  fields  jsonb;
  cols    text;
  sel     text;
  txn     uuid;
  fid     uuid;
  ptbl    text;
  n       bigint;
BEGIN
  SELECT om.*, t.ontology_id, t.api_name AS type_api_name
    INTO m
    FROM public.object_type_materializations om
    JOIN public.object_types t ON t.id = om.object_type_id
   WHERE om.id = p_materialization;
  IF m.id IS NULL OR NOT public.auth_in_ontology(m.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:MaterializationNotFound — % is not a materialization you can see', p_materialization;
  END IF;

  -- "materializations of INDEXED data" — the index is the source, and it must
  -- have succeeded.
  SELECT * INTO x FROM public.object_type_indexes
   WHERE object_type_id = m.object_type_id
     AND public.object_type_index_ready(m.object_type_id);
  IF x.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:NotIndexed — a materialization reads indexed data, and this type has no successful index'
      USING HINT = 'Build the index first.';
  END IF;

  SELECT * INTO ds FROM public.datasets WHERE id = m.dataset_id;

  -- The schema is the ontology's: one field per selected property, named by
  -- its API Name, plus the __ metadata column the page reserves.
  SELECT jsonb_agg(jsonb_build_object(
           'name', p.api_name,
           'type', public.property_dataset_field_type(p.base_type))
         ORDER BY p.position)
    INTO fields
    FROM public.object_type_properties p
   WHERE p.object_type_id = m.object_type_id
     AND (m.property_ids = '{}' OR p.property_id = ANY (m.property_ids));
  IF fields IS NULL THEN
    RAISE EXCEPTION 'Ontology:NothingToMaterialize — the property subset matches no properties';
  END IF;
  fields := fields || jsonb_build_array(jsonb_build_object('name','__is_deleted','type','BOOLEAN'));

  -- One SNAPSHOT per build; then retention deletes what came before, because
  -- "only the latest snapshot is guaranteed to be available".
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  SELECT m.dataset_id, b.id, 'SNAPSHOT'
    FROM public.dataset_branches b
   WHERE b.dataset_id = m.dataset_id AND b.name = 'master'
  RETURNING id INTO txn;
  IF txn IS NULL THEN
    RAISE EXCEPTION 'Datasets:NoMasterBranch — the output dataset has no master branch';
  END IF;

  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (m.dataset_id, txn, fields);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (m.dataset_id, txn, m.type_api_name || '.materialized', 0)
  RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;

  ptbl := public.dataset_materialize(m.dataset_id, txn);

  -- Refill: the index table's property_id columns, written under API names.
  SELECT string_agg(format('%I', p.api_name), ', ' ORDER BY p.position),
         string_agg(format('o.%I', p.property_id), ', ' ORDER BY p.position)
    INTO cols, sel
    FROM public.object_type_properties p
   WHERE p.object_type_id = m.object_type_id
     AND (m.property_ids = '{}' OR p.property_id = ANY (m.property_ids));

  EXECUTE format('DELETE FROM datasets.%I', ptbl);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, %s, __is_deleted)
     SELECT %L::uuid, %s, false FROM objects.%I o',
    ptbl, cols, fid, sel, x.index_table);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.dataset_files SET row_count = n WHERE id = fid;

  -- Retention: everything before this snapshot goes.
  DELETE FROM public.dataset_transactions
   WHERE dataset_id = m.dataset_id AND id <> txn;

  UPDATE public.object_type_materializations
     SET built_at = now() WHERE id = p_materialization;

  RETURN n;
END $function$
;

-- ── the staleness triggers, deleted rather than replaced ────────────────────
DROP TRIGGER IF EXISTS mark_index_stale ON public.object_types;
DROP TRIGGER IF EXISTS mark_index_stale_on_commit ON public.dataset_transactions;
DROP FUNCTION IF EXISTS public.mark_index_stale();
DROP FUNCTION IF EXISTS public.mark_index_stale_on_commit();
-- Dead since the type-version trigger covered it; no trigger ever fired it.
DROP FUNCTION IF EXISTS public.mark_index_stale_properties();

-- ── the scalar's last useful act ────────────────────────────────────────────
-- `spec_version` on an index job used to record the SPEC's number, which was
-- 1 for every index spec ever created — nothing bumped it. It now records the
-- pipeline's schema version, which is the object type's. Left alone, every
-- completed index job would read as running an out-of-date pipeline and the
-- whole estate would silently reindex on the next heartbeat.
--
-- So the versions are converted, and the column being retired is what says
-- which jobs to convert: an index whose scalar reads 'success' was current at
-- its type's schema, so its last completed job is recorded at that version.
-- A job whose index does not read 'success' keeps its old number and stays
-- stale — the same answer the scalar was giving.
UPDATE public.build_jobs bj
   SET spec_version = ot.version
  FROM public.object_types ot
  JOIN public.object_type_indexes i ON i.object_type_id = ot.id
 WHERE bj.output_object_type_id = ot.id
   AND i.status = 'success'
   AND bj.state = 'COMPLETED'
   AND bj.finished_at = (SELECT max(b2.finished_at) FROM public.build_jobs b2
                          WHERE b2.output_object_type_id = ot.id
                            AND b2.state = 'COMPLETED');

-- ── what a surface reads instead of the scalar ──────────────────────────────
CREATE OR REPLACE FUNCTION public.object_type_index_report()
RETURNS TABLE (object_type_id uuid, state text, error text,
               object_count bigint, indexed_at timestamptz)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  -- SECURITY INVOKER on purpose: object_type_indexes is filtered to visible
  -- types and build_jobs to the caller's organization, so the two policies
  -- compose and neither is restated here.
  SELECT i.object_type_id,
         public.object_type_index_state(i.object_type_id),
         (SELECT bj.error FROM public.build_jobs bj
           WHERE bj.output_object_type_id = i.object_type_id
           ORDER BY coalesce(bj.finished_at, bj.started_at) DESC NULLS LAST
           LIMIT 1),
         i.object_count, i.indexed_at
    FROM public.object_type_indexes i
$fn$;
REVOKE ALL ON FUNCTION public.object_type_index_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_type_index_report() TO authenticated;
COMMENT ON FUNCTION public.object_type_index_report() IS
  'One row per index: the last build job''s state and error, with the row count and time. The OSv2 answer to what the Index status scalar used to show.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE n int; t uuid; spec uuid; was_fresh boolean; still_fresh boolean;
BEGIN
  -- Nothing left in the engine speaks the scalar.
  SELECT count(*) INTO n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND pg_get_functiondef(p.oid) ~* 'object_type_indexes[^;]{0,120}status'
     AND p.proname <> 'object_type_index_report';
  IF n <> 0 THEN
    RAISE EXCEPTION '% routine(s) still read or write the index scalar', n;
  END IF;

  -- The staleness triggers are gone, and nothing took their place.
  SELECT count(*) INTO n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'mark_index_stale%';
  IF n <> 0 THEN RAISE EXCEPTION '% mark_index_stale function(s) survived', n; END IF;

  -- A schema change makes the pipeline stale, with no trigger doing it. Run
  -- for real on a built type, and rolled back in its own subtransaction.
  BEGIN
    SELECT js.id, js.output_object_type_id INTO spec, t
      FROM public.job_specs js
     WHERE js.output_object_type_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.build_jobs bj
                    WHERE bj.job_spec_id = js.id AND bj.state = 'COMPLETED')
     LIMIT 1;
    IF spec IS NOT NULL THEN
      was_fresh := public.job_spec_fresh(spec);
      UPDATE public.object_types SET version = version + 1 WHERE id = t;
      still_fresh := public.job_spec_fresh(spec);
      IF NOT was_fresh THEN
        RAISE EXCEPTION 'a just-built index was not fresh to begin with; the comparison is wrong';
      END IF;
      IF still_fresh THEN
        RAISE EXCEPTION 'a schema change left the pipeline fresh — no replacement would be provisioned';
      END IF;
    END IF;
    RAISE EXCEPTION 'probe-534-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '534: staleness is the pipeline version, and failure is the job';
END $do$;
