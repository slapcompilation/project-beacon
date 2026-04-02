-- Migration 061: Anomaly Alert Triggers
-- Layer: Eye → routes into Floor via notifications
-- Purpose:
--   1. Add consumption_spike notification type
--   2. Add variant_id to notifications — enables per-variant dedup and direct linking
--   3. fan_out_alert() — inserts one notification per user at or above a minimum role,
--      replacing the current pattern where alerts only reach the calling user
--   4. detect_consumption_spike() AFTER INSERT trigger on stock_logs — fires within
--      seconds of an anomalous removal; 2× daily avg is the threshold (≈ 2σ for
--      Poisson-distributed consumption). Meets the "within 4 hours" exit criterion.
--   5. Rewrite auto_create_alerts() to use fan_out_alert() for proper role routing

SET search_path = public;

-- ─── 1. consumption_spike type + variant_id column ────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'low_stock', 'expiry', 'approval', 'system',
    'predicted_outage', 'waste_alert', 'consumption_spike'
  ));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;

COMMENT ON COLUMN notifications.variant_id IS
  'Set for alerts that are scoped to a specific variant; enables per-variant dedup.';

CREATE INDEX IF NOT EXISTS idx_notifications_variant_unread
  ON notifications (hotel_id, variant_id, type)
  WHERE read = false;

-- ─── 2. fan_out_alert() ────────────────────────────────────────────────────────
-- Inserts one notification row per user at hotel p_hotel_id whose role is at or
-- above p_min_role in the hierarchy: limited_access < team_member < admin < owner.
-- Returns the number of rows inserted.

