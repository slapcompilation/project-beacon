-- 420 — a proposal is a task per resource
--
-- Reading: mirror/global-branching/{core-concepts,branch-security,
--                                   resource-protection-and-approval-policies}
--          mirror/ontologies/branching-ontology
--          docs/ONTOLOGY-BUILD-MAP.md, phase D2
--
--   "When you are satisfied with the state of your branch, create a proposal to
--    start reviewing and ultimately merging your changes into the `main` branch."
--
--   "EACH ONTOLOGY RESOURCE IS CONSIDERED AN INDIVIDUAL TASK. The status tag
--    next to the resource name indicates the overall approval status."
--
-- ── FOUR SENTENCES THAT EACH DECIDE A COLUMN ─────────────────────────────────
--
-- 1. REVIEWERS ATTACH TO THE PROPOSAL, NOT THE TASK.
--      "While ontology entities are treated as separate resources in Global
--       Branching, they are grouped under a single local ontology proposal. This
--       means ADDING A REVIEWER TO ONE ONTOLOGY RESOURCE EFFECTIVELY ADDS THAT
--       REVIEWER ACROSS ALL ONTOLOGY RESOURCES."
--    So a reviewer row keyed by task would be a lie the UI would have to undo.
--
-- 2. THE REVIEWER LIST DOES NOT RESTRICT ANYTHING.
--      "Users with approval rights CAN APPROVE PROPOSALS EVEN IF NOT ADDED AS
--       REVIEWERS. Use the reviewers list to TRACK who should review changes,
--       NOT TO RESTRICT approvals."
--    So it is a to-do list, and approval authority is checked separately.
--
-- 3. ONE REJECTION STOPS EVERYTHING.
--      "A SINGLE REJECTION FROM ANY USER during the review process will cause the
--       resource's changes to be `Rejected`. This will PREVENT THE ENTIRE
--       PROPOSAL FROM MERGING. The rejecting user will be required to re-review
--       the changes and `Approve` them before the proposal can be merged."
--    So a task's status is derived from its reviews, rejection dominating.
--
-- 4. CHECKS ARE NOT APPROVALS.
--      "When a proposal is created, MERGE CHECKS will run to verify whether the
--       resources on a global branch are able to merge… Failed checks can include
--       CONFLICTS between your branch and the `main` branch."
--    The screenshot shows a row that is `Auto-approved` and still carries a red
--    cross, so the two are separate columns and both must pass.

BEGIN;

CREATE TABLE public.ontology_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES public.ontology_branches(id) ON DELETE CASCADE,

  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "A proposal has a description field… and supports markdown text."
  description  text NOT NULL DEFAULT '',

  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','merged','closed')),
  -- Owners may "apply or remove the Do not merge setting on the branch's
  -- proposals" — a hold that outranks every satisfied check.
  do_not_merge boolean NOT NULL DEFAULT false,

  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  merged_at    timestamptz
);

-- A branch proposes once at a time; closing one frees it to propose again.
CREATE UNIQUE INDEX one_open_proposal_per_branch
  ON public.ontology_proposals (branch_id) WHERE status = 'open';

COMMENT ON TABLE public.ontology_proposals IS
  'A request to merge a branch into main. One open at a time per branch. States: open, merged, closed.';

-- ── one task per changed resource ────────────────────────────────────────────

CREATE TABLE public.proposal_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES public.ontology_proposals(id) ON DELETE CASCADE,
  resource_kind text NOT NULL,
  resource_id   uuid NOT NULL,
  -- "Non-protected resources still require approval from a user with edit-level
  --  permissions, WHICH MAY BE GRANTED AUTOMATICALLY when the contributor
  --  satisfies the policy."
  auto_approved boolean NOT NULL DEFAULT false,
  UNIQUE (proposal_id, resource_kind, resource_id)
);

COMMENT ON TABLE public.proposal_tasks IS
  'One per resource the branch changed. "Each ontology resource is considered an individual task."';

