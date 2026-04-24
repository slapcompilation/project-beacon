-- ═══════════════════════════════════════════════════════════════════════════════
-- 107 — Wire Preemptive Restocking into Intelligence Cycle
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   generate_preemptive_restocks() (migration 103) creates auto-proposed restocks
--   when occupancy-driven demand spikes threaten stockouts — but it was never
--   added to run_intelligence_cycle(). This migration wires it in as step 3,
--   after auto_propose_restocks() (step 2) so the has_open_request guard
--   prevents duplicates.
--
-- Depends on: 102 (run_intelligence_cycle), 103 (generate_preemptive_restocks)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION run_intelligence_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created     int := 0;
  v_proposals_created  int := 0;
  v_preemptive_created int := 0;
  v_escalations        int := 0;
  v_discrepancies      int := 0;
  v_start              timestamptz := clock_timestamp();
BEGIN
  -- 1. Detect anomalies and fan out alerts to all hotel members
  SELECT auto_create_alerts() INTO v_alerts_created;

  -- 2. Generate restock proposals for items approaching depletion (baseline)
  SELECT auto_propose_restocks() INTO v_proposals_created;

  -- 3. Generate preemptive restocks for occupancy+event-driven demand spikes
  --    Runs AFTER step 2 so has_open_request guard prevents duplicates.
  --    Only fires when demand_spike = true (combined multiplier > 1.15).
  SELECT generate_preemptive_restocks() INTO v_preemptive_created;

  -- 4. Escalate stale approval requests past timeout
  PERFORM escalate_stale_approvals();

  -- 5. Detect PO 3-way match discrepancies
  SELECT detect_po_discrepancies(2) INTO v_discrepancies;

  -- 6. Auto-approve eligible restocks (guardrailed)
  PERFORM auto_approve_eligible_restocks();

  -- 7. Auto-approve matched invoices within tolerance
  PERFORM auto_approve_matched_invoices();

  RETURN jsonb_build_object(
    'alerts_created',     v_alerts_created,
    'proposals_created',  v_proposals_created,
    'preemptive_created', v_preemptive_created,
    'discrepancies',      v_discrepancies,
    'duration_ms',        EXTRACT(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION run_intelligence_cycle() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Updated agent loop steps:
--
-- ┌────┬──────────────────────────────────────────────────────────────────────┐
-- │  # │ Agent Step                                                          │
-- ├────┼──────────────────────────────────────────────────────────────────────┤
-- │  1 │ auto_create_alerts()              — anomaly detection + fan-out     │
-- │  2 │ auto_propose_restocks()           — baseline depletion proposals    │
-- │  3 │ generate_preemptive_restocks()    — occupancy+event demand spikes   │
-- │  4 │ escalate_stale_approvals()        — timeout escalation              │
-- │  5 │ detect_po_discrepancies(2)        — 3-way match exceptions          │
-- │  6 │ auto_approve_eligible_restocks()  — guardrailed auto-approval       │
-- │  7 │ auto_approve_matched_invoices()   — invoice tolerance auto-approve  │
-- └────┴──────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════
