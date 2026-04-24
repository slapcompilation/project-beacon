-- ═══════════════════════════════════════════════════════════════════════════════
-- 103 — Occupancy-Driven Demand Scaling (Phase C: Predictive Operations)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   When booking forecasts show high occupancy, auto-adjust demand predictions
--   and generate pre-emptive restock proposals BEFORE the rush — not during it.
--
-- What this migration does:
--   1. Adds `occupancy_sensitivity` to categories (0.0–1.0 elasticity factor)
--   2. Creates `get_occupancy_adjusted_forecast()` — forward-looking demand scaling
--   3. Creates `generate_preemptive_restocks()` — auto-proposes restocks for demand spikes
--   4. Adds to the intelligence cycle pg_cron schedule
--
-- Depends on: 026, 053, 064, 102
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Category occupancy sensitivity ─���────────────────────────────────────────
-- How much this category's demand scales with occupancy.
-- 1.0 = demand scales linearly with occupancy (e.g., towels, toiletries)
-- 0.5 = partially correlated (e.g., minibar, F&B)
-- 0.0 = no correlation (e.g., cleaning chemicals, office supplies)

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS occupancy_sensitivity numeric(3,2) NOT NULL DEFAULT 0.5
    CHECK (occupancy_sensitivity >= 0 AND occupancy_sensitivity <= 1);

COMMENT ON COLUMN categories.occupancy_sensitivity IS
  'Occupancy demand elasticity 0.0–1.0. 1.0 = demand scales linearly with occupancy. '
  'Used by get_occupancy_adjusted_forecast() to scale consumption predictions.';

-- ─── 2. get_occupancy_adjusted_forecast() ───────────────────────────────────────
-- Forward-looking demand forecast that incorporates booking occupancy data.
-- For each variant:
--   adjusted_daily = base_avg_daily × (1 + sensitivity × (forecast_occ - baseline_occ) / baseline_occ)
-- Where baseline_occ is the average occupancy over the lookback window.

