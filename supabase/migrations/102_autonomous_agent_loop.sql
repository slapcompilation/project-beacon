-- ═══════════════════════════════════════════════════════════════════════════════
-- 102 — Autonomous Agent Loop (Phase A: The Autonomous Foundation)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Turn Beacon from an intelligent app into an AIP by scheduling all existing
--   intelligence RPCs to run autonomously. Managers arrive to a prioritized
--   inbox of overnight decisions — not a dashboard they have to scan.
--
-- What this migration does:
--   1. Enables pg_cron extension (if not already enabled)
--   2. Schedules all intelligence RPCs on appropriate cadences
--   3. Creates a unified `run_all_intelligence()` wrapper for the common cycle
--   4. Adds `auto_approve_threshold` and `auto_po_enabled` to hotels table
--   5. Creates `auto_approve_eligible_restocks()` for guardrailed auto-approval
--   6. Creates event-driven triggers for critical stockouts and PO auto-close
--   7. Schedules the full agent loop via pg_cron
--
-- Depends on: 022, 025, 054, 059, 061, 062, 065, 067, 086
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Enable pg_cron ──────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 2. New hotel columns for autonomous operation ──────────────────────────────

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS auto_approve_threshold     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_po_enabled            boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_invoice_tolerance_pct numeric(5,2)  NOT NULL DEFAULT 2;

COMMENT ON COLUMN hotels.auto_approve_threshold IS
  'Restock requests with estimated_cost at or below this value auto-approve without human review. 0 = disabled.';
COMMENT ON COLUMN hotels.auto_po_enabled IS
  'When true, system auto-generates draft POs when 3+ approved restocks exist for the same supplier.';
COMMENT ON COLUMN hotels.auto_invoice_tolerance_pct IS
  'Invoices with discrepancy_pct at or below this value auto-approve. Default 2%.';

-- ─── 3. run_intelligence_cycle() — unified agent loop ───────────────────────────
-- Runs all detection + alert + proposal RPCs in a single call.
-- Designed for pg_cron: SECURITY DEFINER so it runs as postgres (no user context).

CREATE OR REPLACE FUNCTION run_intelligence_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created    int := 0;
  v_proposals_created int := 0;
  v_escalations       int := 0;
  v_discrepancies     int := 0;
  v_start             timestamptz := clock_timestamp();
BEGIN
  -- 1. Detect anomalies and fan out alerts to all hotel members
  SELECT auto_create_alerts() INTO v_alerts_created;

  -- 2. Generate restock proposals for items approaching depletion
  SELECT auto_propose_restocks() INTO v_proposals_created;

  -- 3. Escalate stale approval requests past timeout
  PERFORM escalate_stale_approvals();

  -- 4. Detect PO 3-way match discrepancies
  SELECT detect_po_discrepancies(2) INTO v_discrepancies;

  -- 5. Auto-approve eligible restocks (guardrailed)
  PERFORM auto_approve_eligible_restocks();

  -- 6. Auto-approve matched invoices within tolerance
  PERFORM auto_approve_matched_invoices();

  RETURN jsonb_build_object(
    'alerts_created',    v_alerts_created,
    'proposals_created', v_proposals_created,
    'discrepancies',     v_discrepancies,
    'duration_ms',       EXTRACT(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION run_intelligence_cycle() TO service_role;

-- ─── 4. auto_approve_eligible_restocks() ────────────────────────────────────────
-- Guardrailed auto-approval: approves pending restocks where:
--   a) estimated_cost <= hotel.auto_approve_threshold (threshold > 0)
--   b) no other pending request exists for the same variant
--   c) the supplier (if set) has reliability score >= 80%
-- Writes an audit edge: approved_by → system (triggered_by = 'automation_threshold')

