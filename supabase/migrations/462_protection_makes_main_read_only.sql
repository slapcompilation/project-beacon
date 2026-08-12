-- Protection makes main read-only, and the project's policy says who approves.
--
-- Slice 2 of readings/branch-overlay.md:
--
--   "Protected resources cannot be changed directly; instead, changes must be
--    made on a branch and then approved before merging into the main branch."
--   "Any user with owner permissions on a resource can choose to protect or
--    unprotect that resource."
--   "Approval policies have three customizable parameters: Eligible reviewers…
--    Number of approvals required… Contributor approval… A contributor is any
--    user who has made a change to that resource on the branch."
--   "Only users that are owners on the project can update its custom policy."
--                    (global-branching/resource-protection-and-approval-policies)
--   "Automatically protect all new files: When toggled on, this setting will
--    automatically protect all new files created in the project."
--   "Approval required from at least one user with edit permissions to the
--    file."        (the default policy, verbatim from the screenshot)
--   "Additionally, ontology resources must be migrated to use project
--    permissions before they can be protected."  (ontologies/branching-ontology)
--   "Default policies are satisfied in one of two ways: Automatically, when
--    the contributor's own permissions cover the policy. Through review…"
--                                 — which is what 420's stored-but-never-set
--                                   auto_approved flag was waiting for.
--
-- The five protectable kinds are the page's list — object, action, link,
-- interface and shared property types; type groups are named as unsupported.
-- Reviewer GROUPS are out of scope (we have no user groups); reviewer lists
-- hold users, recorded.

-- ── the flag, and its precondition ──────────────────────────────────────────
ALTER TABLE public.object_types
  ADD COLUMN protected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT object_types_protected_needs_project
    CHECK (NOT protected OR project_id IS NOT NULL);
ALTER TABLE public.link_types
  ADD COLUMN protected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT link_types_protected_needs_project
    CHECK (NOT protected OR project_id IS NOT NULL);
ALTER TABLE public.shared_properties
  ADD COLUMN protected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT shared_properties_protected_needs_project
    CHECK (NOT protected OR project_id IS NOT NULL);
ALTER TABLE public.ontology_interfaces
  ADD COLUMN protected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ontology_interfaces_protected_needs_project
    CHECK (NOT protected OR project_id IS NOT NULL);
ALTER TABLE public.action_types
  ADD COLUMN protected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT action_types_protected_needs_project
    CHECK (NOT protected OR project_id IS NOT NULL);

-- ── the project's branch-protection tab ─────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN auto_protect_new boolean NOT NULL DEFAULT false,
  ADD COLUMN policy_approvals_required integer CHECK (policy_approvals_required > 0),
  ADD COLUMN policy_reviewer_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN policy_contributor_approval boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.projects.policy_approvals_required IS
  'NULL means the DEFAULT policy: "Approval required from at least one user with edit permissions to the file." Set, it is the custom policy''s approval count.';
COMMENT ON COLUMN public.projects.policy_contributor_approval IS
  'false renders as "Reviewers cannot approve changes to files they have contributed to in the proposed branch." A contributor is any user who has made a change to that resource on the branch.';

CREATE OR REPLACE FUNCTION public.guard_project_policy()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.auto_protect_new IS DISTINCT FROM OLD.auto_protect_new
      OR NEW.policy_approvals_required IS DISTINCT FROM OLD.policy_approvals_required
      OR NEW.policy_reviewer_ids IS DISTINCT FROM OLD.policy_reviewer_ids
      OR NEW.policy_contributor_approval IS DISTINCT FROM OLD.policy_contributor_approval)
     AND coalesce(public.project_role(NEW.id), '') <> 'owner' THEN
    RAISE EXCEPTION 'Branching:PolicyIsProjectOwnerOnly — only users that are owners on the project can update its custom policy';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_project_policy
  BEFORE UPDATE OF auto_protect_new, policy_approvals_required,
                   policy_reviewer_ids, policy_contributor_approval
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_policy();

-- ── where does a resource live, and is it protected ─────────────────────────
CREATE OR REPLACE FUNCTION public.resource_project(p_kind text, p_id uuid,
  OUT project_id uuid, OUT protected boolean)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE tbl text;
