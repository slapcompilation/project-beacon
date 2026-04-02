-- Migration 086: Smart Restock Proposal Engine
-- Layer: Mind → Eye → Flow synthesis
-- Palantir principle: decision support, not data display.
--   Closes the intelligence→action loop: probabilistically-enriched proposals
--   the manager approves with one click → restock_request + draft PO created atomically.
--
-- New objects:
--   proposal_dismissals          (table)  — per-variant snooze with resurface time
--   get_smart_proposals()        (RPC)    — enriched proposals: stddev confidence, PO-history
--                                           lead times, Normal-approx stockout probability,
--                                           open-PO guard, PAR-aware recommended qty
--   dismiss_proposal(uuid,int)   (RPC)    — snooze a variant for N hours (default 48)
--   clear_proposal_dismissal(uuid)(RPC)   — called on approve to reset snooze state
--   create_restock_request_only  (RPC)    — creates pending request (no PO) when supplier unknown

SET search_path = public;

-- ── Dismissal table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposal_dismissals (
  hotel_id     uuid        NOT NULL,
  variant_id   uuid        NOT NULL,
  dismissed_by uuid,
  dismissed_at timestamptz NOT NULL DEFAULT NOW(),
  resurface_at timestamptz,      -- NULL = permanent until cleared by approve
  reason       text,
  PRIMARY KEY (hotel_id, variant_id)
);

