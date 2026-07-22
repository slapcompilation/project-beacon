-- Layer: Mind — chain benchmarking was never a chain.
--
-- get_chain_overview (037), get_chain_health_trend (092) and get_chain_benchmarks
-- (169) all scoped `my_hotels` to `SELECT hotel_id FROM profiles WHERE id = auth.uid()`
-- — the caller's single legacy home hotel. So every "chain" surface benchmarked a
-- property against a chain of ONE (itself): medians equalled the value, deviations
-- were always 1.0×, and "which property needs attention" could only ever list the
-- caller's own hotel. This predates the org model (organization_id + memberships).
--
-- Fix: scope to the whole org, gated to admin/owner, exactly like get_portfolio_signals
-- (174) — the proven org-wide rollup. CLAUDE.md: "Benchmarking is a property of the
-- network, not a feature." Non-admin/owner and anon get an empty set (the role gate
-- lives in the CTE so the functions stay LANGUAGE sql). All three are owner-gated in
-- the UI (Insights → Chain, and the portfolio Home's Chain section).
--
-- Bodies reproduced verbatim from 037 / 092 / 169; only the my_hotels CTE changes.

SET search_path = public;

-- ── get_chain_overview ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_chain_overview(p_days int DEFAULT 30)
RETURNS TABLE (
  hotel_id              uuid,
  hotel_name            text,
  total_variants        int,
  low_stock_count       int,
  out_of_stock_count    int,
  avg_days_supply       numeric,
  total_added_units     int,
  waste_units           int,
  waste_cost            numeric,
  waste_rate            numeric,
  stock_log_count       int,
  total_restocks        int,
  pending_restocks      int,
  avg_supplier_score    numeric,
  health_score          int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_hotels AS (
    -- Whole org, admin/owner only (see migration header).
    SELECT id AS hotel_id
    FROM hotels
    WHERE organization_id IS NOT DISTINCT FROM auth_org_id()
      AND auth_role() IN ('owner', 'admin')
  ),

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

    LEAST(100, GREATEST(0, (
      GREATEST(0,
        35
        - COALESCE(sh.out_of_stock_count, 0) * 3
        - COALESCE(sh.low_stock_count, 0)
      )
      + ROUND(30.0 * (1.0 - LEAST(
          COALESCE(fm.waste_units, 0)::numeric
          / NULLIF(COALESCE(fm.total_removed_units, 0), 0),
          1.0
        )), 0)
      + LEAST(20, ROUND(COALESCE(sd.avg_days_supply, 0) / 14.0 * 20.0, 0))
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
  ORDER BY health_score ASC;
$$;

GRANT EXECUTE ON FUNCTION get_chain_overview(int) TO authenticated;

-- ── get_chain_health_trend ────────────────────────────────────────────────────
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
    SELECT id AS hotel_id
    FROM hotels
    WHERE organization_id IS NOT DISTINCT FROM auth_org_id()
      AND auth_role() IN ('owner', 'admin')
  ),
  cutoff AS (
    SELECT DATE_TRUNC('month', NOW()) - ((p_months_back - 1) * INTERVAL '1 month') AS start_month
  ),

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

-- ── get_chain_benchmarks ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_chain_benchmarks(p_days integer DEFAULT 30)
 RETURNS TABLE(hotel_id uuid, hotel_name text, total_removed integer, total_wasted integer, waste_rate numeric, total_added integer, avg_fill_rate numeric, avg_on_time_rate numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_hotels AS (
    SELECT id AS hotel_id
    FROM hotels
    WHERE organization_id IS NOT DISTINCT FROM auth_org_id()
      AND auth_role() IN ('owner', 'admin')
  ),

  stock_flow AS (
    SELECT
      sl.hotel_id,
      COALESCE(
        ABS(SUM(sl.quantity_change)
          FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert))::int,
        0
      )                                                                        AS total_removed,
      COALESCE(
        ABS(SUM(sl.quantity_change)
          FILTER (
            WHERE sl.quantity_change < 0
              AND NOT sl.is_revert
              AND sl.category IN ('Breakage','Theft','Spoilage')
          ))::int,
        0
      )                                                                        AS total_wasted,
      COALESCE(
        SUM(sl.quantity_change)
          FILTER (WHERE sl.quantity_change > 0 AND NOT sl.is_revert)::int,
        0
      )                                                                        AS total_added
    FROM stock_logs sl
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.timestamp >= NOW() - (p_days || ' days')::interval
    GROUP BY sl.hotel_id
  ),

  supplier_agg AS (
    SELECT
      ss.hotel_id,
      ROUND(AVG(ss.avg_fill_rate),  1) AS avg_fill_rate,
      ROUND(AVG(ss.on_time_rate),   1) AS avg_on_time_rate
    FROM supplier_scorecard ss
    WHERE ss.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND ss.total_deliveries > 0
    GROUP BY ss.hotel_id
  )

  SELECT
    h.id                                                           AS hotel_id,
    h.name                                                         AS hotel_name,
    COALESCE(sf.total_removed, 0)                                  AS total_removed,
    COALESCE(sf.total_wasted,  0)                                  AS total_wasted,
    ROUND(
      COALESCE(sf.total_wasted, 0)::numeric
      / NULLIF(COALESCE(sf.total_removed, 0), 0),
      3
    )                                                              AS waste_rate,
    COALESCE(sf.total_added, 0)                                    AS total_added,
    sa.avg_fill_rate,
    sa.avg_on_time_rate

  FROM my_hotels mh
  JOIN hotels h ON h.id = mh.hotel_id
  LEFT JOIN stock_flow  sf ON sf.hotel_id = h.id
  LEFT JOIN supplier_agg sa ON sa.hotel_id = h.id
  ORDER BY total_wasted DESC NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION get_chain_benchmarks(int) TO authenticated;
