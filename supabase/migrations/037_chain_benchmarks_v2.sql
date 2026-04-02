-- Layer: Mind — Chain Overview (multi-hotel intelligence)
-- get_chain_overview() returns per-property health metrics for all hotels
-- accessible to the calling user (owner + multi-hotel memberships).
-- Health score (0-100) = stock health (35%) + waste rate (30%) + avg supply (20%) + restock pressure (15%).
-- Returns worst-first to surface at-risk properties immediately.

SET search_path = public;

CREATE OR REPLACE FUNCTION get_chain_overview(p_days int DEFAULT 30)
RETURNS TABLE (
  hotel_id              uuid,
  hotel_name            text,
  -- Stock health
  total_variants        int,
  low_stock_count       int,
  out_of_stock_count    int,
  avg_days_supply       numeric,
  -- Flow
  total_added_units     int,
  waste_units           int,
  waste_cost            numeric,
  waste_rate            numeric,   -- wasted / total_removed (0–1)
  stock_log_count       int,
  -- Restocks
  total_restocks        int,
  pending_restocks      int,
  -- Supplier (from supplier_scorecard view, NULL if no delivery data)
  avg_supplier_score    numeric,
  -- Composite health score
  health_score          int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_hotels AS (
    -- All hotels the calling user has access to
    SELECT hotel_id FROM profiles WHERE id = auth.uid()
  ),

  -- ── Stock health ────────────────────────────────────────────────────────────
  stock_health AS (
    SELECT
      p.hotel_id,
      COUNT(pv.id)::int                                                          AS total_variants,
      COUNT(pv.id) FILTER (
        WHERE pv.current_stock <= pv.low_stock_threshold
          AND pv.low_stock_threshold > 0
          AND pv.current_stock > 0
      )::int                                                                     AS low_stock_count,
      COUNT(pv.id) FILTER (WHERE pv.current_stock = 0)::int                     AS out_of_stock_count
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND pv.enabled = true
    GROUP BY p.hotel_id
  ),

  -- ── Per-variant avg daily consumption → hotel-level avg days of supply ──────
  consumption AS (
    SELECT
      sl.hotel_id,
      pv.id                                                                      AS variant_id,
      pv.current_stock,
      ABS(SUM(sl.quantity_change)) / GREATEST(p_days::numeric, 1)               AS avg_daily
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.quantity_change < 0
      AND sl.is_revert = false
      AND sl.timestamp >= NOW() - (p_days || ' days')::interval
    GROUP BY sl.hotel_id, pv.id, pv.current_stock
    HAVING ABS(SUM(sl.quantity_change)) > 0
  ),

  supply_days AS (
    SELECT
      hotel_id,
      ROUND(AVG(current_stock / NULLIF(avg_daily, 0)), 1)                       AS avg_days_supply
    FROM consumption
    GROUP BY hotel_id
  ),

  -- ── Flow metrics ────────────────────────────────────────────────────────────
  flow_metrics AS (
    SELECT
      sl.hotel_id,
      COALESCE(SUM(sl.quantity_change)
        FILTER (WHERE sl.quantity_change > 0 AND NOT sl.is_revert), 0)::int     AS total_added_units,
      COALESCE(ABS(SUM(sl.quantity_change) FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert)), 0)::int   AS waste_units,
      COALESCE(ABS(SUM(sl.quantity_change) FILTER (WHERE sl.quantity_change < 0)), 0)::int                        AS total_removed_units,
      COUNT(*)::int                                                              AS stock_log_count
    FROM stock_logs sl
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.timestamp >= NOW() - (p_days || ' days')::interval
    GROUP BY sl.hotel_id
  ),

  -- ── Waste monetary cost ──────────────────────────────────────────────────────
  waste_cost_cte AS (
    SELECT
      sl.hotel_id,
      ROUND(COALESCE(SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)), 0), 2) AS waste_cost
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.quantity_change < 0
      AND sl.is_revert = false
      AND sl.timestamp >= NOW() - (p_days || ' days')::interval
    GROUP BY sl.hotel_id
  ),

  -- ── Restock activity ─────────────────────────────────────────────────────────
  restock_metrics AS (
    SELECT
      hotel_id,
      COUNT(*)::int                                                              AS total_restocks,
      COUNT(*) FILTER (WHERE status IN ('pending', 'approved'))::int            AS pending_restocks
    FROM restock_requests
    WHERE hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND date >= NOW() - (p_days || ' days')::interval
    GROUP BY hotel_id
  ),

  -- ── Supplier composite scores from delivery_events (if populated) ────────────
  supplier_scores AS (
    SELECT
      ss.hotel_id,
      ROUND(AVG(
        COALESCE(ss.on_time_rate,  50) * 0.4 +
        COALESCE(ss.avg_fill_rate, 80) * 0.4 +
        (20 - LEAST(GREATEST(COALESCE(ss.avg_price_drift_pct, 0) * 2, 0), 20))
      ), 0)                                                                      AS avg_supplier_score
    FROM supplier_scorecard ss
    WHERE ss.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND ss.total_deliveries > 0
    GROUP BY ss.hotel_id
  )

  SELECT
    h.id                                                                         AS hotel_id,
    h.name                                                                       AS hotel_name,
    COALESCE(sh.total_variants,     0)                                           AS total_variants,
    COALESCE(sh.low_stock_count,    0)                                           AS low_stock_count,
    COALESCE(sh.out_of_stock_count, 0)                                           AS out_of_stock_count,
    COALESCE(sd.avg_days_supply,    0)                                           AS avg_days_supply,
    COALESCE(fm.total_added_units,  0)                                           AS total_added_units,
    COALESCE(fm.waste_units,        0)                                           AS waste_units,
    COALESCE(wc.waste_cost,         0)                                           AS waste_cost,
    ROUND(
      COALESCE(fm.waste_units, 0)::numeric
      / NULLIF(COALESCE(fm.total_removed_units, 0), 0),
      3
    )                                                                            AS waste_rate,
    COALESCE(fm.stock_log_count,    0)                                           AS stock_log_count,
    COALESCE(rm.total_restocks,     0)                                           AS total_restocks,
    COALESCE(rm.pending_restocks,   0)                                           AS pending_restocks,
    ss.avg_supplier_score,

    -- ── Health score (0-100) ──────────────────────────────────────────────────
    LEAST(100, GREATEST(0, (

      -- Stock health (max 35 pts): each OOS variant costs 3pts, low-stock costs 1pt
      GREATEST(0,
        35
        - COALESCE(sh.out_of_stock_count, 0) * 3
        - COALESCE(sh.low_stock_count, 0)
      )

      -- Waste rate (max 30 pts): 30 × (1 − min(waste_rate, 1))
      + ROUND(30.0 * (1.0 - LEAST(
          COALESCE(fm.waste_units, 0)::numeric
          / NULLIF(COALESCE(fm.total_removed_units, 0), 0),
          1.0
        )), 0)

      -- Avg supply (max 20 pts): linear scale 0–14 days = 0–20 pts
      + LEAST(20, ROUND(COALESCE(sd.avg_days_supply, 0) / 14.0 * 20.0, 0))

      -- Restock pressure (max 15 pts)
      + CASE
          WHEN COALESCE(sh.total_variants, 0) = 0 THEN 15
          WHEN COALESCE(rm.pending_restocks, 0)::numeric
               / NULLIF(COALESCE(sh.total_variants, 0), 0) < 0.10 THEN 15
          WHEN COALESCE(rm.pending_restocks, 0)::numeric
               / NULLIF(COALESCE(sh.total_variants, 0), 0) < 0.20 THEN 10
          ELSE 5
        END

    )))::int                                                                     AS health_score

  FROM my_hotels mh
  JOIN hotels h              ON h.id  = mh.hotel_id
  LEFT JOIN stock_health  sh ON sh.hotel_id  = h.id
  LEFT JOIN supply_days   sd ON sd.hotel_id  = h.id
  LEFT JOIN flow_metrics  fm ON fm.hotel_id  = h.id
  LEFT JOIN waste_cost_cte wc ON wc.hotel_id = h.id
  LEFT JOIN restock_metrics rm ON rm.hotel_id = h.id
  LEFT JOIN supplier_scores ss ON ss.hotel_id = h.id
  ORDER BY health_score ASC;  -- worst first — regional directors act on the bottom
$$;

GRANT EXECUTE ON FUNCTION get_chain_overview(int) TO authenticated;
