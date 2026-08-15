-- The indexer becomes unreachable except through a build job. 528, reapplied.
--
-- 528 was correct and I reverted it on a misattribution. It made the fixtures
-- take the build path for the first time, the `restrictedViews` one failed
-- with "field name must not be null", and I recorded the guard as the suspect.
-- It was not: a restricted-view backing leaves `object_type_datasources
-- .dataset_id` NULL by CHECK, `job_spec_input_state` aggregated on it, and
-- jsonb_object_agg raises exactly that on a NULL key. 531 resolves the view to
-- the dataset underneath it and the arc completes. The body below is 528's,
-- restated unchanged and verified against the live definitions first: the
-- indexer agrees from the guard onward, and run_build_job differs only by the
-- `p_job` argument this migration adds.
--
-- CORRECTING 531 FORWARD, since an applied migration cannot be edited: the
-- comment above its assertion says it "calls the function that raised". It
-- does not. Publishing the spec that would exercise the aggregation takes an
-- editor's uid and a migration has none, so it proves the resolver on a real
-- restricted-view fixture and the arc is proved by the platform suite, which
-- now indexes that fixture through a build.
--
-- ── WHY THE SIGNATURE, AND NOT A GRANT ──────────────────────────────────────
-- §5 step 3b, and the step 526 skipped. That migration removed the legacy
-- fallback because every index in the database had a build job — true of the
-- ROWS, false of the SYSTEM: index_object_type was granted to authenticated
-- and exposed as an action, so a fixture could create an index with no
-- pipeline at any moment, and eight exploration cases went dark.
--
-- Revoking EXECUTE cannot fix it: run_build_job is SECURITY INVOKER by design
-- (493), so it calls the indexer as the authenticated user and would lose the
-- privilege with everyone else.
--
-- So the gate is the SIGNATURE. index_object_type now requires the build job
-- it is running under, and checks that the job is RUNNING and belongs to this
-- object type. A caller cannot produce one without creating a build. The
-- one-argument form is dropped, so the old call is a compile-time absence
-- rather than a convention. Every caller moved with it: three platform
-- fixtures and the Reindex button, which now starts a build and reads its job.

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
       SET status = 'success', error = NULL, object_count = n,
           index_table = tbl, indexed_at = now(), updated_at = now()
     WHERE object_type_id = p_object_type;

  EXCEPTION WHEN OTHERS THEN
    -- The pipeline failed; the record of why is the deliverable.
    DROP TABLE IF EXISTS _staged;
    UPDATE public.object_type_indexes
       SET status = 'failed', error = sqlerrm, object_count = NULL, updated_at = now()
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
           spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
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
      IF (public.index_object_type(job.output_object_type_id, p_job)).status <> 'success' THEN
        RAISE EXCEPTION 'Builds:IndexFailed — %',
          coalesce((SELECT i.error FROM public.object_type_indexes i
                     WHERE i.object_type_id = job.output_object_type_id),
                   'the index did not build');
      END IF;
      UPDATE public.build_jobs
         SET state = 'COMPLETED', finished_at = clock_timestamp(),
             spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
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
       WHERE i.object_type_id = job.source_object_type_id AND i.status = 'success';
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
           spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
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
END $function$;

DROP FUNCTION IF EXISTS public.index_object_type(uuid);

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE n int; msg text;
BEGIN
  -- The direct call is gone, not merely discouraged.
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'index_object_type' AND pronamespace = 'public'::regnamespace;
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly one index_object_type, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'index_object_type' AND pronamespace = 'public'::regnamespace
     AND pronargs = 2;
  IF n <> 1 THEN RAISE EXCEPTION 'the indexer does not require a job'; END IF;

  -- And a forged job is refused.
  BEGIN
    PERFORM public.index_object_type(gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'an object type was indexed without a build job';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE '%IndexNeedsAJob%' THEN RAISE; END IF;
  END;

  RAISE NOTICE '532: an index is what a build job produces';
END $$;