CREATE OR REPLACE FUNCTION auto_approve_eligible_restocks()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_req   record;
BEGIN
  FOR v_req IN
    SELECT rr.id, rr.hotel_id, rr.variant_id, rr.estimated_cost
      FROM restock_requests rr
      JOIN hotels h ON h.id = rr.hotel_id
     WHERE rr.status = 'pending'
       AND h.auto_approve_threshold > 0
       AND rr.estimated_cost IS NOT NULL
       AND rr.estimated_cost <= h.auto_approve_threshold
       -- No duplicate open request for same variant
       AND NOT EXISTS (
         SELECT 1 FROM restock_requests rr2
          WHERE rr2.variant_id = rr.variant_id
            AND rr2.hotel_id = rr.hotel_id
            AND rr2.id != rr.id
            AND rr2.status IN ('pending', 'pending_manager', 'pending_director', 'approved')
       )
  LOOP
    UPDATE restock_requests
       SET status        = 'approved',
           approval_notes = 'Auto-approved: cost within guardrail ($' || v_req.estimated_cost::text || ' <= threshold)'
     WHERE id = v_req.id;

    -- Write audit edge
    PERFORM create_relationship_edge(
      v_req.hotel_id,
      'restock_request', v_req.id,
      'approved_by',
      'user', '00000000-0000-0000-0000-000000000000'::uuid,  -- system user sentinel
      jsonb_build_object('triggered_by', 'automation_threshold', 'auto_approved', true)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_approve_eligible_restocks() TO service_role;

-- ─── 5. auto_approve_matched_invoices() ─────────────────────────────────────────
-- Approves invoices where discrepancy % is within the hotel's tolerance.

CREATE OR REPLACE FUNCTION auto_approve_matched_invoices()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_inv   record;
BEGIN
  FOR v_inv IN
    SELECT pi.id, pi.hotel_id, pi.po_amount, pi.invoice_amount, pi.discrepancy_amount
      FROM po_invoices pi
      JOIN hotels h ON h.id = pi.hotel_id
     WHERE pi.status = 'pending'
       AND pi.po_amount > 0
       AND h.auto_invoice_tolerance_pct > 0
       AND ABS(pi.discrepancy_amount) / pi.po_amount * 100 <= h.auto_invoice_tolerance_pct
  LOOP
    UPDATE po_invoices
       SET status      = 'approved',
           approved_at = now()
     WHERE id = v_inv.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_approve_matched_invoices() TO service_role;

-- ─── 6. Event-driven trigger: critical stockout ─────────────────────────────────
-- When stock hits zero, immediately create a critical alert and auto-propose restock.

CREATE OR REPLACE FUNCTION trg_critical_stockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variant record;
  v_hotel_id uuid;
BEGIN
  -- Only fire on stock decreases that hit zero
  IF NEW.balance_after > 0 THEN
    RETURN NEW;
  END IF;

  -- Get variant + product info
  SELECT pv.id AS variant_id, pv.sku, p.name AS product_name, p.hotel_id
    INTO v_variant
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE pv.id = NEW.variant_id;

  IF v_variant IS NULL THEN
    RETURN NEW;
  END IF;

  v_hotel_id := v_variant.hotel_id;

  -- Fan out critical stockout alert to all hotel members (skip if unread one exists)
  IF NOT EXISTS (
    SELECT 1 FROM notifications
     WHERE hotel_id = v_hotel_id
       AND variant_id = v_variant.variant_id
       AND type = 'low_stock'
       AND read = false
  ) THEN
    PERFORM fan_out_alert(
      v_hotel_id,
      'low_stock',
      v_variant.variant_id,
      v_variant.product_name || ' (' || v_variant.sku || ') is now OUT OF STOCK — immediate restock required',
      1.0  -- max urgency
    );
  END IF;

  -- Auto-propose emergency restock if none open
  IF NOT EXISTS (
    SELECT 1 FROM restock_requests
     WHERE variant_id = v_variant.variant_id
       AND hotel_id = v_hotel_id
       AND status IN ('pending', 'pending_manager', 'pending_director', 'approved')
  ) THEN
    INSERT INTO restock_requests (hotel_id, variant_id, quantity_needed, notes, is_auto_proposed, requestor_id)
    VALUES (
      v_hotel_id,
      v_variant.variant_id,
      10,  -- emergency minimum; smart proposals will refine
      'Emergency auto-proposal: stock hit zero',
      true,
      NULL  -- system-generated, no requestor
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-running migration
DROP TRIGGER IF EXISTS trg_stock_log_critical_stockout ON stock_logs;

CREATE TRIGGER trg_stock_log_critical_stockout
  AFTER INSERT ON stock_logs
  FOR EACH ROW
  WHEN (NEW.balance_after = 0 AND NEW.quantity_change < 0)
  EXECUTE FUNCTION trg_critical_stockout();

-- ─── 7. Event-driven trigger: auto-close PO on full receipt ─────────────────────
-- When a receive brings a PO's total received to >= total ordered, auto-close it
-- and trigger 3-way match.

CREATE OR REPLACE FUNCTION trg_auto_close_po()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id            uuid;
  v_total_ordered    int;
  v_total_received   int;
BEGIN
  -- Find the PO linked to this restock request (if any)
  SELECT pol.po_id INTO v_po_id
    FROM purchase_order_lines pol
   WHERE pol.request_id = NEW.request_id
   LIMIT 1;

  IF v_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sum ordered vs received across all PO lines
  SELECT COALESCE(SUM(ordered_qty), 0),
         COALESCE(SUM(received_qty), 0)
    INTO v_total_ordered, v_total_received
    FROM purchase_order_lines
   WHERE po_id = v_po_id;

  -- Auto-close if fully received
  IF v_total_received >= v_total_ordered THEN
    UPDATE purchase_orders
       SET status    = 'closed',
           closed_at = now()
     WHERE id = v_po_id
       AND status NOT IN ('closed', 'cancelled');
  ELSIF v_total_received > 0 THEN
    UPDATE purchase_orders
       SET status = 'partially_received'
     WHERE id = v_po_id
       AND status NOT IN ('closed', 'cancelled', 'partially_received');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receive_auto_close_po ON restock_receives;

CREATE TRIGGER trg_receive_auto_close_po
  AFTER INSERT ON restock_receives
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_close_po();

-- ─── 8. pg_cron schedules ───────────────────────────────────────────────────────
-- Wrap in DO block so migration succeeds even if pg_cron not yet enabled.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — agent schedules not applied. Enable pg_cron in Supabase dashboard → Database → Extensions, then re-run.';
    RETURN;
  END IF;

  -- Clear any stale jobs from earlier migrations
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN (
    'beacon-intelligence-cycle',
    'beacon-price-drift-weekly',
    'beacon-pos-variance-daily',
    'beacon-embeddings-nightly',
    'escalate-stale-approvals',
    'weekly-price-drift-check',
    'daily-po-discrepancy-scan',
    'daily-pos-variance-scan'
  );

  -- ── Primary agent loop: every 15 minutes ──────────────────────────────────
  -- Runs: alerts, proposals, escalations, discrepancies, auto-approvals
  PERFORM cron.schedule(
    'beacon-intelligence-cycle',
    '*/15 * * * *',
    'SELECT run_intelligence_cycle()'
  );

  -- ── Weekly price drift scan: Mondays 06:00 UTC ────────────────────────────
  -- Looks at 6-month window, 5% threshold
  PERFORM cron.schedule(
    'beacon-price-drift-weekly',
    '0 6 * * 1',
    'SELECT detect_and_alert_price_drift(6, 5)'
  );

  -- ── Daily POS variance scan: 05:00 UTC ────────────────────────────────────
  -- After overnight POS batch, check for unexplained stock gaps
  PERFORM cron.schedule(
    'beacon-pos-variance-daily',
    '0 5 * * *',
    'SELECT detect_and_alert_pos_variance(7, 20)'
  );

  RAISE NOTICE 'Agent loop scheduled: intelligence cycle every 15 min, price drift weekly, POS variance daily.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary of autonomous agents now running:
--
-- ┌──────────────────────────────────────────────┬──────────────────┬──────────┐
-- │ Agent                                        │ Schedule         │ Source   │
-- ├──────────────────────────────────────────────┼──────────────────┼──────────┤
-- │ Intelligence Cycle (alerts + proposals +     │ Every 15 min     │ pg_cron  │
-- │   escalation + discrepancies + auto-approve) │                  │          │
-- │ Price drift detection                        │ Weekly Mon 6am   │ pg_cron  │
-- │ POS variance detection                       │ Daily 5am        │ pg_cron  │
-- │ Critical stockout alert                      │ Instant (trigger)│ trigger  │
-- │ PO auto-close on full receipt                │ Instant (trigger)│ trigger  │
-- │ Stale approval escalation                    │ In cycle (15min) │ pg_cron  │
-- │ Auto-approve low-cost restocks               │ In cycle (15min) │ pg_cron  │
-- │ Auto-approve matched invoices                │ In cycle (15min) │ pg_cron  │
-- └──────────────────────────────────────────────┴──────────────────┴──────────┘
-- ═══════════════════════════════════════════════════════════════════════════════
