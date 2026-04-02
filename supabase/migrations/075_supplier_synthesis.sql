-- Migration 075: Supplier Synthesis Engine (Option A — Cross-Domain Intelligence)
-- Layer: Mind — synthesises fill rate + on-time + invoice variance + price drift
--         + expiry risk into a single ranked urgency score per supplier.
--
-- Palantir principle #6: cross-domain synthesis.
-- "Supplier X price up 12% + 3 consecutive overcharges + 68% fill rate → renegotiate."
-- No single existing RPC made this connection. This migration closes the gap.
--
-- New objects:
--   1. get_supplier_synthesis(p_days int) — ranked supplier urgency table
--   2. get_briefing_actions() extended with 'supplier_risk' action type (priority 0/1)
--
-- Urgency score (0–100) components:
--   Fill rate         0–25 pts  (<90 = 10, <80 = 18, <70 = 25)
--   On-time rate      0–25 pts  (<85 = 10, <70 = 18, <55 = 25)
--   Invoice variance  0–25 pts  (>5% avg = 10, >10% avg = 20, streak ≥3 = 25)
--   Price drift       0–15 pts  (>5% = 8, >10% = 15)
--   Expiry risk       0–10 pts  (>10% rate = 5, >20% = 10)
--
-- Tiers: critical ≥70 | review ≥45 | watch ≥20 | ok <20
-- Briefing: surfaces suppliers with urgency_score ≥45 (review+).

SET search_path = public;

