-- ═══════════════════════════════════════════════════════════════════════════════
-- 109 — Contract Intelligence
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Contracts (migration 095) are display-only — never consulted during PO
--   creation, and expiring contracts generate no alerts. This migration:
--
--   1. Adds 'contract_expiry' notification type
--   2. Creates detect_expiring_contracts() for automated alerting
--   3. Wires contract expiry into auto_create_alerts()
--   4. Creates get_contract_price() helper for PO price lookups
--   5. Extends get_smart_proposals() to return contracted_price
--
-- Depends on: 061 (fan_out_alert), 067 (notification types), 086 (smart proposals),
--             093 (auto_create_alerts with preferences), 095 (supplier_contracts)
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─── 1. Add contract_expiry notification type ────────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'low_stock', 'expiry', 'restock_request', 'waste_spike',
    'pos_variance', 'po_discrepancy', 'contract_expiry',
    -- Legacy types still referenced by auto_create_alerts / detect_consumption_spike
    'approval', 'system', 'predicted_outage', 'waste_alert',
    'consumption_spike', 'price_drift'
  ));

-- ─── 2. detect_expiring_contracts() ──────────────────────────────────────────
-- Scans supplier_contracts for contracts expiring within 30 days.
-- Dedup: skips if unread contract_expiry alert already exists for this hotel+supplier.
-- Fan out: admin+ (procurement is a management concern, not floor staff).
-- Returns: count of alerts created.

CREATE OR REPLACE FUNCTION detect_expiring_contracts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_count    int  := 0;
  v_row      record;
  v_msg      text;
BEGIN
  FOR v_row IN
    SELECT
      sc.id,
      sc.supplier_name,
      sc.contracted_price,
      sc.contract_end,
      p.name  AS product_name,
      pv.name AS variant_name
    FROM supplier_contracts sc
    JOIN product_variants pv ON pv.id = sc.variant_id
    JOIN products p          ON p.id  = pv.product_id
    WHERE sc.hotel_id   = v_hotel_id
      AND sc.is_active  = true
      AND sc.contract_end IS NOT NULL
      AND sc.contract_end BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  LOOP
    -- Dedup: skip if unread contract_expiry alert for this supplier already exists
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id = v_hotel_id
        AND n.type     = 'contract_expiry'
        AND n.read     = false
        AND n.message  LIKE '%' || v_row.supplier_name || '%'
    );

    v_msg := 'Contract with ' || v_row.supplier_name || ' for '
          || v_row.product_name
          || CASE WHEN v_row.variant_name <> 'Standard'
                  THEN ' — ' || v_row.variant_name ELSE '' END
          || ' expires ' || TO_CHAR(v_row.contract_end, 'Mon DD, YYYY')
          || '. Contracted price: $' || TRIM(TO_CHAR(v_row.contracted_price, '999,999.99'));

    v_count := v_count + fan_out_alert(
      v_hotel_id, v_msg, 'contract_expiry', 'admin', NULL
    );
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION detect_expiring_contracts() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_expiring_contracts() TO service_role;

-- ─── 3. Wire into auto_create_alerts() ──────────────────────────────────────
-- Adds section C: contract expiry alerts → admin+
-- Preserves existing sections A (predicted outage) and B (waste alerts).

DROP FUNCTION IF EXISTS auto_create_alerts(int, int);

