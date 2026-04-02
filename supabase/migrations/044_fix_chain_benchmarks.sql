-- Fix: get_chain_benchmarks() total_wasted was computing identical value to total_removed.
-- total_wasted should only count removals with an explicit waste removal_category.

SET search_path = public;

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
        FILTER (
          WHERE sl.quantity_change < 0
            AND NOT sl.is_revert
            AND sl.removal_category IN ('spoilage','breakage','theft','expired','damaged')
        ))::int,
      0
    )                                                    AS total_wasted,
    ROUND(
      COALESCE(
        ABS(SUM(sl.quantity_change) FILTER (
          WHERE sl.quantity_change < 0
            AND NOT sl.is_revert
            AND sl.removal_category IN ('spoilage','breakage','theft','expired','damaged')
        ))
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
