-- Migration 062: Supplier Intelligence — Mind Layer
-- Layer: Mind → surfaces supplier data for negotiation leverage
-- Builds on: variant_cost_history (013), restock_receives (038/058),
--            product_batches.supplier_id (058), fan_out_alert (061)
--
-- Functions:
--   1. get_price_drift()            — variants whose cost shifted >N% over a window
--   2. get_spend_concentration()    — supplier spend as % of total received spend
--   3. get_supplier_expiry_rates()  — % of each supplier's batches that expired with stock
--   4. get_price_variance_by_supplier() — avg invoice price vs cost baseline per supplier
--   5. get_spend_forecast()         — 30/60/90-day forward spend projection
--   6. detect_and_alert_price_drift()   — cron-callable; fan_out_alert for admin+ on drift
--
-- Notification type: adds 'price_drift' to the type constraint.

SET search_path = public;

-- ─── 1. price_drift notification type ────────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'low_stock', 'expiry', 'approval', 'system',
    'predicted_outage', 'waste_alert', 'consumption_spike', 'price_drift'
  ));

-- ─── 2. get_price_drift() ─────────────────────────────────────────────────────
-- For each enabled variant, compare the most recent cost in variant_cost_history
-- against the cost on record at or before p_window_months ago.
-- Only returns rows where the absolute % change ≥ p_threshold_pct.
-- Sort: largest absolute drift first — biggest negotiating signal at top.

