-- Holding "apply" on a marking is not a reason to see a Hidden category.
--
-- The page lists the category visibility rules as four bullets, and the third
-- names exactly two roles:
--
--   "All users with roles (administrator, remover) on a Marking can view the category and existence of all Markings within the category."
--   — platform-security-management/manage-markings.md

-- The bullet above it is the membership rule, which we implement correctly:
--
--   "All users with access to a Marking can view existence of the category and all other Markings within the category."
--   — platform-security-management/manage-markings.md

-- `can_see_marking_category` implements the third bullet as
-- `holds_marking_permission(m.id, auth.uid(), NULL)`, and NULL in that helper
-- means ANY permission:
--
--     AND (p_permission IS NULL OR p.permission = p_permission)
--
-- Our vocabulary is marking_permissions.permission in (manage, apply, remove),
-- so the arm admits `apply` where the bullet names administrator and remover
-- only. Every remover can also apply — `guard_remove_implies_apply` enforces
-- exactly that — but the converse is false, so the arm is strictly wider than
-- what is published.
--
-- WHY IT MATTERS, rather than being a tidy-up. A Hidden category is the one
-- case where the category's own existence is the secret:
--
--   "If a Marking category visibility is `Hidden`, the existence of this category and its Markings is considered sensitive information."
--   — platform-security-management/manage-markings.md

-- Seven RLS policies route through this function — on marking_categories,
-- markings, marking_category_permissions, marking_disallowed, marking_implied,
-- marking_requirements and cbac_marking_colors — so one wide arm leaks the same
-- fact seven ways. CLAUDE.md's rule against being stricter than Foundry does not
-- license being looser, and on a visibility rule looser is the direction that
-- leaks.
--
-- PATCHED, NOT RETYPED: this is pg_get_functiondef's own output with one arm
-- changed. Nothing else moved — not the org check, not the membership arm, and
-- not the explicit category-permission arm, whose table's CHECK is already
-- exactly the administrator/viewer pair of the fourth bullet.

-- PROVED BY DOING, IN BOTH DIRECTIONS.
--
-- The proof runs BEFORE the replacement as well as after, because "the new
-- function refuses" is only half the claim; the other half is that the old one
-- allowed it, and an assertion that never saw the old behaviour cannot say so.
--
-- It cannot use the real category. `marking_member()` derives organization
-- membership — a user whose organization's marking sits in the category is a
-- member of it — our only category is `Organizations`, and so the membership
-- arm is true there for every user. The proof would then pass with this
-- function's body replaced by RAISE, which is 592's exact failure. So it builds
-- an isolated Hidden category instead.
--
-- Four triggers were read before writing this, because each one would have
-- broken it: `seed_category_administrator` grants the creator an administrator
-- row, but only when auth.uid() is not null, so a migration creates none (had
-- it fired, the fourth arm would have made the proof vacuous);
-- `guard_marking_creation` returns early on a null auth.uid();
-- `guard_category_change` is BEFORE UPDATE only, so the INSERT is clean; and
-- `guard_remove_implies_apply` refuses a `remove` row unless an `apply` row
-- already exists, which is why step 2 ADDS remove beside apply rather than
-- replacing it.
DO $$
DECLARE v_cat uuid; v_marking uuid; v_user uuid;
BEGIN
  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no users'; END IF;

  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-808', 'temporary fixture for migration 808', 'conjunctive', 'hidden')
    RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-808-marking') RETURNING id INTO v_marking;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_marking, v_user, 'apply');

  -- Guard against a vacuous proof: this user must reach the category by the
  -- apply arm and by nothing else.
  IF EXISTS (SELECT 1 FROM public.markings m
              WHERE m.category_id = v_cat AND public.marking_member(m.id, v_user)) THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture user is a member of the fixture marking, so the membership arm would decide it';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marking_category_permissions WHERE category_id = v_cat) THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture category already carries a category permission';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  IF NOT public.can_see_marking_category(v_cat) THEN
    RAISE EXCEPTION 'PROOF FAILED: apply-only already could not see the hidden category — this migration''s premise is wrong';
  END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'PROVED (before): apply-only COULD see a hidden category';
END $$;

create or replace function public.can_see_marking_category(p_category uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_categories c
     WHERE c.id = p_category
       AND (c.organization_id IS NULL
            OR c.organization_id IS NOT DISTINCT FROM public.auth_org_id())
       AND (c.visibility = 'visible'
            OR EXISTS (SELECT 1 FROM public.markings m
                        WHERE m.category_id = c.id
                          AND public.marking_member(m.id, auth.uid()))
            -- "All users with roles (administrator, remover) on a Marking" —
            -- administrator and remover, NOT apply. NULL here meant any of the
            -- three, which let an applier see a Hidden category's existence.
            OR EXISTS (SELECT 1 FROM public.markings m
                        WHERE m.category_id = c.id
                          AND (public.holds_marking_permission(m.id, auth.uid(), 'manage')
                            OR public.holds_marking_permission(m.id, auth.uid(), 'remove')))
            -- "explicitly been granted Category Viewer permissions" — and an
            -- administrator sees what it administers.
            OR EXISTS (SELECT 1 FROM public.marking_category_permissions cp
                       WHERE cp.category_id = c.id AND cp.user_id = auth.uid())))
$function$;

comment on function public.can_see_marking_category(uuid) is
  'Category visibility, per the four bullets of platform-security-management/manage-markings.md. The marking-role arm is administrator and remover only: apply is not a reason to see a Hidden category.';

DO $$
DECLARE v_cat uuid; v_marking uuid; v_user uuid;
BEGIN
  SELECT id INTO v_cat FROM public.marking_categories WHERE name = 'zz-proof-808';
  SELECT id INTO v_marking FROM public.markings WHERE category_id = v_cat;
  SELECT user_id INTO v_user FROM public.marking_permissions WHERE marking_id = v_marking LIMIT 1;
  IF v_cat IS NULL OR v_marking IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture from the first block is gone';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- 1. apply alone no longer sees it.
  IF public.can_see_marking_category(v_cat) THEN
    RAISE EXCEPTION 'PROOF FAILED: apply-only can still see the hidden category';
  END IF;
  RAISE NOTICE 'PROVED (after): apply-only cannot see a hidden category';
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- 2. remove does, because the bullet names it. Added BESIDE apply, since
  --    guard_remove_implies_apply refuses it otherwise.
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_marking, v_user, 'remove');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  IF NOT public.can_see_marking_category(v_cat) THEN
    RAISE EXCEPTION 'PROOF FAILED: remove cannot see the hidden category, and the bullet says it must';
  END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- 3. and so does manage, on its own.
  DELETE FROM public.marking_permissions WHERE marking_id = v_marking;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_marking, v_user, 'manage');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  IF NOT public.can_see_marking_category(v_cat) THEN
    RAISE EXCEPTION 'PROOF FAILED: manage cannot see the hidden category';
  END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'PROVED (after): remove and manage still can';

  -- Remove the fixture. The immutability guards are disabled only here, and
  -- only for the delete; the function under test is never disabled.
  DELETE FROM public.marking_permissions WHERE marking_id = v_marking;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  IF EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-808') THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture category was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixture removed — % marking(s), % category(ies) remain',
    (SELECT count(*) FROM public.markings), (SELECT count(*) FROM public.marking_categories);
END $$;
