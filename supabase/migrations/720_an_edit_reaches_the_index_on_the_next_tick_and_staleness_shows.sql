-- 720 — the edits-to-index contract, held server-side, and staleness made
-- visible (creation review, F14).
--
--   "Note that user edits are applied to indexes in [object databases](/docs/foundry/object-backend/overview/#functional-components-and-architecture) immediately; a regular six-hour job interval allows a built-in control mechanism to persistently store this data in Foundry."
--   — object-indexing/funnel-batch-pipelines.md
--
-- Foundry's index is current the moment an action lands; the six-hour run
-- only PERSISTS what the index already shows. Ours inverted it: the edit
-- log was current and the queryable table refreshed only when the WEB fired
-- a force-reindex after each apply — a client that died mid-flow left the
-- index stale for up to six hours (run_stale_indexes' edits arm carried the
-- six-hour gate), and no surface said so.
--
-- The divergence, scoped: our index IS the store — there is no separate
-- persistence step for a six-hour cadence to serve — so the immediacy
-- sentence maps onto the minute hand: any edit newer than the index makes
-- the type stale NOW, and the heartbeat rebuilds it on the next tick. The
-- in-flight-job guard is the natural debounce (at most one rebuild a minute
-- per type). The client-fired reindex stays as an accelerator; the
-- heartbeat is the guarantee.
--
-- And the probe below exposed a DEEPER latency than the review recorded:
-- the six-hour edits arm was a latent NO-OP all along. It selected the
-- type, and then the loop called run_index_build(..., false) — whose
-- freshness check is job_spec_fresh, which compares spec version and input
-- TRANSACTIONS only. Edits are invisible to it, so the build declined
-- every time: user edits never reached the index through the heartbeat at
-- all, only through the web's post-apply force-reindex. The loop now
-- FORCES — run_stale_indexes' own WHERE is the staleness decision, and a
-- type it selects rebuilds, whatever job_spec_fresh thinks.
--
-- And the surface stops conflating ready with current:
-- object_type_index_report gains `stale` — edits newer than the index, or
-- the job spec no longer fresh — so ready-but-stale can be labelled.

-- ── 1. the edits arm loses its six-hour gate ────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_stale_indexes';

  n := (length(src) - length(replace(src, 'AND i.indexed_at < p_at - interval ''6 hours''', ''))) /
       length('AND i.indexed_at < p_at - interval ''6 hours''');
  IF n <> 1 THEN RAISE EXCEPTION 'six-hour anchor found % times', n; END IF;
  src := replace(src,
    'AND i.indexed_at < p_at - interval ''6 hours''',
    'AND true /* 720: an edit reaches the index on the next tick */');

  -- The selection IS the staleness decision: force the build, because
  -- job_spec_fresh cannot see edits and was silently declining them.
  n := (length(src) - length(replace(src, 'PERFORM public.run_index_build(ARRAY[t.id], false);', ''))) /
       length('PERFORM public.run_index_build(ARRAY[t.id], false);');
  IF n <> 1 THEN RAISE EXCEPTION 'run_index_build anchor found % times', n; END IF;
  src := replace(src,
    'PERFORM public.run_index_build(ARRAY[t.id], false);',
    'PERFORM public.run_index_build(ARRAY[t.id], true);');

  EXECUTE src;
END $patch$;

