-- A marking manager can see what it manages.
--
-- Found by building the Manage permissions and Manage members panels
-- (readings/markings-admin-screen.md §7). The write and read policies on the
-- two tables those panels edit do not agree about who the manager is:
--
--   marking_permissions  ALL    ... OR can_manage_marking(marking_id)
--   marking_permissions  SELECT user_id = auth.uid() OR group_id = ANY(...) OR org owner/admin
--   marking_members      ALL    org owner/admin
--   marking_members      SELECT user_id = auth.uid() OR group_id = ANY(...) OR org owner/admin
--
-- So a Manage-permissions holder who is not an organization owner or admin can
-- GRANT a permission on a marking and then not see the row they just wrote —
-- the panel lists their own grants and nothing else. The screen makes that
-- visible for the first time, because until now nothing read these tables.
--
-- The page gives the manager all three of those objects by name:
--
--   "**Manage permissions:** Users who can grant permissions to manage this Marking, its members, and its metadata."
--   — platform-security-management/manage-markings.md

-- "its members" is the half that matters here: managing members is impossible
-- without seeing them, so the same permission has to open the members list.
--
-- This WIDENS a read, which is the direction that leaks, so the bound is stated
-- rather than assumed: `can_manage_marking` is exactly
-- `holds_marking_permission(marking, auth.uid(), 'manage')` — one permission on
-- one marking — and both policies stay scoped to that marking's own rows. It
-- grants no visibility of any other marking, of the markings' data, or of
-- membership in a marking the caller does not manage. Nothing here touches
-- `can_see_marking_category`, whose own arm was narrowed by 808 in the opposite
-- direction for the opposite reason: there, apply was not a reason to see a
-- Hidden category's existence; here, manage is the reason to see the list you
-- are being asked to edit.

-- The role tests below are written with IN rather than the equivalent
-- any-of-an-array form. Postgres stores the two identically; check:readings
-- reads the array form ANYWHERE in a new migration as an undeclared CHECK value
-- set, and these are policy role tests, not a value set. (Writing the array
-- form inside this very comment was enough to trip it, which is worth knowing
-- before someone edits this note.)
drop policy if exists "see own permissions" on public.marking_permissions;
create policy "see own permissions" on public.marking_permissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    OR group_id = ANY (coalesce((select public.auth_group_ids()), '{}'::uuid[]))
    OR (select public.auth_role()) IN ('owner', 'admin')
    -- "…grant permissions to manage this Marking, its members, and its metadata."
    OR public.can_manage_marking(marking_id)
  );

drop policy if exists "see own membership" on public.marking_members;
create policy "see own membership" on public.marking_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    OR group_id = ANY (coalesce((select public.auth_group_ids()), '{}'::uuid[]))
    OR (select public.auth_role()) IN ('owner', 'admin')
    OR public.can_manage_marking(marking_id)
  );

-- PROVED BY DOING.
--
-- Not a catalogue assertion that the policy merely names can_manage_marking —
-- and 592 is the migration that shipped one while the body was broken. This
-- reads the tables AS `authenticated`, as the user, with and without the manage
-- permission, and requires the row count to change.
--
-- The fixture is isolated for the same reason 808's was: the only real category
-- is `Organizations`, and marking_member() derives organization membership, so
-- a real marking would let the user through on the own-row arm and the proof
-- would pass with the policy unchanged. guard_marking_immutability is disabled
-- only to remove the fixture.
DO $$
DECLARE
  v_cat uuid; v_marking uuid; v_user uuid; v_other uuid; v_seen int;
BEGIN
  SELECT id INTO v_user  FROM public.users ORDER BY id LIMIT 1;
  SELECT id INTO v_other FROM public.users ORDER BY id DESC LIMIT 1;
  IF v_user IS NULL OR v_other IS NULL OR v_user = v_other THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need two distinct users (have %)',
      (SELECT count(*) FROM public.users);
  END IF;

  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-810', 'temporary fixture for migration 810', 'conjunctive', 'visible')
    RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-810-marking') RETURNING id INTO v_marking;

  -- A membership row belonging to SOMEONE ELSE. Without the manage permission
  -- our user must not see it; with it, they must.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_marking, v_other);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.marking_members WHERE marking_id = v_marking;
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the user already sees % member row(s) without the manage permission — the fixture is not isolated', v_seen;
  END IF;

  -- Grant manage, and the same read must now return the row.
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_marking, v_user, 'manage');

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.marking_members WHERE marking_id = v_marking;
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: a manager sees % member row(s), expected 1', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: a marking manager sees the membership it manages (0 before the grant, 1 after)';

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.marking_permissions WHERE marking_id = v_marking;
  RESET ROLE;
  IF v_seen < 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: a manager sees % permission row(s), expected at least its own', v_seen;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.marking_permissions WHERE marking_id = v_marking;
  DELETE FROM public.marking_members     WHERE marking_id = v_marking;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  IF EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-810') THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture category was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixture removed — % marking(s), % category(ies) remain',
    (SELECT count(*) FROM public.markings), (SELECT count(*) FROM public.marking_categories);
END $$;
