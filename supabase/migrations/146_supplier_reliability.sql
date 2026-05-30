-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 146 — Supplier reliability (Phase B item 4)
--
-- The rank_alternative_suppliers tool (in @beacon/reality-graph) ranks
-- candidates by `(on_time_pct ?? 70) / 100` and `1 - |cost_variance_pct ?? 5| / 25`,
-- but neither column existed on suppliers. The reader was forced to map both
-- to null, so the agent fell back to its defaults (70% on-time, 5% variance)
-- for every supplier — ranking collapsed to lead-time only.
--
-- This migration:
--   1. Adds the two metric columns + sample-size + last-computed-at.
--   2. Adds compute_supplier_reliability(p_window_days, p_only_with_data) RPC
--      that derives both from purchase_orders / po_invoices over a recent
--      window. Skip-writes suppliers with no data (preserves NULL state) so
--      the agent uses its conservative defaults until real signal exists.
--   3. Schedules a weekly cron (Sundays 05:00 UTC) to keep them fresh.
--
-- Reader updates (web graphReader.ts + the edge intelligence-cycle reader.ts)
-- ride in the same PR — they select + pass through the real values instead of
-- always returning null.
--
-- Depends on: 001 (suppliers, purchase_orders, po_invoices), 102 (pg_cron)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ───────────────────────────────────────────────────────────────

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS on_time_pct             numeric(5,2),
  ADD COLUMN IF NOT EXISTS cost_variance_pct       numeric(5,2),
  ADD COLUMN IF NOT EXISTS reliability_sample_size int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_computed_at timestamptz;

COMMENT ON COLUMN suppliers.on_time_pct IS
  'Percentage (0-100) of closed POs delivered on or before expected_delivery_date in the recent window. NULL = insufficient data; rank_alternative_suppliers falls back to its conservative default.';
COMMENT ON COLUMN suppliers.cost_variance_pct IS
  'Average |invoice_amount - po_amount| / po_amount * 100 across invoices in the recent window. NULL = no invoices.';
COMMENT ON COLUMN suppliers.reliability_sample_size IS
  'Max sample size feeding the two metrics. Callers can use this as a confidence proxy.';

-- ── 2. compute_supplier_reliability() RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_supplier_reliability(
  p_window_days    int     DEFAULT 90,
  p_only_with_data boolean DEFAULT true
)
RETURNS TABLE (
  supplier_id       uuid,
  on_time_pct       numeric,
  cost_variance_pct numeric,
  sample_size       int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_window_days || ' days')::interval;
  v_row    record;
BEGIN
  FOR v_row IN
    SELECT
      s.id AS sid,
      (
        SELECT round(
          coalesce(
            count(*) FILTER (
              WHERE po.closed_at::date <= po.expected_delivery_date
            )::numeric * 100
            / nullif(count(*), 0),
            NULL
          ),
          2
        )
        FROM purchase_orders po
        WHERE po.supplier_id = s.id
          AND po.closed_at IS NOT NULL
          AND po.expected_delivery_date IS NOT NULL
          AND po.created_at >= v_cutoff
      ) AS on_time,
      (
        SELECT round(
          avg(abs(inv.discrepancy_amount)::numeric / nullif(inv.po_amount, 0) * 100),
          2
        )
        FROM po_invoices inv
        JOIN purchase_orders po ON po.id = inv.po_id
        WHERE po.supplier_id = s.id
          AND inv.created_at >= v_cutoff
          AND inv.po_amount > 0
      ) AS cost_variance,
      greatest(
        coalesce((
          SELECT count(*) FROM purchase_orders po
           WHERE po.supplier_id = s.id
             AND po.created_at >= v_cutoff
             AND po.closed_at IS NOT NULL
        ), 0),
        coalesce((
          SELECT count(*) FROM po_invoices inv
           JOIN purchase_orders po ON po.id = inv.po_id
           WHERE po.supplier_id = s.id
             AND inv.created_at >= v_cutoff
        ), 0)
      )::int AS sample
    FROM suppliers s
  LOOP
    -- Don't overwrite existing values with null when there's no fresh data.
    IF p_only_with_data AND v_row.on_time IS NULL AND v_row.cost_variance IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE suppliers
       SET on_time_pct             = v_row.on_time,
           cost_variance_pct       = v_row.cost_variance,
           reliability_sample_size = v_row.sample,
           reliability_computed_at = now()
     WHERE id = v_row.sid;

    supplier_id       := v_row.sid;
    on_time_pct       := v_row.on_time;
    cost_variance_pct := v_row.cost_variance;
    sample_size       := v_row.sample;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION compute_supplier_reliability(int, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION compute_supplier_reliability(int, boolean) TO authenticated;
GRANT  EXECUTE ON FUNCTION compute_supplier_reliability(int, boolean) TO service_role;

COMMENT ON FUNCTION compute_supplier_reliability(int, boolean) IS
  'Derives on_time_pct + cost_variance_pct for every supplier from PO/invoice history over the recent window. Skips writes when there is no data so the agent keeps its conservative defaults.';

-- ── 3. Weekly cron — Sundays 05:00 UTC ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — supplier-reliability cron not scheduled.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname = 'beacon-supplier-reliability-weekly';

  PERFORM cron.schedule(
    'beacon-supplier-reliability-weekly',
    '0 5 * * 0',
    'SELECT * FROM compute_supplier_reliability(90, true)'
  );
END;
$$;
