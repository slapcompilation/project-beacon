-- 540's omissions, corrected forward. The catalog suite found all of them on
-- the first run, which is what it is for.
--
-- Applied migrations are immutable, so this is a new file rather than an edit
-- to 540. Three things it asked for:
--
--   1. `organization_role_grants` had no COMMENT. "Every public table says what
--      it holds" is the rule, and a grant table with no sentence is the one you
--      most want a sentence on — it is the answer to "who can do this".
--   2. Five foreign keys had no index on their leading column. Four of them are
--      on the grants table, which `org_workflows()` reads on every permission
--      check, so this is the hot path rather than hygiene.
--   3. The partial unique indexes 540 created cover (organization_id, role_id,
--      user_id) and (organization_id, role_id, group_id) — neither has
--      `role_id`, `user_id` or `group_id` LEADING, so none of them answers a
--      lookup by principal. That is exactly the distinction the guard draws.

COMMENT ON TABLE public.organization_role_grants IS
  'Who holds an Organization role: one row per grant, to a user or to a group, never both. "At each level, roles can be granted to users and/or groups."';

CREATE INDEX organization_role_grants_role  ON public.organization_role_grants (role_id);
CREATE INDEX organization_role_grants_user_id  ON public.organization_role_grants (user_id);
CREATE INDEX organization_role_grants_group_id ON public.organization_role_grants (group_id);
CREATE INDEX organization_role_grants_granted_by ON public.organization_role_grants (granted_by);
CREATE INDEX organization_roles_created_by ON public.organization_roles (created_by);

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE missing text;
BEGIN
  SELECT string_agg(format('%s.%s', c.relname, a.attname), ', ') INTO missing
    FROM pg_constraint fk
    JOIN pg_class c ON c.oid = fk.conrelid
    JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
   WHERE fk.contype = 'f'
     AND c.relname IN ('organization_roles', 'organization_role_workflows', 'organization_role_grants')
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = fk.conrelid AND i.indkey[0] = fk.conkey[1]);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'foreign keys still without a leading-column index: %', missing;
  END IF;

  IF obj_description('public.organization_role_grants'::regclass) IS NULL THEN
    RAISE EXCEPTION 'the grants table still says nothing about what it holds';
  END IF;

  RAISE NOTICE '541: the catalog guard was right on all three counts';
END $do$;
