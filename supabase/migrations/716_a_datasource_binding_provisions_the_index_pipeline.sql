-- 716 — a new type enters the indexing loop by itself (creation review, F13).
--
-- Foundry provisions the pipeline; the index follows from it:
--
--   "The Funnel service is responsible for orchestrating Funnel pipelines
--    that create and modify object instances in the Ontology and ensure
--    up-to-date data and metadata."
--   — object-indexing/overview.md
--
--   "Live pipelines run whenever their respective datasources are updated."
--   — object-indexing/funnel-batch-pipelines.md
--
-- Ours had no provisioning moment: nothing in the save path created a job
-- spec, and run_stale_indexes INNER JOINed object_type_indexes — so a freshly
-- saved type stayed invisible to the minute hand until a person pressed
-- Reindex once, and a type whose FIRST build failed (a spec and a FAILED job,
-- no index row) fell out of the retry ladder forever. Probed 2026-08-28.
--
-- Three changes, each the smallest that closes its half:
--
-- 1. Binding a datasource provisions the pipeline: an AFTER INSERT trigger on
--    object_type_datasources calls index_job_spec (idempotent select-or-
--    insert). The chokepoint is the binding, not the type save, because a
--    datasource can also arrive later through the Datasources tab — and a
--    live pipeline is per datasource-backed type.
-- 2. The job_specs policies learn the index-spec shape: both arms gated on
--    output_dataset_id alone, which is NULL on an index spec — so a real
--    authenticated user could not create or read one. Write composes
--    can_index_object_type (the predicate run_index_build itself checks),
--    read composes auth_in_ontology through the type.
-- 3. run_stale_indexes admits row-less types: LEFT JOIN object_type_indexes,
--    a no-row-yet arm ahead of the others, NULLS FIRST so first builds go
--    before refreshes. The FAILED-retry arm already existed; the join was
--    what blinded it to first-build failures.

-- ── 1. the provisioning trigger ─────────────────────────────────────────────

CREATE FUNCTION public.provision_index_pipeline() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  PERFORM public.index_job_spec(NEW.object_type_id);
  RETURN NULL;
END $fn$;

CREATE TRIGGER provision_index_pipeline
AFTER INSERT ON public.object_type_datasources
FOR EACH ROW EXECUTE FUNCTION public.provision_index_pipeline();

COMMENT ON FUNCTION public.provision_index_pipeline() IS
  'The pipeline follows the binding: "Live pipelines run whenever their respective datasources are updated" (object-indexing/funnel-batch-pipelines), so the spec exists from the first datasource — the heartbeat''s first build follows within a minute. Idempotent through index_job_spec. 716.';

-- ── 2. job_specs policies learn the index-spec shape ────────────────────────

DROP POLICY "editors of the output publish its JobSpec" ON public.job_specs;
CREATE POLICY "editors of the output publish its JobSpec" ON public.job_specs
  FOR ALL USING (
    (output_dataset_id IS NOT NULL AND public.can_write_dataset(output_dataset_id))
    OR (output_object_type_id IS NOT NULL AND public.can_index_object_type(output_object_type_id))
  ) WITH CHECK (
    (output_dataset_id IS NOT NULL AND public.can_write_dataset(output_dataset_id))
    OR (output_object_type_id IS NOT NULL AND public.can_index_object_type(output_object_type_id))
  );
COMMENT ON POLICY "editors of the output publish its JobSpec" ON public.job_specs IS
  'A spec''s editor is its output''s editor — the dataset''s writer, or for an index spec the same editor-role predicate run_index_build checks (can_index_object_type). Before 716 the dataset arm stood alone, and an index spec (output_dataset_id NULL) was unwritable by any real role.';

DROP POLICY "readers of the output see its JobSpec" ON public.job_specs;
CREATE POLICY "readers of the output see its JobSpec" ON public.job_specs
  FOR SELECT USING (
    (output_dataset_id IS NOT NULL AND public.can_read_dataset(output_dataset_id))
    OR (output_object_type_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.object_types ot
       WHERE ot.id = output_object_type_id AND public.auth_in_ontology(ot.ontology_id)))
  );

