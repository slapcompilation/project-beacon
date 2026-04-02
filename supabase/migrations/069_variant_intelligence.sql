-- Migration 069: Variant Intelligence + Stock Pressure (Sprint 13)
-- Layer: Eye — intelligence spine
--
-- get_variant_intelligence(p_variant_id):
--   Full cross-layer context for one variant: velocity (30d + 7d), days_until_zero,
--   PO status, write-off spike, expiry, occupancy, unread alerts, last receive.
--   Used by EntityContextPanel and any detail page that needs inline intelligence.
--
-- get_stock_pressure():
--   All variants with measurable consumption sorted by days_until_zero ASC.
--   The forward-looking pressure list: what is about to run out, before it becomes
--   an emergency. Only surfaces items within 14 days — actionable horizon only.

SET search_path = public;

-- ─── get_variant_intelligence ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_variant_intelligence(p_variant_id uuid)
RETURNS TABLE (
  variant_id          uuid,
  variant_label       text,
  current_stock       numeric,
  low_stock_threshold numeric,
  -- Velocity
  avg_daily_use       numeric,    -- 30-day non-POS avg
  avg_daily_use_7d    numeric,    -- 7-day non-POS avg
  velocity_change_pct int,        -- % change 7d vs 30d baseline; positive = accelerating
  days_until_zero     int,        -- at 30d avg rate
  days_until_zero_7d  int,        -- at 7d avg rate (tighter, reflects recent trend)
  -- Purchase order
  open_po_id          uuid,
  open_po_number      text,
  expected_delivery   date,
  -- Write-off spike
  waste_7d            numeric,    -- units written off in last 7 days
  waste_avg_weekly    numeric,    -- 4-week rolling weekly avg
  waste_spike_pct     int,        -- % above avg; NULL if avg = 0
  -- Expiry
  expiry_date         date,
  value_at_risk       numeric,
  -- Context
  avg_occupancy_7d    int,
  unread_alert_count  int,
  last_received_at    timestamptz
)
LANGUAGE sql STABLE AS $$
  WITH
  v AS (
    SELECT
      pv.id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS label,
      pv.current_stock,
      pv.low_stock_threshold,
      pv.expiry_date,
      pv.cost
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id      = p_variant_id
      AND p.hotel_id = auth_hotel_id()
  ),
  use_30d AS (
    SELECT COALESCE(ROUND(SUM(ABS(quantity_change)) / 30.0, 2), 0) AS avg_day
    FROM stock_logs
    WHERE hotel_id        = auth_hotel_id()
      AND variant_id      = p_variant_id
      AND timestamp      >= now() - interval '30 days'
      AND quantity_change < 0
      AND is_revert       = false
      AND source          IS DISTINCT FROM 'pos'
  ),
  use_7d AS (
    SELECT COALESCE(ROUND(SUM(ABS(quantity_change)) / 7.0, 2), 0) AS avg_day
    FROM stock_logs
    WHERE hotel_id        = auth_hotel_id()
      AND variant_id      = p_variant_id
      AND timestamp      >= now() - interval '7 days'
      AND quantity_change < 0
      AND is_revert       = false
      AND source          IS DISTINCT FROM 'pos'
  ),
  po AS (
    SELECT DISTINCT ON (pol.variant_id)
      po.id                   AS po_id,
      po.po_number,
      po.expected_delivery_date
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id    = auth_hotel_id()
      AND pol.variant_id = p_variant_id
      AND po.status      IN ('draft', 'sent', 'partially_received')
    ORDER BY pol.variant_id, po.expected_delivery_date ASC NULLS LAST
  ),
  w7 AS (
    SELECT COALESCE(SUM(ABS(quantity_change)), 0) AS qty
    FROM stock_logs
    WHERE hotel_id          = auth_hotel_id()
      AND variant_id        = p_variant_id
      AND timestamp        >= now() - interval '7 days'
      AND removal_category  IN ('Breakage', 'Theft', 'Spoilage')
      AND is_revert         = false
  ),
  wavg AS (
    SELECT COALESCE(ROUND(SUM(ABS(quantity_change)) / 4.0, 1), 0) AS avg_weekly
    FROM stock_logs
    WHERE hotel_id          = auth_hotel_id()
      AND variant_id        = p_variant_id
      AND timestamp        >= now() - interval '28 days'
      AND removal_category  IN ('Breakage', 'Theft', 'Spoilage')
      AND is_revert         = false
  ),
  occ AS (
    SELECT ROUND(COALESCE(AVG(occupancy_pct), 50))::int AS avg_pct
    FROM occupancy_logs
    WHERE hotel_id = auth_hotel_id()
      AND date    >= CURRENT_DATE - 7
  ),
  alerts AS (
    SELECT COUNT(*)::int AS cnt
    FROM notifications
    WHERE hotel_id  = auth_hotel_id()
      AND variant_id = p_variant_id
      AND read       = false
  ),
  last_recv AS (
    SELECT MAX(timestamp) AS ts
    FROM stock_logs
    WHERE hotel_id        = auth_hotel_id()
      AND variant_id      = p_variant_id
      AND quantity_change > 0
      AND is_revert       = false
  )
  SELECT
    v.id,
    v.label,
    v.current_stock,
    v.low_stock_threshold,
    use_30d.avg_day,
    use_7d.avg_day,
    CASE WHEN use_30d.avg_day > 0
         THEN ROUND((use_7d.avg_day - use_30d.avg_day) / use_30d.avg_day * 100)::int
         ELSE NULL END,
    CASE WHEN use_30d.avg_day > 0
         THEN ROUND(v.current_stock / use_30d.avg_day)::int
         ELSE NULL END,
    CASE WHEN use_7d.avg_day > 0
         THEN ROUND(v.current_stock / use_7d.avg_day)::int
         ELSE NULL END,
    po.po_id,
    po.po_number,
    po.expected_delivery_date::date,
    w7.qty,
    wavg.avg_weekly,
    CASE WHEN wavg.avg_weekly > 0
         THEN ROUND((w7.qty - wavg.avg_weekly) / wavg.avg_weekly * 100)::int
         ELSE NULL END,
    v.expiry_date::date,
    ROUND(COALESCE(v.cost, 0) * v.current_stock, 2),
    occ.avg_pct,
    alerts.cnt,
    last_recv.ts
  FROM v
  CROSS JOIN use_30d
  CROSS JOIN use_7d
  CROSS JOIN w7
  CROSS JOIN wavg
  CROSS JOIN occ
  CROSS JOIN alerts
  CROSS JOIN last_recv
  LEFT JOIN po ON true
