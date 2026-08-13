-- Guest reach, the read half — the slice the enrollments reading held back.
--
-- "A guest of an Organization is a user who can view Projects, files, users,
-- groups, tag categories, and collections in this Organization. Guests can
-- be users or groups."
-- (administration/enrollments-and-organizations-access.md)
--
-- The fold lands at the chokepoints the audit found: resource_file_access
-- carries the org arm for BOTH projects and datasets, so one line covers
-- "Projects" and "files"; users and groups take additive SELECT policies
-- (permissive policies OR together, the write-bearing originals stay
-- untouched). Tag categories and collections are Compass surfaces we do not
-- have — absent, not stubbed. Roles stay discretionary: a guest passes the
-- organization requirement and nothing else, so project contents still take
-- a role and markings still take membership.

-- ── the claims carry group-guest orgs too ───────────────────────────────────
-- Restated whole from the live definition; the one change is the guests
-- query, which now reaches orgs where any of the user's groups is a guest.
-- Claims are token-time snapshots — same standing as role and org_id.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
  u      record;
  guests jsonb;
BEGIN
  claims := coalesce(event->'claims', '{}'::jsonb);
  IF jsonb_typeof(claims->'app_metadata') IS DISTINCT FROM 'object' THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
  END IF;

  SELECT organization_id, role INTO u
    FROM public.users WHERE id = (event->>'user_id')::uuid;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  IF u.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, org_id}', to_jsonb(u.organization_id::text), true);
  END IF;
  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(u.role), true);

  -- "Guests can be users or groups" — both principals reach the claims.
  SELECT coalesce(jsonb_agg(DISTINCT g.organization_id::text), '[]'::jsonb) INTO guests
    FROM public.organization_guests g
   WHERE g.user_id = (event->>'user_id')::uuid
      OR g.group_id IN (SELECT public.user_group_ids((event->>'user_id')::uuid));
  claims := jsonb_set(claims, '{app_metadata, guest_org_ids}', guests, true);

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END $$;

-- ── the chokepoint: projects and files ──────────────────────────────────────
-- Restated whole; the org arm now also passes for a guest org from the
-- session. NULL handling is unchanged — the IS NOT DISTINCT FROM branch
-- still answers for org-less resources and caller.
CREATE OR REPLACE FUNCTION public.resource_file_access(p_kind text, p_id uuid, p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (p_org IS NOT DISTINCT FROM public.auth_org_id()
          OR p_org = ANY (coalesce(public.auth_org_ids(), '{}')))
     AND public.satisfies_markings(m.ms)
     AND public.passes_scoped_session(m.ms)
    FROM (SELECT public.effective_file_markings(p_kind, p_id) AS ms) m
$$;

-- ── users and groups: additive read, writes untouched ───────────────────────
-- "…can view … users, groups…" — the registry and the groups of the host
-- organization open to guests read-only; every write policy stays
-- primary-org as it was.
CREATE POLICY "guests view the registry" ON public.users FOR SELECT
  USING (organization_id = ANY (coalesce(public.auth_org_ids(), '{}')));
CREATE POLICY "guests see groups" ON public.groups FOR SELECT
  USING (organization_id = ANY (coalesce(public.auth_org_ids(), '{}')));

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  host uuid; away uuid; grp uuid; proj uuid; ds uuid; hostgrp uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
  n int; hooked jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('guestreach-492-host') RETURNING id INTO host;
  INSERT INTO public.organizations (name) VALUES ('guestreach-492-away') RETURNING id INTO away;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gr492a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gr492b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'gr492a@beacon.test', 'admin', host),
    (u2, 'gr492b@beacon.test', 'admin', away);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', host))::text, true);
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (host, 'gr492', 'GR492') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (host, proj, 'gr492ds', 'GR Files') RETURNING id INTO ds;
  INSERT INTO public.groups (organization_id, name, created_by) VALUES (host, 'Hosts 492', u1)
  RETURNING id INTO hostgrp;

  -- 1. Before guesthood: the away user sees nothing of the host org.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away,
                                        'guest_org_ids', '[]'::json))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  IF n <> 0 THEN RAISE EXCEPTION 'a non-guest saw a foreign project'; END IF;
  SELECT count(*) INTO n FROM public.users WHERE id = u1;
  IF n <> 0 THEN RAISE EXCEPTION 'a non-guest saw a foreign registry row'; END IF;
  RESET ROLE;

  -- 2. As a guest (the claims the hook would mint): projects, files, users
  --    and groups of the host open read-only.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away,
                                        'guest_org_ids', json_build_array(host::text)))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host project'; END IF;
  SELECT count(*) INTO n FROM public.datasets WHERE id = ds;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host dataset'; END IF;
  SELECT count(*) INTO n FROM public.users WHERE id = u1;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host registry'; END IF;
  SELECT count(*) INTO n FROM public.groups WHERE id = hostgrp;
  IF n <> 1 THEN RAISE EXCEPTION 'a guest should view the host groups'; END IF;

  -- 3. Viewing is not writing: the same guest cannot touch what they see.
  BEGIN
    UPDATE public.projects SET name = 'stolen' WHERE id = proj;
    IF FOUND THEN RAISE EXCEPTION 'a guest wrote to a host project'; END IF;
  END;
  BEGIN
    INSERT INTO public.groups (organization_id, name) VALUES (host, 'Gatecrash 492');
    RAISE EXCEPTION 'a guest created a group in the host org';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%row-level security%' THEN RAISE; END IF;
  END;
  RESET ROLE;

  -- 4. The hook mints guest orgs for both principals: u2 direct on host,
  --    and via a group guest of... the group path, asserted end to end.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away))::text, true);
  INSERT INTO public.groups (organization_id, name, created_by) VALUES (away, 'Wanderers 492', u2)
  RETURNING id INTO grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u2);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', host))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.organization_guests (organization_id, group_id) VALUES (host, grp);
  RESET ROLE;
  hooked := public.custom_access_token_hook(jsonb_build_object('user_id', u2::text, 'claims', '{}'::jsonb));
  IF NOT (hooked->'claims'->'app_metadata'->'guest_org_ids' @> to_jsonb(host::text)) THEN
    RAISE EXCEPTION 'the hook should mint a group-guest org into the claims, got %',
      hooked->'claims'->'app_metadata'->'guest_org_ids';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '492: a guest views what the organization holds, and touches none of it';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
