-- The Check access panel's questions, answered from the live model.
--
-- "The Check access panel can be used to confirm if a user meets the access
-- requirement for the Project, folder, or file. Displayed under Access
-- requirements, this includes: 1. Satisfying the Organization and Marking
-- requirements. 2. Having one or more roles (directly, via a group, or a
-- default role)." (security/checking-permissions.md)
--
-- "A dataset that inherits Markings through lineage requires access to those
-- Markings to see the dataset's data." — the Additional data requirements
-- half of the same page.

-- Every role a named user holds on a project, with its source — the panel
-- names the granting group ("via a group"). Internal: definer, no broad grant.
CREATE OR REPLACE FUNCTION public.user_project_role_sources(p_project uuid, p_user uuid)
RETURNS TABLE (role text, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.role, 'directly'
    FROM public.project_role_grants g
    JOIN public.users u ON u.id = p_user
   WHERE g.project_id = p_project AND g.user_id = p_user
     AND g.organization_id IS NOT DISTINCT FROM u.organization_id
  UNION ALL
  SELECT g.role, 'via ' || gr.name
    FROM public.project_role_grants g
    JOIN public.groups gr ON gr.id = g.group_id
    JOIN public.users u ON u.id = p_user
   WHERE g.project_id = p_project
     AND g.group_id IN (SELECT public.user_group_ids(p_user))
     AND g.organization_id IS NOT DISTINCT FROM u.organization_id
  UNION ALL
  SELECT p.default_role, 'default role'
    FROM public.projects p
    JOIN public.users u ON u.id = p_user
   WHERE p.id = p_project AND p.default_role IS NOT NULL
     AND p.organization_id IS NOT DISTINCT FROM u.organization_id
$$;
REVOKE EXECUTE ON FUNCTION public.user_project_role_sources(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_project_role_sources(uuid, uuid) TO service_role;

-- The panel itself: verdict per clause, for ANY named user. Checking someone
-- else's permissions is an administrative act; the gate (org admin, or owner
-- on the resource's project) is ours — the page shows the panel, not who may
-- open it.
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
         EXISTS (SELECT 1 FROM public.marking_members mm
                  WHERE mm.marking_id = m.id AND mm.user_id = p_user)
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
         EXISTS (SELECT 1 FROM public.marking_members mm
                  WHERE mm.marking_id = m.id AND mm.user_id = p_user)
    FROM unnest(data_marks) dm(id)
    JOIN public.markings m ON m.id = dm.id
    JOIN public.marking_categories c ON c.id = m.category_id;
END $$;

COMMENT ON FUNCTION public.check_access(text, uuid, uuid) IS
  'The Check access panel: Access requirements (organization, markings, roles with their source) and Additional data requirements (markings inherited through lineage), verdict per clause, for any named user.';

-- The Test policy tab: what would this user see through the view? The claims
-- swap runs the REAL enforcement path for the target user, so the answer
-- cannot drift from what the readers will do.
CREATE OR REPLACE FUNCTION public.test_restricted_view(p_view uuid, p_user uuid)
RETURNS TABLE (visible_rows bigint, total_rows bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record; mb uuid; pred text; before text;
  n_total bigint; n_visible bigint;
BEGIN
  SELECT rv.*, ds.physical_table INTO v
    FROM public.restricted_views rv
    JOIN public.datasets ds ON ds.id = rv.input_dataset_id
   WHERE rv.id = p_view;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Compass:ResourceNotFound — restricted view % does not exist', p_view;
  END IF;
  IF NOT (public.auth_role() IN ('owner', 'admin')
          OR public.role_rank(public.project_role(v.project_id)) >= public.role_rank('owner')) THEN
    RAISE EXCEPTION 'Compass:InsufficientPermissions — testing a policy takes an org admin or the Owner role here';
  END IF;
  IF v.physical_table IS NULL THEN RETURN QUERY SELECT 0::bigint, 0::bigint; RETURN; END IF;

  SELECT b.id INTO mb FROM public.dataset_branches b
   WHERE b.dataset_id = v.input_dataset_id AND b.name = 'master';

  EXECUTE format(
    'SELECT count(*) FROM datasets.%I d
      WHERE d._file IN (SELECT file_id FROM public.dataset_view(%L))',
    v.physical_table, mb) INTO n_total;

  pred := public.granular_policy_sql(v.policy,
    public.dataset_current_fields(v.input_dataset_id), 'd');

  -- Swap the claims to the target user for exactly one count, then restore —
  -- including on failure, so a bad policy cannot leave the session as
  -- somebody else.
  before := current_setting('request.jwt.claims', true);
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_user::text)::text, true);
    EXECUTE format(
      'SELECT count(*) FROM datasets.%I d
        WHERE d._file IN (SELECT file_id FROM public.dataset_view(%L))
          AND %s',
      v.physical_table, mb, pred) INTO n_visible;
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    RAISE;
  END;

  RETURN QUERY SELECT n_visible, n_total;
END $$;

COMMENT ON FUNCTION public.test_restricted_view(uuid, uuid) IS
  'Test policy, as a named user: total rows in the input''s current view versus rows the policy would show them — evaluated through the same compiled predicate the readers use.';

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ds uuid; br uuid; txn uuid; fid uuid; ptbl text;
  rv uuid; grp uuid; cat uuid; mk uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
  n int; r record;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('check-486') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c486a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c486b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'c486a@beacon.test', 'admin', org),
    (u2, 'c486b@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('C486');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'c486', 'C486') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'crew486', 'Crew') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"crew_id","type":"STRING"},{"name":"lead_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'crew.parquet', 3) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, crew_id, lead_id) VALUES
       ($1, ''C1'', $2), ($1, ''C2'', $3), ($1, ''C3'', $3)', ptbl)
  USING fid, u1::text, u2::text;

  -- A role that arrives via a group, and a lineage marking u2 lacks.
  INSERT INTO public.groups (organization_id, name) VALUES (org, 'Crew Leads 486') RETURNING id INTO grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u2);
  INSERT INTO public.project_role_grants (project_id, group_id, role, organization_id)
  VALUES (proj, grp, 'viewer', org);

  RESET ROLE;
  INSERT INTO public.marking_categories (name, category_type, organization_id)
  VALUES ('C486', 'conjunctive', org) RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'Crew PII') RETURNING id INTO mk;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (mk, u1, 'apply');
  -- An upstream dataset carries the marking; crew486 inherits it as data.
  DECLARE up uuid;
  BEGIN
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'crew486_raw', 'Crew raw') RETURNING id INTO up;
    INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (ds, up);
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (mk, 'dataset', up);
  END;
  SET LOCAL ROLE authenticated;

  -- 1. The panel for u2 on the dataset: organization satisfied, the role
  --    satisfied via the named group, the lineage marking not satisfied.
  SELECT count(*) INTO n FROM public.check_access('dataset', ds, u2) c
   WHERE c.section = 'access' AND c.requirement = 'Organization' AND c.satisfied;
  IF n <> 1 THEN RAISE EXCEPTION 'u2 should satisfy the Organization clause'; END IF;
  SELECT * INTO r FROM public.check_access('dataset', ds, u2) c
   WHERE c.requirement LIKE 'Having one or more roles%';
  IF NOT r.satisfied OR r.detail NOT LIKE '%via Crew Leads 486%' THEN
    RAISE EXCEPTION 'the role clause should name the granting group, got %', r.detail;
  END IF;
  SELECT * INTO r FROM public.check_access('dataset', ds, u2) c
   WHERE c.section = 'data' AND c.requirement = 'Marking through lineage: Crew PII';
  IF r.satisfied THEN RAISE EXCEPTION 'u2 does not hold Crew PII yet'; END IF;

  -- 2. Membership flips the verdict.
  RESET ROLE;
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u2);
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM public.check_access('dataset', ds, u2) c
   WHERE c.section = 'data' AND c.requirement = 'Marking through lineage: Crew PII';
  IF NOT r.satisfied THEN RAISE EXCEPTION 'membership should satisfy the lineage marking'; END IF;

  -- 3. Test policy, as each user, through the real predicate.
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'crew_by_lead486', 'Crew by lead', '{"match":"all","rules":[
    {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"lead_id"}}]}')
  RETURNING id INTO rv;
  SELECT * INTO r FROM public.test_restricted_view(rv, u2);
  IF r.visible_rows <> 2 OR r.total_rows <> 3 THEN
    RAISE EXCEPTION 'u2 should test 2 of 3 rows, got % of %', r.visible_rows, r.total_rows;
  END IF;
  SELECT * INTO r FROM public.test_restricted_view(rv, u1);
  IF r.visible_rows <> 1 THEN RAISE EXCEPTION 'u1 should test 1 row, got %', r.visible_rows; END IF;

  -- 4. The caller's own claims survive the swap.
  IF (current_setting('request.jwt.claims', true)::jsonb->>'sub') <> u1::text THEN
    RAISE EXCEPTION 'the claims swap leaked';
  END IF;

  -- 5. A caller with no standing is refused.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  BEGIN
    PERFORM public.check_access('dataset', ds, u1);
    RAISE EXCEPTION 'a viewer opened the Check access panel for someone else';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:InsufficientPermissions%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '486: Check access answers for any user, and Test policy runs the real predicate';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
