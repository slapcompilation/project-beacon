-- Migration 067: 3-Way Match Engine (Sprint 11b)
-- Layer: Mind — procurement invoice reconciliation
-- Header-level match: PO value (ordered) vs. received value vs. invoiced value.
-- Deliberately header-level — current po_invoices model is one invoice per PO,
-- not line-level. Line-level invoicing deferred to a later sprint.
-- Receive linkage path: purchase_order_lines.request_id → restock_receives.request_id
-- (works for POs created from restock requests; manually created POs will show received_value = 0).

SET search_path = public;

-- ─── 1. po_discrepancies ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_discrepancies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  po_id           uuid        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_value        numeric     NOT NULL,      -- SUM(ordered_qty × unit_cost) from po_lines
  received_value  numeric     NOT NULL,      -- SUM(qty_received × cost) via request_id linkage
  invoiced_value  numeric     NOT NULL,      -- SUM(invoice_amount) for non-rejected invoices
  variance_pct    numeric     NOT NULL,      -- ABS(invoiced − received) / received × 100
  tolerance_pct   numeric     NOT NULL,      -- threshold applied when discrepancy was flagged
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     uuid        REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  review_notes    text,
  detected_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE po_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pod_all" ON po_discrepancies FOR ALL
  USING  (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

-- Only one pending discrepancy per PO at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pod_pending
  ON po_discrepancies (hotel_id, po_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pod_hotel_status
  ON po_discrepancies (hotel_id, status, detected_at DESC);

COMMENT ON TABLE po_discrepancies IS
  'Auto-detected invoice variances requiring review. One pending record per PO max. '
  'Approved/rejected records are retained for audit. '
  'Variance = ABS(invoiced - received) / received × 100.';

-- ─── 2. notifications: add po_discrepancy type ───────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'low_stock', 'expiry', 'restock_request', 'waste_spike',
    'pos_variance', 'po_discrepancy'
  ));

-- ─── 3. get_po_match(p_po_id) ────────────────────────────────────────────────
-- Header-level 3-way comparison for a single PO.
-- match_status:
--   'no_data'         — no receives AND no invoices yet
--   'pending_invoice' — receives exist but no invoice submitted
--   'pending_delivery'— invoice exists but no receives recorded
--   'matched'         — variance ≤ 2% (hard-coded display tolerance)
--   'variance'        — variance > 2%

CREATE OR REPLACE FUNCTION get_po_match(p_po_id uuid)
RETURNS TABLE (
  po_id           uuid,
  po_number       text,
  supplier_name   text,
  po_status       text,
  po_value        numeric,
  received_value  numeric,
  invoiced_value  numeric,
  variance_pct    numeric,
  match_status    text
)
LANGUAGE sql STABLE AS $$
  WITH po AS (
    SELECT id, po_number, supplier_name, status
    FROM   purchase_orders
    WHERE  id = p_po_id AND hotel_id = auth_hotel_id()
  ),
  po_val AS (
    SELECT COALESCE(SUM(pol.ordered_qty * pol.unit_cost), 0) AS total
    FROM   purchase_order_lines pol
    WHERE  pol.po_id = p_po_id
  ),
  recv_val AS (
    SELECT COALESCE(
      SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0)),
      0
    ) AS total
    FROM   purchase_order_lines pol
    JOIN   restock_requests req ON req.id = pol.request_id
    JOIN   restock_receives rr  ON rr.request_id = req.id
    JOIN   product_variants pv  ON pv.id = req.variant_id
    WHERE  pol.po_id = p_po_id
  ),
  inv_val AS (
    SELECT COALESCE(SUM(pi.invoice_amount), 0) AS total
    FROM   po_invoices pi
    WHERE  pi.po_id = p_po_id
      AND  pi.status <> 'rejected'
  )
  SELECT
    po.id,
    po.po_number,
    po.supplier_name,
    po.status,
    ROUND(pv.total, 2)  AS po_value,
    ROUND(rv.total, 2)  AS received_value,
    ROUND(iv.total, 2)  AS invoiced_value,
    CASE
      WHEN rv.total = 0 OR iv.total = 0 THEN 0
      ELSE ROUND(ABS(iv.total - rv.total) / rv.total * 100, 2)
    END                 AS variance_pct,
    CASE
      WHEN iv.total = 0 AND rv.total = 0 THEN 'no_data'
      WHEN iv.total = 0                  THEN 'pending_invoice'
      WHEN rv.total = 0                  THEN 'pending_delivery'
      WHEN ABS(iv.total - rv.total) / rv.total * 100 <= 2 THEN 'matched'
      ELSE 'variance'
    END                 AS match_status
  FROM po, po_val pv, recv_val rv, inv_val iv;
$$;

GRANT EXECUTE ON FUNCTION get_po_match(uuid) TO authenticated;

-- ─── 4. get_po_match_summary(p_days) ─────────────────────────────────────────
-- All POs in the window with their match status + pending discrepancy if any.
-- Ordered by variance DESC so worst offenders surface first.

