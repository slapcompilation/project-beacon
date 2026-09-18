-- Seeing objects needs View on the object type, and four readers did not ask.
--
--   "To see objects, you must hold View permissions on the object type and access to the data."
--   — object-permissioning/ontology-permissions.md
--
--   "Migrating to projects does not change who has access to the backing datasource. To see objects, users continue to need permissions on both the object type and the datasource."
--   — object-permissioning/ontology-permissions.md
--
-- Both halves are required and we enforce one. `object_types` has carried a
-- three-term read policy since 819:
--
--   auth_in_ontology(ontology_id)
--     AND can_see_placed(project_id)
--     AND satisfies_markings(effective_object_type_markings(id))
--
-- but `indexed_objects`, `evaluate_object_set`, `list_linked_objects` and
-- `search_objects` are all SECURITY DEFINER and gate on `auth_in_ontology`
-- ALONE. A SECURITY DEFINER function reads `object_types` as its owner, so that
-- policy never runs for them. The two terms they skip are exactly the two 819
-- added.
--
-- The consequence, stated plainly: a marking hides an object type from the type
-- list and does not hide its instances from anyone holding the uuid. 819's
-- header argued that a marking that conceals nothing is worse than no marking
-- "because it reads as protection", and then left half of that true. Placement
-- has the same hole and is older.
--
-- FOUND BY AN ADVERSARY, not by a guard, and that is the point worth recording:
-- every suite was green throughout. Nothing static catches a SECURITY DEFINER
-- function declining to ask a question.

-- ── 1. One definition of the question, so the two callers cannot drift ─────
-- SECURITY DEFINER deliberately: it must read object_types WITHOUT re-entering
-- the policy that calls it. That is safe here because every term resolves from
-- the caller's JWT rather than from RLS — auth_in_ontology, project_role (under
-- can_see_placed), satisfies_markings and effective_object_type_markings are all
-- SECURITY DEFINER already and key off auth.uid(). Verified one by one before
-- writing this, because the single non-DEFINER helper in that list,
-- can_see_placed, would otherwise have had its answer changed by the wrapper.
create or replace function public.object_type_visible(p_object_type uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT public.auth_in_ontology(t.ontology_id)
       AND public.can_see_placed(t.project_id)
       AND public.satisfies_markings(public.effective_object_type_markings(t.id))
      FROM public.object_types t
     WHERE t.id = p_object_type), false)
$$;

comment on function public.object_type_visible(uuid) is
  'Whether the caller may see an object type at all: in its ontology, holding a role where it is placed, and satisfying its markings. The single definition of object_types'' read policy, so an instance reader and the policy cannot answer differently — "To see objects, you must hold View permissions on the object type and access to the data" (object-permissioning/ontology-permissions).';

-- ── 2. The policy now states the rule once ────────────────────────────────
-- Same three terms, same order, no behaviour change — proved below rather than
-- asserted, because a policy rewrite that silently widened access is the worst
-- outcome available here.
drop policy if exists "read object types in scope" on public.object_types;
create policy "read object types in scope" on public.object_types
  for select to authenticated
  using (public.object_type_visible(id));

