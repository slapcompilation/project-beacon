-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 144 — Phase A cleanup: prune the SQL intelligence cycle to its
-- actually-working steps, and pin search_path on AIP helper functions.
--
-- After migration 143, the typed restock_advisor agent (intelligence-cycle
-- edge function, scheduled as beacon-agent-intelligence-cycle) owns unattended
-- proposing. The three hotel-scoped SQL detectors that used to run inside
-- run_intelligence_cycle (auto_create_alerts, auto_propose_restocks,
-- generate_preemptive_restocks) all derive their hotel from auth_hotel_id(),
-- which is NULL under pg_cron — so they were no-ops on the cron path. They
-- remain in-app callable for authenticated users (the web app uses two of
-- them), so we keep the functions and just stop the cron from calling them.
--
-- Migration 142 added an observability warn for the dead-step state. With the
-- dead steps removed from the cron path, that warn no longer applies — drop it.
--
-- Also pins search_path on the 8 helper functions get_advisors flagged with
-- function_search_path_mutable. All reference public tables unqualified, so we
-- pin to `public` (matches the SECURITY DEFINER convention used elsewhere).
--
-- Depends on: 102, 142, 143
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Prune run_intelligence_cycle to working steps ─────────────────────────

CREATE OR REPLACE FUNCTION run_intelligence_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discrepancies int := 0;
  v_start         timestamptz := clock_timestamp();
BEGIN
  -- Hotel-scoped detectors (auto_create_alerts, auto_propose_restocks,
  -- generate_preemptive_restocks) were removed from this cron path because
  -- they read auth_hotel_id() which is NULL here. The typed restock_advisor
  -- agent now owns unattended proposing (see edge fn intelligence-cycle).
  -- The functions themselves are still callable from authenticated in-app
  -- contexts (apps/web/.../notifications/api + restock/api use them).

  PERFORM escalate_stale_approvals();
  SELECT  detect_po_discrepancies(2)         INTO v_discrepancies;
  PERFORM auto_approve_eligible_restocks();
  PERFORM auto_approve_matched_invoices();

  RETURN jsonb_build_object(
    'discrepancies', v_discrepancies,
    'duration_ms',   EXTRACT(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION run_intelligence_cycle() TO service_role;

-- ── 2. Pin search_path on the 8 flagged helper functions ─────────────────────
-- All reference public schema tables; pin to `public` to clear the
-- function_search_path_mutable advisor warning.

ALTER FUNCTION record_approved_answer_hit(uuid)                SET search_path = public;
ALTER FUNCTION attach_proposal_to_case(uuid, uuid)             SET search_path = public;
ALTER FUNCTION detach_proposal_from_case(uuid, uuid)           SET search_path = public;
ALTER FUNCTION append_simulated_action(uuid, jsonb)            SET search_path = public;
ALTER FUNCTION remove_simulated_action(uuid, int)              SET search_path = public;
ALTER FUNCTION match_approved_answers(uuid, vector, double precision, integer) SET search_path = public;
ALTER FUNCTION match_document_chunks(uuid, vector, double precision, integer)  SET search_path = public;
ALTER FUNCTION aip_signal_counts(uuid)                         SET search_path = public;
