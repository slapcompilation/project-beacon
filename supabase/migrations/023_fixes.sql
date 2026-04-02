-- Sprint 21 fixes
-- 1. Add is_auto_proposed column to restock_requests (#3)
-- 2. Fix get_chain_benchmarks total_removed vs total_wasted (#8)
-- 3. Fix auto_propose_restocks quantity formula (#2)

-- ─── 1. is_auto_proposed column ───────────────────────────────────────────────

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS is_auto_proposed boolean NOT NULL DEFAULT false;

-- ─── 2. Fix get_chain_benchmarks ──────────────────────────────────────────────
-- total_removed = ALL negative adjustments (including reverts)
-- total_wasted  = only non-revert negative adjustments
-- waste_rate    = total_wasted / NULLIF(total_removed, 0)

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
        FILTER (WHERE sl.quantity_change < 0))::int,
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

-- ─── 3. Fix auto_propose_restocks quantity + use is_auto_proposed ─────────────
-- Proposed qty = max(1, ceil(avg_daily * restock_days) - current_stock)
-- This accounts for stock already on hand.

CREATE OR REPLACE FUNCTION auto_propose_restocks(
  p_threshold_days int DEFAULT 7,
  p_restock_days   int DEFAULT 14
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id   uuid := auth_hotel_id();
  v_user_id    uuid := auth.uid();
  v_count      int  := 0;
BEGIN
  INSERT INTO restock_requests (
    hotel_id, variant_id, quantity_needed, requestor_id, status, notes, is_auto_proposed
  )
  SELECT
    v_hotel_id,
    stats.variant_id,
    GREATEST(1, CEIL(stats.avg_daily * p_restock_days) - stats.current_stock)::int,
    v_user_id,
    'pending',
    'Auto-proposed · ~' || stats.days_until_zero::int || 'd until zero',
    true
  FROM (
    SELECT
      pv.id                                                          AS variant_id,
      pv.current_stock                                               AS current_stock,
      ROUND(ABS(SUM(sl.quantity_change)) / 30.0, 4)                 AS avg_daily,
      CASE
        WHEN ABS(SUM(sl.quantity_change)) = 0 THEN NULL
        ELSE ROUND(
          pv.current_stock / (ABS(SUM(sl.quantity_change)) / 30.0),
          1
        )
      END                                                            AS days_until_zero
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '30 days'
      AND pv.enabled          = true
    GROUP BY pv.id, pv.current_stock
    HAVING ABS(SUM(sl.quantity_change)) > 0
  ) stats
  WHERE stats.days_until_zero IS NOT NULL
    AND stats.days_until_zero < p_threshold_days
    AND NOT EXISTS (
      SELECT 1 FROM restock_requests rr
      WHERE rr.hotel_id   = v_hotel_id
        AND rr.variant_id = stats.variant_id
        AND rr.status     IN ('pending', 'approved')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_propose_restocks(int, int) TO authenticated;
