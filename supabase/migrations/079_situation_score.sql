-- Migration 079: Situation Score — Cross-domain anomaly escalation engine
-- Layer: Eye + Mind synthesis (Palantir principle #6: cross-domain fusion)
--
-- get_situation_score() fuses four independent signal domains into a single
-- operator-facing situation assessment:
--   - Stock: variants with runway ≤ 2 days and no PO in flight
--   - Waste: write-off spikes at low occupancy (unexplained shrinkage)
--   - Suppliers: overdue POs past expected delivery date
--   - Demand: upcoming high-occupancy days vs. critical stock state
--
-- Returns JSONB: { level, score, incidents[] }
-- level: 'critical' (score ≥ 60) | 'elevated' (≥ 25) | 'nominal'

SET search_path = public;

CREATE OR REPLACE FUNCTION get_situation_score()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel             uuid    := auth_hotel_id();
  v_critical_stock    int     := 0;
  v_critical_labels   text[]  := '{}';
  v_waste_spikes      int     := 0;
  v_avg_occ           numeric := 50;
  v_overdue_pos       int     := 0;
  v_overdue_suppliers text[]  := '{}';
  v_high_occ_days     int     := 0;
  v_score             int     := 0;
  v_level             text;
  v_incidents         jsonb   := '[]'::jsonb;
BEGIN
  -- ── 1. Critical stock: runway ≤ 2 days, no open PO ───────────────────────────
  SELECT COUNT(*)::int
  INTO   v_critical_stock
  FROM (
    SELECT pv.id
    FROM   product_variants pv
    JOIN   products p ON p.id = pv.product_id
    JOIN (
      SELECT variant_id, SUM(ABS(quantity_change)) / 30.0 AS avg_per_day
      FROM   stock_logs
      WHERE  hotel_id         = v_hotel
        AND  timestamp       >= now() - interval '30 days'
        AND  quantity_change  < 0
        AND  is_revert        = false
      GROUP  BY variant_id
      HAVING SUM(ABS(quantity_change)) > 0
    ) d ON d.variant_id = pv.id
    WHERE  p.hotel_id   = v_hotel
      AND  d.avg_per_day > 0
      AND  pv.current_stock / d.avg_per_day <= 2
      AND  NOT EXISTS (
        SELECT 1
        FROM   purchase_order_lines pol
        JOIN   purchase_orders po ON po.id = pol.po_id
        WHERE  po.hotel_id = v_hotel
          AND  po.status  IN ('draft', 'sent', 'partially_received')
          AND  pol.variant_id = pv.id
      )
  ) critical_items;

  -- Collect up to 4 critical item labels (for incident context)
  IF v_critical_stock > 0 THEN
    SELECT ARRAY_AGG(item_label)
    INTO   v_critical_labels
    FROM (
      SELECT p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS item_label
      FROM   product_variants pv
      JOIN   products p ON p.id = pv.product_id
      JOIN (
        SELECT variant_id, SUM(ABS(quantity_change)) / 30.0 AS avg_per_day
        FROM   stock_logs
        WHERE  hotel_id         = v_hotel
          AND  timestamp       >= now() - interval '30 days'
          AND  quantity_change  < 0
          AND  is_revert        = false
        GROUP  BY variant_id
        HAVING SUM(ABS(quantity_change)) > 0
      ) d ON d.variant_id = pv.id
      WHERE  p.hotel_id   = v_hotel
        AND  d.avg_per_day > 0
        AND  pv.current_stock / d.avg_per_day <= 2
        AND  NOT EXISTS (
          SELECT 1
          FROM   purchase_order_lines pol
          JOIN   purchase_orders po ON po.id = pol.po_id
          WHERE  po.hotel_id = v_hotel
            AND  po.status  IN ('draft', 'sent', 'partially_received')
            AND  pol.variant_id = pv.id
        )
      ORDER BY pv.current_stock / d.avg_per_day ASC
      LIMIT 4
    ) lbl;
  END IF;

  -- ── 2. Waste spikes at low occupancy ──────────────────────────────────────────
  SELECT ROUND(COALESCE(AVG(occupancy_pct), 50))
  INTO   v_avg_occ
  FROM   occupancy_logs
  WHERE  hotel_id = v_hotel
    AND  date    >= CURRENT_DATE - 7;

  -- Only flag as anomaly when occupancy is genuinely low (< 70%)
  IF v_avg_occ < 70 THEN
    SELECT COUNT(*)::int
    INTO   v_waste_spikes
    FROM (
      SELECT w7.variant_id
      FROM (
        SELECT variant_id, SUM(ABS(quantity_change)) AS qty
        FROM   stock_logs
        WHERE  hotel_id          = v_hotel
          AND  timestamp        >= now() - interval '7 days'
          AND  removal_category IN ('Breakage', 'Theft', 'Spoilage')
          AND  is_revert         = false
        GROUP  BY variant_id
      ) w7
      JOIN (
        SELECT variant_id, SUM(ABS(quantity_change)) / 4.0 AS avg_weekly
        FROM   stock_logs
        WHERE  hotel_id          = v_hotel
          AND  timestamp        >= now() - interval '28 days'
          AND  removal_category IN ('Breakage', 'Theft', 'Spoilage')
          AND  is_revert         = false
        GROUP  BY variant_id
        HAVING SUM(ABS(quantity_change)) > 0
      ) wa ON wa.variant_id = w7.variant_id
      WHERE  w7.qty > wa.avg_weekly * 1.5
    ) spikes;
  END IF;

  -- ── 3. Overdue POs ────────────────────────────────────────────────────────────
  SELECT COUNT(*)::int
  INTO   v_overdue_pos
  FROM   purchase_orders
  WHERE  hotel_id                 = v_hotel
    AND  status                  IN ('sent', 'confirmed', 'partially_received')
    AND  expected_delivery_date   IS NOT NULL
    AND  expected_delivery_date  < CURRENT_DATE;

  IF v_overdue_pos > 0 THEN
    SELECT ARRAY_AGG(supplier_name)
    INTO   v_overdue_suppliers
    FROM (
      SELECT supplier_name
      FROM   purchase_orders
      WHERE  hotel_id                = v_hotel
        AND  status                 IN ('sent', 'confirmed', 'partially_received')
        AND  expected_delivery_date  IS NOT NULL
        AND  expected_delivery_date < CURRENT_DATE
      ORDER  BY expected_delivery_date ASC
      LIMIT  3
    ) overdue_list;
  END IF;

  -- ── 4. Upcoming high-occupancy pressure ──────────────────────────────────────
  SELECT COUNT(*)::int
  INTO   v_high_occ_days
  FROM   occupancy_logs
  WHERE  hotel_id      = v_hotel
    AND  date          BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    AND  occupancy_pct >= 80;

  -- ── 5. Score computation ─────────────────────────────────────────────────────
  -- Weights:
  --   Critical stock item (no PO):   +15 pts each
  --   Unexplained waste spike:        +10 pts each
  --   Overdue PO:                     +8 pts each
  --   High-occ + critical stock:     +20 pts (demand mismatch bonus)
  --   High-occ alone (>2 days):      +10 pts (demand pressure flag)
  v_score := LEAST(100,
    v_critical_stock   * 15
    + v_waste_spikes   * 10
    + v_overdue_pos    * 8
    + CASE WHEN v_high_occ_days > 0 AND v_critical_stock > 0 THEN 20 ELSE 0 END
    + CASE WHEN v_high_occ_days > 2 THEN 10 ELSE 0 END
  );

  v_level := CASE
    WHEN v_score >= 60 THEN 'critical'
    WHEN v_score >= 25 THEN 'elevated'
    ELSE 'nominal'
  END;

  -- ── 6. Build incident array (in severity order) ───────────────────────────────
  IF v_critical_stock > 0 THEN
    v_incidents := v_incidents || jsonb_build_array(jsonb_build_object(
      'domain',   'stock',
      'severity', 'critical',
      'label',    v_critical_stock::text || ' item'
                  || CASE WHEN v_critical_stock > 1 THEN 's' ELSE '' END
                  || ' depleting critically',
      'context',  COALESCE(array_to_string(v_critical_labels[1:3], ', '), '')
                  || CASE WHEN array_length(v_critical_labels, 1) > 3
                          THEN ' +' || (array_length(v_critical_labels, 1) - 3)::text || ' more'
                          ELSE '' END
                  || ' — runway ≤ 48h, no PO in flight'
    ));
  END IF;

  IF v_high_occ_days > 0 AND v_critical_stock > 0 THEN
    -- Cross-domain fusion: demand pressure + unresourced stock = highest-value incident
    v_incidents := v_incidents || jsonb_build_array(jsonb_build_object(
      'domain',   'demand',
      'severity', 'critical',
      'label',    v_high_occ_days::text || ' high-occupancy day'
                  || CASE WHEN v_high_occ_days > 1 THEN 's' ELSE '' END
                  || ' — stock unresourced',
      'context',  '≥80% occupancy in next 7 days · '
                  || v_critical_stock::text || ' critical item'
                  || CASE WHEN v_critical_stock > 1 THEN 's have' ELSE ' has' END
                  || ' no PO in flight — demand mismatch risk'
    ));
  ELSIF v_high_occ_days > 0 THEN
    v_incidents := v_incidents || jsonb_build_array(jsonb_build_object(
      'domain',   'demand',
      'severity', 'warning',
      'label',    v_high_occ_days::text || ' high-occupancy day'
                  || CASE WHEN v_high_occ_days > 1 THEN 's' ELSE '' END
                  || ' incoming',
      'context',  '≥80% occupancy in next 7 days — monitor consumption rates'
    ));
  END IF;

  IF v_waste_spikes > 0 THEN
    v_incidents := v_incidents || jsonb_build_array(jsonb_build_object(
      'domain',   'waste',
      'severity', 'warning',
      'label',    v_waste_spikes::text || ' unexplained write-off spike'
                  || CASE WHEN v_waste_spikes > 1 THEN 's' ELSE '' END,
      'context',  'Write-offs ≥150% of weekly average at '
                  || v_avg_occ::text || '% occupancy — possible shrinkage'
    ));
  END IF;

  IF v_overdue_pos > 0 THEN
    v_incidents := v_incidents || jsonb_build_array(jsonb_build_object(
      'domain',   'suppliers',
      'severity', 'warning',
      'label',    v_overdue_pos::text || ' overdue delivery'
                  || CASE WHEN v_overdue_pos > 1 THEN 's' ELSE '' END,
      'context',  COALESCE(array_to_string(v_overdue_suppliers[1:2], ', '), 'Unknown')
                  || CASE WHEN array_length(v_overdue_suppliers, 1) > 2
                          THEN ' +' || (array_length(v_overdue_suppliers, 1) - 2)::text || ' more'
                          ELSE '' END
                  || ' — deliveries past ETA'
    ));
  END IF;

  RETURN jsonb_build_object(
    'level',     v_level,
    'score',     v_score,
    'incidents', v_incidents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_situation_score() TO authenticated;
