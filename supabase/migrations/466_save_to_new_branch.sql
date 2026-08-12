-- Save to new branch, as one call.
--
--   "If you already have changes to the ontology that you would like to
--    include in a branch, you can select **Save to new branch** from the save
--    dialog to create a separate branch with those changes."
--                                            (ontologies/branching-ontology)
--
-- The dialog's own helper text fixes the ontology: "Foundry branches for an
-- ontology can only be created in the same ontology"
-- (ontologies/images/modify-protected-object.png). So the flow is: create the
-- branch in the working state's ontology, move the caller's unsaved entries
-- onto it, and run the branch save — which validates the composed overlay and
-- promotes the entries one layer down (461). One call, because a client that
-- created the branch first and moved entries second could fail in between and
-- strand an empty branch.

CREATE OR REPLACE FUNCTION public.save_to_new_branch(p_name text, p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_ont uuid; b uuid; n integer;
BEGIN
  SELECT ontology_id INTO v_ont FROM public.working_state_changes
   WHERE user_id = auth.uid() AND branch_id IS NULL LIMIT 1;
  IF v_ont IS NULL THEN
    RAISE EXCEPTION 'Branching:NothingToSave — there are no unsaved changes to put on a branch';
  END IF;

  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (v_ont, p_name, coalesce(p_title, p_name)) RETURNING id INTO b;

  UPDATE public.working_state_changes
     SET branch_id = b
   WHERE user_id = auth.uid() AND branch_id IS NULL AND ontology_id = v_ont;

  n := public.save_working_state(b);
  IF n = 0 THEN
    RAISE EXCEPTION 'Branching:NothingToSave — the working state moved under this call';
  END IF;
  RETURN b;
END $$;

COMMENT ON FUNCTION public.save_to_new_branch(text, text) IS
  '"Save to new branch from the save dialog": create the branch in the working state''s ontology, move the caller''s unsaved entries onto it, and run the branch save. Atomic — a failed save rolls the branch back too.';

REVOKE ALL ON FUNCTION public.save_to_new_branch(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_to_new_branch(text, text) TO authenticated;

-- ── assertion, as authenticated ─────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid := gen_random_uuid(); b uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('stb-466') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','stb466@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'stb466@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Stb466');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'stb466', 'Stb 466', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Stb466A', 'A', 'active') RETURNING id INTO t;

  -- Unsaved main-session work moves whole onto the new branch.
  PERFORM public.stage_change('object_type', t,
    jsonb_build_object('label', 'A on branch'), NULL, 'modified');
  b := public.save_to_new_branch('stb-466-branch', 'Stb 466');
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'A' THEN
    RAISE EXCEPTION 'assertion failed: save to new branch must not touch main';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branch_resource_changes
                  WHERE branch_id = b AND resource_id = t) THEN
    RAISE EXCEPTION 'assertion failed: the change did not land on the branch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.working_state_changes WHERE user_id = usr) THEN
    RAISE EXCEPTION 'assertion failed: the working state should be empty after the move';
  END IF;

  -- With nothing unsaved, the call refuses rather than stranding a branch.
  BEGIN
    PERFORM public.save_to_new_branch('stb-466-empty');
    RAISE EXCEPTION 'assertion failed: an empty working state should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%NothingToSave%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