$$;

GRANT EXECUTE ON FUNCTION get_variant_intelligence(uuid) TO authenticated;


-- ─── get_stock_pressure ───────────────────────────────────────────────────────
-- Forward-looking list of all variants with measurable consumption, sorted by
-- days_until_zero ASC. Only variants within 14 days are surfaced.
-- The pressure list turns the Briefing from reactive (problems that happened)
-- to predictive (problems about to happen).
CREATE OR REPLACE FUNCTION get_stock_pressure()
RETURNS TABLE (
  variant_id          uuid,
  label               text,
  current_stock       numeric,
  avg_daily_use       numeric,
  days_until_zero     int,
  low_stock_threshold numeric,
  open_po_number      text,
  expected_delivery   date,
  urgency_tier        text    -- 'critical' ≤3d | 'warning' 3–7d | 'watch' 7–14d
)
LANGUAGE sql STABLE AS $$
  WITH
  daily_use AS (
    SELECT
      variant_id,
      ROUND(SUM(ABS(quantity_change)) / 30.0, 2) AS avg_per_day
    FROM stock_logs
    WHERE hotel_id       = auth_hotel_id()
      AND timestamp     >= now() - interval '30 days'
      AND quantity_change < 0
      AND is_revert       = false
      AND source          IS DISTINCT FROM 'pos'
    GROUP BY variant_id
    HAVING SUM(ABS(quantity_change)) > 0
  ),
  pressure AS (
    SELECT
      pv.id             AS variant_id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS label,
      pv.current_stock,
      du.avg_per_day,
      ROUND(pv.current_stock / du.avg_per_day)::int AS days_until_zero,
      pv.low_stock_threshold
    FROM product_variants pv
    JOIN products p   ON p.id = pv.product_id
    JOIN daily_use du ON du.variant_id = pv.id
    WHERE p.hotel_id  = auth_hotel_id()
      AND pv.current_stock > 0
  ),
  open_po AS (
    SELECT DISTINCT ON (pol.variant_id)
      pol.variant_id,
      po.po_number,
      po.expected_delivery_date
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id = auth_hotel_id()
      AND po.status  IN ('draft', 'sent', 'partially_received')
    ORDER BY pol.variant_id, po.expected_delivery_date ASC NULLS LAST
  )
  SELECT
    pr.variant_id,
    pr.label,
    pr.current_stock,
    pr.avg_per_day,
    pr.days_until_zero,
    pr.low_stock_threshold,
    op.po_number,
    op.expected_delivery_date::date,
    CASE
      WHEN pr.days_until_zero <= 3  THEN 'critical'
      WHEN pr.days_until_zero <= 7  THEN 'warning'
      ELSE 'watch'
    END
  FROM pressure pr
  LEFT JOIN open_po op ON op.variant_id = pr.variant_id
  WHERE pr.days_until_zero <= 14
  ORDER BY pr.days_until_zero ASC
$$;

GRANT EXECUTE ON FUNCTION get_stock_pressure() TO authenticated;
