-- Layer: Eye — per-variant consumption trend + last-received intelligence
-- Powers the "47 units · ↓12% this week · last recv 18d ago" row annotations
-- on the Inventory page (Principle 3: intelligence everywhere).

CREATE OR REPLACE FUNCTION get_inventory_intelligence()
RETURNS TABLE (
  variant_id             UUID,
  last_received_at       TIMESTAMPTZ,
  last_received_days_ago INT,
  curr_week_consumed     INT,
  prev_week_consumed     INT,
  trend_pct              NUMERIC   -- positive = consuming faster, negative = slower
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hotel AS (
    SELECT (raw_app_meta_data->>'hotel_id')::UUID AS id
    FROM   auth.users
    WHERE  id = auth.uid()
  ),
  -- Most recent positive stock log per variant (= last time it was received)
  last_received AS (
    SELECT DISTINCT ON (sl.variant_id)
      sl.variant_id,
      sl.timestamp                                              AS last_received_at,
      GREATEST(0, EXTRACT(DAY FROM NOW() - sl.timestamp))::INT AS last_received_days_ago
    FROM   stock_logs sl
    CROSS JOIN hotel h
    WHERE  sl.hotel_id = h.id
      AND  sl.quantity_change > 0
      AND  NOT sl.is_revert
    ORDER  BY sl.variant_id, sl.timestamp DESC
  ),
  -- Consumption in current 7-day window vs prior 7-day window
  weekly AS (
    SELECT
      sl.variant_id,
      SUM(CASE WHEN sl.timestamp >= NOW() - INTERVAL '7 days'
                    THEN ABS(sl.quantity_change) ELSE 0 END)::INT  AS curr_week,
      SUM(CASE WHEN sl.timestamp >= NOW() - INTERVAL '14 days'
               AND  sl.timestamp <  NOW() - INTERVAL '7 days'
                    THEN ABS(sl.quantity_change) ELSE 0 END)::INT  AS prev_week
    FROM   stock_logs sl
    CROSS JOIN hotel h
    WHERE  sl.hotel_id = h.id
      AND  sl.quantity_change < 0
      AND  NOT sl.is_revert
      AND  sl.timestamp >= NOW() - INTERVAL '14 days'
    GROUP  BY sl.variant_id
  )
  SELECT
    COALESCE(lr.variant_id, w.variant_id)    AS variant_id,
    lr.last_received_at,
    lr.last_received_days_ago,
    COALESCE(w.curr_week, 0)                 AS curr_week_consumed,
    COALESCE(w.prev_week, 0)                 AS prev_week_consumed,
    CASE
      WHEN COALESCE(w.prev_week, 0) = 0 THEN NULL
      ELSE ROUND(
             ((COALESCE(w.curr_week, 0) - COALESCE(w.prev_week, 0))::NUMERIC
              / COALESCE(w.prev_week, 1)) * 100,
             1)
    END                                       AS trend_pct
  FROM   last_received  lr
  FULL OUTER JOIN weekly w ON lr.variant_id = w.variant_id;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_intelligence() TO authenticated;
