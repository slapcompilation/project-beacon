-- Sprint 21: Autonomous Restock Proposals (Phase 9)
-- auto_propose_restocks(p_threshold_days, p_multiplier)
--   Scans all variants using 30-day consumption stats.
--   Creates a pending restock request for any variant where:
--     - days_until_zero < p_threshold_days
--     - no open (pending or approved) request already exists
--     - avg_daily > 0 (has measurable consumption)
--   Proposed quantity = ceil(avg_daily * 14) — two weeks of stock.
--   Returns the number of proposals created.

CREATE OR REPLACE FUNCTION auto_propose_restocks(
  p_threshold_days int DEFAULT 7,
  p_restock_days   int DEFAULT 14  -- how many days of stock to propose
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
    hotel_id, variant_id, quantity_needed, requestor_id, status, notes
  )
  SELECT
    v_hotel_id,
    stats.variant_id,
    GREATEST(1, CEIL(stats.avg_daily * p_restock_days))::int,
    v_user_id,
    'pending',
    'Auto-proposed · ~' || stats.days_until_zero::int || 'd until zero'
  FROM (
    -- Inline consumption stats (mirrors get_consumption_stats logic)
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
    -- Skip variants that already have an open request
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
