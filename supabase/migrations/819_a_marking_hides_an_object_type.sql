-- A marking hides an object type.
--
-- The first piece of §1 of ONTOLOGY-JOURNEY-GAPS — the ontology's security
-- layer — and the one that was already half-wired: the Security tab has always
-- asked for an object type's markings and the database has always refused the
-- kind.
--
--   supabase.from('resource_markings').select('markings(name)')
--     .eq('resource_kind', 'object_type').eq('resource_id', type.id)
--
-- `resource_markings_resource_kind_check` admits project, dataset, folder and
-- restricted_view, so that query could never return a row. A dead read against
-- a kind the CHECK forbids.
--
-- It is Foundry's documented way to hide an ontology resource:
--
--   "**Additional privacy controls:** Hide sensitive ontology resources by applying a marking or by placing them in a project where the user lacks a role grant."
--   — object-permissioning/ontology-permissions.md

--   "**Compass curation primitives:** Use portfolios and tags to organize ontology resources, and role grants or markings to hide irrelevant resources from users."
--   — object-permissioning/ontology-permissions.md

-- FOUR CHANGES, AND THE FOURTH IS THE POINT. Admitting the kind alone would let
-- a user apply a marking that hides nothing — the object_types read policy is
-- `auth_in_ontology(ontology_id) AND can_see_placed(project_id)` and consults
-- no marking. A marking you can apply and that conceals nothing is worse than
-- no marking, because it reads as protection. So the read policy learns it in
-- the same migration.
--
-- ONLY object_type, not every ontology kind. The sentences above say "ontology
-- resources" generally, and link types, interfaces, action types and shared
-- properties are ontology resources too. They get no kind here because nothing
-- reads or writes a marking for them — CLAUDE.md's rule is that a thing
-- nothing reaches is not built. The sentence's wider reach is recorded, not
-- implemented.

-- 1. The kind is admissible.
alter table public.resource_markings
  drop constraint resource_markings_resource_kind_check;

alter table public.resource_markings
  add constraint resource_markings_resource_kind_check
  check (resource_kind = any (array['project','dataset','folder','restricted_view','object_type']));

comment on constraint resource_markings_resource_kind_check on public.resource_markings is
  'Values from security/markings: files, folders and Projects, plus restricted views from platform-security-management/manage-markings and object types from object-permissioning/ontology-permissions ("Hide sensitive ontology resources by applying a marking"). Narrower than Foundry, whose Resource type publishes 85 kinds — see readings/markings-admin-screen.md §10 finding 2.';

-- 2. Inheritance. An object type has no folder — it is placed in a project —
-- so it takes its own markings and its project's, and the chain walk that
-- serves the filesystem kinds does not apply to it.
create or replace function public.effective_object_type_markings(p_object_type uuid)
returns uuid[] language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce(array_agg(DISTINCT rm.marking_id), '{}'::uuid[])
    FROM public.resource_markings rm
   WHERE (rm.resource_kind = 'object_type' AND rm.resource_id = p_object_type)
      OR (rm.resource_kind = 'project'
          AND rm.resource_id = (SELECT ot.project_id FROM public.object_types ot
                                 WHERE ot.id = p_object_type))
$$;

comment on function public.effective_object_type_markings(uuid) is
  'The markings an object type carries: its own, plus its project''s. Separate from effective_file_markings because an object type has no folder_id — it is placed in a project and inherits from there only.';

-- 3. Applying one needs the same two permissions as any other resource.
-- guard_marking_application resolves ownership per kind and its ELSE falls
-- through to datasets, so without a branch an object type would find no
-- dataset row, `owns` would be false, and every non-admin would be refused.
create or replace function public.guard_marking_application()
returns trigger language plpgsql as $$
DECLARE m uuid; owns boolean; kind text; res uuid;
BEGIN
  m := coalesce(NEW.marking_id, OLD.marking_id);
  kind := coalesce(NEW.resource_kind, OLD.resource_kind);
  res := coalesce(NEW.resource_id, OLD.resource_id);

  -- Requirement 2: "the 'Update Markings on resource' permission, which is
  -- included in the Owner role by default."
  IF kind = 'project' THEN
    SELECT public.role_rank(public.project_role(res)) >= public.role_rank('owner') INTO owns;
  ELSIF kind = 'folder' THEN
    SELECT public.role_rank(public.project_role(f.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.folders f WHERE f.id = res;
  ELSIF kind = 'restricted_view' THEN
    SELECT public.role_rank(public.project_role(v.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.restricted_views v WHERE v.id = res;
  ELSIF kind = 'object_type' THEN
    SELECT public.role_rank(public.project_role(ot.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.object_types ot WHERE ot.id = res;
  ELSE
    SELECT public.role_rank(public.project_role(d.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.datasets d WHERE d.id = res;
  END IF;

  -- An org admin is the bootstrap, as everywhere else: someone has to be able to
  -- act before the first project role is granted.
  owns := coalesce(owns, false) OR public.auth_role() IN ('owner','admin');

  IF TG_OP = 'DELETE' THEN
    IF NOT (owns AND public.can_remove_marking(m)) THEN
      RAISE EXCEPTION 'Markings:CannotRemove — removing a marking needs the "remove" permission on it and Owner on the resource'
        USING HINT = 'An Owner role alone is not enough. That is the point of a mandatory control.';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT (owns AND public.can_apply_marking(m)) THEN
    RAISE EXCEPTION 'Markings:CannotApply — applying a marking needs the "apply" permission on it and Owner on the resource';
  END IF;
  RETURN NEW;
END $$;

-- 4. And the marking actually hides it. "a user must be a member of all the
-- Markings on a file, folder, or Project in order to have access, since
-- Markings are conjunctive" — satisfies_markings is that conjunction.
drop policy if exists "read object types in scope" on public.object_types;
create policy "read object types in scope" on public.object_types
  for select to authenticated
  using (
    public.auth_in_ontology(ontology_id)
    AND public.can_see_placed(project_id)
    AND public.satisfies_markings(public.effective_object_type_markings(id))
  );

-- PROVED BY DOING, as `authenticated`, because a policy proved as the owner is
-- not proved at all — the owner bypasses RLS and every assertion would pass.
--
-- Three states, and the middle one is the whole feature: unmarked is visible,
-- marked is invisible to a non-member, and marked is visible again to a member.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_cat uuid; v_marking uuid;
  v_seen int; v_org uuid; v_role text;
BEGIN
  -- The claims carry app_metadata, not just sub: auth_in_ontology resolves the
  -- caller's organization through auth_org_id(), which reads it from there. A
  -- sub-only JWT makes every object type invisible and the proof's first step
  -- fails for the wrong reason.
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user, an ontology and an unprotected project';
  END IF;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof819', 'Zz Proof 819', 'experimental') RETURNING id INTO v_ot;

  -- A hidden category of its own, so the fixture marking is one nobody holds.
  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-819', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-819-marking') RETURNING id INTO v_marking;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. Unmarked: visible.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: an unmarked object type is already invisible (seen %)', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: an unmarked object type is visible';

  -- 2. Marked, not a member: invisible. The guard is disabled only to plant the
  --    row — the policy under test is never disabled.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_marking, 'object_type', v_ot);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: a marked object type is still visible to a non-member';
  END IF;
  RAISE NOTICE 'PROVED: a marking hides an object type from a non-member';

  -- 3. A member sees it again.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_marking, v_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: a member cannot see the marked object type';
  END IF;
  RAISE NOTICE 'PROVED: a member of the marking sees it again';

  PERFORM set_config('request.jwt.claims', NULL, true);

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

  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof819')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-819') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
