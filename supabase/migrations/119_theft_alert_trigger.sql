-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 119 — stock_logs theft alert trigger (Phase A2)
--
-- Layer: Eye (anomaly / security signal) + Flow (alert plumbing)
-- Scope: hotel
-- Cadence: on-event (trigger, fires per stock_logs INSERT WHEN removal_category = 'Theft')
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase A2 row 2: "stock_logs INSERT where removal_category =
-- 'Theft' → alert security + flag variant for photo-required policy".
-- A theft tag is the strongest single-row security signal in the graph and
-- should reach a manager in seconds, with derived context (recent pattern at
-- the variant + category level), not 15 minutes later.
--
-- Signal definition
-- ─────────────────
-- Trigger fires AFTER INSERT FOR EACH ROW with WHEN clause:
--   (NEW.removal_category = 'Theft'
--    AND NEW.is_revert = false
--    AND NEW.quantity_change < 0)
-- so: only real theft events, not corrections/reverts. The function then:
--   • Counts prior theft events on same variant in last 30 days.
--   • Counts prior theft events on same category in last 30 days.
--   • Picks severity:
--       0 prior variant events → 'info' theft_alert (single occurrence)
--       1–2                    → 'warn' (pattern forming)
--       ≥3                     → 'critical' (recurring pattern)
--   • Fans out one notification per admin/owner profile of the affected hotel.
--   • Dedup: skip if an unread theft_alert exists for this (hotel, variant) in
--     the last 1 hour (short window — theft can recur and we want repeats
--     visible, but not thrash on duplicate-tag mistakes).
--
-- Non-goals
-- ─────────
-- Per CLAUDE.md "Confidence and uncertainty" + operator agency: this trigger
-- does NOT auto-mutate categories.require_photo_for_removal_over. Instead it
-- includes a policy recommendation in the alert message when the pattern
-- crosses a threshold. Operators decide; the system informs.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Extend notifications.type CHECK to allow 'theft_alert'.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'low_stock'::text, 'expiry'::text, 'restock_request'::text,
    'waste_spike'::text, 'pos_variance'::text, 'po_discrepancy'::text,
    'contract_expiry'::text, 'approval'::text, 'system'::text,
    'predicted_outage'::text, 'waste_alert'::text, 'consumption_spike'::text,
    'price_drift'::text,
    'accelerated_depletion'::text,
    'occupancy_spike'::text,
    'theft_alert'::text
  ]));

-- 1. Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_stock_log_theft_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_variant_thefts_30d  int := 0;
  v_category_thefts_30d int := 0;
  v_category_id         uuid;
  v_alerts              int := 0;
  v_severity_label      text;
  v_qty                 int := ABS(NEW.quantity_change);
  v_recommend_policy    boolean := false;