CREATE TABLE public.proposal_reviewers (
  -- The proposal, not the task: adding a reviewer to one resource adds them to
  -- all of them, so keying by task would model something Foundry does not do.
  proposal_id uuid NOT NULL REFERENCES public.ontology_proposals(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

COMMENT ON TABLE public.proposal_reviewers IS
  'Who SHOULD review. Not who may: "users with approval rights can approve proposals even if not added as reviewers. Use the reviewers list to track who should review changes, not to restrict approvals."';

CREATE TABLE public.proposal_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.proposal_tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision   text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One standing decision per person per task. "The rejecting user will be
  -- required to re-review the changes and Approve them" — that is an update of
  -- their decision, not a second row beside it.
  UNIQUE (task_id, user_id)
);

COMMENT ON TABLE public.proposal_reviews IS
  'One standing decision per reviewer per task. Re-reviewing replaces the decision rather than adding to it.';

-- ── a task's status is derived ───────────────────────────────────────────────
-- Rejection dominates, then approval, then auto-approval, then waiting.

CREATE OR REPLACE FUNCTION public.task_approval_status(p_task uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.proposal_reviews r
                  WHERE r.task_id = p_task AND r.decision = 'rejected') THEN 'rejected'
    WHEN EXISTS (SELECT 1 FROM public.proposal_reviews r
                  WHERE r.task_id = p_task AND r.decision = 'approved') THEN 'approved'
    WHEN (SELECT auto_approved FROM public.proposal_tasks WHERE id = p_task) THEN 'auto_approved'
    ELSE 'awaiting_approval'
  END
$$;

COMMENT ON FUNCTION public.task_approval_status(uuid) IS
  'Derived, never stored. "A single rejection from any user… will cause the resource''s changes to be Rejected", so rejection dominates approval regardless of order or count.';

-- ── creating a proposal snapshots the branch's resources ─────────────────────
--   "When a proposal is created, checks will run on each resource."

CREATE OR REPLACE FUNCTION public.create_proposal(
  p_branch uuid, p_name text, p_description text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p uuid; n int;
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

  INSERT INTO public.proposal_tasks (proposal_id, resource_kind, resource_id)
  SELECT p, c.resource_kind, c.resource_id
    FROM public.branch_resource_changes c WHERE c.branch_id = p_branch;

  RETURN p;
END $$;

COMMENT ON FUNCTION public.create_proposal(uuid, text, text) IS
  'Opens a proposal and snapshots one task per resource the branch changed.';

REVOKE ALL ON FUNCTION public.create_proposal(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_proposal(uuid, text, text) TO authenticated;

-- ── the checks, as one query ─────────────────────────────────────────────────
--   "All checks for branched resources must pass in order to merge a proposal."
-- Empty means mergeable. Approval and merge-check are separate reasons, because
-- the screenshot shows a row that is Auto-approved and still failing.

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

  -- Approval, per task.
  SELECT 'task', t.resource_kind || ':' || t.resource_id::text,
         CASE public.task_approval_status(t.id)
           WHEN 'rejected' THEN 'Rejected — the rejecting user must re-review and approve'
           ELSE 'Awaiting approval'
         END
    FROM public.proposal_tasks t
   WHERE t.proposal_id = p_proposal
     AND public.task_approval_status(t.id) IN ('rejected','awaiting_approval')

  UNION ALL

  -- The merge check. "Failed checks can include CONFLICTS between your branch
  -- and the main branch, which would require you to rebase your branch."
  SELECT 'check', c.resource_kind || ':' || c.resource_id::text,
         format('Conflicts with main on "%s" — rebase the branch', c.field)
    FROM public.ontology_proposals p
   CROSS JOIN LATERAL public.branch_conflicts(p.branch_id) c
   WHERE p.id = p_proposal
$$;

COMMENT ON FUNCTION public.proposal_blockers(uuid) IS
  'Every reason this proposal cannot merge. Empty means it can. Approval and merge checks are separate reasons — a task can be approved and still fail its check.';

REVOKE ALL ON FUNCTION public.proposal_blockers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_blockers(uuid) TO authenticated;

-- ── merging ──────────────────────────────────────────────────────────────────
--   "Any user who can view a proposal can merge it, as long as resource-level
--    approvals and checks are satisfied and the Do not merge setting is not
--    applied." And merge rights are deliberately wider than edit rights:
--    "merging only applies pre-authored and approved changes."

CREATE OR REPLACE FUNCTION public.merge_proposal(p_proposal uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE b uuid; blockers text;
BEGIN
  SELECT branch_id INTO b FROM public.ontology_proposals WHERE id = p_proposal;
  IF b IS NULL THEN
    RAISE EXCEPTION 'Branching:ProposalNotFound %', p_proposal USING ERRCODE = 'no_data_found';
  END IF;

  SELECT string_agg(reason, '; ') INTO blockers FROM public.proposal_blockers(p_proposal);
  IF blockers IS NOT NULL THEN
    RAISE EXCEPTION 'Branching:ProposalNotMergeable — %', blockers;
  END IF;

  UPDATE public.ontology_proposals
     SET status = 'merged', merged_at = now() WHERE id = p_proposal;
  -- "Merged branches are terminal."
  UPDATE public.ontology_branches SET status = 'merged' WHERE id = b;
END $$;

COMMENT ON FUNCTION public.merge_proposal(uuid) IS
  'Merges a proposal when nothing blocks it, and retires its branch. Deliberately does NOT check who is merging beyond visibility: "the person who merges may be submitting changes to resources that they cannot edit themselves. This is by design."';

REVOKE ALL ON FUNCTION public.merge_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_proposal(uuid) TO authenticated;

-- ── access ───────────────────────────────────────────────────────────────────

ALTER TABLE public.ontology_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_reviews   ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_proposal(p_proposal uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ontology_proposals p
                  WHERE p.id = p_proposal AND public.can_see_branch(p.branch_id))
$$;
REVOKE ALL ON FUNCTION public.can_see_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_proposal(uuid) TO authenticated;

CREATE POLICY "read proposals on visible branches" ON public.ontology_proposals
  FOR SELECT USING (public.can_see_branch(branch_id));
CREATE POLICY "owners manage proposals" ON public.ontology_proposals
  FOR ALL USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

CREATE POLICY "read tasks" ON public.proposal_tasks
  FOR SELECT USING (public.can_see_proposal(proposal_id));
CREATE POLICY "owners manage tasks" ON public.proposal_tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM public.ontology_proposals p
                          WHERE p.id = proposal_id AND public.can_manage_branch(p.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ontology_proposals p
                       WHERE p.id = proposal_id AND public.can_manage_branch(p.branch_id)));

CREATE POLICY "read reviewers" ON public.proposal_reviewers
  FOR SELECT USING (public.can_see_proposal(proposal_id));
CREATE POLICY "owners manage reviewers" ON public.proposal_reviewers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.ontology_proposals p
                          WHERE p.id = proposal_id AND public.can_manage_branch(p.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ontology_proposals p
                       WHERE p.id = proposal_id AND public.can_manage_branch(p.branch_id)));

CREATE POLICY "read reviews" ON public.proposal_reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.proposal_tasks t
                             WHERE t.id = task_id AND public.can_see_proposal(t.proposal_id)));
