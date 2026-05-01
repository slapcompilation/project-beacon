-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 117 — pos_sales accelerated-depletion trigger (Phase A2)
--
-- Layer: Eye (anomaly detection) + Flow (alert plumbing)
-- Scope: hotel
-- Cadence: on-event (trigger, fires per INSERT statement on pos_sales)
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase A2 row 5: "pos_sales batch INSERT → re-compute
-- days_until_zero for affected variants → alert if depletion accelerated".
-- Today the every-15-min cycle catches *low* days_until_zero, but it doesn't
-- distinguish "low for weeks" from "suddenly accelerated by today's sales".
-- A wedding rush, a bus tour, or a kitchen-recipe change can burn a week of
-- inventory in an hour — operators need that signal in seconds, not 15 min.
--
-- Signal definition
-- ─────────────────
-- A variant is "accelerated" if, within the same hotel:
--   • the 7-day rolling daily consumption rate is at least 1.5× the 30-day rate
--     (using stock_logs INSERT history — pos_sales ingests through stock_logs
--     normally; we look at the realized signal not just the trigger payload),
--   • AND days_until_zero (current_stock ÷ 7d rate) is < 14,
--   • AND the variant was actually affected by THIS batch (via menu_item_ingredients).
-- Dedup: skip if an unread `accelerated_depletion` alert already exists for
-- this variant in the last 6 hours.
--
-- Per CLAUDE.md self-apply: every emitted alert carries a confidence_basis-style
-- inline narrative ("7d rate 12.4 u/d vs 30d rate 6.0 u/d → 2.07× acceleration").
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Extend notifications.type CHECK to include the new alert type.
--    (Smoke test caught this — inserts were rejected by the existing CHECK.)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'low_stock'::text, 'expiry'::text, 'restock_request'::text,
    'waste_spike'::text, 'pos_variance'::text, 'po_discrepancy'::text,
    'contract_expiry'::text, 'approval'::text, 'system'::text,
    'predicted_outage'::text, 'waste_alert'::text, 'consumption_spike'::text,
    'price_drift'::text,
    'accelerated_depletion'::text
  ]));

