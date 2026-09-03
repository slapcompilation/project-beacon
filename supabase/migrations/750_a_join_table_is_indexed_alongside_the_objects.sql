-- 750 — a join table is indexed alongside the objects.
--
-- The link-reading arc's first build. Our many-to-many links were metadata-
-- only at read time: the linter validated them, the wizard collected them,
-- and nothing anywhere ever opened a join dataset's rows. The cross-checked
-- answer to WHERE those rows go:
--
--   "In many-to-many relationships, the Ontology requires the definition of a
--    join table to define all of the links between objects based on their
--    primary keys. These tables are indexed alongside the objects in the
--    Ontology and use ontology volume."
--   — ontologies/volume-usage.md
--
--   "Data must be registered in Phonograph before it can be queried by or
--    displayed in user applications."
--   — object-databases/object-storage-v1.md
--
-- So a join-table link type gets what an object type has: its own index
-- (objects.lt_<uuid>, the pair store), its own registration row, its own
-- build jobs through the same pipeline — the docs put link types in that
-- pipeline by name:
--
--   "Stream datasources can also be configured for many-to-many link types."
--   — object-indexing/funnel-streaming-pipelines.md
--
-- The pipeline seams all extend rather than fork: job_specs and build_jobs
-- gain output_link_type_id beside output_object_type_id; the input-deriving
-- laterals gain a UNION arm; run_build_job gains a dispatch branch; the
-- heartbeat gains a second loop. The pair store keeps the join table's own
-- two key columns — a pair appearing twice in the dataset is the same link
-- stated twice and lands once; a row with a NULL key defines no link
-- ("based on their primary keys") and fails the build the way a NULL primary
-- key fails an object build. FK-backed links keep reading through the
-- objects' own indexes; object-backed (intermediary) links stay unindexed
-- here — resolving one is a two-hop probe through the middle object's index,
-- which is its own arc.

-- ── the registration table, mirror of object_type_indexes ───────────────────

CREATE TABLE public.link_type_indexes (
  link_type_id uuid PRIMARY KEY REFERENCES public.link_types(id) ON DELETE CASCADE,
  link_count   bigint,
  index_table  text,
  indexed_at   timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.link_type_indexes IS
  'One row per join-table link type with an index: the pair store objects.lt_<uuid>. "These tables are indexed alongside the objects in the Ontology" (volume-usage). Written only by index_link_type under a RUNNING build job. 750.';

ALTER TABLE public.link_type_indexes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read index status of visible link types" ON public.link_type_indexes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.link_types l
     WHERE l.id = link_type_indexes.link_type_id AND public.auth_in_ontology(l.ontology_id)));
GRANT SELECT ON public.link_type_indexes TO authenticated;
GRANT ALL ON public.link_type_indexes TO service_role;

-- ── the pipeline columns ────────────────────────────────────────────────────

ALTER TABLE public.job_specs
  ADD COLUMN output_link_type_id uuid REFERENCES public.link_types(id) ON DELETE CASCADE;
ALTER TABLE public.build_jobs
  ADD COLUMN output_link_type_id uuid REFERENCES public.link_types(id) ON DELETE CASCADE;
CREATE INDEX job_specs_output_link_type_id_idx ON public.job_specs (output_link_type_id);
CREATE INDEX build_jobs_output_link_type_id_idx ON public.build_jobs (output_link_type_id);

-- A spec names exactly one output, now of three kinds; a link index spec has
-- no authored SQL, the same fact the object index branch states.
ALTER TABLE public.job_specs DROP CONSTRAINT job_specs_one_output;
ALTER TABLE public.job_specs ADD CONSTRAINT job_specs_one_output
  CHECK (num_nonnulls(output_dataset_id, output_object_type_id, output_link_type_id) = 1);
ALTER TABLE public.job_specs DROP CONSTRAINT job_specs_logic_matches_output;
ALTER TABLE public.job_specs ADD CONSTRAINT job_specs_logic_matches_output
  CHECK (CASE
    WHEN output_object_type_id IS NOT NULL THEN logic_sql IS NULL AND source_object_type_id IS NULL
    WHEN output_link_type_id IS NOT NULL THEN logic_sql IS NULL AND source_object_type_id IS NULL
    WHEN source_object_type_id IS NOT NULL THEN logic_sql IS NULL
    ELSE logic_sql IS NOT NULL
  END);
ALTER TABLE public.build_jobs DROP CONSTRAINT build_jobs_one_output;
ALTER TABLE public.build_jobs ADD CONSTRAINT build_jobs_one_output
  CHECK (num_nonnulls(output_dataset_id, output_object_type_id, output_link_type_id) = 1);

