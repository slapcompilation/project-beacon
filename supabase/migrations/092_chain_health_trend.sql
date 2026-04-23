-- Layer: Mind — Monthly chain health trend for sparklines and MoM deltas (Sprint 18)
-- Returns per-hotel per-month waste_cost, waste_units, log_count, and restock_count
-- for the last N months, enabling sparkline rendering on the Chain Overview page.
-- Mirrors the waste_cost formula in get_chain_overview: negative stock_logs × pv.cost.

CREATE OR REPLACE FUNCTION get_chain_health_trend(p_months_back int DEFAULT 6)
RETURNS TABLE (
  hotel_id       uuid,
  hotel_name     text,
  period_month   date,
  waste_cost     numeric,
  waste_units    int,
  log_count      int,
  restock_count  int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_hotels AS (
    -- All hotels the calling user has access to (same auth pattern as get_chain_overview)
    SELECT hotel_id FROM profiles WHERE id = auth.uid()
  ),
  cutoff AS (
    SELECT DATE_TRUNC('month', NOW()) - ((p_months_back - 1) * INTERVAL '1 month') AS start_month
  ),

  -- Waste cost per hotel per month (negative stock movements × variant cost)
  waste_by_month AS (
    SELECT
      p.hotel_id,
      DATE_TRUNC('month', sl.timestamp)::date                       AS period_month,
      ROUND(COALESCE(SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)), 0), 2)::numeric AS waste_cost,
      COALESCE(SUM(ABS(sl.quantity_change)), 0)::int                AS waste_units
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products p           ON p.id = pv.product_id
    WHERE p.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.quantity_change < 0
      AND sl.is_revert = false
      AND sl.timestamp >= (SELECT start_month FROM cutoff)
    GROUP BY p.hotel_id, DATE_TRUNC('month', sl.timestamp)
  ),

  -- Total stock log activity per hotel per month (operational engagement proxy)
  logs_by_month AS (
    SELECT
      sl.hotel_id,
      DATE_TRUNC('month', sl.timestamp)::date AS period_month,
      COUNT(sl.id)::int                        AS log_count
    FROM stock_logs sl
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.timestamp >= (SELECT start_month FROM cutoff)
    GROUP BY sl.hotel_id, DATE_TRUNC('month', sl.timestamp)
  ),

  -- Restock requests created per hotel per month
  restocks_by_month AS (
    SELECT
      hotel_id,
      DATE_TRUNC('month', created_at)::date AS period_month,
      COUNT(id)::int                         AS restock_count
    FROM restock_requests
    WHERE hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND created_at >= (SELECT start_month FROM cutoff)
    GROUP BY hotel_id, DATE_TRUNC('month', created_at)
  ),

  -- Full month grid: every hotel × every month in the range (zero-fills gaps)
  months AS (
    SELECT generate_series(
      (SELECT start_month FROM cutoff),
      DATE_TRUNC('month', NOW()),
      '1 month'
    )::date AS period_month
  )

  SELECT
    h.id                                  AS hotel_id,
    h.name                                AS hotel_name,
    m.period_month,
    COALESCE(wm.waste_cost,     0)        AS waste_cost,
    COALESCE(wm.waste_units,    0)        AS waste_units,
    COALESCE(lm.log_count,      0)        AS log_count,
    COALESCE(rm.restock_count,  0)        AS restock_count
  FROM hotels h
  CROSS JOIN months m
  LEFT JOIN waste_by_month  wm ON wm.hotel_id   = h.id AND wm.period_month = m.period_month
  LEFT JOIN logs_by_month   lm ON lm.hotel_id   = h.id AND lm.period_month = m.period_month
  LEFT JOIN restocks_by_month rm ON rm.hotel_id = h.id AND rm.period_month = m.period_month
  WHERE h.id IN (SELECT hotel_id FROM my_hotels)
  ORDER BY h.name, m.period_month;
$$;

GRANT EXECUTE ON FUNCTION get_chain_health_trend(int) TO authenticated;