CREATE OR REPLACE FUNCTION trg_pos_sales_accelerated_depletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alerts int := 0;
BEGIN
  -- Set-based: one statement-level pass over the transition table.
  -- The trigger is FOR EACH STATEMENT so NEW does not exist; we use the
  -- REFERENCING NEW TABLE alias `new_rows` instead.
  WITH affected AS (
    -- Distinct (hotel_id, variant_id) pairs touched by this batch
    SELECT DISTINCT
      n.hotel_id,
      mii.variant_id
    FROM new_rows n
    JOIN menu_item_ingredients mii ON mii.menu_item_id = n.menu_item_id
  ),
  rates AS (
    SELECT
      a.hotel_id,
      a.variant_id,
      pv.current_stock,
      -- 7-day rolling daily rate
      COALESCE((
        SELECT ABS(SUM(sl.quantity_change)) / 7.0
        FROM stock_logs sl
        WHERE sl.variant_id      = a.variant_id
          AND sl.quantity_change < 0
          AND sl.is_revert        = false
          AND sl.timestamp       >= now() - interval '7 days'
      ), 0)  AS rate_7d,
      -- 30-day rolling daily rate
      COALESCE((
        SELECT ABS(SUM(sl.quantity_change)) / 30.0
        FROM stock_logs sl
        WHERE sl.variant_id      = a.variant_id
          AND sl.quantity_change < 0
          AND sl.is_revert        = false
          AND sl.timestamp       >= now() - interval '30 days'
      ), 0)  AS rate_30d
    FROM affected a
    JOIN product_variants pv ON pv.id = a.variant_id
    WHERE pv.enabled = true
  ),
  signals AS (
    SELECT
      r.hotel_id,
      r.variant_id,
      r.current_stock,
      r.rate_7d,
      r.rate_30d,
      ROUND((r.rate_7d / NULLIF(r.rate_30d, 0))::numeric, 2)            AS ratio,
      ROUND((r.current_stock / NULLIF(r.rate_7d, 0))::numeric, 1)       AS days_until_zero
    FROM rates r
    WHERE r.rate_30d > 0
      AND r.rate_7d  >= 1.5 * r.rate_30d
      AND r.current_stock > 0
      AND (r.current_stock / NULLIF(r.rate_7d, 0)) < 14
  ),
  fanout AS (
    -- One notification per (admin/owner) member of the affected hotel.
    -- Skip if there's already an unread accelerated_depletion alert in last 6h.
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      s.hotel_id,
      p.id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': depletion accelerated ' || s.ratio::text || '× ' ||
        '(7d ' || ROUND(s.rate_7d, 1) || ' u/d vs 30d ' || ROUND(s.rate_30d, 1) || ' u/d) — ' ||
        '~' || s.days_until_zero || 'd left at current pace',
      'accelerated_depletion',
      s.variant_id
    FROM signals s
    JOIN product_variants pv ON pv.id = s.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    JOIN profiles p          ON p.hotel_id = s.hotel_id
                            AND p.role IN ('admin', 'owner')
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id   = s.hotel_id
        AND n.variant_id = s.variant_id
        AND n.type       = 'accelerated_depletion'
        AND n.read       = false
        AND n.timestamp >= now() - interval '6 hours'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_alerts FROM fanout;

  -- Optional: surface aggregate signal so observers can verify the trigger
  -- ran. Logged via RAISE NOTICE — visible in postgres logs but not in app.
  IF v_alerts > 0 THEN
    RAISE NOTICE 'trg_pos_sales_accelerated_depletion: % alerts emitted', v_alerts;
  END IF;

  RETURN NULL;  -- AFTER STATEMENT triggers ignore return value
END;
$$;

COMMENT ON FUNCTION trg_pos_sales_accelerated_depletion IS
  'Phase A2 event-driven agent. Fires per pos_sales INSERT statement; emits '
  'accelerated_depletion notifications when 7d rate is >= 1.5x 30d rate AND '
  'days_until_zero < 14, deduplicated 6h, fanned out to admin+owner.';

-- Lock down REST exposure: get_advisors flags SECURITY DEFINER + public
-- EXECUTE because anon/authenticated could call the function as
-- /rest/v1/rpc/trg_pos_sales_accelerated_depletion. Trigger invocations don't
-- go through REST, so this revoke is safe.
REVOKE EXECUTE ON FUNCTION public.trg_pos_sales_accelerated_depletion() FROM PUBLIC, anon, authenticated;

-- Drop any prior version then attach. Statement-level so a 1000-row batch
-- runs the function ONCE, not 1000 times.
DROP TRIGGER IF EXISTS trg_pos_sales_accelerated_depletion ON pos_sales;
CREATE TRIGGER trg_pos_sales_accelerated_depletion
  AFTER INSERT ON pos_sales
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION trg_pos_sales_accelerated_depletion();

-- Index to keep the dedup lookup fast as `notifications` grows.
CREATE INDEX IF NOT EXISTS idx_notifications_accel_dedup
  ON notifications (hotel_id, variant_id, type, timestamp DESC)
  WHERE type = 'accelerated_depletion' AND read = false;

-- ─── Verification ────────────────────────────────────────────────────────────
--
-- 1. Trigger is wired:
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.pos_sales'::regclass AND NOT tgisinternal;
--
-- 2. Synthetic batch (replace UUIDs with a hotel + menu_item that has recipes):
--    INSERT INTO pos_sales (hotel_id, menu_item_id, quantity_sold, sale_time)
--    SELECT '<hotel-uuid>', '<menu-item-uuid>', 1, now()
--    FROM generate_series(1, 5);
--    -- Look at: SELECT * FROM notifications
--    --   WHERE type = 'accelerated_depletion' ORDER BY timestamp DESC LIMIT 5;
--
-- 3. Dedup: re-run the same batch within 6h → no new alerts.
