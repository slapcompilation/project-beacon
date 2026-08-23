-- The Approvals engine: requests, tasks, derived eligibility, and automatic
-- invocation. Built from the approvals reading, whose Decisions block the
-- operator approved (engine first; the inbox surface is its own later PR).
--
--   "A user may not have permission to make a particular change in Foundry and needs to make a request for that change. This request gets routed to administrators for approval. The request is invoked when the necessary approvals are obtained, meaning that the requested changes are applied."
--   — approvals/overview.md
--
--   "A request includes a set of tasks that must *all* be approved for the tasks to be invoked, which applies the requested changes."
--   — approvals/overview.md
--
-- ── THE SENTENCE THE DESIGN RESTS ON ─────────────────────────────────────────
--
--   "By default, users who have the permission to perform an action themselves are eligible to review the corresponding task."
--   — approvals/review-a-request.md
--
-- Eligibility is therefore COMPUTED, never stored: one arm per task kind,
-- each composing the predicate that already guards the real write path —
-- has_group_permission for groups, project_role for projects, the manage row
-- in marking_permissions for markings, ontology membership plus the
-- administrator role for proposals. The helpers are SECURITY DEFINER because
-- the visibility policies call them, and a policy may not read the table it
-- guards.
--
-- ── VOCABULARIES ─────────────────────────────────────────────────────────────
-- Request states are the page's six MINUS action_required: that state exists
-- only because of checkpoints ("if a request is approved, but required
-- checkpoints are incomplete, the request cannot be invoked"), a product this
-- platform does not have — a state nothing can produce is a false vocabulary
-- token (the emit-only rule applied to a state). The divergence is scoped:
-- action_required arrives with checkpoints, never before. Task states are
-- the page's three. Task KINDS admit only what an invoker below can execute:
-- the add-reference kind waits for a references mechanism, and the
-- ontology_proposal kind is the page's own redirect shape — the task
-- "will redirect to the Ontology Manager", so its approval gates the request
-- while the merge itself stays the Ontology Manager's.
--
-- ── INVOCATION ───────────────────────────────────────────────────────────────
-- Automatic and the platform's: when the last task approves, the definer
-- applies each task's change through the real write path — group_members,
-- project_role_grants, marking_members — so the audit producers on those
-- tables fire exactly as if an administrator had made the change, and a
-- change that already holds is skipped rather than duplicated.
--
-- ── AUDIT PRODUCERS ──────────────────────────────────────────────────────────
-- requestCreate, requestApprove and requestExecute join audit_categories()
-- HERE, in the migration that adds their producers — the growth rule 645
-- wrote on the constraint. Their required request fields come from the
-- category table's own rows.
--
--   "Requests are persisted even if they have been completed, so you can reference them as an audit log of past decisions."
--   — approvals/overview.md

-- ── TABLES ───────────────────────────────────────────────────────────────────

CREATE TABLE public.approval_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  justification   text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'pending_approval'
                  CHECK (status = ANY (ARRAY['pending_approval', 'closed',
                    'rejected_and_closed', 'changes_requested', 'completed'])),
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  closed_by       uuid REFERENCES public.users(id),
  closed_at       timestamptz
);

COMMENT ON TABLE public.approval_requests IS
  'An Approvals request (approvals/overview): tasks that must all be approved, then the platform invokes. Persisted forever — completed and closed rows are the audit trail of past decisions.';

COMMENT ON CONSTRAINT approval_requests_status_check ON public.approval_requests IS
  'Values from approvals/overview — the published request states, minus Action required: that state exists only through checkpoints, which this platform does not have; it arrives with them.';

CREATE INDEX approval_requests_org ON public.approval_requests (organization_id);
CREATE INDEX approval_requests_created_by ON public.approval_requests (created_by);
CREATE INDEX approval_requests_closed_by ON public.approval_requests (closed_by);

CREATE FUNCTION public.approval_task_kinds()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['group_membership', 'project_role', 'marking_member', 'ontology_proposal']
$$;

COMMENT ON FUNCTION public.approval_task_kinds() IS
  'The task kinds an invoker here can execute, of the five approvals/overview publishes: Group membership, Project access request, Marking access request, Ontology proposal. Add reference request waits for a references mechanism. A kind arrives with its invoker, never before.';