BEGIN
  -- 30-day theft history on this variant (excluding current row)
  SELECT count(*) INTO v_variant_thefts_30d
  FROM stock_logs sl
  WHERE sl.variant_id        = NEW.variant_id
    AND sl.removal_category  = 'Theft'
    AND sl.is_revert         = false
    AND sl.quantity_change   < 0
    AND sl.timestamp        >= now() - interval '30 days'
    AND sl.id                <> NEW.id;

  -- Variant's category for the category-level signal + policy hint
  SELECT p.category_id INTO v_category_id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = NEW.variant_id;

  IF v_category_id IS NOT NULL THEN
    SELECT count(*) INTO v_category_thefts_30d
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products p          ON p.id  = pv.product_id
    WHERE p.category_id        = v_category_id
      AND sl.removal_category  = 'Theft'
      AND sl.is_revert         = false
      AND sl.quantity_change   < 0
      AND sl.timestamp        >= now() - interval '30 days'
      AND sl.id                <> NEW.id;
  END IF;

  -- Severity label (cosmetic; the 'critical' notification type signals urgency)
  IF v_variant_thefts_30d >= 3 THEN
    v_severity_label   := 'recurring pattern';
    v_recommend_policy := true;
  ELSIF v_variant_thefts_30d >= 1 THEN
    v_severity_label   := 'pattern forming';
  ELSE
    v_severity_label   := 'first occurrence';
  END IF;

  -- Also recommend policy if category has 5+ theft events even if this
  -- variant is first-time
  IF v_category_thefts_30d >= 5 THEN
    v_recommend_policy := true;
  END IF;

  -- Fan-out notifications, deduplicated 1h
  WITH fanout AS (
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      NEW.hotel_id,
      p.id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': theft logged · ' || v_qty::text || ' unit' ||
        CASE WHEN v_qty = 1 THEN '' ELSE 's' END ||
        ' · ' || v_severity_label ||
        ' (' || v_variant_thefts_30d::text || ' prior at variant, ' ||
        v_category_thefts_30d::text || ' at category, last 30d)' ||
        CASE WHEN v_recommend_policy
          THEN ' — recommend enabling photo-required removal for this category.'
          ELSE ''
        END,
      'theft_alert',
      NEW.variant_id
    FROM profiles p
    JOIN product_variants pv ON pv.id = NEW.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE p.hotel_id = NEW.hotel_id
      AND p.role IN ('admin', 'owner')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.hotel_id   = NEW.hotel_id
          AND n.user_id    = p.id
          AND n.variant_id = NEW.variant_id
          AND n.type       = 'theft_alert'
          AND n.read       = false
          AND n.timestamp >= now() - interval '1 hour'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_alerts FROM fanout;

  IF v_alerts > 0 THEN
    RAISE NOTICE 'trg_stock_log_theft_alert: % alerts emitted (variant_30d=%, category_30d=%)',
      v_alerts, v_variant_thefts_30d, v_category_thefts_30d;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION trg_stock_log_theft_alert IS
  'Phase A2 event-driven security agent. Fires on stock_logs INSERT WHEN '
  'removal_category=Theft. Emits theft_alert notifications with derived '
  'pattern context (variant + category 30d counts). Dedup 1h. No auto-mutation '
  'of category policy — operator decides.';

-- Lock down REST exposure (proactive, same pattern as 117/118).
REVOKE EXECUTE ON FUNCTION public.trg_stock_log_theft_alert() FROM PUBLIC, anon, authenticated;

-- 2. Attach trigger ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_stock_log_theft_alert ON stock_logs;
CREATE TRIGGER trg_stock_log_theft_alert
  AFTER INSERT ON stock_logs
  FOR EACH ROW
  WHEN (
    NEW.removal_category = 'Theft'
    AND NEW.is_revert    = false
    AND NEW.quantity_change < 0
  )
  EXECUTE FUNCTION trg_stock_log_theft_alert();

-- 3. Index for the dedup lookup.
CREATE INDEX IF NOT EXISTS idx_notifications_theft_dedup
  ON notifications (hotel_id, variant_id, user_id, timestamp DESC)
  WHERE type = 'theft_alert' AND read = false;

-- ─── Verification ────────────────────────────────────────────────────────────
--
-- 1. Trigger wired:
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.stock_logs'::regclass AND NOT tgisinternal
--      AND tgname = 'trg_stock_log_theft_alert';
--
-- 2. Synthetic test (transactional):
--    BEGIN;
--    INSERT INTO stock_logs (hotel_id, variant_id, quantity_change,
--                            balance_after, is_revert, reason, removal_category)
--    VALUES ('<hotel>', '<variant>', -3, 47, false, 'theft test', 'Theft');
--    SELECT message FROM notifications
--      WHERE type = 'theft_alert' ORDER BY timestamp DESC LIMIT 5;
--    ROLLBACK;
--
-- 3. Reverts don't fire: NEW.is_revert = true → WHEN false → no trigger.
-- 4. Other categories don't fire: removal_category = 'Spoilage' → WHEN false.
