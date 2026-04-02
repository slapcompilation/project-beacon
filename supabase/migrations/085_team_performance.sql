-- Migration 085: Team Performance Intelligence
-- Layer: Mind → Eye cross-layer
-- Palantir principle: cross-domain synthesis — every number carries its context.
--   stock_logs + users + restock activity → per-member waste attribution,
--   outlier detection, and team-relative benchmarking.
--
-- get_team_performance(p_window_days) returns one row per team member with:
--   • Write-off breakdown by category (Breakage / Theft / Spoilage)
--   • Waste rate as % of total stock removals
--   • Rate vs team average — flags outliers at ≥2.5× with reason
--   • Consumption + addition activity (proxy for shift engagement)
--   • Restock requests filed + stock receives processed
--   • active_days: distinct days with ≥1 log entry
--   • Sorted: outliers first, then by write_off_cost DESC

SET search_path = public;

CREATE OR REPLACE FUNCTION get_team_performance(
  p_window_days int DEFAULT 30
)
RETURNS TABLE (
  user_id                    uuid,
  email                      text,
  role                       text,
  -- Write-off metrics (Breakage + Theft + Spoilage)
  write_off_units            int,
  write_off_cost             numeric,
  breakage_units             int,
  theft_units                int,
  spoilage_units             int,
  -- Operational activity
  consumption_units          int,      -- removals that are not write-offs
  consumption_logs           int,      -- count of such log entries
  additions_logged           int,      -- receiving / manual additions
  active_days                int,      -- distinct calendar days with ≥1 log
  last_active_at             timestamptz,
  -- Derived ratios
  avg_write_off_per_day      float8,   -- write_off_units / active_days; 0 if no active days
  waste_rate_pct             float8,   -- write_offs / (write_offs + consumption) × 100; null if no removals
  write_off_rate_vs_team_avg float8,   -- ratio to team mean; 1.0 = average
  -- Restock activity
  restock_requests_filed     int,
  stock_receives_processed   int,
  -- Outlier flags
  is_outlier                 boolean,
  outlier_reason             text      -- null when not an outlier
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id
  FROM hotel_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH

  -- ── Active team members for this hotel ──────────────────────────────────
  team AS (
    SELECT u.id, u.email, u.role
    FROM users u
    WHERE u.hotel_id = v_hotel_id
  ),

  -- ── Stock log activity for the window ───────────────────────────────────
  -- user_id on stock_logs may be NULL if the user was GDPR-erased;
  -- only include logs with a resolvable user.
  log_activity AS (
    SELECT
      sl.user_id,
      -- Write-offs: Breakage, Theft, Spoilage
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.removal_category IN ('Breakage','Theft','Spoilage'))::int
                                                         AS write_off_units,
      SUM(
        ABS(sl.quantity_change) * COALESCE(pv.cost, 0)
      ) FILTER (WHERE sl.removal_category IN ('Breakage','Theft','Spoilage'))
                                                         AS write_off_cost,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.removal_category = 'Breakage')::int AS breakage_units,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.removal_category = 'Theft')::int    AS theft_units,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.removal_category = 'Spoilage')::int AS spoilage_units,
      -- Consumption: negative qty_change that is NOT a write-off category
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.quantity_change < 0
          AND (sl.removal_category = 'Consumed' OR sl.removal_category IS NULL)
          AND sl.is_revert = false
        )::int                                           AS consumption_units,
      COUNT(*)
        FILTER (WHERE sl.quantity_change < 0
          AND (sl.removal_category = 'Consumed' OR sl.removal_category IS NULL)
          AND sl.is_revert = false
        )::int                                           AS consumption_logs,
      -- Additions (stock received / manually added)
      COUNT(*)
        FILTER (WHERE sl.quantity_change > 0 AND sl.is_revert = false)::int
                                                         AS additions_logged,
      COUNT(DISTINCT DATE(sl.timestamp AT TIME ZONE 'UTC'))::int
                                                         AS active_days,
      MAX(sl.timestamp)                                  AS last_active_at
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id   = v_hotel_id
      AND sl.timestamp  >= NOW() - (p_window_days || ' days')::interval
      AND sl.is_revert   = false
      AND sl.user_id    IS NOT NULL
    GROUP BY sl.user_id
  ),

  -- ── Restock requests filed in window ────────────────────────────────────
  restock_activity AS (
    SELECT
      rr.requestor_id AS user_id,
      COUNT(*)::int   AS requests_filed
    FROM restock_requests rr
    WHERE rr.hotel_id = v_hotel_id
      AND rr.date    >= NOW() - (p_window_days || ' days')::interval
    GROUP BY rr.requestor_id
  ),

  -- ── Stock receives processed in window ──────────────────────────────────
  receive_activity AS (
    SELECT
      rrecv.received_by AS user_id,
      COUNT(*)::int     AS receives_processed
    FROM restock_receives rrecv
    WHERE rrecv.hotel_id   = v_hotel_id
      AND rrecv.received_at >= NOW() - (p_window_days || ' days')::interval
      AND rrecv.received_by IS NOT NULL
    GROUP BY rrecv.received_by
  ),

  -- ── Assemble per-member ──────────────────────────────────────────────────
  per_member AS (
    SELECT
      t.id                                        AS user_id,
      t.email,
      t.role,
      COALESCE(la.write_off_units,   0)           AS write_off_units,
      COALESCE(la.write_off_cost,    0)           AS write_off_cost,
      COALESCE(la.breakage_units,    0)           AS breakage_units,
      COALESCE(la.theft_units,       0)           AS theft_units,
      COALESCE(la.spoilage_units,    0)           AS spoilage_units,
      COALESCE(la.consumption_units, 0)           AS consumption_units,
      COALESCE(la.consumption_logs,  0)           AS consumption_logs,
      COALESCE(la.additions_logged,  0)           AS additions_logged,
      COALESCE(la.active_days,       0)           AS active_days,
      la.last_active_at,
      COALESCE(ra.requests_filed,    0)           AS restock_requests_filed,
      COALESCE(recva.receives_processed, 0)       AS stock_receives_processed
    FROM team t
    LEFT JOIN log_activity    la    ON la.user_id    = t.id
    LEFT JOIN restock_activity ra   ON ra.user_id    = t.id
    LEFT JOIN receive_activity recva ON recva.user_id = t.id
  ),

  -- ── Team-level averages for relative benchmarking ───────────────────────
  team_avg AS (
    SELECT
      -- Only include members who had ≥1 active day to avoid diluting average
      -- with completely inactive members
      AVG(
        CASE WHEN pm.active_days > 0
          THEN pm.write_off_units::float8 / pm.active_days
          ELSE NULL
        END
      ) AS avg_write_off_per_day_team
    FROM per_member pm
    WHERE pm.write_off_units > 0 OR pm.consumption_units > 0
  ),

  -- ── Final computation ────────────────────────────────────────────────────
  computed AS (
    SELECT
      pm.*,
      -- avg write-off per active day
      CASE WHEN pm.active_days > 0
        THEN pm.write_off_units::float8 / pm.active_days
        ELSE 0.0
      END AS avg_wo_per_day,
      -- waste rate as % of all removals
      CASE WHEN (pm.write_off_units + pm.consumption_units) > 0
        THEN ROUND(
          (pm.write_off_units::numeric / (pm.write_off_units + pm.consumption_units)) * 100,
          1
        )::float8
        ELSE NULL::float8
      END AS waste_rate_pct,
      -- ratio to team average (NULL when team avg is zero / no data)
      CASE
        WHEN ta.avg_write_off_per_day_team > 0 AND pm.active_days > 0
          THEN ROUND((
            (pm.write_off_units::float8 / pm.active_days)
            / ta.avg_write_off_per_day_team
          )::numeric, 2)::float8
        WHEN ta.avg_write_off_per_day_team = 0 AND pm.write_off_units = 0
          THEN 1.0    -- everyone is at baseline when team has zero waste
        ELSE NULL::float8
      END AS rate_vs_avg
    FROM per_member pm
    CROSS JOIN team_avg ta
  )

  SELECT
    c.user_id,
    c.email,
    c.role,
    c.write_off_units,
    c.write_off_cost,
    c.breakage_units,
    c.theft_units,
    c.spoilage_units,
    c.consumption_units,
    c.consumption_logs,
    c.additions_logged,
    c.active_days,
    c.last_active_at,
    c.avg_wo_per_day                              AS avg_write_off_per_day,
    c.waste_rate_pct,
    COALESCE(c.rate_vs_avg, 1.0)                 AS write_off_rate_vs_team_avg,
    c.restock_requests_filed,
    c.stock_receives_processed,
    -- Outlier: ≥2.5× team average AND ≥3 write-off units
    (COALESCE(c.rate_vs_avg, 0) >= 2.5 AND c.write_off_units >= 3) AS is_outlier,
    -- Reason text (only when flagged)
    CASE WHEN COALESCE(c.rate_vs_avg, 0) >= 2.5 AND c.write_off_units >= 3 THEN
      CONCAT_WS(' · ',
        ROUND(COALESCE(c.rate_vs_avg, 0)::numeric, 1)::text || '× team avg write-off rate',
        CASE WHEN c.theft_units > 0 AND c.theft_units::float8 / NULLIF(c.write_off_units, 0) > 0.4
          THEN 'Theft is ' || ROUND((c.theft_units::numeric / NULLIF(c.write_off_units, 0)) * 100, 0)::text || '% of write-offs'
        END,
        CASE WHEN c.spoilage_units > 0 AND c.spoilage_units::float8 / NULLIF(c.write_off_units, 0) > 0.5
          THEN 'High spoilage rate (' || c.spoilage_units::text || ' units)'
        END
      )
    ELSE NULL
    END                                           AS outlier_reason

  FROM computed c
  ORDER BY
    -- Outliers first
    CASE WHEN COALESCE(c.rate_vs_avg, 0) >= 2.5 AND c.write_off_units >= 3 THEN 0 ELSE 1 END,
    -- Then by write-off cost descending
    c.write_off_cost DESC,
    c.email ASC;

END;
$$;

GRANT EXECUTE ON FUNCTION get_team_performance(int) TO authenticated;
