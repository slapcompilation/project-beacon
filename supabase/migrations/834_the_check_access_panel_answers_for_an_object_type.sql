-- The Check access panel answers for an object type.
--
-- `check_access` handled project, dataset and restricted_view and REFUSED
-- everything else by name — `Compass:UnknownResourceKind — % has no Check access
-- panel`. An object type is a file in a project, so that refusal was wrong.
--
-- THE PANEL'S SCOPE IS THE FIRST SENTENCE OF ITS OWN PAGE:
--
--   "You can check someone's permissions on a Project, folder, or file by using the **Check access** panel in the workspace sidebar or the Data Lineage tool."
--   — security/checking-permissions.md
--
-- And an object type IS a file: ontology resources are "saved into a project",
-- `ontology-in-project.png` shows them as peer rows of a dataset, and the object
-- security page names the object type as something the panel already reaches:
--
--   "The **Check access** panel in the sidebar can be used to check someone's access to a Workshop or Slate application, including access to dependent object types, their data sources, and granular access controls."
--   — object-permissioning/managing-object-security.md
--
-- That sentence also enumerates what an object type's answer must cover: the
-- object type, ITS DATA SOURCES, and the granular access controls.
--
-- THE TWO SECTIONS ARE PUBLISHED, and this migration fills both for a new kind:
--
--   "The **Check access** panel can be used to confirm if a user meets the access requirement for the Project, folder, or file. Displayed under **Access requirements**, this includes:"
--   — security/checking-permissions.md
--
-- with the numbered pair the function already emits as its `access` section, and
-- then the second half, which is where the datasources belong:
--
--   "In addition to the access requirements described above, certain files may require additional permissions, which are listed under **Additional data requirements**."
--   — security/checking-permissions.md
--
-- The page gives two examples of that second section, and the second one is this
-- migration's whole design:
--
--   "A Workshop module that displays a table of objects requires access to the object type & its datasources."
--   — security/checking-permissions.md
--
-- WHY THE ANSWER IS MARKINGS AND NOT A BOOLEAN PER DATASOURCE. 833 built
-- `datasource_readable`, which is the obvious thing to call here and is the wrong
-- thing: it answers for the CALLER, through `auth.uid()`, while this function
-- answers for `p_user`. Calling it would have reported the administrator's own
-- access under someone else's name — a defect that would look right in every
-- screenshot taken by the person who has access. The existing dataset branch
-- already shows the honest decomposition, and the page states it:
--
--   "A dataset that inherits Markings through lineage requires access to those Markings to see the dataset's data."
--   — security/checking-permissions.md
--
-- So the data section lists MARKINGS, each decided by `marking_member(m, p_user)`,
-- which is per-user by construction.
--
-- AND IT FOLLOWS 833's EITHER/OR. With no policy the requirement is the
-- datasources' markings; with a policy configured the datasource requirement is
-- lifted and the POLICY's markings are what remain:
--
--   "When an object or property security policy is configured, users do not need `Viewer` permissions to the object type's backing data sources to view object instances."
--   — object-permissioning/object-security-policies.md
--
-- WHAT IS DELIBERATELY NOT A ROW: the granular arm of a policy. It is a predicate
-- over a ROW's property values, so it has no per-user answer without naming an
-- instance, and a dot that claimed one would be a lie in the shape of a fact.
-- The markings arm is the decidable half and is the half reported.
--
-- An object type's organizations are a SET, unlike every kind already handled —
-- `auth_in_ontology` admits a caller whose organization is ANY of the ontology
-- space's — so the Organization row is emitted per-kind rather than shared.