CREATE OR REPLACE FUNCTION auto_create_alerts(
  p_days_threshold  int DEFAULT NULL,
  p_waste_threshold int DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_user_id  uuid := auth.uid();
  v_count    int  := 0;
  v_notif_id uuid;
  v_days     int;
  v_waste    int;
BEGIN

  -- Resolve thresholds: explicit arg > hotel preference > global default
  SELECT
    COALESCE(p_days_threshold,  ap.days_threshold,  7),
    COALESCE(p_waste_threshold, ap.waste_threshold, 10)
  INTO v_days, v_waste
  FROM (SELECT 1) _dummy
  LEFT JOIN alert_preferences ap ON ap.hotel_id = v_hotel_id;

  -- ── A. Predicted outage alerts ─────────────────────────────────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': predicted to run out in ~' || stats.days_until_zero::int || ' day' ||
        CASE WHEN stats.days_until_zero::int = 1 THEN '' ELSE 's' END,
      'predicted_outage'
    FROM (
      SELECT
        pv2.id                                                       AS variant_id,
        ROUND(
          pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0),
          0
        )                                                            AS days_until_zero
      FROM stock_logs sl
      JOIN product_variants pv2 ON pv2.id = sl.variant_id
      WHERE sl.hotel_id        = v_hotel_id
        AND sl.quantity_change < 0
        AND sl.is_revert        = false
        AND sl.timestamp       >= NOW() - INTERVAL '30 days'
        AND pv2.enabled         = true
      GROUP BY pv2.id, pv2.current_stock
      HAVING ABS(SUM(sl.quantity_change)) > 0
         AND ROUND(pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0), 0)
               < v_days
    ) stats
    JOIN product_variants pv ON pv.id = stats.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.hotel_id   = v_hotel_id
        AND n.type       = 'predicted_outage'
        AND n.read       = false
        AND n.message LIKE pr.name || '%'
    )
    RETURNING id
  LOOP
    v_count := v_count + 1;
    PERFORM create_relationship_edge(
      v_hotel_id, 'stock_log', v_notif_id, 'triggered_alert', 'alert', v_notif_id
    );
  END LOOP;

  -- ── B. Waste alerts ────────────────────────────────────────────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': ' || ABS(SUM(sl.quantity_change))::int || ' units wasted in the last 7 days',
      'waste_alert'
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '7 days'
    GROUP BY pv.id, pv.name, pr.id, pr.name
    HAVING ABS(SUM(sl.quantity_change)) > v_waste
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.hotel_id = v_hotel_id
           AND n.type     = 'waste_alert'
           AND n.read     = false
           AND n.message  LIKE pr.name || '%'
       )
    RETURNING id
  LOOP
    v_count := v_count + 1;
  END LOOP;

  -- ── C. Contract expiry alerts → admin+ ─────────────────────────────────────
  -- Delegate to detect_expiring_contracts() which handles dedup and fan-out.
  v_count := v_count + detect_expiring_contracts();

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_create_alerts(int, int) TO authenticated;

-- ─── 4. get_contract_price() helper ─────────────────────────────────────────
-- Returns the active contracted price for a variant+supplier pair.
-- NULL if no active contract exists. Used by frontend for PO price suggestions.

