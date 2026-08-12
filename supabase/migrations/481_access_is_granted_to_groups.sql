-- Groups, the missing grant target.
--
-- "Group: A set of users and/or other groups. A group may be internal, meaning
-- defined in Foundry, or external, meaning defined by an external identity
-- provider (like Active Directory) or user manager. Internal groups may contain
-- external groups and users." (security/security-glossary.md)
--
-- "Access to Projects and resources are usually granted to groups rather than
-- individual users." (security/users-and-groups.md)
--
-- S1 builds the internal realm only: external and rule-based groups need an
-- identity provider we do not have. The error namespace is Multipass,
-- Foundry's identity service — its administration API lives under
-- /multipass/api/ (platform-security-management/manage-users.md).

-- ── the group ───────────────────────────────────────────────────────────────
-- "Group ID: The permanent, unique ID of the group."
-- "Group type: The type of group; external, internal, or rule based."
-- "Organizations: Defines the members of Organizations who can see this group
-- and its description." (platform-security-management/manage-groups.md)
-- Foundry's Organizations field is plural; ours holds one, the same narrowing
-- every resource here has.
CREATE TABLE public.groups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  group_type        text NOT NULL DEFAULT 'internal' CHECK (group_type = 'internal'),
  -- "Latest expiration: All new memberships must have an expiration date that
  -- is earlier than this date." (manage-groups.md)
  latest_expiration timestamptz,
  -- "Maximum duration: All new memberships must expire within the specified
  -- duration." (manage-groups.md)
  max_duration      interval,
  created_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
COMMENT ON TABLE public.groups IS
  'Internal realm groups: a set of users and/or other groups, the usual grant target for project roles.';
CREATE INDEX groups_organization_idx ON public.groups (organization_id);

CREATE OR REPLACE FUNCTION public.guard_group_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Multipass:GroupIdPermanent — a group ID is permanent';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_group_update BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.guard_group_update();

-- ── the two administrative permissions ──────────────────────────────────────
-- "Group permissions: Defines users with permissions to manage aspects of the
-- group. There are two types of administrative permissions:"
-- "Manage permissions: Users who can grant permissions to manage aspects of
-- the group, manage its members, and edit its metadata."
-- "Manage membership: Users who can manage the group's members, including
-- membership expiration properties." (manage-groups.md)
CREATE TABLE public.group_permissions (
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('manage_permissions', 'manage_membership')),
  granted_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id, permission)
);

-- The creator can manage what they created — without this bootstrap a fresh
-- group would be manageable by nobody but org admins. Definer, because the
-- creator does not yet hold the permission the write policy asks for.
CREATE OR REPLACE FUNCTION public.seed_group_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.group_permissions (group_id, user_id, permission, granted_by)
    VALUES (NEW.id, NEW.created_by, 'manage_permissions', NEW.created_by),
           (NEW.id, NEW.created_by, 'manage_membership', NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_seed_group_creator AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.seed_group_creator();

-- Read by its own table's policies, so it must not itself be subject to them:
-- definer breaks the recursion a policy may not have.
CREATE OR REPLACE FUNCTION public.has_group_permission(p_group uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_permissions
     WHERE group_id = p_group AND user_id = auth.uid() AND permission = p_permission)
$$;

-- ── membership ──────────────────────────────────────────────────────────────
-- "Members: Users who are members of this group. These can be individual users
-- or groups." (manage-groups.md)
CREATE TABLE public.group_members (
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  member_group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  -- Honored at evaluation: an expired row grants nothing, no sweeper needed.
  expires_at      timestamptz,
  added_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(member_user_id, member_group_id) = 1),
  UNIQUE (group_id, member_user_id),
  UNIQUE (group_id, member_group_id)
);
CREATE INDEX group_members_user_idx  ON public.group_members (member_user_id);
CREATE INDEX group_members_group_idx ON public.group_members (member_group_id);

