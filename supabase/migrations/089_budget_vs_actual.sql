-- Migration 089: Budget vs Actual Tracker
-- Layer: Mind — Financial intelligence
-- Palantir principle: decision support, not data display.
--   Knowing you spent $4,200 last month is data.
--   Knowing you're 18% over the F&B budget with 12 days remaining is a decision.
--
-- budget_allocations stores per-category monthly targets.
-- category_id NULL = the hotel-level total budget (aggregate guard).
--
-- Functions:
--   get_budget_vs_actual(p_year, p_month) — current month status per category
--   get_budget_trend(p_months_back)       — rolling adherence trend
--   upsert_budget_allocation(...)         — set/update a category budget
--   delete_budget_allocation(...)         — remove a category budget

SET search_path = public;

-- ── budget_allocations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budget_allocations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category_id      uuid        REFERENCES categories(id) ON DELETE SET NULL,
  period_month     date        NOT NULL,    -- always first day of month
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Two partial unique indexes handle NULL category_id correctly
-- (NULL != NULL in SQL, so a plain UNIQUE on the column wouldn't enforce one-per-null-category)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_unique_category
  ON budget_allocations (hotel_id, category_id, period_month)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_unique_null_category
  ON budget_allocations (hotel_id, period_month)
  WHERE category_id IS NULL;

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_select" ON budget_allocations FOR SELECT USING (hotel_id = auth_hotel_id());
CREATE POLICY "budget_insert" ON budget_allocations FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());
CREATE POLICY "budget_update" ON budget_allocations FOR UPDATE USING (hotel_id = auth_hotel_id());
CREATE POLICY "budget_delete" ON budget_allocations FOR DELETE USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_budget_hotel_month ON budget_allocations (hotel_id, period_month);

COMMENT ON TABLE budget_allocations IS
  'Per-category monthly spend targets. category_id NULL = hotel-level total budget.';

