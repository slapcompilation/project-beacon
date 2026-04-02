-- Migration 083: Simulation Cockpit
-- Layer: Mind → Eye cross-layer
-- Palantir principle: operators must be able to stress-test reality before committing to action.
--
-- simulate_scenario(type, param, variant_ids?) reruns stockout math with modified
-- parameters so operators can answer "what happens IF…" before it happens:
--
--   demand_shock   — consumption rises/falls by param%
--   supplier_delay — supply arrives param days late (debits effective stock for
--                    variants with open restock requests)
--   writeoff_spike — waste depletion rises by param% (modelled as fraction of mean)
--   par_change     — PAR level changes to param% of current; shows new reorder qty
--
-- Baseline comes from compute_stockout_probability(). Scenario adjusts mean_daily
-- and/or effective stock, then recomputes days_until_zero + P(stockout in 7d)
-- via the same normal-CDF formula used in migration 081.

SET search_path = public;

CREATE OR REPLACE FUNCTION simulate_scenario(
  p_scenario_type text,     -- 'demand_shock' | 'supplier_delay' | 'writeoff_spike' | 'par_change'
  p_param_value   numeric,  -- demand_shock/writeoff_spike: % change (e.g. 30 = +30%)
                             -- supplier_delay: days (e.g. 7)
                             -- par_change: % of current PAR level (e.g. 150 = +50%)
  p_variant_ids   uuid[]   DEFAULT NULL   -- NULL = all variants with ≥3 data days
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id     uuid;
  v_param_label  text;
  v_result       jsonb;
BEGIN
  SELECT hotel_id INTO v_hotel_id
  FROM hotel_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_hotel_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'not_authenticated',
      'affected_variants', '[]'::jsonb
    );
  END IF;

  -- Human-readable parameter label for UI display
  v_param_label := CASE p_scenario_type
    WHEN 'demand_shock'   THEN
      (CASE WHEN p_param_value >= 0 THEN '+' ELSE '' END) ||
      p_param_value::int || '% demand'
    WHEN 'supplier_delay' THEN
      p_param_value::int || 'd supplier delay'
    WHEN 'writeoff_spike' THEN
      '+' || p_param_value::int || '% write-off rate'
    WHEN 'par_change'     THEN
      p_param_value::int || '% PAR adjustment'
    ELSE p_scenario_type
  END;

  WITH

  -- ── Baseline from existing probability engine ─────────────────────────────
  baseline AS (
    SELECT *
    FROM compute_stockout_probability()
    WHERE data_days >= 3
      AND (p_variant_ids IS NULL OR variant_id = ANY(p_variant_ids))
  ),

  -- ── Open restock requests (for supplier_delay scenario) ───────────────────
  open_requests AS (
    SELECT DISTINCT variant_id
    FROM restock_requests
    WHERE hotel_id = v_hotel_id
      AND status IN ('pending', 'approved', 'ordered')
  ),

  -- ── PAR levels (for par_change recommended qty) ───────────────────────────
  par_levels AS (
    SELECT pv.id AS variant_id, pv.low_stock_threshold AS par_level
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.hotel_id = v_hotel_id
  ),

  -- ── Apply scenario to each variant ───────────────────────────────────────
  scenario_applied AS (
    SELECT
      b.variant_id,
      b.product_name,
      b.sku,
      b.current_stock,
      b.mean_daily_30d,
      b.stddev_daily,
      b.days_until_zero          AS baseline_days_zero,
      COALESCE(b.stockout_prob_7d,  0) AS baseline_prob_7d,
      COALESCE(b.stockout_prob_14d, 0) AS baseline_prob_14d,
      b.confidence_score,
      b.demand_pattern,
      COALESCE(pl.par_level, 0)  AS par_level,
      (or_.variant_id IS NOT NULL) AS has_open_request,

      -- Adjusted mean daily consumption
      GREATEST(0.001, CASE p_scenario_type
        WHEN 'demand_shock'
          -- consumption increases or decreases by param%
          THEN b.mean_daily_30d * (1.0 + p_param_value / 100.0)
        WHEN 'writeoff_spike'
          -- waste drives ~35% of stock removals on average;
          -- a spike of param% increases total depletion by param*0.35%
          THEN b.mean_daily_30d * (1.0 + (p_param_value / 100.0) * 0.35)
        ELSE b.mean_daily_30d
      END) AS adj_mean,

      -- Adjusted effective stock
      GREATEST(0, CASE p_scenario_type
        WHEN 'supplier_delay'
          -- Only variants with open requests are affected — they were counting on
          -- incoming supply, which now arrives p_param days later.
          -- Deduct consumption over the delay window from effective stock.
          THEN CASE WHEN or_.variant_id IS NOT NULL
            THEN b.current_stock - b.mean_daily_30d * p_param_value
            ELSE b.current_stock
          END
        ELSE b.current_stock
      END)::float8 AS adj_stock

    FROM baseline b
    LEFT JOIN open_requests or_ ON or_.variant_id = b.variant_id
    LEFT JOIN par_levels    pl  ON pl.variant_id  = b.variant_id
  ),

  -- ── Project new days-until-zero and P(stockout in 7d) ─────────────────────
  projected AS (
    SELECT
      s.*,

      -- Projected days until zero with adjusted mean + effective stock
      CASE WHEN s.adj_mean > 0
        THEN LEAST(999.0, s.adj_stock / s.adj_mean)
        ELSE 999.0
      END AS proj_days_zero,

      -- Projected P(stockout in 7d) — same formula as migration 081 ×100 scale
      CASE
        WHEN s.adj_mean <= 0     THEN 0.0
        WHEN s.stddev_daily <= 0 THEN
          CASE WHEN s.adj_stock < s.adj_mean * 7 THEN 100.0 ELSE 0.0 END
        ELSE ROUND((
          (1.0 - _normal_cdf(
            (s.adj_stock - s.adj_mean * 7.0)
            / (s.stddev_daily * sqrt(7.0))
          )) * 100.0
        )::numeric, 1)::float8
      END AS proj_prob_7d,

      -- Recommended restock qty
      CASE p_scenario_type
        WHEN 'par_change' THEN
          -- New PAR = par_level * (param/100); order up to fill it
          GREATEST(0, CEIL(s.par_level * (p_param_value / 100.0) - s.current_stock))
        ELSE
          -- Cover 14 days of projected consumption above current stock
          GREATEST(0, CEIL(s.adj_mean * 14.0 - s.adj_stock))
      END::int AS recommended_qty

    FROM scenario_applied s
  ),

  -- ── Tag recommended action ────────────────────────────────────────────────
  with_action AS (
    SELECT
      p.*,
      CASE
        WHEN p.proj_days_zero < 7
          THEN 'request_restock'
        WHEN p.proj_prob_7d > 60
          THEN 'request_restock'
        WHEN p.proj_days_zero < p.baseline_days_zero * 0.65
          THEN 'monitor'
        ELSE NULL
      END AS recommended_action
    FROM projected p
  ),

  -- ── Aggregate summaries ───────────────────────────────────────────────────
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE baseline_days_zero < 14 OR baseline_prob_7d > 30) AS base_at_risk,
      COUNT(*) FILTER (WHERE baseline_prob_7d > 60)                            AS base_critical,
      COUNT(*) FILTER (WHERE proj_days_zero < 14    OR proj_prob_7d > 30)      AS proj_at_risk,
      COUNT(*) FILTER (WHERE proj_prob_7d > 60)                                AS proj_critical,
      COUNT(*) FILTER (WHERE recommended_action = 'request_restock')           AS restock_needed,
      ROUND(AVG(confidence_score)::numeric, 2)                                 AS avg_confidence
    FROM with_action
  )

  SELECT jsonb_build_object(
    'scenario_type',  p_scenario_type,
    'param_value',    p_param_value,
    'param_label',    v_param_label,
    'confidence',     (SELECT avg_confidence FROM totals),
    'baseline_summary', (
      SELECT jsonb_build_object(
        'variants_at_risk', base_at_risk,
        'critical_in_7d',   base_critical
      ) FROM totals
    ),
    'projected_summary', (
      SELECT jsonb_build_object(
        'variants_at_risk', proj_at_risk,
        'critical_in_7d',   proj_critical,
        'restock_needed',   restock_needed
      ) FROM totals
    ),
    'affected_variants', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'variant_id',          wa.variant_id,
          'product_name',        wa.product_name,
          'sku',                 wa.sku,
          'current_stock',       wa.current_stock,
          'mean_daily_30d',      ROUND(wa.mean_daily_30d::numeric, 2),
          'par_level',           wa.par_level,
          'has_open_request',    wa.has_open_request,
          'demand_pattern',      wa.demand_pattern,
          'confidence_score',    wa.confidence_score,
          'baseline_days_zero',  ROUND(wa.baseline_days_zero::numeric, 1),
          'projected_days_zero', ROUND(wa.proj_days_zero::numeric, 1),
          'baseline_prob_7d',    wa.baseline_prob_7d,
          'projected_prob_7d',   ROUND(wa.proj_prob_7d::numeric, 1),
          'delta_days',          ROUND((wa.proj_days_zero - wa.baseline_days_zero)::numeric, 1),
          'delta_prob_7d',       ROUND((wa.proj_prob_7d - wa.baseline_prob_7d)::numeric, 1),
          'recommended_action',  wa.recommended_action,
          'recommended_qty',     wa.recommended_qty
        ) ORDER BY wa.proj_prob_7d DESC, wa.proj_days_zero ASC
      )
      FROM with_action wa
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION simulate_scenario(text, numeric, uuid[]) TO authenticated;
