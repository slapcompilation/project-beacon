-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 177 — revoke PUBLIC EXECUTE from the two definer fns that had it
--
-- Migration 176 revoked the anon ROLE grant, but get_recent_activity and
-- get_variant_timeline carry EXECUTE granted to PUBLIC (proacl shows the leading
-- `=X/postgres`), so anon still inherited it. REVOKE FROM anon can't remove a
-- PUBLIC grant — it needs REVOKE FROM PUBLIC. authenticated has an explicit grant
-- and keeps access; we re-assert it to be safe. Verified by
-- supabase/tests/security_invariants.sql (now green).
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_recent_activity(integer)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_variant_timeline(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_recent_activity(integer)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_variant_timeline(uuid, integer) TO authenticated;
