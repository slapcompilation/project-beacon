-- Layer: Mind — Chain Benchmarks v3 (Sprint 18, Phase 8)
-- Extends get_chain_benchmarks() with supplier fill-rate and on-time data.
-- These are the two fields missing from the cross-chain comparison surface:
--   avg_fill_rate    — avg received/ordered across all suppliers for this hotel
--   avg_on_time_rate — % of deliveries that arrived on or before expected date
--
-- DROP the old signature explicitly (return type change requires it).

SET search_path = public;

DROP FUNCTION IF EXISTS get_chain_benchmarks(int);

CREATE OR REPLACE FUNCTION get_chain_benchmarks(p_days int DEFAULT 30)
RETURNS TABLE (
  hotel_id         uuid,
  hotel_name       text,
  total_removed    int,
  total_wasted     int,
  waste_rate       numeric,
  total_added      int,
  avg_fill_rate    numeric,     -- avg supplier fill % across all suppliers; NULL = no delivery data
  avg_on_time_rate numeric      -- avg on-time delivery % across all suppliers; NULL = no data
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_hotels AS (
    SELECT hotel_id FROM profiles WHERE id = auth.uid()
  ),

  stock_flow AS (
    SELECT
      sl.hotel_id,
      COALESCE(
        ABS(SUM(sl.quantity_change)
          FILTER (WHERE sl.quantity_change < 0 AND NOT sl.is_revert))::int,
        0
      )                                                                        AS total_removed,
      COALESCE(
        ABS(SUM(sl.quantity_change)
          FILTER (
            WHERE sl.quantity_change < 0
              AND NOT sl.is_revert
              AND sl.removal_category IN ('spoilage','breakage','theft','expired','damaged')
          ))::int,
        0
      )                                                                        AS total_wasted,
      COALESCE(
        SUM(sl.quantity_change)
          FILTER (WHERE sl.quantity_change > 0 AND NOT sl.is_revert)::int,
        0
      )                                                                        AS total_added
    FROM stock_logs sl
    WHERE sl.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND sl.timestamp >= NOW() - (p_days || ' days')::interval
    GROUP BY sl.hotel_id
  ),

  -- Pull from supplier_scorecard view (already in scope for all accessible hotels
  -- via SECURITY DEFINER — view uses no RLS, just joins hotels to delivery_events)
  supplier_agg AS (
    SELECT
      ss.hotel_id,
      ROUND(AVG(ss.avg_fill_rate),  1) AS avg_fill_rate,
      ROUND(AVG(ss.on_time_rate),   1) AS avg_on_time_rate
    FROM supplier_scorecard ss
    WHERE ss.hotel_id IN (SELECT hotel_id FROM my_hotels)
      AND ss.total_deliveries > 0
    GROUP BY ss.hotel_id
  )

  SELECT
    h.id                                                           AS hotel_id,
    h.name                                                         AS hotel_name,
    COALESCE(sf.total_removed, 0)                                  AS total_removed,
    COALESCE(sf.total_wasted,  0)                                  AS total_wasted,
    ROUND(
      COALESCE(sf.total_wasted, 0)::numeric
      / NULLIF(COALESCE(sf.total_removed, 0), 0),
      3
    )                                                              AS waste_rate,
    COALESCE(sf.total_added, 0)                                    AS total_added,
    sa.avg_fill_rate,
    sa.avg_on_time_rate

  FROM my_hotels mh
  JOIN hotels h ON h.id = mh.hotel_id
  LEFT JOIN stock_flow  sf ON sf.hotel_id = h.id
  LEFT JOIN supplier_agg sa ON sa.hotel_id = h.id
  ORDER BY total_wasted DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_chain_benchmarks(int) TO authenticated;