-- The stamp the staleness comparison leans on: indexed_at was written with
-- now() — TRANSACTION time — so an edit applied on the wall clock while the
-- index transaction ran compared as pre-index and stayed invisible. The
-- clock lesson (495's): intra-transaction ordering takes clock_timestamp().
DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'index_object_type';

  n := (length(src) - length(replace(src, 'indexed_at = now(), updated_at = now()', ''))) /
       length('indexed_at = now(), updated_at = now()');
  IF n <> 1 THEN RAISE EXCEPTION 'indexed_at anchor found % times', n; END IF;
  src := replace(src,
    'indexed_at = now(), updated_at = now()',
    'indexed_at = clock_timestamp(), updated_at = clock_timestamp()');

  EXECUTE src;
END $patch$;

-- ── 2. the report says stale ────────────────────────────────────────────────

DROP FUNCTION public.object_type_index_report();
CREATE FUNCTION public.object_type_index_report()
RETURNS TABLE(object_type_id uuid, state text, error text, object_count bigint,
              indexed_at timestamptz, stale boolean)
LANGUAGE sql STABLE SET search_path TO 'public' AS $fn$
  -- SECURITY INVOKER on purpose: object_type_indexes is filtered to visible
  -- types and build_jobs to the caller's organization, so the two policies
  -- compose and neither is restated here.
  SELECT i.object_type_id,
         public.object_type_index_state(i.object_type_id),
         (SELECT bj.error FROM public.build_jobs bj
           WHERE bj.output_object_type_id = i.object_type_id
           ORDER BY coalesce(bj.finished_at, bj.started_at) DESC NULLS LAST
           LIMIT 1),
         i.object_count, i.indexed_at,
         -- Ready is not current: newer edits, or a spec the inputs moved
         -- under, both mean the next tick rebuilds.
         (EXISTS (SELECT 1 FROM public.object_edits e
                   WHERE e.object_type_id = i.object_type_id
                     AND e.applied_at > i.indexed_at)
          OR EXISTS (SELECT 1 FROM public.job_specs js
                      WHERE js.output_object_type_id = i.object_type_id
                        AND NOT public.job_spec_fresh(js.id)))
    FROM public.object_type_indexes i
$fn$;
COMMENT ON FUNCTION public.object_type_index_report() IS
  'The per-type index answer the surfaces read: last job state, error, count, indexed_at — and since 720, stale (edits newer than the index, or a spec whose inputs moved). Ready-but-stale gets a label instead of passing as current.';

-- ── PROVED BY DOING — an edit makes the next tick rebuild, no six-hour wait ─

DO $$
DECLARE
  org uuid; space uuid; proj uuid; ds uuid; br uuid; txn uuid; f uuid;
  usr uuid; ont uuid; ot uuid; itbl text; n int; was_stale boolean; phys text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m720 probe') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m720 probe') RETURNING id INTO space;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (space, org);
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm720_probe', 'm720 probe') RETURNING id INTO proj;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm720-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm720-' || usr || '@beacon.test', 'admin', org);
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm720_ds', 'm720_ds') RETURNING id INTO ds;
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
  VALUES (space, 'm720_probe', 'M720', false) RETURNING id INTO ont;
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M720Thing', 'label', 'M720 thing',
      'ontology_id', ont, 'project_id', proj, 'edits_enabled', true,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    '[{"property_id":"pk","display_name":"Id","api_name":"id","base_type":"string",
       "source":"column","backing_column":"pk","is_primary_key":true,
       "is_title_key":true,"required":true}]'::jsonb) INTO ot;
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id = ot;

  -- First build via the heartbeat (716's arc).
  PERFORM public.run_stale_indexes(clock_timestamp());
  SELECT count(*) INTO n FROM public.build_jobs
   WHERE output_object_type_id = ot AND state = 'COMPLETED';
  IF n <> 1 THEN RAISE EXCEPTION 'first build did not complete (%)', n; END IF;

  -- An edit lands. The report says STALE, and the NEXT tick rebuilds —
  -- indexed_at is minutes old, nowhere near six hours.
  PERFORM set_config('beacon.applying_action', 'on', true);
  -- applied_at explicitly on the wall clock: inside this one probe
  -- transaction now() is frozen at txn start, BEFORE the build's
  -- clock_timestamp()-stamped indexed_at. Separate transactions (the real
  -- flow) never see this skew.
  INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, applied_at)
  VALUES (ot, 'B', 'create', '{}'::jsonb, clock_timestamp());
  PERFORM set_config('beacon.applying_action', '', true);

  SELECT r.stale INTO was_stale FROM public.object_type_index_report() r
   WHERE r.object_type_id = ot;
  IF NOT was_stale THEN RAISE EXCEPTION 'the report did not say stale after an edit'; END IF;

  PERFORM public.run_stale_indexes(clock_timestamp());
  SELECT count(*) INTO n FROM public.build_jobs
   WHERE output_object_type_id = ot AND state = 'COMPLETED';
  IF n <> 2 THEN RAISE EXCEPTION 'the edit did not trigger the next tick (jobs=%)', n; END IF;
  SELECT object_count::int INTO n FROM public.object_type_indexes WHERE object_type_id = ot;
  IF n <> 2 THEN RAISE EXCEPTION 'the rebuilt index misses the edit (count=%)', n; END IF;
  SELECT r.stale INTO was_stale FROM public.object_type_index_report() r
   WHERE r.object_type_id = ot;
  IF was_stale THEN RAISE EXCEPTION 'the report still says stale after the rebuild'; END IF;

  -- The probe fixture leaves nothing behind.
  SELECT index_table INTO itbl FROM public.object_type_indexes WHERE object_type_id = ot;
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', itbl);
  DELETE FROM public.object_type_indexes WHERE object_type_id = ot;
  DELETE FROM public.build_jobs WHERE output_object_type_id = ot;
  DELETE FROM public.builds b WHERE b.organization_id = org
    AND NOT EXISTS (SELECT 1 FROM public.build_jobs j WHERE j.build_id = b.id);
  DELETE FROM public.job_specs WHERE output_object_type_id = ot;
  DELETE FROM public.object_edits WHERE object_type_id = ot;
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