-- ── upsert_budget_allocation() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_budget_allocation(
  p_category_id      uuid,       -- NULL for hotel-level budget
  p_period_month     date,       -- any date in the target month; will be truncated
  p_allocated_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_hotel_id  uuid := auth_hotel_id();
  v_month     date := DATE_TRUNC('month', p_period_month)::date;
  v_id        uuid;
BEGIN
  -- Try UPDATE first (handles both NULL and non-NULL category_id)
  UPDATE budget_allocations
     SET allocated_amount = p_allocated_amount, updated_at = now()
   WHERE hotel_id    = v_hotel_id
     AND period_month = v_month
     AND (category_id = p_category_id OR (category_id IS NULL AND p_category_id IS NULL))
  RETURNING id INTO v_id;

  -- INSERT if no existing row matched
  IF v_id IS NULL THEN
    INSERT INTO budget_allocations (hotel_id, category_id, period_month, allocated_amount)
    VALUES (v_hotel_id, p_category_id, v_month, p_allocated_amount)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_budget_allocation(uuid, date, numeric) TO authenticated;

-- ── delete_budget_allocation() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_budget_allocation(
  p_category_id  uuid,
  p_period_month date
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_month    date := DATE_TRUNC('month', p_period_month)::date;
BEGIN
  DELETE FROM budget_allocations
  WHERE hotel_id    = v_hotel_id
    AND period_month = v_month
    AND (
      (p_category_id IS NULL AND category_id IS NULL)
      OR category_id = p_category_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_budget_allocation(uuid, date) TO authenticated;

-- ── get_budget_vs_actual() ────────────────────────────────────────────────────
-- Returns one row per category that had either spend or a budget in the target month.
-- actual_spend = procurement receives + write-offs for that calendar month.
-- status: 'over' | 'warning' | 'on_track' | 'unbudgeted'
--   over      = actual > allocated
--   warning   = actual > allocated * 0.85
--   on_track  = actual <= allocated * 0.85
--   unbudgeted = no budget set for this category

CREATE OR REPLACE FUNCTION get_budget_vs_actual(
  p_year  int DEFAULT NULL,   -- NULL = current year
  p_month int DEFAULT NULL    -- NULL = current month
)
RETURNS TABLE (
  category_id       uuid,
  category_name     text,
  period_month      date,
  allocated_amount  numeric,   -- NULL = no budget set
  actual_spend      numeric,
  variance          numeric,   -- allocated - actual; NULL if unbudgeted
  variance_pct      numeric,   -- variance / allocated * 100; NULL if unbudgeted
  spend_pct         numeric,   -- actual / allocated * 100 (for progress bar); NULL if unbudgeted
  status            text       -- 'over' | 'warning' | 'on_track' | 'unbudgeted'
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
  v_month    date;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  v_month := DATE_TRUNC('month', MAKE_DATE(
    COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
    COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
    1
  ))::date;

  RETURN QUERY
  WITH

  -- ── Procurement spend this month ───────────────────────────────────────────
  proc_spend AS (
    SELECT
      COALESCE(c.id,   NULL::uuid) AS category_id,
      COALESCE(c.name, 'Uncategorised') AS category_name,
      SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0)) AS spend
    FROM restock_receives rr
    JOIN product_variants pv ON pv.id = rr.variant_id
    JOIN products p           ON p.id  = pv.product_id
    LEFT JOIN categories c    ON c.id  = p.category_id
    WHERE rr.hotel_id    = v_hotel_id
      AND DATE_TRUNC('month', rr.received_at AT TIME ZONE 'UTC')::date = v_month
    GROUP BY c.id, c.name
  ),

  -- ── Write-off cost this month ─────────────────────────────────────────────
  wo_spend AS (
    SELECT
      COALESCE(c.id,   NULL::uuid) AS category_id,
      COALESCE(c.name, 'Uncategorised') AS category_name,
      SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)) AS spend
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products p           ON p.id  = pv.product_id
    LEFT JOIN categories c    ON c.id  = p.category_id
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND sl.is_revert          = false
      AND DATE_TRUNC('month', sl.timestamp AT TIME ZONE 'UTC')::date = v_month
    GROUP BY c.id, c.name
  ),

  -- ── Category universe (spend + budgets) ───────────────────────────────────
  cat_universe AS (
    SELECT DISTINCT category_id, category_name FROM proc_spend
    UNION
    SELECT DISTINCT category_id, category_name FROM wo_spend
    UNION
    SELECT
      ba.category_id,
      COALESCE(cat.name, 'Uncategorised') AS category_name
    FROM budget_allocations ba
    LEFT JOIN categories cat ON cat.id = ba.category_id
    WHERE ba.hotel_id    = v_hotel_id
      AND ba.period_month = v_month
      AND ba.category_id IS NOT NULL   -- exclude hotel-level from per-category list
  ),

  -- ── Actual spend = procurement + write-offs ───────────────────────────────
  actual AS (
    SELECT
      cu.category_id,
      cu.category_name,
      COALESCE(ps.spend, 0) + COALESCE(ws.spend, 0) AS actual_spend
    FROM cat_universe cu
    LEFT JOIN proc_spend ps ON ps.category_id IS NOT DISTINCT FROM cu.category_id
    LEFT JOIN wo_spend   ws ON ws.category_id IS NOT DISTINCT FROM cu.category_id
  ),

  -- ── Budget for each category ───────────────────────────────────────────────
  budgets AS (
    SELECT ba.category_id, ba.allocated_amount
    FROM budget_allocations ba
    WHERE ba.hotel_id    = v_hotel_id
      AND ba.period_month = v_month
      AND ba.category_id IS NOT NULL
  )

  SELECT
    a.category_id,
    a.category_name,
    v_month                                                     AS period_month,
    b.allocated_amount,
    a.actual_spend,
    -- variance: positive = under budget (good), negative = over (bad)
    CASE WHEN b.allocated_amount IS NOT NULL
         THEN ROUND(b.allocated_amount - a.actual_spend, 2)
         ELSE NULL END                                          AS variance,
    CASE WHEN b.allocated_amount > 0
         THEN ROUND((b.allocated_amount - a.actual_spend) / b.allocated_amount * 100, 1)
         ELSE NULL END                                          AS variance_pct,
    CASE WHEN b.allocated_amount > 0
         THEN ROUND(a.actual_spend / b.allocated_amount * 100, 1)
         ELSE NULL END                                          AS spend_pct,
    CASE
      WHEN b.allocated_amount IS NULL               THEN 'unbudgeted'
      WHEN a.actual_spend > b.allocated_amount      THEN 'over'
      WHEN a.actual_spend > b.allocated_amount * 0.85 THEN 'warning'
      ELSE                                               'on_track'
    END                                                         AS status
  FROM actual a
  LEFT JOIN budgets b ON b.category_id IS NOT DISTINCT FROM a.category_id
  WHERE a.actual_spend > 0 OR b.allocated_amount IS NOT NULL
  ORDER BY
    -- over budget first, then by spend pct desc, then unbudgeted by actual desc
    CASE WHEN b.allocated_amount IS NOT NULL AND a.actual_spend > b.allocated_amount THEN 0
         WHEN b.allocated_amount IS NOT NULL THEN 1
         ELSE 2 END,
    COALESCE(a.actual_spend / NULLIF(b.allocated_amount, 0), 0) DESC,
    a.actual_spend DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION get_budget_vs_actual(int, int) TO authenticated;

-- ── get_budget_trend() ────────────────────────────────────────────────────────
-- Rolling monthly summary: how well the hotel stayed within budget overall.