CREATE OR REPLACE FUNCTION get_price_drift(
  p_window_months integer DEFAULT 6,
  p_threshold_pct numeric  DEFAULT 5
)
RETURNS TABLE (
  variant_id   uuid,
  product_name text,
  variant_name text,
  cost_then    numeric,      -- cost at or before the window start
  cost_now     numeric,      -- most recent cost
  pct_change   numeric,      -- positive = more expensive; negative = cheaper
  direction    text,         -- 'up' | 'down'
  last_changed timestamptz   -- when cost_now was recorded
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id                                                              AS variant_id,
    pr.name                                                            AS product_name,
    pv.name                                                            AS variant_name,
    old_c.cost                                                         AS cost_then,
    new_c.cost                                                         AS cost_now,
    ROUND(
      (new_c.cost - old_c.cost) / NULLIF(old_c.cost, 0) * 100,
      1
    )                                                                  AS pct_change,
    CASE WHEN new_c.cost >= old_c.cost THEN 'up' ELSE 'down' END       AS direction,
    new_c.effective_from                                               AS last_changed
  FROM product_variants pv
  JOIN products pr ON pr.id = pv.product_id
  -- Current cost: most recent row in cost history
  JOIN LATERAL (
    SELECT cost, effective_from
    FROM variant_cost_history
    WHERE variant_id = pv.id
      AND hotel_id   = auth_hotel_id()
    ORDER BY effective_from DESC
    LIMIT 1
  ) new_c ON TRUE
  -- Historical baseline: most recent row at or before window start
  JOIN LATERAL (
    SELECT cost
    FROM variant_cost_history
    WHERE variant_id     = pv.id
      AND hotel_id       = auth_hotel_id()
      AND effective_from <= NOW() - make_interval(months => p_window_months)
    ORDER BY effective_from DESC
    LIMIT 1
  ) old_c ON TRUE
  WHERE pr.hotel_id = auth_hotel_id()
    AND pv.enabled  = true
    AND ABS(
      (new_c.cost - old_c.cost) / NULLIF(old_c.cost, 0) * 100
    ) >= p_threshold_pct
  ORDER BY
    ABS((new_c.cost - old_c.cost) / NULLIF(old_c.cost, 0) * 100) DESC
$$;

GRANT EXECUTE ON FUNCTION get_price_drift(integer, numeric) TO authenticated;

-- ─── 3. get_spend_concentration() ────────────────────────────────────────────
-- Groups actual received spend by supplier over the window.
-- Uses restock_receives.unit_cost × quantity_received as the spend signal —
-- the same source used by get_spend_trend() for actual_fulfilled.
-- Supplier identity: supplier_id FK (preferred) → rr.supplier text → '(Unattributed)'.
-- pct_of_total is computed as a window function so the caller can build charts.

CREATE OR REPLACE FUNCTION get_spend_concentration(p_months integer DEFAULT 6)
RETURNS TABLE (
  supplier_id   uuid,
  supplier_name text,
  total_spend   numeric,
  pct_of_total  numeric,   -- 0–100; rounded to 1 dp
  order_count   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH spend_lines AS (
    SELECT
      rec.supplier_id,
      COALESCE(s.name, rr.supplier, '(Unattributed)')         AS supplier_name,
      rec.quantity_received * COALESCE(rec.unit_cost, 0)       AS line_spend,
      rec.request_id
    FROM restock_receives rec
    LEFT JOIN restock_requests rr ON rr.id  = rec.request_id
    LEFT JOIN suppliers        s  ON s.id   = rec.supplier_id
    WHERE rec.hotel_id    = auth_hotel_id()
      AND rec.received_at >= NOW() - make_interval(months => p_months)
  ),
  grouped AS (
    SELECT
      supplier_id,
      supplier_name,
      SUM(line_spend)             AS total_spend,
      COUNT(DISTINCT request_id)  AS order_count
    FROM spend_lines
    GROUP BY supplier_id, supplier_name
  )
  SELECT
    supplier_id,
    supplier_name,
    ROUND(total_spend, 2)                                                    AS total_spend,
    ROUND(
      total_spend * 100.0 / NULLIF(SUM(total_spend) OVER (), 0),
      1
    )                                                                        AS pct_of_total,
    order_count
  FROM grouped
  ORDER BY total_spend DESC
$$;

GRANT EXECUTE ON FUNCTION get_spend_concentration(integer) TO authenticated;

-- ─── 4. get_supplier_expiry_rates() ──────────────────────────────────────────
-- For each supplier (with at least one tracked batch in the window), calculates
-- what fraction of batches that had an expiry date still held stock after
-- expiry_date passed — the "expired with remaining stock" signal.
-- A high rate indicates short-shelf-life product, over-ordering, or poor rotation.

CREATE OR REPLACE FUNCTION get_supplier_expiry_rates(p_days integer DEFAULT 180)
RETURNS TABLE (
  supplier_id          uuid,
  supplier_name        text,
  batches_received     bigint,
  batches_with_expiry  bigint,
  batches_expired      bigint,   -- had stock on hand past expiry_date
  expiry_rate_pct      numeric,  -- pct of expiry-tracked batches that expired with stock
  units_expired        bigint,
  cost_expired         numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id                                                                     AS supplier_id,
    s.name                                                                   AS supplier_name,
    COUNT(pb.id)                                                             AS batches_received,
    COUNT(pb.id) FILTER (WHERE pb.expiry_date IS NOT NULL)                   AS batches_with_expiry,
    COUNT(pb.id) FILTER (
      WHERE pb.expiry_date IS NOT NULL
        AND pb.expiry_date < CURRENT_DATE
        AND pb.quantity    > 0
    )                                                                        AS batches_expired,
    ROUND(
      100.0
        * COUNT(pb.id) FILTER (
            WHERE pb.expiry_date IS NOT NULL
              AND pb.expiry_date < CURRENT_DATE
              AND pb.quantity    > 0
          )
        / NULLIF(
            COUNT(pb.id) FILTER (WHERE pb.expiry_date IS NOT NULL),
            0
          ),
      1
    )                                                                        AS expiry_rate_pct,
    COALESCE(
      SUM(pb.quantity) FILTER (
        WHERE pb.expiry_date IS NOT NULL
          AND pb.expiry_date < CURRENT_DATE
          AND pb.quantity    > 0
      ), 0
    )                                                                        AS units_expired,
    COALESCE(
      SUM(pb.quantity * COALESCE(pv.cost, 0)) FILTER (
        WHERE pb.expiry_date IS NOT NULL
          AND pb.expiry_date < CURRENT_DATE
          AND pb.quantity    > 0
      ), 0
    )                                                                        AS cost_expired
  FROM suppliers s
  JOIN product_batches  pb ON pb.supplier_id = s.id
  JOIN product_variants pv ON pv.id          = pb.variant_id
  WHERE s.hotel_id       = auth_hotel_id()
    AND pb.received_at  >= NOW() - (p_days || ' days')::interval
  GROUP BY s.id, s.name
  HAVING COUNT(pb.id) > 0
  ORDER BY expiry_rate_pct DESC NULLS LAST, units_expired DESC
$$;

GRANT EXECUTE ON FUNCTION get_supplier_expiry_rates(integer) TO authenticated;

-- ─── 5. get_price_variance_by_supplier() ─────────────────────────────────────
-- Aggregates invoice price variance by supplier — the "are they charging what
-- we agreed?" signal.  Only includes receive lines where:
--   - supplier_id is set (unattributed lines are excluded — not actionable)
--   - unit_cost was recorded at receiving
--   - the variant has a cost baseline in product_variants.cost
-- avg_variance_pct: positive = being overcharged on average vs cost baseline.
-- total_overcharge: sum of (actual − expected) × qty for positive-variance lines.
-- total_savings:    sum of (expected − actual) × qty for negative-variance lines.

CREATE OR REPLACE FUNCTION get_price_variance_by_supplier(p_days integer DEFAULT 90)
RETURNS TABLE (
  supplier_id      uuid,
  supplier_name    text,
  receive_count    bigint,
  avg_variance_pct numeric,   -- positive = overcharged vs cost baseline
  total_overcharge numeric,   -- total extra spend vs baseline
  total_savings    numeric    -- total below-baseline savings
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id                                                                     AS supplier_id,
    s.name                                                                   AS supplier_name,
    COUNT(*)                                                                 AS receive_count,
    ROUND(
      AVG((rec.unit_cost - pv.cost) / NULLIF(pv.cost, 0) * 100),
      1
    )                                                                        AS avg_variance_pct,
    ROUND(
      SUM(GREATEST((rec.unit_cost - pv.cost) * rec.quantity_received, 0)),
      2
    )                                                                        AS total_overcharge,
    ROUND(
      ABS(SUM(LEAST((rec.unit_cost - pv.cost) * rec.quantity_received, 0))),
      2
    )                                                                        AS total_savings
  FROM restock_receives  rec
  JOIN restock_requests  rr  ON rr.id  = rec.request_id
  JOIN product_variants  pv  ON pv.id  = rr.variant_id
  JOIN suppliers         s   ON s.id   = rec.supplier_id
  WHERE rec.hotel_id    = auth_hotel_id()
    AND rec.unit_cost  IS NOT NULL
    AND pv.cost        IS NOT NULL
    AND pv.cost         > 0
    AND rec.received_at >= NOW() - (p_days || ' days')::interval
  GROUP BY s.id, s.name
  ORDER BY avg_variance_pct DESC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION get_price_variance_by_supplier(integer) TO authenticated;

-- ─── 6. get_spend_forecast() ─────────────────────────────────────────────────
-- Projects forward spend for 30/60/90-day horizons based on the average monthly
-- actual spend (restock_receives) over the trailing 6 completed months.
-- Excludes the current partial month to avoid bias.
-- basis_months: how many full months contributed to the average — lower = less
-- reliable. Callers should surface this as the confidence annotation.

CREATE OR REPLACE FUNCTION get_spend_forecast()
RETURNS TABLE (
  horizon           text,     -- '30d' | '60d' | '90d'
  horizon_days      integer,
  forecast_spend    numeric,
  basis_avg_monthly numeric,
  basis_months      integer   -- number of full months in the average
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH monthly_actuals AS (
    SELECT
      DATE_TRUNC('month', rec.received_at)::date AS month,
      SUM(rec.quantity_received * COALESCE(rec.unit_cost, 0)) AS month_spend
    FROM restock_receives rec
    WHERE rec.hotel_id    = auth_hotel_id()
      AND rec.received_at >= NOW() - INTERVAL '6 months'
      AND rec.received_at  < DATE_TRUNC('month', NOW())  -- full months only
    GROUP BY DATE_TRUNC('month', rec.received_at)::date
  ),
  basis AS (
    SELECT
      ROUND(COALESCE(AVG(month_spend), 0), 2) AS avg_monthly,
      COUNT(*)::integer                        AS n_months
    FROM monthly_actuals
  )
  SELECT
    h.label                                     AS horizon,
    h.days                                      AS horizon_days,
    ROUND(b.avg_monthly * h.months, 2)          AS forecast_spend,
    b.avg_monthly                               AS basis_avg_monthly,
    b.n_months                                  AS basis_months
  FROM basis b
  CROSS JOIN (VALUES
    ('30d', 30,  1.0::numeric),
    ('60d', 60,  2.0::numeric),
    ('90d', 90,  3.0::numeric)
  ) AS h(label, days, months)
  ORDER BY h.days
$$;

GRANT EXECUTE ON FUNCTION get_spend_forecast() TO authenticated;

-- ─── 7. detect_and_alert_price_drift() ───────────────────────────────────────
-- Intended for pg_cron (weekly cadence — cost changes are not intraday events).
-- Iterates all hotels; for each hotel checks variants where cost drifted >5%
-- over 6 months. Issues a price_drift alert to admin+ roles via fan_out_alert.
-- Dedup: skips if an unread price_drift alert for that variant already exists.
-- Returns total notifications inserted across all hotels.

CREATE OR REPLACE FUNCTION detect_and_alert_price_drift(
  p_window_months integer DEFAULT 6,
  p_threshold_pct numeric  DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel   RECORD;
  v_variant RECORD;
  v_total   integer := 0;
  v_msg     text;
BEGIN
  FOR v_hotel IN SELECT id FROM hotels LOOP
    FOR v_variant IN
      SELECT
        pv.id      AS variant_id,
        pr.name    AS product_name,
        pv.name    AS variant_name,
        old_c.cost AS cost_then,
        new_c.cost AS cost_now,
        ROUND(
          (new_c.cost - old_c.cost) / NULLIF(old_c.cost, 0) * 100,
          1
        ) AS pct_change
      FROM product_variants pv
      JOIN products pr ON pr.id = pv.product_id
      JOIN LATERAL (
        SELECT cost FROM variant_cost_history
        WHERE variant_id = pv.id AND hotel_id = v_hotel.id
        ORDER BY effective_from DESC LIMIT 1
      ) new_c ON TRUE
      JOIN LATERAL (
        SELECT cost FROM variant_cost_history
        WHERE variant_id     = pv.id
          AND hotel_id       = v_hotel.id
          AND effective_from <= NOW() - make_interval(months => p_window_months)
        ORDER BY effective_from DESC LIMIT 1
      ) old_c ON TRUE
      WHERE pr.hotel_id = v_hotel.id
        AND pv.enabled  = true
        AND ABS(
          (new_c.cost - old_c.cost) / NULLIF(old_c.cost, 0) * 100
        ) >= p_threshold_pct
    LOOP
      -- Dedup: skip if unread price_drift alert for this variant already exists
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.hotel_id   = v_hotel.id
          AND n.type       = 'price_drift'
          AND n.variant_id = v_variant.variant_id
          AND n.read       = false
      );

      v_msg :=
        v_variant.product_name ||
        CASE WHEN COALESCE(v_variant.variant_name, 'Standard') <> 'Standard'
             THEN ' — ' || v_variant.variant_name ELSE '' END ||
        ': cost ' ||
        CASE WHEN v_variant.pct_change > 0 THEN 'up ' ELSE 'down ' END ||
        ABS(v_variant.pct_change) || '% over ' || p_window_months ||
        ' months (' || v_variant.cost_then || ' → ' || v_variant.cost_now || ')';

      v_total := v_total + fan_out_alert(
        v_hotel.id,
        v_msg,
        'price_drift',
        'admin',
        v_variant.variant_id
      );
    END LOOP;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ─── 8. pg_cron schedule (weekly, Mondays 06:00 UTC) ─────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $cron$
      SELECT cron.schedule(
        'weekly-price-drift-check',
        '0 6 * * 1',  -- every Monday at 06:00 UTC
        'SELECT detect_and_alert_price_drift(6, 5)'
      )
    $cron$;
  ELSE
    RAISE NOTICE
      'pg_cron not enabled — weekly-price-drift-check not scheduled. '
      'Enable pg_cron in Supabase extensions and re-run this migration.';
  END IF;
END;
$$;