CREATE FUNCTION public.approval_task_payload_valid(p_kind text, p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind
    WHEN 'group_membership'  THEN p ? 'user' AND p ? 'group'
    WHEN 'project_role'      THEN p ? 'user' AND p ? 'project' AND p ? 'role'
    WHEN 'marking_member'    THEN p ? 'user' AND p ? 'marking'
    WHEN 'ontology_proposal' THEN p ? 'proposal'
    ELSE false END
$$;

CREATE TABLE public.approval_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind = ANY (public.approval_task_kinds())),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'review'
              CHECK (status = ANY (ARRAY['review', 'approved', 'rejected'])),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  CHECK (public.approval_task_payload_valid(kind, payload))
);

COMMENT ON TABLE public.approval_tasks IS
  '"A task is an individual change in Foundry" (approvals/overview): a typed payload, three states, and an eligible reviewer derived from the permission to make the change directly. A rejection is overridable while the request lives.';

COMMENT ON CONSTRAINT approval_tasks_status_check ON public.approval_tasks IS
  'Values from approvals/overview — Review, Approved, Rejected.';

CREATE INDEX approval_tasks_request ON public.approval_tasks (request_id);
CREATE INDEX approval_tasks_reviewed_by ON public.approval_tasks (reviewed_by);

CREATE TABLE public.approval_request_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  task_id    uuid REFERENCES public.approval_tasks(id) ON DELETE CASCADE,
  author     uuid REFERENCES public.users(id),
  body       text NOT NULL CHECK (length(btrim(body)) > 0),
  is_system  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approval_request_comments IS
  'Comments on a request or one of its tasks (approvals/review-a-request); system rows are the engine''s own trail — an approval lands in the stream, per the partially_approved_request capture. Files wait for storage; links ride in the text.';

CREATE INDEX approval_request_comments_request ON public.approval_request_comments (request_id);
CREATE INDEX approval_request_comments_task ON public.approval_request_comments (task_id);
CREATE INDEX approval_request_comments_author ON public.approval_request_comments (author);

