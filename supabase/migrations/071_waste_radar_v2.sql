-- Migration 071: Waste Radar v2 (Sprint 14 — Eye Layer)
-- Replaces the basic top-10 aggregation in 032 with a full anomaly-detection surface.
--
-- Design:
--   • Spike = 7-day write-offs ≥ 50% above the 4-week weekly baseline (Breakage/Theft/Spoilage only)
--   • anomaly_score 1–10: spike magnitude × occupancy_inverse_factor
--       low occ (<50%)    → ×1.5  (write-offs at low occupancy = probable non-operational cause)
--       normal occ (<70%) → ×1.25
--       high occ (≥70%)   → ×1.0  (elevated use may be operational)
--       score = LEAST(GREATEST(ROUND(pct_above × factor / 30), 1), 10)
--   • occupancy_band: 'low' | 'normal' | 'high' based on 7-day avg
--   • Category breakdown: breakage / theft / spoilage units each
--   • Team attribution: the single user who logged the most write-off units in the 7d window
--   • No row limit — shows ALL spikes (Briefing shows only the top 2; this is the full picture)
--   • Sort: anomaly_score DESC, qty_7d DESC
--
-- Palantir principle: cross-domain synthesis — waste spike × occupancy × team member = situational picture.

SET search_path = public;

DROP FUNCTION IF EXISTS get_waste_radar(integer);

CREATE OR REPLACE FUNCTION get_waste_radar()
RETURNS TABLE (
  variant_id          uuid,
  variant_label       text,
  qty_7d              int,
  avg_weekly          numeric,
  pct_above_baseline  int,
  anomaly_score       int,      -- 1–10; higher = stronger unexplained signal
  occupancy_band      text,     -- 'low' | 'normal' | 'high'
  avg_occupancy_7d    int,      -- 7-day hotel occupancy %
  waste_cost_7d       numeric,  -- qty_7d × variant unit cost
  breakage_qty        int,
  theft_qty           int,
  spoilage_qty        int,
  top_user_email      text,     -- user with most write-off units in window; NULL if unattributable
  top_user_qty        int       -- units that user wrote off
)
LANGUAGE sql STABLE AS $$
  WITH
  -- ── 7-day avg hotel occupancy ─────────────────────────────────────────────
  recent_occ AS (
    SELECT ROUND(COALESCE(AVG(occupancy_pct), 50))::int AS avg_pct
    FROM   occupancy_logs
    WHERE  hotel_id = auth_hotel_id()
      AND  date    >= CURRENT_DATE - 7
  ),

  -- ── Write-offs this week (Breakage + Theft + Spoilage), split by category ─
  wo_7d AS (
    SELECT
      sl.variant_id,
      SUM(ABS(sl.quantity_change))::int                                                           AS qty,
      SUM(CASE WHEN sl.removal_category = 'Breakage' THEN ABS(sl.quantity_change) ELSE 0 END)::int AS breakage_qty,
      SUM(CASE WHEN sl.removal_category = 'Theft'    THEN ABS(sl.quantity_change) ELSE 0 END)::int AS theft_qty,
      SUM(CASE WHEN sl.removal_category = 'Spoilage' THEN ABS(sl.quantity_change) ELSE 0 END)::int AS spoilage_qty
    FROM   stock_logs sl
    WHERE  sl.hotel_id         = auth_hotel_id()
      AND  sl.timestamp        >= now() - interval '7 days'
      AND  sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  sl.is_revert        = false
      AND  sl.source           IS DISTINCT FROM 'pos'
    GROUP  BY sl.variant_id
  ),

  -- ── 4-week weekly baseline (avg per week over 28 days) ────────────────────
  wo_avg AS (
    SELECT
      variant_id,
      ROUND(SUM(ABS(quantity_change)) / 4.0, 1) AS avg_weekly
    FROM   stock_logs
    WHERE  hotel_id         = auth_hotel_id()
      AND  timestamp        >= now() - interval '28 days'
      AND  removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  is_revert        = false
      AND  source           IS DISTINCT FROM 'pos'
    GROUP  BY variant_id
    HAVING SUM(ABS(quantity_change)) > 0
  ),

  -- ── Top write-off contributor per variant in 7d window ────────────────────
  -- DISTINCT ON picks the user with the highest qty per variant.
  top_user AS (
    SELECT DISTINCT ON (sl.variant_id)
      sl.variant_id,
      p.email                             AS email,
      SUM(ABS(sl.quantity_change))::int   AS user_qty
    FROM   stock_logs sl
    JOIN   profiles p ON p.id = sl.user_id
    WHERE  sl.hotel_id         = auth_hotel_id()
      AND  sl.timestamp        >= now() - interval '7 days'
      AND  sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  sl.is_revert        = false
      AND  sl.source           IS DISTINCT FROM 'pos'
    GROUP  BY sl.variant_id, p.email
    ORDER  BY sl.variant_id, SUM(ABS(sl.quantity_change)) DESC
  )

  SELECT
    pv.id                                                                          AS variant_id,
    pr.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END  AS variant_label,
    w7.qty                                                                         AS qty_7d,
    wa.avg_weekly,
    ROUND((w7.qty - wa.avg_weekly) / NULLIF(wa.avg_weekly, 0) * 100)::int          AS pct_above_baseline,

    -- anomaly_score 1–10: spike % × occupancy inverse factor, normalised by /30
    LEAST(GREATEST(
      ROUND(
        (w7.qty - wa.avg_weekly) / NULLIF(wa.avg_weekly, 0) * 100
        * CASE
            WHEN (SELECT avg_pct FROM recent_occ) < 50 THEN 1.5
            WHEN (SELECT avg_pct FROM recent_occ) < 70 THEN 1.25
            ELSE 1.0
          END
        / 30.0
      )::int,
    1), 10)                                                                        AS anomaly_score,

    CASE
      WHEN (SELECT avg_pct FROM recent_occ) < 50 THEN 'low'
      WHEN (SELECT avg_pct FROM recent_occ) < 70 THEN 'normal'
      ELSE 'high'
    END                                                                            AS occupancy_band,
    (SELECT avg_pct FROM recent_occ)                                               AS avg_occupancy_7d,
    ROUND(w7.qty * COALESCE(pv.cost, 0), 2)                                        AS waste_cost_7d,
    w7.breakage_qty,
    w7.theft_qty,
    w7.spoilage_qty,
    tu.email                                                                       AS top_user_email,
    tu.user_qty                                                                    AS top_user_qty

  FROM   wo_7d w7
  JOIN   wo_avg wa          ON wa.variant_id = w7.variant_id
  JOIN   product_variants pv ON pv.id = w7.variant_id
  JOIN   products pr        ON pr.id  = pv.product_id
  LEFT JOIN top_user tu     ON tu.variant_id = w7.variant_id

  -- Only surface genuine spikes: ≥50% above the 4-week weekly baseline
  WHERE  w7.qty > wa.avg_weekly * 1.5

  ORDER  BY anomaly_score DESC, w7.qty DESC;
$$;

GRANT EXECUTE ON FUNCTION get_waste_radar() TO authenticated;
