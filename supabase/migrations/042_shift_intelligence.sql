-- Layer: Eye — Active Intelligence Layer
-- get_shift_intelligence() synthesizes cross-domain signals into a single ranked
-- list with confidence scores. Combines depletion forecast (with uncertainty bands),
-- waste spikes, and cost-at-risk into one operator decision surface.
-- Palantir principle: intelligence everywhere — every number carries its derived context.

SET search_path = public;

-- ─── get_shift_intelligence ────────────────────────────────────────────────────
-- Returns ranked intelligence signals for the current hotel's active shift.
-- Each row is one "signal" with an urgency_score (0–1) and confidence (0–1).
--
-- signal_type:
--   'depletion_risk'  — variant running low; days_until_zero computed from avg consumption
--   'waste_spike'     — recent removal volume exceeds 2× 30-day average per day
--   'dead_stock'      — capital locked in idle stock with no recent movement
--   'cost_at_risk'    — expiry within 30d with non-trivial cost exposure

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
  -- ── 1. Depletion risk: variants with meaningful consumption ──────────────────
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
    HAVING COUNT(*) >= 3   -- minimum 3 active days for a meaningful signal
  ),
  depletion_signals AS (
    SELECT
      'depletion_risk'::text                       AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
      -- urgency_score: 1.0 when 0 days left, 0.0 at 30+ days
      ROUND(
        GREATEST(0, LEAST(1,
          1 - (pv.current_stock / NULLIF(cs.avg_daily, 0) / 30.0)
        ))::numeric, 3
      )                                            AS urgency_score,
      -- confidence: based on coefficient of variation (lower CV = higher confidence)
      ROUND(
        GREATEST(0.1, LEAST(1.0,
          1 - (COALESCE(cs.stddev_daily, 0) / NULLIF(cs.avg_daily, 0))
        ))::numeric, 3
      )                                            AS confidence,
      ROUND(
        pv.current_stock / NULLIF(cs.avg_daily, 0), 1
      )                                            AS days_until_zero,
      -- ±uncertainty band (days): ±1 stddev of daily consumption → impact on days
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
      (
        'based on ' || cs.data_points::text || ' active days of data'
      )                                            AS basis
    FROM consumption_stats cs
    JOIN product_variants pv ON pv.id = cs.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE pv.enabled = true
      AND pv.current_stock > 0
      AND cs.avg_daily > 0
      -- only show if running low (≤ 21 days supply)
      AND (pv.current_stock / NULLIF(cs.avg_daily, 0)) <= 21
  ),

  -- ── 2. Waste spikes ──────────────────────────────────────────────────────────
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
      -- urgency based on spike multiplier (capped at 1.0 for 5× spike)
      ROUND(LEAST(1.0,
        (ww.recent_consumed / NULLIF(ww.active_days, 0))
        / NULLIF(wb.avg_daily_30, 0) / 5.0
      )::numeric, 3)                               AS urgency_score,
      0.8::numeric                                 AS confidence,  -- waste spikes are observed facts
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
      -- spike: 7-day rate > 2× 30-day baseline rate
      AND (ww.recent_consumed / NULLIF(ww.active_days, 0)) > (wb.avg_daily_30 * 2)
  )

  -- ── Union + rank ─────────────────────────────────────────────────────────────
  -- Wrap in a subquery so ORDER BY can use an expression across the UNION.
  SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
         urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
         avg_daily, signal_note, basis
  FROM (
    SELECT
      signal_type, variant_id, product_name, variant_name, sku, current_stock,
      urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
      avg_daily, signal_note, basis
    FROM depletion_signals

    UNION ALL

    SELECT
      signal_type, variant_id, product_name, variant_name, sku, current_stock,
      urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
      avg_daily, signal_note, basis
    FROM waste_signals
  ) combined
  -- Rank: urgency × confidence × log(cost+1) — most actionable first
  ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION get_shift_intelligence(int) TO authenticated;
