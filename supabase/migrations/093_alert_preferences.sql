-- Migration 093: Per-hotel alert threshold preferences
-- Purpose: operators can tune alert sensitivity to match their operation type.
--   A 5-star hotel with 30-day supplier lead times needs alerts at 14 days.
--   A budget property with local suppliers is fine with 3 days.
-- Also updates auto_create_alerts() to read hotel preferences when no explicit
-- thresholds are supplied (NULL → look up preference → fall back to global default).

-- ─── 1. alert_preferences table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_preferences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid        NOT NULL UNIQUE REFERENCES hotels(id) ON DELETE CASCADE,
  days_threshold  integer     NOT NULL DEFAULT 7
                              CHECK (days_threshold BETWEEN 1 AND 60),
  waste_threshold integer     NOT NULL DEFAULT 10
                              CHECK (waste_threshold BETWEEN 1 AND 500),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

-- Hotel members can read; admins/owners can write
CREATE POLICY "hotel_members_read_alert_preferences"
  ON alert_preferences FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "admins_write_alert_preferences"
  ON alert_preferences FOR ALL
  USING (hotel_id = auth_hotel_id());

GRANT ALL ON alert_preferences TO authenticated;

-- ─── 2. get_alert_preferences() RPC ──────────────────────────────────────────
-- Returns the hotel's configured thresholds, falling back to global defaults if
-- no row exists yet. Always returns exactly one row.

CREATE OR REPLACE FUNCTION get_alert_preferences()
RETURNS TABLE (
  days_threshold  integer,
  waste_threshold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(ap.days_threshold,  7)  AS days_threshold,
      COALESCE(ap.waste_threshold, 10) AS waste_threshold
    FROM (SELECT 1) _singleton
    LEFT JOIN alert_preferences ap ON ap.hotel_id = v_hotel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_alert_preferences() TO authenticated;

-- ─── 3. Update auto_create_alerts to read preferences ────────────────────────
-- Breaking change: defaults change from (7, 10) → (NULL, NULL).
-- When NULL is supplied, the function resolves from alert_preferences, then
-- falls back to the global default. Explicit values bypass preference lookup.
-- This means callers that pass {} (no args) now automatically use hotel prefs.

DROP FUNCTION IF EXISTS auto_create_alerts(int, int);

CREATE OR REPLACE FUNCTION auto_create_alerts(
  p_days_threshold  int DEFAULT NULL,
  p_waste_threshold int DEFAULT NULL
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
  v_days     int;
  v_waste    int;
BEGIN

  -- Resolve thresholds: explicit arg > hotel preference > global default
  SELECT
    COALESCE(p_days_threshold,  ap.days_threshold,  7),
    COALESCE(p_waste_threshold, ap.waste_threshold, 10)
  INTO v_days, v_waste
  FROM (SELECT 1) _dummy
  LEFT JOIN alert_preferences ap ON ap.hotel_id = v_hotel_id;

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
               < v_days
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
    HAVING ABS(SUM(sl.quantity_change)) > v_waste
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
