-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 180 — get_overstock_candidates: service_role only (fix cross-tenant leak)
--
-- 179 granted this SECURITY DEFINER function to `authenticated`. It takes
-- p_hotel_id with NO caller-scope check, so an authenticated user from hotel A
-- could read hotel B's stock + consumption by passing B's id — the exact
-- cross-tenant leak class fixed for get_expiring_batches (#226). Only the cron
-- (service_role) calls it, so lock it there. If a web caller ever needs it, add
-- a coalesce(auth_hotel_id(), p_hotel_id) scope guard then.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_overstock_candidates(uuid, numeric) FROM authenticated;
-- service_role retains EXECUTE (granted in 179); anon already has none.
