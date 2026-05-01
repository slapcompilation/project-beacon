-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 118 — occupancy_logs high-occupancy spike trigger (Phase A2)
--
-- Layer: Eye (anomaly detection) + Flow (alert plumbing)
-- Scope: hotel
-- Cadence: on-event (trigger, fires per occupancy_logs INSERT when pct >= 85%)
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase A2 row 4: "occupancy_logs INSERT where pct > 85% →
-- re-run PAR calculations for high-demand variants → push task list to floor".
-- Today the every-15-min cycle eventually picks up the new occupancy row, but
-- a manager pushing a Mews sync at 6pm Friday for a 92%-booked Saturday wants
-- the heads-up immediately, not 15 minutes later.
--
-- Signal definition
-- ─────────────────
-- A spike alert fires when:
--   • A new occupancy_logs row lands with occupancy_pct >= 85 (WHEN-filtered
--     on the trigger, so the function body only executes on the threshold).
--   • The hotel has at least one product variant in a category with
--     occupancy_sensitivity >= 0.5 (i.e. demand correlates with occupancy
--     enough that pre-positioning stock matters).
--   • No unread `occupancy_spike` notification exists for this hotel from the
--     last 12 hours (dedup — at most one alert per day per hotel).
--
-- Non-goals
-- ─────────
-- This trigger does NOT run apply_optimal_par or generate_preemptive_restocks
-- itself — those are organisation-wide computations that the every-15-min
-- intelligence cycle already invokes. The trigger only emits the human-facing
-- "you should look at this" signal so floor staff can pre-position stock
-- before the next cycle tick.
--
-- Per CLAUDE.md self-apply: every emitted alert carries inline confidence
-- basis ("28 sensitive variants · projected uplift ~14%") and a fanned-out
-- recipient list (admin/owner of the affected hotel).
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Extend notifications.type CHECK to allow 'occupancy_spike'.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'low_stock'::text, 'expiry'::text, 'restock_request'::text,
    'waste_spike'::text, 'pos_variance'::text, 'po_discrepancy'::text,
    'contract_expiry'::text, 'approval'::text, 'system'::text,
    'predicted_outage'::text, 'waste_alert'::text, 'consumption_spike'::text,
    'price_drift'::text,
    'accelerated_depletion'::text,
    'occupancy_spike'::text
  ]));

-- 1. Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_occupancy_spike_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sensitive_variants int := 0;
  v_avg_sensitivity    numeric := 0;
  v_projected_uplift   numeric := 0;
  v_baseline_pct       numeric := 70;  -- "normal" assumption — could be hotel-tunable
  v_alerts             int := 0;
BEGIN
  -- A. How many variants in this hotel sit in high-elasticity categories?
  SELECT
    count(*),
    COALESCE(avg(c.occupancy_sensitivity), 0)
  INTO v_sensitive_variants, v_avg_sensitivity
  FROM product_variants pv
  JOIN products p   ON p.id  = pv.product_id
  JOIN categories c ON c.id  = p.category_id
  WHERE p.hotel_id              = NEW.hotel_id
    AND pv.enabled              = true
    AND c.occupancy_sensitivity >= 0.5;

  -- If no sensitive variants, no point alerting. Bail early.
  IF v_sensitive_variants = 0 THEN
    RETURN NULL;
  END IF;

  -- B. Projected demand uplift = avg_sensitivity * (occupancy_pct - baseline) / 100
  --    e.g. 92% occupancy, 0.7 sensitivity → ~15% uplift over baseline demand.
  v_projected_uplift := ROUND(
    (v_avg_sensitivity * GREATEST(NEW.occupancy_pct - v_baseline_pct, 0))::numeric,
    1
  );

  -- C. Fan-out one notification per admin/owner of the hotel, deduplicated 12h.
  WITH fanout AS (
    INSERT INTO notifications (hotel_id, user_id, message, type)
    SELECT
      NEW.hotel_id,
      p.id,
      'High occupancy ' || ROUND(NEW.occupancy_pct, 0)::text || '% on ' ||
        to_char(NEW.date, 'Mon DD') || ' — ' ||
        v_sensitive_variants::text || ' demand-sensitive variants, projected uplift ~' ||
        v_projected_uplift::text || '%. Pre-position stock for high-traffic zones.',
      'occupancy_spike'
    FROM profiles p
    WHERE p.hotel_id = NEW.hotel_id
      AND p.role IN ('admin', 'owner')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.hotel_id  = NEW.hotel_id
          AND n.user_id   = p.id
          AND n.type      = 'occupancy_spike'
          AND n.read      = false
          AND n.timestamp >= now() - interval '12 hours'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_alerts FROM fanout;

  IF v_alerts > 0 THEN
    RAISE NOTICE 'trg_occupancy_spike_alert: % alerts emitted (occ=%%, variants=%, uplift=%%)',
      v_alerts, NEW.occupancy_pct, v_sensitive_variants, v_projected_uplift;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION trg_occupancy_spike_alert IS
  'Phase A2 event-driven agent. Fires on occupancy_logs INSERT when '
  'occupancy_pct >= 85; emits occupancy_spike notifications to admin/owner if '
  'hotel has high-elasticity variants. Dedup 12h.';

-- Lock down REST exposure (advisor-driven, same pattern as 117).
REVOKE EXECUTE ON FUNCTION public.trg_occupancy_spike_alert() FROM PUBLIC, anon, authenticated;

-- 2. Attach trigger ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_occupancy_spike_alert ON occupancy_logs;
CREATE TRIGGER trg_occupancy_spike_alert
  AFTER INSERT ON occupancy_logs
  FOR EACH ROW
  WHEN (NEW.occupancy_pct >= 85)
  EXECUTE FUNCTION trg_occupancy_spike_alert();

-- 3. Index for the dedup lookup.
CREATE INDEX IF NOT EXISTS idx_notifications_occ_dedup
  ON notifications (hotel_id, user_id, type, timestamp DESC)
  WHERE type = 'occupancy_spike' AND read = false;

-- ─── Verification ────────────────────────────────────────────────────────────
--
-- 1. Trigger wired:
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.occupancy_logs'::regclass AND NOT tgisinternal;
--
-- 2. Synthetic spike test (transactional — replace UUIDs with a hotel that
--    has admin/owner profiles and at least one category w/ sensitivity ≥ 0.5):
--      BEGIN;
--      INSERT INTO occupancy_logs (hotel_id, date, occupancy_pct)
--      VALUES ('<hotel-uuid>', current_date, 92);
--      SELECT message FROM notifications
--       WHERE type = 'occupancy_spike' ORDER BY timestamp DESC LIMIT 5;
--      ROLLBACK;
--
-- 3. Below threshold: INSERT with occupancy_pct = 80 → trigger does not fire
--    (WHEN clause filters at the trigger level).