-- ─── 1. get_supplier_synthesis() ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_supplier_synthesis(p_days int DEFAULT 90)
RETURNS TABLE (
  supplier_id                uuid,
  supplier_name              text,
  urgency_score              int,      -- 0–100 composite
  urgency_tier               text,     -- 'critical' | 'review' | 'watch' | 'ok'
  reasons                    text[],   -- dimension strings for display
  fill_rate                  numeric,
  on_time_rate               numeric,
  invoice_avg_variance_pct   numeric,
  consecutive_overcharges    int,
  price_drift_pct            numeric,
  expiry_rate_pct            numeric,
  spend_pct_of_total         numeric,
  total_overcharge           numeric,
  last_delivery_at           timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH

  -- ── Scorecard: fill_rate, on_time_rate, avg_price_drift_pct ──────────────────
  -- supplier_scorecard is a view over delivery_events (RLS-bypassed in SECURITY
  -- DEFINER context) — we must filter explicitly by hotel_id.
  score AS (
    SELECT
      sc.supplier_id,
      sc.avg_fill_rate,
      sc.on_time_rate,
      sc.avg_price_drift_pct
    FROM supplier_scorecard sc
    WHERE sc.hotel_id = auth_hotel_id()
  ),

  -- ── Invoice variance: per-receive unit_cost vs cost baseline ─────────────────
  receive_lines AS (
    SELECT
      rec.supplier_id,
      rec.received_at,
      pv.cost                                                                 AS baseline_cost,
      CASE WHEN rec.unit_cost > pv.cost THEN 1 ELSE 0 END                    AS is_above,
      ROUND((rec.unit_cost - pv.cost) / NULLIF(pv.cost, 0) * 100, 2)        AS variance_pct,
      GREATEST((rec.unit_cost - pv.cost) * rec.quantity_received, 0)         AS overcharge_amount,
      ROW_NUMBER() OVER (
        PARTITION BY rec.supplier_id ORDER BY rec.received_at DESC
      )                                                                       AS rn
    FROM restock_receives  rec
    JOIN restock_requests  rr  ON rr.id  = rec.request_id
    JOIN product_variants  pv  ON pv.id  = rr.variant_id
    WHERE rec.hotel_id    = auth_hotel_id()
      AND rec.supplier_id IS NOT NULL
      AND rec.unit_cost   IS NOT NULL
      AND pv.cost         IS NOT NULL
      AND pv.cost         > 0
      AND rec.received_at >= NOW() - (p_days || ' days')::interval
  ),

  -- Classic consecutive-streak detection anchored at rn=1 (most recent delivery)
  streak_groups AS (
    SELECT
      supplier_id,
      is_above,
      rn,
      rn - ROW_NUMBER() OVER (PARTITION BY supplier_id, is_above ORDER BY rn) AS grp
    FROM receive_lines
  ),

  current_streak AS (
    SELECT supplier_id, COUNT(*)::int AS consecutive_above
    FROM streak_groups
    WHERE is_above = 1 AND grp = 0
    GROUP BY supplier_id
  ),

  variance_agg AS (
    SELECT
      supplier_id,
      ROUND(AVG(variance_pct)::numeric, 2)  AS avg_variance_pct,
      ROUND(SUM(overcharge_amount), 2)       AS total_overcharge,
      MAX(received_at)                       AS last_delivery_at
    FROM receive_lines
    GROUP BY supplier_id
  ),

  -- ── Expiry risk: batches expired with stock remaining ────────────────────────
  expiry_agg AS (
    SELECT
      pb.supplier_id,
      ROUND(
        100.0
          * COUNT(*) FILTER (
              WHERE pb.expiry_date IS NOT NULL
                AND pb.expiry_date < CURRENT_DATE
                AND pb.quantity    > 0
            )
          / NULLIF(COUNT(*) FILTER (WHERE pb.expiry_date IS NOT NULL), 0),
        1
      ) AS expiry_rate_pct
    FROM product_batches  pb
    JOIN suppliers         s  ON s.id  = pb.supplier_id
    WHERE s.hotel_id       = auth_hotel_id()
      AND pb.received_at  >= NOW() - (p_days || ' days')::interval
    GROUP BY pb.supplier_id
    HAVING COUNT(*) > 0
  ),

  -- ── Spend share: what % of total received spend goes to this supplier ────────
  spend_raw AS (
    SELECT
      rec.supplier_id,
      SUM(rec.quantity_received * COALESCE(rec.unit_cost, 0)) AS total_spend
    FROM restock_receives rec
    JOIN suppliers s ON s.id = rec.supplier_id
    WHERE s.hotel_id      = auth_hotel_id()
      AND rec.supplier_id IS NOT NULL
      AND rec.received_at >= NOW() - (p_days || ' days')::interval
    GROUP BY rec.supplier_id
  ),
  spend_agg AS (
    SELECT
      supplier_id,
      ROUND(
        total_spend * 100.0 / NULLIF(SUM(total_spend) OVER (), 0),
        1
      ) AS pct_of_total
    FROM spend_raw
  ),

  -- ── Combine all signals per supplier ─────────────────────────────────────────
  signals AS (
    SELECT
      s.id   AS supplier_id,
      s.name AS supplier_name,
      sc.avg_fill_rate,
      sc.on_time_rate,
      sc.avg_price_drift_pct,
      COALESCE(va.avg_variance_pct,   0)   AS avg_variance_pct,
      COALESCE(cs.consecutive_above,  0)   AS consecutive_overcharges,
      COALESCE(va.total_overcharge,   0)   AS total_overcharge,
      va.last_delivery_at,
      ea.expiry_rate_pct,
      sa.pct_of_total                      AS spend_pct,
      -- Pre-compute component points to avoid repeating CASE logic
      COALESCE(CASE
        WHEN sc.avg_fill_rate  < 70 THEN 25
        WHEN sc.avg_fill_rate  < 80 THEN 18
        WHEN sc.avg_fill_rate  < 90 THEN 10
        ELSE 0
      END, 0) AS fill_pts,
      COALESCE(CASE
        WHEN sc.on_time_rate   < 55 THEN 25
        WHEN sc.on_time_rate   < 70 THEN 18
        WHEN sc.on_time_rate   < 85 THEN 10
        ELSE 0
      END, 0) AS ontime_pts,
      CASE
        WHEN COALESCE(cs.consecutive_above, 0) >= 3          THEN 25
        WHEN COALESCE(va.avg_variance_pct,  0)  > 10         THEN 20
        WHEN COALESCE(va.avg_variance_pct,  0)  > 5          THEN 10
        ELSE 0
      END AS invoice_pts,
      COALESCE(CASE
        WHEN sc.avg_price_drift_pct > 10 THEN 15
        WHEN sc.avg_price_drift_pct > 5  THEN 8
        ELSE 0
      END, 0) AS drift_pts,
      COALESCE(CASE
        WHEN ea.expiry_rate_pct > 20 THEN 10
        WHEN ea.expiry_rate_pct > 10 THEN 5
        ELSE 0
      END, 0) AS expiry_pts
    FROM suppliers s
    LEFT JOIN score           sc ON sc.supplier_id = s.id
    LEFT JOIN variance_agg    va ON va.supplier_id = s.id
    LEFT JOIN current_streak  cs ON cs.supplier_id = s.id
    LEFT JOIN expiry_agg      ea ON ea.supplier_id = s.id
    LEFT JOIN spend_agg       sa ON sa.supplier_id = s.id
    WHERE s.hotel_id = auth_hotel_id()
      -- Require at least one data source to be populated
      AND (sc.supplier_id IS NOT NULL OR va.supplier_id IS NOT NULL)
  )

  SELECT
    supplier_id,
    supplier_name,

    LEAST(100, fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts)::int
                                                           AS urgency_score,

    CASE
      WHEN fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts >= 70 THEN 'critical'
      WHEN fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts >= 45 THEN 'review'
      WHEN fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts >= 20 THEN 'watch'
      ELSE 'ok'
    END                                                    AS urgency_tier,

    -- Reason strings (most impactful first; NULL entries removed)
    ARRAY_REMOVE(ARRAY[
      CASE WHEN consecutive_overcharges >= 2
           THEN consecutive_overcharges::text || ' consecutive overcharges'
           ELSE NULL END,
      CASE WHEN avg_fill_rate IS NOT NULL AND avg_fill_rate < 90
           THEN 'Fill rate ' || ROUND(avg_fill_rate)::text || '%'
           ELSE NULL END,
      CASE WHEN on_time_rate IS NOT NULL AND on_time_rate < 85
           THEN 'On-time ' || ROUND(on_time_rate)::text || '%'
           ELSE NULL END,
      CASE WHEN consecutive_overcharges < 2 AND avg_variance_pct > 5
           THEN 'Avg variance +' || ROUND(avg_variance_pct, 1)::text || '%'
           ELSE NULL END,
      CASE WHEN avg_price_drift_pct IS NOT NULL AND avg_price_drift_pct > 5
           THEN 'Price drift +' || ROUND(avg_price_drift_pct, 1)::text || '%'
           ELSE NULL END,
      CASE WHEN expiry_rate_pct IS NOT NULL AND expiry_rate_pct > 10
           THEN ROUND(expiry_rate_pct)::text || '% batch expiry'
           ELSE NULL END
    ], NULL)                                               AS reasons,

    avg_fill_rate                                          AS fill_rate,
    on_time_rate,
    avg_variance_pct                                       AS invoice_avg_variance_pct,
    consecutive_overcharges,
    avg_price_drift_pct                                    AS price_drift_pct,
    expiry_rate_pct,
    spend_pct                                              AS spend_pct_of_total,
    total_overcharge,
    last_delivery_at

  FROM signals
  WHERE fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts > 0
  ORDER BY
    fill_pts + ontime_pts + invoice_pts + drift_pts + expiry_pts DESC,
    total_overcharge DESC;
$$;

GRANT EXECUTE ON FUNCTION get_supplier_synthesis(int) TO authenticated;

-- ─── 2. get_briefing_actions() ────────────────────────────────────────────────
-- Adds 'supplier_risk' UNION block (priority 0 for critical, 1 for review).
-- Return type unchanged → CREATE OR REPLACE safe (no DROP needed).
-- Full body reproduced from 074 with the new block prepended.

CREATE OR REPLACE FUNCTION get_briefing_actions()
RETURNS TABLE (
  action_type       text,
  priority          int,
  entity_id         uuid,
  entity_type       text,
  entity_label      text,
  context           text,
  action_url        text,
  action_label      text,
  metadata          jsonb,
  correlation_score int
)
LANGUAGE sql STABLE AS $$
  WITH
  recent_occ AS (
    SELECT ROUND(COALESCE(AVG(occupancy_pct), 50)) AS avg_pct
    FROM   occupancy_logs
    WHERE  hotel_id = auth_hotel_id()
      AND  date    >= CURRENT_DATE - 7
  ),
  upcoming_demand AS (
    SELECT COUNT(*) AS days_count
    FROM   occupancy_logs
    WHERE  hotel_id      = auth_hotel_id()
      AND  date         >= CURRENT_DATE - 3
      AND  occupancy_pct >= 75
  ),
  daily_use AS (
    SELECT
      variant_id,
      ROUND(SUM(ABS(quantity_change)) / 30.0, 2) AS avg_per_day
    FROM   stock_logs
    WHERE  hotel_id       = auth_hotel_id()
      AND  timestamp     >= now() - interval '30 days'
      AND  quantity_change < 0
      AND  is_revert       = false
      AND  source          IS DISTINCT FROM 'pos'
    GROUP  BY variant_id
    HAVING SUM(ABS(quantity_change)) > 0
  ),
  open_po AS (
    SELECT DISTINCT ON (pol.variant_id)
      pol.variant_id,
      po.id                    AS po_id,
      po.po_number,
      po.expected_delivery_date
    FROM   purchase_order_lines pol
    JOIN   purchase_orders po ON po.id = pol.po_id
    WHERE  po.hotel_id = auth_hotel_id()
      AND  po.status  IN ('draft', 'sent', 'partially_received')
    ORDER  BY pol.variant_id, po.expected_delivery_date ASC NULLS LAST
  ),
  low AS (
    SELECT
      pv.id AS variant_id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS label,
      pv.current_stock,
      pv.low_stock_threshold,
      CASE WHEN COALESCE(du.avg_per_day, 0) > 0
           THEN ROUND(pv.current_stock / du.avg_per_day)::int
           ELSE NULL END AS days_left
    FROM   product_variants pv
    JOIN   products p      ON p.id  = pv.product_id
    LEFT JOIN daily_use du ON du.variant_id = pv.id
    WHERE  p.hotel_id          = auth_hotel_id()
      AND  pv.low_stock_threshold > 0
      AND  pv.current_stock   <= pv.low_stock_threshold
  ),
  wo_7d AS (
    SELECT variant_id, SUM(ABS(quantity_change)) AS qty
    FROM   stock_logs
    WHERE  hotel_id          = auth_hotel_id()
      AND  timestamp        >= now() - interval '7 days'
      AND  removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  is_revert         = false
      AND  source            IS DISTINCT FROM 'pos'
    GROUP  BY variant_id
  ),
  wo_avg AS (
    SELECT variant_id, ROUND(SUM(ABS(quantity_change)) / 4.0, 1) AS avg_weekly
    FROM   stock_logs
    WHERE  hotel_id          = auth_hotel_id()
      AND  timestamp        >= now() - interval '28 days'
      AND  removal_category IN ('Breakage', 'Theft', 'Spoilage')
      AND  is_revert         = false
      AND  source            IS DISTINCT FROM 'pos'
    GROUP  BY variant_id
    HAVING SUM(ABS(quantity_change)) > 0
  ),
  spikes AS (
    SELECT
      w7.variant_id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS label,
      w7.qty AS qty_7d, wa.avg_weekly,
      ROUND((w7.qty - wa.avg_weekly) / NULLIF(wa.avg_weekly, 0) * 100) AS pct_above
    FROM   wo_7d w7
    JOIN   wo_avg wa           ON wa.variant_id = w7.variant_id
    JOIN   product_variants pv ON pv.id = w7.variant_id
    JOIN   products p          ON p.id  = pv.product_id
    WHERE  w7.qty > wa.avg_weekly * 1.5
  ),
  expiring AS (
    SELECT
      pv.id AS variant_id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS label,
      pv.expiry_date::date AS expiry_date,
      pv.current_stock,
      ROUND(COALESCE(pv.cost, 0) * pv.current_stock, 2) AS value_at_risk
    FROM   product_variants pv
    JOIN   products p ON p.id = pv.product_id
    WHERE  p.hotel_id         = auth_hotel_id()
      AND  pv.expiry_date     IS NOT NULL
      AND  pv.expiry_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
      AND  pv.current_stock   > 0
  ),
  gl AS (
    SELECT * FROM get_gl_export_summary(
      date_trunc('month', CURRENT_DATE)::date,
      CURRENT_DATE
    )
  )

  -- ══ I: Autonomous restock proposals — runway ≤7d, supplier known ═════════════
  SELECT
    'restock_proposal'::text, 0,
    pp.variant_id, 'variant'::text,
    pp.product_name || CASE WHEN pp.variant_name <> 'Standard' THEN ' — ' || pp.variant_name ELSE '' END,
    ROUND(pp.days_until_zero)::text || ' days of stock remaining'
      || ' · ' || pp.preferred_supplier_name
      || ' · lead time ~' || pp.avg_lead_days::text || 'd'
      || CASE WHEN pp.unit_cost > 0 THEN ' · est. ' || (pp.suggested_qty * pp.unit_cost)::text || ' total' ELSE '' END,
    '/procurement'::text, 'Approve & Create PO'::text,
    jsonb_build_object(
      'variant_id', pp.variant_id, 'suggested_qty', pp.suggested_qty,
      'preferred_supplier_id', pp.preferred_supplier_id,
      'preferred_supplier_name', pp.preferred_supplier_name,
      'avg_lead_days', pp.avg_lead_days, 'unit_cost', pp.unit_cost,
      'days_until_zero', pp.days_until_zero, 'urgency_score', pp.urgency_score
    ),
    10
  FROM get_procurement_proposals() pp
  WHERE pp.days_until_zero <= 7
    AND pp.preferred_supplier_id IS NOT NULL
    AND NOT pp.has_open_request

  UNION ALL

  -- ══ A: Low stock · no PO in flight ═══════════════════════════════════════════
  SELECT
    'low_stock_no_po'::text, 0,
    l.variant_id, 'variant'::text, l.label,
    l.current_stock::text || ' units'
      || CASE WHEN l.days_left IS NOT NULL THEN ' · ~' || l.days_left::text || ' days left at current rate' ELSE ' · no consumption data' END
      || ' · no purchase order in flight'
      || CASE WHEN (SELECT days_count FROM upcoming_demand) > 0 THEN ' · high occupancy last 3 days — elevated demand pressure' ELSE '' END,
    '/restocks'::text, 'Request restock'::text,
    jsonb_build_object(
      'variant_id', l.variant_id, 'current_stock', l.current_stock,
      'threshold', l.low_stock_threshold, 'days_left', l.days_left,
      'high_occupancy_recent', (SELECT days_count FROM upcoming_demand) > 0
    ),
    7 + CASE WHEN (SELECT days_count FROM upcoming_demand) > 0 THEN 2 ELSE 0 END
  FROM low l
  WHERE NOT EXISTS (SELECT 1 FROM open_po op WHERE op.variant_id = l.variant_id)

  UNION ALL

  -- ══ B: Pending invoice discrepancies ════════════════════════════════════════
  SELECT
    'invoice_discrepancy'::text, 1,
    pod.po_id, 'purchase_order'::text,
    po.po_number || ' · ' || po.supplier_name,
    'Invoice is ' || pod.variance_pct::text || '% '
      || CASE WHEN pod.invoiced_value > pod.received_value THEN 'over' ELSE 'under' END
      || ' received value — review before approving payment',
    '/invoicing'::text, 'Review discrepancy'::text,
    jsonb_build_object(
      'discrepancy_id', pod.id, 'po_id', pod.po_id,
      'po_number', po.po_number, 'invoiced_value', pod.invoiced_value,
      'received_value', pod.received_value, 'variance_pct', pod.variance_pct
    ),
    6
  FROM po_discrepancies pod
  JOIN purchase_orders po ON po.id = pod.po_id
  WHERE pod.hotel_id = auth_hotel_id() AND pod.status = 'pending'

  UNION ALL

  -- ══ C: Waste spike at LOW occupancy ═════════════════════════════════════════
  SELECT
    'waste_spike_low_occupancy'::text, 1,
    s.variant_id, 'variant'::text, s.label,
    s.qty_7d::text || ' units written off this week vs ' || s.avg_weekly::text
      || ' weekly avg (' || s.pct_above::text || '% above baseline)'
      || ' · hotel at ' || (SELECT avg_pct FROM recent_occ)::text || '% occupancy — unexpected',
    '/flow-dashboard'::text, 'View write-offs'::text,
    jsonb_build_object('variant_id', s.variant_id, 'qty_7d', s.qty_7d,
      'avg_weekly', s.avg_weekly, 'pct_above', s.pct_above,
      'occupancy', (SELECT avg_pct FROM recent_occ)),
    9
  FROM spikes s WHERE (SELECT avg_pct FROM recent_occ) < 70

  UNION ALL

  -- ══ D: Expiring within 3 days ════════════════════════════════════════════════
  SELECT
    'expiry_soon'::text, 1,
    e.variant_id, 'variant'::text, e.label,
    e.current_stock::text || ' units expiring ' || to_char(e.expiry_date, 'Mon DD')
      || CASE WHEN e.value_at_risk > 0 THEN ' · ' || e.value_at_risk::text || ' at risk' ELSE '' END,
    '/expiry'::text, 'View expiry'::text,
    jsonb_build_object('variant_id', e.variant_id, 'expiry_date', e.expiry_date,
      'current_stock', e.current_stock, 'value_at_risk', e.value_at_risk),
    6
  FROM expiring e

  UNION ALL

  -- ══ J: Supplier risk — cross-domain synthesis ════════════════════════════════
  -- Surfaces suppliers where the composite urgency score is ≥45 (review+).
  -- Critical tier (≥70) → priority 0 (act now). Review tier (45-69) → priority 1.
  SELECT
    'supplier_risk'::text,
    CASE WHEN ss.urgency_tier = 'critical' THEN 0 ELSE 1 END,
    ss.supplier_id,
    'supplier'::text,
    ss.supplier_name,
    ARRAY_TO_STRING(ss.reasons, ' · '),
    '/negotiation-prep'::text,
    'Review supplier'::text,
    jsonb_build_object(
      'supplier_id',              ss.supplier_id,
      'urgency_score',            ss.urgency_score,
      'urgency_tier',             ss.urgency_tier,
      'fill_rate',                ss.fill_rate,
      'on_time_rate',             ss.on_time_rate,
      'invoice_avg_variance_pct', ss.invoice_avg_variance_pct,
      'consecutive_overcharges',  ss.consecutive_overcharges,
      'price_drift_pct',          ss.price_drift_pct,
      'expiry_rate_pct',          ss.expiry_rate_pct
    ),
    -- Correlation score: base 2 + score/10 (e.g. score=70 → 9, score=50 → 7)
    LEAST(10, 2 + (ss.urgency_score / 10)::int)::int
  FROM get_supplier_synthesis(90) ss
  WHERE ss.urgency_score >= 45

  UNION ALL

  -- ══ E: Low stock · PO in flight → monitor ════════════════════════════════════
  SELECT
    'low_stock_po_in_flight'::text, 3,
    l.variant_id, 'variant'::text, l.label,
    l.current_stock::text || ' units · PO ' || op.po_number
      || CASE WHEN op.expected_delivery_date IS NOT NULL
              THEN ' arriving ' || to_char(op.expected_delivery_date::date, 'Mon DD')
              ELSE ' in progress' END,
    '/procurement?tab=saved'::text, 'View order'::text,
    jsonb_build_object('variant_id', l.variant_id, 'current_stock', l.current_stock,
      'po_id', op.po_id, 'po_number', op.po_number,
      'expected_delivery', op.expected_delivery_date),
    4
  FROM low l JOIN open_po op ON op.variant_id = l.variant_id

  UNION ALL

  -- ══ F: Waste spike at HIGH occupancy ═════════════════════════════════════════
  SELECT
    'waste_spike_high_occupancy'::text, 4,
    s.variant_id, 'variant'::text, s.label,
    s.qty_7d::text || ' units written off this week vs ' || s.avg_weekly::text
      || ' avg (' || s.pct_above::text || '% above baseline)'
      || ' · hotel at ' || (SELECT avg_pct FROM recent_occ)::text || '% — likely operational',
    '/flow-dashboard'::text, 'View write-offs'::text,
    jsonb_build_object('variant_id', s.variant_id, 'qty_7d', s.qty_7d,
      'avg_weekly', s.avg_weekly, 'pct_above', s.pct_above,
      'occupancy', (SELECT avg_pct FROM recent_occ)),
    3
  FROM spikes s WHERE (SELECT avg_pct FROM recent_occ) >= 70

  UNION ALL

  -- ══ G: GL account codes missing ──────────────────────────────────────────────
  SELECT
    'gl_unmapped'::text, 4, NULL::uuid, 'gl'::text,
    'GL Export · ' || to_char(CURRENT_DATE, 'Mon YYYY'),
    gl.unmapped_count::text || ' transaction'
      || CASE WHEN gl.unmapped_count > 1 THEN 's need' ELSE ' needs' END
      || ' a GL account code before this period can be posted'
      || CASE WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 25
              THEN ' · ' || (DATE_TRUNC('month', CURRENT_DATE + interval '1 month')::date - CURRENT_DATE)::text || ' days to month end'
              ELSE '' END,
    '/gl-export'::text, 'Map accounts'::text,
    jsonb_build_object('unmapped_count', gl.unmapped_count),
    4 + CASE WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 25 THEN 2 ELSE 0 END
  FROM gl WHERE gl.unmapped_count > 0

  UNION ALL

  -- ══ H: End of month, transactions ready ──────────────────────────────────────
  SELECT
    'gl_period_ending'::text, 5, NULL::uuid, 'gl'::text,
    'GL Export · ' || to_char(CURRENT_DATE, 'Mon YYYY'),
    (gl.procurement_count + gl.write_off_count)::text
      || ' transactions ready to export for ' || to_char(CURRENT_DATE, 'Month YYYY'),
    '/gl-export'::text, 'Export now'::text,
    jsonb_build_object('procurement_count', gl.procurement_count,
      'write_off_count', gl.write_off_count,
      'total', gl.procurement_count + gl.write_off_count),
    5
  FROM gl
  WHERE EXTRACT(DAY FROM CURRENT_DATE) >= 20
    AND gl.unmapped_count = 0
    AND (gl.procurement_count + gl.write_off_count) > 0

  ORDER BY 2 ASC, 10 DESC;
$$;

GRANT EXECUTE ON FUNCTION get_briefing_actions() TO authenticated;
