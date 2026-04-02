-- Layer: Mind — Procurement Leverage Engine
-- get_supplier_leverage(): composite reliability + leverage scores per supplier,
--   filtered by a rolling date window on delivery_events.
-- get_supplier_price_history(): per-delivery price drift for one supplier.
-- Both functions are SECURITY DEFINER so they can call auth_hotel_id().

SET search_path = public;

-- ─── 1. Supplier leverage summary ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_supplier_leverage(p_days int DEFAULT 90)
RETURNS TABLE (
  supplier_id           uuid,
  supplier_name         text,
  total_deliveries      bigint,
  completed_deliveries  bigint,
  on_time_rate          numeric,   -- 0–100
  avg_fill_rate         numeric,   -- 0–100
  avg_price_drift_pct   numeric,   -- positive = being overcharged
  avg_days_late         numeric,   -- negative = early
  total_spend           numeric,
  pending_deliveries    bigint,
  reliability_score     numeric,   -- 0–100
  leverage_score        numeric,   -- 0–100; higher = richer negotiating opportunity
  recommended_action    text       -- 'Find Alternative' | 'Renegotiate' | 'Monitor' | 'Preferred Supplier'
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      de.supplier_id,
      s.name                                                               AS supplier_name,

      COUNT(*)                                                             AS total_deliveries,
      COUNT(*)  FILTER (WHERE de.actual_date IS NOT NULL)                  AS completed_deliveries,

      ROUND(
        COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL
                           AND de.actual_date <= de.expected_date)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL), 0) * 100
      , 1)                                                                 AS on_time_rate,

      ROUND(
        AVG(de.received_qty / NULLIF(de.ordered_qty, 0)) * 100
      , 1)                                                                 AS avg_fill_rate,

      ROUND(
        AVG(
          CASE
            WHEN de.unit_cost_expected > 0 AND de.unit_cost_actual IS NOT NULL
            THEN (de.unit_cost_actual - de.unit_cost_expected)
                 / de.unit_cost_expected * 100
            ELSE NULL
          END
        )
      , 2)                                                                 AS avg_price_drift_pct,

      ROUND(
        AVG(
          CASE WHEN de.actual_date IS NOT NULL
            THEN (de.actual_date - de.expected_date)::numeric
            ELSE NULL
          END
        )
      , 1)                                                                 AS avg_days_late,

      SUM(de.received_qty
          * COALESCE(de.unit_cost_actual, de.unit_cost_expected, 0))       AS total_spend,

      COUNT(*) FILTER (WHERE de.actual_date IS NULL)                       AS pending_deliveries

    FROM delivery_events de
    JOIN suppliers s ON s.id = de.supplier_id
    WHERE de.hotel_id  = auth_hotel_id()
      AND de.created_at >= NOW() - (p_days || ' days')::interval
    GROUP BY de.supplier_id, s.name
  ),

  scored AS (
    SELECT *,
      -- Reliability 0-100: on-time 40% + fill-rate 40% + price stability 20%
      ROUND(
          COALESCE(on_time_rate,  50) * 0.40
        + COALESCE(avg_fill_rate, 50) * 0.40
        + GREATEST(0, 20 - LEAST(ABS(COALESCE(avg_price_drift_pct, 0)) * 2, 20))
      , 1) AS reliability_score
    FROM base
  )

  SELECT
    supplier_id,
    supplier_name,
    total_deliveries,
    completed_deliveries,
    on_time_rate,
    avg_fill_rate,
    avg_price_drift_pct,
    avg_days_late,
    total_spend,
    pending_deliveries,
    reliability_score,

    -- Leverage 0-100 (higher = more negotiating room)
    ROUND(LEAST(100, GREATEST(0,
      -- Price drift above 2% creates leverage (0–40 pts)
      LEAST(40, GREATEST(0, (COALESCE(avg_price_drift_pct, 0) - 2) * 4))
      -- Low reliability creates leverage (0–40 pts)
      + LEAST(40, GREATEST(0, (80 - reliability_score) * 0.5))
      -- Spend magnitude = negotiating weight (0–20 pts)
      + CASE
          WHEN total_spend > 10000 THEN 20
          WHEN total_spend > 5000  THEN 15
          WHEN total_spend > 1000  THEN 10
          WHEN total_spend > 100   THEN 5
          ELSE 0
        END
    )), 1) AS leverage_score,

    CASE
      WHEN reliability_score < 60 AND COALESCE(avg_price_drift_pct, 0) > 5
        THEN 'Find Alternative'
      WHEN COALESCE(avg_price_drift_pct, 0) > 5 OR reliability_score < 70
        THEN 'Renegotiate'
      WHEN COALESCE(avg_price_drift_pct, 0) < 0 AND reliability_score > 85
        THEN 'Preferred Supplier'
      ELSE 'Monitor'
    END AS recommended_action

  FROM scored
  ORDER BY leverage_score DESC;
$$;

GRANT EXECUTE ON FUNCTION get_supplier_leverage(int) TO authenticated;

-- ─── 2. Per-supplier price history ───────────────────────────────────────────
-- Returns one row per delivery with pricing data for sparkline rendering.

CREATE OR REPLACE FUNCTION get_supplier_price_history(
  p_supplier_id uuid,
  p_days        int DEFAULT 90
)
RETURNS TABLE (
  delivery_id         uuid,
  delivery_date       date,
  unit_cost_expected  numeric,
  unit_cost_actual    numeric,
  price_drift_pct     numeric,
  ordered_qty         numeric,
  received_qty        numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    de.id                                                       AS delivery_id,
    COALESCE(de.actual_date, de.expected_date)                  AS delivery_date,
    de.unit_cost_expected,
    de.unit_cost_actual,
    ROUND(
      CASE
        WHEN de.unit_cost_expected > 0 AND de.unit_cost_actual IS NOT NULL
        THEN (de.unit_cost_actual - de.unit_cost_expected)
             / de.unit_cost_expected * 100
        ELSE NULL
      END
    , 2)                                                        AS price_drift_pct,
    de.ordered_qty,
    de.received_qty
  FROM delivery_events de
  WHERE de.hotel_id    = auth_hotel_id()
    AND de.supplier_id = p_supplier_id
    AND de.unit_cost_expected IS NOT NULL
    AND de.created_at >= NOW() - (p_days || ' days')::interval
  ORDER BY delivery_date ASC;
$$;

GRANT EXECUTE ON FUNCTION get_supplier_price_history(uuid, int) TO authenticated;
