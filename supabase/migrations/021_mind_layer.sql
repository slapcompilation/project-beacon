-- Sprint 20: Mind Layer — Strategy & Memory
-- 1. get_procurement_insights() — supplier spend + fulfillment stats
-- 2. get_chain_benchmarks()     — cross-hotel waste/consumption (owner only)
-- 3. get_waste_cost()           — monetary value of wasted stock

-- ─── 1. Procurement Insights ─────────────────────────────────────────────────
-- Groups restock_requests by supplier (text column on the request itself).
-- Joins restock_receives for quantity_received and received_at.
-- avg_fulfillment_days = avg days from rr.date to first receive per request.

CREATE OR REPLACE FUNCTION get_procurement_insights(p_days int DEFAULT 90)
RETURNS TABLE (
  supplier_name        text,
  total_orders         int,
  fulfilled_orders     int,
  avg_fulfillment_days numeric,
  total_spend          numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_receive AS (
    -- One row per request: earliest received_at + total received qty
    SELECT
      recv.request_id,
      MIN(recv.received_at)            AS first_received_at,
      SUM(recv.quantity_received)      AS total_qty_received
    FROM restock_receives recv
    WHERE recv.hotel_id = auth_hotel_id()
    GROUP BY recv.request_id
  )
  SELECT
    COALESCE(rr.supplier, '(No supplier)')              AS supplier_name,
    COUNT(DISTINCT rr.id)::int                          AS total_orders,
    COUNT(DISTINCT rr.id) FILTER (WHERE rr.status = 'fulfilled')::int
                                                        AS fulfilled_orders,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (fr.first_received_at - rr.date)) / 86400.0
      ) FILTER (WHERE rr.status = 'fulfilled'),
      1
    )                                                   AS avg_fulfillment_days,
    COALESCE(SUM(fr.total_qty_received * pv.cost), 0)  AS total_spend
  FROM restock_requests rr
  JOIN product_variants pv ON pv.id = rr.variant_id
  LEFT JOIN first_receive fr ON fr.request_id = rr.id
  WHERE rr.hotel_id = auth_hotel_id()
    AND rr.date    >= NOW() - (p_days || ' days')::interval
  GROUP BY rr.supplier
  ORDER BY total_spend DESC;
$$;

GRANT EXECUTE ON FUNCTION get_procurement_insights(int) TO authenticated;

-- ─── 2. Chain Benchmarks ─────────────────────────────────────────────────────
-- Returns per-hotel waste stats for all hotels the calling user can access.
-- Covers both the primary hotel (profiles.hotel_id) and any extras
-- from user_hotel_memberships. Only meaningful for multi-hotel owners.

CREATE OR REPLACE FUNCTION get_chain_benchmarks(p_days int DEFAULT 30)
RETURNS TABLE (
  hotel_id      uuid,
  hotel_name    text,
  total_removed int,
  total_wasted  int,
  waste_rate    numeric,
  total_added   int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_hotels AS (
    SELECT hotel_id FROM profiles WHERE id = auth.uid()
  )
  SELECT
    h.id                                                 AS hotel_id,
    h.name                                               AS hotel_name,
    COALESCE(
      ABS(SUM(sl.quantity_change)
        FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert))::int,
      0
    )                                                    AS total_removed,
    COALESCE(
      ABS(SUM(sl.quantity_change)
        FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert))::int,
      0
    )                                                    AS total_wasted,
    ROUND(
      COALESCE(
        ABS(SUM(sl.quantity_change) FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert))
        / NULLIF(
            ABS(SUM(sl.quantity_change) FILTER (WHERE sl.quantity_change < 0)),
            0
          ),
        0
      ),
      3
    )                                                    AS waste_rate,
    COALESCE(
      SUM(sl.quantity_change)
        FILTER (WHERE sl.quantity_change > 0 AND NOT sl.is_revert)::int,
      0
    )                                                    AS total_added
  FROM my_hotels mh
  JOIN hotels h ON h.id = mh.hotel_id
  LEFT JOIN stock_logs sl ON sl.hotel_id = h.id
    AND sl.timestamp >= NOW() - (p_days || ' days')::interval
  GROUP BY h.id, h.name
  ORDER BY total_wasted DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_chain_benchmarks(int) TO authenticated;

-- ─── 3. Waste Cost ────────────────────────────────────────────────────────────
-- Returns monetary cost of wasted stock per category for the calling hotel.

CREATE OR REPLACE FUNCTION get_waste_cost(p_days int DEFAULT 30)
RETURNS TABLE (
  category_name  text,
  total_units    int,
  total_cost     numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(c.name, 'Uncategorized')                    AS category_name,
    ABS(SUM(sl.quantity_change))::int                    AS total_units,
    ROUND(ABS(SUM(sl.quantity_change * pv.cost)), 2)     AS total_cost
  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr          ON pr.id = pv.product_id
  LEFT JOIN categories c    ON c.id  = pr.category_id
  WHERE sl.hotel_id       = auth_hotel_id()
    AND sl.quantity_change < 0
    AND sl.is_revert       = false
    AND sl.timestamp      >= NOW() - (p_days || ' days')::interval
  GROUP BY c.name
  ORDER BY total_cost DESC;
$$;

GRANT EXECUTE ON FUNCTION get_waste_cost(int) TO authenticated;
