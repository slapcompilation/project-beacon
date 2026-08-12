-- A rebase resolves the conflicts and refreshes the baseline.
--
--   "Global Branching auto-resolves any non-conflicting changes during a
--    rebase. For true conflicts — where the same property of the same
--    resource was edited on both `main` and your branch — there is no
--    automatic resolution; you must pick one version manually before the
--    rebase can proceed."               (global-branching/core-concepts)
--   "To resolve conflicts, you can choose to Use Main branch changes or Keep
--    current branch changes for each resource."
--                                       (ontologies/branching-ontology)
--   "Datasource deletion: When a conflict occurs on an object type where a
--    backing datasource has been replaced or removed on the main branch,
--    choosing to keep your branch changes will lead to a merge failure. In
--    this case, choose the main branch changes." — the deleted-on-main rule,
--    generalised: a resource main deleted cannot keep branch changes.
--
-- In a field-level overlay the auto-resolve half is free: a branch row only
-- carries the fields it touched, so main's movement on OTHER fields never
-- collides. What a rebase must actually do is judge the true conflicts
-- (branch_conflicts already lists them), apply the per-resource choice, and
-- refresh the kept rows' baseline so the conflict clears instead of
-- reappearing on the next ask.

CREATE OR REPLACE FUNCTION public.rebase_branch(
  p_branch      uuid,
  p_resolutions jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text; c record; choice text; missing text; n integer := 0; main_row jsonb;
BEGIN
  SELECT status INTO v_status FROM public.ontology_branches WHERE id = p_branch;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Branching:BranchNotFound %', p_branch USING ERRCODE = 'no_data_found';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Branching:BranchNotActive — this branch is %', v_status;
  END IF;

  -- Every conflicted resource needs a decision before the rebase can proceed.
  SELECT string_agg(DISTINCT k.resource_kind || ':' || k.resource_id::text, ', ')
    INTO missing
    FROM public.branch_conflicts(p_branch) k
   WHERE NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(coalesce(p_resolutions, '[]'::jsonb)) r
      WHERE r->>'resource_kind' = k.resource_kind
        AND (r->>'resource_id')::uuid = k.resource_id
        AND r->>'choice' IN ('main','branch'));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Branching:RebaseNeedsResolution — you must pick one version manually before the rebase can proceed: %', missing;
  END IF;

  FOR c IN SELECT DISTINCT k.resource_kind, k.resource_id
             FROM public.branch_conflicts(p_branch) k
  LOOP
    SELECT r->>'choice' INTO choice
      FROM jsonb_array_elements(p_resolutions) r
     WHERE r->>'resource_kind' = c.resource_kind
       AND (r->>'resource_id')::uuid = c.resource_id;

    IF choice = 'main' THEN
      -- Their version already lives on main; the branch stops disagreeing.
      DELETE FROM public.branch_resource_changes
       WHERE branch_id = p_branch AND resource_kind = c.resource_kind
         AND resource_id = c.resource_id;
    ELSE
      -- Keep current branch changes: the baseline moves to main's present so
      -- the same conflict does not come back on the next ask.
      EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1',
                     CASE c.resource_kind
                       WHEN 'object_type'     THEN 'object_types'
                       WHEN 'link_type'       THEN 'link_types'
                       WHEN 'shared_property' THEN 'shared_properties'
                       WHEN 'interface'       THEN 'ontology_interfaces'
                       WHEN 'action_type'     THEN 'action_types'
                       WHEN 'type_group'      THEN 'type_groups'
                     END)
        INTO main_row USING c.resource_id;
      UPDATE public.branch_resource_changes b
         SET base = (SELECT coalesce(jsonb_object_agg(k, main_row -> k), '{}'::jsonb)
                       FROM jsonb_object_keys(b.base) k)
       WHERE b.branch_id = p_branch AND b.resource_kind = c.resource_kind
         AND b.resource_id = c.resource_id;
    END IF;
    n := n + 1;
  END LOOP;

  -- A resource deleted on main cannot keep branch changes — the generalised
  -- datasource-deletion rule. With no main row there is nothing to rebase
  -- onto; the row must go.
  FOR c IN SELECT b.resource_kind, b.resource_id
             FROM public.branch_resource_changes b
            WHERE b.branch_id = p_branch AND b.operation = 'modified'
  LOOP
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1',
                   CASE c.resource_kind
                     WHEN 'object_type'     THEN 'object_types'
                     WHEN 'link_type'       THEN 'link_types'
                     WHEN 'shared_property' THEN 'shared_properties'
                     WHEN 'interface'       THEN 'ontology_interfaces'
                     WHEN 'action_type'     THEN 'action_types'
                     WHEN 'type_group'      THEN 'type_groups'
                   END)
      INTO main_row USING c.resource_id;
    IF main_row IS NULL THEN
      DELETE FROM public.branch_resource_changes
       WHERE branch_id = p_branch AND resource_kind = c.resource_kind
         AND resource_id = c.resource_id;
      n := n + 1;
    END IF;
  END LOOP;

  UPDATE public.ontology_branches
     SET last_rebased_at = now(), last_activity_at = now()
   WHERE id = p_branch;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.rebase_branch(uuid, jsonb) IS
  'Finish rebase and save: apply the per-resource choices (Use Main deletes the branch row; Keep current refreshes its baseline to main''s present), drop rows whose main resource is gone, stamp last_rebased_at. Auto-resolve is free in a field-level overlay — untouched fields never collide.';

