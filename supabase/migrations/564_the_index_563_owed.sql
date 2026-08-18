-- The leading-column indexes 563's two foreign keys owed.
--
-- `organization_role_workflows` and `space_role_workflows` are keyed
-- (role_id, workflow), so their primary-key index leads with `role_id`. 563
-- added a foreign key on `workflow`, which that index cannot serve — and the
-- rule `catalog.test.ts` enforces is one index per foreign key's leading
-- column, because that is what a cascade delete walks.
--
-- Second time in this arc: 556 paid the same debt for 554 and 555. Both were
-- caught by the standing suite rather than by review, and neither migration's
-- own assertions could have found it — they assert what the feature promises,
-- and this is what the repository requires of any table. Worth stating plainly
-- so the next migration adding a foreign key adds the index in the same file.

BEGIN;

CREATE INDEX organization_role_workflows_workflow ON public.organization_role_workflows (workflow);
CREATE INDEX space_role_workflows_workflow ON public.space_role_workflows (workflow);

-- ── assertions, which ask the catalog the guard's own question ──────────────
DO $do$
DECLARE n int; missing text;
BEGIN
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

  -- And the catalogue table says what it holds, which is the other half of the
  -- same guard.
  IF obj_description('public.workflows'::regclass, 'pg_class') IS NULL THEN
    RAISE EXCEPTION 'the workflow catalogue does not say what it holds';
  END IF;

  RAISE NOTICE '564: the index 563 owed';
END $do$;

COMMIT;
