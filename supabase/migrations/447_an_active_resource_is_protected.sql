-- An active resource cannot be deleted or renamed, and now the database says so.
--
-- The first nightly foundry-gap report's top finding: link types enforce the
-- protections (417's guards), object types enforce nothing — a parity gap 438
-- recorded and did not widen. The page, object-link-types/metadata-statuses:
--
--   "It cannot be deleted. A resource's status must be `experimental` or
--    `deprecated` before it can be deleted."
--
--   "The API name of an active resource cannot be changed. Changing an API
--    name is only possible for those marked as `experimental`."
--
--   "`Promoted` object types inherit similar protections as `active` object
--    types for API names."
--
-- One guard, three status-bearing resource tables: object_types, action_types,
-- ontology_interfaces. (shared_properties carries no status; link_types keep
-- 417's guards — note that 417 blocks renames only for ACTIVE, where the page
-- says only-experimental may rename. The new guard enforces the page; 417's
-- looser pair is left as-is and named here rather than silently diverging.)
--
-- The rename rule is deliberately the page's, which is STRICTER than
-- no-renaming-active: deprecated and example resources cannot be renamed
-- either — "only possible for those marked as experimental".

CREATE OR REPLACE FUNCTION public.guard_resource_lifecycle()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'promoted') THEN
      RAISE EXCEPTION 'Ontology:ActiveResourceIsProtected — an % resource cannot be deleted', OLD.status
        USING HINT = 'A resource''s status must be experimental or deprecated before it can be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND OLD.status <> 'experimental' THEN
    RAISE EXCEPTION 'Ontology:ApiNameIsFixed — a % resource''s API name cannot change', OLD.status
      USING HINT = 'Changing an API name is only possible for those marked as experimental.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_type_lifecycle
  BEFORE DELETE OR UPDATE OF api_name ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_lifecycle();
CREATE TRIGGER guard_action_type_lifecycle
  BEFORE DELETE OR UPDATE OF api_name ON public.action_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_lifecycle();
CREATE TRIGGER guard_interface_lifecycle
  BEFORE DELETE OR UPDATE OF api_name ON public.ontology_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_resource_lifecycle();

COMMENT ON FUNCTION public.guard_resource_lifecycle() IS
  'The active protections: no deletion while active or promoted, no API-name change except while experimental. Link types carry 417''s older pair; every other status-bearing resource carries this one.';

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('guard-447') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws447@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws447@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS447');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws447', 'WS 447') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws447', 'WS447') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'g447', 'g447') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Guarded','label','Guarded','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','k','display_name','K','api_name','k',
      'base_type','string','source','column','backing_column','k',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  -- 1. Active refuses deletion and rename.
  UPDATE public.object_types SET status = 'active' WHERE id = t;
  BEGIN
    DELETE FROM public.object_types WHERE id = t;
    RAISE EXCEPTION 'an active object type was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ActiveResourceIsProtected%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.object_types SET api_name = 'Renamed' WHERE id = t;
    RAISE EXCEPTION 'an active object type was renamed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ApiNameIsFixed%' THEN RAISE; END IF;
  END;

  -- 2. Promoted inherits the protections.
  UPDATE public.object_types SET status = 'promoted' WHERE id = t;
  BEGIN
    DELETE FROM public.object_types WHERE id = t;
    RAISE EXCEPTION 'a promoted object type was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ActiveResourceIsProtected%' THEN RAISE; END IF;
  END;

  -- 3. Only experimental renames; deprecated deletes.
  UPDATE public.object_types SET status = 'experimental' WHERE id = t;
  UPDATE public.object_types SET api_name = 'Renamed' WHERE id = t;
  UPDATE public.object_types
     SET status='deprecated', deprecation_reason='done', deprecation_deadline=current_date+7
   WHERE id = t;
  BEGIN
    UPDATE public.object_types SET api_name = 'RenamedAgain' WHERE id = t;
    RAISE EXCEPTION 'a deprecated object type was renamed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ApiNameIsFixed%' THEN RAISE; END IF;
  END;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '447: active and promoted are protected; only experimental renames; deprecated deletes';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
