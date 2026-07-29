-- Recovered from supabase_migrations version 20260417073219.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Update the intelligence cycle to include Phase C and D functions
CREATE OR REPLACE FUNCTION run_intelligence_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created    int := 0;
  v_proposals_created int := 0;
  v_discrepancies     int := 0;
  v_preemptive        int := 0;
  v_outcomes_scored   int := 0;
  v_thresholds_updated int := 0;
  v_start             timestamptz := clock_timestamp();
BEGIN
  -- Phase A: Core intelligence
  SELECT auto_create_alerts() INTO v_alerts_created;
  SELECT auto_propose_restocks() INTO v_proposals_created;
  PERFORM escalate_stale_approvals();
  SELECT detect_po_discrepancies(2) INTO v_discrepancies;
  PERFORM auto_approve_eligible_restocks();
  PERFORM auto_approve_matched_invoices();

  -- Phase C: Predictive operations (occupancy-driven demand)
  -- generate_preemptive_restocks requires auth_hotel_id() context,
  -- so it runs per-hotel via the scheduled function, not here.
  -- Keeping the slot for future SECURITY DEFINER variant.

  -- Phase D: Feedback flywheel
  SELECT compute_proposal_outcomes() INTO v_outcomes_scored;
  SELECT update_learned_thresholds() INTO v_thresholds_updated;

  RETURN jsonb_build_object(
    'alerts_created',      v_alerts_created,
    'proposals_created',   v_proposals_created,
    'discrepancies',       v_discrepancies,
    'outcomes_scored',     v_outcomes_scored,
    'thresholds_updated',  v_thresholds_updated,
    'duration_ms',         EXTRACT(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;
