-- The Request-access dialog's one read call, 652's pattern, from the
-- request-access-to-a-project reading (Decisions 1-2, operator-approved).
--
--   "Users can submit access requests for Projects they are not authorized to access. The access request will include all changes required to give the user access to a Project, including any required [Markings](/docs/foundry/security/markings/)."
--   — security/projects-and-roles.md
--
-- Composing that request needs three things the client cannot uniformly read
-- under RLS: which groups hold roles on the project (the page's recommended
-- path — "users can select to get access to a group with an appropriate role
-- on the Project"), which markings the project carries and whether the caller
-- already holds them, and the caller's current role (it decides between the
-- page's Request access and Request additional access labels). DEFINER,
-- gated on the caller's organization — the same discovery surface the
-- listing already is, which is the finding this reading closed.

CREATE FUNCTION public.project_access_options(p_project uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_org uuid; v_name text;
BEGIN
  SELECT p.organization_id, p.name INTO v_org, v_name
    FROM public.projects p WHERE p.id = p_project;
  IF v_org IS NULL OR NOT public.auth_in_org(v_org) THEN
    RAISE EXCEPTION 'Projects:NotFound — % is not a project you can see', p_project;
  END IF;
  RETURN jsonb_build_object(
    'project', v_name,
    'my_role', nullif(public.project_role(p_project), ''),
    'groups', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'role', pr.role) ORDER BY g.name), '[]'::jsonb)
      FROM public.project_role_grants pr
      JOIN public.groups g ON g.id = pr.group_id
     WHERE pr.project_id = p_project AND pr.group_id IS NOT NULL),
    'markings', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name,
        'member', EXISTS (SELECT 1 FROM public.marking_members mm
                           WHERE mm.marking_id = m.id
                             AND (mm.user_id = auth.uid()
                                  OR mm.group_id = ANY (coalesce(public.auth_group_ids(), '{}'))))
      ) ORDER BY m.name), '[]'::jsonb)
      FROM public.resource_markings rm
      JOIN public.markings m ON m.id = rm.marking_id
     WHERE rm.resource_kind = 'project' AND rm.resource_id = p_project));
END $$;

COMMENT ON FUNCTION public.project_access_options(uuid) IS
  'What the Request-access dialog composes from (security/projects-and-roles): the groups holding roles on the project, the project''s markings with the caller''s membership, and the caller''s current role. Organization-gated — the discovery surface the request flow requires.';

-- Executed both ways: a role-less caller sees the group and the marking they
-- lack; marking membership flips the flag; another organization refuses.
DO $$
DECLARE
  v_org uuid; v_org2 uuid; v_sp uuid; v_admin uuid; v_usr uuid; v_email text;
  v_proj uuid; v_grp uuid; v_mc uuid; v_mk uuid; v_x jsonb; v_ok boolean; v_n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe653') RETURNING id INTO v_org;
    INSERT INTO public.organizations (name) VALUES ('probe653b') RETURNING id INTO v_org2;
    INSERT INTO public.spaces (name) VALUES ('probe653') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe653', 'Probe653') RETURNING id INTO v_proj;
    FOR v_n IN 1..2 LOOP
      v_usr := gen_random_uuid();
      v_email := 'probe653-' || v_n || '-' || v_usr || '@beacon.test';
      INSERT INTO auth.users (id, instance_id, aud, role, email)
        VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
      INSERT INTO public.users (id, email, role, organization_id)
        VALUES (v_usr, v_email, 'admin', v_org);
      IF v_n = 1 THEN v_admin := v_usr; END IF;
    END LOOP;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe653 viewers', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.project_role_grants (project_id, group_id, role, organization_id)
      VALUES (v_proj, v_grp, 'viewer', v_org);
    INSERT INTO public.marking_categories (organization_id, name, category_type, visibility)
      VALUES (v_org, 'Probe653', 'conjunctive', 'visible') RETURNING id INTO v_mc;
    INSERT INTO public.markings (category_id, name)
      VALUES (v_mc, 'Probe653 PII') RETURNING id INTO v_mk;
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
      VALUES (v_mk, v_admin, 'apply');
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
      VALUES (v_mk, 'project', v_proj);

    -- the role-less caller: no role, the group with its role, the marking unheld
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    v_x := public.project_access_options(v_proj);
    IF v_x ->> 'my_role' IS NOT NULL THEN
      RAISE EXCEPTION 'a role-less caller has role %', v_x ->> 'my_role';
    END IF;
    IF v_x -> 'groups' -> 0 ->> 'name' <> 'Probe653 viewers'
       OR v_x -> 'groups' -> 0 ->> 'role' <> 'viewer' THEN
      RAISE EXCEPTION 'the granted group did not list: %', v_x -> 'groups';
    END IF;
    IF (v_x -> 'markings' -> 0 ->> 'member')::boolean IS NOT FALSE THEN
      RAISE EXCEPTION 'an unheld marking read as held';
    END IF;

    -- membership flips the flag
    INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_mk, v_usr);
    v_x := public.project_access_options(v_proj);
    IF (v_x -> 'markings' -> 0 ->> 'member')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'a held marking read as unheld';
    END IF;

    -- another organization refuses
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org2))::text, true);
    v_ok := false;
    BEGIN
      PERFORM public.project_access_options(v_proj);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%Projects:NotFound%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'another organization saw the options'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '653 proved: the role-less caller sees the granted group and the unheld marking, membership flips the flag, and another organization refuses';
  END;
END $$;
