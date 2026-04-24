-- ═══════════════════════════════════════════════════════════════════════════════
-- 108 — Supplier Lead-Time Learning
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   suppliers.lead_time_days is a manually-entered static field. Multiple RPCs
--   (get_smart_proposals, compute_optimal_par, get_procurement_proposals) already
--   compute lead times from PO/delivery history but never persist the result.
--   This causes the manual value to drift from reality and prevents variability
--   tracking (stddev) needed for accurate safety stock calculations.
--
--   This migration:
--   1. Extends suppliers with stddev, source, and timestamp columns
--   2. Creates learn_supplier_lead_times() that computes median + stddev from
--      PO history (primary) or delivery history (fallback) and writes back
--   3. Schedules weekly cron to keep lead times fresh
--
-- Depends on: 009 (suppliers), 036 (delivery_events), 051 (lead_time_days),
--             055 (purchase_orders)
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─── 1. Extend suppliers table ───────────────────────────────────────────────

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS lead_time_stddev      numeric     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_time_computed_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_time_source       text        NOT NULL DEFAULT 'manual';

-- Add CHECK constraint separately so it doesn't fail if column already exists with data
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'suppliers_lead_time_source_check'
  ) THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_lead_time_source_check
        CHECK (lead_time_source IN ('manual', 'po_history', 'delivery_history'));
  END IF;
END $$;

COMMENT ON COLUMN suppliers.lead_time_stddev IS
  'Standard deviation of lead time in days. Used by compute_optimal_par() for '
  'safety stock sigma calculations. NULL = insufficient data.';

COMMENT ON COLUMN suppliers.lead_time_computed_at IS
  'When learn_supplier_lead_times() last computed this supplier''s lead time. '
  'NULL = never computed (manual entry only).';