-- ── 3. the heartbeat admits row-less types ──────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_stale_indexes';

  n := (length(src) - length(replace(src, 'JOIN public.object_type_indexes i ON i.object_type_id = ot.id', ''))) /
       length('JOIN public.object_type_indexes i ON i.object_type_id = ot.id');
  IF n <> 1 THEN RAISE EXCEPTION 'index join anchor found % times', n; END IF;
  src := replace(src,
    'JOIN public.object_type_indexes i ON i.object_type_id = ot.id',
    'LEFT JOIN public.object_type_indexes i ON i.object_type_id = ot.id');

  n := (length(src) - length(replace(src, 'AND (NOT public.job_spec_fresh(js.id)', ''))) /
       length('AND (NOT public.job_spec_fresh(js.id)');
  IF n <> 1 THEN RAISE EXCEPTION 'arm anchor found % times', n; END IF;
  src := replace(src,
    'AND (NOT public.job_spec_fresh(js.id)',
    'AND (i.object_type_id IS NULL
            OR NOT public.job_spec_fresh(js.id)');

  n := (length(src) - length(replace(src, 'ORDER BY i.updated_at', ''))) /
       length('ORDER BY i.updated_at');
  IF n <> 1 THEN RAISE EXCEPTION 'order anchor found % times', n; END IF;
  src := replace(src, 'ORDER BY i.updated_at', 'ORDER BY i.updated_at NULLS FIRST');

  -- The spec comment stays true, sharpened: since 716 the spec arrives with
  -- the first datasource, so no-spec now means datasource-less.
  src := replace(src,
    '-- The pipeline itself. A type with no spec has never been built, and
      -- there is nothing to find stale.',
    '-- The pipeline itself. Since 716 the spec arrives with the first
      -- datasource binding, so a type with no spec has no datasource and
      -- there is nothing to index.');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the front door, then the heartbeat, then cleanup ──────

DO $$
DECLARE
  org uuid; space uuid; proj uuid; ds uuid; br uuid; txn uuid; f uuid;
  usr uuid; ont uuid; ot uuid; spec uuid; phys text; itbl text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m716 probe') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m716 probe') RETURNING id INTO space;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (space, org);
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm716_probe', 'm716 probe') RETURNING id INTO proj;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm716-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm716-' || usr || '@beacon.test', 'admin', org);
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm716_ds', 'm716_ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 1) RETURNING id INTO f;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''A'')', phys) USING f;

  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (space, 'm716_probe', 'M716', false) RETURNING id INTO ont;

  -- The FRONT door: the wizard's own sequence since #883.
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M716Thing', 'label', 'M716 thing',
      'ontology_id', ont, 'project_id', proj,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    '[{"property_id":"pk","display_name":"Id","api_name":"id","base_type":"string",
       "source":"column","backing_column":"pk","is_primary_key":true,
       "is_title_key":true,"required":true}]'::jsonb) INTO ot;
  PERFORM public.save_working_state();

  -- The binding provisioned the pipeline — nobody called an index function.
  SELECT id INTO spec FROM public.job_specs WHERE output_object_type_id = ot;
  IF spec IS NULL THEN
    RAISE EXCEPTION 'the datasource binding did not provision a job spec';
  END IF;

  -- The heartbeat's next tick builds it, unprompted.
  SELECT public.run_stale_indexes(clock_timestamp()) INTO n;
  IF n < 1 THEN
    RAISE EXCEPTION 'run_stale_indexes ignored the never-indexed type (ran %)', n;
  END IF;
  SELECT count(*) INTO n FROM public.build_jobs
   WHERE output_object_type_id = ot AND state = 'COMPLETED';
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected one COMPLETED index job for the new type, found %', n;
  END IF;
  SELECT index_table INTO itbl FROM public.object_type_indexes WHERE object_type_id = ot;
  IF itbl IS NULL THEN
    RAISE EXCEPTION 'no index row after the heartbeat''s build';
  END IF;

  -- The probe fixture leaves nothing behind.
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', itbl);
  DELETE FROM public.object_type_indexes WHERE object_type_id = ot;
  DELETE FROM public.build_jobs WHERE output_object_type_id = ot;
  DELETE FROM public.builds b WHERE NOT EXISTS
    (SELECT 1 FROM public.build_jobs j WHERE j.build_id = b.id)
    AND b.organization_id = org;
  DELETE FROM public.job_specs WHERE output_object_type_id = ot;
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.ontologies WHERE id = ont;
  EXECUTE format('DROP TABLE IF EXISTS datasets.%I', phys);
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.project_role_grants WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.organizations WHERE id = org;
END $$;
