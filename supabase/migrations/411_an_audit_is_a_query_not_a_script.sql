-- 411 — an audit is a query, not a script
--
-- There were two different things in one guard script, and calling both "checks"
-- hid the difference:
--
--   a TEST builds a fixture, proves the code works, and rolls back
--   an AUDIT builds nothing, and asks the system you actually have what is wrong
--
-- Neither substitutes for the other, and only the first is a test. The tests
-- have moved to `@beacon/platform`. This is the second audit, beside
-- `ontology_violations()` — and once both are functions, the audit stops being a
-- CI artifact at all. Foundry shows `❗4 errors` on an object type because **the
-- platform knows**, not because a script ran overnight
-- (`create-object-type-edit-backing-dataset.png`). A function can be rendered.
--
-- What this one asks: is every RLS-guarded table actually readable by the role
-- the product connects as? It is the check that found the outage — migration 403
-- put `effective_file_markings` into the `datasets` policy, that function reads
-- `datasets`, and `select * from datasets` became "stack depth limit exceeded"
-- for every real user while every other guard stayed green.
--
-- Derived, never enumerated. The catalog is asked which tables have RLS, so one
-- added tomorrow is covered without anyone remembering to add it.

BEGIN;

CREATE OR REPLACE FUNCTION public.rls_violations()
RETURNS TABLE (relation text, problem text)
LANGUAGE plpgsql
-- Invoker rights, necessarily: the point is to run as a different role, and a
-- SECURITY DEFINER function cannot change roles.
AS $$
DECLARE
  r record; n int;
  -- Restore whatever the caller had, not a hardcoded 'none'. Resetting to 'none'
  -- would return a caller who had SET ROLE to `authenticated` back to the login
  -- role — this function would hand out privilege on its way out.
  before text := current_setting('role', true);
BEGIN
  IF NOT pg_has_role(current_user, 'authenticated', 'USAGE') THEN
    RAISE EXCEPTION 'Platform:CannotProbeAsAuthenticated — % is not a member of authenticated', current_user;
  END IF;

  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
            ORDER BY c.relname
  LOOP
    BEGIN
      PERFORM set_config('role', 'authenticated', true);
      EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', r.relname) INTO n;
      PERFORM set_config('role', coalesce(before, 'none'), true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('role', coalesce(before, 'none'), true);
      relation := r.relname;
      problem  := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.rls_violations() IS
  'Every RLS-guarded table that the role PostgREST connects as cannot read. Derived from pg_class, never enumerated. Found the recursion in migration 403 that no other guard could see.';

REVOKE ALL ON FUNCTION public.rls_violations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_violations() TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE n int; broken text;
BEGIN
  SELECT count(*), string_agg(relation || ': ' || problem, '; ')
    INTO n, broken FROM public.rls_violations();
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 411: % table(s) unreadable as authenticated — %', n, broken;
  END IF;

  -- It has to actually look at something. A version that silently probed no
  -- tables would report zero violations forever, which is the failure mode an
  -- audit cannot afford.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity;
  IF n < 20 THEN
    RAISE EXCEPTION 'Migration 411: only % RLS-guarded tables found — the catalog query is probably wrong', n;
  END IF;

  -- And it has to REPORT a break, not just survive one. A table whose policy
  -- calls a function that reads the table itself is the exact shape of 403.
  CREATE TABLE public.m411_recursive (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  ALTER TABLE public.m411_recursive ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.m411_recursive TO authenticated;
  CREATE POLICY eats_itself ON public.m411_recursive FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.m411_recursive x WHERE x.id = id));

  IF NOT EXISTS (SELECT 1 FROM public.rls_violations() WHERE relation = 'm411_recursive') THEN
    RAISE EXCEPTION 'Migration 411: a self-referential policy went unreported';
  END IF;

  DROP TABLE public.m411_recursive;

  -- The caller comes back as whoever they were.
  IF current_setting('role', true) NOT IN ('none', '') AND current_setting('role', true) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 411: the probe left the session as %', current_setting('role', true);
  END IF;
END $$;

COMMIT;
