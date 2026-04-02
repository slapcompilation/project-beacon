-- Sprint 19: Eye Layer Intelligence
-- 1. get_waste_radar()  — top variants by waste (negative non-revert adjustments)
-- 2. get_consumption_stats() — avg daily consumption per variant

-- ─── 1. Waste Radar ───────────────────────────────────────────────────────────
-- Returns the top 10 variants by total units wasted (non-revert negative adjustments)
-- within the last p_days days, for the calling user's hotel.

CREATE OR REPLACE FUNCTION get_waste_radar(p_days int DEFAULT 30)
RETURNS TABLE (
  variant_id      uuid,
  variant_name    text,
  product_name    text,
  total_wasted    int,
  adjustment_count int,
  avg_per_day     numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                          AS variant_id,
    pv.name                                        AS variant_name,
    pr.name                                        AS product_name,
    ABS(SUM(sl.quantity_change))::int             AS total_wasted,
    COUNT(*)::int                                  AS adjustment_count,
    ROUND(ABS(SUM(sl.quantity_change)) / p_days::numeric, 2) AS avg_per_day
  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr ON pr.id = pv.product_id
  WHERE sl.hotel_id     = auth_hotel_id()
    AND sl.quantity_change < 0
    AND sl.is_revert    = false
    AND sl.timestamp   >= NOW() - (p_days || ' days')::interval
  GROUP BY pv.id, pv.name, pr.name
  ORDER BY total_wasted DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION get_waste_radar(int) TO authenticated;

-- ─── 2. Consumption Stats ─────────────────────────────────────────────────────
-- Returns avg daily consumption and estimated days until zero for every variant
-- that has had at least one negative (non-revert) adjustment in the window.

CREATE OR REPLACE FUNCTION get_consumption_stats(p_days int DEFAULT 30)
RETURNS TABLE (
  variant_id       uuid,
  current_stock    int,
  avg_daily        numeric,
  days_until_zero  numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                                         AS variant_id,
    pv.current_stock                                              AS current_stock,
    ROUND(ABS(SUM(sl.quantity_change)) / p_days::numeric, 4)     AS avg_daily,
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN NULL
      ELSE ROUND(
        pv.current_stock / (ABS(SUM(sl.quantity_change)) / p_days::numeric),
        1
      )
    END                                                           AS days_until_zero
  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  WHERE sl.hotel_id       = auth_hotel_id()
    AND sl.quantity_change < 0
    AND sl.is_revert       = false
    AND sl.timestamp      >= NOW() - (p_days || ' days')::interval
  GROUP BY pv.id, pv.current_stock
  HAVING ABS(SUM(sl.quantity_change)) > 0;
$$;

GRANT EXECUTE ON FUNCTION get_consumption_stats(int) TO authenticated;
