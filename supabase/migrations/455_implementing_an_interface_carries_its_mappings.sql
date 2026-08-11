-- Implementing an interface carries its mappings, atomically.
--
-- 450's conformance trigger is DEFERRABLE INITIALLY DEFERRED: it has the last
-- word at COMMIT. PostgREST wraps every request in its own transaction, so a
-- client that inserts the implementation row alone commits alone — and any
-- interface with a required property refuses it, correctly, with nowhere to
-- put the mappings. The writer is the missing door: one call, one transaction,
-- the row and its declared resolutions land together and the trigger judges
-- the whole.
--
--   "An object type must declare a mapping of existing object properties onto
--    the required interface properties." (450's own hint, the contract this
--    writer satisfies)
--
-- Mappings arrive by the interface property's NATURAL key (`property_id`),
-- because that is what survives a re-save of the interface (451); the writer
-- resolves it to the row id the mappings table references.

CREATE OR REPLACE FUNCTION public.implement_interface(
  p_object_type uuid,
  p_interface   uuid,
  p_mappings    jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE impl uuid; e jsonb; ip uuid;
BEGIN
  INSERT INTO public.object_type_interfaces (object_type_id, interface_id)
  VALUES (p_object_type, p_interface)
  RETURNING id INTO impl;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_mappings, '[]'::jsonb)) LOOP
    -- The property may live on the interface itself or on an ancestor — the
    -- conformance obligation includes the inherited clause, so the mapping may
    -- name either.
    SELECT p.id INTO ip
      FROM public.interface_properties p
     WHERE p.property_id = e->>'property_id'
       AND p.interface_id IN (SELECT public.interface_ancestors(p_interface)
                              UNION SELECT p_interface);
    IF ip IS NULL THEN
      RAISE EXCEPTION 'Ontology:NoSuchInterfaceProperty — % is not a property of this interface or its ancestors',
        e->>'property_id';
    END IF;

    INSERT INTO public.interface_implementation_mappings
      (object_type_id, interface_id, interface_property_id, resolution,
       object_property_id, backing_column)
    VALUES (p_object_type, p_interface, ip, e->>'resolution',
            nullif(e->>'object_property_id','')::uuid,
            nullif(e->>'backing_column',''));
  END LOOP;

  RETURN impl;
END $$;

COMMENT ON FUNCTION public.implement_interface(uuid, uuid, jsonb) IS
  'Insert an implementation and its per-property resolutions in one transaction, so 450''s commit-time conformance judges the whole claim instead of refusing a bare row. Mappings name interface properties by natural key.';

REVOKE ALL ON FUNCTION public.implement_interface(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.implement_interface(uuid, uuid, jsonb) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid; pid uuid;
  iface uuid; impl uuid; usr uuid := gen_random_uuid(); before text; msg text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('impl-455') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','impl455@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'impl455@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Impl455');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'impl455', 'Impl 455', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'impl455', 'Impl 455') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'impl455ds', 'impl455ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  t := public.save_object_type(
    jsonb_build_object('api_name','Impl455Thing','label','Thing','ontology_id',ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(jsonb_build_object(
      'property_id','thing_id','display_name','Thing Id','api_name','thingId',
      'base_type','string','source','column','backing_column','thing_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  SELECT id INTO pid FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'thing_id';

  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Identified', 'Identified') RETURNING id INTO iface;
  INSERT INTO public.interface_properties
    (interface_id, property_id, display_name, api_name, base_type, required)
  VALUES (iface, 'ext_id', 'External Id', 'externalId', 'string', true);

  -- A bare implementation refuses at the (forced) commit. The subtransaction
  -- abort takes the row and the SET CONSTRAINTS change with it.
  BEGIN
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id) VALUES (t, iface);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: a bare implementation should not conform';
  EXCEPTION WHEN raise_exception THEN
    msg := SQLERRM;
    IF msg NOT LIKE '%DoesNotConform%' THEN RAISE; END IF;
  END;

  -- A mapping naming a property the interface does not have is refused by name.
  BEGIN
    PERFORM public.implement_interface(t, iface, jsonb_build_array(jsonb_build_object(
      'property_id','nope','resolution','edit_only')));
    RAISE EXCEPTION 'assertion failed: an unknown property should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%NoSuchInterfaceProperty%' THEN RAISE; END IF;
  END;

  -- The writer lands the row and the resolution together, and conforms.
  impl := public.implement_interface(t, iface, jsonb_build_array(jsonb_build_object(
    'property_id','ext_id','resolution','choose_existing','object_property_id',pid)));
  SET CONSTRAINTS ALL IMMEDIATE;
  IF (SELECT count(*) FROM public.interface_implementation_mappings
       WHERE object_type_id = t AND interface_id = iface) <> 1 THEN
    RAISE EXCEPTION 'assertion failed: the mapping did not land';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
