-- Migration 087: Cost Per Occupied Room (CPOR) Intelligence
-- Layer: Mind — Financial intelligence
-- Palantir principle: cross-domain synthesis.
--   restock_receives + stock_logs + occupancy_logs + categories
--   → per-period CPOR, category cost breakdown, waste share, MoM change.
--
-- CPOR = (procurement spend + write-off cost) / occupied room nights
-- This is the fundamental hotel economics KPI: what does running this
-- hotel cost per room per night?
--
-- Functions:
--   get_cpor_by_period(p_window_months)  — monthly CPOR trend with MoM delta
--   get_cost_by_category(p_window_days) — category spend + waste breakdown

SET search_path = public;

-- ── get_cpor_by_period() ──────────────────────────────────────────────────────
-- Returns one row per complete calendar month in the window.
-- CPOR is null for periods with no occupancy data (shown as "—" in UI).
-- prev_period_cpor and cpor_change_pct enable MoM comparison.

CREATE OR REPLACE FUNCTION get_cpor_by_period(
  p_window_months int DEFAULT 3
)
RETURNS TABLE (
  period_start         date,
  period_label         text,       -- e.g. "Mar 2026"
  procurement_spend    numeric,    -- received stock cost in period
  write_off_cost       numeric,    -- Breakage + Theft + Spoilage cost in period
  total_cost           numeric,    -- procurement + write_offs
  occupied_room_nights int,        -- null when no occupancy log entries
  avg_occupancy_pct    numeric,    -- null when no occupancy log entries
  cpor                 numeric,    -- total_cost / occupied_room_nights; null when no occ data
  prev_period_cpor     numeric,    -- prior month CPOR for delta computation
  cpor_change_pct      numeric     -- (cpor - prev) / prev × 100; null when either is null
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id    uuid;
  v_window_start date;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  -- Start of the earliest month in the window (inclusive)
  v_window_start := DATE_TRUNC(
    'month',
    CURRENT_DATE - ((p_window_months - 1) || ' months')::interval
  )::date;

  RETURN QUERY
  WITH

  -- ── Generate one row per calendar month in window ──────────────────────────
  periods AS (
    SELECT gs::date AS period_start
    FROM generate_series(
      v_window_start,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      INTERVAL '1 month'
    ) gs
  ),

  -- ── Procurement spend: quantity_received × unit_cost per receive ───────────
  -- Falls back to product_variants.cost when unit_cost is not recorded
  proc AS (
    SELECT
      DATE_TRUNC('month', rrecv.received_at AT TIME ZONE 'UTC')::date AS period_start,
      SUM(rrecv.quantity_received
          * COALESCE(rrecv.unit_cost, pv.cost, 0))                     AS spend
    FROM restock_receives rrecv
    JOIN product_variants pv ON pv.id = rrecv.variant_id
    WHERE rrecv.hotel_id    = v_hotel_id
      AND rrecv.received_at >= v_window_start
    GROUP BY 1
  ),

  -- ── Write-off cost: Breakage + Theft + Spoilage at variant.cost ───────────
  wo AS (
    SELECT
      DATE_TRUNC('month', sl.timestamp AT TIME ZONE 'UTC')::date    AS period_start,
      SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0))           AS cost
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY 1
  ),

  -- ── Occupancy: sum occupied room nights per month ─────────────────────────
  -- Prefers occupied_rooms when available; falls back to pct × total_rooms
  occ AS (
    SELECT
      DATE_TRUNC('month', ol.date)::date               AS period_start,
      SUM(
        COALESCE(
          ol.occupied_rooms,
          ROUND(ol.occupancy_pct / 100.0
                * COALESCE(ol.total_rooms, 0))
        )
      )::int                                            AS occupied_room_nights,
      ROUND(AVG(ol.occupancy_pct)::numeric, 1)          AS avg_occupancy_pct
    FROM occupancy_logs ol
    WHERE ol.hotel_id = v_hotel_id
      AND ol.date    >= v_window_start
    GROUP BY 1
  ),

  -- ── Join all sources onto the period spine ────────────────────────────────
  assembled AS (
    SELECT
      p.period_start,
      TO_CHAR(p.period_start, 'Mon YYYY')              AS period_label,
      COALESCE(pr.spend, 0)                            AS procurement_spend,
      COALESCE(w.cost, 0)                              AS write_off_cost,
      COALESCE(pr.spend, 0) + COALESCE(w.cost, 0)     AS total_cost,
      o.occupied_room_nights,
      o.avg_occupancy_pct,
      CASE
        WHEN COALESCE(o.occupied_room_nights, 0) > 0
        THEN ROUND(
          (COALESCE(pr.spend, 0) + COALESCE(w.cost, 0))
          / o.occupied_room_nights::numeric,
          2
        )
        ELSE NULL
      END                                              AS cpor
    FROM periods p
    LEFT JOIN proc pr ON pr.period_start = p.period_start
    LEFT JOIN wo   w  ON w.period_start  = p.period_start
    LEFT JOIN occ  o  ON o.period_start  = p.period_start
  )

  SELECT
    a.period_start,
    a.period_label,
    a.procurement_spend,
    a.write_off_cost,
    a.total_cost,
    a.occupied_room_nights,
    a.avg_occupancy_pct,
    a.cpor,
    -- Prior period CPOR for MoM comparison
    LAG(a.cpor) OVER (ORDER BY a.period_start)                         AS prev_period_cpor,
    -- % change: positive = higher cost per room (unfavourable), negative = improvement
    CASE
      WHEN LAG(a.cpor) OVER (ORDER BY a.period_start) > 0
        AND a.cpor IS NOT NULL
      THEN ROUND(
        (a.cpor - LAG(a.cpor) OVER (ORDER BY a.period_start))
        / LAG(a.cpor) OVER (ORDER BY a.period_start) * 100,
        1
      )
      ELSE NULL
    END                                                                AS cpor_change_pct
  FROM assembled a
  ORDER BY a.period_start;