CREATE OR REPLACE FUNCTION get_occupancy_adjusted_forecast(
  p_forecast_days int DEFAULT 14,
  p_lookback_days int DEFAULT 30
)
RETURNS TABLE (
  variant_id               uuid,
  product_name             text,
  variant_name             text,
  sku                      text,
  category_name            text,
  current_stock            int,
  base_avg_daily           numeric,
  occupancy_sensitivity    numeric,
  baseline_occupancy_pct   numeric,
  forecast_occupancy_pct   numeric,
  demand_multiplier        numeric,
  adjusted_avg_daily       numeric,
  adjusted_days_until_zero numeric,
  adjusted_order_qty       int,
  demand_spike             boolean,
  has_open_request         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id     uuid := auth_hotel_id();
  v_baseline_occ numeric;
  v_forecast_occ numeric;
BEGIN
  -- Calculate baseline occupancy from recent history
  SELECT COALESCE(AVG(occupancy_pct), 60)
    INTO v_baseline_occ
    FROM occupancy_logs
   WHERE hotel_id = v_hotel_id
     AND date >= CURRENT_DATE - p_lookback_days;

  -- Calculate average forecasted occupancy for the next N days
  SELECT COALESCE(AVG(expected_occupancy_pct), v_baseline_occ)
    INTO v_forecast_occ
    FROM booking_forecasts
   WHERE hotel_id = v_hotel_id
     AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_forecast_days;

  RETURN QUERY
  SELECT
    pv.id                                                               AS variant_id,
    pr.name                                                             AS product_name,
    pv.name                                                             AS variant_name,
    pv.sku                                                              AS sku,
    COALESCE(cat.name, 'Uncategorized')                                 AS category_name,
    pv.current_stock                                                    AS current_stock,
    ROUND(ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric, 4)   AS base_avg_daily,
    COALESCE(cat.occupancy_sensitivity, 0.5)                            AS occupancy_sensitivity,
    ROUND(v_baseline_occ, 1)                                            AS baseline_occupancy_pct,
    ROUND(v_forecast_occ, 1)                                            AS forecast_occupancy_pct,

    -- Demand multiplier: how much to scale base consumption
    ROUND(
      CASE
        WHEN v_baseline_occ <= 0 THEN 1.0
        ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                    * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
      END, 3
    )                                                                   AS demand_multiplier,

    -- Adjusted daily consumption
    ROUND(
      ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
      * CASE
          WHEN v_baseline_occ <= 0 THEN 1.0
          ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                      * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
        END, 4
    )                                                                   AS adjusted_avg_daily,

    -- Adjusted days until zero
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN NULL
      ELSE ROUND(
        pv.current_stock / (
          ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
          * CASE
              WHEN v_baseline_occ <= 0 THEN 1.0
              ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                          * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
            END
        ), 1
      )
    END                                                                 AS adjusted_days_until_zero,

    -- Adjusted order quantity (30-day supply target)
    GREATEST(
      0,
      CEIL(
        (ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
         * CASE
             WHEN v_baseline_occ <= 0 THEN 1.0
             ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                         * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
           END
        ) * 30 - pv.current_stock
      )
    )::int                                                              AS adjusted_order_qty,

    -- Flag if demand spike detected (multiplier > 1.15 = 15%+ increase)
    CASE
      WHEN v_baseline_occ <= 0 THEN false
      ELSE (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                   * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)) > 1.15
    END                                                                 AS demand_spike,

    EXISTS (
      SELECT 1 FROM restock_requests rr
       WHERE rr.variant_id = pv.id
         AND rr.hotel_id   = v_hotel_id
         AND rr.status     IN ('pending', 'pending_manager', 'pending_director', 'approved')
    )                                                                   AS has_open_request

  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr         ON pr.id = pv.product_id
  LEFT JOIN categories cat ON cat.id = pr.category_id
  WHERE sl.hotel_id       = v_hotel_id
    AND sl.quantity_change < 0
    AND sl.is_revert       = false
    AND sl.timestamp      >= NOW() - (p_lookback_days || ' days')::interval
    AND pv.enabled         = true
  GROUP BY pv.id, pv.name, pv.sku, pv.current_stock, pr.name, cat.name, cat.occupancy_sensitivity
  HAVING ABS(SUM(sl.quantity_change)) > 0
  ORDER BY
    -- Sort by adjusted days until zero (most urgent first), with demand spikes prioritized
    CASE
      WHEN v_baseline_occ > 0
           AND (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                       * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)) > 1.15
      THEN 0  -- demand spikes first
      ELSE 1
    END,
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN 99999
      ELSE pv.current_stock / (
        ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
        * CASE
            WHEN v_baseline_occ <= 0 THEN 1.0
            ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                        * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
          END
      )
    END ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_occupancy_adjusted_forecast(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupancy_adjusted_forecast(int, int) TO service_role;

-- ─── 3. generate_preemptive_restocks() ──────────────────────────────────────────
-- Called by the intelligence cycle. Scans the occupancy-adjusted forecast for
-- items that will run out during the forecast window and auto-proposes restocks.

CREATE OR REPLACE FUNCTION generate_preemptive_restocks(
  p_forecast_days int DEFAULT 14,
  p_threshold_days numeric DEFAULT 7
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_row   record;
BEGIN
  FOR v_row IN
    SELECT f.variant_id, f.product_name, f.sku, f.adjusted_order_qty,
           f.adjusted_days_until_zero, f.demand_spike, f.demand_multiplier
      FROM get_occupancy_adjusted_forecast(p_forecast_days, 30) f
     WHERE f.adjusted_days_until_zero IS NOT NULL
       AND f.adjusted_days_until_zero <= p_threshold_days
       AND f.adjusted_order_qty > 0
       AND f.has_open_request = false
       AND f.demand_spike = true  -- Only auto-propose when occupancy drives the urgency
  LOOP
    INSERT INTO restock_requests (
      hotel_id, variant_id, quantity_needed, notes, is_auto_proposed, requestor_id
    ) VALUES (
      auth_hotel_id(),
      v_row.variant_id,
      v_row.adjusted_order_qty,
      'Pre-emptive restock: occupancy-driven demand spike (×' || ROUND(v_row.demand_multiplier, 2)::text
        || ') predicts depletion in ~' || ROUND(v_row.adjusted_days_until_zero, 0)::text || 'd',
      true,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_preemptive_restocks(int, numeric) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
-- - categories.occupancy_sensitivity: per-category demand elasticity
-- - get_occupancy_adjusted_forecast(): returns demand-adjusted forecasts
-- - generate_preemptive_restocks(): auto-proposes restocks for demand spikes
-- ═══════════════════════════════════════════════════════════════════════════════
