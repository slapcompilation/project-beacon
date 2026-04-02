-- Migration 088: Stocktake Variance Intelligence
-- Layer: Flow → Eye cross-layer synthesis
-- Palantir principle: auditability as a first-class feature.
--   After every stocktake, the operator must understand not just the
--   discrepancy, but WHY: explained (logged write-offs + receives) vs
--   unexplained (potential theft, ghost consumption, entry errors).
--
-- Math:
--   adjusted_expected = system_qty − write_offs_during + receives_during
--   unexplained       = counted_qty − adjusted_expected
--   negative unexplained = items vanished beyond what was logged (shrinkage signal)
--   positive unexplained = items appeared without a logged receive (surplus)
--
-- Functions:
--   get_stocktake_sessions(p_limit int)  — recent committed sessions with summary stats
--   get_stocktake_variance(p_session_id) — per-line variance breakdown for one session

SET search_path = public;

-- ── get_stocktake_sessions() ──────────────────────────────────────────────────
-- Returns most-recent committed sessions, newest first.
-- Includes summary counts so the operator can quickly see which session
-- had the most anomalies without opening every one.

CREATE OR REPLACE FUNCTION get_stocktake_sessions(
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  session_id           uuid,
  started_at           timestamptz,
  committed_at         timestamptz,
  duration_minutes     int,          -- NULL for unclosed sessions
  created_by_email     text,
  note                 text,
  total_lines          int,          -- total variants in session
  counted_lines        int,          -- variants actually counted (counted_qty not null)
  variance_items       int,          -- counted_qty != system_qty
  anomaly_items        int,          -- |unexplained_variance| >= 3 OR variance_cost >= 25
  total_variance_cost  numeric       -- sum of |unexplained| × unit_cost
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH sessions AS (
    SELECT
      ss.id             AS session_id,
      ss.started_at,
      ss.committed_at,
      EXTRACT(EPOCH FROM (ss.committed_at - ss.started_at))::int / 60 AS duration_minutes,
      p.email           AS created_by_email,
      ss.note
    FROM stocktake_sessions ss
    LEFT JOIN profiles p ON p.id = ss.created_by
    WHERE ss.hotel_id = v_hotel_id
      AND ss.status   = 'committed'
    ORDER BY ss.committed_at DESC NULLS LAST
    LIMIT p_limit
  ),
  -- ── For each session, compute write-offs and receives during the window ──────
  session_lines AS (
    SELECT
      sl2.session_id,
      sl2.variant_id,
      sl2.system_qty,
      sl2.counted_qty,
      -- write-offs during session window
      COALESCE((
        SELECT SUM(ABS(stl.quantity_change))
        FROM stock_logs stl
        WHERE stl.variant_id        = sl2.variant_id
          AND stl.hotel_id          = v_hotel_id
          AND stl.removal_category IN ('Breakage', 'Theft', 'Spoilage', 'Expired', 'Other')
          AND stl.is_revert         = false
          AND stl.timestamp        >= (SELECT started_at FROM sessions WHERE session_id = sl2.session_id)
          AND stl.timestamp        <  COALESCE(
                (SELECT committed_at FROM sessions WHERE session_id = sl2.session_id),
                NOW()
              )
      ), 0)                                                    AS write_offs_during,
      -- receives during session window
      COALESCE((
        SELECT SUM(rr.quantity_received)
        FROM restock_receives rr
        WHERE rr.variant_id  = sl2.variant_id
          AND rr.hotel_id    = v_hotel_id
          AND rr.received_at >= (SELECT started_at FROM sessions WHERE session_id = sl2.session_id)
          AND rr.received_at <  COALESCE(
                (SELECT committed_at FROM sessions WHERE session_id = sl2.session_id),
                NOW()
              )
      ), 0)                                                    AS receives_during,
      -- unit cost for variance valuation
      COALESCE(pv.cost, 0)                                     AS unit_cost
    FROM stocktake_lines sl2
    JOIN product_variants pv ON pv.id = sl2.variant_id
    WHERE sl2.hotel_id  = v_hotel_id
      AND sl2.session_id IN (SELECT session_id FROM sessions)
      AND sl2.counted_qty IS NOT NULL
  ),
  line_stats AS (
    SELECT
      sl.session_id,
      COUNT(*)                                                                      AS counted_lines,
      COUNT(*) FILTER (WHERE sl.counted_qty <> sl.system_qty)                      AS variance_items,
      -- unexplained = counted - (system - write_offs + receives)
      COUNT(*) FILTER (
        WHERE ABS(sl.counted_qty - (sl.system_qty - sl.write_offs_during + sl.receives_during)) >= 3
           OR ABS(sl.counted_qty - (sl.system_qty - sl.write_offs_during + sl.receives_during)) * sl.unit_cost >= 25
      )                                                                             AS anomaly_items,
      ROUND(SUM(
        ABS(sl.counted_qty - (sl.system_qty - sl.write_offs_during + sl.receives_during))
        * sl.unit_cost
      ), 2)                                                                         AS total_variance_cost
    FROM session_lines sl
    GROUP BY sl.session_id
  ),
  total_lines_cte AS (
    SELECT session_id, COUNT(*)::int AS total_lines
    FROM stocktake_lines
    WHERE hotel_id = v_hotel_id
      AND session_id IN (SELECT session_id FROM sessions)
    GROUP BY session_id
  )

  SELECT
    s.session_id,
    s.started_at,
    s.committed_at,
    s.duration_minutes,
    s.created_by_email,
    s.note,
    COALESCE(tl.total_lines, 0)::int         AS total_lines,
    COALESCE(ls.counted_lines, 0)::int       AS counted_lines,
    COALESCE(ls.variance_items, 0)::int      AS variance_items,
    COALESCE(ls.anomaly_items, 0)::int       AS anomaly_items,
    COALESCE(ls.total_variance_cost, 0)      AS total_variance_cost
  FROM sessions s
  LEFT JOIN line_stats      ls ON ls.session_id = s.session_id
  LEFT JOIN total_lines_cte tl ON tl.session_id = s.session_id
  ORDER BY s.committed_at DESC NULLS LAST;

END;
$$;

GRANT EXECUTE ON FUNCTION get_stocktake_sessions(int) TO authenticated;


-- ── get_stocktake_variance() ─────────────────────────────────────────────────
-- Returns one row per counted line in the session.
-- The key columns:
--   adjusted_expected  = system_qty − write_offs_during + receives_during
--   unexplained        = counted_qty − adjusted_expected
-- Only lines where counted_qty IS NOT NULL are returned.
-- Sorted: anomalies first, then by |unexplained| descending.

CREATE OR REPLACE FUNCTION get_stocktake_variance(
  p_session_id uuid
)
RETURNS TABLE (
  variant_id             uuid,
  variant_label          text,
  category_name          text,
  system_qty             int,      -- stock snapshot taken at session start
  counted_qty            int,      -- physical count recorded by staff
  write_offs_during      int,      -- logged removals during session window
  receives_during        int,      -- logged receives during session window
  raw_variance           int,      -- counted_qty − system_qty
  adjusted_expected      int,      -- system_qty − write_offs + receives
  unexplained_variance   int,      -- counted_qty − adjusted_expected
  variance_cost          numeric,  -- |unexplained_variance| × unit_cost
  is_anomaly             boolean,  -- |unexplained| ≥ 3 OR cost ≥ 25
  direction              text      -- 'surplus' | 'deficit' | 'exact'
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id   uuid;
  v_started_at timestamptz;
  v_closed_at  timestamptz;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  -- Validate session belongs to this hotel
  SELECT ss.started_at, COALESCE(ss.committed_at, NOW())
    INTO v_started_at, v_closed_at
    FROM stocktake_sessions ss
   WHERE ss.id = p_session_id AND ss.hotel_id = v_hotel_id;

  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  WITH

  -- ── Write-offs per variant during session window ───────────────────────────
  wo AS (
    SELECT
      stl.variant_id,
      SUM(ABS(stl.quantity_change))::int AS units
    FROM stock_logs stl
    WHERE stl.hotel_id          = v_hotel_id
      AND stl.removal_category IN ('Breakage', 'Theft', 'Spoilage', 'Expired', 'Other')
      AND stl.is_revert         = false
      AND stl.timestamp        >= v_started_at
      AND stl.timestamp        <  v_closed_at
    GROUP BY stl.variant_id
  ),

  -- ── Receives per variant during session window ────────────────────────────
  recv AS (
    SELECT
      rr.variant_id,
      SUM(rr.quantity_received)::int AS units
    FROM restock_receives rr
    WHERE rr.hotel_id    = v_hotel_id
      AND rr.received_at >= v_started_at
      AND rr.received_at <  v_closed_at
    GROUP BY rr.variant_id
  )

  SELECT
    pv.id                                                                            AS variant_id,
    pr.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END   AS variant_label,
    c.name                                                                           AS category_name,

    sl.system_qty,
    sl.counted_qty,

    COALESCE(wo.units, 0)                                                            AS write_offs_during,
    COALESCE(recv.units, 0)                                                          AS receives_during,

    -- raw variance: positive = counted more than expected at start
    (sl.counted_qty - sl.system_qty)                                                 AS raw_variance,

    -- adjusted expectation accounts for legitimate movement during the count
    (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))               AS adjusted_expected,

    -- unexplained gap: what the system cannot account for
    (sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0)))
                                                                                     AS unexplained_variance,

    ROUND(
      ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0)))
      * COALESCE(pv.cost, 0),
      2
    )                                                                                AS variance_cost,

    -- anomaly: missing ≥3 units OR ≥$25 unexplained
    (
      ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))) >= 3
      OR
      ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0)))
        * COALESCE(pv.cost, 0) >= 25
    )                                                                                AS is_anomaly,

    CASE
      WHEN (sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))) < 0
        THEN 'deficit'
      WHEN (sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))) > 0
        THEN 'surplus'
      ELSE 'exact'
    END                                                                              AS direction

  FROM stocktake_lines sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr          ON pr.id = pv.product_id
  LEFT JOIN categories c    ON c.id  = pr.category_id
  LEFT JOIN wo              ON wo.variant_id  = sl.variant_id
  LEFT JOIN recv            ON recv.variant_id = sl.variant_id

  WHERE sl.session_id  = p_session_id
    AND sl.hotel_id    = v_hotel_id
    AND sl.counted_qty IS NOT NULL

  ORDER BY
    -- anomalies first, then largest unexplained gap, then biggest raw variance
    (ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))) >= 3
      OR ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0)))
           * COALESCE(pv.cost, 0) >= 25) DESC,
    ABS(sl.counted_qty - (sl.system_qty - COALESCE(wo.units, 0) + COALESCE(recv.units, 0))) DESC,
    ABS(sl.counted_qty - sl.system_qty) DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION get_stocktake_variance(uuid) TO authenticated;
