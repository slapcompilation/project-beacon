-- Layer: Eye — Shift Intelligence query optimizations
-- Fixes three issues from 045:
--
--   1. NOT IN → NOT EXISTS in dead_stock filter (correctness: NOT IN silently
--      returns zero rows if subquery produces any NULL)
--
--   2. Merge waste_window + waste_baseline into one stock_logs scan using
--      FILTER clauses — halves I/O for the waste spike signal
--
--   3. Per-signal cap (10 per type) before the global LIMIT 25 — prevents
--      one signal type from monopolising the panel when urgency scores are skewed

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

  -- ── 2. Waste spikes — single scan with FILTER (fix: was two separate scans) ───
  waste_data AS (
    SELECT
      sl.variant_id,
      -- 30-day baseline rate
      ROUND(ABS(SUM(sl.quantity_change)) / 30.0, 4)                                    AS avg_daily_30,
      -- 7-day recent window
      ABS(SUM(sl.quantity_change) FILTER (WHERE sl.timestamp >= NOW() - '7 days'::interval))::numeric
                                                                                        AS recent_consumed,
      COUNT(DISTINCT CASE WHEN sl.timestamp >= NOW() - '7 days'::interval
            THEN DATE_TRUNC('day', sl.timestamp) END)::int                             AS active_days
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
        (wd.recent_consumed / NULLIF(wd.active_days, 0))
        / NULLIF(wd.avg_daily_30, 0) / 5.0
      )::numeric, 3)                               AS urgency_score,
      0.8::numeric                                 AS confidence,
      NULL::numeric                                AS days_until_zero,
      NULL::numeric                                AS days_band,
      ROUND((wd.recent_consumed * pv.cost)::numeric, 2)
                                                   AS cost_at_risk,
      ROUND(wd.avg_daily_30, 2)                    AS avg_daily,
      (
        wd.recent_consumed::text || ' removed in 7d · '
        || ROUND((wd.recent_consumed / NULLIF(wd.active_days, 0) / NULLIF(wd.avg_daily_30, 0))::numeric, 1)::text
        || '× 30-day avg rate'
      )                                            AS signal_note,
      'observed last 7 days vs 30-day baseline'    AS basis
    FROM waste_data wd
    JOIN product_variants pv ON pv.id = wd.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE pv.enabled = true
      AND wd.avg_daily_30 > 0
      AND (wd.recent_consumed / NULLIF(wd.active_days, 0)) > (wd.avg_daily_30 * 2)
  ),

  -- ── 3. Dead stock — capital locked with no movement ───────────────────────────
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
      0.9::numeric                                 AS confidence,
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
      AND lm.last_moved_at < NOW() - '30 days'::interval
      -- fix: NOT EXISTS instead of NOT IN — NOT IN silently returns zero rows
      -- if the subquery produces any NULL variant_id
      AND NOT EXISTS (
        SELECT 1 FROM consumption_stats cs WHERE cs.variant_id = pv.id
      )
  ),

  -- ── 4. Cost-at-risk — expiry within 30 days ───────────────────────────────────
  expiry_signals AS (
    SELECT
      'cost_at_risk'::text                         AS signal_type,
      pv.id                                        AS variant_id,
      pr.name                                      AS product_name,
      pv.name                                      AS variant_name,
      pv.sku,
      pv.current_stock,
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
    WHERE pr.hotel_id      = auth_hotel_id()
      AND pv.enabled       = true
      AND pv.current_stock > 0
      AND pv.expiry_date   IS NOT NULL
      AND pv.expiry_date   <= CURRENT_DATE + 30
      AND (pv.current_stock * pv.cost) > 0
  ),

  -- ── Per-signal cap + union ─────────────────────────────────────────────────────
  -- fix: cap each signal type at 10 before the global LIMIT so one type
  -- cannot crowd out the others when urgency scores are skewed
  capped AS (
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC) AS rn
      FROM depletion_signals
    ) d WHERE rn <= 10
    UNION ALL
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC) AS rn
      FROM waste_signals
    ) w WHERE rn <= 10
    UNION ALL
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC) AS rn
      FROM dead_stock_signals
    ) ds WHERE rn <= 10
    UNION ALL
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC) AS rn
      FROM expiry_signals
    ) e WHERE rn <= 10
  )

  SELECT signal_type, variant_id, product_name, variant_name, sku, current_stock,
         urgency_score, confidence, days_until_zero, days_band, cost_at_risk,
         avg_daily, signal_note, basis
  FROM capped
  ORDER BY (urgency_score * confidence * LN(cost_at_risk + 1)) DESC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION get_shift_intelligence(int) TO authenticated;
