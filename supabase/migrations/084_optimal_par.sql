-- Migration 084: Probabilistic PAR Level Engine
-- Layer: Eye → Mind cross-layer
-- Palantir principle: intelligence everywhere — every threshold carries its basis.
--
-- compute_optimal_par(p_service_level) answers: "what PAR level guarantees that
-- we remain in stock X% of the time, given our actual consumption variance and
-- actual supplier delivery behaviour?"
--
-- No hardcoded constants. All inputs are derived from real data:
--   μ_d     — mean daily consumption (30-day zero-padded baseline)
--   σ_d     — stddev of daily consumption (same window)
--   L       — lead time in days:
--               1st choice: avg(actual LT from PO sent→closed) when ≥3 POs
--               2nd choice: suppliers.lead_time_days (stated)
--               3rd choice: hotel-wide median across all active suppliers
--   σ_L     — lead time stddev from PO history (0 when no history)
--   occ_adj — demand multiplier from booking_forecasts / occupancy_logs
--               applied only when Pearson r(consumption, occupancy) ≥ 0.35
--   z       — normal quantile for p_service_level, computed via _normal_quantile()
--
-- Formula:
--   adj_μ      = μ_d × occ_adj_factor
--   σ_dL       = sqrt(L × σ_d² + adj_μ² × σ_L²)   ← combined uncertainty
--   safety_stk = z × σ_dL
--   PAR        = ceil(adj_μ × L + safety_stk)
--
-- Also returns: service_level_at_current_par, expected_stockouts_per_year,
--   confidence_score (penalised for sparse data / uncertain lead time), rationale.

SET search_path = public;

-- ─── Inverse normal CDF (quantile function) ───────────────────────────────────
-- Beasley-Springer-Moro starting approximation + Newton-Raphson refinement.
-- Accurate to < 1e-12 after 6 iterations.

CREATE OR REPLACE FUNCTION _normal_quantile(p float8)
RETURNS float8
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  z   float8;
  t   float8;
  dz  float8;
  pdf float8;
  i   int;