CREATE OR REPLACE FUNCTION get_contract_price(
  p_variant_id  uuid,
  p_supplier_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.contracted_price
  FROM supplier_contracts sc
  WHERE sc.hotel_id    = auth_hotel_id()
    AND sc.variant_id  = p_variant_id
    AND sc.supplier_id = p_supplier_id
    AND sc.is_active   = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_contract_price(uuid, uuid) TO authenticated;

-- ─── 5. Extend get_smart_proposals() with contracted_price ──────────────────
-- Must DROP first — PostgreSQL cannot change return type via CREATE OR REPLACE

DROP FUNCTION IF EXISTS get_smart_proposals();

CREATE OR REPLACE FUNCTION get_smart_proposals()
RETURNS TABLE (
  variant_id               uuid,
  product_name             text,
  variant_name             text,
  sku                      text,
  current_stock            int,
  par_level                int,
  mean_daily_30d           float8,
  stddev_daily             float8,
  data_days                int,
  demand_pattern           text,
  days_until_zero          float8,
  stockout_prob_lt         float8,
  preferred_supplier_id    uuid,
  preferred_supplier_name  text,
  lead_time_days           int,
  lead_time_source         text,
  proposed_qty             int,
  unit_cost                numeric,
  estimated_cost           numeric,
  signal_type              text,
  urgency_score            float8,
  confidence_score         float8,
  reasoning                text,
  contracted_price         numeric     -- NEW: from active supplier_contract, NULL if none
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH

  -- ── 30-day daily consumption baseline ─────────────────────────────────────
  daily_cons AS (
    SELECT
      sl.variant_id,
      DATE_TRUNC('day', sl.timestamp AT TIME ZONE 'UTC') AS day,
      SUM(ABS(sl.quantity_change))                        AS qty
    FROM stock_logs sl
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '30 days'
    GROUP BY sl.variant_id, DATE_TRUNC('day', sl.timestamp AT TIME ZONE 'UTC')
  ),
  baseline AS (
    SELECT
      dc.variant_id,
      ROUND(AVG(dc.qty)::numeric, 4)::float8               AS mean_daily,
      ROUND(COALESCE(STDDEV_POP(dc.qty), 0)::numeric, 4)::float8 AS stddev_daily,
      COUNT(DISTINCT dc.day)::int                           AS data_days
    FROM daily_cons dc
    GROUP BY dc.variant_id
  ),

  -- ── PO-based lead times per variant (median of closed POs) ────────────────
  po_lt AS (
    SELECT
      pol.variant_id,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
      ))::int AS lt_days
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id    = v_hotel_id
      AND po.closed_at   > po.sent_at
      AND po.status      IN ('partially_received', 'closed')
    GROUP BY pol.variant_id
    HAVING COUNT(*) >= 3
  ),

  -- ── Hotel-wide median lead time (fallback) ────────────────────────────────
  hotel_median_lt AS (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
    )::int AS lt_days
    FROM purchase_orders po
    WHERE po.hotel_id  = v_hotel_id
      AND po.closed_at > po.sent_at
      AND po.status    IN ('partially_received', 'closed')
    HAVING COUNT(*) >= 3
  ),

  -- ── Preferred supplier per variant ────────────────────────────────────────
  supplier_from_po AS (
    SELECT DISTINCT ON (pol.variant_id)
      pol.variant_id,
      po.supplier_id,
      po.supplier_name
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id      = v_hotel_id
      AND po.status        = 'closed'
      AND po.supplier_id  IS NOT NULL
    ORDER BY pol.variant_id, po.closed_at DESC NULLS LAST
  ),

  -- ── Guards: open requests, open POs, active dismissals ────────────────────
  open_requests AS (
    SELECT DISTINCT variant_id
    FROM restock_requests
    WHERE hotel_id = v_hotel_id AND status IN ('pending', 'approved')
  ),
  open_po_variants AS (
    SELECT DISTINCT pol.variant_id
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id = v_hotel_id
      AND po.status  IN ('draft', 'sent', 'confirmed', 'partially_received')
  ),
  dismissed AS (
    SELECT variant_id
    FROM proposal_dismissals
    WHERE hotel_id    = v_hotel_id
      AND (resurface_at IS NULL OR resurface_at > NOW())
  ),

  -- ── Active contract prices per variant+supplier ───────────────────────────
  contract_prices AS (
    SELECT DISTINCT ON (sc.variant_id, sc.supplier_id)
      sc.variant_id,
      sc.supplier_id,
      sc.contracted_price
    FROM supplier_contracts sc
    WHERE sc.hotel_id  = v_hotel_id
      AND sc.is_active = true
    ORDER BY sc.variant_id, sc.supplier_id, sc.updated_at DESC
  ),

  -- ── Assemble per-variant context ──────────────────────────────────────────
  assembled AS (
    SELECT
      pv.id                                                     AS variant_id,
      p.name                                                    AS product_name,
      pv.name                                                   AS variant_name,
      pv.sku,
      pv.current_stock::int                                     AS current_stock,
      pv.low_stock_threshold::int                               AS par_level,
      b.mean_daily,
      b.stddev_daily,
      b.data_days,
      CASE
        WHEN b.data_days < 7                                              THEN 'sparse'
        WHEN b.stddev_daily / NULLIF(b.mean_daily, 0) < 0.3              THEN 'steady'
        WHEN b.stddev_daily / NULLIF(b.mean_daily, 0) BETWEEN 0.3 AND 1.5 THEN 'variable'
        ELSE 'event_driven'
      END                                                        AS demand_pattern,
      CASE
        WHEN polt.lt_days IS NOT NULL          THEN polt.lt_days
        WHEN s.lead_time_days IS NOT NULL      THEN s.lead_time_days
        WHEN (SELECT lt_days FROM hotel_median_lt) IS NOT NULL
                                               THEN (SELECT lt_days FROM hotel_median_lt)
        ELSE NULL
      END                                                        AS lead_time_days,
      CASE
        WHEN polt.lt_days IS NOT NULL          THEN 'po_history'
        WHEN s.lead_time_days IS NOT NULL      THEN 'supplier_stated'
        WHEN (SELECT lt_days FROM hotel_median_lt) IS NOT NULL
                                               THEN 'hotel_median'
        ELSE 'unknown'
      END                                                        AS lead_time_source,
      COALESCE(sfp.supplier_id, pv.default_supplier_id)         AS preferred_supplier_id,
      COALESCE(sfp.supplier_name, s.name)                       AS preferred_supplier_name,
      pv.cost                                                    AS unit_cost,
      -- Contract price: lookup by preferred supplier + variant
      cp.contracted_price                                        AS contracted_price
    FROM product_variants pv
    JOIN products p         ON p.id = pv.product_id
    JOIN baseline b         ON b.variant_id = pv.id
    LEFT JOIN po_lt polt    ON polt.variant_id = pv.id
    LEFT JOIN suppliers s   ON s.id = pv.default_supplier_id
    LEFT JOIN supplier_from_po sfp ON sfp.variant_id = pv.id
    LEFT JOIN contract_prices cp
      ON cp.variant_id  = pv.id
     AND cp.supplier_id = COALESCE(sfp.supplier_id, pv.default_supplier_id)
    WHERE p.hotel_id        = v_hotel_id
      AND pv.enabled        = true
      AND NOT EXISTS (SELECT 1 FROM open_requests   WHERE variant_id = pv.id)
      AND NOT EXISTS (SELECT 1 FROM open_po_variants WHERE variant_id = pv.id)
      AND NOT EXISTS (SELECT 1 FROM dismissed        WHERE variant_id = pv.id)
  ),

  -- ── Compute derived intelligence ──────────────────────────────────────────
  computed AS (
    SELECT
      a.*,
      ROUND((a.current_stock::numeric / NULLIF(a.mean_daily, 0))::numeric, 1)::float8
                                                             AS days_until_zero,
      COALESCE(a.lead_time_days, 7)                          AS eff_lt,
      CASE
        WHEN a.lead_time_days IS NOT NULL
          AND a.mean_daily > 0
          AND a.stddev_daily > 0
          AND a.current_stock > a.mean_daily * a.lead_time_days
        THEN ROUND((
          1.0 - _normal_cdf(
            (a.current_stock - a.mean_daily * a.lead_time_days::float8)
            / (a.stddev_daily * SQRT(a.lead_time_days::float8))
          )
        )::numeric * 100, 1)::float8
        WHEN a.lead_time_days IS NOT NULL
          AND a.mean_daily > 0
          AND a.current_stock <= a.mean_daily * a.lead_time_days
        THEN 99.0
        ELSE NULL
      END                                                    AS stockout_prob_lt,
      GREATEST(1, CEIL(
        a.mean_daily * COALESCE(a.lead_time_days, 7)
        + a.mean_daily * 14.0
        + GREATEST(0, a.par_level - a.current_stock)
      ))::int                                                AS proposed_qty,
      ROUND((
        CASE WHEN a.data_days >= 14 THEN 1.00
             WHEN a.data_days >= 7  THEN 0.80
             ELSE 0.60
        END
        *
        CASE a.lead_time_source
          WHEN 'po_history'      THEN 1.00
          WHEN 'supplier_stated' THEN 0.85
          WHEN 'hotel_median'    THEN 0.70
          ELSE                        0.45
        END
        *
        CASE a.demand_pattern
          WHEN 'event_driven' THEN 0.85
          WHEN 'sparse'       THEN 0.70
          ELSE 1.00
        END
      )::numeric, 2)::float8                                 AS confidence_score
    FROM assembled a
    WHERE
      a.current_stock < a.par_level
      OR (
        a.current_stock::numeric / NULLIF(a.mean_daily, 0)
          <= COALESCE(a.lead_time_days, 7) * 2.0
      )
  )

  SELECT
    c.variant_id,
    c.product_name,
    c.variant_name,
    c.sku,
    c.current_stock,
    c.par_level,
    c.mean_daily                                              AS mean_daily_30d,
    c.stddev_daily,
    c.data_days,
    c.demand_pattern,
    c.days_until_zero,
    c.stockout_prob_lt,
    c.preferred_supplier_id,
    c.preferred_supplier_name,
    c.lead_time_days,
    c.lead_time_source,
    c.proposed_qty,
    COALESCE(c.unit_cost, 0)                                  AS unit_cost,
    ROUND(c.proposed_qty * COALESCE(c.unit_cost, 0), 2)       AS estimated_cost,

    CASE
      WHEN c.days_until_zero IS NOT NULL
        AND c.days_until_zero <= c.eff_lt                     THEN 'critical'
      WHEN c.days_until_zero IS NOT NULL
        AND c.days_until_zero <= c.eff_lt * 1.5               THEN 'warning'
      ELSE 'watch'
    END                                                        AS signal_type,

    ROUND(LEAST(1.0, GREATEST(0.0,
      1.0 - c.days_until_zero / NULLIF(c.eff_lt * 2.0, 0)
    ))::numeric, 3)::float8                                   AS urgency_score,

    c.confidence_score,

    CONCAT_WS(' · ',
      CASE WHEN c.days_until_zero IS NOT NULL
        THEN ROUND(c.days_until_zero::numeric, 0)::text
             || 'd until zero at ' || ROUND(c.mean_daily::numeric, 1)::text || 'u/day'
        ELSE NULL
      END,
      CASE WHEN c.par_level > 0 AND c.current_stock < c.par_level
        THEN 'Below PAR (' || c.current_stock::text || ' of ' || c.par_level::text || ')'
        ELSE NULL
      END,
      CASE WHEN c.preferred_supplier_name IS NOT NULL
        THEN c.preferred_supplier_name
             || ' · ' || c.eff_lt::text || 'd lead (' || REPLACE(c.lead_time_source, '_', ' ') || ')'
        ELSE 'No supplier · ' || c.eff_lt::text || 'd default lead'
      END,
      CASE WHEN c.stockout_prob_lt IS NOT NULL AND c.stockout_prob_lt >= 50
        THEN ROUND(c.stockout_prob_lt::numeric, 0)::text || '% stockout risk during reorder window'
        ELSE NULL
      END,
      CASE WHEN c.contracted_price IS NOT NULL AND c.unit_cost > 0
             AND ABS(c.contracted_price - c.unit_cost) / c.unit_cost > 0.03
        THEN 'Contract price: $' || TRIM(TO_CHAR(c.contracted_price, '999,999.99'))
        ELSE NULL
      END
    )                                                          AS reasoning,

    c.contracted_price                                         AS contracted_price

  FROM computed c
  ORDER BY
    CASE
      WHEN c.days_until_zero IS NOT NULL AND c.days_until_zero <= c.eff_lt       THEN 0
      WHEN c.days_until_zero IS NOT NULL AND c.days_until_zero <= c.eff_lt * 1.5 THEN 1
      ELSE 2
    END,
    ROUND(LEAST(1.0, GREATEST(0.0,
      1.0 - c.days_until_zero / NULLIF(c.eff_lt * 2.0, 0)
    ))::numeric, 3) DESC,
    c.days_until_zero ASC NULLS LAST;

END;
$$;

GRANT EXECUTE ON FUNCTION get_smart_proposals() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - 'contract_expiry' notification type added
--   - detect_expiring_contracts(): scans active contracts expiring ≤30 days
--   - auto_create_alerts() now runs contract expiry detection (section C)
--   - get_contract_price(variant, supplier): active contract price lookup
--   - get_smart_proposals() returns contracted_price for preferred supplier
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ auto_create_alerts() sections:                                             │
-- │   A. Predicted outage → team_member+        (existing)                     │
-- │   B. Waste alerts → admin+                  (existing)                     │
-- │   C. Contract expiry → admin+               (NEW)                         │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════