DO $patch$
DECLARE src text; out text; prev text;
BEGIN
  src := pg_get_functiondef('public.check_access(text,uuid,uuid)'::regprocedure);
  IF src LIKE '%object_type%' THEN
    RAISE EXCEPTION 'PATCH FAILED: check_access already mentions object_type';
  END IF;

  -- 1. Two locals: the space's organizations, and whether a policy governs.
  prev := src;
  src := replace(src, '  target_org uuid; roles text;',
                      '  target_org uuid; roles text; ot_orgs uuid[]; has_policy boolean := false;');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the DECLARE anchor did not match'; END IF;

  -- 2. The new branch, ahead of the refusal that used to catch it. The anchor is
  --    kept inside the replacement rather than retyped away from it.
  prev := src;
  src := replace(src,
    '  ELSE' || E'\n' ||
    '    RAISE EXCEPTION ''Compass:UnknownResourceKind',
    '  ELSIF p_kind = ''object_type'' THEN' || E'\n' ||
    '    IF NOT EXISTS (SELECT 1 FROM public.object_types t WHERE t.id = p_id) THEN' || E'\n' ||
    '      RAISE EXCEPTION ''Compass:ResourceNotFound — object_type % does not exist'', p_id;' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    SELECT t.project_id INTO res_project FROM public.object_types t WHERE t.id = p_id;' || E'\n' ||
    '    SELECT coalesce(array_agg(DISTINCT so.organization_id), ''{}''::uuid[]) INTO ot_orgs' || E'\n' ||
    '      FROM public.object_types t' || E'\n' ||
    '      JOIN public.ontologies o ON o.id = t.ontology_id' || E'\n' ||
    '      JOIN public.space_organizations so ON so.space_id = o.space_id' || E'\n' ||
    '     WHERE t.id = p_id;' || E'\n' ||
    '    file_marks := public.effective_object_type_markings(p_id);' || E'\n' ||
    '    data_marks := ''{}'';' || E'\n' ||
    '    has_policy := EXISTS (SELECT 1 FROM public.object_security_policies s' || E'\n' ||
    '                           WHERE s.object_type_id = p_id)' || E'\n' ||
    '                  OR EXISTS (SELECT 1 FROM public.property_security_policies s' || E'\n' ||
    '                              WHERE s.object_type_id = p_id);' || E'\n' ||
    '  ELSE' || E'\n' ||
    '    RAISE EXCEPTION ''Compass:UnknownResourceKind');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the kind-dispatch anchor did not match'; END IF;

  -- 3. An object type carries no organization_id of its own; its existence was
  --    already proved in the branch, so the shared not-found guard must not fire.
  prev := src;
  src := replace(src, '  IF res_org IS NULL THEN',
                      '  IF res_org IS NULL AND p_kind <> ''object_type'' THEN');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the not-found guard anchor did not match'; END IF;

  -- 4. The Organization row, which is a SET for an object type and a single
  --    organization for every other kind. The original is kept whole, inside the
  --    branch that still uses it.
  prev := src;
  src := replace(src,
    '  RETURN QUERY' || E'\n' ||
    '  SELECT ''access'', ''Organization'',' || E'\n' ||
    '         (SELECT o.name FROM public.organizations o WHERE o.id = res_org),' || E'\n' ||
    '         target_org IS NOT DISTINCT FROM res_org;',
    '  IF ot_orgs IS NOT NULL THEN' || E'\n' ||
    '    RETURN QUERY' || E'\n' ||
    '    SELECT ''access'', ''Organization'',' || E'\n' ||
    '           (SELECT string_agg(o.name, '', '' ORDER BY o.name) FROM public.organizations o' || E'\n' ||
    '             WHERE o.id = ANY (ot_orgs)),' || E'\n' ||
    '           target_org = ANY (ot_orgs);' || E'\n' ||
    '  ELSE' || E'\n' ||
    '  RETURN QUERY' || E'\n' ||
    '  SELECT ''access'', ''Organization'',' || E'\n' ||
    '         (SELECT o.name FROM public.organizations o WHERE o.id = res_org),' || E'\n' ||
    '         target_org IS NOT DISTINCT FROM res_org;' || E'\n' ||
    '  END IF;');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the Organization row anchor did not match'; END IF;

  -- 5. The Additional data requirements for an object type, appended after the
  --    lineage-markings block the dataset branch uses.
  prev := src;
  src := replace(src,
    'END $function$',
    '  -- "requires access to the object type & its datasources". With a policy' || E'\n' ||
    '  -- configured the datasource requirement is lifted, so what remains to' || E'\n' ||
    '  -- satisfy is the policy''s own markings.' || E'\n' ||
    '  IF p_kind = ''object_type'' AND has_policy THEN' || E'\n' ||
    '    RETURN QUERY' || E'\n' ||
    '    SELECT ''data'', ''Policy marking: '' || m.name, c.name,' || E'\n' ||
    '           public.marking_member(m.id, p_user)' || E'\n' ||
    '      FROM (SELECT unnest(public.object_type_policy_markings(p_id)) AS id) pm' || E'\n' ||
    '      JOIN public.markings m ON m.id = pm.id' || E'\n' ||
    '      JOIN public.marking_categories c ON c.id = m.category_id;' || E'\n' ||
    '  ELSIF p_kind = ''object_type'' THEN' || E'\n' ||
    '    RETURN QUERY' || E'\n' ||
    '    SELECT ''data'', ''Datasource marking: '' || m.name,' || E'\n' ||
    '           coalesce(ds.name, rv.name, ''datasource''),' || E'\n' ||
    '           public.marking_member(m.id, p_user)' || E'\n' ||
    '      FROM public.object_type_datasources d' || E'\n' ||
    '      CROSS JOIN LATERAL unnest(public.datasource_markings(d.id)) AS dm(id)' || E'\n' ||
    '      JOIN public.markings m ON m.id = dm.id' || E'\n' ||
    '      JOIN public.marking_categories c ON c.id = m.category_id' || E'\n' ||
    '      LEFT JOIN public.datasets ds ON ds.id = d.dataset_id' || E'\n' ||
    '      LEFT JOIN public.restricted_views rv ON rv.id = d.restricted_view_id' || E'\n' ||
    '     WHERE d.object_type_id = p_id;' || E'\n' ||
    '  END IF;' || E'\n' ||
    'END $function$');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the function-end anchor did not match'; END IF;

  EXECUTE src;

  -- Asked of the OUTCOME, not of the presence of a name.
  src := pg_get_functiondef('public.check_access(text,uuid,uuid)'::regprocedure);
  IF src NOT LIKE '%Datasource marking%' OR src NOT LIKE '%Policy marking%'
     OR src NOT LIKE '%effective_object_type_markings%' THEN
    RAISE EXCEPTION 'PATCH FAILED: the object_type branch is not complete';
  END IF;
  RAISE NOTICE 'PATCHED: check_access answers for an object type';