-- ── the per-link mirrors of the per-object helpers ──────────────────────────

CREATE FUNCTION public.link_type_input_datasets(p_link uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE
SET search_path TO 'public' AS $fn$
  -- A join-table link has exactly one input: its join dataset.
  SELECT lt.dataset_id FROM public.link_types lt
   WHERE lt.id = p_link AND lt.dataset_id IS NOT NULL
$fn$;

CREATE FUNCTION public.can_index_link_type(p_link uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'public' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.link_types lt
     WHERE lt.id = p_link
       AND ((SELECT public.auth_role()) IN ('owner', 'admin')
            OR public.role_rank(public.project_role(lt.project_id))
               >= public.role_rank('editor')))
$fn$;

CREATE FUNCTION public.link_index_job_spec(p_link uuid)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE spec uuid;
BEGIN
  SELECT id INTO spec FROM public.job_specs WHERE output_link_type_id = p_link;
  IF spec IS NULL THEN
    INSERT INTO public.job_specs (output_link_type_id) VALUES (p_link) RETURNING id INTO spec;
  END IF;
  RETURN spec;
END $fn$;

CREATE FUNCTION public.link_type_index_state(p_link uuid)
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'public' AS $fn$
  SELECT bj.state
    FROM public.build_jobs bj
   WHERE bj.output_link_type_id = p_link
   ORDER BY coalesce(bj.finished_at, bj.started_at) DESC NULLS LAST
   LIMIT 1
$fn$;

CREATE FUNCTION public.link_type_index_ready(p_link uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'public' AS $fn$
  SELECT public.link_type_index_state(p_link) = 'COMPLETED'
$fn$;

-- ── the indexer ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.index_link_type(p_link uuid, p_job uuid)
RETURNS public.link_type_indexes LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  tbl    text := 'lt_' || replace(p_link::text, '-', '');
  lk     record;
  phys   text;
  n      bigint;
  bad    bigint;
  result public.link_type_indexes;
BEGIN
  -- The job is the ticket, the same signature that closes the object side.
  IF NOT EXISTS (
    SELECT 1 FROM public.build_jobs bj
     WHERE bj.id = p_job AND bj.output_link_type_id = p_link AND bj.state = 'RUNNING'
  ) THEN
    RAISE EXCEPTION 'Builds:IndexNeedsAJob — a link type is indexed by a build job, not directly'
      USING HINT = 'Call run_link_index_build(ARRAY[link_type], force) instead.';
  END IF;

  SELECT l.* INTO lk FROM public.link_types l WHERE l.id = p_link;
  IF lk IS NULL OR NOT public.auth_in_ontology(lk.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type you can see', p_link;
  END IF;
  IF lk.backing_kind IS DISTINCT FROM 'join_table'
     OR lk.dataset_id IS NULL
     OR lk.source_key_column IS NULL OR lk.target_key_column IS NULL THEN
    RAISE EXCEPTION 'Builds:LinkIndexNeedsAJoinTable — only a join-table link carries its own index; % is backed by %',
      lk.api_name, coalesce(lk.backing_kind, 'nothing');
  END IF;

  INSERT INTO public.link_type_indexes (link_type_id)
  VALUES (p_link) ON CONFLICT (link_type_id) DO NOTHING;

  SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = lk.dataset_id;
  IF phys IS NULL THEN
    RAISE EXCEPTION 'the join dataset has no committed data to index';
  END IF;

  -- "define all of the links between objects based on their primary keys" —
  -- a row with a NULL key defines no link, and fails the build the way a
  -- NULL primary key fails an object build.
  EXECUTE format(
    'SELECT count(*) FROM datasets.%I r
      WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))
        AND (r.%I IS NULL OR r.%I IS NULL)',
    phys, lk.branch_id, lk.source_key_column, lk.target_key_column) INTO bad;
  IF bad > 0 THEN
    RAISE EXCEPTION 'a join table row has no value in a key column (% row(s))', bad;
  END IF;

  -- The staging half, swapped in whole — a failed rebuild never touches the
  -- live pair store (644's rule, applied to links).
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl || '__next');
  EXECUTE format('CREATE TABLE objects.%I (%I text NOT NULL, %I text NOT NULL, PRIMARY KEY (%I, %I))',
                 tbl || '__next', lk.source_key_column, lk.target_key_column,
                 lk.source_key_column, lk.target_key_column);
  -- The same pair twice is the same link stated twice: a link exists or it
  -- does not, so the store holds it once.
  EXECUTE format(
    'INSERT INTO objects.%I (%I, %I)
     SELECT r.%I::text, r.%I::text FROM datasets.%I r
      WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))
     ON CONFLICT DO NOTHING',
    tbl || '__next', lk.source_key_column, lk.target_key_column,
    lk.source_key_column, lk.target_key_column, phys, lk.branch_id);
  EXECUTE format('SELECT count(*) FROM objects.%I', tbl || '__next') INTO n;

  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
  EXECUTE format('ALTER TABLE objects.%I RENAME TO %I', tbl || '__next', tbl);

  UPDATE public.link_type_indexes
     SET link_count = n, index_table = tbl,
         indexed_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE link_type_id = p_link
  RETURNING * INTO result;
  RETURN result;
