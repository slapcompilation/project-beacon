-- The resource kinds name the page that carries all four of them.
--
-- 809 declared `resource_markings_resource_kind_check` as
-- `Values from security/markings`, reasoning that the concept page names the
-- set — "files, folders, and Projects" — and citing the administration page
-- separately, in prose, for the fourth. The platform suite reads the FIRST slug
-- and checks every value against that one page, and it was right to fail:
--
--   resource_markings.resource_kind = 'restricted_view' is not on security/markings
--
-- Measured rather than argued: `restricted view` occurs 0 times on
-- security/markings.md and 3 times on
-- platform-security-management/manage-markings.md, which also carries project,
-- dataset and folder. One page carries all four, so that is the page the
-- declaration names.
--
--   "You can only remove inherited Markings from Restricted Views and datasets."
--   — platform-security-management/manage-markings.md

-- The substance of 809 stands — the four kinds are right and so is the recorded
-- divergence — and this only moves the slug. 809 is applied and therefore
-- immutable, so it is corrected forward, which is why a two-line change is its
-- own migration.
--
-- THE LESSON, because it will recur: a `Values from` declaration is checked
-- against ONE page, so it must name a page carrying EVERY member. Citing a
-- second page in the prose beside it reads well and proves nothing.

comment on constraint resource_markings_resource_kind_check on public.resource_markings is
  'Values from platform-security-management/manage-markings: projects, datasets, folders and restricted views — the four kinds that page names as carrying or inheriting a marking. Narrower than Foundry, whose Resource type publishes 85 kinds — see readings/markings-admin-screen.md §10 finding 2 for the scope.';

-- PROVED BY DOING: the declaration is read back, and every member of the set is
-- required to be present in it by name. This is the same check the platform
-- suite makes against the page; doing it here too means the migration cannot
-- land having named a page while silently dropping a value from the comment.
DO $$
DECLARE
  v_comment text;
  v_values  text[];
  v         text;
BEGIN
  SELECT obj_description(oid, 'pg_constraint') INTO v_comment
    FROM pg_constraint WHERE conname = 'resource_markings_resource_kind_check';

  IF v_comment IS NULL OR v_comment NOT LIKE 'Values from platform-security-management/manage-markings%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the declaration does not name manage-markings: %', v_comment;
  END IF;

  SELECT array_agg(m[1]) INTO v_values
    FROM pg_constraint c,
         regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conname = 'resource_markings_resource_kind_check';

  IF array_length(v_values, 1) <> 4 THEN
    RAISE EXCEPTION 'PROOF FAILED: expected 4 resource kinds, found %: %', array_length(v_values, 1), v_values;
  END IF;

  FOREACH v IN ARRAY v_values LOOP
    IF position(replace(v, '_', ' ') IN lower(v_comment)) = 0 THEN
      RAISE EXCEPTION 'PROOF FAILED: the kind % is in the CHECK and not in its declaration', v;
    END IF;
  END LOOP;

  RAISE NOTICE 'PROVED: all 4 resource kinds (%) are named in a declaration pointing at one page that carries them', v_values;
END $$;