ALTER TABLE proposal_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hotel_members_all" ON proposal_dismissals;
CREATE POLICY "hotel_members_all" ON proposal_dismissals
  FOR ALL TO authenticated
  USING  (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

-- ── get_smart_proposals() ─────────────────────────────────────────────────────
-- Returns one row per variant requiring a restock action, enriched with:
--   • stddev-based confidence score
--   • Lead time from: PO history (≥3 closed POs) → supplier stated → hotel median
--   • P(stockout during reorder window) via Normal approximation
--   • PAR-aware proposed quantity (cover lead time + 14d buffer + PAR gap)
--   • Excludes: variants with open requests, open POs, or active dismissals

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
  stockout_prob_lt         float8,   -- P(stockout during lead time) 0–100; null if insufficient data
  preferred_supplier_id    uuid,
  preferred_supplier_name  text,
  lead_time_days           int,
  lead_time_source         text,     -- 'po_history'|'supplier_stated'|'hotel_median'|'unknown'
  proposed_qty             int,
  unit_cost                numeric,
  estimated_cost           numeric,
  signal_type              text,     -- 'critical'|'warning'|'watch'
  urgency_score            float8,   -- 0–1
  confidence_score         float8,   -- 0–1
  reasoning                text
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
      AND sl.source          IS DISTINCT FROM 'pos'
    GROUP BY sl.variant_id, DATE_TRUNC('day', sl.timestamp AT TIME ZONE 'UTC')
  ),
  baseline AS (
    SELECT
      variant_id,
      COUNT(*)::int                                              AS data_days,
      ROUND(AVG(qty)::numeric, 4)::float8                       AS mean_daily,
      ROUND(COALESCE(STDDEV(qty), 0)::numeric, 4)::float8       AS stddev_daily
    FROM daily_cons
    GROUP BY variant_id
    HAVING COUNT(*) >= 3 AND AVG(qty) > 0
  ),

  -- ── Lead time hierarchy ─────────────────────────────────────────────────────
  -- Source 1: PO history (sent_at → closed_at, ≥3 completed POs per variant)
  po_lt AS (
    SELECT
      pol.variant_id,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
      ))::int AS lt_days,
      COUNT(*)::int AS po_count
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id
    WHERE po.hotel_id   = v_hotel_id
      AND po.status     = 'closed'
      AND po.sent_at   IS NOT NULL
      AND po.closed_at IS NOT NULL
      AND po.closed_at  > po.sent_at
    GROUP BY pol.variant_id
    HAVING COUNT(*) >= 3
  ),
  -- Source 3: hotel-wide median across all closed POs (fallback)
  hotel_median_lt AS (
    SELECT
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (po.closed_at - po.sent_at)) / 86400.0
      ))::int AS lt_days
    FROM purchase_orders po
    WHERE po.hotel_id   = v_hotel_id
      AND po.status     = 'closed'
      AND po.sent_at   IS NOT NULL
      AND po.closed_at IS NOT NULL
      AND po.closed_at  > po.sent_at
    HAVING COUNT(*) >= 3
  ),

  -- ── Preferred supplier per variant ─────────────────────────────────────────
  -- Most recently used supplier on a closed PO takes priority
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

  -- ── Guards: open requests, open POs, active dismissals ─────────────────────
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

  -- ── Assemble per-variant context ────────────────────────────────────────────
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
      -- Demand pattern — CV-based, same thresholds as PAR engine
      CASE
        WHEN b.data_days < 7                                              THEN 'sparse'
        WHEN b.stddev_daily / NULLIF(b.mean_daily, 0) < 0.3              THEN 'steady'
        WHEN b.stddev_daily / NULLIF(b.mean_daily, 0) BETWEEN 0.3 AND 1.5 THEN 'variable'
        ELSE 'event_driven'
      END                                                        AS demand_pattern,
      -- Lead time: po_history → supplier_stated → hotel_median
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
      -- Preferred supplier
      COALESCE(sfp.supplier_id, pv.default_supplier_id)         AS preferred_supplier_id,
      COALESCE(sfp.supplier_name, s.name)                       AS preferred_supplier_name,
      pv.cost                                                    AS unit_cost
    FROM product_variants pv
    JOIN products p         ON p.id = pv.product_id
    JOIN baseline b         ON b.variant_id = pv.id
    LEFT JOIN po_lt polt    ON polt.variant_id = pv.id
    LEFT JOIN suppliers s   ON s.id = pv.default_supplier_id
    LEFT JOIN supplier_from_po sfp ON sfp.variant_id = pv.id
    -- Exclusions
    WHERE p.hotel_id        = v_hotel_id
      AND pv.enabled        = true
      AND NOT EXISTS (SELECT 1 FROM open_requests   WHERE variant_id = pv.id)
      AND NOT EXISTS (SELECT 1 FROM open_po_variants WHERE variant_id = pv.id)
      AND NOT EXISTS (SELECT 1 FROM dismissed        WHERE variant_id = pv.id)
  ),

  -- ── Compute derived intelligence ────────────────────────────────────────────
  computed AS (
    SELECT
      a.*,
      -- Days until zero at mean daily rate
      ROUND((a.current_stock::numeric / NULLIF(a.mean_daily, 0))::numeric, 1)::float8
                                                             AS days_until_zero,
      -- Effective lead time for formulas (fall back to 7 if unknown)
      COALESCE(a.lead_time_days, 7)                          AS eff_lt,
      -- P(stockout during lead time) via Normal approximation
      --   demand_LT ~ N(mean*L, L*stddev²), so sigma_LT = stddev * sqrt(L)
      --   P(demand > stock) = 1 - Φ((stock - mean*L) / sigma_LT)
      CASE
        WHEN a.lead_time_days IS NOT NULL
          AND a.stddev_daily > 0
          AND a.mean_daily   > 0
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
      -- Proposed qty: lead-time cover + 14-day buffer + PAR gap
      GREATEST(1, CEIL(
        a.mean_daily * COALESCE(a.lead_time_days, 7)         -- cover reorder window
        + a.mean_daily * 14.0                                 -- 14-day operating buffer
        + GREATEST(0, a.par_level - a.current_stock)          -- restore PAR deficit
      ))::int                                                AS proposed_qty,
      -- Confidence score: penalised for data scarcity, lead time source quality, demand volatility
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
    -- Only surface variants within urgency window: days_until_zero ≤ lead*2, or below PAR
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

    -- signal_type: relative to effective lead time
    CASE
      WHEN c.days_until_zero IS NOT NULL
        AND c.days_until_zero <= c.eff_lt                     THEN 'critical'
      WHEN c.days_until_zero IS NOT NULL
        AND c.days_until_zero <= c.eff_lt * 1.5               THEN 'warning'
      ELSE 'watch'
    END                                                        AS signal_type,

    -- urgency_score 0–1: 1.0 = stockout imminent, 0 = comfortable
    ROUND(LEAST(1.0, GREATEST(0.0,
      1.0 - c.days_until_zero / NULLIF(c.eff_lt * 2.0, 0)
    ))::numeric, 3)::float8                                   AS urgency_score,

    c.confidence_score,

    -- Reasoning: human-readable explanation, every number named
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
      END
    )                                                          AS reasoning

  FROM computed c
  ORDER BY
    -- Critical first, then warning, then watch
    CASE
      WHEN c.days_until_zero IS NOT NULL AND c.days_until_zero <= c.eff_lt       THEN 0
      WHEN c.days_until_zero IS NOT NULL AND c.days_until_zero <= c.eff_lt * 1.5 THEN 1
      ELSE 2
    END,
    -- Within tier: highest urgency first
    ROUND(LEAST(1.0, GREATEST(0.0,
      1.0 - c.days_until_zero / NULLIF(c.eff_lt * 2.0, 0)
    ))::numeric, 3) DESC,
    c.days_until_zero ASC NULLS LAST;

