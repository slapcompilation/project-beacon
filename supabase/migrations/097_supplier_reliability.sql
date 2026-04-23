-- Migration 097: Supplier Delivery Reliability Intelligence
-- Layer: Eye — Supplier reliability scoring
-- Purpose: Score every supplier by actual delivery performance using
--   purchase_order data vs expected_delivery_date, cost variance vs
--   supplier_contracts, and contribution to stockout events.
--
-- Reliability score (1–10):
--   Base  = on_time_pct / 10   (0–10 pts, clamped)
--   Minus avg_delay_days / 3   (each 3-day avg delay = −1 pt)
--   Minus cost_variance_penalty (>5% avg overcharge = −1pt, >10% = −2pt)
--   Clamped to [1, 10], rounded to 1 decimal

SET search_path = public;

-- ─── get_supplier_reliability(p_days) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_supplier_reliability(p_days int DEFAULT 90)
RETURNS TABLE (
  supplier_id           uuid,
  supplier_name         text,
  total_orders          bigint,
  on_time_orders        bigint,
  late_orders           bigint,
  on_time_pct           numeric,       -- 0–100
  avg_delay_days        numeric,       -- avg days late (only late orders)
  max_delay_days        numeric,       -- worst single delay
  total_value           numeric,       -- total PO value in window
  avg_cost_variance_pct numeric,       -- vs contracted price (null = no contracts)
  active_contracts      bigint,        -- active supplier_contracts rows
  reliability_score     numeric,       -- 1–10 composite
  risk_tier             text,          -- 'low' | 'medium' | 'high' | 'critical'
  last_delivery_date    date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH window_pos AS (
    -- All closed POs (received or partially received) in the analysis window
    SELECT
      po.id,
      po.supplier_id,
      po.supplier_name,
      po.total_amount,
      po.expected_delivery_date,
      po.status,
      -- Actual close date = latest receive date for this PO
      MAX(rcv.received_at)::date AS actual_delivery_date,
      po.expected_delivery_date  AS eta_date
    FROM   purchase_orders po
    JOIN   restock_receives rcv ON rcv.hotel_id = po.hotel_id
    JOIN   restock_requests rr  ON rr.id = rcv.request_id
    JOIN   purchase_order_lines pol ON pol.request_id = rr.id AND pol.po_id = po.id
    WHERE  po.hotel_id = auth_hotel_id()
      AND  po.status IN ('partially_received', 'closed')
      AND  po.created_at >= now() - (p_days || ' days')::interval
    GROUP BY po.id, po.supplier_id, po.supplier_name, po.total_amount,
             po.expected_delivery_date, po.status
  ),
  delivery_stats AS (
    SELECT
      COALESCE(wp.supplier_id::text, wp.supplier_name)   AS grp_key,
      wp.supplier_id,
      wp.supplier_name,
      COUNT(*)                                            AS total_orders,
      SUM(CASE
        WHEN wp.eta_date IS NULL THEN 1
        WHEN wp.actual_delivery_date <= wp.eta_date THEN 1
        ELSE 0
      END)                                                AS on_time_orders,
      SUM(CASE
        WHEN wp.eta_date IS NOT NULL
          AND wp.actual_delivery_date > wp.eta_date THEN 1
        ELSE 0
      END)                                                AS late_orders,
      AVG(CASE
        WHEN wp.eta_date IS NOT NULL
          AND wp.actual_delivery_date > wp.eta_date
          THEN (wp.actual_delivery_date - wp.eta_date)
      END)                                                AS avg_delay_days,
      MAX(CASE
        WHEN wp.eta_date IS NOT NULL
          AND wp.actual_delivery_date > wp.eta_date
          THEN (wp.actual_delivery_date - wp.eta_date)
        ELSE 0
      END)                                                AS max_delay_days,
      SUM(wp.total_amount)                               AS total_value,
      MAX(wp.actual_delivery_date)                       AS last_delivery_date
    FROM window_pos wp
    GROUP BY grp_key, wp.supplier_id, wp.supplier_name
  ),
  contract_variance AS (
    -- Average price deviation vs contracted price per supplier
    SELECT
      sc.supplier_id,
      AVG(sc.price_deviation_pct)  AS avg_cost_variance_pct,
      COUNT(*)                      AS active_contracts
    FROM get_supplier_contracts() sc
    WHERE sc.is_active = true
      AND sc.price_deviation_pct IS NOT NULL
    GROUP BY sc.supplier_id
  )
  SELECT
    ds.supplier_id,
    ds.supplier_name,
    ds.total_orders,
    ds.on_time_orders,
    ds.late_orders,
    -- on_time_pct: if no ETA ever set, count as on-time (no commitment made)
    ROUND(
      CASE WHEN ds.total_orders = 0 THEN 100
           ELSE (ds.on_time_orders::numeric / ds.total_orders) * 100
      END, 1
    )                                                                AS on_time_pct,
    ROUND(COALESCE(ds.avg_delay_days, 0), 1)                        AS avg_delay_days,
    ROUND(COALESCE(ds.max_delay_days, 0), 1)                        AS max_delay_days,
    ROUND(COALESCE(ds.total_value, 0), 2)                           AS total_value,
    ROUND(cv.avg_cost_variance_pct, 2)                              AS avg_cost_variance_pct,
    COALESCE(cv.active_contracts, 0)                                AS active_contracts,
    -- ── Reliability score ───────────────────────────────────────────────────
    GREATEST(1, LEAST(10,
      ROUND(
        -- Base: on-time % mapped 0–10
        (CASE WHEN ds.total_orders = 0 THEN 100
              ELSE (ds.on_time_orders::numeric / ds.total_orders) * 100
         END / 10.0)
        -- Delay penalty: each 3d avg delay = −1
        - COALESCE(ds.avg_delay_days, 0) / 3.0
        -- Cost variance penalty
        - CASE
            WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 10 THEN 2
            WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 5  THEN 1
            ELSE 0
          END,
      1)
    ))                                                               AS reliability_score,
    -- ── Risk tier ───────────────────────────────────────────────────────────
    CASE
      WHEN GREATEST(1, LEAST(10,
        ROUND(
          (CASE WHEN ds.total_orders = 0 THEN 100
                ELSE (ds.on_time_orders::numeric / ds.total_orders) * 100
           END / 10.0)
          - COALESCE(ds.avg_delay_days, 0) / 3.0
          - CASE
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 10 THEN 2
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 5  THEN 1
              ELSE 0
            END,
        1)
      )) < 3  THEN 'critical'
      WHEN GREATEST(1, LEAST(10,
        ROUND(
          (CASE WHEN ds.total_orders = 0 THEN 100
                ELSE (ds.on_time_orders::numeric / ds.total_orders) * 100
           END / 10.0)
          - COALESCE(ds.avg_delay_days, 0) / 3.0
          - CASE
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 10 THEN 2
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 5  THEN 1
              ELSE 0
            END,
        1)
      )) < 5  THEN 'high'
      WHEN GREATEST(1, LEAST(10,
        ROUND(
          (CASE WHEN ds.total_orders = 0 THEN 100
                ELSE (ds.on_time_orders::numeric / ds.total_orders) * 100
           END / 10.0)
          - COALESCE(ds.avg_delay_days, 0) / 3.0
          - CASE
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 10 THEN 2
              WHEN COALESCE(cv.avg_cost_variance_pct, 0) > 5  THEN 1
              ELSE 0
            END,
        1)
      )) < 7  THEN 'medium'
      ELSE 'low'
    END                                                              AS risk_tier,
    ds.last_delivery_date
  FROM delivery_stats ds
  LEFT JOIN contract_variance cv ON cv.supplier_id = ds.supplier_id
  ORDER BY reliability_score ASC, late_orders DESC
$$;

GRANT EXECUTE ON FUNCTION get_supplier_reliability(int) TO authenticated;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION get_supplier_reliability IS
  'Eye Layer: per-supplier reliability score (1–10) from on-time delivery rate, '
  'avg delay, and cost variance vs contracts. Worst first.';
