-- A link type's API name is fixed once it is active, like every other resource.
--
-- `object-link-types/metadata-statuses.md` states the rule for resources in
-- general, not for object types in particular:
--
--   "The API name of an active resource cannot be changed. Changing an API name is only possible for those marked as `experimental`."
--   — object-link-types/metadata-statuses.md

-- We enforce it for object types and not for link types.
-- `guard_resource_lifecycle` holds exactly this rule and raises
-- `Ontology:ApiNameIsFixed` with the page's own sentence as its HINT; it is
-- attached to object_types as `guard_object_type_lifecycle` and to nothing
-- else. `link_types` carries nine triggers and none of them looks at api_name —
-- `guard_link_type_status` is about status transitions, verified by reading it.
--
-- So a link type's API name could be changed at any status, which is the thing
-- the page forbids, and 816 made it more reachable by giving the side API names
-- a form.
--
-- BEFORE UPDATE ONLY, deliberately. The generic guard also refuses DELETE of an
-- active or promoted resource, and link_types already has
-- `guard_link_type_delete` for that half. Attaching the whole guard would put
-- two rules on one event with different words for the same refusal. Attaching
-- it to UPDATE contributes precisely the missing rule and leaves the existing
-- delete path untouched.
--
-- RECORDED, NOT FIXED: the two delete rules disagree at the edges.
-- `guard_resource_lifecycle` refuses deleting an `active` OR `promoted`
-- resource; `guard_link_type_delete` refuses only `active`, so a promoted link
-- type can still be deleted where a promoted object type cannot. That is a real
-- inconsistency and it is not this migration's subject — changing a deletion
-- rule is a bigger decision than closing an api_name hole, and doing both under
-- one header would hide the second.

create trigger guard_link_type_lifecycle
  before update on public.link_types
  for each row execute function public.guard_resource_lifecycle();

comment on trigger guard_link_type_lifecycle on public.link_types is
  'The API name of an active resource cannot be changed (object-link-types/metadata-statuses). UPDATE only: guard_link_type_delete already owns the delete half.';

-- PROVED BY DOING, in both directions: the rule must bite on an active link
-- type and must NOT bite on an experimental one, or it would freeze every API
-- name in the ontology.
--
-- The fixture is a real link type staged through the front door and removed
-- afterwards. It refuses to run if anything is already staged.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_a uuid; v_b uuid; v_id uuid;
  v_pending int; v_fired boolean; v_msg text;
BEGIN
  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: % change(s) already staged', v_pending;
  END IF;

  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need a user, an ontology and an unprotected project';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- Its OWN object types, at `experimental`. The existing ones are `example`,
  -- and the linter refuses a link whose status disagrees with the types it
  -- joins — so a proof that flipped the link's status would be arguing with
  -- OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus instead
  -- of testing this trigger. Fixtures it controls, removed at the end.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof817A', 'Zz Proof 817 A', 'experimental') RETURNING id INTO v_a;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof817B', 'Zz Proof 817 B', 'experimental') RETURNING id INTO v_b;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
   VALUES (v_a,'pk','id','Id','string','column','pk',true,true,true),
          (v_b,'pk','id','Id','string','column','pk',true,true,true);

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_column, status)
   VALUES (v_ont, v_proj, v_a, v_b, 'zz_proof_817', 'Proof 817',
           'many_to_one', 'foreign_key', 'pk', 'experimental')
   RETURNING id INTO v_id;

  -- 1. Experimental: the rename is allowed.
  UPDATE public.link_types SET api_name = 'zz_proof_817_renamed' WHERE id = v_id;
  IF (SELECT api_name FROM public.link_types WHERE id = v_id) <> 'zz_proof_817_renamed' THEN
    RAISE EXCEPTION 'PROOF FAILED: an experimental link type could not be renamed';
  END IF;
  RAISE NOTICE 'PROVED: an experimental link type can be renamed';

  -- 2. Active: the rename is refused, by name.
  UPDATE public.object_types SET status = 'active' WHERE id IN (v_a, v_b);
  UPDATE public.link_types SET status = 'active' WHERE id = v_id;
  v_fired := false;
  BEGIN
    UPDATE public.link_types SET api_name = 'zz_proof_817_again' WHERE id = v_id;
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: an active link type was renamed';
  END IF;
  IF v_msg NOT LIKE 'Ontology:ApiNameIsFixed%' THEN
    RAISE EXCEPTION 'PROOF FAILED: refused, but by something else: %', v_msg;
  END IF;
  RAISE NOTICE 'PROVED: an active link type cannot be renamed (%)', left(v_msg, 52);

  -- 3. And an unrelated column still updates while active, or the guard is
  --    refusing more than the page asks.
  UPDATE public.link_types SET label = 'Proof 817 relabelled' WHERE id = v_id;
  RAISE NOTICE 'PROVED: an active link type can still be edited otherwise';

  -- Back to experimental so the delete guards allow the cleanup.
  UPDATE public.link_types  SET status = 'experimental' WHERE id = v_id;
  UPDATE public.object_types SET status = 'experimental' WHERE id IN (v_a, v_b);
  DELETE FROM public.link_types   WHERE id = v_id;
  DELETE FROM public.object_types WHERE id IN (v_a, v_b);
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.link_types WHERE api_name LIKE 'zz_proof_817%')
     OR EXISTS (SELECT 1 FROM public.object_types WHERE api_name LIKE 'ZzProof817%') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % fixture change(s) left staged', v_pending;
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed, working state empty';
END $$;
