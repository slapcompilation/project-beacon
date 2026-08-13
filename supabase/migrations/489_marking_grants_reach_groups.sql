-- Marking grants reach groups, the way the page says and 399 anticipated.
--
-- "When you create a new Marking, you can add users and groups with different
-- levels of access and permissions:"
-- "If Marking permissions are granted to a group, then a new user to the
-- group will inherit those permissions."
-- (platform-security-management/manage-markings.md)
--
-- 399 wrote it into the table itself: "A principal is a user today. Foundry
-- grants to 'a user or group' everywhere, and groups do not exist here yet;
-- when they do, this becomes a principal ref rather than a second table."
-- Groups exist since 481. This is that change, on both tables, with the
-- transitive closure folded in at two primitives so no consumer restates it.

-- ── the principal pair, 481's shape on both tables ──────────────────────────
ALTER TABLE public.marking_members
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.marking_members DROP CONSTRAINT marking_members_pkey;
ALTER TABLE public.marking_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.marking_members ADD PRIMARY KEY (id);
ALTER TABLE public.marking_members
  ADD CONSTRAINT marking_members_one_principal CHECK (num_nonnulls(user_id, group_id) = 1),
  ADD CONSTRAINT marking_members_user_key UNIQUE (marking_id, user_id),
  ADD CONSTRAINT marking_members_group_key UNIQUE (marking_id, group_id);
CREATE INDEX marking_members_group_idx ON public.marking_members (group_id);

ALTER TABLE public.marking_permissions
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.marking_permissions DROP CONSTRAINT marking_permissions_pkey;
ALTER TABLE public.marking_permissions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.marking_permissions ADD PRIMARY KEY (id);
ALTER TABLE public.marking_permissions
  ADD CONSTRAINT marking_permissions_one_principal CHECK (num_nonnulls(user_id, group_id) = 1),
  ADD CONSTRAINT marking_permissions_user_key UNIQUE (marking_id, user_id, permission),
  ADD CONSTRAINT marking_permissions_group_key UNIQUE (marking_id, group_id, permission);
CREATE INDEX marking_permissions_group_idx ON public.marking_permissions (group_id);

-- ── the two primitives every consumer composes ──────────────────────────────
-- "a new user to the group will inherit those permissions" — inheritance is
-- the group closure, evaluated per call so membership expiration holds here
-- too. Definer: these run inside policies and guards.
CREATE OR REPLACE FUNCTION public.marking_member(p_marking uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_members mm
     WHERE mm.marking_id = p_marking
       AND (mm.user_id = p_user
            OR mm.group_id IN (SELECT public.user_group_ids(p_user))))
$$;

-- p_permission NULL asks for any permission at all — what category
-- visibility wants.
CREATE OR REPLACE FUNCTION public.holds_marking_permission(p_marking uuid, p_user uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_permissions p
     WHERE p.marking_id = p_marking
       AND (p_permission IS NULL OR p.permission = p_permission)
       AND (p.user_id = p_user
            OR p.group_id IN (SELECT public.user_group_ids(p_user))))
$$;

-- ── every consumer, restated to compose ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_marking_ids()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT m.marking_id::text), '{}')
    FROM public.marking_members m
   WHERE m.user_id = auth.uid()
      OR m.group_id = ANY (public.auth_group_ids())
$$;

CREATE OR REPLACE FUNCTION public.can_apply_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.holds_marking_permission(p_marking, auth.uid(), 'apply')
$$;

CREATE OR REPLACE FUNCTION public.can_remove_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.holds_marking_permission(p_marking, auth.uid(), 'remove')
$$;

CREATE OR REPLACE FUNCTION public.can_manage_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT public.holds_marking_permission(p_marking, auth.uid(), 'manage')
$$;

