-- 423 — TRUNCATE is not subject to row-level security
--
-- Found by a test asserting that `object_edits` is append-only. It is not, and
-- neither is anything else.
--
-- Every RLS policy we have governs SELECT, INSERT, UPDATE and DELETE. **TRUNCATE
-- is governed by none of them** — Postgres does not apply row security to it. So
-- a table's policies can be perfect and one statement still empties it.
--
-- Supabase's default ACL grants `arwdDxtm` — every privilege including TRUNCATE
-- and TRIGGER — to `anon`, `authenticated` and `service_role` on every new table
-- in `public`. Measured before this migration:
--
--     public tables: 49   with TRUNCATE granted to authenticated: 49
--
-- That is not something any migration here asked for; it is the default, and
-- every `GRANT SELECT, INSERT ON …` we wrote was additive on top of it. Granting
-- less never took anything away.
--
-- ── WHAT AN APPLICATION ROLE ACTUALLY NEEDS ──────────────────────────────────
-- SELECT, INSERT, UPDATE, DELETE — each then filtered by policy. It needs none
-- of:
--   TRUNCATE    bypasses RLS entirely
--   TRIGGER     lets a caller attach code to a table
--   REFERENCES  lets a caller create foreign keys into it
--
-- This revokes those three from `anon` and `authenticated` everywhere, changes
-- the default so new tables do not receive them, and adds an audit so the
-- question stays answered rather than answered once.
--
-- The append-only guarantee this began with also holds now: `object_edits` grants
-- SELECT and INSERT, has no UPDATE or DELETE policy, and can no longer be
-- truncated. "There is no mechanism to directly undo a single user edit or
-- deletion" (object-edits/how-edits-applied) is finally true here too.

BEGIN;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- And for everything created after this.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- `postgres` owns the default ACL that Supabase installed, so the change has to
-- be made as that role too or new tables keep inheriting the old grant.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- ── and the one table that is append-only by design ─────────────────────────
-- `object_edits` granted SELECT and INSERT in 422, which — being additive over
-- the default — left UPDATE and DELETE in place. RLS denied them (there is no
-- policy for either), so nothing was reachable; but a guarantee that rests on
-- the absence of a policy is one deletion of a policy away from gone. State it
-- in the grant as well.
REVOKE UPDATE, DELETE ON public.object_edits FROM anon, authenticated;

-- ── the audit ────────────────────────────────────────────────────────────────
-- Beside rls_violations(). Same shape, same reason: derived from the catalog,
-- never a list, so a table added tomorrow is covered without anyone remembering.

CREATE OR REPLACE FUNCTION public.grant_violations()
RETURNS TABLE (relation text, grantee text, privilege text, problem text)
LANGUAGE sql STABLE AS $$
  SELECT g.table_name::text, g.grantee::text, g.privilege_type::text,
         CASE g.privilege_type
           WHEN 'TRUNCATE'   THEN 'TRUNCATE is not subject to row-level security — one statement empties the table'
           WHEN 'TRIGGER'    THEN 'TRIGGER lets the caller attach code to this table'
           WHEN 'REFERENCES' THEN 'REFERENCES lets the caller create foreign keys into this table'
         END
    FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public'
     AND g.grantee IN ('anon', 'authenticated')
     AND g.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
$$;

COMMENT ON FUNCTION public.grant_violations() IS
  'Privileges an application role holds that no policy can restrain. TRUNCATE is the dangerous one: row-level security does not apply to it.';

REVOKE ALL ON FUNCTION public.grant_violations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_violations() TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE n int; t text;
BEGIN
  SELECT count(*) INTO n FROM public.grant_violations();
  IF n <> 0 THEN
    SELECT string_agg(DISTINCT relation, ', ') INTO t FROM public.grant_violations();
    RAISE EXCEPTION 'Migration 423: % grant(s) survived on %', n, t;
  END IF;

  -- It has to be looking at something. A query that matched nothing would report
  -- clean forever, which is the failure mode an audit cannot afford.
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
  IF n < 20 THEN
    RAISE EXCEPTION 'Migration 423: only % tables readable by authenticated — the audit query is probably wrong', n;
  END IF;

  -- And the guarantee this started from: an edit log that cannot be rewritten.
  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO t
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'object_edits' AND grantee = 'authenticated';
  IF t <> 'INSERT,SELECT' THEN
    RAISE EXCEPTION 'Migration 423: object_edits grants %, expected INSERT,SELECT', t;
  END IF;
END $$;

COMMIT;
