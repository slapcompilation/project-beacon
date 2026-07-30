-- Recovered from supabase_migrations version 20260722135543.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

CREATE OR REPLACE FUNCTION get_budget_vs_actual(p_year int DEFAULT NULL, p_month int DEFAULT NULL)
RETURNS TABLE (
  category_id uuid, category_name text, period_month date, allocated_amount numeric,
  actual_spend numeric, variance numeric, variance_pct numeric, spend_pct numeric, status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v_hotel_id uuid;
  v_month    date;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;
  v_month := DATE_TRUNC('month', MAKE_DATE(
    COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
    COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int), 1))::date;
  RETURN QUERY
  WITH
  proc_spend AS (
    SELECT COALESCE(c.id, NULL::uuid) AS category_id, COALESCE(c.name, 'Uncategorised') AS category_name,
           SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0)) AS spend
    FROM restock_receives rr
    JOIN restock_requests rreq ON rreq.id = rr.request_id
    JOIN product_variants pv   ON pv.id  = rreq.variant_id
    JOIN products p            ON p.id   = pv.product_id
    LEFT JOIN categories c      ON c.id   = p.category_id
    WHERE rr.hotel_id = v_hotel_id AND DATE_TRUNC('month', rr.received_at AT TIME ZONE 'UTC')::date = v_month
    GROUP BY c.id, c.name
  ),
  wo_spend AS (
    SELECT COALESCE(c.id, NULL::uuid) AS category_id, COALESCE(c.name, 'Uncategorised') AS category_name,
           SUM(ABS(sl.quantity_change) * COALESCE(pv.cost, 0)) AS spend
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products p          ON p.id  = pv.product_id
    LEFT JOIN categories c    ON c.id  = p.category_id
    WHERE sl.hotel_id = v_hotel_id AND sl.category IN ('Breakage', 'Theft', 'Spoilage')
      AND sl.is_revert = false AND DATE_TRUNC('month', sl.timestamp AT TIME ZONE 'UTC')::date = v_month
    GROUP BY c.id, c.name
  ),
  cat_universe AS (
    SELECT DISTINCT category_id, category_name FROM proc_spend
    UNION SELECT DISTINCT category_id, category_name FROM wo_spend
    UNION SELECT ba.category_id, COALESCE(cat.name, 'Uncategorised') AS category_name
          FROM budget_allocations ba LEFT JOIN categories cat ON cat.id = ba.category_id
          WHERE ba.hotel_id = v_hotel_id AND ba.period_month = v_month AND ba.category_id IS NOT NULL
  ),
  actual AS (
    SELECT cu.category_id, cu.category_name, COALESCE(ps.spend, 0) + COALESCE(ws.spend, 0) AS actual_spend
    FROM cat_universe cu
    LEFT JOIN proc_spend ps ON ps.category_id IS NOT DISTINCT FROM cu.category_id
    LEFT JOIN wo_spend   ws ON ws.category_id IS NOT DISTINCT FROM cu.category_id
  ),
  budgets AS (
    SELECT ba.category_id, ba.allocated_amount FROM budget_allocations ba
    WHERE ba.hotel_id = v_hotel_id AND ba.period_month = v_month AND ba.category_id IS NOT NULL
  )
  SELECT a.category_id, a.category_name, v_month AS period_month, b.allocated_amount, a.actual_spend,
         CASE WHEN b.allocated_amount IS NOT NULL THEN ROUND(b.allocated_amount - a.actual_spend, 2) ELSE NULL END AS variance,
         CASE WHEN b.allocated_amount > 0 THEN ROUND((b.allocated_amount - a.actual_spend) / b.allocated_amount * 100, 1) ELSE NULL END AS variance_pct,
         CASE WHEN b.allocated_amount > 0 THEN ROUND(a.actual_spend / b.allocated_amount * 100, 1) ELSE NULL END AS spend_pct,
         CASE WHEN b.allocated_amount IS NULL THEN 'unbudgeted'
              WHEN a.actual_spend > b.allocated_amount THEN 'over'
              WHEN a.actual_spend > b.allocated_amount * 0.85 THEN 'warning'
              ELSE 'on_track' END AS status
  FROM actual a
  LEFT JOIN budgets b ON b.category_id IS NOT DISTINCT FROM a.category_id
  WHERE a.actual_spend > 0 OR b.allocated_amount IS NOT NULL
  ORDER BY CASE WHEN b.allocated_amount IS NOT NULL AND a.actual_spend > b.allocated_amount THEN 0
                WHEN b.allocated_amount IS NOT NULL THEN 1 ELSE 2 END,
           COALESCE(a.actual_spend / NULLIF(b.allocated_amount, 0), 0) DESC,
           a.actual_spend DESC;
END;
$$;
