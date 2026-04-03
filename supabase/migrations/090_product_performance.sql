-- Migration 090: Product Performance Intelligence
-- Layer: Eye — cross-domain synthesis
-- Palantir principle: intelligence everywhere.
--   Every number must carry its derived context.
--   This function turns raw stock history into a performance scorecard:
--   waste rate + stockout exposure + PAR compliance → performance tier + score.
--
-- Key insight: compute a running balance from stock_at_window_start + cumulative
-- changes so we can count actual stockout days and below-par days — not just
-- point-in-time snapshots.
--
-- performance_tier:
--   critical         waste_rate > 15% AND stockout_days >= 2
--   waste_heavy      waste_rate > 15%
--   stockout_prone   stockout_days >= 2
--   at_risk          below_par_days > 20% of window, or waste_rate 8-15%
--   idle             no consumption and no waste in window
--   efficient        everything within thresholds
--
-- performance_score: 0–100, higher = more attention needed

SET search_path = public;

CREATE OR REPLACE FUNCTION get_product_performance(
  p_window_days int DEFAULT 30
)
RETURNS TABLE (
  variant_id           uuid,
  product_name         text,
  variant_name         text,
  sku                  text,
  category_name        text,
  current_stock        int,
  par_level            int,
  -- Consumption
  consumption_units    int,
  consumption_value    numeric,
  -- Waste
  waste_units          int,
  waste_cost           numeric,
  waste_rate_pct       numeric,   -- null when no activity
  -- Availability (running balance)
  stockout_days        int,       -- distinct days stock hit 0
  below_par_days       int,       -- distinct days stock < par_level
  par_compliance_pct   numeric,   -- (window_days - below_par_days) / window_days * 100
  -- Classification
  performance_score    numeric,   -- 0–100 composite, higher = worse
  performance_tier     text       -- 'critical'|'waste_heavy'|'stockout_prone'|'at_risk'|'idle'|'efficient'
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id    uuid;
  v_window_start timestamptz;
BEGIN
  v_hotel_id    := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  v_window_start := NOW() - (p_window_days || ' days')::interval;

  RETURN QUERY
  WITH

  -- ── Active variants for this hotel ────────────────────────────────────────
  variants AS (
    SELECT
      pv.id           AS variant_id,
      p.name          AS product_name,
      pv.name         AS variant_name,
      pv.sku,
      c.name          AS category_name,
      pv.current_stock,
      COALESCE(pv.low_stock_threshold, 0) AS par_level,
      COALESCE(pv.cost, 0)                AS unit_cost
    FROM product_variants pv
    JOIN products  p ON p.id = pv.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.hotel_id    = v_hotel_id
      AND pv.is_deleted = false
  ),

  -- ── Consumption: non-waste removals in window ─────────────────────────────
  consumption AS (
    SELECT
      sl.variant_id,
      SUM(ABS(sl.quantity_change))::int AS units
    FROM stock_logs sl
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.quantity_change   < 0
      AND sl.removal_category IS NULL
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY sl.variant_id
  ),

  -- ── Waste: categorised removals in window ─────────────────────────────────
  waste AS (
    SELECT
      sl.variant_id,
      SUM(ABS(sl.quantity_change))::int AS units
    FROM stock_logs sl
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.quantity_change   < 0
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage', 'Expired', 'Other')
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY sl.variant_id
  ),

  -- ── Stock at window start = current_stock − net change in window ──────────
  net_window_change AS (
    SELECT sl.variant_id, SUM(sl.quantity_change) AS net_change
    FROM stock_logs sl
    WHERE sl.hotel_id   = v_hotel_id
      AND sl.timestamp >= v_window_start
      AND sl.is_revert  = false
    GROUP BY sl.variant_id
  ),
  start_stock AS (
    SELECT
      v.variant_id,
      v.current_stock - COALESCE(nwc.net_change, 0) AS stock_at_start
    FROM variants v
    LEFT JOIN net_window_change nwc ON nwc.variant_id = v.variant_id
  ),

  -- ── Running daily balance within window ───────────────────────────────────
  -- For every stock_log event, compute the cumulative stock at that point.
  running_balance AS (
    SELECT
      sl.variant_id,
      DATE(sl.timestamp AT TIME ZONE 'UTC')                              AS day,
      ss.stock_at_start + SUM(sl.quantity_change) OVER (
        PARTITION BY sl.variant_id
        ORDER BY sl.timestamp
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )                                                                    AS running_stock
    FROM stock_logs sl
    JOIN start_stock ss ON ss.variant_id = sl.variant_id
    WHERE sl.hotel_id   = v_hotel_id
      AND sl.timestamp >= v_window_start
      AND sl.is_revert  = false
  ),

  -- ── Min stock per day (worst point each day) ──────────────────────────────
  daily_min AS (
    SELECT
      rb.variant_id,
      rb.day,
      MIN(rb.running_stock) AS min_stock
    FROM running_balance rb
    GROUP BY rb.variant_id, rb.day
  ),

  -- ── Availability metrics per variant ──────────────────────────────────────
  availability AS (
    SELECT
      dm.variant_id,
      COUNT(DISTINCT dm.day) FILTER (WHERE dm.min_stock <= 0)
        ::int AS stockout_days,
      COUNT(DISTINCT dm.day) FILTER (
        WHERE dm.min_stock < COALESCE(
          (SELECT par_level FROM variants v2 WHERE v2.variant_id = dm.variant_id), 0
        )
      )::int AS below_par_days
    FROM daily_min dm
    GROUP BY dm.variant_id
  )

  -- ── Final assembly + scoring ──────────────────────────────────────────────
  SELECT
    v.variant_id,
    v.product_name,
    v.variant_name,
    COALESCE(v.sku, '') AS sku,
    v.category_name,
    v.current_stock,
    v.par_level,

    COALESCE(c.units, 0)                AS consumption_units,
    ROUND(COALESCE(c.units, 0) * v.unit_cost, 2) AS consumption_value,

    COALESCE(w.units, 0)                AS waste_units,
    ROUND(COALESCE(w.units, 0) * v.unit_cost, 2) AS waste_cost,

    -- waste rate: write-offs / (consumption + write-offs), null when no activity
    CASE
      WHEN COALESCE(c.units, 0) + COALESCE(w.units, 0) > 0
        THEN ROUND(
          COALESCE(w.units, 0)::numeric
          / (COALESCE(c.units, 0) + COALESCE(w.units, 0)) * 100,
          1
        )
      ELSE NULL
    END AS waste_rate_pct,

    COALESCE(av.stockout_days, 0)       AS stockout_days,
    COALESCE(av.below_par_days, 0)      AS below_par_days,

    ROUND(
      (p_window_days - COALESCE(av.below_par_days, 0))::numeric
      / p_window_days * 100,
      1
    )                                   AS par_compliance_pct,

    -- ── Performance score: 0–100, higher = worse ──────────────────────────
    ROUND(LEAST(100,
      -- Waste component (40 pts max): 40 at waste_rate ≥ 30%
      CASE
        WHEN COALESCE(c.units, 0) + COALESCE(w.units, 0) > 0
          THEN LEAST(40, COALESCE(w.units, 0)::numeric
               / (COALESCE(c.units, 0) + COALESCE(w.units, 0)) * 133)
        ELSE 0
      END +
      -- Stockout component (35 pts max): 35 at stockout every day
      COALESCE(av.stockout_days, 0)::numeric / p_window_days * 35 +
      -- Below-par component (15 pts max): 15 at below-par every day
      COALESCE(av.below_par_days, 0)::numeric / p_window_days * 15 +
      -- Idle penalty (10 pts): no activity at all
      CASE
        WHEN COALESCE(c.units, 0) = 0 AND COALESCE(w.units, 0) = 0
          THEN 10
        ELSE 0
      END
    ), 1) AS performance_score,

    -- ── Performance tier ──────────────────────────────────────────────────
    CASE
      WHEN COALESCE(c.units, 0) = 0 AND COALESCE(w.units, 0) = 0
        THEN 'idle'
      WHEN
        -- waste_rate > 15% AND stockout_days >= 2 = critical
        (COALESCE(w.units, 0)::numeric / NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0) * 100 > 15)
        AND COALESCE(av.stockout_days, 0) >= 2
        THEN 'critical'
      WHEN
        COALESCE(w.units, 0)::numeric / NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0) * 100 > 15
        THEN 'waste_heavy'
      WHEN COALESCE(av.stockout_days, 0) >= 2
        THEN 'stockout_prone'
      WHEN
        COALESCE(av.below_par_days, 0)::numeric / p_window_days > 0.20
        OR (COALESCE(w.units, 0)::numeric / NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0) * 100) BETWEEN 8 AND 15
        THEN 'at_risk'
      ELSE 'efficient'
    END AS performance_tier

  FROM variants v
  LEFT JOIN consumption c  ON c.variant_id  = v.variant_id
  LEFT JOIN waste       w  ON w.variant_id  = v.variant_id
  LEFT JOIN availability av ON av.variant_id = v.variant_id

  -- Exclude variants with zero activity AND already sufficient stock
  -- (genuine "healthy idle" variants are still shown, just tier = 'efficient')
  WHERE (
    COALESCE(c.units, 0) > 0
    OR COALESCE(w.units, 0) > 0
    OR COALESCE(av.stockout_days, 0) > 0
    OR v.current_stock > 0
  )

  ORDER BY
    -- Critical first, then by performance_score desc
    CASE
      WHEN COALESCE(c.units, 0) = 0 AND COALESCE(w.units, 0) = 0                                                         THEN 5
      WHEN (COALESCE(w.units,0)::numeric / NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0)*100>15)
           AND COALESCE(av.stockout_days,0) >= 2                                                                          THEN 0
      WHEN COALESCE(w.units,0)::numeric / NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0)*100>15                       THEN 1
      WHEN COALESCE(av.stockout_days,0) >= 2                                                                               THEN 2
      WHEN COALESCE(av.below_par_days,0)::numeric/p_window_days>0.20
           OR (COALESCE(w.units,0)::numeric/NULLIF(COALESCE(c.units,0)+COALESCE(w.units,0),0)*100) BETWEEN 8 AND 15       THEN 3
      ELSE 4
    END,
    LEAST(100,
      CASE WHEN COALESCE(c.units,0)+COALESCE(w.units,0)>0
           THEN LEAST(40,COALESCE(w.units,0)::numeric/(COALESCE(c.units,0)+COALESCE(w.units,0))*133)
           ELSE 0 END +
      COALESCE(av.stockout_days,0)::numeric/p_window_days*35 +
      COALESCE(av.below_par_days,0)::numeric/p_window_days*15 +
      CASE WHEN COALESCE(c.units,0)=0 AND COALESCE(w.units,0)=0 THEN 10 ELSE 0 END
    ) DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION get_product_performance(int) TO authenticated;
