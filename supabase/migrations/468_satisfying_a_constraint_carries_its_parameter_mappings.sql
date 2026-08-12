-- Satisfying an action constraint carries its parameter mappings, atomically.
--
--   "Select a concrete action type on the implementing object type for each
--    required constraint. You may skip or map optional constraints."
--   "To configure parameter mappings, select the settings icon for the mapped
--    action type constraint to open the Configure parameters dialog."
--                                 (interfaces/interface-action-type-constraints)
--
-- 467's completeness rules judge at commit, and PostgREST commits per
-- request — so a client that wrote the satisfaction in one request and the
-- mappings in the next could never pass a constraint with required
-- parameters. Same shape as implement_interface (455): one call, one
-- transaction, the row and its mappings land together. Re-satisfying with a
-- different action type replaces the mappings wholesale — they describe the
-- old action's parameters and cannot survive it.

CREATE OR REPLACE FUNCTION public.satisfy_action_constraint(
  p_object_type uuid,
  p_interface   uuid,
  p_constraint  uuid,
  p_action_type uuid,
  p_mappings    jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE e jsonb;
BEGIN
  INSERT INTO public.interface_action_satisfactions
    (object_type_id, interface_id, constraint_id, action_type_id)
  VALUES (p_object_type, p_interface, p_constraint, p_action_type)
  ON CONFLICT (object_type_id, interface_id, constraint_id)
    DO UPDATE SET action_type_id = EXCLUDED.action_type_id;

  DELETE FROM public.interface_action_parameter_mappings
   WHERE object_type_id = p_object_type AND interface_id = p_interface
     AND constraint_id = p_constraint;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_mappings, '[]'::jsonb)) LOOP
    INSERT INTO public.interface_action_parameter_mappings
      (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
    VALUES (p_object_type, p_interface, p_constraint,
            (e->>'parameter_constraint_id')::uuid,
            (e->>'action_parameter_id')::uuid);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.satisfy_action_constraint(uuid, uuid, uuid, uuid, jsonb) IS
  'The Actions sub-tab''s writer: the satisfaction and its Configure-parameters mappings in one transaction, so 467''s commit-time completeness judges the whole. Re-satisfying replaces the mappings wholesale.';

REVOKE ALL ON FUNCTION public.satisfy_action_constraint(uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.satisfy_action_constraint(uuid, uuid, uuid, uuid, jsonb) TO authenticated;

-- ── assertion, as authenticated ─────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; iface uuid; ac uuid; pc uuid;
  t uuid; act uuid; ap uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('sat-468') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','sat468@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'sat468@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Sat468');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'sat468', 'Sat 468', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Satisfied', 'Satisfied') RETURNING id INTO iface;
  INSERT INTO public.interface_action_constraints (interface_id, api_name, display_name, required)
  VALUES (iface, 'do-it', 'Do it', true) RETURNING id INTO ac;
  INSERT INTO public.interface_action_parameter_constraints
    (constraint_id, api_name, display_name, base_type, required)
  VALUES (ac, 'title', 'Title', 'string', true) RETURNING id INTO pc;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Sat468T', 'T') RETURNING id INTO t;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'sat468-do', 'Do') RETURNING id INTO act;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, base_type, required)
  VALUES (act, 'title', 'Title', 'string', true) RETURNING id INTO ap;

  PERFORM public.implement_interface(t, iface, '[]'::jsonb);
  PERFORM public.satisfy_action_constraint(t, iface, ac, act, jsonb_build_array(
    jsonb_build_object('parameter_constraint_id', pc, 'action_parameter_id', ap)));
  SET CONSTRAINTS ALL IMMEDIATE;
  IF (SELECT count(*) FROM public.interface_action_parameter_mappings
       WHERE object_type_id = t AND constraint_id = ac) <> 1 THEN
    RAISE EXCEPTION 'assertion failed: the mapping did not land with the satisfaction';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
