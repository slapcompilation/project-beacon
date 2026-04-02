-- Layer: Eye — Active Intelligence Layer (complete signal suite)
-- Adds dead_stock and cost_at_risk signal types that were documented in 042
-- but never implemented. Now all four operator signals are live.
--
-- signal_type:
--   'depletion_risk'  — variant running low; days_until_zero from avg consumption
--   'waste_spike'     — recent removal rate > 2× 30-day baseline
--   'dead_stock'      — capital locked in stock with no movement in 30+ days
--   'cost_at_risk'    — expiry within 30d with meaningful cost exposure

SET search_path = public;

CREATE OR REPLACE FUNCTION get_shift_intelligence(p_window_days int DEFAULT 30)
RETURNS TABLE (
  signal_type       text,
  variant_id        uuid,
  product_name      text,
  variant_name      text,
  sku               text,
  current_stock     int,
  urgency_score     numeric,   -- 0.0–1.0, higher = act sooner
  confidence        numeric,   -- 0.0–1.0, higher = more reliable signal
  days_until_zero   numeric,   -- null for non-depletion signals
  days_band         numeric,   -- ±uncertainty in days (based on daily stddev)
  cost_at_risk      numeric,   -- monetary exposure (cost × units at risk)
  avg_daily         numeric,   -- mean daily consumption in window
  signal_note       text,      -- human-readable supporting detail
  basis             text       -- data provenance ("based on N days of data")
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- ── 1. Depletion risk ─────────────────────────────────────────────────────────
  WITH daily_consumption AS (
    SELECT
      sl.variant_id,
      DATE_TRUNC('day', sl.timestamp)   AS day,
      ABS(SUM(sl.quantity_change))      AS daily_qty
    FROM stock_logs sl
    WHERE sl.hotel_id        = auth_hotel_id()
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - (p_window_days || ' days')::interval
    GROUP BY sl.variant_id, DATE_TRUNC('day', sl.timestamp)
  ),
  consumption_stats AS (
    SELECT
      variant_id,
      COUNT(*)::int                                AS data_points,
      ROUND(AVG(daily_qty)::numeric, 4)            AS avg_daily,
      ROUND(STDDEV(daily_qty)::numeric, 4)         AS stddev_daily,
      SUM(daily_qty)                               AS total_consumed
    FROM daily_consumption
    GROUP BY variant_id
    HAVING COUNT(*) >= 3
  ),
  depletion_signals AS (
    SELECT
      'depletion_risk'::text                       AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
      ROUND(GREATEST(0, LEAST(1,
        1 - (pv.current_stock / NULLIF(cs.avg_daily, 0) / 30.0)
      ))::numeric, 3)                              AS urgency_score,
      ROUND(GREATEST(0.1, LEAST(1.0,
        1 - (COALESCE(cs.stddev_daily, 0) / NULLIF(cs.avg_daily, 0))
      ))::numeric, 3)                              AS confidence,
      ROUND(pv.current_stock / NULLIF(cs.avg_daily, 0), 1)
                                                   AS days_until_zero,
      ROUND(
        COALESCE(cs.stddev_daily, 0) / NULLIF(cs.avg_daily, 0)
        * NULLIF(pv.current_stock / NULLIF(cs.avg_daily, 0), 0)
      , 1)                                         AS days_band,
      ROUND((pv.current_stock * pv.cost)::numeric, 2)
                                                   AS cost_at_risk,
      ROUND(cs.avg_daily, 2)                       AS avg_daily,
      (
        ROUND(cs.avg_daily, 1)::text || '/day avg · '
        || cs.total_consumed::text || ' consumed in '
        || p_window_days::text || 'd'
      )                                            AS signal_note,
      ('based on ' || cs.data_points::text || ' active days of data')
                                                   AS basis
    FROM consumption_stats cs
    JOIN product_variants pv ON pv.id = cs.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE pv.enabled = true
      AND pv.current_stock > 0
      AND cs.avg_daily > 0
      AND (pv.current_stock / NULLIF(cs.avg_daily, 0)) <= 21
  ),

  -- ── 2. Waste spikes ───────────────────────────────────────────────────────────
  waste_window AS (
    SELECT
      sl.variant_id,
      ABS(SUM(sl.quantity_change))::numeric        AS recent_consumed,
      COUNT(DISTINCT DATE_TRUNC('day', sl.timestamp))::int AS active_days
    FROM stock_logs sl
    WHERE sl.hotel_id        = auth_hotel_id()
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - '7 days'::interval
    GROUP BY sl.variant_id
  ),
  waste_baseline AS (
    SELECT
      sl.variant_id,
      ROUND(ABS(SUM(sl.quantity_change)) / 30.0, 4) AS avg_daily_30
    FROM stock_logs sl
    WHERE sl.hotel_id        = auth_hotel_id()
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - '30 days'::interval
    GROUP BY sl.variant_id
  ),
  waste_signals AS (
    SELECT
      'waste_spike'::text                          AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
      ROUND(LEAST(1.0,
        (ww.recent_consumed / NULLIF(ww.active_days, 0))
        / NULLIF(wb.avg_daily_30, 0) / 5.0
      )::numeric, 3)                               AS urgency_score,
      0.8::numeric                                 AS confidence,
      NULL::numeric                                AS days_until_zero,
      NULL::numeric                                AS days_band,
      ROUND((ww.recent_consumed * pv.cost)::numeric, 2)
                                                   AS cost_at_risk,
      ROUND(wb.avg_daily_30, 2)                    AS avg_daily,
      (
        ww.recent_consumed::text || ' removed in 7d · '
        || ROUND((ww.recent_consumed / NULLIF(ww.active_days, 0) / NULLIF(wb.avg_daily_30, 0))::numeric, 1)::text
        || '× 30-day avg rate'
      )                                            AS signal_note,
      'observed last 7 days vs 30-day baseline'    AS basis
    FROM waste_window ww
    JOIN waste_baseline wb ON wb.variant_id = ww.variant_id
    JOIN product_variants pv ON pv.id = ww.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE pv.enabled = true
      AND wb.avg_daily_30 > 0
      AND (ww.recent_consumed / NULLIF(ww.active_days, 0)) > (wb.avg_daily_30 * 2)
  ),

  -- ── 3. Dead stock — capital locked with no movement ───────────────────────────
  -- Variants with stock on hand but zero activity in the last 30 days.
  -- Urgency scales with idle duration (capped at 1.0 at 90 days idle).
  last_movement AS (
    SELECT
      sl.variant_id,
      MAX(sl.timestamp) AS last_moved_at
    FROM stock_logs sl
    WHERE sl.hotel_id   = auth_hotel_id()
      AND sl.is_revert  = false
    GROUP BY sl.variant_id
  ),
  dead_stock_signals AS (
    SELECT
      'dead_stock'::text                           AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
      -- urgency: 0 at 30 idle days, 1.0 at 90+ idle days
      ROUND(LEAST(1.0,
        GREATEST(0,
          (EXTRACT(EPOCH FROM (NOW() - lm.last_moved_at)) / 86400.0 - 30.0) / 60.0
        )
      )::numeric, 3)                               AS urgency_score,
      0.9::numeric                                 AS confidence,  -- observed fact
      NULL::numeric                                AS days_until_zero,
      NULL::numeric                                AS days_band,
      ROUND((pv.current_stock * pv.cost)::numeric, 2)
                                                   AS cost_at_risk,
      0::numeric                                   AS avg_daily,
      (
        pv.current_stock::text || ' units · '
        || ROUND(EXTRACT(EPOCH FROM (NOW() - lm.last_moved_at)) / 86400.0)::int::text
        || ' days since last movement'
      )                                            AS signal_note,
      'no stock movement recorded in 30+ days'     AS basis
    FROM last_movement lm
    JOIN product_variants pv ON pv.id = lm.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE pv.enabled       = true
      AND pv.current_stock > 0
      -- idle for more than 30 days
      AND lm.last_moved_at < NOW() - '30 days'::interval
      -- exclude variants with meaningful daily consumption (already caught by depletion_risk)
      AND pv.id NOT IN (SELECT variant_id FROM consumption_stats)
  ),

  -- ── 4. Cost-at-risk — expiry within 30 days ───────────────────────────────────
  -- Variants with an expiry date in the near future and non-zero stock value.
  -- Urgency is 1.0 on expiry day, 0.0 at 30 days out.
  -- Confidence is 1.0 — expiry dates are hard facts.
  expiry_signals AS (
    SELECT
      'cost_at_risk'::text                         AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
      -- urgency: 1.0 if expired/today, scales to 0 at 30 days out
      ROUND(GREATEST(0, LEAST(1.0,
        1.0 - (EXTRACT(EPOCH FROM (pv.expiry_date::timestamptz - NOW())) / 86400.0 / 30.0)
      ))::numeric, 3)                              AS urgency_score,
      1.0::numeric                                 AS confidence,
      NULL::numeric                                AS days_until_zero,
      NULL::numeric                                AS days_band,
      ROUND((pv.current_stock * pv.cost)::numeric, 2)
                                                   AS cost_at_risk,
      NULL::numeric                                AS avg_daily,
      (
        pv.current_stock::text || ' units expire '
        || CASE
             WHEN pv.expiry_date <= CURRENT_DATE THEN 'today or past due'
             ELSE 'in ' || (pv.expiry_date - CURRENT_DATE)::text || ' days'
           END
        || ' · ' || ROUND((pv.current_stock * pv.cost)::numeric, 2)::text || ' at risk'
      )                                            AS signal_note,
      'expiry date on record'                      AS basis
    FROM product_variants pv
    JOIN products pr ON pr.id = pv.product_id
    WHERE pr.hotel_id     = auth_hotel_id()
      AND pv.enabled      = true
      AND pv.current_stock > 0
      AND pv.expiry_date  IS NOT NULL
      AND pv.expiry_date  <= CURRENT_DATE + 30
      -- only surface if cost exposure is meaningful (> 0)
      AND (pv.current_stock * pv.cost) > 0
  )

  -- ── Union + rank ──────────────────────────────────────────────────────────────
  SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
         urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
         avg_daily, signal_note, basis
  FROM (
    SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
           urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
           avg_daily, signal_note, basis
    FROM depletion_signals
    UNION ALL
    SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
           urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
           avg_daily, signal_note, basis
    FROM waste_signals
    UNION ALL
    SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
           urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
           avg_daily, signal_note, basis
    FROM dead_stock_signals
    UNION ALL
    SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
           urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
           avg_daily, signal_note, basis
    FROM expiry_signals
  ) combined
  -- Rank: urgency × confidence × log(cost+1) — most actionable first
  ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION get_shift_intelligence(int) TO authenticated;
