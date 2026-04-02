-- Sprint 28: Eye Layer Anomaly Detection
-- Two RPCs that surface signals operators wouldn't see by scanning tables:
--   1. get_dead_stock()        — idle capital: stock with no movement
--   2. get_consumption_spikes() — sudden removal spikes vs rolling avg

-- ─── 1. Dead Stock ────────────────────────────────────────────────────────────
-- Variants that still hold stock but have had zero movement in the last
-- p_idle_days days. Ordered by idle value (cost × units) descending.

CREATE OR REPLACE FUNCTION get_dead_stock(p_idle_days int DEFAULT 30)
RETURNS TABLE (
  variant_id    uuid,
  product_name  text,
  variant_name  text,
  sku           text,
  current_stock int,
  unit_cost     numeric,
  idle_value    numeric,
  days_idle     int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                        AS variant_id,
    pr.name                                      AS product_name,
    pv.name                                      AS variant_name,
    pv.sku                                       AS sku,
    pv.current_stock                             AS current_stock,
    pv.cost                                      AS unit_cost,
    (pv.current_stock * pv.cost)                 AS idle_value,
    COALESCE(
      EXTRACT(days FROM NOW() - MAX(sl.timestamp))::int,
      p_idle_days + 1          -- no log at all → treat as maximally idle
    )                                            AS days_idle
  FROM product_variants pv
  JOIN products pr ON pr.id = pv.product_id
  LEFT JOIN stock_logs sl
    ON  sl.variant_id = pv.id
    AND sl.hotel_id   = auth_hotel_id()
  WHERE pr.hotel_id  = auth_hotel_id()
    AND pv.enabled   = true
    AND pv.current_stock > 0
  GROUP BY pv.id, pr.name, pv.name, pv.sku, pv.current_stock, pv.cost
  HAVING COALESCE(MAX(sl.timestamp), '1970-01-01'::timestamptz)
           < NOW() - (p_idle_days || ' days')::interval
  ORDER BY idle_value DESC;
$$;

GRANT EXECUTE ON FUNCTION get_dead_stock(int) TO authenticated;

-- ─── 2. Consumption Spikes ────────────────────────────────────────────────────
-- Days where a variant's single-day removal volume exceeded p_multiplier × its
-- 30-day rolling daily average. Returns one row per spike event.
-- Only looks at the last p_window_days days to keep results actionable.

CREATE OR REPLACE FUNCTION get_consumption_spikes(
  p_window_days  int     DEFAULT 7,
  p_multiplier   numeric DEFAULT 3.0
)
RETURNS TABLE (
  variant_id      uuid,
  product_name    text,
  variant_name    text,
  sku             text,
  spike_date      date,
  spike_units     int,
  avg_daily       numeric,
  spike_ratio     numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH daily_totals AS (
    -- Sum removals (non-revert) per variant per day in the window
    SELECT
      pv.id                                           AS variant_id,
      pr.name                                         AS product_name,
      pv.name                                         AS variant_name,
      pv.sku                                          AS sku,
      sl.timestamp::date                              AS day,
      ABS(SUM(sl.quantity_change))::int               AS day_units
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE sl.hotel_id       = auth_hotel_id()
      AND sl.quantity_change < 0
      AND sl.is_revert       = false
      AND sl.timestamp      >= NOW() - (p_window_days || ' days')::interval
    GROUP BY pv.id, pr.name, pv.name, pv.sku, sl.timestamp::date
  ),
  rolling_avg AS (
    -- 30-day avg daily consumption per variant (baseline)
    SELECT
      pv2.id                                                      AS variant_id,
      ROUND(ABS(SUM(sl2.quantity_change)) / 30.0, 4)             AS avg_daily
    FROM stock_logs sl2
    JOIN product_variants pv2 ON pv2.id = sl2.variant_id
    WHERE sl2.hotel_id       = auth_hotel_id()
      AND sl2.quantity_change < 0
      AND sl2.is_revert       = false
      AND sl2.timestamp      >= NOW() - INTERVAL '30 days'
    GROUP BY pv2.id
    HAVING ABS(SUM(sl2.quantity_change)) > 0
  )
  SELECT
    dt.variant_id,
    dt.product_name,
    dt.variant_name,
    dt.sku,
    dt.day                                             AS spike_date,
    dt.day_units                                       AS spike_units,
    ra.avg_daily,
    ROUND(dt.day_units / ra.avg_daily, 1)              AS spike_ratio
  FROM daily_totals dt
  JOIN rolling_avg ra ON ra.variant_id = dt.variant_id
  WHERE dt.day_units > ra.avg_daily * p_multiplier
  ORDER BY spike_ratio DESC;
$$;

GRANT EXECUTE ON FUNCTION get_consumption_spikes(int, numeric) TO authenticated;