END;
$$;

GRANT EXECUTE ON FUNCTION get_smart_proposals() TO authenticated;

-- ── dismiss_proposal() ────────────────────────────────────────────────────────
-- Snooze a proposal for N hours. The variant re-appears after resurface_at.

CREATE OR REPLACE FUNCTION dismiss_proposal(
  p_variant_id uuid,
  p_hours      int DEFAULT 48
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO proposal_dismissals (hotel_id, variant_id, dismissed_by, dismissed_at, resurface_at)
  VALUES (
    auth_hotel_id(),
    p_variant_id,
    auth.uid(),
    NOW(),
    NOW() + (p_hours || ' hours')::interval
  )
  ON CONFLICT (hotel_id, variant_id) DO UPDATE SET
    dismissed_by = EXCLUDED.dismissed_by,
    dismissed_at = EXCLUDED.dismissed_at,
    resurface_at = EXCLUDED.resurface_at,
    reason       = NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_proposal(uuid, int) TO authenticated;

-- ── clear_proposal_dismissal() ────────────────────────────────────────────────
-- Called when a proposal is approved — clears the snooze so the variant
-- re-surfaces correctly if stock drops again after the receive.

CREATE OR REPLACE FUNCTION clear_proposal_dismissal(p_variant_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM proposal_dismissals
  WHERE hotel_id   = auth_hotel_id()
    AND variant_id = p_variant_id;
$$;

GRANT EXECUTE ON FUNCTION clear_proposal_dismissal(uuid) TO authenticated;

-- ── create_restock_request_only() ────────────────────────────────────────────
-- Creates a pending restock_request without a PO, for proposals where no
-- preferred supplier is known. Operator assigns supplier in Procurement tab.

CREATE OR REPLACE FUNCTION create_restock_request_only(
  p_variant_id uuid,
  p_qty        int,
  p_notes      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hotel_id uuid;
  v_req_id   uuid;
BEGIN
  v_hotel_id := auth_hotel_id();
  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'No hotel context';
  END IF;

  -- Validate variant belongs to caller's hotel
  IF NOT EXISTS (
    SELECT 1 FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = p_variant_id AND p.hotel_id = v_hotel_id
  ) THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  -- Guard: no open request already in flight
  IF EXISTS (
    SELECT 1 FROM restock_requests
    WHERE hotel_id   = v_hotel_id
      AND variant_id = p_variant_id
      AND status    IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'An open restock request already exists for this item';
  END IF;

  INSERT INTO restock_requests (
    hotel_id, variant_id, quantity_needed, requestor_id, status, notes
  ) VALUES (
    v_hotel_id,
    p_variant_id,
    p_qty,
    auth.uid(),
    'pending',
    COALESCE(p_notes, 'Smart Proposal · ' || TO_CHAR(NOW(), 'YYYY-MM-DD'))
  )
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_restock_request_only(uuid, int, text) TO authenticated;

-- ── Index for dismissal lookups ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS proposal_dismissals_hotel_resurface
  ON proposal_dismissals (hotel_id, resurface_at)
  WHERE resurface_at IS NOT NULL;
