-- A branch saves, and a merge applies.
--
-- Slice 1 of readings/branch-overlay.md, built after the Decisions block was
-- read and both questions were answered from the screenshots:
--
--   "This does not apply to ontology resources: you can create, modify, or
--    delete entities on the branch without affecting the `main` branch."
--                                            (global-branching/core-concepts)
--   "Rebase in progress. … Resolve all conflicts and errors before saving and
--    finishing the rebase."       (ontologies/images/review-rebase-changes.png)
--   "Ontology does not have errors · Object type does not have validation
--    errors · Object type has conflicts with the main branch · Changes are
--    approved"                (global-branching/images/proposal-page-checks.png)
--
-- The two stores already exist and 426 named their relation: working_state_
-- changes "overlays a user on a branch", branch_resource_changes "overlays a
-- branch on main". A branch save PROMOTES the user's entries one layer down —
-- 419/420's proposal machinery (tasks, conflicts, blockers) reads that layer
-- unchanged. The merge applies it to main through the same arms a main save
-- uses, atomically (ours; upstream documents partial failure, one database
-- need not). Q1's answer: a branch save runs the same violations gate as a
-- main save, by COMPOSING the overlay inside a subtransaction that is rolled
-- back — plpgsql variable assignments survive the rollback, which is how the
-- verdict escapes.
--
-- Also here, because the flow demands them: apply_object_type learns the
-- status fields (a promotion staged on a branch must reach the table at
-- merge), and guard_promotion learns two contexts — a compose dry-run (which
-- persists nothing and so gates nothing) and a merge carrying an ontology
-- owner's approval ("approval by an Ontology Owner on the ontology level",
-- metadata-statuses).
--
-- Recorded, not built: merge-by-viewer (our resource RLS still requires write
-- rights, so the merging user needs them — "merging only applies pre-authored
-- and approved changes" is the target shape); stagers passing p_branch from
-- the surface; the rebase surface itself.

-- ── one dispatch, three callers ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_one_change(
  p_kind text, p_id uuid, p_op text, p_fields jsonb, p_ont uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_live jsonb; tbl text; cols text; vals text;
BEGIN
  IF p_kind = 'object_type' AND p_op <> 'deleted' THEN
    v_live := coalesce(public.ontology_resource_row('object_type', p_id), '{}'::jsonb);
    PERFORM public.apply_object_type(
      (p_fields - 'properties' - 'datasources')
        || jsonb_build_object('id', p_id::text, 'ontology_id', p_ont::text),
      coalesce(p_fields->'properties',  v_live->'properties',  '[]'::jsonb),
      coalesce(p_fields->'datasources', v_live->'datasources', '[]'::jsonb));
    RETURN;
  END IF;

  IF p_kind = 'action_type' AND p_op <> 'deleted' THEN
    v_live := coalesce(public.ontology_resource_row('action_type', p_id), '{}'::jsonb);
    PERFORM public.apply_action_type(
      (p_fields - 'parameters' - 'rules' - 'criteria')
        || jsonb_build_object('id', p_id::text, 'ontology_id', p_ont::text),
      coalesce(p_fields->'parameters', v_live->'parameters', '[]'::jsonb),
      coalesce(p_fields->'rules',      v_live->'rules',      '[]'::jsonb),
      coalesce(p_fields->'criteria',   v_live->'criteria',   '[]'::jsonb));
    RETURN;
  END IF;

  IF p_kind = 'interface' AND p_op <> 'deleted' THEN
    v_live := coalesce(public.ontology_resource_row('interface', p_id), '{}'::jsonb);
    PERFORM public.apply_interface(
      (p_fields - 'properties' - 'link_constraints' - 'action_constraints' - 'extends')
        || jsonb_build_object('id', p_id::text, 'ontology_id', p_ont::text),
      coalesce(p_fields->'properties',         v_live->'properties',         '[]'::jsonb),
      coalesce(p_fields->'link_constraints',   v_live->'link_constraints',   '[]'::jsonb),
      coalesce(p_fields->'action_constraints', v_live->'action_constraints', '[]'::jsonb),
      coalesce(p_fields->'extends',            v_live->'extends',            '[]'::jsonb));
    RETURN;
  END IF;

  tbl := CASE p_kind
           WHEN 'object_type'     THEN 'object_types'
           WHEN 'link_type'       THEN 'link_types'
           WHEN 'shared_property' THEN 'shared_properties'
           WHEN 'interface'       THEN 'ontology_interfaces'
           WHEN 'action_type'     THEN 'action_types'
           WHEN 'type_group'      THEN 'type_groups'
         END;

  IF p_op = 'deleted' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', tbl) USING p_id;
  ELSIF p_op = 'created' THEN
    SELECT string_agg(quote_ident(e.key), ', ' ORDER BY e.key),
           string_agg(format('($2->>%L)::%s', e.key,
                      public.ontology_column_type(tbl, e.key)), ', ' ORDER BY e.key)
      INTO cols, vals
      FROM jsonb_each(p_fields) e;
    EXECUTE format('INSERT INTO public.%I (id, %s) SELECT $1, %s', tbl, cols, vals)
      USING p_id, p_fields;
  ELSE
    SELECT string_agg(format('%I = ($2->>%L)::%s', e.key, e.key,
                      public.ontology_column_type(tbl, e.key)), ', ' ORDER BY e.key)
      INTO vals FROM jsonb_each(p_fields) e;
    EXECUTE format('UPDATE public.%I SET %s WHERE id = $1', tbl, vals)
      USING p_id, p_fields;
  END IF;
END $$;

COMMENT ON FUNCTION public.apply_one_change(text, uuid, text, jsonb, uuid) IS
  'The arm dispatch save_working_state has always run, extracted once: a main save applies the caller''s entries, a branch compose applies the overlay plus the composer''s entries, a merge applies the overlay. Callers own validation, version bumps and cleanup.';

REVOKE ALL ON FUNCTION public.apply_one_change(text, uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_one_change(text, uuid, text, jsonb, uuid) TO authenticated;

-- ── the save, now with a branch arm ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_working_state(p_branch uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        record;
  v_stale  integer;
  v_before text[];
  v_bad    text;
  v_saved  integer := 0;
  v_ont    uuid;
  v_status text;
BEGIN
  SELECT count(*) INTO v_stale FROM public.working_state_conflicts(p_branch);
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'OntologyMetadata:StaleWorkingState — % field(s) were changed by someone else since you began', v_stale
      USING HINT = 'Update to pull their changes in, then choose per field. working_state_conflicts() lists them.';
  END IF;

  SELECT array_agg(format('%s|%s|%s|%s', object_type, scope, subject, problem))
    INTO v_before FROM public.ontology_violations();

  IF p_branch IS NULL THEN
    FOR c IN SELECT * FROM public.working_state_changes
              WHERE user_id = auth.uid() AND branch_id IS NULL
              ORDER BY created_at
    LOOP
      v_ont := c.ontology_id;
      PERFORM public.apply_one_change(c.resource_kind, c.resource_id, c.operation, c.fields, c.ontology_id);
      v_saved := v_saved + 1;
    END LOOP;
    IF v_saved = 0 THEN RETURN 0; END IF;

    SELECT string_agg(v.shown, '; ') INTO v_bad
      FROM (SELECT format('%s.%s: %s', object_type, subject, problem) AS shown,
                   format('%s|%s|%s|%s', object_type, scope, subject, problem) AS key
              FROM public.ontology_violations()) v
     WHERE NOT (v.key = ANY (coalesce(v_before, ARRAY[]::text[])));
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'OntologyMetadata:SaveBlockedByErrors — %', v_bad
        USING HINT = 'Errors need to be handled in order to save. Nothing was written.';
    END IF;

    UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
    DELETE FROM public.working_state_changes
     WHERE user_id = auth.uid() AND branch_id IS NULL;
    RETURN v_saved;
  END IF;

  -- The branch arm. "Activate the branch before making changes" — only an
  -- active branch takes a save.
  SELECT status, ontology_id INTO v_status, v_ont
    FROM public.ontology_branches WHERE id = p_branch;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Branching:BranchNotFound %', p_branch USING ERRCODE = 'no_data_found';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Branching:BranchNotActive — this branch is %', v_status
      USING HINT = 'Activate the branch before making changes.';
  END IF;

  -- Q1: the same violations gate as a main save, asked of the COMPOSED
  -- overlay — the branch's saved layer plus this user's unsaved work — inside
  -- a subtransaction that persists nothing.
  PERFORM set_config('beacon.composing_branch', p_branch::text, true);
  BEGIN
    FOR c IN SELECT resource_kind, resource_id, operation, fields, created_at
               FROM public.branch_resource_changes WHERE branch_id = p_branch
             UNION ALL
             SELECT resource_kind, resource_id, operation, fields, created_at
               FROM public.working_state_changes
              WHERE branch_id = p_branch AND user_id = auth.uid()
             ORDER BY created_at
    LOOP
      PERFORM public.apply_one_change(c.resource_kind, c.resource_id, c.operation, c.fields, v_ont);
    END LOOP;
    SELECT string_agg(v.shown, '; ') INTO v_bad
      FROM (SELECT format('%s.%s: %s', object_type, subject, problem) AS shown,
                   format('%s|%s|%s|%s', object_type, scope, subject, problem) AS key
              FROM public.ontology_violations()) v
     WHERE NOT (v.key = ANY (coalesce(v_before, ARRAY[]::text[])));
    RAISE EXCEPTION 'rollback compose';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback compose' THEN
      PERFORM set_config('beacon.composing_branch', '', true);
      RAISE;
    END IF;
  END;
  PERFORM set_config('beacon.composing_branch', '', true);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:SaveBlockedByErrors — %', v_bad
      USING HINT = 'Resolve all conflicts and errors before saving. Nothing was written.';
  END IF;

  -- Promote my entries one layer down. First touch keeps its base — the
  -- three-way merge's third leg is the OLDEST reading of main, not the newest.
  FOR c IN SELECT * FROM public.working_state_changes
            WHERE branch_id = p_branch AND user_id = auth.uid()
            ORDER BY created_at
  LOOP
    UPDATE public.branch_resource_changes b
       SET fields    = b.fields || c.fields,
           base      = c.base || b.base,
           operation = CASE WHEN c.operation = 'deleted' THEN 'deleted'
                            WHEN b.operation = 'created' THEN 'created'
                            ELSE b.operation END
     WHERE b.branch_id = p_branch
       AND b.resource_kind = c.resource_kind AND b.resource_id = c.resource_id;
    IF NOT FOUND THEN
      INSERT INTO public.branch_resource_changes
        (branch_id, resource_kind, resource_id, operation, fields, base)
      VALUES (p_branch, c.resource_kind, c.resource_id, c.operation, c.fields, c.base);
    END IF;
    v_saved := v_saved + 1;
  END LOOP;

  DELETE FROM public.working_state_changes
   WHERE branch_id = p_branch AND user_id = auth.uid();
  RETURN v_saved;
END $$;

COMMENT ON FUNCTION public.save_working_state(uuid) IS
  'Save the working state. On main: apply, validate the delta, bump the version, clear the entries. On a branch: validate the same way against the COMPOSED overlay (rolled back), then promote the entries into branch_resource_changes — main''s tables are never touched, the total-overlay rule for ontology resources.';

-- ── the blockers say the checks' names ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proposal_blockers(p_proposal uuid)
RETURNS TABLE (scope text, subject text, reason text)
LANGUAGE sql STABLE AS $$
  -- The hold an owner can apply, which outranks everything else.
  SELECT 'proposal', p.name, 'The Do not merge setting is applied'
    FROM public.ontology_proposals p
   WHERE p.id = p_proposal AND p.do_not_merge

  UNION ALL

  SELECT 'proposal', p.name, format('The proposal is %s, not open', p.status)
    FROM public.ontology_proposals p
   WHERE p.id = p_proposal AND p.status <> 'open'

  UNION ALL

  -- "Changes are approved", per task.
  SELECT 'task', t.resource_kind || ':' || t.resource_id::text,
         CASE public.task_approval_status(t.id)
           WHEN 'rejected' THEN 'The check "Changes are approved" fails — rejected; the rejecting user must re-review and approve'
           ELSE 'The check "Changes are approved" fails — awaiting approval'
         END
    FROM public.proposal_tasks t
   WHERE t.proposal_id = p_proposal
     AND public.task_approval_status(t.id) IN ('rejected','awaiting_approval')

  UNION ALL

  -- "Object type has conflicts with the main branch" — the checks popover's
  -- own words, with the field named and the popover's remedy.
  SELECT 'check', c.resource_kind || ':' || c.resource_id::text,
         format('%s has conflicts with the main branch on "%s" — rebase the branch',
                initcap(replace(c.resource_kind, '_', ' ')), c.field)
    FROM public.ontology_proposals p
   CROSS JOIN LATERAL public.branch_conflicts(p.branch_id) c
   WHERE p.id = p_proposal
$$;

-- ── the merge applies ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_proposal(p_proposal uuid)
RETURNS void LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE c record; b uuid; v_ont uuid; blockers text; v_before text[]; v_bad text;
BEGIN
  SELECT branch_id INTO b FROM public.ontology_proposals WHERE id = p_proposal;
  IF b IS NULL THEN
    RAISE EXCEPTION 'Branching:ProposalNotFound %', p_proposal USING ERRCODE = 'no_data_found';
  END IF;
  SELECT ontology_id INTO v_ont FROM public.ontology_branches WHERE id = b;

  SELECT string_agg(reason, '; ') INTO blockers FROM public.proposal_blockers(p_proposal);
  IF blockers IS NOT NULL THEN
    RAISE EXCEPTION 'Branching:ProposalNotMergeable — %', blockers;
  END IF;

  SELECT array_agg(format('%s|%s|%s|%s', object_type, scope, subject, problem))
    INTO v_before FROM public.ontology_violations();

  -- The approval context the promotion guard reads.
  PERFORM set_config('beacon.merging_proposal', p_proposal::text, true);
  FOR c IN SELECT * FROM public.branch_resource_changes
            WHERE branch_id = b ORDER BY created_at
  LOOP
    PERFORM public.apply_one_change(c.resource_kind, c.resource_id, c.operation, c.fields, v_ont);
  END LOOP;
  PERFORM set_config('beacon.merging_proposal', '', true);

  -- "Ontology does not have errors" / "Object type does not have validation
  -- errors" — the same delta rule as a save, and the whole merge rolls back
  -- with it: ours is atomic, there is no partially-merged state to revert.
  SELECT string_agg(v.shown, '; ') INTO v_bad
    FROM (SELECT format('%s.%s: %s', object_type, subject, problem) AS shown,
                 format('%s|%s|%s|%s', object_type, scope, subject, problem) AS key
            FROM public.ontology_violations()) v
   WHERE NOT (v.key = ANY (coalesce(v_before, ARRAY[]::text[])));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Branching:ProposalNotMergeable — the check "Ontology does not have errors" fails: %', v_bad;
  END IF;

  UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;
  DELETE FROM public.branch_resource_changes WHERE branch_id = b;
  DELETE FROM public.working_state_changes WHERE branch_id = b;

  UPDATE public.ontology_proposals
     SET status = 'merged', merged_at = now() WHERE id = p_proposal;
  -- "Merged branches are terminal."
  UPDATE public.ontology_branches SET status = 'merged' WHERE id = b;
END $$;

COMMENT ON FUNCTION public.merge_proposal(uuid) IS
  'Merges a proposal: blockers, then the branch''s overlay through the same arms a main save uses, then the violations delta — atomically, in one transaction. Deliberately does NOT check who is merging beyond visibility: "merging only applies pre-authored and approved changes."';

-- ── promotion learns its two proposal contexts ──────────────────────────────
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

-- ── a staged status change reaches the table ────────────────────────────────
-- apply_object_type's update arm carried label/icon/description only; a
-- promotion (or any status change) staged in the session was silently
-- dropped. The trio rides with it so the documented-deprecation CHECK holds.
DO $$
DECLARE def text; needle text := 'description = coalesce(p_object_type->>''description'', description)';
BEGIN
  def := pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure);
  IF (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 THEN
    RAISE EXCEPTION 'apply_object_type has drifted — wire the status fields by hand';
  END IF;
  def := replace(def, needle, needle
    || ',
           status = coalesce(p_object_type->>''status'', status),
           deprecation_reason = CASE WHEN p_object_type ? ''status''
             THEN nullif(p_object_type->>''deprecation_reason'', '''') ELSE deprecation_reason END,
           deprecation_deadline = CASE WHEN p_object_type ? ''status''
             THEN nullif(p_object_type->>''deprecation_deadline'', '''')::date ELSE deprecation_deadline END');
  EXECUTE def;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid;
  b1 uuid; b2 uuid; t1 uuid := gen_random_uuid(); t2 uuid; pr uuid; pr2 uuid; tk uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text; n integer;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('slice-461') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','s461a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','s461b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 's461a@beacon.test', 'admin', org),
    (u2, 's461b@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Slice461');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'slice461', 'Slice 461', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'slice461', 'Slice 461') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 's461ds', 's461ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'slice-one', 'Slice one') RETURNING id INTO b1;

  -- An invalid overlay refuses the branch save, and nothing lands anywhere.
  PERFORM public.stage_change('object_type', t1,
    jsonb_build_object('api_name', 'Slice461A', 'label', 'A', 'ontology_id', ont),
    b1, 'created');
  BEGIN
    PERFORM public.save_working_state(b1);
    RAISE EXCEPTION 'assertion failed: an invalid overlay should refuse the save';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%SaveBlockedByErrors%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.object_types WHERE id = t1) THEN
    RAISE EXCEPTION 'assertion failed: the compose leaked into main';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branch_resource_changes WHERE branch_id = b1) THEN
    RAISE EXCEPTION 'assertion failed: a refused save must not promote entries';
  END IF;

  -- A valid overlay saves — onto the branch, never onto main.
  PERFORM public.stage_change('object_type', t1,
    jsonb_build_object('api_name', 'Slice461A', 'label', 'A', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br)),
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id','a_id','display_name','A Id','api_name','aId',
        'base_type','string','source','column','backing_column','a_id',
        'is_primary_key',true,'is_title_key',true,'required',true))),
    b1, 'created');
  n := public.save_working_state(b1);
  IF n < 1 THEN RAISE EXCEPTION 'assertion failed: the branch save saved nothing'; END IF;
  IF EXISTS (SELECT 1 FROM public.object_types WHERE id = t1) THEN
    RAISE EXCEPTION 'assertion failed: a branch save must not touch main';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branch_resource_changes
                  WHERE branch_id = b1 AND resource_id = t1) THEN
    RAISE EXCEPTION 'assertion failed: the entries were not promoted to the overlay';
  END IF;
  IF EXISTS (SELECT 1 FROM public.working_state_changes
              WHERE branch_id = b1 AND user_id = u1) THEN
    RAISE EXCEPTION 'assertion failed: promoted entries must leave the working state';
  END IF;

  -- The merge applies the overlay through the same arms. (auto_approved is a
  -- stored flag 420 never wires — approval flows through reviews, so the
  -- second user reviews here. The wiring of automatic satisfaction is the
  -- approval-policies slice.)
  pr := public.create_proposal(b1, 'Slice one', '');
  SELECT id INTO tk FROM public.proposal_tasks
   WHERE proposal_id = pr AND resource_kind = 'object_type' AND resource_id = t1;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  INSERT INTO public.proposal_reviews (task_id, user_id, decision)
  VALUES (tk, u2, 'approved');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  PERFORM public.merge_proposal(pr);
  IF NOT EXISTS (SELECT 1 FROM public.object_types WHERE id = t1 AND api_name = 'Slice461A') THEN
    RAISE EXCEPTION 'assertion failed: the merge did not apply the overlay';
  END IF;
  IF EXISTS (SELECT 1 FROM public.branch_resource_changes WHERE branch_id = b1) THEN
    RAISE EXCEPTION 'assertion failed: merged overlays must be cleared';
  END IF;
  IF (SELECT status FROM public.ontology_branches WHERE id = b1) <> 'merged' THEN
    RAISE EXCEPTION 'assertion failed: merged branches are terminal';
  END IF;

  -- Promotion rides the merge when an ontology owner approved the task.
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Slice461B', 'B', 'active') RETURNING id INTO t2;
  INSERT INTO public.ontology_role_grants (ontology_id, user_id, role) VALUES (ont, u2, 'owner');

  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'slice-two', 'Slice two') RETURNING id INTO b2;
  PERFORM public.stage_change('object_type', t2,
    jsonb_build_object('status', 'promoted'), b2, 'modified');
  PERFORM public.save_working_state(b2);
  IF (SELECT status FROM public.object_types WHERE id = t2) <> 'active' THEN
    RAISE EXCEPTION 'assertion failed: the staged promotion must not land before merge';
  END IF;

  pr2 := public.create_proposal(b2, 'Slice two', '');
  SELECT id INTO tk FROM public.proposal_tasks
   WHERE proposal_id = pr2 AND resource_kind = 'object_type' AND resource_id = t2;

  -- The owner reviews and approves, as themselves.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  INSERT INTO public.proposal_reviews (task_id, user_id, decision)
  VALUES (tk, u2, 'approved');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  PERFORM public.merge_proposal(pr2);
  IF (SELECT status FROM public.object_types WHERE id = t2) <> 'promoted'
     OR (SELECT visibility FROM public.object_types WHERE id = t2) <> 'prominent' THEN
    RAISE EXCEPTION 'assertion failed: the approved promotion did not ride the merge';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
