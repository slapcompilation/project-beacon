-- Sprint 24: Consumption Forecast Report
-- New get_consumption_forecast() RPC — enriches consumption stats with product
-- metadata, recommended order quantities, and open-request detection.
--
-- Closes the Eye Layer loop: prediction → report → one-click restock.

CREATE OR REPLACE FUNCTION get_consumption_forecast(p_days int DEFAULT 30)
RETURNS TABLE (
  variant_id             uuid,
  product_name           text,
  variant_name           text,
  sku                    text,
  current_stock          int,
  avg_daily              numeric,
  days_until_zero        numeric,
  recommended_order_qty  int,
  has_open_request       boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                                         AS variant_id,
    pr.name                                                       AS product_name,
    pv.name                                                       AS variant_name,
    pv.sku                                                        AS sku,
    pv.current_stock                                              AS current_stock,
    ROUND(ABS(SUM(sl.quantity_change)) / p_days::numeric, 4)     AS avg_daily,
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN NULL
      ELSE ROUND(
        pv.current_stock / (ABS(SUM(sl.quantity_change)) / p_days::numeric),
        1
      )
    END                                                           AS days_until_zero,
    -- recommended_order_qty: units needed to achieve 30 days of supply above
    -- current stock, rounded up to nearest whole unit (min 0).
    GREATEST(
      0,
      CEIL(
        (ABS(SUM(sl.quantity_change)) / p_days::numeric) * 30
        - pv.current_stock
      )
    )::int                                                        AS recommended_order_qty,
    EXISTS (
      SELECT 1 FROM restock_requests rr
      WHERE rr.variant_id = pv.id
        AND rr.hotel_id   = auth_hotel_id()
        AND rr.status     IN ('pending', 'approved')
    )                                                             AS has_open_request
  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr         ON pr.id = pv.product_id
  WHERE sl.hotel_id       = auth_hotel_id()
    AND sl.quantity_change < 0
    AND sl.is_revert       = false
    AND sl.timestamp      >= NOW() - (p_days || ' days')::interval
    AND pv.enabled         = true
  GROUP BY pv.id, pv.name, pv.sku, pv.current_stock, pr.name
  HAVING ABS(SUM(sl.quantity_change)) > 0
  ORDER BY days_until_zero ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_consumption_forecast(int) TO authenticated;
