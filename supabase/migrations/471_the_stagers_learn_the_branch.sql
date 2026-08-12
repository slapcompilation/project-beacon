-- The stagers learn the branch.
--
--   "Within your branch, you can make changes to Foundry resources without
--    affecting the `main` branch."          (global-branching/core-concepts)
--
-- stage_change has carried p_branch since 419; the five stagers hardcoded
-- NULL, so every edit staged onto main no matter what the header's branch
-- selector said. Each gains a trailing `p_branch uuid DEFAULT NULL` passed
-- straight through — the old two-or-one-argument call sites keep working via
-- the default. The old signatures are DROPPED first: a defaulted overload
-- beside the original would make the short call ambiguous.
--
-- Patched from the live catalog with counted needles (the 454 lesson): the
-- signature's closing is the one ")\n RETURNS uuid" and the branch argument
-- is the one ", NULL," in each body.

DO $$
DECLARE
  fn text; def text; sig_needle text := E')\n RETURNS uuid'; n1 int; n2 int;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'save_object_type', 'save_link_type', 'save_shared_property',
    'save_action_type', 'save_interface'])
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fn;

    n1 := (length(def) - length(replace(def, sig_needle, ''))) / length(sig_needle);
    n2 := (length(def) - length(replace(def, ', NULL,', ''))) / length(', NULL,');
    IF n1 <> 1 OR n2 <> 1 THEN
      RAISE EXCEPTION '% has drifted (signature needle %, branch needle %) — wire p_branch by hand', fn, n1, n2;
    END IF;

    def := replace(def, sig_needle, E', p_branch uuid DEFAULT NULL::uuid)\n RETURNS uuid');
    def := replace(def, ', NULL,', ', p_branch,');

    EXECUTE format('DROP FUNCTION public.%I(%s)', fn,
      (SELECT pg_get_function_identity_arguments(p.oid)
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = fn));
    EXECUTE def;
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated', fn);
  END LOOP;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; b uuid; t uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('stg-471') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','stg471@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'stg471@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Stg471');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'stg471', 'Stg 471', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'stg-471', 'Stg 471') RETURNING id INTO b;

  -- The stager stages onto the branch when told to…
  t := public.save_object_type(
    jsonb_build_object('api_name', 'Stg471A', 'label', 'A', 'ontology_id', ont),
    '[]'::jsonb, b);
  IF NOT EXISTS (SELECT 1 FROM public.working_state_changes
                  WHERE resource_id = t AND branch_id = b) THEN
    RAISE EXCEPTION 'assertion failed: the stager did not carry the branch';
  END IF;

  -- …and onto main when not, exactly as before.
  t := public.save_object_type(
    jsonb_build_object('api_name', 'Stg471B', 'label', 'B', 'ontology_id', ont),
    '[]'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.working_state_changes
                  WHERE resource_id = t AND branch_id IS NULL) THEN
    RAISE EXCEPTION 'assertion failed: the default must still stage onto main';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