END;
$$;

GRANT EXECUTE ON FUNCTION get_cpor_by_period(int) TO authenticated;

-- ── get_cost_by_category() ────────────────────────────────────────────────────
-- Returns per-category spend and waste breakdown for a rolling window.
-- Uncategorised items are grouped as 'Uncategorised'.
-- Sorted by total_cost DESC — biggest cost categories first.

CREATE OR REPLACE FUNCTION get_cost_by_category(
  p_window_days int DEFAULT 90
)
RETURNS TABLE (
  category_id       uuid,
  category_name     text,
  procurement_spend numeric,
  write_off_cost    numeric,
  total_cost        numeric,
  cost_pct_of_total numeric,   -- 0–100; this category as % of all-category total
  waste_rate_pct    numeric    -- write_off / (procurement + write_off) × 100; null if no spend
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH
  window_ts AS (
    SELECT NOW() - (p_window_days || ' days')::interval AS ts
  ),

  -- ── Procurement by category ───────────────────────────────────────────────
  proc_cat AS (
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      SUM(rrecv.quantity_received
          * COALESCE(rrecv.unit_cost, pv.cost, 0))    AS spend
    FROM restock_receives rrecv
    JOIN product_variants pv ON pv.id = rrecv.variant_id
    JOIN products p           ON p.id  = pv.product_id
    LEFT JOIN categories c    ON c.id  = p.category_id
    WHERE rrecv.hotel_id    = v_hotel_id
      AND rrecv.received_at >= (SELECT ts FROM window_ts)
    GROUP BY c.id, c.name
  ),

  -- ── Write-offs by category ────────────────────────────────────────────────
  wo_cat AS (
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)) AS cost
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products p           ON p.id  = pv.product_id
    LEFT JOIN categories c    ON c.id  = p.category_id
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND sl.is_revert          = false
      AND sl.timestamp         >= (SELECT ts FROM window_ts)
    GROUP BY c.id, c.name
  ),

  -- ── Union category universe then left-join spend ─────────────────────────
  cat_universe AS (
    SELECT DISTINCT category_id, category_name FROM proc_cat
    UNION
    SELECT DISTINCT category_id, category_name FROM wo_cat
  ),
  assembled AS (
    SELECT
      cu.category_id,
      COALESCE(cu.category_name, 'Uncategorised')      AS category_name,
      COALESCE(p.spend, 0)                              AS procurement_spend,
      COALESCE(w.cost, 0)                               AS write_off_cost,
      COALESCE(p.spend, 0) + COALESCE(w.cost, 0)       AS total_cost
    FROM cat_universe cu
    LEFT JOIN proc_cat p
      ON p.category_id IS NOT DISTINCT FROM cu.category_id
    LEFT JOIN wo_cat w
      ON w.category_id IS NOT DISTINCT FROM cu.category_id
  ),
  grand AS (
    SELECT NULLIF(SUM(total_cost), 0) AS total FROM assembled
  )

  SELECT
    a.category_id,
    a.category_name,
    a.procurement_spend,
    a.write_off_cost,
    a.total_cost,
    ROUND(a.total_cost / (SELECT total FROM grand) * 100, 1) AS cost_pct_of_total,
    CASE
      WHEN (a.procurement_spend + a.write_off_cost) > 0
      THEN ROUND(
        a.write_off_cost / (a.procurement_spend + a.write_off_cost) * 100,
        1
      )
      ELSE NULL
    END                                                       AS waste_rate_pct
  FROM assembled a
  WHERE a.total_cost > 0
  ORDER BY a.total_cost DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION get_cost_by_category(int) TO authenticated;
