-- 680: whose review counts on a proposal task.
--
-- The review tab labels a section with the tasks eligible for the viewer's
-- approval (ontologies/images/ontology-proposal-review-tab.png), so the
-- surface has to be able to ask of one task whether THIS caller's approval
-- would count.
-- The page draws the distinction it rests on:
--
--   "In the **Review changes** tab, reviewers may approve or reject individual tasks. Users without permissions may still review the task, for example, to convey their opinions on the change, but this will not affect the approved status of the task."
--   — ontologies/branching-ontology.md
--
-- task_approval_status already counts exactly this way — a custom policy
-- counts approvals from policy_reviewer_ids and excludes contributors when
-- policy_contributor_approval is off; every other case counts approvals
-- from someone with edit permission on the resource's project. This adds no
-- second opinion: it composes the same three predicates the counter uses,
-- so the label can never disagree with the arithmetic behind it.
--
-- The reviewers list is NOT consulted, and that is the point of the arc:
--
--   "Users with approval rights can approve proposals even if not added as reviewers. Use the reviewers list to track who should review changes, not to restrict approvals."
--   — ontologies/branching-ontology.md
--
-- No invite function comes with it. proposal_reviewers already carries a
-- policy saying who may write it (420: anyone who can manage the branch),
-- and a rule the policy holds does not need a function above it.

CREATE FUNCTION public.can_approve_proposal_task(p_task uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  t record; res record; proj record; b uuid; contributors uuid[]; me uuid;
BEGIN
  me := auth.uid();
  IF me IS NULL THEN RETURN false; END IF;
  SELECT * INTO t FROM public.proposal_tasks WHERE id = p_task;
  IF t.id IS NULL THEN RETURN false; END IF;
  IF NOT public.can_see_proposal(t.proposal_id) THEN RETURN false; END IF;

  SELECT * INTO res FROM public.resource_project(t.resource_kind, t.resource_id);
  SELECT branch_id INTO b FROM public.ontology_proposals WHERE id = t.proposal_id;
  SELECT coalesce(c.authors, '{}') INTO contributors
    FROM public.branch_resource_changes c
   WHERE c.branch_id = b AND c.resource_kind = t.resource_kind
     AND c.resource_id = t.resource_id;

  IF res.protected AND res.project_id IS NOT NULL THEN
    SELECT * INTO proj FROM public.projects WHERE id = res.project_id;
    IF proj.policy_approvals_required IS NOT NULL THEN
      -- the custom policy's own two tests, as the counter applies them
      RETURN (cardinality(proj.policy_reviewer_ids) = 0
              OR me = ANY (proj.policy_reviewer_ids))
         AND (proj.policy_contributor_approval
              OR NOT (me = ANY (coalesce(contributors, '{}'))));
    END IF;
  END IF;

  RETURN public.user_can_edit_resource(me, res.project_id);
END $$;
COMMENT ON FUNCTION public.can_approve_proposal_task(uuid) IS
  'Whether the caller''s approval would COUNT toward this task (ontologies/branching-ontology: a user without permissions may still review, and it will not affect the approved status). Composes the same predicates task_approval_status counts with, so the review tab''s eligible-tasks label cannot disagree with the arithmetic. The reviewers list is deliberately not consulted — it tracks who should review, not who may.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; br uuid; prop uuid; task uuid; ot uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  before text; ok boolean;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('rev-680') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('rev-680') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev680a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev680b@beacon.test'),
      (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev680c@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'rev680a@beacon.test', 'admin', org),
      (u2, 'rev680b@beacon.test', 'admin', org),
      (u3, 'rev680c@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'rev_680', 'Reviewers 680') RETURNING id INTO proj;
    -- only a project owner may set a custom policy, so u1 holds Owner here
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.ontologies (space_id, api_name, label)
    VALUES (sp, 'rev_680', 'Reviewers 680') RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, api_name, label, project_id, protected)
    VALUES (ont, 'Rev680Type', 'Reviewers 680 type', proj, true) RETURNING id INTO ot;
    INSERT INTO public.ontology_branches (ontology_id, name, title) VALUES (ont, 'rev-680', 'Reviewers 680')
    RETURNING id INTO br;
    INSERT INTO public.ontology_proposals (branch_id, name, created_by_user_id)
    VALUES (br, 'Reviewers 680', u1) RETURNING id INTO prop;
    INSERT INTO public.proposal_tasks (proposal_id, resource_kind, resource_id)
    VALUES (prop, 'object_type', ot) RETURNING id INTO task;

    -- 1. Default policy on a protected resource: edit permission decides.
    IF NOT public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'an org admin should be able to approve';
    END IF;

    -- 2. A custom policy naming reviewers excludes everyone else.
    UPDATE public.projects
       SET policy_approvals_required = 1, policy_reviewer_ids = ARRAY[u2],
           policy_contributor_approval = true
     WHERE id = proj;
    IF public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'a user outside policy_reviewer_ids should not count';
    END IF;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    IF NOT public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'a named reviewer should count';
    END IF;

    -- 3. The contributor rule, when the policy switches it off.
    INSERT INTO public.branch_resource_changes (branch_id, resource_kind, resource_id, operation, authors)
    VALUES (br, 'object_type', ot, 'modified', ARRAY[u2]);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    UPDATE public.projects SET policy_contributor_approval = false WHERE id = proj;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    IF public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'a contributor should not count when the policy forbids it';
    END IF;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    UPDATE public.projects SET policy_contributor_approval = true WHERE id = proj;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    IF NOT public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'a contributor should count when the policy allows it';
    END IF;

    -- 4. The predicate agrees with the counter: an approval it admits moves
    --    the task to approved, which is the whole point of composing.
    INSERT INTO public.proposal_reviews (task_id, user_id, decision)
    VALUES (task, u2, 'approved');
    IF public.task_approval_status(task) <> 'approved' THEN
      RAISE EXCEPTION 'the counter disagreed with the predicate that admitted the reviewer';
    END IF;
    DELETE FROM public.proposal_reviews WHERE task_id = task;

    -- 5. Being on the reviewers list grants nothing — it tracks, not gates.
    INSERT INTO public.proposal_reviewers (proposal_id, user_id) VALUES (prop, u3);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u3::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    IF public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'the reviewers list must not confer eligibility';
    END IF;

    -- 6. An unknown task and a claimless caller both answer false.
    IF public.can_approve_proposal_task(gen_random_uuid()) THEN
      RAISE EXCEPTION 'an unknown task was approvable';
    END IF;
    PERFORM set_config('request.jwt.claims', '', true);
    IF public.can_approve_proposal_task(task) THEN
      RAISE EXCEPTION 'a caller with no identity was eligible';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '680 proved: edit permission decides under the default policy, a custom policy admits only its named reviewers, the contributor rule flips with the policy, an admitted approval actually moves the counter, membership of the reviewers list confers nothing, and unknown tasks and claimless callers answer false';
  END;
END $$;