CREATE OR REPLACE FUNCTION public.can_choose_scoped_session(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scoped_sessions s
                  WHERE s.id = p_session
                    AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id())
     AND NOT EXISTS (
       SELECT 1 FROM public.scoped_session_markings sm
        WHERE sm.scoped_session_id = p_session
          AND NOT public.marking_member(sm.marking_id, auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.can_see_marking_category(p_category uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_categories c
     WHERE c.id = p_category
       AND (c.organization_id IS NULL
            OR c.organization_id IS NOT DISTINCT FROM public.auth_org_id())
       AND (c.visibility = 'visible'
            OR EXISTS (SELECT 1 FROM public.markings m
                        WHERE m.category_id = c.id
                          AND public.marking_member(m.id, auth.uid()))
            OR EXISTS (SELECT 1 FROM public.markings m
                        WHERE m.category_id = c.id
                          AND public.holds_marking_permission(m.id, auth.uid(), NULL))
            -- "explicitly been granted Category Viewer permissions" — and an
            -- administrator sees what it administers.
            OR EXISTS (SELECT 1 FROM public.marking_category_permissions cp
                       WHERE cp.category_id = c.id AND cp.user_id = auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public.satisfies_markings(p_markings uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p_markings, '{}'::uuid[])) AS m(id)
     WHERE NOT public.marking_member(m.id, auth.uid()))
$$;

-- "To remove a Marking, a user must also be able to apply the Marking" —
-- per principal: a user's effective apply may arrive through a group; a
-- group's must be its own.
CREATE OR REPLACE FUNCTION public.guard_remove_implies_apply()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.permission = 'remove' THEN
    IF NEW.user_id IS NOT NULL
       AND NOT public.holds_marking_permission(NEW.marking_id, NEW.user_id, 'apply') THEN
      RAISE EXCEPTION 'Markings:RemoveRequiresApply — "To remove a Marking, a user must also be able to apply the Marking"';
    END IF;
    IF NEW.group_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.marking_permissions p
       WHERE p.marking_id = NEW.marking_id AND p.group_id = NEW.group_id AND p.permission = 'apply') THEN
      RAISE EXCEPTION 'Markings:RemoveRequiresApply — "To remove a Marking, a user must also be able to apply the Marking"';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_rv_marking_stop()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.holds_marking_permission(NEW.marking_id, auth.uid(), 'remove') THEN
    RAISE EXCEPTION 'Markings:CannotRemove — un-marking the restricted view takes the remove permission on that marking';
  END IF;
  RETURN NEW;
END $$;

-- check_access (486): the two membership clauses now answer through the
-- closure, so a lineage marking held via a group reads as satisfied.
CREATE OR REPLACE FUNCTION public.check_access(p_kind text, p_id uuid, p_user uuid)
RETURNS TABLE (section text, requirement text, detail text, satisfied boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  res_project uuid; res_org uuid; file_marks uuid[]; data_marks uuid[];
  target_org uuid; roles text;
BEGIN
  IF p_kind = 'project' THEN
    SELECT p.id, p.organization_id INTO res_project, res_org FROM public.projects p WHERE p.id = p_id;
    file_marks := public.effective_file_markings('project', p_id);
    data_marks := '{}';
  ELSIF p_kind = 'dataset' THEN
    SELECT d.project_id, d.organization_id INTO res_project, res_org FROM public.datasets d WHERE d.id = p_id;
    file_marks := public.effective_file_markings('dataset', p_id);
    data_marks := public.effective_data_markings(p_id);
  ELSIF p_kind = 'restricted_view' THEN
    SELECT v.project_id, v.organization_id INTO res_project, res_org FROM public.restricted_views v WHERE v.id = p_id;
    file_marks := '{}';
    -- The view's markings arrive through its input's lineage, minus severs.
    data_marks := public.restricted_view_markings(p_id);
  ELSE
    RAISE EXCEPTION 'Compass:UnknownResourceKind — % has no Check access panel', p_kind;
  END IF;
  IF res_org IS NULL THEN
    RAISE EXCEPTION 'Compass:ResourceNotFound — % % does not exist', p_kind, p_id;
  END IF;

  IF NOT (public.auth_role() IN ('owner', 'admin')
          OR public.role_rank(public.project_role(res_project)) >= public.role_rank('owner')) THEN
    RAISE EXCEPTION 'Compass:InsufficientPermissions — checking access takes an org admin or the Owner role here';
  END IF;

  SELECT u.organization_id INTO target_org FROM public.users u WHERE u.id = p_user;

  -- 1. "Satisfying the Organization … requirements."
  RETURN QUERY
  SELECT 'access', 'Organization',
         (SELECT o.name FROM public.organizations o WHERE o.id = res_org),
         target_org IS NOT DISTINCT FROM res_org;

  -- 1b. "… and Marking requirements."
  RETURN QUERY
  SELECT 'access', 'Marking: ' || m.name, c.name,
         public.marking_member(m.id, p_user)
    FROM unnest(file_marks) fm(id)
    JOIN public.markings m ON m.id = fm.id
    JOIN public.marking_categories c ON c.id = m.category_id;

  -- 2. "Having one or more roles (directly, via a group, or a default role)."
  SELECT string_agg(s.role || ' (' || s.source || ')', ', ') INTO roles
    FROM public.user_project_role_sources(res_project, p_user) s;
  RETURN QUERY
  SELECT 'access', 'Having one or more roles (directly, via a group, or a default role)',
         COALESCE(roles, 'No role on ' ||
           COALESCE((SELECT p.name FROM public.projects p WHERE p.id = res_project), 'the project')),
         roles IS NOT NULL;

  -- "A dataset that inherits Markings through lineage requires access to
  -- those Markings to see the dataset's data."
  RETURN QUERY
  SELECT 'data', 'Marking through lineage: ' || m.name, c.name,
         public.marking_member(m.id, p_user)
    FROM unnest(data_marks) dm(id)
    JOIN public.markings m ON m.id = dm.id
    JOIN public.marking_categories c ON c.id = m.category_id;
END $$;

-- ── visibility of the new principal rows ────────────────────────────────────
DROP POLICY "see own membership" ON public.marking_members;
CREATE POLICY "see own membership" ON public.marking_members FOR SELECT
  USING (user_id = auth.uid()
         OR group_id = ANY (public.auth_group_ids())
         OR public.auth_role() = ANY (ARRAY['owner', 'admin']));
DROP POLICY "see own permissions" ON public.marking_permissions;
CREATE POLICY "see own permissions" ON public.marking_permissions FOR SELECT
  USING (user_id = auth.uid()
         OR group_id = ANY (public.auth_group_ids())
         OR public.auth_role() = ANY (ARRAY['owner', 'admin']));

-- ── assertions: inheritance through the group, expiration included ──────────
DO $$
DECLARE
  org uuid; grp uuid; cat uuid; mk uuid; mk2 uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('mgroups-489') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mg489a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mg489b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'mg489a@beacon.test', 'admin', org),
    (u2, 'mg489b@beacon.test', 'admin', org);
  -- The category seeds its creator as administrator from the claims, so u1
  -- must be the caller before the category exists.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.groups (organization_id, name, created_by) VALUES (org, 'Cleared 489', u1)
  RETURNING id INTO grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u2);
  INSERT INTO public.marking_categories (name, category_type, organization_id)
  VALUES ('MG489', 'conjunctive', org) RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'MG489 Secret') RETURNING id INTO mk;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'MG489 Second') RETURNING id INTO mk2;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  -- 1. Membership arrives through the group, and leaves with expiration.
  IF public.satisfies_markings(ARRAY[mk]) THEN
    RAISE EXCEPTION 'u2 satisfies a marking nobody granted';
  END IF;
  INSERT INTO public.marking_members (marking_id, group_id) VALUES (mk, grp);
  IF NOT public.satisfies_markings(ARRAY[mk]) THEN
    RAISE EXCEPTION 'group membership should satisfy the marking';
  END IF;
  IF NOT (public.auth_marking_ids() @> ARRAY[mk::text]) THEN
    RAISE EXCEPTION 'auth_marking_ids should carry the group-granted marking';
  END IF;
  UPDATE public.group_members SET expires_at = now() - interval '1 minute'
   WHERE group_id = grp AND member_user_id = u2;
  IF public.satisfies_markings(ARRAY[mk]) THEN
    RAISE EXCEPTION 'an expired group membership still satisfies the marking';
  END IF;
  UPDATE public.group_members SET expires_at = NULL
   WHERE group_id = grp AND member_user_id = u2;

  -- 2. "If Marking permissions are granted to a group, then a new user to
  --    the group will inherit those permissions."
  INSERT INTO public.marking_permissions (marking_id, group_id, permission) VALUES (mk, grp, 'apply');
  IF NOT public.can_apply_marking(mk) THEN
    RAISE EXCEPTION 'a group-granted apply permission did not reach the member';
  END IF;

  -- 3. Remove still implies apply, per principal.
  BEGIN
    INSERT INTO public.marking_permissions (marking_id, group_id, permission) VALUES (mk2, grp, 'remove');
    RAISE EXCEPTION 'a group took remove without apply';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Markings:RemoveRequiresApply%' THEN RAISE; END IF;
  END;
  INSERT INTO public.marking_permissions (marking_id, group_id, permission) VALUES (mk2, grp, 'apply');
  INSERT INTO public.marking_permissions (marking_id, group_id, permission) VALUES (mk2, grp, 'remove');
  IF NOT public.can_remove_marking(mk2) THEN
    RAISE EXCEPTION 'the group-granted remove did not reach the member';
  END IF;

  -- 4. One principal per row.
  BEGIN
    INSERT INTO public.marking_members (marking_id, user_id, group_id) VALUES (mk, u2, grp);
    RAISE EXCEPTION 'a membership row accepted two principals';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%one_principal%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '489: marking grants reach groups, and a new user to the group inherits them';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