END $patch$;

-- PROVED BY DOING, as `authenticated`. The marking fixture unwinds in a
-- subtransaction, because markings cannot be deleted once created.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_user uuid; v_org uuid; v_role text; v_dataset uuid;
  v_cat uuid; v_marking uuid; v_osp uuid;
  v_rows int; v_orgs_ok boolean; v_detail text; v_sat boolean;
  v_msg text; v_fired boolean; v_unwound boolean := false;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT d.dataset_id INTO v_dataset FROM public.object_type_datasources d
   WHERE d.object_type_id = v_ot AND d.dataset_id IS NOT NULL;
  IF v_user IS NULL OR v_dataset IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user and a dataset-backed datasource';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 0. It used to refuse this kind by name. Now it answers.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user);
  SELECT c.satisfied, c.detail INTO v_orgs_ok, v_detail
    FROM public.check_access('object_type', v_ot, v_user) c
   WHERE c.requirement = 'Organization';
  RESET ROLE;
  IF v_rows < 2 THEN
    RAISE EXCEPTION 'PROOF FAILED: only % clause(s) for an object type', v_rows;
  END IF;
  IF NOT coalesce(v_orgs_ok, false) THEN
    RAISE EXCEPTION 'PROOF FAILED: the Organization clause is unsatisfied for a member (%)',
      coalesce(v_detail, 'no row');
  END IF;
  RAISE NOTICE 'PROVED: an object type answers — % clause(s), organization %', v_rows, v_detail;

  -- 1. The roles clause is the page's second numbered requirement, and it must
  --    be present rather than silently dropped for this kind.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user) c
   WHERE c.requirement LIKE 'Having one or more roles%';
  RESET ROLE;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: the roles clause appears % times', v_rows;
  END IF;
  RAISE NOTICE 'PROVED: the roles clause is emitted for an object type';

  -- 2. An unknown kind is still refused by name.
  v_fired := false;
  BEGIN
    PERFORM public.check_access('banana', v_ot, v_user);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Compass:UnknownResourceKind%' THEN
    RAISE EXCEPTION 'PROOF FAILED: an unknown kind is no longer refused (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: an unknown kind is still refused by name';

  BEGIN
    INSERT INTO public.marking_categories (name, category_type, organization_id)
      VALUES ('zz-834-category', 'conjunctive', v_org) RETURNING id INTO v_cat;
    INSERT INTO public.markings (name, description, category_id, created_by_user_id)
      VALUES ('zz-834-marking', 'fixture for the check access proof', v_cat, v_user)
      RETURNING id INTO v_marking;
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
      VALUES (v_marking, v_user, 'apply'), (v_marking, v_user, 'remove');
    INSERT INTO public.resource_markings (resource_kind, resource_id, marking_id)
      VALUES ('dataset', v_dataset, v_marking);

    -- 3. THE DATASOURCE HALF. "requires access to the object type & its
    --    datasources" — and the dot is red, because p_user is not a member.
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user) c
     WHERE c.section = 'data' AND c.requirement = 'Datasource marking: zz-834-marking';
    SELECT c.satisfied INTO v_sat FROM public.check_access('object_type', v_ot, v_user) c
     WHERE c.requirement = 'Datasource marking: zz-834-marking';
    RESET ROLE;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'PROOF FAILED: the datasource marking appears % times, expected 1', v_rows;
    END IF;
    IF coalesce(v_sat, true) THEN
      RAISE EXCEPTION 'PROOF FAILED: a marking the user does not hold reports satisfied';
    END IF;
    RAISE NOTICE 'PROVED: an unheld datasource marking is an unsatisfied data requirement';

    -- 4. AND 833's EITHER/OR HOLDS HERE TOO. With a policy configured the
    --    datasource requirement is lifted, so that row must GO, replaced by the
    --    policy's own markings — which are the same marking, now inherited.
    INSERT INTO public.object_security_policies (object_type_id, name, created_by)
      VALUES (v_ot, 'zz-834-object', v_user) RETURNING id INTO v_osp;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user) c
     WHERE c.requirement LIKE 'Datasource marking:%';
    RESET ROLE;
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'PROOF FAILED: the datasource requirement survived a policy (% rows)', v_rows;
    END IF;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user) c
     WHERE c.requirement = 'Policy marking: zz-834-marking' AND NOT c.satisfied;
    RESET ROLE;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'PROOF FAILED: the policy marking is not reported (% rows)', v_rows;
    END IF;
    RAISE NOTICE 'PROVED: a policy replaces the datasource requirement with its own markings';

    RAISE EXCEPTION 'ZZ834_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ834_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture block did not reach its unwind';
  END IF;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_rows FROM public.check_access('object_type', v_ot, v_user) c
   WHERE c.section = 'data';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % data requirement(s) survived the unwind', v_rows;
  END IF;
  IF EXISTS (SELECT 1 FROM public.markings WHERE name = 'zz-834-marking')
     OR EXISTS (SELECT 1 FROM public.object_security_policies WHERE name = 'zz-834-object') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture survived the unwind';
  END IF;
  RAISE NOTICE 'PROVED: fixture unwound, no data requirements remain';
END $$;
