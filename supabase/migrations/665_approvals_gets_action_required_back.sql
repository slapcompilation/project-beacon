-- The state 651 excluded on the emit-only rule, returning exactly as its
-- constraint comment scoped: "that state exists only through checkpoints,
-- which this platform does not have; it arrives with them." 664 built them.
--
--   "the request cannot be invoked until the checkpoints are submitted."
--   — approvals/overview.md
--
-- The asynchronous path is the checkpoint gate firing INSIDE the invoker:
-- invoke_approval_request executes tasks as the reviewing caller, so 664's
-- producer triggers see the reviewer's claims and refuse an unjustified
-- change. The invoker now catches exactly that refusal, parks the request in
-- action_required with the gate's message as a system comment, and a new
-- retry function re-invokes once the checkpoint is submitted. Who completes
-- it is the page's own answer:
--
--   "The corresponding tasks will display whether checkpoints have been completed or not. The requesting user is usually required to complete checkpoints when the request is made. If that does not happen, eligible reviewers can complete checkpoints on behalf of the requesting user."
--   — approvals/overview.md
--
-- The gate consumes the INVOKING caller's record, so the retry path is
-- reviewer-shaped: an eligible reviewer submits the checkpoint and retries.
-- The requester-completes-at-request-time half is the surface's business,
-- recorded as a residual.

-- ── THE STATE JOINS THE SET ──────────────────────────────────────────────────
ALTER TABLE public.approval_requests DROP CONSTRAINT approval_requests_status_check;
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_status_check
  CHECK (status = ANY (ARRAY['pending_approval', 'closed', 'rejected_and_closed',
                             'changes_requested', 'completed', 'action_required']));

COMMENT ON CONSTRAINT approval_requests_status_check ON public.approval_requests IS
  'Values from approvals/overview — the published request states, complete: Action required arrived with checkpoints (664), entered when an approved request''s invocation is refused by the checkpoint gate.';

-- ── THE INVOKER CATCHES THE GATE ─────────────────────────────────────────────
-- Patch the live definition, never retype it: two anchors, one refusal.
DO $do$
DECLARE src text; a1 text; a2 text;
BEGIN
  src := pg_get_functiondef('public.invoke_approval_request(uuid)'::regprocedure);
  -- 651 was applied from a CRLF file, so the stored body carries a carriage
  -- return ahead of every newline; strip them before anchoring (the
  -- re-executed body is plain LF, semantics unchanged).
  src := replace(src, chr(13), '');
  a1 := 'BEGIN
  FOR t IN SELECT * FROM public.approval_tasks WHERE request_id = p_request ORDER BY id LOOP';
  a2 := 'jsonb_build_array(to_jsonb(p_request::text)));';
  IF position(a1 in src) = 0 OR position(a2 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: invoke_approval_request is not the text 665 read';
  END IF;
  src := replace(src, a1, 'BEGIN
  BEGIN
  FOR t IN SELECT * FROM public.approval_tasks WHERE request_id = p_request ORDER BY id LOOP');
  src := replace(src, a2, a2 || '
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE ''Checkpoints:JustificationRequired%'' THEN RAISE; END IF;
    -- the applied half of the task loop rolls back with this block; the
    -- request parks until the checkpoint is submitted
    UPDATE public.approval_requests SET status = ''action_required''
     WHERE id = p_request;
    INSERT INTO public.approval_request_comments (request_id, body, is_system)
    VALUES (p_request, ''Action required: '' || SQLERRM, true);
  END;');
  EXECUTE src;
END $do$;

-- ── THE RETRY, ONCE THE CHECKPOINT EXISTS ────────────────────────────────────
CREATE FUNCTION public.retry_approval_request(p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_status text;
BEGIN
  SELECT r.status INTO v_status FROM public.approval_requests r WHERE r.id = p_request;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approvals:NoSuchRequest — %', p_request;
  END IF;
  IF v_status <> 'action_required' THEN
    RAISE EXCEPTION 'Approvals:NothingToRetry — a % request is not awaiting a checkpoint', v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.approval_tasks t
                  WHERE t.request_id = p_request AND public.can_review_approval_task(t.id)) THEN
    RAISE EXCEPTION 'Approvals:NotEligible — reviewers are those with the permission to make this change themselves';
  END IF;
  PERFORM public.invoke_approval_request(p_request);
END $$;

COMMENT ON FUNCTION public.retry_approval_request(uuid) IS
  'Re-invokes a request parked in action_required, after the eligible reviewer has submitted the missing checkpoint (approvals/overview: reviewers complete checkpoints on behalf of the requesting user). The gate consumes the caller''s record; success completes the request.';

REVOKE ALL ON FUNCTION public.retry_approval_request(uuid) FROM PUBLIC, anon;

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_admin uuid; v_new uuid; v_grp uuid; v_cfg uuid;
  v_req uuid; v_task uuid; v_status text;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe665') RETURNING id INTO v_org;
    v_admin := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe665-admin-' || v_admin || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_admin, 'probe665-admin-' || v_admin || '@beacon.test', 'admin', v_org);
    v_new := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_new, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe665-new-' || v_new || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_new, 'probe665-new-' || v_new || '@beacon.test', 'admin', v_org);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe665', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.checkpoint_configurations
      (organization_id, name, title, prompt, justification_type,
       justification_config, checkpoint_types, created_by)
    VALUES (v_org, 'Membership governance', 'Sensitive membership change',
            'Confirm this addition follows policy.', 'acknowledgment',
            '{"checkbox_text": "I confirm"}', ARRAY['group_member_addition'], NULL)
    RETURNING id INTO v_cfg;

    -- the newcomer files; the admin approves; the gate parks the request
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_req := public.create_approval_request('Probe665 access', 'needed',
      jsonb_build_array(jsonb_build_object('kind', 'group_membership',
        'payload', jsonb_build_object('user', v_new, 'group', v_grp))));
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT id INTO v_task FROM public.approval_tasks WHERE request_id = v_req;
    PERFORM public.review_approval_task(v_task, 'approved');

    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req;
    IF v_status <> 'action_required' THEN
      RAISE EXCEPTION 'the gated invocation should park in action_required, got %', v_status;
    END IF;
    IF EXISTS (SELECT 1 FROM public.group_members
                WHERE group_id = v_grp AND member_user_id = v_new) THEN
      RAISE EXCEPTION 'the parked request must not have applied its task';
    END IF;

    -- the reviewer completes the checkpoint on the requester's behalf, retries
    PERFORM public.submit_checkpoint(v_cfg, '{"kind": "acknowledgment", "acknowledged": true}');
    PERFORM public.retry_approval_request(v_req);
    SELECT status INTO v_status FROM public.approval_requests WHERE id = v_req;
    IF v_status <> 'completed' THEN
      RAISE EXCEPTION 'the retried request should complete, got %', v_status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.group_members
                    WHERE group_id = v_grp AND member_user_id = v_new) THEN
      RAISE EXCEPTION 'the completed request should have applied its task';
    END IF;

    -- a completed request has nothing to retry
    BEGIN
      PERFORM public.retry_approval_request(v_req);
      RAISE EXCEPTION 'a completed request accepted a retry';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Approvals:NothingToRetry%' THEN RAISE; END IF;
    END;
    RESET ROLE;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '665 proved: an approved request whose invocation the checkpoint gate refuses parks in action_required with nothing applied, the reviewer''s submitted checkpoint lets the retry complete it and apply the task, and a completed request refuses a retry';
  END;
END $$;
