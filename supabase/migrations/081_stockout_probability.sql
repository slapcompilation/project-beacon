-- Migration 081: Probabilistic Intelligence Layer
-- Layer: Eye — stockout probability with confidence intervals
-- Palantir principle: never show a number without its uncertainty.
--
-- Adds:
--   _normal_cdf(x)                 — normal CDF helper via erf()
--   compute_stockout_probability() — per-variant probability of stockout
--                                    within 7 / 14 / 30 days, with confidence
--                                    score and demand pattern classification.
--
-- Math: daily consumption ~ N(μ, σ²) per variant (CLT).
--   P(stockout in T days) = P(ΣT > current_stock)
--                         = 1 − Φ((current_stock − μT) / (σ√T))

-- ─── Normal CDF via error function ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION _normal_cdf(x float8)
RETURNS float8
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN x < -8.0 THEN 0.0
    WHEN x >  8.0 THEN 1.0
    ELSE (1.0 + erf(x / sqrt(2.0))) / 2.0
  END
$$;

-- ─── Stockout probability ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_stockout_probability()
RETURNS TABLE (
  variant_id        uuid,
  product_name      text,
  sku               text,
  current_stock     int,
  mean_daily_30d    float8,
  mean_daily_7d     float8,
  stddev_daily      float8,
  days_until_zero   float8,
  stockout_prob_7d  float8,    -- 0–100; NULL when < 3 active data days
  stockout_prob_14d float8,
  stockout_prob_30d float8,
  confidence_score  float8,    -- 0–1  (full confidence at ≥ 14 active days)
  demand_pattern    text,      -- 'steady' | 'variable' | 'event_driven' | 'sparse'
  data_days         int        -- count of days with at least one removal
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id
  FROM hotel_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_hotel_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH

  -- Active variants for this hotel
  vars AS (
    SELECT
      pv.id            AS variant_id,
      p.name           AS product_name,
      p.sku,
      pv.current_stock
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.hotel_id = v_hotel_id
      AND pv.active   = true
      AND pv.enabled  = true
      AND p.enabled   = true
  ),

  -- Raw daily consumption over last 30 days (removals only, no reverts)
  raw_daily AS (
    SELECT
      sl.variant_id,
      DATE(sl.timestamp AT TIME ZONE 'UTC')       AS day,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.quantity_change < 0)     AS consumed
    FROM stock_logs sl
    WHERE sl.variant_id IN (SELECT variant_id FROM vars)
      AND sl.timestamp  >= NOW() - INTERVAL '30 days'
      AND sl.is_revert   = false
    GROUP BY sl.variant_id, DATE(sl.timestamp AT TIME ZONE 'UTC')
  ),

  -- Full 30-day date spine — pad missing days with 0 so stddev uses full window
  all_days AS (
    SELECT gs::date AS day
    FROM generate_series(
      (NOW() - INTERVAL '30 days')::date,
      NOW()::date,
      '1 day'::interval
    ) gs
  ),

  padded AS (
    SELECT
      v.variant_id,
      d.day,
      COALESCE(rd.consumed, 0) AS consumed
    FROM vars v
    CROSS JOIN all_days d
    LEFT JOIN raw_daily rd
           ON rd.variant_id = v.variant_id
          AND rd.day         = d.day
  ),

  -- Per-variant rolling statistics
  stats AS (
    SELECT
      variant_id,
      COUNT(*) FILTER (WHERE consumed > 0)                              AS data_days,
      ROUND(AVG(consumed)::numeric, 4)::float8                          AS mean_30d,
      ROUND(COALESCE(STDDEV_POP(consumed), 0)::numeric, 4)::float8      AS stddev_30d,
      ROUND(
        AVG(consumed) FILTER (WHERE day >= (NOW() - INTERVAL '7 days')::date)
        ::numeric, 4
      )::float8                                                          AS mean_7d
    FROM padded
    GROUP BY variant_id
  ),

  -- Derived values (computed once, reused for all horizons)
  derived AS (
    SELECT
      v.variant_id,
      v.product_name,
      v.sku,
      v.current_stock,
      COALESCE(s.mean_30d,  0) AS mean_30d,
      COALESCE(s.mean_7d,   0) AS mean_7d,
      COALESCE(s.stddev_30d,0) AS stddev_30d,
      COALESCE(s.data_days, 0) AS data_days,

      CASE
        WHEN COALESCE(s.mean_30d, 0) > 0
          THEN LEAST(999.0, v.current_stock::float8 / s.mean_30d)
        ELSE 999.0
      END AS days_until_zero,

      -- Confidence: 1.0 at 14+ active data days
      LEAST(1.0, COALESCE(s.data_days, 0)::float8 / 14.0) AS confidence_score,

      -- Demand pattern via coefficient of variation
      CASE
        WHEN COALESCE(s.data_days, 0) < 7                                THEN 'sparse'
        WHEN COALESCE(s.mean_30d, 0) <= 0                                THEN 'sparse'
        WHEN s.stddev_30d / NULLIF(s.mean_30d, 0) > 1.5                  THEN 'event_driven'
        WHEN s.stddev_30d / NULLIF(s.mean_30d, 0) < 0.3                  THEN 'steady'
        ELSE 'variable'
      END AS demand_pattern

    FROM vars v
    LEFT JOIN stats s ON s.variant_id = v.variant_id
  ),

  -- Stockout probability for each horizon using Normal CDF
  probs AS (
    SELECT
      d.*,

      -- P(stockout in 7d)
      CASE
        WHEN d.data_days < 3       THEN NULL
        WHEN d.mean_30d  <= 0      THEN 0.0
        WHEN d.stddev_30d = 0      THEN
          CASE WHEN d.current_stock < d.mean_30d * 7  THEN 100.0 ELSE 0.0 END
        ELSE ROUND((
          (1.0 - _normal_cdf(
            (d.current_stock::float8 - d.mean_30d * 7.0)
            / (d.stddev_30d * sqrt(7.0))
          )) * 100.0
        )::numeric, 1)::float8
      END AS p7d,

      -- P(stockout in 14d)
      CASE
        WHEN d.data_days < 3       THEN NULL
        WHEN d.mean_30d  <= 0      THEN 0.0
        WHEN d.stddev_30d = 0      THEN
          CASE WHEN d.current_stock < d.mean_30d * 14 THEN 100.0 ELSE 0.0 END
        ELSE ROUND((
          (1.0 - _normal_cdf(
            (d.current_stock::float8 - d.mean_30d * 14.0)
            / (d.stddev_30d * sqrt(14.0))
          )) * 100.0
        )::numeric, 1)::float8
      END AS p14d,

      -- P(stockout in 30d)
      CASE
        WHEN d.data_days < 3       THEN NULL
        WHEN d.mean_30d  <= 0      THEN 0.0
        WHEN d.stddev_30d = 0      THEN
          CASE WHEN d.current_stock < d.mean_30d * 30 THEN 100.0 ELSE 0.0 END
        ELSE ROUND((
          (1.0 - _normal_cdf(
            (d.current_stock::float8 - d.mean_30d * 30.0)
            / (d.stddev_30d * sqrt(30.0))
          )) * 100.0
        )::numeric, 1)::float8
      END AS p30d

    FROM derived d
  )

  SELECT
    p.variant_id,
    p.product_name,
    p.sku,
    p.current_stock,
    p.mean_30d    AS mean_daily_30d,
    p.mean_7d     AS mean_daily_7d,
    p.stddev_30d  AS stddev_daily,
    p.days_until_zero,
    p.p7d         AS stockout_prob_7d,
    p.p14d        AS stockout_prob_14d,
    p.p30d        AS stockout_prob_30d,
    p.confidence_score,
    p.demand_pattern,
    p.data_days
  FROM probs p
  ORDER BY
    -- Insufficient data last
    CASE WHEN p.data_days < 3 THEN 1 ELSE 0 END,
    -- Then by 7d probability descending (highest risk first)
    COALESCE(p.p7d, 0) DESC,
    -- Then by days_until_zero ascending
    p.days_until_zero ASC;

END;
$$;

GRANT EXECUTE ON FUNCTION _normal_cdf(float8)              TO authenticated;
GRANT EXECUTE ON FUNCTION compute_stockout_probability()   TO authenticated;