-- "If you can Manage membership on a given group, you can mandate that new
-- memberships to the group are temporary." When both bounds are set, "the
-- latest allowed expiration will be the most constraining property of the
-- two". (manage-groups.md) Definer so the cycle walk sees the whole graph,
-- not the caller's visible slice of it.
CREATE OR REPLACE FUNCTION public.guard_group_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.groups;
BEGIN
  SELECT * INTO g FROM public.groups WHERE id = NEW.group_id;

  IF (g.latest_expiration IS NOT NULL OR g.max_duration IS NOT NULL)
     AND NEW.expires_at IS NULL THEN
    RAISE EXCEPTION 'Multipass:MembershipMustExpire — this group mandates temporary membership';
  END IF;
  -- "earlier than this date": the bound itself is not a legal expiration.
  IF g.latest_expiration IS NOT NULL AND NEW.expires_at >= g.latest_expiration THEN
    RAISE EXCEPTION 'Multipass:MembershipOutlivesBound — memberships must expire before %', g.latest_expiration;
  END IF;
  IF g.max_duration IS NOT NULL AND NEW.expires_at > now() + g.max_duration THEN
    RAISE EXCEPTION 'Multipass:MembershipOutlivesBound — memberships must expire within %', g.max_duration;
  END IF;

  -- A group reachable from its own members is no hierarchy at all.
  IF NEW.member_group_id IS NOT NULL THEN
    IF NEW.member_group_id = NEW.group_id OR EXISTS (
      WITH RECURSIVE down AS (
        SELECT NEW.member_group_id AS gid
        UNION
        SELECT m.member_group_id FROM public.group_members m
          JOIN down d ON m.group_id = d.gid
         WHERE m.member_group_id IS NOT NULL
      )
      SELECT 1 FROM down WHERE gid = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'Multipass:GroupCycle — the member group already contains this group';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_group_member BEFORE INSERT OR UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.guard_group_member();

-- ── the transitive closure ──────────────────────────────────────────────────
-- Direct memberships, then every group that contains one the user is already
-- in. Expiration is checked here, at evaluation, on every hop.
CREATE OR REPLACE FUNCTION public.user_group_ids(p_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT m.group_id FROM group_members m
     WHERE m.member_user_id = p_user
       AND (m.expires_at IS NULL OR m.expires_at > now())
    UNION
    SELECT m.group_id FROM group_members m
      JOIN up u ON m.member_group_id = u.group_id
     WHERE m.expires_at IS NULL OR m.expires_at > now()
  )
  SELECT group_id FROM up
$$;
-- Membership of an arbitrary user is an administrative question.
REVOKE EXECUTE ON FUNCTION public.user_group_ids(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_group_ids(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.auth_group_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(gid), '{}') FROM public.user_group_ids(auth.uid()) gid
$$;

-- ── a grant names a user or a group ─────────────────────────────────────────
ALTER TABLE public.project_role_grants
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.project_role_grants DROP CONSTRAINT project_role_grants_pkey;
ALTER TABLE public.project_role_grants ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.project_role_grants ADD PRIMARY KEY (id);
ALTER TABLE public.project_role_grants
  ADD CONSTRAINT project_role_grants_one_principal CHECK (num_nonnulls(user_id, group_id) = 1);
-- Full constraints, not partial indexes: PostgREST's upsert infers its
-- conflict target from these, and NULLS DISTINCT keeps the other principal
-- kind out of each one's way.
ALTER TABLE public.project_role_grants
  ADD CONSTRAINT project_role_grants_user_key UNIQUE (project_id, user_id),
  ADD CONSTRAINT project_role_grants_group_key UNIQUE (project_id, group_id);
CREATE INDEX project_role_grants_group_idx ON public.project_role_grants (group_id);

-- ── project_role folds group grants ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.project_role(p_project uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT r.role
    FROM (
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.user_id = auth.uid()
         -- The mandatory control, restated where it is easiest to remove by
         -- accident: a grant in another organization is not a grant.
         AND g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      UNION ALL
      -- "Access to Projects and resources are usually granted to groups
      -- rather than individual users." (security/users-and-groups.md)
      -- Same mandatory test.
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.group_id = ANY (public.auth_group_ids())
         AND g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      UNION ALL
      -- "Everyone from <org> … is granted the <role> role." Same test: the
      -- default reaches the project's own organization and no other.
      SELECT p.default_role
        FROM public.projects p
       WHERE p.id = p_project
         AND p.default_role IS NOT NULL
         AND p.organization_id IS NOT DISTINCT FROM public.auth_org_id()
    ) r
   ORDER BY public.role_rank(r.role) DESC
   LIMIT 1
$$;

-- ── visibility and management ───────────────────────────────────────────────
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_permissions ENABLE ROW LEVEL SECURITY;

-- "Organizations: Defines the members of Organizations who can see this group
-- and its description."
CREATE POLICY "org members see groups" ON public.groups FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

-- Creation is a settings-page act: org admins bootstrap, then the two group
-- permissions take over.
CREATE POLICY "admins create groups" ON public.groups FOR INSERT
  WITH CHECK (public.auth_role() IN ('owner', 'admin')
              AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

-- Metadata edits belong to Manage permissions; the expiration bounds also to
-- Manage membership. Which columns each may touch is finer than a row policy;
-- the row opens to either.
CREATE POLICY "managers update groups" ON public.groups FOR UPDATE
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.has_group_permission(id, 'manage_permissions')
              OR public.has_group_permission(id, 'manage_membership')))
  WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

CREATE POLICY "permission holders delete groups" ON public.groups FOR DELETE
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.has_group_permission(id, 'manage_permissions')));

CREATE POLICY "org members see membership" ON public.group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.groups g
                  WHERE g.id = group_id
                    AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id())));

