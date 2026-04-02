-- Sprint 23: Smart Alert Rules
-- Extends notifications with two new types and adds auto_create_alerts() RPC.

-- ─── 1. Extend notification type constraint ───────────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('low_stock', 'expiry', 'approval', 'system', 'predicted_outage', 'waste_alert'));

-- ─── 2. auto_create_alerts() ─────────────────────────────────────────────────
-- Scans all variants for two conditions:
--   A) predicted_outage — days_until_zero < p_days_threshold (default 7)
--   B) waste_alert     — total units wasted in last 7 days > p_waste_threshold (default 10)
--
-- Skips if an identical unread notification for the same variant already exists.
-- Writes a triggered_alert edge in relationship_edges for each new notification.
-- Returns the number of alerts created.

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
  v_hotel_id uuid := auth_hotel_id();
  v_user_id  uuid := auth.uid();
  v_count    int  := 0;
  v_notif_id uuid;
BEGIN

  -- ── A. Predicted outage alerts ─────────────────────────────────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': predicted to run out in ~' || stats.days_until_zero::int || ' day' ||
        CASE WHEN stats.days_until_zero::int = 1 THEN '' ELSE 's' END,
      'predicted_outage'
    FROM (
      SELECT
        pv2.id                                                       AS variant_id,
        ROUND(
          pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0),
          0
        )                                                            AS days_until_zero
      FROM stock_logs sl
      JOIN product_variants pv2 ON pv2.id = sl.variant_id
      WHERE sl.hotel_id        = v_hotel_id
        AND sl.quantity_change < 0
        AND sl.is_revert        = false
        AND sl.timestamp       >= NOW() - INTERVAL '30 days'
        AND pv2.enabled         = true
      GROUP BY pv2.id, pv2.current_stock
      HAVING ABS(SUM(sl.quantity_change)) > 0
         AND ROUND(pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0), 0)
               < p_days_threshold
    ) stats
    JOIN product_variants pv ON pv.id = stats.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id   = v_hotel_id
        AND n.type       = 'predicted_outage'
        AND n.read       = false
        AND n.message LIKE pr.name || '%'
    )
    RETURNING id
  LOOP
    v_count := v_count + 1;
    -- triggered_alert edge: notification → (implicit variant via message)
    PERFORM create_relationship_edge(
      v_hotel_id, 'stock_log', v_notif_id, 'triggered_alert', 'alert', v_notif_id
    );
  END LOOP;

  -- ── B. Waste alerts ────────────────────────────────────────────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': ' || ABS(SUM(sl.quantity_change))::int || ' units wasted in the last 7 days',
      'waste_alert'
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '7 days'
    GROUP BY pv.id, pv.name, pr.id, pr.name
    HAVING ABS(SUM(sl.quantity_change)) > p_waste_threshold
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.hotel_id = v_hotel_id
           AND n.type     = 'waste_alert'
           AND n.read     = false
           AND n.message  LIKE pr.name || '%'
       )
    RETURNING id
  LOOP
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_create_alerts(int, int) TO authenticated;
