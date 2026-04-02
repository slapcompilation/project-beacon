-- Migration 032: Add total_waste_cost to get_waste_radar()
-- Multiplies wasted units × variant cost for financial impact visibility.

DROP FUNCTION IF EXISTS get_waste_radar(integer);

CREATE OR REPLACE FUNCTION get_waste_radar(p_days int DEFAULT 30)
RETURNS TABLE (
  variant_id        uuid,
  variant_name      text,
  product_name      text,
  total_wasted      int,
  total_waste_cost  numeric,
  adjustment_count  int,
  avg_per_day       numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                                              AS variant_id,
    pv.name                                                            AS variant_name,
    pr.name                                                            AS product_name,
    ABS(SUM(sl.quantity_change))::int                                  AS total_wasted,
    ROUND(ABS(SUM(sl.quantity_change)) * pv.cost, 2)                   AS total_waste_cost,
    COUNT(*)::int                                                      AS adjustment_count,
    ROUND(ABS(SUM(sl.quantity_change)) / p_days::numeric, 2)           AS avg_per_day
  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr ON pr.id = pv.product_id
  WHERE sl.hotel_id     = auth_hotel_id()
    AND sl.quantity_change < 0
    AND sl.is_revert    = false
    AND sl.timestamp   >= NOW() - (p_days || ' days')::interval
  GROUP BY pv.id, pv.name, pv.cost, pr.name
  ORDER BY total_wasted DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION get_waste_radar(int) TO authenticated;
