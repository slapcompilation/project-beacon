-- Migration 074: Autonomous Restock Proposals — Briefing Feed (Option A + Option C)
-- Layer: Mind → Eye → Flow synthesis
--
-- Changes:
--   1. auto_create_restock_po(): atomically creates an approved restock request + draft PO
--      when the operator taps "Approve & Create PO" in the Briefing feed.
--   2. get_briefing_actions() recreated to add restock_proposal action type (priority 0,
--      correlation_score 10 — highest urgency) sourced from get_procurement_proposals()
--      WHERE days_until_zero ≤ 7 AND preferred_supplier known AND no open request.
--   3. Option C: invoice_discrepancy action_url changed /procurement?tab=match → /invoicing.

SET search_path = public;

-- ─── 1. auto_create_restock_po() ─────────────────────────────────────────────
-- Atomically creates an approved restock_request and a draft purchase_order.
-- Called when the operator approves a restock proposal in the Briefing feed.
-- Returns the new purchase_order.id so the client can deep-link to it.

CREATE OR REPLACE FUNCTION auto_create_restock_po(
  p_variant_id       uuid,
  p_qty              integer,
  p_supplier_id      uuid,
  p_supplier_name    text,
  p_unit_cost        numeric  DEFAULT 0,
  p_lead_days        integer  DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel      uuid;
  v_request_id uuid;
  v_po_id      uuid;
  v_po_number  text;
  v_delivery   date;
BEGIN
  v_hotel    := auth_hotel_id();
  v_delivery := CURRENT_DATE + p_lead_days;

  -- Validate: variant belongs to caller's hotel
  IF NOT EXISTS (
    SELECT 1
    FROM   product_variants pv
    JOIN   products p ON p.id = pv.product_id
    WHERE  pv.id = p_variant_id AND p.hotel_id = v_hotel
  ) THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  -- Guard: no open restock request already in flight
  IF EXISTS (
    SELECT 1
    FROM   restock_requests
    WHERE  hotel_id   = v_hotel
      AND  variant_id = p_variant_id
      AND  status    IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'An open restock request already exists for this item';
  END IF;

  -- Auto-generate a PO number: AUTO-YYYYMMDD-XXXXXX
  v_po_number := 'AUTO-' || TO_CHAR(now(), 'YYYYMMDD') || '-'
                          || UPPER(SUBSTR(gen_random_uuid()::text, 1, 6));

  -- 1. Create approved restock request (skip approval step — operator confirmed)
  INSERT INTO restock_requests (
    hotel_id, variant_id, quantity_needed,
    supplier, requestor_id, status, notes
  ) VALUES (
    v_hotel,
    p_variant_id,
    p_qty,
    p_supplier_name,
    auth.uid(),
    'approved',
    'Auto-approved from Briefing proposal · ' || TO_CHAR(now(), 'YYYY-MM-DD')
  )
  RETURNING id INTO v_request_id;

  -- 2. Create draft PO via the existing atomic helper
  v_po_id := create_purchase_order(
    p_supplier_id,
    p_supplier_name,
    v_po_number,
    v_delivery,
    'Created from Briefing autonomous restock proposal',
    jsonb_build_array(
      jsonb_build_object(
        'variant_id',  p_variant_id,
        'request_id',  v_request_id,
        'ordered_qty', p_qty,
        'unit_cost',   p_unit_cost,
        'notes',       'Auto-proposal · Briefing feed'
      )
    )
  );

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_create_restock_po(uuid, integer, uuid, text, numeric, integer)
  TO authenticated;

-- ─── 2. get_briefing_actions() ────────────────────────────────────────────────
-- Adds restock_proposal UNION block and fixes invoice_discrepancy URL.
-- Return type is unchanged so CREATE OR REPLACE is safe (no DROP needed).

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
  -- Priority 0 (act now), correlation 10 (highest): system has fully analysed the
  -- situation and identified both the gap AND the supplier in one step.
  SELECT
    'restock_proposal'::text,
    0,
    pp.variant_id,
    'variant'::text,
    pp.product_name || CASE WHEN pp.variant_name <> 'Standard'
                            THEN ' — ' || pp.variant_name ELSE '' END,
    ROUND(pp.days_until_zero)::text || ' days of stock remaining'
      || ' · ' || pp.preferred_supplier_name
      || ' · lead time ~' || pp.avg_lead_days::text || 'd'
      || CASE WHEN pp.unit_cost > 0
              THEN ' · est. ' || (pp.suggested_qty * pp.unit_cost)::text || ' total'
              ELSE '' END,
    '/procurement'::text,
    'Approve & Create PO'::text,
    jsonb_build_object(
      'variant_id',              pp.variant_id,
      'suggested_qty',           pp.suggested_qty,
      'preferred_supplier_id',   pp.preferred_supplier_id,
      'preferred_supplier_name', pp.preferred_supplier_name,
      'avg_lead_days',           pp.avg_lead_days,
      'unit_cost',               pp.unit_cost,
      'days_until_zero',         pp.days_until_zero,
      'urgency_score',           pp.urgency_score
    ),
    10
  FROM get_procurement_proposals() pp
  WHERE pp.days_until_zero  <= 7
    AND pp.preferred_supplier_id IS NOT NULL
    AND NOT pp.has_open_request

  UNION ALL

  -- ══ A: Low stock · no PO in flight → act now ════════════════════════════════
  SELECT
    'low_stock_no_po'::text,
    0,
    l.variant_id,
    'variant'::text,
    l.label,
    l.current_stock::text || ' units'
      || CASE WHEN l.days_left IS NOT NULL
              THEN ' · ~' || l.days_left::text || ' days left at current rate'
              ELSE ' · no consumption data'
              END
      || ' · no purchase order in flight'
      || CASE WHEN (SELECT days_count FROM upcoming_demand) > 0
              THEN ' · high occupancy last 3 days — elevated demand pressure'
              ELSE ''
              END,
    '/restocks'::text,
    'Request restock'::text,
    jsonb_build_object(
      'variant_id',            l.variant_id,
      'current_stock',         l.current_stock,
      'threshold',             l.low_stock_threshold,
      'days_left',             l.days_left,
      'high_occupancy_recent', (SELECT days_count FROM upcoming_demand) > 0
    ),
    7 + CASE WHEN (SELECT days_count FROM upcoming_demand) > 0 THEN 2 ELSE 0 END
  FROM low l
  WHERE NOT EXISTS (SELECT 1 FROM open_po op WHERE op.variant_id = l.variant_id)

  UNION ALL

  -- ══ B: Pending invoice discrepancies (Option C: URL → /invoicing) ═══════════
  SELECT
    'invoice_discrepancy'::text,
    1,
    pod.po_id,
    'purchase_order'::text,
    po.po_number || ' · ' || po.supplier_name,
    'Invoice is ' || pod.variance_pct::text || '% '
      || CASE WHEN pod.invoiced_value > pod.received_value THEN 'over' ELSE 'under' END
      || ' received value — review before approving payment',
    '/invoicing'::text,
    'Review discrepancy'::text,
    jsonb_build_object(
      'discrepancy_id', pod.id,
      'po_id',          pod.po_id,
      'po_number',      po.po_number,
      'invoiced_value', pod.invoiced_value,
      'received_value', pod.received_value,
      'variance_pct',   pod.variance_pct
    ),
    6
  FROM po_discrepancies pod
  JOIN purchase_orders po ON po.id = pod.po_id
  WHERE pod.hotel_id = auth_hotel_id()
    AND pod.status   = 'pending'

  UNION ALL

  -- ══ C: Waste spike at LOW occupancy → unexpected loss ═══════════════════════
  SELECT
    'waste_spike_low_occupancy'::text,
    1,
    s.variant_id,
    'variant'::text,
    s.label,
    s.qty_7d::text || ' units written off this week vs '
      || s.avg_weekly::text || ' weekly avg ('
      || s.pct_above::text || '% above baseline)'
      || ' · hotel at ' || (SELECT avg_pct FROM recent_occ)::text || '% occupancy — unexpected',
    '/flow-dashboard'::text,
    'View write-offs'::text,
    jsonb_build_object(
      'variant_id', s.variant_id,
      'qty_7d',     s.qty_7d,
      'avg_weekly', s.avg_weekly,
      'pct_above',  s.pct_above,
      'occupancy',  (SELECT avg_pct FROM recent_occ)
    ),
    9
  FROM spikes s
  WHERE (SELECT avg_pct FROM recent_occ) < 70

  UNION ALL

  -- ══ D: Expiring within 3 days ════════════════════════════════════════════════
  SELECT
    'expiry_soon'::text,
    1,
    e.variant_id,
    'variant'::text,
    e.label,
    e.current_stock::text || ' units expiring '
      || to_char(e.expiry_date, 'Mon DD')
      || CASE WHEN e.value_at_risk > 0
              THEN ' · ' || e.value_at_risk::text || ' at risk'
              ELSE '' END,
    '/expiry'::text,
    'View expiry'::text,
    jsonb_build_object(
      'variant_id',    e.variant_id,
      'expiry_date',   e.expiry_date,
      'current_stock', e.current_stock,
      'value_at_risk', e.value_at_risk
    ),
    6
  FROM expiring e

  UNION ALL

  -- ══ E: Low stock · PO in flight → monitor ════════════════════════════════════
  SELECT
    'low_stock_po_in_flight'::text,
    3,
    l.variant_id,
    'variant'::text,
    l.label,
    l.current_stock::text || ' units · PO ' || op.po_number
      || CASE WHEN op.expected_delivery_date IS NOT NULL
              THEN ' arriving ' || to_char(op.expected_delivery_date::date, 'Mon DD')
              ELSE ' in progress'
              END,
    '/procurement?tab=saved'::text,
    'View order'::text,
    jsonb_build_object(
      'variant_id',        l.variant_id,
      'current_stock',     l.current_stock,
      'po_id',             op.po_id,
      'po_number',         op.po_number,
      'expected_delivery', op.expected_delivery_date
    ),
    4
  FROM low l
  JOIN open_po op ON op.variant_id = l.variant_id

  UNION ALL

  -- ══ F: Waste spike at HIGH occupancy → probably expected ═════════════════════
  SELECT
    'waste_spike_high_occupancy'::text,
    4,
    s.variant_id,
    'variant'::text,
    s.label,
    s.qty_7d::text || ' units written off this week vs '
      || s.avg_weekly::text || ' avg ('
      || s.pct_above::text || '% above baseline)'
      || ' · hotel at ' || (SELECT avg_pct FROM recent_occ)::text || '% — likely operational',
    '/flow-dashboard'::text,
    'View write-offs'::text,
    jsonb_build_object(
      'variant_id', s.variant_id,
      'qty_7d',     s.qty_7d,
      'avg_weekly', s.avg_weekly,
      'pct_above',  s.pct_above,
      'occupancy',  (SELECT avg_pct FROM recent_occ)
    ),
    3
  FROM spikes s
  WHERE (SELECT avg_pct FROM recent_occ) >= 70

  UNION ALL

  -- ══ G: GL account codes missing ──────────────────────────────────────────────
  SELECT
    'gl_unmapped'::text,
    4,
    NULL::uuid,
    'gl'::text,
    'GL Export · ' || to_char(CURRENT_DATE, 'Mon YYYY'),
    gl.unmapped_count::text || ' transaction'
      || CASE WHEN gl.unmapped_count > 1 THEN 's need' ELSE ' needs' END
      || ' a GL account code before this period can be posted'
      || CASE WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 25
              THEN ' · ' || (DATE_TRUNC('month', CURRENT_DATE + interval '1 month')::date - CURRENT_DATE)::text || ' days to month end'
              ELSE ''
              END,
    '/gl-export'::text,
    'Map accounts'::text,
    jsonb_build_object('unmapped_count', gl.unmapped_count),
    4 + CASE WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 25 THEN 2 ELSE 0 END
  FROM gl
  WHERE gl.unmapped_count > 0

  UNION ALL

  -- ══ H: End of month, transactions ready ──────────────────────────────────────
  SELECT
    'gl_period_ending'::text,
    5,
    NULL::uuid,
    'gl'::text,
    'GL Export · ' || to_char(CURRENT_DATE, 'Mon YYYY'),
    (gl.procurement_count + gl.write_off_count)::text
      || ' transactions ready to export for '
      || to_char(CURRENT_DATE, 'Month YYYY'),
    '/gl-export'::text,
    'Export now'::text,
    jsonb_build_object(
      'procurement_count', gl.procurement_count,
      'write_off_count',   gl.write_off_count,
      'total',             gl.procurement_count + gl.write_off_count
    ),
    5
  FROM gl
  WHERE EXTRACT(DAY FROM CURRENT_DATE) >= 20
    AND gl.unmapped_count = 0
    AND (gl.procurement_count + gl.write_off_count) > 0

  ORDER BY 2 ASC, 10 DESC;
$$;

GRANT EXECUTE ON FUNCTION get_briefing_actions() TO authenticated;
