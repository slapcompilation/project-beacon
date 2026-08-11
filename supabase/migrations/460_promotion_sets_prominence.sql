-- Promotion sets prominence.
--
--   "Visibility: Setting an object type's status to `promoted` will
--    automatically set its visibility to `prominent`, increasing its
--    discoverability across the platform."
--                                      (object-link-types/metadata-statuses)
--
-- 454 built the owner gate; the visibility half of the same section was left
-- unbuilt. The other protections the section names — "Promoted object types
-- inherit similar operational protections of the active status, such as
-- restrictions on deletion" — 447 already enforces.
--
-- NOT built here, and why: "Other users must submit a proposal for review and
-- approval." The proposal path needs the branch overlay —
-- save_working_state(p_branch) still raises BranchSaveNotImplemented and
-- merge_proposal applies nothing — so wiring promotion through proposals
-- before branch saves exist would be structure without a floor. The branch
-- overlay is its own phase with its own reading, queued.

CREATE OR REPLACE FUNCTION public.guard_promotion()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'promoted' AND OLD.status IS DISTINCT FROM 'promoted' THEN
    IF coalesce(public.ontology_role(NEW.ontology_id), '') <> 'owner' THEN
      RAISE EXCEPTION 'Ontology:PromotionIsOwnerOnly — only users with the Ontology Owner role on the ontology level can directly apply the promoted status'
        USING HINT = 'Submit a proposal for review by an Ontology Owner instead.';
    END IF;
    NEW.visibility := 'prominent';
  END IF;
  RETURN NEW;
END $$;

-- The trigger from 454 already points at this function.

-- ── assertion, as authenticated ─────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('promo-460') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','promo460@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'promo460@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Promo460');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'promo460', 'Promo 460', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_role_grants (ontology_id, user_id, role)
  VALUES (ont, usr, 'owner');
  INSERT INTO public.object_types (ontology_id, api_name, label, status, visibility)
  VALUES (ont, 'Promo460T', 'T', 'active', 'normal') RETURNING id INTO t;

  UPDATE public.object_types SET status = 'promoted' WHERE id = t;
  IF (SELECT visibility FROM public.object_types WHERE id = t) <> 'prominent' THEN
    RAISE EXCEPTION 'assertion failed: promotion must set visibility to prominent';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
