-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 176 — revoke anon EXECUTE from the remaining SECURITY DEFINER fns
--
-- Self-apply hardening (the bug class that bit us on get_expiring_batches): a
-- SECURITY DEFINER function with a baseline anon EXECUTE grant runs as the
-- definer for the anon role. These seven are all authenticated/admin operations
-- (policy writes, demo seeding, scoped reads, supplier compute) — none are
-- public. They're also internally role/auth_hotel_id-gated, so this is defense
-- in depth, and it clears the anon-SECURITY-DEFINER advisor for them. authenticated
-- keeps EXECUTE. Guarded going forward by supabase/tests/security_invariants.sql.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.compute_supplier_reliability(integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_agent_cycle_history(integer)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_activity(integer)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_variant_timeline(uuid, integer)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_hotel_data(uuid, integer, boolean)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_world(uuid, integer, boolean)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_org_policy(jsonb)                          FROM anon;