REVOKE ALL ON FUNCTION public.rebase_branch(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebase_branch(uuid, jsonb) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t1 uuid; t2 uuid; b uuid; n integer;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('reb-470') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','reb470@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'reb470@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Reb470');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'reb470', 'Reb 470', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Reb470A', 'A') RETURNING id INTO t1;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Reb470B', 'B') RETURNING id INTO t2;
  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'rebase-470', 'Rebase 470') RETURNING id INTO b;

  -- The branch renames both types; then main renames t1 too — a true conflict.
  PERFORM public.stage_change('object_type', t1, jsonb_build_object('label', 'A ours'), b, 'modified');
  PERFORM public.stage_change('object_type', t2, jsonb_build_object('label', 'B ours'), b, 'modified');
  PERFORM public.save_working_state(b);
  UPDATE public.object_types SET label = 'A theirs' WHERE id = t1;

  -- Unresolved, the rebase refuses with the page's demand.
  BEGIN
    PERFORM public.rebase_branch(b);
    RAISE EXCEPTION 'assertion failed: an unresolved conflict should refuse the rebase';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%RebaseNeedsResolution%' THEN RAISE; END IF;
  END;

  -- Keep current branch changes: the conflict clears and the row survives.
  n := public.rebase_branch(b, jsonb_build_array(jsonb_build_object(
    'resource_kind', 'object_type', 'resource_id', t1, 'choice', 'branch')));
  IF n < 1 THEN RAISE EXCEPTION 'assertion failed: the rebase resolved nothing'; END IF;
  IF EXISTS (SELECT 1 FROM public.branch_conflicts(b)) THEN
    RAISE EXCEPTION 'assertion failed: the kept row must stop conflicting after its baseline moves';
  END IF;
  IF (SELECT count(*) FROM public.branch_resource_changes WHERE branch_id = b) <> 2 THEN
    RAISE EXCEPTION 'assertion failed: keeping current changes must not drop rows';
  END IF;

  -- Use Main branch changes: the branch stops disagreeing, row gone.
  UPDATE public.object_types SET label = 'A theirs again' WHERE id = t1;
  PERFORM public.rebase_branch(b, jsonb_build_array(jsonb_build_object(
    'resource_kind', 'object_type', 'resource_id', t1, 'choice', 'main')));
  IF EXISTS (SELECT 1 FROM public.branch_resource_changes
              WHERE branch_id = b AND resource_id = t1) THEN
    RAISE EXCEPTION 'assertion failed: Use Main must drop the branch row';
  END IF;

  -- Deleted on main: the untouched-conflict row for t2 goes when t2 goes.
  DELETE FROM public.object_types WHERE id = t2;
  PERFORM public.rebase_branch(b);
  IF EXISTS (SELECT 1 FROM public.branch_resource_changes WHERE branch_id = b) THEN
    RAISE EXCEPTION 'assertion failed: a resource deleted on main cannot keep branch changes';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