END $fn$;

-- ── the build entry, mirror of run_index_build ──────────────────────────────

CREATE FUNCTION public.run_link_index_build(p_links uuid[], p_force boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_build uuid; t uuid; spec uuid; job uuid; n int := 0;
BEGIN
  FOREACH t IN ARRAY p_links LOOP
    IF NOT public.can_index_link_type(t) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — reindexing % takes the editor role on its project', t;
    END IF;
  END LOOP;

  INSERT INTO public.builds (force) VALUES (p_force) RETURNING id INTO v_build;
  FOREACH t IN ARRAY p_links LOOP
    spec := public.link_index_job_spec(t);
    CONTINUE WHEN NOT p_force AND public.job_spec_fresh(spec);
    INSERT INTO public.build_jobs (build_id, job_spec_id, output_link_type_id)
    VALUES (v_build, spec, t) RETURNING id INTO job;
    n := n + 1;
    CONTINUE WHEN public.job_blocked_by(job) IS NOT NULL;
    PERFORM public.run_build_job(job);
  END LOOP;

  IF n = 0 THEN
    DELETE FROM public.builds WHERE id = v_build;
    RETURN NULL;
  END IF;
  PERFORM public.settle_build(v_build);
  RETURN v_build;
END $fn$;

-- ── the seams: input state, blocking, dispatch, heartbeat ───────────────────

DO $patch$
DECLARE fn text; src text; n int; anchor text; addition text;
BEGIN
  -- guard_job_spec: a LINK INDEX spec has no SQL to plan-walk either — its
  -- logic is index_link_type and its input is the link's join dataset.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'guard_job_spec';
  anchor := '  IF NOT public.can_write_dataset(NEW.output_dataset_id) THEN';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'guard_job_spec: anchor found % times', n; END IF;
  addition :=
    '  -- A LINK INDEX spec (750): its logic is index_link_type, its input the' || chr(10) ||
    '  -- link''s join dataset.' || chr(10) ||
    '  IF NEW.output_link_type_id IS NOT NULL THEN' || chr(10) ||
    '    IF NOT public.can_index_link_type(NEW.output_link_type_id) THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Builds:NotAuthorized — publishing an index JobSpec takes the editor role on the link type''''s project'';' || chr(10) ||
    '    END IF;' || chr(10) ||
    '    IF NOT EXISTS (SELECT 1 FROM public.link_types lt' || chr(10) ||
    '                    WHERE lt.id = NEW.output_link_type_id AND lt.dataset_id IS NOT NULL) THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Builds:JobSpecNeedsInputs — the link type has no join dataset to index'';' || chr(10) ||
    '    END IF;' || chr(10) ||
    '    RETURN NEW;' || chr(10) ||
    '  END IF;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;

  -- job_spec_input_state: a link spec's input is its join dataset.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'job_spec_input_state';
  anchor := '      SELECT * FROM public.object_type_input_datasets(js.source_object_type_id)';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'job_spec_input_state: anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '      UNION' || chr(10) ||
    '      -- A link spec''s input is its join dataset (750).' || chr(10) ||
    '      SELECT * FROM public.link_type_input_datasets(js.output_link_type_id)');
  EXECUTE src;

  -- job_blocked_by: a link reindex waits for the build rewriting its dataset.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'job_blocked_by';
  anchor := '      SELECT * FROM public.object_type_input_datasets(mine.output_object_type_id)';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'job_blocked_by: anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '      UNION' || chr(10) ||
    '      SELECT * FROM public.link_type_input_datasets(mine.output_link_type_id)');
  EXECUTE src;

  -- run_build_job: permission and dispatch, one branch each.
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_build_job';
  anchor := '  ELSIF NOT public.can_write_dataset(job.output_dataset_id) THEN';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'run_build_job: permission anchor found % times', n; END IF;
  src := replace(src, anchor,
    '  ELSIF job.output_link_type_id IS NOT NULL THEN' || chr(10) ||
    '    IF NOT public.can_index_link_type(job.output_link_type_id) THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Builds:NotAuthorized — reindexing % takes the editor role on its project'',' || chr(10) ||
    '        job.output_link_type_id;' || chr(10) ||
    '    END IF;' || chr(10) || anchor);

  anchor := '  IF job.output_object_type_id IS NOT NULL THEN' || chr(10) || '    BEGIN';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'run_build_job: dispatch anchor found % times', n; END IF;
  addition :=
    '  -- The link Funnel branch: same seven states, same ledger (750).' || chr(10) ||
    '  IF job.output_link_type_id IS NOT NULL THEN' || chr(10) ||
    '    BEGIN' || chr(10) ||
    '      PERFORM public.index_link_type(job.output_link_type_id, p_job);' || chr(10) ||
    '      UPDATE public.build_jobs' || chr(10) ||
    '         SET state = ''COMPLETED'', finished_at = clock_timestamp(),' || chr(10) ||
    '             spec_version = public.job_spec_version(job.job_spec_id),' || chr(10) ||
    '             input_transactions = public.job_spec_input_state(job.job_spec_id)' || chr(10) ||
    '       WHERE id = p_job;' || chr(10) ||
    '      RETURN ''COMPLETED'';' || chr(10) ||
    '    EXCEPTION WHEN OTHERS THEN' || chr(10) ||
    '      UPDATE public.build_jobs' || chr(10) ||
    '         SET state = ''FAILED'', error = sqlerrm, finished_at = clock_timestamp()' || chr(10) ||
    '       WHERE id = p_job;' || chr(10) ||
    '      RETURN ''FAILED'';' || chr(10) ||
    '    END;' || chr(10) ||
    '  END IF;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;

  -- run_stale_indexes: the heartbeat picks up stale link indexes too —
  -- "Live pipelines run whenever their respective datasources are updated".
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_stale_indexes';
  anchor := '  RETURN ran;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'run_stale_indexes: anchor found % times', n; END IF;
  addition :=
    '  -- The link pipelines (750): a join dataset moving makes its pair store' || chr(10) ||
    '  -- stale the same way an object datasource moving does.' || chr(10) ||
    '  FOR t IN' || chr(10) ||
    '    SELECT lt.id, p.organization_id, i.link_type_id AS has_index, i.indexed_at AS at' || chr(10) ||
    '      FROM public.link_types lt' || chr(10) ||
    '      JOIN public.projects p ON p.id = lt.project_id' || chr(10) ||
    '      LEFT JOIN public.link_type_indexes i ON i.link_type_id = lt.id' || chr(10) ||
    '     WHERE lt.backing_kind = ''join_table'' AND lt.dataset_id IS NOT NULL' || chr(10) ||
    '       AND NOT EXISTS (' || chr(10) ||
    '         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id' || chr(10) ||
    '          WHERE bj.output_link_type_id = lt.id' || chr(10) ||
    '            AND b.status = ''RUNNING'' AND bj.state IN (''WAITING'', ''RUN_PENDING'', ''RUNNING''))' || chr(10) ||
    '     ORDER BY i.updated_at NULLS FIRST' || chr(10) ||
    '     LIMIT 25' || chr(10) ||
    '  LOOP' || chr(10) ||
    '    CONTINUE WHEN t.has_index IS NOT NULL AND t.at IS NOT NULL' || chr(10) ||
    '             AND coalesce(public.link_type_index_state(t.id), '''') NOT IN (''FAILED'', ''ABORTED'')' || chr(10) ||
    '             AND public.job_spec_fresh(public.link_index_job_spec(t.id));' || chr(10) ||
    '    SELECT u2.id, u2.role, u2.organization_id INTO u' || chr(10) ||
    '      FROM public.users u2' || chr(10) ||
    '     WHERE u2.organization_id = t.organization_id AND u2.role IN (''owner'', ''admin'')' || chr(10) ||
    '     ORDER BY u2.created_at LIMIT 1;' || chr(10) ||
    '    CONTINUE WHEN u IS NULL;' || chr(10) ||
    '    BEGIN' || chr(10) ||
    '      PERFORM set_config(''request.jwt.claims'',' || chr(10) ||
    '        json_build_object(''sub'', u.id::text,' || chr(10) ||
    '          ''app_metadata'', json_build_object(''role'', u.role, ''org_id'', u.organization_id))::text, true);' || chr(10) ||
    '      PERFORM public.run_link_index_build(ARRAY[t.id], true);' || chr(10) ||
    '      PERFORM set_config(''request.jwt.claims'', coalesce(before, ''''), true);' || chr(10) ||
    '      ran := ran + 1;' || chr(10) ||
    '    EXCEPTION WHEN OTHERS THEN' || chr(10) ||
    '      PERFORM set_config(''request.jwt.claims'', coalesce(before, ''''), true);' || chr(10) ||
    '    END;' || chr(10) ||
    '  END LOOP;' || chr(10) || chr(10);
  src := replace(src, anchor, addition || anchor);
  EXECUTE src;
END $patch$;

-- ── deletion drops the storage, 744's rule applied to links ─────────────────

CREATE FUNCTION public.drop_link_type_storage()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE tbl text := 'lt_' || replace(OLD.id::text, '-', '');
BEGIN
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl || '__next');
  RETURN OLD;