CREATE OR REPLACE FUNCTION fan_out_alert(
  p_hotel_id   uuid,
  p_message    text,
  p_type       text,
  p_min_role   text    DEFAULT 'team_member',
  p_variant_id uuid    DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH inserted AS (
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      p_hotel_id,
      u.id,
      p_message,
      p_type,
      p_variant_id
    FROM users u
    WHERE u.hotel_id = p_hotel_id
      AND CASE u.role
            WHEN 'limited_access' THEN 1
            WHEN 'team_member'    THEN 2
            WHEN 'admin'          THEN 3
            WHEN 'owner'          THEN 4
            ELSE 0
          END >=
          CASE p_min_role
            WHEN 'limited_access' THEN 1
            WHEN 'team_member'    THEN 2
            WHEN 'admin'          THEN 3
            WHEN 'owner'          THEN 4
            ELSE 2
          END
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION fan_out_alert(uuid, text, text, text, uuid) TO authenticated;

-- ─── 3. detect_consumption_spike() — AFTER INSERT trigger on stock_logs ────────
-- Only fires for negative, non-revert stock changes (actual consumption).
-- Algorithm:
--   baseline = 30-day rolling avg daily consumption (excludes today)
--   today    = sum of all removals today including this row
--   spike    = today > baseline × 2.0
-- Dedup: skips if an unread consumption_spike notification already exists for
--   this variant today, preventing alert storm on rapid consecutive removals.
-- Fan-out target: team_member+ (floor staff + managers + owners all need to know).

CREATE OR REPLACE FUNCTION detect_consumption_spike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_daily    numeric;
  v_today_total  numeric;
  v_multiplier   constant numeric := 2.0;
  v_product_name text;
  v_variant_name text;
  v_message      text;
BEGIN
  -- Only check actual consumption (negative, non-revert)
  IF NEW.quantity_change >= 0 OR NEW.is_revert THEN
    RETURN NEW;
  END IF;

  -- 30-day avg daily baseline (excluding today to avoid circularity)
  SELECT ROUND(ABS(SUM(sl.quantity_change)) / 30.0, 4)
    INTO v_avg_daily
    FROM stock_logs sl
   WHERE sl.variant_id     = NEW.variant_id
     AND sl.hotel_id       = NEW.hotel_id
     AND sl.quantity_change < 0
     AND sl.is_revert       = false
     AND sl.timestamp      >= NOW() - INTERVAL '30 days'
     AND sl.timestamp::date  < CURRENT_DATE;  -- baseline excludes today

  -- Need at least some history to have a meaningful baseline
  IF v_avg_daily IS NULL OR v_avg_daily < 0.5 THEN
    RETURN NEW;
  END IF;

  -- Today's total consumption including this row
  SELECT ABS(SUM(sl.quantity_change))
    INTO v_today_total
    FROM stock_logs sl
   WHERE sl.variant_id     = NEW.variant_id
     AND sl.hotel_id       = NEW.hotel_id
     AND sl.quantity_change < 0
     AND sl.is_revert       = false
     AND sl.timestamp::date  = CURRENT_DATE;

  -- Not a spike
  IF v_today_total IS NULL OR v_today_total <= v_avg_daily * v_multiplier THEN
    RETURN NEW;
  END IF;

  -- Dedup: skip if unread spike already exists for this variant today
  IF EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.hotel_id   = NEW.hotel_id
      AND n.type       = 'consumption_spike'
      AND n.variant_id = NEW.variant_id
      AND n.read       = false
      AND n.timestamp >= CURRENT_DATE::timestamptz
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve product + variant names
  SELECT pr.name, pv.name
    INTO v_product_name, v_variant_name
    FROM product_variants pv
    JOIN products pr ON pr.id = pv.product_id
   WHERE pv.id = NEW.variant_id;

  v_message :=
    COALESCE(v_product_name, 'Unknown') ||
    CASE WHEN COALESCE(v_variant_name, 'Standard') <> 'Standard'
         THEN ' — ' || v_variant_name ELSE '' END ||
    ': consumption spike — ' || v_today_total::int || ' units today vs ' ||
    ROUND(v_avg_daily, 1) || ' avg (' ||
    ROUND(v_today_total / v_avg_daily, 1) || '×)';

  -- Fan out to team_member+ roles
  PERFORM fan_out_alert(
    NEW.hotel_id,
    v_message,
    'consumption_spike',
    'team_member',
    NEW.variant_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_consumption_spike ON stock_logs;
CREATE TRIGGER trg_detect_consumption_spike
AFTER INSERT ON stock_logs
FOR EACH ROW EXECUTE FUNCTION detect_consumption_spike();

-- ─── 4. Rewrite auto_create_alerts() — role-based fan-out ─────────────────────
-- Previous version sent alerts only to auth.uid() (the calling user).
-- New version uses fan_out_alert():
--   predicted_outage → team_member+  (operational — floor staff need to know)
--   waste_alert      → admin+        (cost signal — management concern)
-- The broken edge wiring (notification → notification) is removed.

CREATE OR REPLACE FUNCTION auto_create_alerts(
  p_days_threshold  int DEFAULT 7,
  p_waste_threshold int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id   uuid := auth_hotel_id();
  v_count      int  := 0;
  v_variant_id uuid;
  v_msg        text;
  v_rows       record;
BEGIN

  -- ── A. Predicted outage alerts → team_member+ ──────────────────────────────
  FOR v_rows IN
    SELECT
      pv.id                                                                AS variant_id,
      pr.name                                                              AS product_name,
      pv.name                                                              AS variant_name,
      ROUND(
        pv.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0),
        0
      )                                                                    AS days_until_zero
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '30 days'
      AND pv.enabled          = true
    GROUP BY pv.id, pv.current_stock, pr.name, pv.name
    HAVING ABS(SUM(sl.quantity_change)) > 0
       AND ROUND(
         pv.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0),
         0
       ) < p_days_threshold
  LOOP
    -- Dedup: skip if unread outage alert for this variant already exists
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id   = v_hotel_id
        AND n.type       = 'predicted_outage'
        AND n.variant_id = v_rows.variant_id
        AND n.read       = false
    );

    v_msg :=
      v_rows.product_name ||
      CASE WHEN v_rows.variant_name <> 'Standard' THEN ' — ' || v_rows.variant_name ELSE '' END ||
      ': predicted to run out in ~' || v_rows.days_until_zero::int || ' day' ||
      CASE WHEN v_rows.days_until_zero::int = 1 THEN '' ELSE 's' END;

    v_count := v_count + fan_out_alert(
      v_hotel_id, v_msg, 'predicted_outage', 'team_member', v_rows.variant_id
    );
  END LOOP;

  -- ── B. Waste alerts → admin+ ───────────────────────────────────────────────
  FOR v_rows IN
    SELECT
      pv.id                          AS variant_id,
      pr.name                        AS product_name,
      pv.name                        AS variant_name,
      ABS(SUM(sl.quantity_change))   AS units_wasted
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '7 days'
    GROUP BY pv.id, pr.name, pv.name
    HAVING ABS(SUM(sl.quantity_change)) > p_waste_threshold
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id   = v_hotel_id
        AND n.type       = 'waste_alert'
        AND n.variant_id = v_rows.variant_id
        AND n.read       = false
    );

    v_msg :=
      v_rows.product_name ||
      CASE WHEN v_rows.variant_name <> 'Standard' THEN ' — ' || v_rows.variant_name ELSE '' END ||
      ': ' || v_rows.units_wasted::int || ' units wasted in the last 7 days';

    v_count := v_count + fan_out_alert(
      v_hotel_id, v_msg, 'waste_alert', 'admin', v_rows.variant_id
    );
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_create_alerts(int, int) TO authenticated;

-- ─── Acceptance test ───────────────────────────────────────────────────────────
-- Verify "within 4 hours" criterion:
--
--   -- 1. Insert an anomalous removal for a variant with consumption history:
--   INSERT INTO stock_logs (hotel_id, variant_id, quantity_change, reason, is_revert)
--   SELECT auth_hotel_id(), id, -999, 'Spike test', false
--     FROM product_variants LIMIT 1;
--
--   -- 2. Check that a consumption_spike notification was created immediately:
--   SELECT type, message, variant_id, timestamp
--     FROM notifications
--    WHERE type = 'consumption_spike'
--    ORDER BY timestamp DESC LIMIT 5;
--
--   -- 3. Verify fan-out reached all team_member+ users:
--   SELECT u.email, u.role, n.message
--     FROM notifications n
--     JOIN users u ON u.id = n.user_id
--    WHERE n.type = 'consumption_spike'
--    ORDER BY u.role;
