-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 250 — revoke the default grants on 249's trigger function.
--
-- security_invariants.sql invariant 1 caught this the moment 249 landed: a new
-- SECURITY DEFINER function inherits Supabase's baseline EXECUTE grant to
-- PUBLIC, which makes it anon-callable over /rest/v1/rpc. Same finding as
-- migrations 193 and 242, and the reason invariant 1 exists.
--
-- A trigger function is invoked by the trigger as the table owner and is never
-- an RPC, so nobody needs EXECUTE on it.
--
-- Forward-only: 249 is already applied, so its checksum is recorded and editing
-- it would (correctly) fail the drift guard. A mistake is corrected by a new
-- migration.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.enforce_automation_cohort_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_automation_cohort_subject() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_automation_cohort_subject() FROM authenticated;