CREATE OR REPLACE FUNCTION get_budget_trend(
  p_months_back int DEFAULT 6
)
RETURNS TABLE (
  period_month            date,
  period_label            text,
  total_budgeted          numeric,    -- sum of all category budgets; NULL if no budgets set
  total_actual            numeric,
  categories_over_budget  int,
  spend_pct               numeric,    -- total_actual / total_budgeted * 100; NULL if no budgets
  on_track                boolean     -- actual <= budgeted; NULL if no budgets
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id    uuid;
  v_window_start date;
BEGIN
  v_hotel_id    := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  v_window_start := DATE_TRUNC('month', CURRENT_DATE - ((p_months_back - 1) || ' months')::interval)::date;

  RETURN QUERY
  WITH months AS (
    SELECT gs::date AS period_month
    FROM generate_series(v_window_start, DATE_TRUNC('month', CURRENT_DATE)::date, INTERVAL '1 month') gs
  ),
  monthly_actual AS (
    SELECT
      DATE_TRUNC('month', rr.received_at AT TIME ZONE 'UTC')::date AS period_month,
      SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0)) AS proc_spend
    FROM restock_receives rr
    JOIN product_variants pv ON pv.id = rr.variant_id
    WHERE rr.hotel_id    = v_hotel_id
      AND rr.received_at >= v_window_start
    GROUP BY 1
  ),
  monthly_wo AS (
    SELECT
      DATE_TRUNC('month', sl.timestamp AT TIME ZONE 'UTC')::date AS period_month,
      SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)) AS wo_spend
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY 1
  ),
  monthly_budget AS (
    SELECT
      ba.period_month,
      SUM(ba.allocated_amount) AS total_budgeted
    FROM budget_allocations ba
    WHERE ba.hotel_id    = v_hotel_id
      AND ba.period_month >= v_window_start
      AND ba.category_id IS NOT NULL
    GROUP BY ba.period_month
  ),
  over_count AS (
    SELECT
      ba.period_month,
      COUNT(*) FILTER (
        WHERE (
          COALESCE((SELECT SUM(rr2.quantity_received * COALESCE(rr2.unit_cost, pv2.cost, 0))
                    FROM restock_receives rr2
                    JOIN product_variants pv2 ON pv2.id = rr2.variant_id
                    JOIN products p2          ON p2.id  = pv2.product_id
                    WHERE p2.category_id = ba.category_id
                      AND rr2.hotel_id   = v_hotel_id
                      AND DATE_TRUNC('month', rr2.received_at AT TIME ZONE 'UTC')::date = ba.period_month
                   ), 0) +
          COALESCE((SELECT SUM(ABS(sl2.quantity_change) * COALESCE(pv2b.cost, 0))
                    FROM stock_logs sl2
                    JOIN product_variants pv2b ON pv2b.id = sl2.variant_id
                    JOIN products p2b          ON p2b.id  = pv2b.product_id
                    WHERE p2b.category_id = ba.category_id
                      AND sl2.hotel_id   = v_hotel_id
                      AND sl2.removal_category IN ('Breakage','Theft','Spoilage')
                      AND sl2.is_revert  = false
                      AND DATE_TRUNC('month', sl2.timestamp AT TIME ZONE 'UTC')::date = ba.period_month
                   ), 0)
        ) > ba.allocated_amount
      )::int AS over_count
    FROM budget_allocations ba
    WHERE ba.hotel_id   = v_hotel_id
      AND ba.period_month >= v_window_start
      AND ba.category_id IS NOT NULL
    GROUP BY ba.period_month
  )

  SELECT
    m.period_month,
    TO_CHAR(m.period_month, 'Mon YYYY')                   AS period_label,
    mb.total_budgeted,
    COALESCE(ma.proc_spend, 0) + COALESCE(mw.wo_spend, 0) AS total_actual,
    COALESCE(oc.over_count, 0)::int                        AS categories_over_budget,
    CASE WHEN mb.total_budgeted > 0
         THEN ROUND((COALESCE(ma.proc_spend,0) + COALESCE(mw.wo_spend,0))
                    / mb.total_budgeted * 100, 1)
         ELSE NULL END                                     AS spend_pct,
    CASE WHEN mb.total_budgeted IS NOT NULL
         THEN (COALESCE(ma.proc_spend,0) + COALESCE(mw.wo_spend,0)) <= mb.total_budgeted
         ELSE NULL END                                     AS on_track
  FROM months m
  LEFT JOIN monthly_actual ma ON ma.period_month = m.period_month
  LEFT JOIN monthly_wo     mw ON mw.period_month = m.period_month
  LEFT JOIN monthly_budget mb ON mb.period_month = m.period_month
  LEFT JOIN over_count     oc ON oc.period_month = m.period_month
  ORDER BY m.period_month;

END;
$$;

GRANT EXECUTE ON FUNCTION get_budget_trend(int) TO authenticated;