-- Both permissions may manage members: "Manage permissions: … manage its
-- members"; "Manage membership: Users who can manage the group's members".
CREATE POLICY "managers write membership" ON public.group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.groups g
                  WHERE g.id = group_id
                    AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id()))
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.has_group_permission(group_id, 'manage_permissions')
              OR public.has_group_permission(group_id, 'manage_membership')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g
                       WHERE g.id = group_id
                         AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id()))
              AND (public.auth_role() IN ('owner', 'admin')
                   OR public.has_group_permission(group_id, 'manage_permissions')
                   OR public.has_group_permission(group_id, 'manage_membership')));

CREATE POLICY "org members see group permissions" ON public.group_permissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.groups g
                  WHERE g.id = group_id
                    AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id())));

-- "Manage permissions: Users who can grant permissions to manage aspects of
-- the group"
CREATE POLICY "permission managers grant" ON public.group_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.groups g
                  WHERE g.id = group_id
                    AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id()))
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.has_group_permission(group_id, 'manage_permissions')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g
                       WHERE g.id = group_id
                         AND NOT (g.organization_id IS DISTINCT FROM public.auth_org_id()))
              AND (public.auth_role() IN ('owner', 'admin')
                   OR public.has_group_permission(group_id, 'manage_permissions')));

-- ── assertions: a nested grant reaches, an expired one does not ─────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ga uuid; gb uuid; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('groups-481') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g481a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g481b@beacon.test'),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g481c@beacon.test');
  -- users_role_check admits owner/admin only; the others live in claims alone.
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'g481a@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('G481');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'g481', 'G481') RETURNING id INTO proj;

  -- 1. The creator is seeded with both permissions.
  INSERT INTO public.groups (organization_id, name) VALUES (org, 'Flight Ops') RETURNING id INTO ga;
  INSERT INTO public.groups (organization_id, name) VALUES (org, 'Ops Leads') RETURNING id INTO gb;
  SELECT count(*) INTO n FROM public.group_permissions WHERE group_id = ga AND user_id = u1;
  IF n <> 2 THEN RAISE EXCEPTION 'creator seeding expected 2 permissions, got %', n; END IF;

  -- 2. A role granted to a group reaches a member of a nested group.
  INSERT INTO public.group_members (group_id, member_group_id) VALUES (ga, gb);
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (gb, u2);
  INSERT INTO public.project_role_grants (project_id, group_id, role, organization_id)
  VALUES (proj, ga, 'editor', org);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
  IF public.project_role(proj) IS DISTINCT FROM 'editor' THEN
    RAISE EXCEPTION 'a nested member should read editor via the group, got %',
      coalesce(public.project_role(proj), 'nothing');
  END IF;

  -- 3. An expired membership grants nothing.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.group_members SET expires_at = now() - interval '1 minute'
   WHERE group_id = gb AND member_user_id = u2;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
  IF public.project_role(proj) IS NOT NULL THEN
    RAISE EXCEPTION 'an expired membership still granted %', public.project_role(proj);
  END IF;

  -- 4. A cycle refuses. (Before the bounds go on: the bounds check fires
  --    first in the guard and would mask the cycle refusal.)
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  BEGIN
    INSERT INTO public.group_members (group_id, member_group_id) VALUES (gb, ga);
    RAISE EXCEPTION 'a membership cycle was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Multipass:GroupCycle%' THEN RAISE; END IF;
  END;

  -- 5. The bounds: no expiration refused, an expiration past the most
  --    constraining bound refused, one within both accepted.
  UPDATE public.groups
     SET latest_expiration = now() + interval '1 day', max_duration = interval '1 hour'
   WHERE id = gb;
  BEGIN
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (gb, u3);
    RAISE EXCEPTION 'a bounded group accepted a permanent membership';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Multipass:MembershipMustExpire%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.group_members (group_id, member_user_id, expires_at)
    VALUES (gb, u3, now() + interval '2 hours');
    RAISE EXCEPTION 'the most constraining bound did not constrain';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Multipass:MembershipOutlivesBound%' THEN RAISE; END IF;
  END;
  INSERT INTO public.group_members (group_id, member_user_id, expires_at)
  VALUES (gb, u3, now() + interval '30 minutes');

  -- 6. A grant names exactly one principal.
  BEGIN
    INSERT INTO public.project_role_grants (project_id, user_id, group_id, role, organization_id)
    VALUES (proj, u3, ga, 'viewer', org);
    RAISE EXCEPTION 'a grant accepted two principals';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%one_principal%' THEN RAISE; END IF;
  END;

  -- 7. The group ID is permanent.
  BEGIN
    UPDATE public.groups SET id = gen_random_uuid() WHERE id = gb;
    RAISE EXCEPTION 'a group ID changed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Multipass:GroupIdPermanent%' THEN RAISE; END IF;
  END;

  -- 8. The web's upsert conflict targets still infer, for either principal.
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u2, 'viewer', org)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u2, 'discoverer', org)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role;
  INSERT INTO public.project_role_grants (project_id, group_id, role, organization_id)
  VALUES (proj, ga, 'viewer', org)
  ON CONFLICT (project_id, group_id) DO UPDATE SET role = excluded.role;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '481: access is granted to groups, and membership expires on the clock';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
