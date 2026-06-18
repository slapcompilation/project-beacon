-- Last holdout of the #3 vocabulary reconciliation: get_chain_benchmarks still
-- filtered waste with a bare lowercase removal_category list
-- ('spoilage','breakage','theft','expired','damaged'), while the detector, the
-- StockAdjust modal, and every other report (get_waste_radar, get_budget_vs_actual,
-- get_team_performance, CPOR…) use Title-Case. Verified it's the ONLY live function
-- with a lowercase removal_category comparison. With Title-Case data its
-- total_wasted would read 0, so chain benchmarks disagreed with waste radar for the
-- same rows. Align it to the canonical waste triad the other reports use.
--
-- Body reproduced verbatim from the live definition; only the IN-list changes.

CREATE OR REPLACE FUNCTION public.get_chain_benchmarks(p_days integer DEFAULT 30)
 RETURNS TABLE(hotel_id uuid, hotel_name text, total_removed integer, total_wasted integer, waste_rate numeric, total_added integer, avg_fill_rate numeric, avg_on_time_rate numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
              AND sl.removal_category IN ('Breakage','Theft','Spoilage')
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
$function$;
