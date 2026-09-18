-- A policy may not look up the row it is guarding.
--
-- 823 replaced object_types' inline three-term read policy with a single call:
--
--   using (public.object_type_visible(id))
--
-- and object_type_visible SELECTs object_types to find the row. That is CLAUDE.md's
-- "A policy may not read the table it guards" in a form I did not recognise while
-- writing it: I checked for infinite recursion, found none because the function is
-- SECURITY DEFINER, and stopped. Recursion was never the failure.
--
-- WHAT ACTUALLY BREAKS. The function is STABLE, so its snapshot is the start of the
-- current statement. A row being written BY that statement is not in it. The lookup
-- finds nothing, `coalesce(..., false)` turns nothing into a refusal, and the write
-- fails:
--
--   new row violates row-level security policy for table "object_types"
--
-- raised out of save_working_state() -> apply_object_type's INSERT. 27 tests across
-- 10 platform suites went red — actions, interfaces, branching, link index, usage
-- metrics, working state — every one of them a suite that creates an object type.
--
-- WHY 819 NEVER SHOWED THIS, which is the part worth keeping. 819's policy had the
-- same shape of problem in its third term: satisfies_markings(effective_object_type_markings(id))
-- also looks the row up, to find its project. For a row the snapshot cannot see it
-- finds no project, returns an empty marking array, and satisfies_markings('{}') is
-- TRUE. It degraded permissively. Mine degraded restrictively. Identical mistake,
-- opposite sign, and only one of the two is visible to a test suite — the more
-- dangerous one is the quiet one, and it is still there (see the residue note below).
--
-- THE FIX: the rule evaluates over the row's own columns, and only callers that
-- genuinely hold nothing but an id do a lookup. One definition of the rule, two
-- ways in, and the policy takes the way that touches no table.

-- The rule. No lookup: every argument is a column the policy already has in hand.
create or replace function public.object_type_row_visible(
  p_ontology uuid, p_project uuid, p_object_type uuid)
returns boolean language sql stable
set search_path to 'public', 'pg_temp' as $$
  SELECT public.auth_in_ontology(p_ontology)
     AND public.can_see_placed(p_project)
     AND public.satisfies_markings(public.effective_object_type_markings(p_object_type))
$$;

comment on function public.object_type_row_visible(uuid, uuid, uuid) is
  'Whether the caller may see an object type, evaluated over the row''s own columns so the read policy never queries object_types. "To see objects, you must hold View permissions on the object type and access to the data" (object-permissioning/ontology-permissions). object_type_visible(uuid) is the same rule for callers holding only an id.';

-- The lookup, unchanged in signature because 823 already patched four readers to
-- call it and they hold only a uuid. SECURITY DEFINER so it reads object_types
-- without re-entering the policy; this one is never used BY the policy.
create or replace function public.object_type_visible(p_object_type uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT public.object_type_row_visible(t.ontology_id, t.project_id, t.id)
      FROM public.object_types t
     WHERE t.id = p_object_type), false)
$$;

comment on function public.object_type_visible(uuid) is
  'object_type_row_visible for a caller holding only an id — the instance readers. Delegates, so there is one definition of the rule. NEVER put this in a policy on object_types: it looks the row up, and a row written by the current statement is not in a STABLE snapshot (824).';

-- And the policy asks the rule directly, over the row, as it did before 823.
drop policy if exists "read object types in scope" on public.object_types;
create policy "read object types in scope" on public.object_types
  for select to authenticated
  using (public.object_type_row_visible(ontology_id, project_id, id));

-- RESIDUE, RECORDED RATHER THAN QUIETLY FIXED. effective_object_type_markings(id)
-- still looks the row up to find its project, so a brand new object type placed in
-- a marked project is not yet hidden by that project's markings at the moment of
-- its own INSERT. That is 819's behaviour, unchanged here on purpose: making it
-- strict is exactly the change that just turned ten suites red, and it deserves its
-- own migration with its own proof rather than a ride on a revert.

-- PROVED BY DOING, as `authenticated`. Three things, and the first is the one 823
-- got wrong — it is asserted FIRST because it is the regression, not the feature.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_cat uuid; v_marking uuid;
  v_org uuid; v_role text; v_seen int; v_msg text; v_fired boolean; v_new uuid;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user, an ontology and an unprotected project';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. THE REGRESSION. An object type can be created BY THE CALLER, under the
  --    caller's own policies, with RETURNING — which is the exact statement
  --    shape 823 refused. This is what the ten red suites were doing.
  SET LOCAL ROLE authenticated;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status, created_by_user_id)
    VALUES (v_ont, v_proj, 'ZzProof824', 'Zz Proof 824', 'experimental', v_user)
    RETURNING id INTO v_new;
  RESET ROLE;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: creating an object type returned nothing';
  END IF;
  RAISE NOTICE 'PROVED: an object type can be created and returned again';

  -- 2. And it is readable afterwards, so the policy did not merely stop refusing
  --    writes by going blind.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_new;
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: the new object type is not readable (seen %)', v_seen;
  END IF;

  -- 3. 823's actual fix still holds: a marking hides the type AND its instances.
  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-824', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-824-marking') RETURNING id INTO v_marking;
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_marking, 'object_type', v_new);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_new;
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: a marked object type is visible again';
  END IF;

  SET LOCAL ROLE authenticated;
  v_fired := false;
  BEGIN
    PERFORM public.indexed_objects(v_new, 10);
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  RESET ROLE;
  IF NOT v_fired OR v_msg NOT LIKE 'Ontology:ObjectTypeNotFound%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the instance path serves a hidden object type again (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: 823''s fix survives — a marking still hides the type and its instances';

  -- 4. The two entry points cannot disagree, because one calls the other.
  IF public.object_type_visible(v_new) <> false THEN
    RAISE EXCEPTION 'PROOF FAILED: the lookup and the rule disagree on a hidden type';
  END IF;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = v_marking;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.object_types WHERE id = v_new;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof824')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-824') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