-- Anyone who can see it may review it, and only their own review. Being on the
-- reviewer list is not required — it tracks, it does not restrict.
CREATE POLICY "review your own opinion" ON public.proposal_reviews
  FOR ALL USING (user_id = auth.uid()
                 AND EXISTS (SELECT 1 FROM public.proposal_tasks t
                              WHERE t.id = task_id AND public.can_see_proposal(t.proposal_id)))
  WITH CHECK (user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.proposal_tasks t
                           WHERE t.id = task_id AND public.can_see_proposal(t.proposal_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ontology_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_tasks     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_reviewers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_reviews   TO authenticated;

CREATE INDEX idx_proposals_branch ON public.ontology_proposals (branch_id);
CREATE INDEX idx_tasks_proposal   ON public.proposal_tasks (proposal_id);

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; t2 uuid; b uuid; prop uuid;
  task1 uuid; task2 uuid;
  usr uuid := gen_random_uuid(); rev uuid := gen_random_uuid();
  claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '420@beacon.test'), (rev, '420r@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m420') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m420') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm420', 'm420') RETURNING id INTO ont;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Employee', 'Employee') RETURNING id INTO t;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Office', 'Office') RETURNING id INTO t2;

  INSERT INTO public.ontology_branches (ontology_id, organization_id, name, title, created_by_user_id)
       VALUES (ont, org, 'rename', 'Rename things', usr) RETURNING id INTO b;

  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);

  -- Nothing changed yet.
  BEGIN
    PERFORM public.create_proposal(b, 'Empty');
    RAISE EXCEPTION 'Migration 420: a proposal was opened on a branch that changed nothing';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:NothingToPropose%' THEN RAISE; END IF;
  END;

  INSERT INTO public.branch_resource_changes
    (branch_id, resource_kind, resource_id, operation, fields, base)
  VALUES (b, 'object_type', t,  'modified', '{"label":"Team member"}'::jsonb, '{"label":"Employee"}'::jsonb),
         (b, 'object_type', t2, 'modified', '{"label":"Site"}'::jsonb,        '{"label":"Office"}'::jsonb);

  prop := public.create_proposal(b, 'Rename Employee and Office', 'Because **words** matter.');

  -- "Each ontology resource is considered an individual task."
  SELECT count(*) INTO n FROM public.proposal_tasks WHERE proposal_id = prop;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 420: expected a task per changed resource, got %', n;
  END IF;
  SELECT id INTO task1 FROM public.proposal_tasks WHERE proposal_id = prop AND resource_id = t;
  SELECT id INTO task2 FROM public.proposal_tasks WHERE proposal_id = prop AND resource_id = t2;

  -- One open proposal per branch.
  BEGIN
    PERFORM public.create_proposal(b, 'Another');
    RAISE EXCEPTION 'Migration 420: a branch opened a second proposal';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Both tasks await approval, so it cannot merge.
  IF public.task_approval_status(task1) <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Migration 420: a fresh task is not awaiting approval';
  END IF;
  SELECT count(*) INTO n FROM public.proposal_blockers(prop);
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 420: expected 2 blockers, got %', n;
  END IF;

  -- "Users with approval rights can approve proposals EVEN IF NOT ADDED AS
  --  REVIEWERS." Nobody is on the reviewer list yet.
  INSERT INTO public.proposal_reviews (task_id, user_id, decision)
       VALUES (task1, rev, 'approved'), (task2, rev, 'approved');
  SELECT count(*) INTO n FROM public.proposal_blockers(prop);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 420: an approved proposal still reports % blocker(s)', n;
  END IF;

  -- "A SINGLE REJECTION FROM ANY USER… will prevent the entire proposal from
  --  merging" — even beside an existing approval.
  INSERT INTO public.proposal_reviews (task_id, user_id, decision)
       VALUES (task1, usr, 'rejected');
  IF public.task_approval_status(task1) <> 'rejected' THEN
    RAISE EXCEPTION 'Migration 420: a rejection did not dominate an approval';
  END IF;
  BEGIN
    PERFORM public.merge_proposal(prop);
    RAISE EXCEPTION 'Migration 420: a rejected proposal merged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:ProposalNotMergeable%' THEN RAISE; END IF;
  END;

  -- "The rejecting user will be required to re-review the changes and Approve
  --  them" — one standing decision, replaced rather than added to.
  UPDATE public.proposal_reviews SET decision = 'approved'
   WHERE task_id = task1 AND user_id = usr;
  IF public.task_approval_status(task1) <> 'approved' THEN
    RAISE EXCEPTION 'Migration 420: re-reviewing did not clear the rejection';
  END IF;

  -- The Do not merge hold outranks a fully approved proposal.
  UPDATE public.ontology_proposals SET do_not_merge = true WHERE id = prop;
  BEGIN
    PERFORM public.merge_proposal(prop);
    RAISE EXCEPTION 'Migration 420: Do not merge was ignored';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:ProposalNotMergeable%' THEN RAISE; END IF;
  END;
  UPDATE public.ontology_proposals SET do_not_merge = false WHERE id = prop;

  -- A conflict is a CHECK, separate from approval: everything is approved and it
  -- still cannot merge.
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  UPDATE public.object_types SET label = 'Staff member' WHERE id = t;
  PERFORM set_config('request.jwt.claims', claims, true);

  SELECT count(*) INTO n FROM public.proposal_blockers(prop) WHERE scope = 'check';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 420: a conflict with main did not block the merge (got %)', n;
  END IF;
  BEGIN
    PERFORM public.merge_proposal(prop);
    RAISE EXCEPTION 'Migration 420: a conflicting proposal merged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:ProposalNotMergeable%' THEN RAISE; END IF;
  END;

  -- Rebase resolves it — here by taking main's value as the new base.
  UPDATE public.branch_resource_changes
     SET base = '{"label":"Staff member"}'::jsonb
   WHERE branch_id = b AND resource_id = t;

  PERFORM public.merge_proposal(prop);
  IF (SELECT status FROM public.ontology_proposals WHERE id = prop) <> 'merged' THEN
    RAISE EXCEPTION 'Migration 420: the proposal did not merge';
  END IF;
  -- "Merged branches are terminal."
  IF (SELECT status FROM public.ontology_branches WHERE id = b) <> 'merged' THEN
    RAISE EXCEPTION 'Migration 420: merging the proposal did not retire the branch';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.proposal_reviews WHERE task_id IN (task1, task2);
  DELETE FROM public.ontology_proposals WHERE branch_id = b;
  DELETE FROM public.branch_resource_changes WHERE branch_id = b;
  DELETE FROM public.branch_roles WHERE branch_id = b;
  DELETE FROM public.ontology_branches WHERE ontology_id = ont;
  DELETE FROM public.object_types WHERE ontology_id = ont;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id IN (usr, rev);
END $$;

COMMIT;