BEGIN
  tbl := CASE p_kind
           WHEN 'object_type'     THEN 'object_types'
           WHEN 'link_type'       THEN 'link_types'
           WHEN 'shared_property' THEN 'shared_properties'
           WHEN 'interface'       THEN 'ontology_interfaces'
           WHEN 'action_type'     THEN 'action_types'
         END;
  IF tbl IS NULL THEN
    project_id := NULL; protected := false; RETURN;
  END IF;
  EXECUTE format('SELECT project_id, protected FROM public.%I WHERE id = $1', tbl)
    INTO project_id, protected USING p_id;
  protected := coalesce(protected, false);
END $$;

REVOKE ALL ON FUNCTION public.resource_project(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resource_project(text, uuid) TO authenticated;

-- "edit permissions to the file": the org's standing editors, or the project
-- roles 454 let write.
CREATE OR REPLACE FUNCTION public.user_can_edit_resource(p_user uuid, p_project uuid)
RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = p_user AND u.role IN ('owner','admin'))
      OR EXISTS (SELECT 1 FROM public.project_role_grants g
                  WHERE g.user_id = p_user AND g.project_id = p_project
                    AND g.role IN ('owner','editor'))
$$;

REVOKE ALL ON FUNCTION public.user_can_edit_resource(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_edit_resource(uuid, uuid) TO authenticated;

-- ── protection binds main ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_protected_resource()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The flip itself: "Any user with owner permissions on a resource can
  -- choose to protect or unprotect that resource."
  IF TG_OP = 'UPDATE' AND NEW.protected IS DISTINCT FROM OLD.protected THEN
    IF coalesce(public.project_role(coalesce(NEW.project_id, OLD.project_id)), '') <> 'owner' THEN
      RAISE EXCEPTION 'Branching:ProtectIsOwnerOnly — protecting or unprotecting a resource takes owner permissions on it';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT OLD.protected THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- A compose is a dry-run; a merge applies pre-authored and approved changes.
  IF nullif(current_setting('beacon.composing_branch', true), '') IS NOT NULL
     OR nullif(current_setting('beacon.merging_proposal', true), '') IS NOT NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Branching:ResourceIsProtected — protected resources cannot be changed directly'
    USING HINT = 'Make changes on a branch and create a proposal to merge them into the main branch.';
END $$;

CREATE TRIGGER guard_protected_object_type    BEFORE UPDATE OR DELETE ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_resource();
CREATE TRIGGER guard_protected_link_type      BEFORE UPDATE OR DELETE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_resource();
CREATE TRIGGER guard_protected_shared_property BEFORE UPDATE OR DELETE ON public.shared_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_resource();
CREATE TRIGGER guard_protected_interface      BEFORE UPDATE OR DELETE ON public.ontology_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_resource();
CREATE TRIGGER guard_protected_action_type    BEFORE UPDATE OR DELETE ON public.action_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_resource();

-- ── auto-protect new files ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_protect_new_resource()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL
     AND (SELECT auto_protect_new FROM public.projects WHERE id = NEW.project_id) THEN
    NEW.protected := true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER auto_protect_object_type    BEFORE INSERT ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.auto_protect_new_resource();
CREATE TRIGGER auto_protect_link_type      BEFORE INSERT ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.auto_protect_new_resource();
CREATE TRIGGER auto_protect_shared_property BEFORE INSERT ON public.shared_properties
  FOR EACH ROW EXECUTE FUNCTION public.auto_protect_new_resource();
CREATE TRIGGER auto_protect_interface      BEFORE INSERT ON public.ontology_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.auto_protect_new_resource();
CREATE TRIGGER auto_protect_action_type    BEFORE INSERT ON public.action_types
  FOR EACH ROW EXECUTE FUNCTION public.auto_protect_new_resource();

-- ── contributors, so the policy can refuse them ─────────────────────────────
ALTER TABLE public.branch_resource_changes
  ADD COLUMN authors uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.branch_resource_changes.authors IS
  '"A contributor is any user who has made a change to that resource on the branch" — appended by each branch save that touches the row.';

-- The promote-down in save_working_state (461) records the author. Patched
-- with counted needles, the 454 lesson.
DO $$
DECLARE def text; n1 text; n2 text; n3 text;
BEGIN
  def := pg_get_functiondef('public.save_working_state(uuid)'::regprocedure);
  n1 := 'SET fields    = b.fields || c.fields,';
  n2 := '(branch_id, resource_kind, resource_id, operation, fields, base)';
  n3 := 'VALUES (p_branch, c.resource_kind, c.resource_id, c.operation, c.fields, c.base);';
  IF (length(def) - length(replace(def, n1, ''))) / length(n1) <> 1
     OR (length(def) - length(replace(def, n2, ''))) / length(n2) <> 1
     OR (length(def) - length(replace(def, n3, ''))) / length(n3) <> 1 THEN
    RAISE EXCEPTION 'save_working_state has drifted — wire authors by hand';
  END IF;
  def := replace(def, n1, n1 || '
           authors   = CASE WHEN auth.uid() = ANY (b.authors) THEN b.authors
                            ELSE b.authors || auth.uid() END,');
  def := replace(def, n2, '(branch_id, resource_kind, resource_id, operation, fields, base, authors)');
  def := replace(def, n3,
    'VALUES (p_branch, c.resource_kind, c.resource_id, c.operation, c.fields, c.base, ARRAY[auth.uid()]);');
  EXECUTE def;
END $$;

-- ── approval, by the policy ─────────────────────────────────────────────────
--   "For a task to be approved, the approver must be either an editor or
--    owner of the underlying resource by default. If the resource has been
--    migrated to a project and is protected, the approver must have approval
--    rights based on the project policies instead."
--                                       (ontologies/review-ontology-proposals)
CREATE OR REPLACE FUNCTION public.task_approval_status(p_task uuid)
RETURNS text LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t record; res record; proj record; b uuid; contributors uuid[]; ok integer;
BEGIN
  SELECT * INTO t FROM public.proposal_tasks WHERE id = p_task;
  IF t.id IS NULL THEN RETURN NULL; END IF;

  -- "A single rejection from any user… will cause the resource's changes to
  --  be Rejected" — rejection dominates, regardless of policy.
  IF EXISTS (SELECT 1 FROM public.proposal_reviews r
              WHERE r.task_id = p_task AND r.decision = 'rejected') THEN
    RETURN 'rejected';
  END IF;

  SELECT * INTO res FROM public.resource_project(t.resource_kind, t.resource_id);
  SELECT branch_id INTO b FROM public.ontology_proposals WHERE id = t.proposal_id;
  SELECT coalesce(c.authors, '{}') INTO contributors
    FROM public.branch_resource_changes c
   WHERE c.branch_id = b AND c.resource_kind = t.resource_kind
     AND c.resource_id = t.resource_id;

  IF res.protected AND res.project_id IS NOT NULL THEN
    SELECT * INTO proj FROM public.projects WHERE id = res.project_id;

    IF proj.policy_approvals_required IS NOT NULL THEN
      -- The custom policy: eligible reviewers, N approvals, the contributor rule.
      SELECT count(*) INTO ok FROM public.proposal_reviews r
       WHERE r.task_id = p_task AND r.decision = 'approved'
         AND (cardinality(proj.policy_reviewer_ids) = 0
              OR r.user_id = ANY (proj.policy_reviewer_ids))
         AND (proj.policy_contributor_approval
              OR NOT (r.user_id = ANY (coalesce(contributors, '{}'))));
      RETURN CASE WHEN ok >= proj.policy_approvals_required
                  THEN 'approved' ELSE 'awaiting_approval' END;
    END IF;

    -- The default policy: "Approval required from at least one user with
    -- edit permissions to the file." Protected always reviews — never auto.
    IF EXISTS (SELECT 1 FROM public.proposal_reviews r
                WHERE r.task_id = p_task AND r.decision = 'approved'
                  AND public.user_can_edit_resource(r.user_id, res.project_id)) THEN
      RETURN 'approved';
    END IF;
    RETURN 'awaiting_approval';
  END IF;

  -- Unprotected: "approval from a user with edit-level permissions, which may
  -- be granted automatically when the contributor satisfies the policy".
  IF t.auto_approved THEN RETURN 'auto_approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.proposal_reviews r
              WHERE r.task_id = p_task AND r.decision = 'approved'
                AND public.user_can_edit_resource(r.user_id, res.project_id)) THEN
    RETURN 'approved';
  END IF;
  RETURN 'awaiting_approval';
END $$;

COMMENT ON FUNCTION public.task_approval_status(p_task uuid) IS
  'Derived, never stored — which is also why "proposals linked to that policy will be refreshed and have their status reevaluated" costs nothing: the policy is read at ask time. Rejection dominates. Custom policy on a protected resource counts eligible non-contributor approvals; the default policy takes one user with edit permissions; unprotected auto-approves when the contributor''s own permissions covered it.';

-- ── the automatic half of the default policy ────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_proposal(
  p_branch uuid, p_name text, p_description text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p uuid; n int; c record; res record;
BEGIN
  -- "Creating a proposal requires the branch `Owner` role or space
  --  `Administrator` privileges."
  IF NOT public.can_manage_branch(p_branch) THEN
    RAISE EXCEPTION 'Branching:CannotProposeThisBranch — creating a proposal requires the branch Owner role or space Administrator privileges';
  END IF;

  SELECT count(*) INTO n FROM public.branch_resource_changes WHERE branch_id = p_branch;
  IF n = 0 THEN
    RAISE EXCEPTION 'Branching:NothingToPropose — this branch has changed nothing';
  END IF;

  INSERT INTO public.ontology_proposals (branch_id, name, description)
  VALUES (p_branch, p_name, p_description) RETURNING id INTO p;

  -- "Automatically, when the contributor's own permissions cover the policy"
  -- — an unprotected resource whose proposer could edit it directly needs no
  -- second pair of eyes. Protected resources always review.
  FOR c IN SELECT resource_kind, resource_id
             FROM public.branch_resource_changes WHERE branch_id = p_branch
  LOOP
    SELECT * INTO res FROM public.resource_project(c.resource_kind, c.resource_id);
    INSERT INTO public.proposal_tasks (proposal_id, resource_kind, resource_id, auto_approved)
    VALUES (p, c.resource_kind, c.resource_id,
            NOT res.protected AND public.user_can_edit_resource(auth.uid(), res.project_id));
  END LOOP;

  RETURN p;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; t1 uuid; t2 uuid; t3 uuid;
  b1 uuid; b2 uuid; b3 uuid; pr uuid; tk uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('slice-462') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','s462a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','s462b@beacon.test'),
    (u3, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','s462c@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 's462a@beacon.test', 'admin', org),
    (u2, 's462b@beacon.test', 'admin', org),
    (u3, 's462c@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Slice462');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'slice462', 'Slice 462', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'slice462', 'Slice 462') RETURNING id INTO proj;
  -- u1 owns the project; u2 and u3 can SEE it (454's placement rule hides a
  -- placed resource from anyone without a role — including from this guard's
  -- own probes) but do not own it.
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org), (proj, u2, 'viewer', org), (proj, u3, 'viewer', org);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
  VALUES (ont, proj, 'Slice462A', 'A', 'active') RETURNING id INTO t1;

  -- Protection needs placement; the flip needs project owner.
  BEGIN
    UPDATE public.object_types SET protected = true
     WHERE api_name = 'nonexistent-so-this-is-shape-only';
    INSERT INTO public.object_types (ontology_id, api_name, label, protected)
    VALUES (ont, 'Slice462X', 'X', true);
    RAISE EXCEPTION 'assertion failed: protection without placement should refuse';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  BEGIN
    UPDATE public.object_types SET protected = true WHERE id = t1;
    RAISE EXCEPTION 'assertion failed: a non-owner must not protect';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ProtectIsOwnerOnly%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  UPDATE public.object_types SET protected = true WHERE id = t1;

  -- Protected means main is read-only, for everyone.
  BEGIN
    UPDATE public.object_types SET label = 'A direct' WHERE id = t1;
    RAISE EXCEPTION 'assertion failed: a protected resource must refuse a direct change';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ResourceIsProtected%' THEN RAISE; END IF;
  END;

  -- The branch route works, under the DEFAULT policy: one editor approval.
  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'guard-462', 'Guard 462') RETURNING id INTO b1;
  PERFORM public.stage_change('object_type', t1,
    jsonb_build_object('label', 'A via branch'), b1, 'modified');
  PERFORM public.save_working_state(b1);
  pr := public.create_proposal(b1, 'Guard 462', '');
  SELECT id INTO tk FROM public.proposal_tasks WHERE proposal_id = pr;
  IF (SELECT auto_approved FROM public.proposal_tasks WHERE id = tk) THEN
    RAISE EXCEPTION 'assertion failed: protected resources never auto-approve';
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  INSERT INTO public.proposal_reviews (task_id, user_id, decision) VALUES (tk, u2, 'approved');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  PERFORM public.merge_proposal(pr);
  IF (SELECT label FROM public.object_types WHERE id = t1) <> 'A via branch' THEN
    RAISE EXCEPTION 'assertion failed: the approved branch change did not land';
  END IF;

  -- The custom policy: two approvals from the eligible list, contributors
  -- refused. u1 contributes, so only u2 and u3 count.
  UPDATE public.projects
     SET policy_approvals_required = 2,
         policy_reviewer_ids = ARRAY[u2, u3],
         policy_contributor_approval = false
   WHERE id = proj;

  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'policy-462', 'Policy 462') RETURNING id INTO b2;
  PERFORM public.stage_change('object_type', t1,
    jsonb_build_object('label', 'A custom'), b2, 'modified');
  PERFORM public.save_working_state(b2);
  pr := public.create_proposal(b2, 'Policy 462', '');
  SELECT id INTO tk FROM public.proposal_tasks WHERE proposal_id = pr;

  -- u1 is a contributor and not on the list; their approval must not count.
  INSERT INTO public.proposal_reviews (task_id, user_id, decision) VALUES (tk, u1, 'approved');
  BEGIN
    PERFORM public.merge_proposal(pr);
    RAISE EXCEPTION 'assertion failed: one ineligible approval must not satisfy the policy';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Changes are approved%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  INSERT INTO public.proposal_reviews (task_id, user_id, decision) VALUES (tk, u2, 'approved');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u3::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  INSERT INTO public.proposal_reviews (task_id, user_id, decision) VALUES (tk, u3, 'approved');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);
  PERFORM public.merge_proposal(pr);
  IF (SELECT label FROM public.object_types WHERE id = t1) <> 'A custom' THEN
    RAISE EXCEPTION 'assertion failed: two eligible approvals should merge';
  END IF;

  -- Automatic satisfaction: an unprotected resource whose proposer can edit
  -- it needs no review at all.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
  VALUES (ont, proj, 'Slice462B', 'B', 'active') RETURNING id INTO t2;
  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'auto-462', 'Auto 462') RETURNING id INTO b3;
  PERFORM public.stage_change('object_type', t2,
    jsonb_build_object('label', 'B auto'), b3, 'modified');
  PERFORM public.save_working_state(b3);
  pr := public.create_proposal(b3, 'Auto 462', '');
  IF NOT (SELECT auto_approved FROM public.proposal_tasks WHERE proposal_id = pr) THEN
    RAISE EXCEPTION 'assertion failed: the contributor''s permissions should auto-satisfy';
  END IF;
  PERFORM public.merge_proposal(pr);
  IF (SELECT label FROM public.object_types WHERE id = t2) <> 'B auto' THEN
    RAISE EXCEPTION 'assertion failed: the auto-approved merge did not land';
  END IF;

  -- Auto-protect new files.
  UPDATE public.projects SET auto_protect_new = true WHERE id = proj;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'Slice462C', 'C') RETURNING id INTO t3;
  IF NOT (SELECT protected FROM public.object_types WHERE id = t3) THEN
    RAISE EXCEPTION 'assertion failed: auto-protect must protect new files';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