BEGIN
  IF p <= 0.0 THEN RETURN -8.5; END IF;
  IF p >= 1.0 THEN RETURN  8.5; END IF;

  -- Beasley-Springer-Moro rational approximation for starting point
  t := sqrt(-2.0 * ln(LEAST(p, 1.0 - p)));
  z := t - (2.515517 + 0.802853 * t + 0.010328 * t * t)
         / (1.0 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  IF p < 0.5 THEN z := -z; END IF;

  -- Newton-Raphson refinement: z ← z − (Φ(z) − p) / φ(z)
  FOR i IN 1..8 LOOP
    pdf := exp(-z * z / 2.0) / sqrt(2.0 * pi());
    dz  := (_normal_cdf(z) - p) / pdf;
    z   := z - dz;
    EXIT WHEN ABS(dz) < 1e-14;
  END LOOP;

  RETURN GREATEST(-8.5, LEAST(8.5, z));
END;
$$;

GRANT EXECUTE ON FUNCTION _normal_quantile(float8) TO authenticated;

-- ─── Probabilistic PAR engine ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_optimal_par(
  p_service_level float8 DEFAULT 0.95   -- 0.80 – 0.999
)
RETURNS TABLE (
  variant_id                   uuid,
  product_name                 text,
  sku                          text,
  current_stock                int,
  current_par                  int,
  -- Consumption baseline
  mean_daily_30d               float8,
  stddev_daily                 float8,
  data_days                    int,
  demand_pattern               text,
  -- Lead time
  supplier_name                text,
  lead_time_days               float8,
  lead_time_stddev             float8,   -- from PO history; 0 when no history
  lead_time_source             text,     -- 'po_history' | 'supplier_stated' | 'hotel_median' | 'unknown'
  -- Occupancy adjustment
  occupancy_correlation        float8,   -- Pearson r; null when < 10 overlap days
  occupancy_adj_factor         float8,   -- forecast_7d / hist_30d; 1.0 when not applicable
  -- Derived inputs
  adj_mean_daily               float8,   -- mean_daily_30d × occ_adj_factor
  sigma_demand_lt              float8,   -- √(L×σ_d² + adj_μ²×σ_L²)
  safety_stock                 float8,   -- z × sigma_demand_lt
  -- Output
  recommended_par              int,
  par_delta                    int,      -- recommended − current (negative = reduce)
  change_type                  text,     -- 'increase' | 'decrease' | 'calibrated' | 'no_data' | 'no_lead_time'
  -- Service level analysis
  service_level_at_current_par float8,   -- Φ((current_par − adj_μ×L) / σ_dL); null when insufficient data
  expected_stockouts_per_year  float8,   -- (1 − SL_current) × (365 / L)
  -- Meta
  confidence_score             float8,   -- 0–1; penalised for sparse data & uncertain lead time
  rationale                    text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
  v_z        float8;
BEGIN
  SELECT hotel_id INTO v_hotel_id
  FROM hotel_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  -- Compute z-score once for the requested service level
  v_z := _normal_quantile(GREATEST(0.5, LEAST(0.9999, p_service_level)));

  RETURN QUERY
  WITH

  -- ── Consumption baseline (reuses Sprint 3 math) ──────────────────────────
  baseline AS (
    SELECT * FROM compute_stockout_probability()
  ),

  -- ── Variant meta: current PAR + supplier link ────────────────────────────
  variant_meta AS (
    SELECT
      pv.id                   AS variant_id,
      pv.low_stock_threshold  AS current_par,
      pv.default_supplier_id
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.hotel_id  = v_hotel_id
      AND pv.active   = true
      AND pv.enabled  = true
      AND p.enabled   = true
  ),

  -- ── Supplier stated lead times ───────────────────────────────────────────
  supplier_lt AS (
    SELECT id, name, lead_time_days::float8 AS lead_time_days
    FROM suppliers
    WHERE hotel_id = v_hotel_id
  ),

  -- ── Actual lead time distribution from PO history ────────────────────────
  -- Uses sent_at → closed_at window; only POs where both timestamps exist
  -- and status indicates a completed delivery.
  po_lt_stats AS (
    SELECT
      po.supplier_id,
      COUNT(*) AS po_count,
      AVG(
        EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
      ) AS avg_actual_lt,
      STDDEV_POP(
        EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
      ) AS stddev_actual_lt
    FROM purchase_orders po
    WHERE po.hotel_id   = v_hotel_id
      AND po.status     IN ('partially_received', 'closed')
      AND po.sent_at    IS NOT NULL
      AND po.closed_at  IS NOT NULL
      -- Positive lead time only — reject anomalies (e.g. backdated POs)
      AND po.closed_at > po.sent_at
      AND po.created_at >= NOW() - INTERVAL '2 years'
    GROUP BY po.supplier_id
  ),

  -- ── Hotel-wide median lead time as last-resort fallback ──────────────────
  hotel_median_lt AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY s.lead_time_days) AS median_lt
    FROM suppliers s
    WHERE s.hotel_id = v_hotel_id AND s.lead_time_days IS NOT NULL
  ),

  -- ── Daily consumption per variant (for occupancy correlation) ────────────
  daily_cons AS (
    SELECT
      sl.variant_id,
      DATE(sl.timestamp AT TIME ZONE 'UTC') AS day,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.quantity_change < 0) AS consumed
    FROM stock_logs sl
    WHERE sl.hotel_id  = v_hotel_id
      AND sl.timestamp >= NOW() - INTERVAL '30 days'
      AND sl.is_revert  = false
    GROUP BY sl.variant_id, DATE(sl.timestamp AT TIME ZONE 'UTC')
  ),

  -- ── Historical occupancy ─────────────────────────────────────────────────
  hist_occ AS (
    SELECT date, occupancy_pct::float8
    FROM occupancy_logs
    WHERE hotel_id = v_hotel_id
      AND date >= (NOW() - INTERVAL '30 days')::date
  ),

  -- ── Per-variant: Pearson r(consumption, occupancy) + historical mean ─────
  -- Requires ≥10 overlapping days and non-zero avg occupancy to be meaningful
  occ_corr_stats AS (
    SELECT
      dc.variant_id,
      corr(dc.consumed::float8, ho.occupancy_pct)::float8  AS occ_corr,
      AVG(ho.occupancy_pct)::float8                        AS avg_occ_30d
    FROM daily_cons dc
    JOIN hist_occ ho ON ho.date = dc.day
    GROUP BY dc.variant_id
    HAVING COUNT(*) >= 10
       AND AVG(ho.occupancy_pct) > 0
       AND STDDEV(dc.consumed::float8) > 0   -- no correlation if consumption never varies
  ),

  -- ── Forward occupancy forecast (next 7 days) ─────────────────────────────
  forecast_occ AS (
    SELECT AVG(expected_occupancy_pct)::float8 AS avg_forecast_7d
    FROM booking_forecasts
    WHERE hotel_id = v_hotel_id
      AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
  ),

  -- ── Assemble all inputs per variant ─────────────────────────────────────
  par_inputs AS (
    SELECT
      b.variant_id,
      b.product_name,
      b.sku,
      b.current_stock,
      b.mean_daily_30d,
      b.stddev_daily,
      b.data_days,
      b.confidence_score       AS base_confidence,
      b.demand_pattern,
      vm.current_par,
      -- Supplier
      slt.name                 AS supplier_name,
      -- Lead time (best available source, clamped to ≥1d)
      CASE
        WHEN polt.po_count >= 3 AND polt.avg_actual_lt IS NOT NULL
          THEN GREATEST(1.0, polt.avg_actual_lt)
        WHEN slt.lead_time_days IS NOT NULL
          THEN GREATEST(1.0, slt.lead_time_days)
        WHEN hml.median_lt IS NOT NULL
          THEN GREATEST(1.0, hml.median_lt)
        ELSE NULL   -- truly unknown — will be flagged
      END                      AS lt_days,
      COALESCE(polt.stddev_actual_lt, 0.0) AS lt_stddev,
      CASE
        WHEN polt.po_count >= 3 AND polt.avg_actual_lt IS NOT NULL THEN 'po_history'
        WHEN slt.lead_time_days IS NOT NULL                        THEN 'supplier_stated'
        WHEN hml.median_lt IS NOT NULL                             THEN 'hotel_median'
        ELSE                                                            'unknown'
      END                      AS lt_source,
      -- Occupancy
      ocs.occ_corr,
      ocs.avg_occ_30d,
      focc.avg_forecast_7d
    FROM baseline b
    JOIN variant_meta vm    ON vm.variant_id      = b.variant_id
    LEFT JOIN supplier_lt slt ON slt.id           = vm.default_supplier_id
    LEFT JOIN po_lt_stats polt ON polt.supplier_id = vm.default_supplier_id
    CROSS JOIN hotel_median_lt hml
    LEFT JOIN occ_corr_stats ocs ON ocs.variant_id = b.variant_id
    LEFT JOIN forecast_occ focc ON TRUE
  ),

  -- ── Compute occupancy adjustment factor and derived σ_dL ─────────────────
  par_derived AS (
    SELECT
      pi.*,
      -- occ_adj_factor: only when |r| ≥ 0.35, forecast available, clamped [0.5, 2.0]
      CASE
        WHEN pi.occ_corr IS NOT NULL
          AND ABS(pi.occ_corr) >= 0.35
          AND pi.avg_forecast_7d IS NOT NULL
          AND pi.avg_occ_30d > 0
          THEN GREATEST(0.5, LEAST(2.0, pi.avg_forecast_7d / pi.avg_occ_30d))
        ELSE 1.0
      END AS occ_adj,

      -- adjusted mean demand (incorporates upcoming occupancy signal)
      pi.mean_daily_30d *
        CASE
          WHEN pi.occ_corr IS NOT NULL
            AND ABS(pi.occ_corr) >= 0.35
            AND pi.avg_forecast_7d IS NOT NULL
            AND pi.avg_occ_30d > 0
            THEN GREATEST(0.5, LEAST(2.0, pi.avg_forecast_7d / pi.avg_occ_30d))
          ELSE 1.0
        END AS adj_mean

    FROM par_inputs pi
  ),

  par_with_sigma AS (
    SELECT
      pd.*,
      -- σ_dL = √(L × σ_d² + adj_μ² × σ_L²)
      CASE WHEN pd.lt_days IS NOT NULL
        THEN SQRT(
          pd.lt_days   * POWER(pd.stddev_daily, 2)
          + POWER(pd.adj_mean, 2) * POWER(pd.lt_stddev, 2)
        )
        ELSE 0.0
      END AS sigma_dL
    FROM par_derived pd
  )

  SELECT
    pw.variant_id,
    pw.product_name,
    pw.sku,
    pw.current_stock,
    pw.current_par,
    pw.mean_daily_30d,
    pw.stddev_daily,
    pw.data_days,
    pw.demand_pattern,
    pw.supplier_name,
    pw.lt_days                                        AS lead_time_days,
    pw.lt_stddev                                      AS lead_time_stddev,
    pw.lt_source                                      AS lead_time_source,
    pw.occ_corr                                       AS occupancy_correlation,
    pw.occ_adj                                        AS occupancy_adj_factor,
    pw.adj_mean                                       AS adj_mean_daily,
    pw.sigma_dL                                       AS sigma_demand_lt,

    -- Safety stock
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0 OR pw.lt_days IS NULL THEN 0.0
      ELSE v_z * pw.sigma_dL
    END                                               AS safety_stock,

    -- Recommended PAR
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0 OR pw.lt_days IS NULL
        THEN pw.current_par
      ELSE GREATEST(0, CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL))
    END::int                                          AS recommended_par,

    -- Delta
    (
      CASE
        WHEN pw.data_days < 3 OR pw.adj_mean <= 0 OR pw.lt_days IS NULL
          THEN pw.current_par
        ELSE GREATEST(0, CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL))
      END - pw.current_par
    )::int                                            AS par_delta,

    -- Change type
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0     THEN 'no_data'
      WHEN pw.lt_days IS NULL                        THEN 'no_lead_time'
      WHEN CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL) > pw.current_par + 2
                                                     THEN 'increase'
      WHEN CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL) < pw.current_par - 2
                                                     THEN 'decrease'
      ELSE                                                'calibrated'
    END                                               AS change_type,

    -- Service level at current PAR: Φ((current_par − adj_μ×L) / σ_dL)
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0
        OR pw.lt_days IS NULL OR pw.sigma_dL <= 0   THEN NULL::float8
      ELSE _normal_cdf(
        (pw.current_par::float8 - pw.adj_mean * pw.lt_days)
        / pw.sigma_dL
      )
    END                                               AS service_level_at_current_par,

    -- Expected stockouts per year at current PAR = (1 − SL) × (365 / L)
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0
        OR pw.lt_days IS NULL OR pw.sigma_dL <= 0   THEN NULL::float8
      ELSE GREATEST(0.0,
        (1.0 - _normal_cdf(
          (pw.current_par::float8 - pw.adj_mean * pw.lt_days) / pw.sigma_dL
        )) * (365.0 / pw.lt_days)
      )
    END                                               AS expected_stockouts_per_year,

    -- Confidence: base × lead-time-source penalty × occupancy bonus
    ROUND((
      pw.base_confidence
      * CASE pw.lt_source
          WHEN 'po_history'       THEN 1.00
          WHEN 'supplier_stated'  THEN 0.85
          WHEN 'hotel_median'     THEN 0.70
          ELSE                         0.40  -- unknown
        END
      -- Small bonus when occupancy correlation is strong + data applied
      * CASE WHEN pw.occ_adj <> 1.0 THEN 1.05 ELSE 1.0 END
    )::numeric, 3)::float8                            AS confidence_score,

    -- Human-readable rationale (every parameter is named + sourced)
    CONCAT_WS(' · ',
      'μ=' || ROUND(pw.adj_mean::numeric, 2)   || '/day'
        || CASE WHEN pw.occ_adj <> 1.0
             THEN ' (occ adj ×' || ROUND(pw.occ_adj::numeric, 2)
               || ', r=' || ROUND(pw.occ_corr::numeric, 2) || ')'
             ELSE ''
           END,
      'σ=' || ROUND(pw.stddev_daily::numeric, 2),
      CASE WHEN pw.lt_days IS NOT NULL
        THEN 'LT=' || ROUND(pw.lt_days::numeric, 1) || 'd [' || pw.lt_source || ']'
           || CASE WHEN pw.lt_stddev > 0
                THEN ' σ_L=' || ROUND(pw.lt_stddev::numeric, 1) || 'd' ELSE '' END
      END,
      'z=' || ROUND(v_z::numeric, 3) || ' (' || ROUND((p_service_level * 100)::numeric, 1) || '% SL)',
      CASE WHEN pw.lt_days IS NOT NULL
        THEN 'safety=' || ROUND((v_z * pw.sigma_dL)::numeric, 1)
      END,
      CASE WHEN pw.data_days < 3 THEN 'LOW CONFIDENCE: only ' || pw.data_days || ' data days' END
    )                                                  AS rationale

  FROM par_with_sigma pw

  ORDER BY
    -- Largest under-PAR first (most urgent increases), then over-PAR, then calibrated
    CASE
      WHEN pw.data_days < 3 OR pw.adj_mean <= 0 OR pw.lt_days IS NULL THEN 3
      WHEN CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL) > pw.current_par + 2 THEN 0
      WHEN CEIL(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL) < pw.current_par - 2 THEN 1
      ELSE 2
    END,
    ABS(CEIL(
      COALESCE(pw.adj_mean * pw.lt_days + v_z * pw.sigma_dL, pw.current_par::float8)
    ) - pw.current_par) DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION _normal_quantile(float8)            TO authenticated;
GRANT EXECUTE ON FUNCTION compute_optimal_par(float8)         TO authenticated;
