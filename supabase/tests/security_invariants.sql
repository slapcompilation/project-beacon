-- ─────────────────────────────────────────────────────────────────────────────
-- Security invariants — self-apply regression guard for the data layer.
--
-- We sell immutable audit + scoped access; our own RPCs meet the same bar. This
-- asserts catalog-level invariants over every public SECURITY DEFINER function —
-- the class of bug that already bit us twice (get_expiring_batches let authed
-- users cross-hotel-read; seven more fns carried a baseline anon EXECUTE grant).
--
-- Pure pg_catalog checks, no auth context or pgTAP needed. RAISES on violation,
-- so it's pass/fail. Run after any migration that adds or changes functions,
-- alongside get_advisors:
--
--   supabase db execute -f supabase/tests/security_invariants.sql      (CLI)
--   -- or paste into the SQL editor / run via the Supabase MCP execute_sql
--
-- Invariant 1: no public SECURITY DEFINER function is anon-executable. None of
--   ours are public — anon EXECUTE on a definer-rights function is always a leak.
-- Invariant 2: every public SECURITY DEFINER function pins search_path (else a
--   caller-controlled search_path can hijack unqualified references).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_anon   text;
  v_nopath text;
BEGIN
  SELECT string_agg(format('%s.%s', n.nspname, p.proname), ', ' ORDER BY p.proname)
    INTO v_anon
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  SELECT string_agg(format('%s.%s', n.nspname, p.proname), ', ' ORDER BY p.proname)
    INTO v_nopath
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    );

  IF v_anon IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 1 VIOLATED — anon can EXECUTE SECURITY DEFINER function(s): %. Revoke anon (see migration 176).',
      v_anon;
  END IF;

  IF v_nopath IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 2 VIOLATED — SECURITY DEFINER function(s) without a pinned search_path: %. Add SET search_path TO ''public''.',
      v_nopath;
  END IF;

  RAISE NOTICE 'Security invariants OK — no anon-executable or unpinned SECURITY DEFINER functions in public.';
END $$;