-- ── 3. And the four readers ask it ────────────────────────────────────────
-- Three share one guard line verbatim and all three take p_object_type as their
-- first argument; search_objects filters a set instead. Patched from
-- pg_get_functiondef with a count assertion, never retyped.
--
-- list_linked_objects gets a second patch, because a link has two ends and this
-- migration would otherwise be a half-fix: the far type is chosen from the link
-- rather than named by the caller, and its visibility was never asked either.
-- It follows the convention the function already records for its near side,
-- verbatim in its own comment — "No rows rather than an error: an error would
-- confirm the object exists, and the api masks access as absence." So the near
-- side keeps its RAISE, because the caller named that type, and the far side
-- returns empty.
DO $patch$
DECLARE r record; src text; out text; n int := 0; far_patched boolean := false; still text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
       AND p.proname IN ('indexed_objects', 'evaluate_object_set', 'list_linked_objects')
  LOOP
    src := pg_get_functiondef(r.oid);
    out := replace(src,
      'IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN',
      'IF ont IS NULL OR NOT public.object_type_visible(p_object_type) THEN');
    IF out = src THEN
      RAISE EXCEPTION 'PATCH FAILED: % does not carry the expected guard', r.proname;
    END IF;

    IF r.proname = 'list_linked_objects' THEN
      src := out;
      out := replace(src,
        '              THEN lk.target_object_type_id ELSE lk.source_object_type_id END;',
        '              THEN lk.target_object_type_id ELSE lk.source_object_type_id END;'
        || E'\n\n' ||
        '  -- The far type''s own visibility, on the same terms and with the same' || E'\n' ||
        '  -- silence as the near-side gate below.' || E'\n' ||
        '  IF NOT public.object_type_visible(far) THEN RETURN; END IF;');
      IF out = src THEN
        RAISE EXCEPTION 'PATCH FAILED: list_linked_objects does not carry the expected far-side assignment';
      END IF;
      far_patched := true;
    END IF;

    EXECUTE out;
    n := n + 1;
  END LOOP;
  IF NOT far_patched THEN
    RAISE EXCEPTION 'PATCH FAILED: the far side of list_linked_objects was not patched';
  END IF;
  IF n <> 3 THEN
    RAISE EXCEPTION 'PATCH FAILED: expected 3 guards, patched %', n;
  END IF;

  src := pg_get_functiondef('public.search_objects(text,integer)'::regprocedure);
  out := replace(src,
    'AND public.auth_in_ontology(ot.ontology_id)',
    'AND public.object_type_visible(ot.id)');
  IF out = src THEN
    RAISE EXCEPTION 'PATCH FAILED: search_objects does not carry the expected filter';
  END IF;
  EXECUTE out;

  -- Nothing on an instance path may still be asking the narrower question.
  SELECT string_agg(p.proname, ', ') INTO still FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname IN ('indexed_objects', 'evaluate_object_set',
                       'list_linked_objects', 'search_objects')
     AND pg_get_functiondef(p.oid) LIKE '%auth_in_ontology%';
  IF still IS NOT NULL THEN
    RAISE EXCEPTION 'PATCH FAILED: % still gates on auth_in_ontology alone', still;
  END IF;
  RAISE NOTICE 'PATCHED: 4 instance readers now ask object_type_visible';
END $patch$;

-- PROVED BY DOING, as `authenticated`.
--
-- Three things have to hold at once and the third is the fix: the rewritten
-- policy must still admit what it admitted, must still refuse what it refused,
-- and the instance path must now refuse what the policy refuses. The first is
-- also the recursion test — if object_type_visible re-entered the policy that
-- calls it, this block would not get past step 1 and the whole migration would
-- roll back.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_cat uuid; v_marking uuid;
  v_org uuid; v_role text; v_seen int; v_msg text; v_fired boolean;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user, an ontology and an unprotected project';
  END IF;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof823', 'Zz Proof 823', 'experimental') RETURNING id INTO v_ot;
  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-823', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-823-marking') RETURNING id INTO v_marking;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. Unmarked: the rewritten policy still admits. Also the recursion test.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: the rewritten policy hides an unmarked object type (seen %)', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: the rewritten policy still admits, and does not recurse';

  -- 2. Marked: the policy still refuses. 819's guarantee is unchanged.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_marking, 'object_type', v_ot);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: a marked object type is visible after the rewrite';
  END IF;
  RAISE NOTICE 'PROVED: the rewritten policy still refuses a marking the caller lacks';

  -- 3. THE FIX. The instance path refuses it too, by name. Before this
  --    migration every one of these returned rather than raised.
  SET LOCAL ROLE authenticated;
  v_fired := false;
  BEGIN
    PERFORM public.indexed_objects(v_ot, 10);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  RESET ROLE;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: indexed_objects served a hidden object type';
  END IF;
  IF v_msg NOT LIKE 'Ontology:ObjectTypeNotFound%' THEN
    RAISE EXCEPTION 'PROOF FAILED: refused, but by something else: %', v_msg;
  END IF;

  SET LOCAL ROLE authenticated;
  v_fired := false;
  BEGIN
    PERFORM public.evaluate_object_set(v_ot);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  RESET ROLE;
  IF NOT v_fired OR v_msg NOT LIKE 'Ontology:ObjectTypeNotFound%' THEN
    RAISE EXCEPTION 'PROOF FAILED: evaluate_object_set served a hidden object type (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: the instance path refuses a hidden object type';

  -- 4. And a member gets both back, so the fix refuses only what it should.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_marking, v_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  PERFORM public.indexed_objects(v_ot, 10);
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: a member cannot see the marked object type';
  END IF;
  RAISE NOTICE 'PROVED: a member sees the type and reaches its instances';

  DELETE FROM public.marking_members WHERE marking_id = v_marking;
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = v_marking;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.object_types WHERE id = v_ot;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof823')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-823') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
