-- An action constraint's API name is camelCase, like its screenshot says.
--
-- Found by the side-by-side review of 461–472 against the pages and images:
-- `iatc-config-dialog-set.png` writes the constraint's API name `createTicket`
-- and its parameters `subject`, `createdBy`, `createdAt` — one camelCase
-- grammar for both levels, with the same helper text API names carry
-- everywhere ("how this constraint will be referred to in code"). 467 gave
-- the PARAMETER level that CHECK and left the constraint level with only a
-- UNIQUE — so the review's own fixtures staged kebab-case names and nothing
-- objected. Zero rows exist; the grammar lands clean, and the regression
-- fixtures move to camelCase in the same change.

ALTER TABLE public.interface_action_constraints
  ADD CONSTRAINT interface_action_constraints_api_name_grammar
    CHECK (api_name ~ '^[a-z][a-zA-Z0-9]*$');

-- ── assertion ───────────────────────────────────────────────────────────────
DO $$
DECLARE org uuid; sp uuid; ont uuid; iface uuid; usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  INSERT INTO public.organizations (name) VALUES ('cam-473') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','cam473@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'cam473@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  SET LOCAL ROLE authenticated;

  sp := public.create_space('Cam473');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'cam473', 'Cam 473', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Cam473I', 'I') RETURNING id INTO iface;

  BEGIN
    INSERT INTO public.interface_action_constraints (interface_id, api_name, display_name)
    VALUES (iface, 'create-ticket', 'Kebab');
    RAISE EXCEPTION 'assertion failed: kebab-case should refuse';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.interface_action_constraints (interface_id, api_name, display_name)
  VALUES (iface, 'createTicket', 'Camel');

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