CREATE OR REPLACE FUNCTION get_po_match_summary(p_days int DEFAULT 90)
RETURNS TABLE (
  po_id              uuid,
  po_number          text,
  supplier_name      text,
  po_status          text,
  po_value           numeric,
  received_value     numeric,
  invoiced_value     numeric,
  variance_pct       numeric,
  match_status       text,
  discrepancy_id     uuid,
  discrepancy_status text
)
LANGUAGE sql STABLE AS $$
  WITH recent_pos AS (
    SELECT id FROM purchase_orders
    WHERE hotel_id  = auth_hotel_id()
      AND created_at >= now() - (p_days || ' days')::interval
  ),
  matches AS (
    SELECT m.* FROM recent_pos, LATERAL get_po_match(recent_pos.id) m
  )
  SELECT
    m.*,
    d.id     AS discrepancy_id,
    d.status AS discrepancy_status
  FROM matches m
  LEFT JOIN po_discrepancies d
    ON  d.po_id   = m.po_id
    AND d.status  = 'pending'
  ORDER BY m.variance_pct DESC NULLS LAST, m.po_id;
$$;

GRANT EXECUTE ON FUNCTION get_po_match_summary(int) TO authenticated;

-- ─── 5. detect_po_discrepancies(p_tolerance_pct) ─────────────────────────────
-- Scans all hotels for POs where invoiced value diverges from received value
-- beyond the tolerance. Inserts a po_discrepancies record and fires a notification.
-- Idempotent: skips POs that already have a pending discrepancy (partial unique index).
-- Called by pg_cron daily; service_role only.
-- Does NOT call auth_hotel_id() — runs outside session context.

CREATE OR REPLACE FUNCTION detect_po_discrepancies(p_tolerance_pct numeric DEFAULT 2)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count  int := 0;
  v_rec    RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      po.hotel_id,
      po.id                                                                   AS po_id,
      COALESCE(SUM(pol.ordered_qty * pol.unit_cost), 0)                       AS po_value,
      COALESCE(SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0))
               FILTER (WHERE rr.id IS NOT NULL), 0)                           AS received_value,
      COALESCE(SUM(pi.invoice_amount) FILTER (WHERE pi.status <> 'rejected'), 0) AS invoiced_value
    FROM   purchase_orders po
    JOIN   purchase_order_lines pol ON pol.po_id    = po.id
    LEFT JOIN restock_requests req  ON req.id       = pol.request_id
    LEFT JOIN restock_receives rr   ON rr.request_id = req.id
    LEFT JOIN product_variants pv   ON pv.id        = req.variant_id
    LEFT JOIN po_invoices pi        ON pi.po_id     = po.id
    WHERE NOT EXISTS (
      SELECT 1 FROM po_discrepancies d
      WHERE d.po_id = po.id AND d.status = 'pending'
    )
    GROUP BY po.hotel_id, po.id
    HAVING
      COALESCE(SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0))
               FILTER (WHERE rr.id IS NOT NULL), 0) > 0
      AND COALESCE(SUM(pi.invoice_amount) FILTER (WHERE pi.status <> 'rejected'), 0) > 0
      AND ABS(
            COALESCE(SUM(pi.invoice_amount) FILTER (WHERE pi.status <> 'rejected'), 0)
            - COALESCE(SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0))
                       FILTER (WHERE rr.id IS NOT NULL), 0)
          )
          / NULLIF(
              COALESCE(SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0))
                       FILTER (WHERE rr.id IS NOT NULL), 0),
              0
            ) * 100 > p_tolerance_pct
  LOOP
    INSERT INTO po_discrepancies (
      hotel_id, po_id,
      po_value, received_value, invoiced_value,
      variance_pct, tolerance_pct
    ) VALUES (
      v_rec.hotel_id, v_rec.po_id,
      ROUND(v_rec.po_value, 2),
      ROUND(v_rec.received_value, 2),
      ROUND(v_rec.invoiced_value, 2),
      ROUND(ABS(v_rec.invoiced_value - v_rec.received_value)
            / NULLIF(v_rec.received_value, 0) * 100, 2),
      p_tolerance_pct
    );

    BEGIN
      INSERT INTO notifications (hotel_id, type, title, message, metadata)
      VALUES (
        v_rec.hotel_id,
        'po_discrepancy',
        'Invoice discrepancy detected',
        'Invoice vs. received variance exceeds ' || p_tolerance_pct || '% — review required.',
        jsonb_build_object('po_id', v_rec.po_id)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION detect_po_discrepancies(numeric) TO service_role;

-- ─── 6. review_po_discrepancy ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION review_po_discrepancy(
  p_discrepancy_id  uuid,
  p_status          text,     -- 'approved' | 'rejected'
  p_notes           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'status must be approved or rejected';
  END IF;

  UPDATE po_discrepancies
  SET
    status       = p_status,
    reviewed_by  = auth.uid(),
    reviewed_at  = now(),
    review_notes = p_notes
  WHERE id       = p_discrepancy_id
    AND hotel_id = auth_hotel_id()
    AND status   = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discrepancy not found or already reviewed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION review_po_discrepancy(uuid, text, text) TO authenticated;

-- ─── 7. pg_cron: daily discrepancy scan ──────────────────────────────────────

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'detect-po-discrepancies',
      '30 6 * * *',
      $cmd$SELECT detect_po_discrepancies(2)$cmd$
    );
  END IF;
END;
$outer$;
