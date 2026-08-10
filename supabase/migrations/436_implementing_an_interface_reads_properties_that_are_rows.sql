-- Implementing an interface has been impossible since properties became rows.
--
-- Found by the first foundry-gap run. `assert_interface_conformance()` still
-- reads the shape 408 deleted:
--
--   FROM object_types t CROSS JOIN LATERAL jsonb_array_elements(t.properties)
--
-- `object_types.properties` does not exist — properties are rows in
-- `object_type_properties` (O2). The trigger fires BEFORE INSERT OR UPDATE ON
-- object_type_interfaces, so every attempt to implement an interface raises
-- `column t.properties does not exist`. Nothing noticed because the table has
-- zero rows: a trigger on an empty table is invisible to every audit that only
-- reads. Same class as `auth_org_id()` reading a dropped table for a day, and
-- as the hospitality trigger on auth.users that locked out every account.
--
-- The rewrite matches a required interface property against the rows:
-- `property_id` for the key, `base_type` for the type. Both vocabularies are
-- the same 22 base types since O2, so the comparison is honest.
--
-- ── WHAT THIS DELIBERATELY DOES NOT FIX ────────────────────────────────────
-- Name-matching itself is the wrong mechanism:
--
--   "an object type must declare a mapping of existing object properties onto
--    the required interface properties"     (interfaces/implement-interface.md)
--
-- A declared MAPPING is a child table on the implementation, and it arrives
-- with the interfaces phase (the gap report's B4: icon, searchable, required
-- flags, extensions, and the mapping). This migration makes the trigger true
-- against the schema we have; it does not pretend to be that phase.

CREATE OR REPLACE FUNCTION public.assert_interface_conformance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s (%s)', req->>'key', req->>'type'), ', ')
    INTO v_missing
  FROM ontology_interfaces i
  CROSS JOIN LATERAL jsonb_array_elements(i.properties) AS req
  WHERE i.id = NEW.interface_id
    AND NOT EXISTS (
      SELECT 1 FROM object_type_properties p
      WHERE p.object_type_id = NEW.object_type_id
        AND p.property_id = req->>'key'
        AND p.base_type   = req->>'type'
    );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:DoesNotConform — missing or mistyped: %', v_missing
      USING ERRCODE = '23514',
            HINT = 'Every property the interface requires must exist on the object type with the same base type.';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.assert_interface_conformance() IS
  'A type may only implement an interface whose required properties it has, matched by property_id and base_type against object_type_properties rows. Name-matching is interim: Foundry requires a declared mapping ("an object type must declare a mapping of existing object properties onto the required interface properties"), which arrives with the interfaces phase.';

-- ── the assertion the trigger never had: an implementation actually lands ───
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid; iface uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('iface-436') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws436@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws436@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS436');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws436', 'WS 436') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws436', 'WS436') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','flight_id','display_name','Flight Id',
      'api_name','flightId','base_type','string','source','column','backing_column','flight_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label, properties)
  VALUES (ont, 'identifiable', 'Identifiable',
          '[{"key":"flight_id","type":"string"}]'::jsonb)
  RETURNING id INTO iface;

  -- 1. The path that raised "column t.properties does not exist" now works.
  INSERT INTO public.object_type_interfaces (object_type_id, interface_id, organization_id)
  VALUES (t, iface, org);

  -- 2. And the refusal is a conformance verdict, not a Postgres error.
  DELETE FROM public.object_type_interfaces WHERE object_type_id = t;
  UPDATE public.ontology_interfaces
     SET properties = '[{"key":"tail_number","type":"string"}]'::jsonb
   WHERE id = iface;
  BEGIN
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id, organization_id)
    VALUES (t, iface, org);
    RAISE EXCEPTION 'a type conformed to an interface whose property it lacks';
  EXCEPTION WHEN check_violation THEN
    IF sqlerrm NOT LIKE '%DoesNotConform%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '436: an interface can be implemented, and non-conformance is refused by name';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
