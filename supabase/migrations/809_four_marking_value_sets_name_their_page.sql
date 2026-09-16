-- Four marking value sets name the page they came from.
--
-- CLAUDE.md: a CHECK that adds a value set declares its source in a
-- `COMMENT ON CONSTRAINT` beginning `Values from <slug>`, and the platform
-- suite proves every member appears there. `marking_categories_category_type_check`
-- declared one; the other four literal-array CHECKs in the marking family never
-- did, so the suite has been counting them among its undeclared sets.
--
-- Found by the markings reading (readings/markings-admin-screen.md §10) and
-- taken as its Decision 2. This adds only COMMENTs: no constraint changes, no
-- member added or removed.

-- 1. The three marking permissions. The page's own bullets, in its own order:
--
--   "**Manage permissions:** Users who can grant permissions to manage this Marking, its members, and its metadata."
--   — platform-security-management/manage-markings.md

--   "**Apply marking:** Users who can apply this Marking to Projects and resources. This permission only grants the ability to apply a Marking and does not grant membership of a Marking."
--   — platform-security-management/manage-markings.md

--   "**Remove marking:** Users who can remove this Marking from Projects and resources. To remove a Marking, a user must also be able to apply the Marking."
--   — platform-security-management/manage-markings.md

-- The wire enum for the same three is `ADMINISTER | DECLASSIFY | USE`, and the
-- same page's prose calls two of them `Marking Administrators` and
-- `Marking Removers`. Four spellings; this column serves the SCREEN, so it
-- takes the screen's, per CLAUDE.md's two-vocabularies rule. `Members` is
-- deliberately NOT a member of this set — it is a separate relation with no
-- role, which is why marking_members is its own table.
comment on constraint marking_permissions_permission_check on public.marking_permissions is
  'Values from platform-security-management/manage-markings: the three permission bullets — Manage permissions, Apply marking, Remove marking. Members is not one of them; it is a separate relation (marking_members). The API spells the same three ADMINISTER, DECLASSIFY, USE.';

-- 2. Category visibility is two-valued on the screen:
--
--   "In most cases, the names and descriptions of Markings and categories are not sensitive information and should be visible even to users who do not have Marking access. This behavior is determined by the category visibility, which is `Visible` by default."
--   — platform-security-management/manage-markings.md

--   "If a Marking category visibility is `Hidden`, the existence of this category and its Markings is considered sensitive information."
--   — platform-security-management/manage-markings.md

-- The wire form is NOT a two-valued string: `isPublic` is a required boolean on
-- CreateMarkingCategoryRequest. Recorded here so the divergence is declared
-- rather than discovered.
comment on constraint marking_categories_visibility_check on public.marking_categories is
  'Values from platform-security-management/manage-markings: Visible by default, Hidden when the existence of the category is itself sensitive. The API encodes the same choice as a required boolean, isPublic.';

-- 3. The two category roles, named in the page''s own bullets:
--
--   "**Category Administrators:** Users who can change the description and permissions for the category and create Markings in the category."
--   — platform-security-management/manage-markings.md

--   "**Category Viewers:** Users who can see the existence of the category and all the Markings within it."
--   — platform-security-management/manage-markings.md

-- The API spells these `ADMINISTER` and `VIEW`. Ours takes the screen's words
-- for the same reason as (1).
comment on constraint marking_category_permissions_role_check on public.marking_category_permissions is
  'Values from platform-security-management/manage-markings: Category Administrators and Category Viewers. The API spells the same pair ADMINISTER and VIEW.';

-- 4. What a marking can be applied TO. The concept page names three:
--
--   "**Markings** provide an additional level of access control for files, folders, and Projects within Foundry. Markings define eligibility criteria that restrict visibility and actions to users who meet those criteria."
--   — security/markings.md

-- and the administration page names restricted views as the fourth, in the one
-- sentence that says where an inherited marking may be severed:
--
--   "You can only remove inherited Markings from Restricted Views and datasets."
--   — platform-security-management/manage-markings.md

-- NOT DECLARED AS COMPLETE, and that is the point of writing it down: Foundry's
-- own Resource type publishes 85 kinds and `addMarkings` takes any resourceRid,
-- so this set is narrower than the platform's. The reading records the
-- divergence and its scope (markings-admin-screen.md §10, finding 2) — a
-- monitoring view inherits markings through effective_file_markings today and
-- cannot carry one directly, and widening the set needs
-- guard_marking_application to grow the matching ownership branch in the same
-- migration.
comment on constraint resource_markings_resource_kind_check on public.resource_markings is
  'Values from security/markings: files, folders and Projects, plus restricted views from platform-security-management/manage-markings. Narrower than Foundry, whose Resource type publishes 85 kinds — see readings/markings-admin-screen.md §10 finding 2 for the scope.';

-- PROVED BY DOING: read the comments back off the catalogue, and require that
-- every literal-array CHECK in the marking family now declares one. An
-- assertion that only counted the four would pass while a fifth stayed silent.
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(c.conname, ', ') INTO v_missing
    FROM pg_constraint c
   WHERE c.contype = 'c'
     AND c.conrelid::regclass::text LIKE '%marking%'
     AND pg_get_constraintdef(c.oid) LIKE '%= ANY (ARRAY[%'
     AND obj_description(c.oid, 'pg_constraint') IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: marking value set(s) still undeclared: %', v_missing;
  END IF;

  IF (SELECT obj_description(oid, 'pg_constraint')
        FROM pg_constraint WHERE conname = 'marking_permissions_permission_check')
     NOT LIKE 'Values from %' THEN
    RAISE EXCEPTION 'PROOF FAILED: the permission declaration does not begin "Values from"';
  END IF;

  RAISE NOTICE 'PROVED: every literal-array CHECK in the marking family declares its page (% set(s))',
    (SELECT count(*) FROM pg_constraint c
      WHERE c.contype='c' AND c.conrelid::regclass::text LIKE '%marking%'
        AND pg_get_constraintdef(c.oid) LIKE '%= ANY (ARRAY[%');
END $$;
