-- 499's CREATE OR REPLACE clobbered a namesake: guard_promotion was already
-- the ontology STATUS gate on object_types (454 → 460 → 461 — promotion is
-- Ontology-Owner-only and sets visibility prominent), and C2's Promoted-flag
-- gate overwrote its body, so every object_types status update read a field
-- the table does not have. Two different promotions, now two functions:
-- guard_promotion stays the ontology one, restored verbatim from 461;
-- guard_promoted_flag is the Compass one, and the four C2 triggers repoint.

-- ── the ontology status gate, restored verbatim (461) ───────────────────────
CREATE OR REPLACE FUNCTION public.guard_promotion()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE prop text;
BEGIN
  IF NEW.status = 'promoted' AND OLD.status IS DISTINCT FROM 'promoted' THEN
    -- A compose is a dry-run that persists nothing, so it gates nothing.
    IF nullif(current_setting('beacon.composing_branch', true), '') IS NOT NULL THEN
      NEW.visibility := 'prominent';
      RETURN NEW;
    END IF;

    -- "Other users must submit a proposal for review and approval by an
    -- Ontology Owner on the ontology level": during a merge, the promotion
    -- stands when this proposal's task for this object type carries an
    -- approval from a user holding the ontology owner role.
    prop := nullif(current_setting('beacon.merging_proposal', true), '');
    IF prop IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.proposal_tasks t
        JOIN public.proposal_reviews r ON r.task_id = t.id AND r.decision = 'approved'
        JOIN public.ontology_role_grants g
          ON g.user_id = r.user_id AND g.ontology_id = NEW.ontology_id AND g.role = 'owner'
       WHERE t.proposal_id = prop::uuid
         AND t.resource_kind = 'object_type' AND t.resource_id = NEW.id) THEN
      NEW.visibility := 'prominent';
      RETURN NEW;
    END IF;

    IF coalesce(public.ontology_role(NEW.ontology_id), '') <> 'owner' THEN
      RAISE EXCEPTION 'Ontology:PromotionIsOwnerOnly — only users with the Ontology Owner role on the ontology level can directly apply the promoted status'
        USING HINT = 'Submit a proposal for review by an Ontology Owner instead.';
    END IF;
    NEW.visibility := 'prominent';
  END IF;
  RETURN NEW;
END $$;

-- ── the Compass Promoted-flag gate, under its own name ──────────────────────
CREATE OR REPLACE FUNCTION public.guard_promoted_flag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.promoted IS DISTINCT FROM OLD.promoted
     AND auth.uid() IS NOT NULL
     AND public.auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Compass:PromotionTakesACurator — changing a resource''s status takes the curator role (org admin stands in)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER trg_guard_project_promotion ON public.projects;
DROP TRIGGER trg_guard_folder_promotion ON public.folders;
DROP TRIGGER trg_guard_dataset_promotion ON public.datasets;
DROP TRIGGER trg_guard_rv_promotion ON public.restricted_views;
CREATE TRIGGER trg_guard_project_promotion BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_promoted_flag();
CREATE TRIGGER trg_guard_folder_promotion BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.guard_promoted_flag();
CREATE TRIGGER trg_guard_dataset_promotion BEFORE UPDATE ON public.datasets
FOR EACH ROW EXECUTE FUNCTION public.guard_promoted_flag();
CREATE TRIGGER trg_guard_rv_promotion BEFORE UPDATE ON public.restricted_views
FOR EACH ROW EXECUTE FUNCTION public.guard_promoted_flag();

-- ── assertions: both promotions, side by side ───────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; proj uuid; fa uuid;
  u1 uuid := gen_random_uuid(); before text; vis text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('promo-500') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p500@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 'p500@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('P500');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'p500', 'P500', false) RETURNING id INTO ont;
  RESET ROLE;
  INSERT INTO public.ontology_role_grants (ontology_id, user_id, role) VALUES (ont, u1, 'owner');
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'P500Type', 'P500', 'active') RETURNING id INTO t;
  SET LOCAL ROLE authenticated;

  -- 1. The ontology status gate works again: an ontology owner promotes and
  --    visibility turns prominent — 460's own rule.
  UPDATE public.object_types SET status = 'promoted' WHERE id = t;
  SELECT visibility INTO vis FROM public.object_types WHERE id = t;
  IF vis <> 'prominent' THEN
    RAISE EXCEPTION 'promoting the STATUS should set visibility prominent, got %', vis;
  END IF;

  -- 2. The Compass flag gate still holds under its new name.
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'p500', 'P500') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  INSERT INTO public.folders (project_id, name) VALUES (proj, 'Promotable') RETURNING id INTO fa;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  BEGIN
    UPDATE public.folders SET promoted = true WHERE id = fa;
    RAISE EXCEPTION 'a non-curator promoted a folder';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:PromotionTakesACurator%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '500: two promotions, two functions — the status gate restored, the flag gate renamed';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
