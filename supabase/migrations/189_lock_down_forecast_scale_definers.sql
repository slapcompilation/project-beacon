-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 189 — lock down forecast + scale-rig SECURITY DEFINER functions
--
-- Migrations 183–187 shipped forecast-observation, scale-rig, and seed RPCs as
-- SECURITY DEFINER but kept the default anon/authenticated EXECUTE grants. The
-- self-apply guard (supabase/tests/security_invariants.sql, Invariant 1) flags
-- them: anon EXECUTE on a definer-rights function is the cross-tenant leak class
-- (same as migrations 176/181). These are the 7 `anon_security_definer_function
-- _executable` advisor warnings.
--
-- forecast_gradeable_variants is called by the web (authenticated) and already
-- scope-gates its hotel arg (hotel_is_in_user_scope), so keep authenticated and
-- only revoke anon. The other six have no web/authenticated caller (the
-- forecast-observe cron was unscheduled in 186; the seed + scale-rig fns are
-- service-role/admin tools) → revoke anon + authenticated, leaving them
-- service-role-only (service_role keeps its own grant, so cron/edge fns still
-- work).
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.forecast_gradeable_variants(uuid, integer)             FROM anon;

REVOKE EXECUTE ON FUNCTION public.backfill_forecast_observations(uuid, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_current_forecasts(uuid, integer)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_due_forecast_observations(uuid)                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_booking_forecasts(uuid, integer)             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_scale_test(integer, integer, integer)             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.teardown_scale_test()                                  FROM anon, authenticated;
