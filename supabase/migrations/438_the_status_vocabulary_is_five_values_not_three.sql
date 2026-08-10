-- The status vocabulary is five values, and ours enforced three.
--
-- The history, so a fourth pass does not repeat it:
--   321  put `promoted` in the status enum.
--   327  moved it out to a Compass `resource_status` table, reading it as the
--        filesystem's "Promoted" curation flag — a real but DIFFERENT concept
--        (compass/resource-status.md).
--   the teardown deleted `resource_status`.
--   390  narrowed every status CHECK to active|experimental|deprecated, citing
--        edit-object-type.md's three-value sentence.
--   readings/ontology-manager-save-session.md §12 found the conflict and ruled
--        the five-value page the specific one and the three-value sentence
--        stale — and the schema kept enforcing the stale one.
--   the first foundry-gap run found the CHECKs, plus two live functions still
--        branching on 'example', a value the CHECK forbids: dead code since 390.
--
-- The page (object-link-types/metadata-statuses.md):
--
--   "The status can take on one of five values"
--   "Example: Indicates that the resource has been installed as an example.
--    Example resources are notional and are only suitable for trainings or
--    early-stage, exploratory use."
--   "Promoted (object types only): Indicates that the object type is a core,
--    trusted resource that has been vetted by an ontology owner."
--   "The `promoted` status applies only to object types. It is not available
--    for properties, link types, action types or interfaces."
--   "Setting an object type's status to `promoted` will automatically set its
--    visibility to `prominent`, increasing its discoverability across the
--    platform."
--
-- So: `example` returns everywhere, `promoted` on object types only, and the
-- visibility side-effect is a trigger. The 'example' branches in
-- `sync_link_type_status()` and `cascade_object_type_status()` need no change —
-- they were written for this vocabulary and have been unreachable since 390.
--
-- ── WHAT IS RECORDED BUT NOT BUILT ─────────────────────────────────────────
-- · "Only users with the `Ontology Owner` role on the ontology level can
--   directly apply the `promoted` status." We have no ontology-level roles yet;
--   until we do, any admin can set it. Recorded, not invented.
-- · "`Promoted` object types inherit similar operational protections of the
--   `active` status, such as restrictions on deletion." Link types enforce the
--   active protections in triggers (417); object types never did — that parity
--   gap predates this migration and is not widened by it. When object types
--   get their lifecycle guards, promoted joins active in them.

ALTER TABLE public.object_types DROP CONSTRAINT object_types_status_check;
ALTER TABLE public.object_types ADD CONSTRAINT object_types_status_check
  CHECK (status = ANY (ARRAY['promoted','active','experimental','deprecated','example']));

ALTER TABLE public.link_types DROP CONSTRAINT link_types_status_check;
ALTER TABLE public.link_types ADD CONSTRAINT link_types_status_check
  CHECK (status = ANY (ARRAY['active','experimental','deprecated','example']));

ALTER TABLE public.ontology_interfaces DROP CONSTRAINT ontology_interfaces_status_check;
ALTER TABLE public.ontology_interfaces ADD CONSTRAINT ontology_interfaces_status_check
  CHECK (status = ANY (ARRAY['active','experimental','deprecated','example']));

ALTER TABLE public.action_types DROP CONSTRAINT action_types_status_check;
ALTER TABLE public.action_types ADD CONSTRAINT action_types_status_check
  CHECK (status = ANY (ARRAY['active','experimental','deprecated','example']));

CREATE OR REPLACE FUNCTION public.promote_sets_prominent()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- "Setting an object type's status to `promoted` will automatically set its
  -- visibility to `prominent`" — automatically, so it is not the caller's job.
  IF NEW.status = 'promoted' THEN
    NEW.visibility := 'prominent';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER promote_sets_prominent
  BEFORE INSERT OR UPDATE OF status ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.promote_sets_prominent();

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; a uuid; b uuid; l uuid;
  usr uuid := gen_random_uuid(); before text; props jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('status-438') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws438@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws438@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS438');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws438', 'WS 438') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws438', 'WS438') RETURNING id INTO proj;

  props := jsonb_build_array(jsonb_build_object('property_id','k','display_name','K',
    'api_name','k','base_type','string','source','column','backing_column','k',
    'is_primary_key',true,'is_title_key',true,'required',true));

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights','flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  a := public.save_object_type(jsonb_build_object('api_name','Flight','label','Flight',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))), props);
  PERFORM public.save_working_state();

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'alerts','alerts') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  b := public.save_object_type(jsonb_build_object('api_name','Alert','label','Alert',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))), props);
  PERFORM public.save_working_state();

  l := public.save_link_type(jsonb_build_object(
    'source_object_type_id', a::text, 'target_object_type_id', b::text,
    'api_name','flightAlerts', 'label','Flight alerts', 'ontology_id', ont::text));
  PERFORM public.save_working_state();

  -- 1. Promoting sets prominence, automatically.
  UPDATE public.object_types SET visibility = 'normal' WHERE id = a;
  UPDATE public.object_types SET status = 'promoted' WHERE id = a;
  IF (SELECT visibility FROM public.object_types WHERE id = a) <> 'prominent' THEN
    RAISE EXCEPTION 'promoting did not set visibility to prominent';
  END IF;

  -- 2. Promoted is object types only. Both ends must be active first, or
  --    sync_link_type_status rewrites the value to the weakest end before the
  --    CHECK ever sees it — the sync wins over a manual write, which is its job.
  UPDATE public.object_types SET status = 'active' WHERE id IN (a, b);
  BEGIN
    UPDATE public.link_types SET status = 'promoted' WHERE id = l;
    RAISE EXCEPTION 'a link type accepted the promoted status';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. 'example' cascades to the link — the branch that has been dead since 390.
  UPDATE public.object_types SET status = 'example' WHERE id = b;
  IF (SELECT status FROM public.link_types WHERE id = l) <> 'example' THEN
    RAISE EXCEPTION 'an example end did not pull its link to example — the revived branch does not fire';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '438: five statuses, promoted implies prominent, and the example cascade is live again';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
