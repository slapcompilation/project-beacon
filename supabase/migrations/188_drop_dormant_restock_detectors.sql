-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 188 — drop the dormant legacy restock detectors
--
-- auto_propose_restocks + generate_preemptive_restocks predate the typed-agent
-- restock path (runIntelligenceCycle + restock_advisor). They were removed from
-- run_intelligence_cycle in migration 144 (they read auth_hotel_id(), NULL under
-- pg_cron → no-ops on the cron path). Verified (2026-07) they have NO remaining
-- caller: no web caller, no other function references them, no trigger, no
-- pg_cron job. Both are SECURITY DEFINER — dropping them removes dead
-- privileged surface that could otherwise emit restock proposals conflicting
-- with the agent path.
--
-- auto_create_alerts is intentionally KEPT — it is the live alerts engine (the
-- web runs it on mount + a realtime refresh keeps Eye · Alerts fresh).
--
-- Idempotent (DROP ... IF EXISTS), so re-applying on deploy is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.auto_propose_restocks(integer, integer);
DROP FUNCTION IF EXISTS public.generate_preemptive_restocks(integer, numeric);
