-- The Approvals surface's one read call, the platform_experience pattern: the
-- inbox needs every visible request with its tasks, each task carrying the
-- caller's OWN eligibility — "By default, users who have the permission to
-- perform an action themselves are eligible to review the corresponding task"
-- (quoted and built in 651) — and the display names the captures show
-- (`approvals/images/tasks_eligible_to_review.png` renders User to add and
-- Group to update as names, not ids).
--
-- DEFINER with 651's own visibility predicate composed inline — the same
-- requests RLS shows, but the definer can resolve the names a task points at
-- without threading five tables' read policies; only people who can see the
-- request see them, which is what the capture shows reviewers seeing.

CREATE FUNCTION public.approval_requests_listing()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'justification', r.justification,
    'status', r.status,
    'mine', r.created_by = auth.uid(),
    'creator', (SELECT u.email FROM public.users u WHERE u.id = r.created_by),
    'created_at', r.created_at,
    'completed_at', r.completed_at,
    'closed_at', r.closed_at,
    'tasks', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'kind', a.kind,
        'payload', a.payload,
        'status', a.status,
        'reviewed_at', a.reviewed_at,
        'can_review', public.can_review_approval_task(a.id),
        'labels', jsonb_strip_nulls(jsonb_build_object(
          'user', (SELECT u.email FROM public.users u
                    WHERE u.id = (a.payload ->> 'user')::uuid),
          'group', (SELECT g.name FROM public.groups g
                     WHERE g.id = (a.payload ->> 'group')::uuid),
          'project', (SELECT p.name FROM public.projects p
                       WHERE p.id = (a.payload ->> 'project')::uuid),
          'marking', (SELECT m.name FROM public.markings m
                       WHERE m.id = (a.payload ->> 'marking')::uuid),
          'proposal', (SELECT pr.name FROM public.ontology_proposals pr
                        WHERE pr.id = (a.payload ->> 'proposal')::uuid)))
      ) ORDER BY a.id), '[]'::jsonb)
      FROM public.approval_tasks a WHERE a.request_id = r.id)
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.approval_requests r
  WHERE public.can_see_approval_request(r.id)
$$;

COMMENT ON FUNCTION public.approval_requests_listing() IS
  'The inbox in one call: every request the caller may see (651''s own predicate), tasks with the caller''s computed eligibility, and the display names the captures render. Newest first, the inbox''s own sort.';

-- Executed both ways: the requester sees their request with names resolved
-- and no eligibility; the reviewer sees can_review true; a stranger sees
-- nothing at all.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_admin uuid; v_new uuid; v_other uuid; v_email text;
  v_grp uuid; v_req uuid; v_x jsonb; v_n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe652') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe652') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    FOR v_n IN 1..3 LOOP
      v_other := gen_random_uuid();
      v_email := 'probe652-' || v_n || '-' || v_other || '@beacon.test';
      INSERT INTO auth.users (id, instance_id, aud, role, email)
        VALUES (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
      INSERT INTO public.users (id, email, role, organization_id)
        VALUES (v_other, v_email, 'admin', v_org);
      IF v_n = 1 THEN v_admin := v_other; ELSIF v_n = 2 THEN v_new := v_other; END IF;
    END LOOP;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe 652 group', 'internal') RETURNING id INTO v_grp;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    v_req := public.create_approval_request('Listing probe', '',
      jsonb_build_array(jsonb_build_object('kind', 'group_membership',
        'payload', jsonb_build_object('user', v_new, 'group', v_grp))));

    -- the requester: sees it, named, not eligible
    v_x := public.approval_requests_listing();
    IF jsonb_array_length(v_x) <> 1
       OR v_x -> 0 ->> 'title' <> 'Listing probe'
       OR (v_x -> 0 ->> 'mine')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'the requester''s listing is wrong: %', v_x;
    END IF;
    IF v_x -> 0 -> 'tasks' -> 0 -> 'labels' ->> 'group' <> 'Probe 652 group' THEN
      RAISE EXCEPTION 'the group name did not resolve';
    END IF;
    IF (v_x -> 0 -> 'tasks' -> 0 ->> 'can_review')::boolean IS NOT FALSE THEN
      RAISE EXCEPTION 'the requester is eligible to review their own request';
    END IF;

    -- the reviewer: sees it with eligibility
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    v_x := public.approval_requests_listing();
    IF (v_x -> 0 -> 'tasks' -> 0 ->> 'can_review')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'the org administrator is not eligible in the listing';
    END IF;

    -- a stranger in the same org, neither requester nor eligible: nothing
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    IF jsonb_array_length(public.approval_requests_listing()) <> 0 THEN
      RAISE EXCEPTION 'a stranger saw the request';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '652 proved: the requester sees their named request without eligibility, the reviewer sees eligibility, and a stranger sees nothing';
  END;
END $$;