-- ── ELIGIBILITY, COMPUTED ────────────────────────────────────────────────────
CREATE FUNCTION public.can_review_approval_task(p_task uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE t record; v_ont uuid;
BEGIN
  SELECT a.kind, a.payload, r.organization_id INTO t
    FROM public.approval_tasks a
    JOIN public.approval_requests r ON r.id = a.request_id
   WHERE a.id = p_task;
  IF t.kind IS NULL OR NOT public.auth_in_org(t.organization_id) THEN
    RETURN false;
  END IF;

  CASE t.kind
    -- "Administrators with `Manage permissions` and/or `Manage membership`
    -- permissions on the group can approve this task."
    WHEN 'group_membership' THEN
      RETURN (SELECT public.auth_role()) IN ('owner', 'admin')
          OR public.has_group_permission((t.payload ->> 'group')::uuid, 'manage_permissions')
          OR public.has_group_permission((t.payload ->> 'group')::uuid, 'manage_membership');
    -- "Users who have the Owner role on the Project can approve this task."
    WHEN 'project_role' THEN
      RETURN (SELECT public.auth_role()) IN ('owner', 'admin')
          OR public.role_rank(public.project_role((t.payload ->> 'project')::uuid))
             >= public.role_rank('owner');
    -- "Administrators who have `Manage permissions` on this Marking can
    -- approve this task."
    WHEN 'marking_member' THEN
      RETURN EXISTS (SELECT 1 FROM public.marking_permissions mp
                      WHERE mp.marking_id = (t.payload ->> 'marking')::uuid
                        AND mp.permission = 'manage'
                        AND (mp.user_id = auth.uid()
                             OR mp.group_id = ANY (coalesce(public.auth_group_ids(), '{}'))));
    -- "Administrators who have the Owner role on the Ontology can approve
    -- this task."
    WHEN 'ontology_proposal' THEN
      SELECT b.ontology_id INTO v_ont
        FROM public.ontology_proposals pr
        JOIN public.ontology_branches b ON b.id = pr.branch_id
       WHERE pr.id = (t.payload ->> 'proposal')::uuid;
      RETURN v_ont IS NOT NULL
         AND public.auth_member_of_ontology(v_ont)
         AND (SELECT public.auth_role()) IN ('owner', 'admin');
  END CASE;
END $$;

COMMENT ON FUNCTION public.can_review_approval_task(uuid) IS
  'Derived, never stored: "users who have the permission to perform an action themselves are eligible to review the corresponding task" (approvals/review-a-request). One arm per kind, each composing the predicate that guards the real write path. DEFINER because the visibility policies call it.';

CREATE FUNCTION public.can_see_approval_request(p_request uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.approval_requests r
                  WHERE r.id = p_request AND r.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.approval_tasks a
                  WHERE a.request_id = p_request
                    AND public.can_review_approval_task(a.id))
$$;

COMMENT ON FUNCTION public.can_see_approval_request(uuid) IS
  'Requester or an eligible reviewer of at least one task — the set the page implies when it says inviting a reviewer "does not grant permissions to view a request".';

REVOKE ALL ON FUNCTION public.can_review_approval_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_approval_request(uuid) FROM PUBLIC, anon;

-- ── VISIBILITY ───────────────────────────────────────────────────────────────
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester and reviewers see the request" ON public.approval_requests
  FOR SELECT USING (public.can_see_approval_request(id));
CREATE POLICY "tasks follow their request" ON public.approval_tasks
  FOR SELECT USING (public.can_see_approval_request(request_id));
CREATE POLICY "comments follow their request" ON public.approval_request_comments
  FOR SELECT USING (public.can_see_approval_request(request_id));
-- No write policies: every write goes through the definer functions below.

-- ── THE AUDIT PRODUCERS ARRIVE WITH THEIR CATEGORIES ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_categories()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['managementGroups', 'managementPermissions', 'managementMarkings',
               'requestCreate', 'requestApprove', 'requestExecute']
$$;

CREATE OR REPLACE FUNCTION public.audit_required_fields_present(p_categories text[], p_request jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(CASE c
    WHEN 'managementGroups'      THEN p_request ? 'groupPatches'
    WHEN 'managementPermissions' THEN p_request ? 'resourcesWithPermissionsChanges'
    WHEN 'managementMarkings'    THEN p_request ? 'markingPatches'
    WHEN 'requestCreate'         THEN p_request ? 'createdRequestAffectedResources'
    WHEN 'requestApprove'        THEN p_request ? 'approvedRequestIds'
    WHEN 'requestExecute'        THEN p_request ? 'executedRequestIds'
    ELSE false END), false)
  FROM unnest(p_categories) c
$$;

-- ── THE ENGINE ───────────────────────────────────────────────────────────────
-- p_tasks: [{kind, payload}, ...]
CREATE FUNCTION public.create_approval_request(
  p_title text, p_justification text, p_tasks jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_req uuid; v_org uuid := public.auth_org_id(); t jsonb; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'Approvals:NotAuthenticated — a request needs a requester';
  END IF;
  IF jsonb_typeof(p_tasks) <> 'array' OR jsonb_array_length(p_tasks) = 0 THEN
    RAISE EXCEPTION 'Approvals:NoTasks — a request is a set of tasks, and the set may not be empty';
  END IF;
  INSERT INTO public.approval_requests (organization_id, title, justification, created_by)
  VALUES (v_org, p_title, coalesce(p_justification, ''), auth.uid())
  RETURNING id INTO v_req;
  FOR t IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
    INSERT INTO public.approval_tasks (request_id, kind, payload)
    VALUES (v_req, t ->> 'kind', coalesce(t -> 'payload', '{}'::jsonb));
    v_n := v_n + 1;
  END LOOP;
  PERFORM public.record_audit_event(
    'BEACON_APPROVALS_REQUEST_CREATE', ARRAY['requestCreate'], 'approvals',
    jsonb_build_object('createdRequestAffectedResources',
      (SELECT jsonb_agg(a.kind || ':' || a.payload::text) FROM public.approval_tasks a
        WHERE a.request_id = v_req)),
    jsonb_build_object('createdRequestIds', jsonb_build_array(v_req)),
    jsonb_build_array(to_jsonb(v_req::text)));
  RETURN v_req;
END $$;

COMMENT ON FUNCTION public.create_approval_request(text, text, jsonb) IS
  'Files a request with its tasks. "Requests represent an action that has not yet been taken and may require approval" is the audit category''s own gloss; the requestCreate line carries the affected resources.';

-- Applies every task through the real write path; a change that already
-- holds is skipped, not duplicated. Internal: reachable only from the review
-- function's last approval.
CREATE FUNCTION public.invoke_approval_request(p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM public.approval_tasks WHERE request_id = p_request ORDER BY id LOOP
    CASE t.kind
      WHEN 'group_membership' THEN
        INSERT INTO public.group_members (group_id, member_user_id)
        VALUES ((t.payload ->> 'group')::uuid, (t.payload ->> 'user')::uuid)
        ON CONFLICT (group_id, member_user_id) DO NOTHING;
      WHEN 'project_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.project_role_grants g
                        WHERE g.project_id = (t.payload ->> 'project')::uuid
                          AND g.user_id = (t.payload ->> 'user')::uuid
                          AND g.role = t.payload ->> 'role') THEN
          INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
          SELECT (t.payload ->> 'project')::uuid, (t.payload ->> 'user')::uuid,
                 t.payload ->> 'role', r.organization_id
            FROM public.approval_requests r WHERE r.id = p_request;
        END IF;
      WHEN 'marking_member' THEN
        IF NOT EXISTS (SELECT 1 FROM public.marking_members m
                        WHERE m.marking_id = (t.payload ->> 'marking')::uuid
                          AND m.user_id = (t.payload ->> 'user')::uuid) THEN
          INSERT INTO public.marking_members (marking_id, user_id)
          VALUES ((t.payload ->> 'marking')::uuid, (t.payload ->> 'user')::uuid);
        END IF;
      WHEN 'ontology_proposal' THEN
        -- the page's redirect shape: the task "will redirect to the Ontology
        -- Manager for further details of the proposed change" — its approval
        -- gates this request; the merge stays the Ontology Manager's.
        NULL;
    END CASE;
  END LOOP;
  UPDATE public.approval_requests
     SET status = 'completed', completed_at = clock_timestamp()
   WHERE id = p_request;
  INSERT INTO public.approval_request_comments (request_id, body, is_system)
  VALUES (p_request, 'Invoked: all tasks approved, changes applied', true);
  PERFORM public.record_audit_event(
    'BEACON_APPROVALS_REQUEST_EXECUTE', ARRAY['requestExecute'], 'approvals',
    jsonb_build_object('executedRequestIds', jsonb_build_array(p_request)),
    '{}'::jsonb, jsonb_build_array(to_jsonb(p_request::text)));
END $$;

REVOKE ALL ON FUNCTION public.invoke_approval_request(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.review_approval_task(p_task uuid, p_decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_req uuid; v_status text; v_kind text;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Approvals:NoSuchDecision — a review approves or rejects';
  END IF;
  SELECT a.request_id, r.status, a.kind INTO v_req, v_status, v_kind
    FROM public.approval_tasks a JOIN public.approval_requests r ON r.id = a.request_id
   WHERE a.id = p_task;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Approvals:NoSuchTask — %', p_task;
  END IF;
  IF v_status NOT IN ('pending_approval', 'changes_requested') THEN
    RAISE EXCEPTION 'Approvals:RequestNotOpen — a % request takes no further review', v_status;
  END IF;
  -- "Only eligible reviewers can approve, reject or reject and close" — and a
  -- later approval may override a rejection while the request lives.
  IF NOT public.can_review_approval_task(p_task) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — reviewers are those with the permission to make this change themselves';
  END IF;
  UPDATE public.approval_tasks
     SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = clock_timestamp()
   WHERE id = p_task;
  INSERT INTO public.approval_request_comments (request_id, task_id, body, is_system)
  VALUES (v_req, p_task, initcap(p_decision) || ': ' || replace(v_kind, '_', ' '), true);
  PERFORM public.record_audit_event(
    'BEACON_APPROVALS_TASK_REVIEW', ARRAY['requestApprove'], 'approvals',
    jsonb_build_object('approvedRequestIds', jsonb_build_array(v_req),
                       'decision', p_decision, 'task', p_task),
    '{}'::jsonb, jsonb_build_array(to_jsonb(v_req::text)));
  -- "The request is invoked when the necessary approvals are obtained,
  --  meaning that the requested changes are applied."
  IF p_decision = 'approved' AND NOT EXISTS (
       SELECT 1 FROM public.approval_tasks a
        WHERE a.request_id = v_req AND a.status <> 'approved') THEN
    PERFORM public.invoke_approval_request(v_req);
  END IF;
END $$;

CREATE FUNCTION public.close_approval_request(p_request uuid, p_rejected boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_status text; v_mine boolean;
BEGIN
  SELECT r.status, r.created_by = auth.uid() INTO v_status, v_mine
    FROM public.approval_requests r WHERE r.id = p_request;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Approvals:NoSuchRequest — %', p_request;
  END IF;
  IF v_status IN ('completed', 'closed', 'rejected_and_closed') THEN
    RAISE EXCEPTION 'Approvals:RequestNotOpen — a closed request cannot be reopened, and a completed one is history';
  END IF;
  -- "Requests can be edited or closed by the requesting user or by any
  -- eligible reviewers." Rejecting-and-closing is a reviewer's act alone.
  IF p_rejected THEN
    IF NOT EXISTS (SELECT 1 FROM public.approval_tasks a
                    WHERE a.request_id = p_request
                      AND public.can_review_approval_task(a.id)) THEN
      RAISE EXCEPTION 'Approvals:NotEligible — only an eligible reviewer rejects and closes';
    END IF;
  ELSIF NOT (v_mine OR public.can_see_approval_request(p_request)) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — the requester or an eligible reviewer closes a request';
  END IF;
  UPDATE public.approval_requests
     SET status = CASE WHEN p_rejected THEN 'rejected_and_closed' ELSE 'closed' END,
         closed_by = auth.uid(), closed_at = clock_timestamp()
   WHERE id = p_request;
  INSERT INTO public.approval_request_comments (request_id, body, is_system)
  VALUES (p_request,
          CASE WHEN p_rejected THEN 'Rejected and closed' ELSE 'Closed' END, true);
END $$;

CREATE FUNCTION public.request_approval_changes(p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.approval_requests r
                  WHERE r.id = p_request AND r.status = 'pending_approval') THEN
    RAISE EXCEPTION 'Approvals:RequestNotOpen — changes are requested of an open request';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.approval_tasks a
                  WHERE a.request_id = p_request
                    AND public.can_review_approval_task(a.id)) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — only an eligible reviewer requests changes';
  END IF;
  -- "The request stays open and eligible users can edit it or provide
  -- further justification to comply with the necessary changes."
  UPDATE public.approval_requests SET status = 'changes_requested' WHERE id = p_request;
  INSERT INTO public.approval_request_comments (request_id, body, is_system)
  VALUES (p_request, 'Changes requested', true);
END $$;

CREATE FUNCTION public.edit_approval_request(
  p_request uuid, p_title text, p_justification text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_status text; v_mine boolean;
BEGIN
  SELECT r.status, r.created_by = auth.uid() INTO v_status, v_mine
    FROM public.approval_requests r WHERE r.id = p_request;
  IF v_status IS NULL OR v_status NOT IN ('pending_approval', 'changes_requested') THEN
    RAISE EXCEPTION 'Approvals:RequestNotOpen — only an open request can be edited';
  END IF;
  IF NOT (v_mine OR public.can_see_approval_request(p_request)) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — the requester or an eligible reviewer edits a request';
  END IF;
  UPDATE public.approval_requests
     SET title = coalesce(p_title, title),
         justification = coalesce(p_justification, justification),
         status = 'pending_approval'
   WHERE id = p_request;
END $$;

CREATE FUNCTION public.comment_on_approval_request(
  p_request uuid, p_task uuid, p_body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_see_approval_request(p_request) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — comments belong to those who can see the request';
  END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.approval_tasks a
        WHERE a.id = p_task AND a.request_id = p_request) THEN
    RAISE EXCEPTION 'Approvals:NoSuchTask — % is not a task of this request', p_task;
  END IF;
  INSERT INTO public.approval_request_comments (request_id, task_id, author, body)
  VALUES (p_request, p_task, auth.uid(), p_body) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── PROVED BY DOING: the whole loop, two reviewers, both directions ──────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_admin uuid; v_mgr uuid; v_new uuid; v_email text;
  v_grp uuid; v_mc uuid; v_mk uuid; v_req uuid; v_t_grp uuid; v_t_mk uuid;
  v_req2 uuid; v_n int; v_ok boolean; v_status text;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe651') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe651') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    -- three people: an org admin (marking manager), a group manager who is
    -- NOT org admin, and the newcomer the request is about
    FOR v_n IN 1..3 LOOP
      v_new := gen_random_uuid();
      v_email := 'probe651-' || v_n || '-' || v_new || '@beacon.test';
      INSERT INTO auth.users (id, instance_id, aud, role, email)
        VALUES (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
      -- the profile column only admits owner/admin; who is a MEMBER is a
      -- claims fact, and the probe differentiates through claims below
      INSERT INTO public.users (id, email, role, organization_id)
        VALUES (v_new, v_email, 'admin', v_org);
      IF v_n = 1 THEN v_admin := v_new; ELSIF v_n = 2 THEN v_mgr := v_new; END IF;
    END LOOP;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe651', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.group_permissions (group_id, user_id, permission)
      VALUES (v_grp, v_mgr, 'manage_membership');
    INSERT INTO public.marking_categories (organization_id, name, category_type, visibility)
      VALUES (v_org, 'Probe651', 'conjunctive', 'visible') RETURNING id INTO v_mc;
    INSERT INTO public.markings (category_id, name)
      VALUES (v_mc, 'Probe651') RETURNING id INTO v_mk;
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
      VALUES (v_mk, v_admin, 'manage');

    -- the newcomer files a request with two tasks
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    v_req := public.create_approval_request('Access for the newcomer',
      'Needed for the maintenance analysis',
      jsonb_build_array(
        jsonb_build_object('kind', 'group_membership',
          'payload', jsonb_build_object('user', v_new, 'group', v_grp)),
        jsonb_build_object('kind', 'marking_member',
          'payload', jsonb_build_object('user', v_new, 'marking', v_mk))));
    SELECT id INTO v_t_grp FROM public.approval_tasks
     WHERE request_id = v_req AND kind = 'group_membership';
    SELECT id INTO v_t_mk FROM public.approval_tasks
     WHERE request_id = v_req AND kind = 'marking_member';

    -- the requester is not a reviewer of either task
    IF public.can_review_approval_task(v_t_grp) OR public.can_review_approval_task(v_t_mk) THEN
      RAISE EXCEPTION 'the requester reviewed their own request';
    END IF;
    v_ok := false;
    BEGIN
      PERFORM public.review_approval_task(v_t_grp, 'approved');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%NotEligible%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'an ineligible review was accepted'; END IF;

    -- the group manager is eligible for the group task ALONE — the split the
    -- tasks_eligible_to_review capture draws
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_mgr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    IF NOT public.can_review_approval_task(v_t_grp)
       OR public.can_review_approval_task(v_t_mk) THEN
      RAISE EXCEPTION 'eligibility did not split by permission';
    END IF;
    PERFORM public.review_approval_task(v_t_grp, 'approved');
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req;
    IF v_status <> 'pending_approval' THEN
      RAISE EXCEPTION 'a partially approved request advanced to %', v_status;
    END IF;

    -- the marking manager approves the rest; the request invokes itself
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    PERFORM public.review_approval_task(v_t_mk, 'approved');
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req;
    IF v_status <> 'completed' THEN
      RAISE EXCEPTION 'all tasks approved yet the request is %', v_status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.group_members
                    WHERE group_id = v_grp AND member_user_id = v_new) THEN
      RAISE EXCEPTION 'invocation did not add the group membership';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.marking_members
                    WHERE marking_id = v_mk AND user_id = v_new) THEN
      RAISE EXCEPTION 'invocation did not add the marking membership';
    END IF;

    -- the trail: three audit categories produced, and the system comments
    SELECT count(DISTINCT c) INTO v_n FROM public.audit_events e
     CROSS JOIN LATERAL unnest(e.categories) c
     WHERE e.org_id = v_org AND c IN ('requestCreate', 'requestApprove', 'requestExecute');
    IF v_n <> 3 THEN
      RAISE EXCEPTION 'expected all three request categories produced, found %', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.approval_request_comments
     WHERE request_id = v_req AND is_system;
    IF v_n < 3 THEN
      RAISE EXCEPTION 'the decision trail is missing system comments';
    END IF;

    -- a completed request takes no further review
    v_ok := false;
    BEGIN
      PERFORM public.review_approval_task(v_t_mk, 'rejected');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%RequestNotOpen%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'history accepted a review'; END IF;

    -- the other paths: changes requested reopens to editing, and a
    -- reject-and-close is final
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    v_req2 := public.create_approval_request('Second try', '',
      jsonb_build_array(jsonb_build_object('kind', 'group_membership',
        'payload', jsonb_build_object('user', v_new, 'group', v_grp))));
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_mgr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    PERFORM public.request_approval_changes(v_req2);
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req2;
    IF v_status <> 'changes_requested' THEN
      RAISE EXCEPTION 'changes requested did not hold';
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    PERFORM public.edit_approval_request(v_req2, 'Second try, clarified', 'Better reason');
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req2;
    IF v_status <> 'pending_approval' THEN
      RAISE EXCEPTION 'an edit did not reopen the request';
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_mgr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    PERFORM public.close_approval_request(v_req2, true);
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req2;
    IF v_status <> 'rejected_and_closed' THEN
      RAISE EXCEPTION 'reject and close did not hold';
    END IF;
    v_ok := false;
    BEGIN
      PERFORM public.edit_approval_request(v_req2, 'Third try', NULL);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%RequestNotOpen%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a closed request was reopened by an edit'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '651 proved: the loop ran whole — eligibility split by permission, partial approval held, the last approval invoked through the real paths, all three request categories produced, and history refused further review';
  END;
END $$;
