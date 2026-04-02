-- Migration 082: Anomaly Explainer — Root Cause Attribution Engine
-- Layer: Eye → Cross-layer synthesis
-- Palantir principle: "every screen must answer what should the operator do RIGHT NOW?"
-- That requires knowing WHY the world is this way — causal attribution, not just data display.
--
-- explain_anomaly(p_variant_id, p_anomaly_type) builds a structured explanation by
-- synthesising stock logs, occupancy, supply chain, and team activity into:
--   summary           — one-sentence headline
--   root_cause        — most likely single cause, stated plainly
--   confidence        — 0–1 score based on corroborating signal count
--   cross_domain_context — occupancy, supply gap, PO status, consumption trend
--   contributing_factors — ranked factor list with domain + weight
--
-- Causal chain steps come from the existing get_causal_trace() called separately.
-- This function explains WHY; get_causal_trace() shows WHAT happened step-by-step.

SET search_path = public;

CREATE OR REPLACE FUNCTION explain_anomaly(
  p_variant_id   uuid,
  p_anomaly_type text DEFAULT 'auto'   -- 'waste_spike' | 'stock_depletion' | 'auto'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id    uuid := auth_hotel_id();

  -- Variant identity
  v_product     text;
  v_variant     text;
  v_curr_stock  int;
  v_threshold   int;

  -- Waste spike metrics
  v_qty_7d      numeric := 0;
  v_avg_weekly  numeric := 0;
  v_pct_above   numeric := 0;
  v_breakage    int     := 0;
  v_theft       int     := 0;
  v_spoilage    int     := 0;
  v_expired     int     := 0;
  v_top_user    text;
  v_top_qty     int;

  -- Consumption metrics
  v_mean_30d    numeric := 0;
  v_mean_7d     numeric := 0;
  v_days_zero   numeric := 999;

  -- Cross-domain context
  v_occ_7d      numeric := 0;
  v_last_supply int;         -- days ago; NULL = never received
  v_supplier    text;
  v_open_po     text;
  v_has_request boolean := false;

  -- Output
  v_anomaly_type text;
  v_summary      text;
  v_root_cause   text;
  v_confidence   float8;
  v_factors      jsonb := '[]'::jsonb;
BEGIN

  IF v_hotel_id IS NULL THEN RETURN NULL; END IF;

  -- ── Validate variant ────────────────────────────────────────────────────────
  SELECT p.name, pv.name, pv.current_stock,
         COALESCE(pv.low_stock_threshold, 0)
    INTO v_product, v_variant, v_curr_stock, v_threshold
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE pv.id = p_variant_id AND p.hotel_id = v_hotel_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- ── Cross-domain context (shared by all anomaly types) ─────────────────────

  -- Average occupancy last 7 days
  SELECT COALESCE(AVG(occupancy_pct), 0)
    INTO v_occ_7d
    FROM occupancy_logs
   WHERE hotel_id = v_hotel_id
     AND date >= CURRENT_DATE - 7;

  -- Most recent supply event
  SELECT EXTRACT(DAY FROM NOW() - rec.received_at)::int,
         s.name
    INTO v_last_supply, v_supplier
    FROM restock_receives rec
    JOIN restock_requests rr ON rr.id = rec.request_id
    LEFT JOIN suppliers   s  ON s.id  = rec.supplier_id
   WHERE rr.variant_id = p_variant_id
     AND rec.hotel_id  = v_hotel_id
   ORDER BY rec.received_at DESC
   LIMIT 1;

  -- Open PO covering this variant
  SELECT po.po_number
    INTO v_open_po
    FROM purchase_orders po
    JOIN po_lines pl ON pl.po_id = po.id
   WHERE pl.variant_id = p_variant_id
     AND po.hotel_id   = v_hotel_id
     AND po.status    IN ('draft', 'sent', 'confirmed')
   ORDER BY po.created_at DESC
   LIMIT 1;

  -- Open restock request
  SELECT EXISTS (
    SELECT 1 FROM restock_requests
     WHERE variant_id = p_variant_id
       AND hotel_id   = v_hotel_id
       AND status    IN ('pending', 'pending_manager', 'pending_director', 'approved')
  ) INTO v_has_request;

  -- ── Consumption stats ───────────────────────────────────────────────────────

  WITH daily AS (
    SELECT
      DATE(sl.timestamp AT TIME ZONE 'UTC')                                   AS day,
      SUM(ABS(sl.quantity_change))
        FILTER (WHERE sl.quantity_change < 0 AND sl.removal_category IS NULL) AS consumed
    FROM stock_logs sl
   WHERE sl.variant_id = p_variant_id
     AND sl.hotel_id   = v_hotel_id
     AND sl.timestamp >= NOW() - INTERVAL '30 days'
     AND sl.is_revert  = false
   GROUP BY DATE(sl.timestamp AT TIME ZONE 'UTC')
  )
  SELECT
    COALESCE(ROUND(AVG(consumed)::numeric, 2), 0),
    COALESCE(ROUND(
      AVG(consumed) FILTER (WHERE day >= CURRENT_DATE - 7)::numeric, 2
    ), 0)
  INTO v_mean_30d, v_mean_7d
  FROM daily;

  IF v_mean_30d > 0 THEN
    v_days_zero := LEAST(999, v_curr_stock::numeric / v_mean_30d);
  END IF;

  -- ── Waste spike metrics ─────────────────────────────────────────────────────

  SELECT
    COALESCE(SUM(ABS(quantity_change)), 0),
    COALESCE(SUM(ABS(quantity_change)) FILTER (WHERE removal_category = 'Breakage'), 0),
    COALESCE(SUM(ABS(quantity_change)) FILTER (WHERE removal_category = 'Theft'), 0),
    COALESCE(SUM(ABS(quantity_change)) FILTER (WHERE removal_category IN ('Spoilage', 'Expired')), 0),
    COALESCE(SUM(ABS(quantity_change)) FILTER (WHERE removal_category = 'Expired'), 0)
  INTO v_qty_7d, v_breakage, v_theft, v_spoilage, v_expired
  FROM stock_logs
  WHERE variant_id        = p_variant_id
    AND hotel_id          = v_hotel_id
    AND quantity_change   < 0
    AND removal_category IS NOT NULL
    AND timestamp        >= NOW() - INTERVAL '7 days'
    AND is_revert         = false;

  -- 4-week average weekly waste (weeks 2–4, excluding current week)
  SELECT COALESCE(
    SUM(ABS(quantity_change)) FILTER (WHERE removal_category IS NOT NULL) / 3.0,
    0
  )
  INTO v_avg_weekly
  FROM stock_logs
  WHERE variant_id      = p_variant_id
    AND hotel_id        = v_hotel_id
    AND quantity_change < 0
    AND timestamp      >= NOW() - INTERVAL '28 days'
    AND timestamp      <  NOW() - INTERVAL '7 days'
    AND is_revert       = false;

  IF v_avg_weekly > 0 THEN
    v_pct_above := ROUND(((v_qty_7d - v_avg_weekly) / v_avg_weekly) * 100, 1);
  END IF;

  -- Top attributed user for waste this week
  SELECT u.email, SUM(ABS(sl.quantity_change))::int
    INTO v_top_user, v_top_qty
    FROM stock_logs sl
    LEFT JOIN users u ON u.id = sl.user_id
   WHERE sl.variant_id      = p_variant_id
     AND sl.hotel_id        = v_hotel_id
     AND sl.quantity_change < 0
     AND sl.removal_category IS NOT NULL
     AND sl.timestamp       >= NOW() - INTERVAL '7 days'
     AND sl.is_revert        = false
   GROUP BY u.email
   ORDER BY 2 DESC
   LIMIT 1;

  -- ── Auto-detect anomaly type ────────────────────────────────────────────────

  v_anomaly_type := CASE
    WHEN p_anomaly_type <> 'auto' THEN p_anomaly_type
    WHEN v_qty_7d > 0 AND v_pct_above >= 50 THEN 'waste_spike'
    ELSE 'stock_depletion'
  END;

  -- ── Build structured explanation ────────────────────────────────────────────

  IF v_anomaly_type = 'waste_spike' THEN

    v_root_cause := CASE
      WHEN v_occ_7d < 40 AND v_theft > 0
        THEN 'Probable non-operational loss — Theft category during very low occupancy (' || ROUND(v_occ_7d) || '%)'
      WHEN v_occ_7d < 65 AND v_pct_above >= 150
        THEN 'High waste at low occupancy — spike not explained by operational demand'
      WHEN v_expired > 0 AND v_last_supply IS NOT NULL AND v_last_supply > 14
        THEN 'Expiry-driven waste — last supply was ' || v_last_supply || ' days ago'
      WHEN v_top_user IS NOT NULL AND v_top_qty > v_qty_7d * 0.65
        THEN v_top_user || ' logged ' || v_top_qty || ' of ' || v_qty_7d::int || ' units — single actor'
      ELSE 'Elevated write-off rate without a dominant single cause'
    END;

    v_summary :=
      v_product || ': ' || v_qty_7d::int || ' units written off this week'
      || ' vs ' || ROUND(v_avg_weekly, 1) || ' 3-week avg'
      || CASE WHEN v_pct_above > 0 THEN ' (+' || ROUND(v_pct_above) || '%)' ELSE '' END
      || ' · ' || ROUND(v_occ_7d) || '% occupancy';

    v_confidence := LEAST(1.0,
      CASE WHEN v_pct_above >= 100 THEN 0.35 ELSE 0.15 END +
      CASE WHEN v_occ_7d < 65      THEN 0.25 ELSE 0.05 END +
      CASE WHEN v_top_user IS NOT NULL THEN 0.25 ELSE 0.0 END +
      CASE WHEN v_avg_weekly > 0   THEN 0.15 ELSE 0.0 END
    );

    -- Contributing factors
    IF v_pct_above >= 50 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'waste',
        'label', '+' || ROUND(v_pct_above) || '% above 3-week baseline ('
          || v_qty_7d::int || ' vs ' || ROUND(v_avg_weekly, 1) || ' avg/week)',
        'weight', CASE WHEN v_pct_above >= 150 THEN 'high' ELSE 'medium' END
      ));
    END IF;
    IF v_occ_7d < 70 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'demand',
        'label', ROUND(v_occ_7d) || '% occupancy — below operational threshold',
        'weight', CASE WHEN v_occ_7d < 50 THEN 'high' ELSE 'medium' END
      ));
    END IF;
    IF v_breakage > 0 OR v_theft > 0 OR v_spoilage > 0 OR v_expired > 0 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'waste',
        'label', ARRAY_TO_STRING(ARRAY_REMOVE(ARRAY[
          CASE WHEN v_breakage > 0 THEN 'Breakage ×' || v_breakage ELSE NULL END,
          CASE WHEN v_theft    > 0 THEN 'Theft ×'    || v_theft    ELSE NULL END,
          CASE WHEN v_spoilage > 0 THEN 'Spoilage ×' || v_spoilage ELSE NULL END,
          CASE WHEN v_expired  > 0 THEN 'Expired ×'  || v_expired  ELSE NULL END
        ], NULL), ' · '),
        'weight', 'medium'
      ));
    END IF;
    IF v_top_user IS NOT NULL THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'team',
        'label', v_top_user || ' logged ' || v_top_qty || ' of '
          || v_qty_7d::int || ' units (' || ROUND(v_top_qty::numeric / NULLIF(v_qty_7d, 0) * 100) || '%)',
        'weight', CASE WHEN v_top_qty > v_qty_7d * 0.6 THEN 'high' ELSE 'medium' END
      ));
    END IF;
    IF v_last_supply IS NOT NULL THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'supply',
        'label', 'Last received ' || v_last_supply || ' days ago'
          || CASE WHEN v_supplier IS NOT NULL THEN ' from ' || v_supplier ELSE '' END,
        'weight', CASE WHEN v_expired > 0 AND v_last_supply > 14 THEN 'high' ELSE 'low' END
      ));
    END IF;

  ELSE -- stock_depletion

    v_root_cause := CASE
      WHEN v_mean_30d > 0 AND v_mean_7d > v_mean_30d * 1.5
        THEN 'Consumption accelerated — 7-day rate is '
          || ROUND(v_mean_7d / v_mean_30d, 1) || '× the 30-day baseline'
      WHEN NOT v_has_request AND v_open_po IS NULL AND v_days_zero <= 5
        THEN 'No restock in flight — stockout in ~' || ROUND(v_days_zero, 1) || ' days at current burn rate'
      WHEN v_occ_7d >= 75
        THEN 'High occupancy (' || ROUND(v_occ_7d) || '%) driving elevated demand'
      WHEN v_last_supply IS NOT NULL AND v_last_supply > 30
        THEN 'Extended supply gap — last received ' || v_last_supply || ' days ago'
      WHEN v_mean_30d = 0
        THEN 'No consumption history — cannot forecast depletion timeline'
      ELSE 'Steady depletion at ' || ROUND(v_mean_30d, 1) || '/day average consumption'
    END;

    v_summary :=
      v_product || ': ' || v_curr_stock || ' units remaining'
      || CASE WHEN v_mean_30d > 0
              THEN ' · ~' || ROUND(v_days_zero, 1) || 'd at ' || ROUND(v_mean_30d, 1) || '/day avg'
              ELSE ' · no consumption history' END
      || CASE WHEN v_open_po IS NOT NULL
              THEN ' · PO ' || v_open_po || ' in flight'
              WHEN v_has_request THEN ' · request pending'
              ELSE '' END;

    v_confidence := LEAST(1.0,
      CASE WHEN v_mean_30d > 0     THEN 0.35 ELSE 0.0 END +
      CASE WHEN v_mean_7d  > 0     THEN 0.20 ELSE 0.0 END +
      CASE WHEN v_last_supply IS NOT NULL THEN 0.25 ELSE 0.0 END +
      CASE WHEN v_occ_7d > 0       THEN 0.20 ELSE 0.0 END
    );

    -- Contributing factors
    IF v_mean_30d > 0 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'stock',
        'label', ROUND(v_mean_30d, 1) || '/day mean · ~' || ROUND(v_days_zero, 1) || ' days remaining',
        'weight', CASE WHEN v_days_zero <= 3 THEN 'high'
                       WHEN v_days_zero <= 7 THEN 'medium' ELSE 'low' END
      ));
    END IF;
    IF v_mean_30d > 0 AND v_mean_7d > v_mean_30d * 1.3 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'stock',
        'label', '7-day burn rate ' || ROUND((v_mean_7d / v_mean_30d - 1) * 100) || '% above 30-day avg',
        'weight', 'high'
      ));
    END IF;
    IF NOT v_has_request AND v_open_po IS NULL THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'supply', 'label', 'No restock request or PO in flight', 'weight', 'high'
      ));
    ELSIF v_open_po IS NOT NULL THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'supply', 'label', 'PO ' || v_open_po || ' in flight', 'weight', 'low'
      ));
    ELSIF v_has_request THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'supply', 'label', 'Restock request pending approval', 'weight', 'medium'
      ));
    END IF;
    IF v_occ_7d >= 70 THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'demand',
        'label', ROUND(v_occ_7d) || '% occupancy — elevated demand context',
        'weight', CASE WHEN v_occ_7d >= 85 THEN 'high' ELSE 'medium' END
      ));
    END IF;
    IF v_last_supply IS NOT NULL THEN
      v_factors := v_factors || jsonb_build_array(jsonb_build_object(
        'domain', 'supply',
        'label', 'Last supply ' || v_last_supply || ' days ago'
          || CASE WHEN v_supplier IS NOT NULL THEN ' — ' || v_supplier ELSE '' END,
        'weight', CASE WHEN v_last_supply > 21 THEN 'medium' ELSE 'low' END
      ));
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'variant_id',             p_variant_id,
    'variant_label',          v_product || ' — ' || v_variant,
    'anomaly_type',           v_anomaly_type,
    'summary',                v_summary,
    'root_cause',             v_root_cause,
    'confidence',             ROUND(v_confidence::numeric, 2),
    'cross_domain_context',   jsonb_build_object(
      'occupancy_7d',       ROUND(v_occ_7d::numeric, 1),
      'last_supply_days',   v_last_supply,
      'supplier_name',      v_supplier,
      'open_po_number',     v_open_po,
      'has_open_request',   v_has_request,
      'mean_daily_30d',     ROUND(v_mean_30d::numeric, 2),
      'mean_daily_7d',      ROUND(v_mean_7d::numeric, 2),
      'days_until_zero',    CASE WHEN v_days_zero < 999 THEN ROUND(v_days_zero::numeric, 1) ELSE NULL END
    ),
    'contributing_factors',   v_factors
  );

END;
$$;

GRANT EXECUTE ON FUNCTION explain_anomaly(uuid, text) TO authenticated;
