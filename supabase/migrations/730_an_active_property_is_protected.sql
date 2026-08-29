-- 730 — an active property is protected, the way an active type already is
-- (creation review, F11's second half).
--
-- `guard_resource_lifecycle` has guarded object types, action types and
-- interfaces since it was written; `object_type_properties` was never given a
-- trigger, so a property could be deleted or renamed at any status. The page
-- states both protections, and states them of the property:
--
--   "Properties with an `active` status **cannot** be deleted."
--   — object-link-types/edit-properties.md
--
--   "Note that you **cannot** change the API name for properties with an
--    `active` status."
--   — object-link-types/edit-properties.md
--
-- It is a SEPARATE function rather than the existing trigger, because reusing
-- that one would have been stricter than this page. `guard_resource_lifecycle`
-- refuses an API-name change unless the row is `experimental`; the sentence
-- above refuses it only when the row is `active`, which leaves `deprecated` and
-- `example` free. Attaching the existing guard would have quietly imported a
-- rule this page does not make, and the house rule is not to be stricter than
-- Foundry. Delete is the same shape: `active` only.
--
-- Where the rule goes: a trigger, because the fact is about a transition rather
-- than a row — a CHECK cannot see OLD. It fires on the save's own path, since
-- `apply_object_type` deletes the properties the payload stopped naming and
-- upserts the rest.
--
-- Live exposure: five properties, all `example`. Nothing standing changes.
--
-- What this does NOT do, so it is not mistaken for done: the page's third
-- protection — "you cannot change the primary key of an object type with an
-- `active` status" — is about the OBJECT TYPE's status, not the property's,
-- and belongs with the type's own guard. Recorded, unbuilt.

CREATE FUNCTION public.guard_property_lifecycle()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      RAISE EXCEPTION 'Ontology:ActivePropertyIsProtected — an active property cannot be deleted'
        USING HINT = 'Set the property to deprecated or experimental first. Deleting it "will break any views or applications referencing the property."';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'Ontology:PropertyApiNameIsFixed — an active property''s API name cannot change'
      USING HINT = 'Change the status first; only a non-active property may be renamed.';
  END IF;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.guard_property_lifecycle() IS
  'A property with an active status can be neither deleted nor API-renamed (edit-properties). Deliberately narrower than guard_resource_lifecycle, which refuses a rename at any status but experimental — that page''s rule, not this one''s. 730.';

CREATE TRIGGER guard_property_lifecycle
  BEFORE DELETE OR UPDATE OF api_name ON public.object_type_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_lifecycle();

-- ── PROVED BY DOING — both arms fire, and only for active ───────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  t uuid; dsrc uuid; n int;
  pk_prop jsonb := jsonb_build_object('property_id','pk','display_name','Id',
    'api_name','id','base_type','string','source','column','backing_column','pk',
    'is_primary_key',true,'is_title_key',true,'required',true);
  props jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m730 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm730-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm730-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M730 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm730p', 'm730 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm730ds', 'm730ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  -- The key lands first: a non-key property must name its datasource, and the
  -- datasource only has an id once the create has applied.
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M730Thing','label','M730 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(pk_prop)) INTO t;
  PERFORM public.save_working_state();
  SELECT id INTO dsrc FROM public.object_type_datasources WHERE object_type_id = t;

  props := jsonb_build_array(pk_prop,
    jsonb_build_object('property_id','note','display_name','Note','api_name','note',
      'base_type','string','source','column','backing_column','note',
      'datasource_id',dsrc));
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M730Thing','label','M730 thing',
      'ontology_id',ont), props);
  PERFORM public.save_working_state();

  -- Experimental — the default — is free on both counts.
  UPDATE public.object_type_properties SET api_name = 'noteTwo'
   WHERE object_type_id = t AND property_id = 'note';
  DELETE FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'note';
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'note';
  IF n <> 0 THEN RAISE EXCEPTION 'an experimental property could not be deleted'; END IF;

  -- Active is protected on both.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id, status)
  VALUES (t, 'note', 'Note', 'note', 'string', 'column', 'note', dsrc, 'active');
  BEGIN
    UPDATE public.object_type_properties SET api_name = 'renamed'
     WHERE object_type_id = t AND property_id = 'note';
    RAISE EXCEPTION 'an active property was renamed';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%PropertyApiNameIsFixed%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.object_type_properties
     WHERE object_type_id = t AND property_id = 'note';
    RAISE EXCEPTION 'an active property was deleted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%ActivePropertyIsProtected%' THEN RAISE; END IF;
  END;

  -- Deprecated may be renamed: the page refuses only `active`, and being
  -- stricter than the page is the thing this migration went out of its way
  -- not to do.
  UPDATE public.object_type_properties
     SET status = 'deprecated', deprecation_reason = 'probe',
         deprecation_deadline = current_date + 1
   WHERE object_type_id = t AND property_id = 'note';
  UPDATE public.object_type_properties SET api_name = 'renamed'
   WHERE object_type_id = t AND property_id = 'note';
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND api_name = 'renamed';
  IF n <> 1 THEN RAISE EXCEPTION 'a deprecated property could not be renamed'; END IF;

  -- And the save path itself refuses to drop an active property.
  UPDATE public.object_type_properties SET status = 'active', deprecation_reason = NULL,
         deprecation_deadline = NULL
   WHERE object_type_id = t AND property_id = 'note';
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M730Thing','label','M730 thing','ontology_id',ont),
    jsonb_build_array(pk_prop));
  BEGIN
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'a save dropped an active property';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%ActivePropertyIsProtected%' THEN RAISE; END IF;
  END;

  DELETE FROM public.working_state_changes WHERE resource_id = t;
  UPDATE public.object_type_properties SET status = 'experimental'
   WHERE object_type_id = t;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
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
