-- 746 — a read records itself, when the caller names itself.
--
-- The whole metrics pipeline existed with no producer: `ontology_usage`,
-- `record_ontology_usage` (which already implements the page's own exclusion
-- and the Control Panel toggle), both summaries, the Usage tab, the cleanup
-- gate — and zero rows, because nothing ever called the recorder. The hazard
-- was live: enable metrics, wait thirty days, and every object type is
-- flagged with reads = 0.
--
-- What a read IS, the page settles:
--
--   "A read is recorded when an application loads objects for a specified
--    object type. This can include displaying objects in a table in Workshop,
--    returning all objects from search for a given object type, aggregating a
--    property on an object type, and so on."
--   — ontology-manager/view-usage.md
--
--   "Many objects loaded or aggregated at once will only be recorded as a
--    single read."
--   — ontology-manager/view-usage.md
--
-- So the producers are the load requests themselves — `evaluate_object_set`,
-- `aggregate_object_set`, `count_object_set` — one read per request however
-- many objects it returns. Each gains `p_application text DEFAULT NULL`: the
-- caller names itself, and a caller that does not is not recorded, which
-- keeps every suite and every internal replay out of the metrics without a
-- special case. The recorder already refuses 'ontology-manager' by name,
-- which is the page's other rule.
--
-- Two mechanical consequences, stated: the three readers stop being STABLE,
-- because recording is a write — and a metrics failure must never fail a
-- read, so the recording call swallows its own errors and only its own.
-- The old signatures are DROPPED, not overloaded; grants are re-issued
-- because a drop takes them.
--
-- `search_objects` spans types and stays unrecorded for now — recorded as the
-- residual, with the write-side producers (apply_action, apply_function_edits)
-- which the page counts separately as writes.

DO $patch$
DECLARE
  fn text;
  src text;
  n int;
  old_args text;
  gather_anchor text := '  SELECT t.ontology_id, x.index_table INTO ont, tbl';
  record_block text := '  -- One load request is one read (view-usage), recorded when the caller
  -- names itself. A metrics failure must never fail the read, so this block
  -- swallows its own errors and only its own (746).
  IF p_application IS NOT NULL THEN
    BEGIN
      PERFORM public.record_ontology_usage(p_object_type, NULL, p_application, 1, 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

';
BEGIN
  FOR fn, old_args IN
    SELECT * FROM (VALUES
      ('evaluate_object_set',  'uuid, jsonb, jsonb, integer, integer'),
      ('aggregate_object_set', 'uuid, jsonb, text, text, text, boolean, integer'),
      ('count_object_set',     'uuid, jsonb')
    ) v(f, a)
  LOOP
    SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = fn;

    -- The new argument joins the list: the CREATE line ends its arg list at
    -- the first ')' before RETURNS.
    n := position(')' || chr(10) || ' RETURNS' IN src);
    IF n = 0 THEN RAISE EXCEPTION '%: the CREATE line shape moved', fn; END IF;
    src := left(src, n - 1) || ', p_application text DEFAULT NULL' || substr(src, n);

    -- Recording is a write, so STABLE goes.
    n := (length(src) - length(replace(src, ' STABLE SECURITY DEFINER', ''))) /
         length(' STABLE SECURITY DEFINER');
    IF n <> 1 THEN RAISE EXCEPTION '%: STABLE SECURITY DEFINER found % times', fn, n; END IF;
    src := replace(src, ' STABLE SECURITY DEFINER', ' SECURITY DEFINER');

    -- The record call goes first, ahead of the shared gather line.
    n := position(gather_anchor IN src);
    IF n = 0 THEN RAISE EXCEPTION '%: the gather anchor moved', fn; END IF;
    src := left(src, n - 1) || record_block || substr(src, n);

    EXECUTE format('DROP FUNCTION public.%I(%s)', fn, old_args);
    EXECUTE src;
  END LOOP;
END $patch$;

-- Grants, by the new signatures; a DROP takes the old ones with it. The old
-- ACL named no PUBLIC, so the recreate revokes the default before granting —
-- anon reaches nothing we own, and stays that way.
REVOKE ALL ON FUNCTION public.evaluate_object_set(uuid, jsonb, jsonb, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aggregate_object_set(uuid, jsonb, text, text, text, boolean, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_object_set(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_object_set(uuid, jsonb, jsonb, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aggregate_object_set(uuid, jsonb, text, text, text, boolean, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_object_set(uuid, jsonb, text) TO authenticated, service_role;

-- ── PROVED BY DOING — named callers record, nameless ones do not ────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; t uuid; b uuid; st text; err text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m746 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm746-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm746-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M746 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false, metrics_enabled = true
   WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm746p', 'm746 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm746ds', 'm746ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''R1'')', phys) USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M746Thing', 'M746 thing') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'no index to read: %', coalesce(err, '?'); END IF;

  -- A nameless caller reads and records nothing — every suite stays silent.
  PERFORM * FROM public.evaluate_object_set(t);
  SELECT count(*) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 0 THEN RAISE EXCEPTION 'a nameless caller was recorded'; END IF;

  -- A named caller records one read per request, however many objects — and
  -- the recorder folds same-day, same-application, same-user requests into
  -- one row.
  PERFORM * FROM public.evaluate_object_set(t, p_application => 'object-explorer');
  PERFORM public.count_object_set(t, '[]'::jsonb, 'object-explorer');
  PERFORM * FROM public.aggregate_object_set(t, p_application => 'object-explorer');
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 3 THEN RAISE EXCEPTION '3 named requests recorded % reads', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION '3 same-day requests landed % rows, not one', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_usage
   WHERE object_type_id = t AND user_id = usr AND day = current_date AND writes = 0;
  IF n <> 1 THEN RAISE EXCEPTION 'the row is not bucketed by day and user'; END IF;

  -- "any object type or link type usage happening in Ontology Manager is not
  -- included" — the recorder's own arm, reached through the reader.
  PERFORM * FROM public.evaluate_object_set(t, p_application => 'ontology-manager');
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 3 THEN RAISE EXCEPTION 'Ontology Manager usage was included'; END IF;

  -- The toggle off records nothing, and the read still reads.
  UPDATE public.ontologies SET metrics_enabled = false WHERE id = ont;
  PERFORM * FROM public.evaluate_object_set(t, p_application => 'object-explorer');
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 3 THEN RAISE EXCEPTION 'a disabled toggle still recorded'; END IF;

  DELETE FROM public.ontology_usage WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
