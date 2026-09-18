-- An instance reader checks markings, not placement.
--
-- 823 made four SECURITY DEFINER readers ask the object type's FULL visibility —
-- ontology, placement and markings. The markings term was the regression I set
-- out to close and it is right. The PLACEMENT term was over-reach, and the suite
-- said so in a way worth reading rather than arguing with.
--
-- WHAT IT BROKE, and why the failing test is the argument. `can_see_placed(p)`
-- is `project_role(p) IS NOT NULL`, and project_role has no org-admin arm — only
-- a user grant, a group grant, or the project's default_role. So a caller
-- holding no grant in the project has no role there, and after 823 could no
-- longer read instances. That is not only a test-fixture problem:
--
--   dynamicRecipients > `finds nobody when nothing is indexed, and does not
--   treat that as an error`
--
-- is the automation recipient path, which reads the objects that fired in order
-- to address a notification. It has no project grant because nothing ever gave
-- one to it, and after 823 it raised Ontology:ObjectTypeNotFound. A system path
-- that reads objects on a user's behalf is not the thing the placement rule is
-- about, and turning its "nobody is indexed" case into an error is a worse
-- outcome than the hole I was closing. 21 tests across 4 suites said this.
--
-- THE SCOPED VERSION. The hole 823 exists for is precise and I proved it:
--
--   "**Additional privacy controls:** Hide sensitive ontology resources by applying a marking or by placing them in a project where the user lacks a role grant."
--   — object-permissioning/ontology-permissions.md
--
-- 819 made the marking half real for the object type and the instance path
-- skipped it, so a marking hid the type from the list and not its instances. The
-- placement half was never enforced on the instance path either — but that is an
-- older and independent gap, it predates 819, and closing it needs an answer for
-- callers that legitimately have no project role. Recorded, not smuggled in
-- under a migration about markings.
--
-- AND THE NAME HAS TO CHANGE WITH THE MEANING. Leaving four readers calling
-- something named object_type_visible while it answers a weaker question is the
-- kind of false claim CLAUDE.md names: the function would say "visible" and mean
-- "not marked". So the readers move to object_type_instances_readable, and
-- object_type_visible — which nothing else calls — goes.

create or replace function public.object_type_instances_readable(p_object_type uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT public.auth_in_ontology(t.ontology_id)
       AND public.satisfies_markings(public.effective_object_type_markings(t.id))
      FROM public.object_types t
     WHERE t.id = p_object_type), false)
$$;

comment on function public.object_type_instances_readable(uuid) is
  'What an instance reader asks: is the caller in the ontology, and do they satisfy the object type''s markings. DELIBERATELY WEAKER than object_type_row_visible, which the read policy uses — it omits placement, because project_role has no org-admin arm and system paths such as the automation recipient reader hold no grant (825). The placement half of "Hide sensitive ontology resources by applying a marking or by placing them in a project where the user lacks a role grant" (object-permissioning/ontology-permissions) is therefore still unenforced on the instance path, and is recorded as open rather than closed.';

-- The four readers, re-pointed. Same mechanical patch as 823, same assertions.
DO $patch$
DECLARE r record; src text; out text; n int := 0; sites int := 0; still text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
       AND p.proname IN ('indexed_objects', 'evaluate_object_set',
                         'list_linked_objects', 'search_objects')
  LOOP
    src := pg_get_functiondef(r.oid);
    sites := sites + (length(src) - length(replace(src, 'public.object_type_visible(', '')))
                     / length('public.object_type_visible(');
    out := replace(src, 'public.object_type_visible(', 'public.object_type_instances_readable(');
    IF out = src THEN
      RAISE EXCEPTION 'PATCH FAILED: % does not call object_type_visible', r.proname;
    END IF;
    EXECUTE out;
    n := n + 1;
  END LOOP;
  IF n <> 4 THEN
    RAISE EXCEPTION 'PATCH FAILED: expected 4 readers, patched %', n;
  END IF;
  -- 823 put five calls in: one guard each in three readers, one filter in
  -- search_objects, and the far side of list_linked_objects.
  IF sites <> 5 THEN
    RAISE EXCEPTION 'PATCH FAILED: expected 5 call sites, found %', sites;
  END IF;

  -- Excluding the function itself, whose own CREATE line names it.
  SELECT string_agg(p.proname, ', ') INTO still FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname <> 'object_type_visible'
     AND pg_get_functiondef(p.oid) LIKE '%public.object_type_visible(%';
  IF still IS NOT NULL THEN
    RAISE EXCEPTION 'PATCH FAILED: % still calls object_type_visible', still;
  END IF;
  RAISE NOTICE 'PATCHED: % readers, % call sites, re-pointed', n, sites;
END $patch$;

-- Nothing reaches it now, and a function nothing reaches is not built.
drop function if exists public.object_type_visible(uuid);

-- PROVED BY DOING, as `authenticated`. Four claims, and the third is the one
-- that makes this migration a narrowing rather than a revert.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_cat uuid; v_marking uuid;
  v_org uuid; v_role text; v_seen int; v_msg text; v_fired boolean;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user and an ontology';
  END IF;

  -- Its OWN project, with no grants and no default_role, because every existing
  -- project already grants this caller a role and the proof would then be
  -- vacuous — the precondition below caught exactly that on the first run.
  INSERT INTO public.projects (organization_id, api_name, name, default_role)
    VALUES (v_org, 'zz_proof_825', 'Zz Proof 825', NULL) RETURNING id INTO v_proj;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof825', 'Zz Proof 825', 'experimental') RETURNING id INTO v_ot;
  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-825', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-825-marking') RETURNING id INTO v_marking;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. THE NARROWING. This caller holds no role in the project, which is exactly
  --    the state 823 turned into an error, and the instance path serves them.
  IF public.project_role(v_proj) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the caller holds a project role, so this proves nothing';
  END IF;
  SET LOCAL ROLE authenticated;
  PERFORM public.indexed_objects(v_ot, 10);
  RESET ROLE;
  RAISE NOTICE 'PROVED: a caller with no project role reaches the instance path again';

  -- 2. 823'S ACTUAL FIX SURVIVES. A marking still hides the instances.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_marking, 'object_type', v_ot);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  SET LOCAL ROLE authenticated;
  v_fired := false;
  BEGIN
    PERFORM public.indexed_objects(v_ot, 10);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  RESET ROLE;
  IF NOT v_fired OR v_msg NOT LIKE 'Ontology:ObjectTypeNotFound%' THEN
    RAISE EXCEPTION 'PROOF FAILED: a marked object type serves its instances again (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: a marking still hides the instances, which is what 823 was for';

  -- 3. And the TYPE is still hidden by the full rule, placement included, so
  --    narrowing the reader did not narrow the policy.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: the read policy no longer hides a marked object type';
  END IF;

  -- 4. A member gets both back.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_marking, v_user);
  SET LOCAL ROLE authenticated;
  PERFORM public.indexed_objects(v_ot, 10);
  RESET ROLE;
  RAISE NOTICE 'PROVED: a member of the marking reaches the instances';

  DELETE FROM public.marking_members WHERE marking_id = v_marking;
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = v_marking;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.object_types WHERE id = v_ot;
  DELETE FROM public.projects    WHERE id = v_proj;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof825')
     OR EXISTS (SELECT 1 FROM public.projects WHERE api_name = 'zz_proof_825')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-825') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