COMMENT ON COLUMN suppliers.lead_time_source IS
  'How lead_time_days was determined: ''manual'' (user entered, never auto-overwritten), '
  '''po_history'' (computed from closed POs), ''delivery_history'' (computed from delivery events).';

-- ─── 2. learn_supplier_lead_times() ──────────────────────────────────────────
-- Computes actual lead times from historical data and writes back to suppliers.
--
-- Priority 1 — PO history (≥3 closed POs with sent_at + closed_at):
--   Uses PERCENTILE_CONT(0.5) (median) of (closed_at - sent_at) in days
--   More robust than mean — outliers (holiday closures, etc.) don't skew results
--
-- Priority 2 — Delivery events (≥3 completed deliveries with actual_date):
--   Uses PERCENTILE_CONT(0.5) of (actual_date - created_at) in days
--
-- Guard: only updates suppliers where lead_time_source != 'manual'.
-- Manually-set lead times are preserved — operators opt into auto-learning
-- by setting lead_time_source = 'po_history' or 'delivery_history'.
--
-- Returns: table of all updates made for audit/transparency.

CREATE OR REPLACE FUNCTION learn_supplier_lead_times()
RETURNS TABLE (
  supplier_id          uuid,
  supplier_name        text,
  old_lead_time        int,
  new_lead_time        int,
  lead_time_stddev     numeric,
  source               text,
  data_points          int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    WITH
    -- ── PO-based lead times per supplier ───────────────────────────────────
    -- Uses sent_at → closed_at (the full procurement cycle the operator experiences)
    po_lt AS (
      SELECT
        po.supplier_id,
        COUNT(*)::int                                              AS po_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
        ))::int                                                    AS median_lt,
        ROUND(STDDEV_POP(
          EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
        )::numeric, 1)                                             AS stddev_lt
      FROM purchase_orders po
      WHERE po.closed_at > po.sent_at
        AND po.status IN ('partially_received', 'closed')
        AND po.created_at >= NOW() - INTERVAL '1 year'
      GROUP BY po.supplier_id
      HAVING COUNT(*) >= 3
    ),

    -- ── Delivery-based lead times per supplier ─────────────────────────────
    -- Fallback: uses actual_date - created_at (simpler, fewer constraints)
    de_lt AS (
      SELECT
        de.supplier_id,
        COUNT(*)::int                                              AS de_count,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY (de.actual_date - de.created_at::date)
        ))::int                                                    AS median_lt,
        ROUND(STDDEV_POP(
          (de.actual_date - de.created_at::date)::numeric
        ), 1)                                                      AS stddev_lt
      FROM delivery_events de
      WHERE de.actual_date IS NOT NULL
        AND de.created_at >= NOW() - INTERVAL '1 year'
      GROUP BY de.supplier_id
      HAVING COUNT(*) >= 3
    ),

    -- ── Merge: PO history preferred, delivery fallback ─────────────────────
    computed AS (
      SELECT
        s.id                                                       AS supplier_id,
        s.name                                                     AS supplier_name,
        s.lead_time_days                                           AS old_lt,
        CASE
          WHEN polt.median_lt IS NOT NULL THEN polt.median_lt
          WHEN delt.median_lt IS NOT NULL THEN delt.median_lt
          ELSE NULL
        END                                                        AS new_lt,
        CASE
          WHEN polt.stddev_lt IS NOT NULL THEN polt.stddev_lt
          WHEN delt.stddev_lt IS NOT NULL THEN delt.stddev_lt
          ELSE NULL
        END                                                        AS new_stddev,
        CASE
          WHEN polt.median_lt IS NOT NULL THEN 'po_history'
          WHEN delt.median_lt IS NOT NULL THEN 'delivery_history'
          ELSE NULL
        END                                                        AS new_source,
        COALESCE(polt.po_count, delt.de_count, 0)                  AS data_points
      FROM suppliers s
      LEFT JOIN po_lt polt ON polt.supplier_id = s.id
      LEFT JOIN de_lt delt ON delt.supplier_id = s.id
      WHERE s.lead_time_source != 'manual'  -- never overwrite manual entries
    )

    SELECT * FROM computed WHERE new_lt IS NOT NULL
  LOOP
    -- Apply the computed lead time
    UPDATE suppliers
       SET lead_time_days       = v_row.new_lt,
           lead_time_stddev     = v_row.new_stddev,
           lead_time_source     = v_row.new_source,
           lead_time_computed_at = NOW()
     WHERE id = v_row.supplier_id;

    -- Return the change for audit
    supplier_id      := v_row.supplier_id;
    supplier_name    := v_row.supplier_name;
    old_lead_time    := v_row.old_lt;
    new_lead_time    := v_row.new_lt;
    lead_time_stddev := v_row.new_stddev;
    source           := v_row.new_source;
    data_points      := v_row.data_points;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION learn_supplier_lead_times() TO authenticated;
GRANT EXECUTE ON FUNCTION learn_supplier_lead_times() TO service_role;

-- ─── 3. Weekly cron: Sundays 04:15 UTC ──────────────────────────────────────
-- Runs 15 minutes after the weekly PAR update (04:00) so PAR can use the fresh
-- lead times on the next cycle.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — weekly lead-time learning not scheduled. Enable pg_cron and re-run.';
    RETURN;
  END IF;

  -- Clear stale job if exists
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname = 'beacon-weekly-lt-learning';

  PERFORM cron.schedule(
    'beacon-weekly-lt-learning',
    '15 4 * * 0',
    'SELECT * FROM learn_supplier_lead_times()'
  );

  RAISE NOTICE 'Weekly lead-time learning scheduled: Sundays 04:15 UTC.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - suppliers gains: lead_time_stddev, lead_time_computed_at, lead_time_source
--   - learn_supplier_lead_times(): median + stddev from PO or delivery history
--   - Manual entries (lead_time_source = 'manual') are never overwritten
--   - Weekly cron: Sundays 04:15 UTC
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Lead-Time Source Hierarchy:                                                │
-- │   1. PO history (sent_at → closed_at, ≥3 POs, last 1 year) — preferred    │
-- │   2. Delivery events (created_at → actual_date, ≥3 events) — fallback     │
-- │   3. Manual entry (suppliers.lead_time_days) — preserved if source=manual  │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════
