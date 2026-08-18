-- The catalog hygiene 554 and 555 owed, caught by the standing guard rather
-- than by review.
--
-- Two repo-wide rules, both already enforced by `catalog.test.ts`:
-- every public table says what it holds, and every foreign key has an index on
-- its leading column (464 did that sweep once; these are the new arrivals).
--
-- Worth noting which guard found it. 554 and 555 both carry assertions that
-- execute their own behaviour, and both passed — because they assert what the
-- feature promises, not what the repository requires of any table. The
-- standing suite is where a house rule lives, and this is the third time it
-- has caught something a migration's own assertions structurally could not.
--
-- The partial indexes 554 and 555 created (`... WHERE user_id IS NOT NULL`)
-- do not satisfy the rule and should not: a partial index cannot serve a
-- cascade delete, which is what the rule exists for.

COMMENT ON TABLE public.portfolio_curators IS
  'Users or groups given curation of one portfolio, beyond whoever holds the space workflow. Curation only — appointing a curator is a management act.';
COMMENT ON TABLE public.space_role_grants IS
  'Who holds a role on a space, as a user or a group. A custom role may only be granted on the space that owns it.';

CREATE INDEX portfolio_curators_added_by ON public.portfolio_curators (added_by);
CREATE INDEX portfolio_curators_group_fk ON public.portfolio_curators (group_id);
CREATE INDEX portfolio_curators_user_fk  ON public.portfolio_curators (user_id);
CREATE INDEX portfolios_created_by       ON public.portfolios (created_by);
CREATE INDEX space_role_grants_granted_by ON public.space_role_grants (granted_by);
CREATE INDEX space_role_grants_group_fk   ON public.space_role_grants (group_id);
CREATE INDEX space_role_grants_role       ON public.space_role_grants (role_id);
CREATE INDEX space_role_grants_user_fk    ON public.space_role_grants (user_id);
CREATE INDEX space_roles_created_by       ON public.space_roles (created_by);

-- ── assertions, which ask the catalog the guard's own question ──────────────
DO $do$
DECLARE n int; missing text;
BEGIN
  SELECT count(*), string_agg(c.relname, ', ') INTO n, missing
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r'
     AND obj_description(c.oid, 'pg_class') IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '% table(s) still say nothing about what they hold: %', n, missing;
  END IF;

  SELECT count(*), string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ')
    INTO n, missing
    FROM pg_constraint c
    JOIN pg_namespace ns ON ns.oid = c.connamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f' AND ns.nspname = 'public'
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF n > 0 THEN
    RAISE EXCEPTION '% foreign key(s) still lack a leading-column index: %', n, missing;
  END IF;

  RAISE NOTICE '556: the hygiene 554 and 555 owed';
END $do$;
