-- Layer: Mind — Predictive Procurement Engine
-- Surfaces variants that need reordering, ranked by urgency score.
-- Signals: below_par (stock < low_stock_threshold), depletion_risk (days_until_zero ≤ 21),
-- or both. Preferred supplier and lead days are joined from delivery history.

SET search_path = public;

CREATE OR REPLACE FUNCTION get_procurement_proposals()
RETURNS TABLE (
  signal_type              text,
  variant_id               uuid,
  product_name             text,
  variant_name             text,
  sku                      text,
  current_stock            int,
  par_level                int,
  suggested_qty            int,
  urgency_score            numeric,
  days_until_zero          numeric,
  avg_daily                numeric,
  preferred_supplier_id    uuid,
  preferred_supplier_name  text,
  avg_lead_days            numeric,
  has_open_request         bool,
  unit_cost                numeric,
  reasoning                text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH daily_consumption AS (
    SELECT
      sl.variant_id,
      DATE_TRUNC('day', sl.timestamp)  AS day,
      ABS(SUM(sl.quantity_change))     AS daily_qty
    FROM stock_logs sl
    WHERE sl.hotel_id        = auth_hotel_id()
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '30 days'
    GROUP BY sl.variant_id, DATE_TRUNC('day', sl.timestamp)
  ),
  consumption_stats AS (
    SELECT
      variant_id,
      COUNT(*)::int                             AS data_points,
      ROUND(AVG(daily_qty)::numeric, 4)         AS avg_daily,
      ROUND(STDDEV(daily_qty)::numeric, 4)      AS stddev_daily
    FROM daily_consumption
    GROUP BY variant_id
    HAVING COUNT(*) >= 3
  ),
  supplier_history AS (
    SELECT DISTINCT ON (rr.variant_id)
      rr.variant_id,
      de.supplier_id,
      s.name AS supplier_name
    FROM delivery_events de
    JOIN restock_requests rr ON rr.id = de.restock_request_id
    JOIN suppliers s ON s.id = de.supplier_id
    WHERE de.hotel_id = auth_hotel_id()
    ORDER BY rr.variant_id, de.created_at DESC
  ),
  supplier_lead_times AS (
    SELECT
      de.supplier_id,
      ROUND(AVG((de.actual_date - de.created_at::date))::numeric, 1) AS avg_lead_days
    FROM delivery_events de
    WHERE de.actual_date IS NOT NULL
      AND de.hotel_id = auth_hotel_id()
    GROUP BY de.supplier_id
  ),
  open_requests AS (
    SELECT DISTINCT variant_id
    FROM restock_requests
    WHERE hotel_id = auth_hotel_id()
      AND status IN ('pending', 'approved')
  )
  SELECT
    -- signal_type
    CASE
      WHEN pv.current_stock < pv.low_stock_threshold
        AND cs.avg_daily > 0
        AND ROUND(pv.current_stock / NULLIF(cs.avg_daily, 0), 1) <= 21
      THEN 'both'
      WHEN pv.current_stock < pv.low_stock_threshold
      THEN 'below_par'
      ELSE 'depletion_risk'
    END::text                                                             AS signal_type,

    pv.id                                                                 AS variant_id,
    pr.name                                                               AS product_name,
    pv.name                                                               AS variant_name,
    pv.sku,
    pv.current_stock::int                                                 AS current_stock,
    pv.low_stock_threshold::int                                           AS par_level,

    -- suggested_qty: cover lead time + 14-day buffer, then top up to par
    GREATEST(
      0,
      CEIL(
        COALESCE(cs.avg_daily, 0)
        * (COALESCE(slt.avg_lead_days, 3.0) + 14.0)
        + pv.low_stock_threshold
        - pv.current_stock
      )
    )::int                                                                AS suggested_qty,

    -- urgency_score: 0.0–1.0
    CASE
      WHEN cs.avg_daily > 0 THEN
        ROUND(GREATEST(0, LEAST(1,
          1 - (pv.current_stock::numeric / NULLIF(cs.avg_daily, 0) / 21.0)
        ))::numeric, 3)
      WHEN pv.current_stock = 0 THEN 1.0::numeric
      WHEN pv.current_stock < pv.low_stock_threshold THEN 0.5::numeric
      ELSE 0.1::numeric
    END                                                                   AS urgency_score,

    -- days_until_zero
    ROUND(pv.current_stock::numeric / NULLIF(cs.avg_daily, 0), 1)        AS days_until_zero,

    cs.avg_daily,

    sh.supplier_id                                                        AS preferred_supplier_id,
    sh.supplier_name                                                      AS preferred_supplier_name,
    COALESCE(slt.avg_lead_days, 3.0)                                      AS avg_lead_days,

    (oreq.variant_id IS NOT NULL)                                         AS has_open_request,

    pv.cost                                                               AS unit_cost,

    -- reasoning: human-readable explanation for the proposal
    CONCAT_WS(' · ',
      CASE
        WHEN cs.avg_daily > 0
        THEN ROUND(pv.current_stock::numeric / NULLIF(cs.avg_daily, 0), 1)::text || 'd until zero (based on 30-day avg)'
        ELSE NULL
      END,
      'Par level: ' || pv.low_stock_threshold::text,
      CASE
        WHEN sh.supplier_name IS NOT NULL
        THEN sh.supplier_name || ' · ' || COALESCE(slt.avg_lead_days, 3.0)::text || 'd avg lead'
        ELSE NULL
      END
    )::text                                                               AS reasoning

  FROM product_variants pv
  JOIN products pr ON pr.id = pv.product_id
  LEFT JOIN consumption_stats cs ON cs.variant_id = pv.id
  LEFT JOIN supplier_history sh ON sh.variant_id = pv.id
  LEFT JOIN supplier_lead_times slt ON slt.supplier_id = sh.supplier_id
  LEFT JOIN open_requests oreq ON oreq.variant_id = pv.id

  WHERE pr.hotel_id = auth_hotel_id()
    AND pv.enabled = true
    AND pv.current_stock >= 0
    AND (
      pv.current_stock < pv.low_stock_threshold
      OR (
        cs.avg_daily > 0
        AND pv.current_stock::numeric / NULLIF(cs.avg_daily, 0) <= 21
      )
    )

  ORDER BY urgency_score DESC, days_until_zero ASC NULLS LAST
  LIMIT 50
$$;

GRANT EXECUTE ON FUNCTION get_procurement_proposals() TO authenticated;
