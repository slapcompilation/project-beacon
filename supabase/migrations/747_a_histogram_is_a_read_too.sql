-- 747 — a histogram is a read too.
--
-- 746 wired the read recording into `evaluate_object_set`,
-- `aggregate_object_set` and `count_object_set` and stopped there — the count
-- I trusted was the reader grep's, and the same grep line listed a fourth
-- import I did not act on: the Explorer's charts also read through
-- `histogram_object_set`. The page's definition covers it by name:
--
--   "A read is recorded when an application loads objects for a specified
--    object type. This can include displaying objects in a table in Workshop,
--    returning all objects from search for a given object type, aggregating a
--    property on an object type, and so on."
--   — ontology-manager/view-usage.md
--
-- A histogram is aggregating a property on an object type. Left out, every
-- Explorer session that renders a chart under-counts, and an applied
-- migration cannot be edited — so the fourth reader gets the same patch,
-- forward: `p_application text DEFAULT NULL` appended, STABLE dropped
-- (recording is a write), the self-swallowing record block ahead of the
-- gather, grants re-issued minus PUBLIC.
--
-- Still unrecorded after this, deliberately: `search_objects` (it spans
-- types), the `_by_api_name` variants (the isolate's doors — which
-- application a Function's read belongs to is a design question, not a
-- patch), and the write side (`apply_action`, `apply_function_edits`).

DO $patch$
DECLARE
  src text;
  n int;
  gather_anchor text := '  SELECT t.ontology_id, x.index_table INTO ont, tbl';
  record_block text := '  -- One load request is one read (view-usage), recorded when the caller
  -- names itself. A metrics failure must never fail the read, so this block
  -- swallows its own errors and only its own (747).
  IF p_application IS NOT NULL THEN
    BEGIN
      PERFORM public.record_ontology_usage(p_object_type, NULL, p_application, 1, 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'histogram_object_set';

  n := position(')' || chr(10) || ' RETURNS' IN src);
  IF n = 0 THEN RAISE EXCEPTION 'the CREATE line shape moved'; END IF;
  src := left(src, n - 1) || ', p_application text DEFAULT NULL' || substr(src, n);

  n := (length(src) - length(replace(src, ' STABLE SECURITY DEFINER', ''))) /
       length(' STABLE SECURITY DEFINER');
  IF n <> 1 THEN RAISE EXCEPTION 'STABLE SECURITY DEFINER found % times', n; END IF;
  src := replace(src, ' STABLE SECURITY DEFINER', ' SECURITY DEFINER');

  n := position(gather_anchor IN src);
  IF n = 0 THEN RAISE EXCEPTION 'the gather anchor moved'; END IF;
  src := left(src, n - 1) || record_block || substr(src, n);

  DROP FUNCTION public.histogram_object_set(uuid, jsonb, text, integer);
  EXECUTE src;
END $patch$;

REVOKE ALL ON FUNCTION public.histogram_object_set(uuid, jsonb, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.histogram_object_set(uuid, jsonb, text, integer, text) TO authenticated, service_role;

-- ── PROVED BY DOING — the fourth reader records like the other three ────────
--
-- The record call sits ahead of the index gather, so an unindexed type is
-- enough fixture: the read returns nothing and still counts as one request.

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; t uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m747 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm747-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm747-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M747 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false, metrics_enabled = true
   WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm747p', 'm747 probe') RETURNING id INTO proj;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M747Thing', 'M747 thing') RETURNING id INTO t;

  PERFORM * FROM public.histogram_object_set(t, p_application => 'object-explorer');
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'a named histogram recorded % reads, not one', n; END IF;

  PERFORM * FROM public.histogram_object_set(t);
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'a nameless histogram was recorded'; END IF;

  DELETE FROM public.ontology_usage WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