END $fn$;

CREATE TRIGGER drop_link_type_storage
  AFTER DELETE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.drop_link_type_storage();

-- ── grants ──────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.index_link_type(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_link_index_build(uuid[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_type_index_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_type_index_ready(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_index_link_type(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_index_job_spec(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_type_input_datasets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.index_link_type(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_link_index_build(uuid[], boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_type_index_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_type_index_ready(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_index_link_type(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_index_job_spec(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_type_input_datasets(uuid) TO authenticated, service_role;

-- ── PROVED BY DOING — pairs land, dedupe, go stale, and leave with the link ─

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  jds uuid; jbr uuid; txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; ln uuid; b uuid; st text; err text; n bigint; itbl text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m750 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm750-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm750-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M750 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm750p', 'm750 probe') RETURNING id INTO proj;

  -- The two sides need only exist; the pair store is the link's own.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M750A', 'M750 A') RETURNING id INTO ta;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M750B', 'M750 B') RETURNING id INTO tb;

  -- The join dataset: three pairs, one stated twice.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm750join', 'm750join') RETURNING id INTO jds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (jds, 'master') RETURNING id INTO jbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (jds, jbr, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (jds, txn, '[{"name":"a_key","type":"STRING"},{"name":"b_key","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'rows.parquet', 4) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(jds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, a_key, b_key)
                  VALUES ($1,''A1'',''B1''), ($1,''A1'',''B2''), ($1,''A2'',''B1''), ($1,''A1'',''B1'')', phys)
    USING file_id;

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, dataset_id, branch_id,
     source_key_column, target_key_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm750-pairs', 'M750 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'a_key', 'b_key', 'bs', 'Bs', 'as', 'As')
  RETURNING id INTO ln;

  -- One build: pairs land, deduped, through a real COMPLETED job.
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj
   WHERE bj.build_id = b AND bj.output_link_type_id = ln;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'the link build did not land: %', coalesce(err, '?'); END IF;
  SELECT i.link_count, i.index_table INTO n, itbl
    FROM public.link_type_indexes i WHERE i.link_type_id = ln;
  IF n <> 3 THEN RAISE EXCEPTION '4 rows with one duplicate should index 3 pairs, got %', n; END IF;
  EXECUTE format('SELECT count(*) FROM objects.%I WHERE a_key = ''A1''', itbl) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'A1 should carry 2 links, got %', n; END IF;

  -- Freshness: the same ask again is a no-op build.
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], false) INTO b;
  IF b IS NOT NULL THEN RAISE EXCEPTION 'a fresh link index was rebuilt'; END IF;

  -- A new commit makes it stale, and the rebuild sees the new pair.
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
  SELECT jds, jbr, 'APPEND', b2.head_transaction_id
    FROM public.dataset_branches b2 WHERE b2.id = jbr
  RETURNING id INTO txn;
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'more.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  EXECUTE format('INSERT INTO datasets.%I (_file, a_key, b_key) VALUES ($1,''A2'',''B2'')', phys)
    USING file_id;
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], false) INTO b;
  IF b IS NULL THEN RAISE EXCEPTION 'a moved join dataset did not make the index stale'; END IF;
  SELECT i.link_count INTO n FROM public.link_type_indexes i WHERE i.link_type_id = ln;
  IF n <> 4 THEN RAISE EXCEPTION 'the rebuild should hold 4 pairs, got %', n; END IF;

  -- Deleting the link takes its storage with it.
  DELETE FROM public.link_types WHERE id = ln;
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'objects' AND table_name = itbl;
  IF n <> 0 THEN RAISE EXCEPTION 'the pair store survived the delete'; END IF;

  DELETE FROM public.object_types WHERE id IN (ta, tb);
  DELETE FROM public.datasets WHERE id = jds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
