-- Migration 076: Receiving Loop Closure + Three-Way Match Synthesis
-- Layer: Flow (receive_restock) + Mind (3-way match enrichment)
--
-- Palantir principle #5: Auditability as first-class feature.
-- Every receive now closes its PO automatically when fully fulfilled,
-- and triggers discrepancy detection the moment the invoice is reconciled.
-- Operators are never left hunting for "why is this PO still open?"
--
-- Changes:
--   1. po_discrepancies — add supplier_name column (cross-domain context)
--   2. detect_po_discrepancies() — add supplier_name capture (return type unchanged: int)
--   3. receive_restock() — maintain pol.received_qty + auto-close PO + auto-detect discrepancy

SET search_path = public;

-- ─── 1. supplier_name on po_discrepancies ────────────────────────────────────

ALTER TABLE po_discrepancies
  ADD COLUMN IF NOT EXISTS supplier_name text;

-- Back-fill from purchase_orders
UPDATE po_discrepancies d
SET    supplier_name = po.supplier_name
FROM   purchase_orders po
WHERE  po.id = d.po_id
  AND  d.supplier_name IS NULL;

-- ─── 2. detect_po_discrepancies() — add supplier_name capture ────────────────
-- Must DROP first because we're only adding supplier_name to the INSERT; the
-- signature (numeric → int) and SECURITY DEFINER qualifier are unchanged.

DROP FUNCTION IF EXISTS detect_po_discrepancies(numeric);

CREATE OR REPLACE FUNCTION detect_po_discrepancies(p_tolerance_pct numeric DEFAULT 2)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  int := 0;
  v_rec    RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      po.hotel_id,
      po.id            AS po_id,
      po.supplier_name,
      COALESCE(SUM(pol.ordered_qty * pol.unit_cost), 0)                           AS po_value,
      COALESCE(SUM(rr.quantity_received * COALESCE(rr.unit_cost, pv.cost, 0))
               FILTER (WHERE rr.id IS NOT NULL), 0)                               AS received_value,
      COALESCE(SUM(pi.invoice_amount) FILTER (WHERE pi.status <> 'rejected'), 0)  AS invoiced_value
    FROM   purchase_orders po
    JOIN   purchase_order_lines pol ON pol.po_id     = po.id
    LEFT JOIN restock_requests req  ON req.id        = pol.request_id
    LEFT JOIN restock_receives rr   ON rr.request_id = req.id
    LEFT JOIN product_variants pv   ON pv.id         = req.variant_id
    LEFT JOIN po_invoices pi        ON pi.po_id      = po.id
    WHERE NOT EXISTS (
      SELECT 1 FROM po_discrepancies d
      WHERE  d.po_id  = po.id
        AND  d.status = 'pending'
    )
    GROUP BY po.hotel_id, po.id, po.supplier_name
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
      hotel_id, po_id, supplier_name,
      po_value, received_value, invoiced_value,
      variance_pct, tolerance_pct
    ) VALUES (
      v_rec.hotel_id, v_rec.po_id, v_rec.supplier_name,
      ROUND(v_rec.po_value,        2),
      ROUND(v_rec.received_value,  2),
      ROUND(v_rec.invoiced_value,  2),
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
        jsonb_build_object('po_id', v_rec.po_id, 'supplier_name', v_rec.supplier_name)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION detect_po_discrepancies(numeric) TO service_role;

-- ─── 3. receive_restock() — PO loop closure ───────────────────────────────────
-- Extends the existing function with three new behaviours:
--   a) Update purchase_order_lines.received_qty for the linked PO line
--   b) Auto-close the PO (status → 'received') when all lines are fulfilled
--   c) Inline discrepancy detection for the specific PO when it closes with an invoice
--      (scoped to the single PO — does NOT call detect_po_discrepancies() which
--       scans all hotels and is reserved for the pg_cron batch job)

CREATE OR REPLACE FUNCTION receive_restock(
  p_request_id        uuid,
  p_quantity_received integer,
  p_lot_number        text      DEFAULT NULL,
  p_notes             text      DEFAULT NULL,
  p_unit_cost         numeric   DEFAULT NULL,
  p_expiry_date       date      DEFAULT NULL,
  p_supplier_id       uuid      DEFAULT NULL
)
RETURNS TABLE (log_id uuid, new_balance integer, fulfilled boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_variant_id      uuid;
  v_hotel_id        uuid;
  v_quantity_needed integer;
  v_new_balance     integer;
  v_log_id          uuid;
  v_receive_id      uuid;
  v_batch_id        uuid;
  v_total_received  integer;
  v_fulfilled       boolean := false;
  -- PO closure
  v_po_id           uuid;
  v_po_supplier     text;
  v_open_lines      integer;
  -- Discrepancy detection for the specific PO
  v_po_value        numeric;
  v_received_value  numeric;
  v_invoiced_value  numeric;
  v_variance_pct    numeric;
  v_tolerance_pct   numeric := 2;
BEGIN
  -- Fetch request details; enforce approved status
  SELECT rr.variant_id, rr.hotel_id, rr.quantity_needed
  INTO   v_variant_id, v_hotel_id, v_quantity_needed
  FROM   restock_requests rr
  WHERE  rr.id     = p_request_id
    AND  rr.status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request % not found or not in approved status', p_request_id;
  END IF;

  -- Adjust stock upward
  UPDATE product_variants
  SET    current_stock = current_stock + p_quantity_received
  WHERE  id = v_variant_id
  RETURNING current_stock INTO v_new_balance;

  -- Immutable stock log
  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason, removal_category
  )
  VALUES (
    v_hotel_id, v_variant_id, auth.uid(),
    p_quantity_received, v_new_balance,
    'Received against restock request', NULL
  )
  RETURNING id INTO v_log_id;

  -- Record the receive line
  INSERT INTO restock_receives (
    request_id, hotel_id, received_by,
    quantity_received, lot_number, notes, unit_cost, supplier_id
  )
  VALUES (
    p_request_id, v_hotel_id, auth.uid(),
    p_quantity_received, p_lot_number, p_notes, p_unit_cost, p_supplier_id
  )
  RETURNING id INTO v_receive_id;

  -- Always create a batch record (enables full lot traceability even without expiry)
  INSERT INTO product_batches (
    hotel_id, variant_id, lot_number, expiry_date,
    quantity, receive_id, notes, supplier_id
  )
  VALUES (
    v_hotel_id, v_variant_id, p_lot_number, p_expiry_date,
    p_quantity_received, v_receive_id, p_notes, p_supplier_id
  )
  RETURNING id INTO v_batch_id;

  -- sourced_from edge: restock_receive → supplier (when supplier is known)
  IF p_supplier_id IS NOT NULL THEN
    PERFORM create_relationship_edge(
      v_hotel_id,
      'restock_receive', v_receive_id,
      'sourced_from',
      'supplier', p_supplier_id,
      jsonb_build_object(
        'lot_number', p_lot_number,
        'quantity', p_quantity_received,
        'expiry_date', p_expiry_date
      )
    );
  END IF;

  -- ── PO LINE received_qty maintenance ──────────────────────────────────────
  -- Find the PO line linked to this request (none for ad-hoc receives)
  SELECT pol.po_id, po.supplier_name
  INTO   v_po_id, v_po_supplier
  FROM   purchase_order_lines pol
  JOIN   purchase_orders      po ON po.id = pol.po_id
  WHERE  pol.request_id = p_request_id
  LIMIT  1;

  IF v_po_id IS NOT NULL THEN
    -- Recompute received_qty from actual receives (idempotent)
    UPDATE purchase_order_lines pol
    SET    received_qty = (
      SELECT COALESCE(SUM(rr2.quantity_received), 0)
      FROM   restock_receives rr2
      WHERE  rr2.request_id = pol.request_id
    )
    WHERE  pol.request_id = p_request_id;

    -- ── Auto-close PO when all lines are fulfilled ─────────────────────────
    SELECT COUNT(*)
    INTO   v_open_lines
    FROM   purchase_order_lines pol2
    WHERE  pol2.po_id            = v_po_id
      AND  pol2.received_qty     < pol2.ordered_qty;

    IF v_open_lines = 0 THEN
      UPDATE purchase_orders
      SET    status = 'received'
      WHERE  id     = v_po_id
        AND  status IN ('approved', 'sent');

      -- ── Inline discrepancy detection for this specific PO ─────────────
      -- Only fires when the PO has an invoice and no pending discrepancy yet.
      IF NOT EXISTS (
        SELECT 1 FROM po_discrepancies d
        WHERE  d.po_id  = v_po_id
          AND  d.status = 'pending'
      ) THEN
        SELECT
          COALESCE(SUM(pol3.ordered_qty * pol3.unit_cost), 0),
          COALESCE(SUM(rr3.quantity_received * COALESCE(rr3.unit_cost, pv3.cost, 0))
                   FILTER (WHERE rr3.id IS NOT NULL), 0),
          COALESCE(SUM(pi3.invoice_amount) FILTER (WHERE pi3.status <> 'rejected'), 0)
        INTO v_po_value, v_received_value, v_invoiced_value
        FROM   purchase_order_lines pol3
        LEFT JOIN restock_requests req3 ON req3.id        = pol3.request_id
        LEFT JOIN restock_receives rr3  ON rr3.request_id = req3.id
        LEFT JOIN product_variants pv3  ON pv3.id         = pol3.variant_id
        LEFT JOIN po_invoices      pi3  ON pi3.po_id      = v_po_id
        WHERE pol3.po_id = v_po_id;

        IF v_received_value > 0 AND v_invoiced_value > 0 THEN
          v_variance_pct := ABS(v_invoiced_value - v_received_value)
                            / NULLIF(v_received_value, 0) * 100;

          IF v_variance_pct > v_tolerance_pct THEN
            INSERT INTO po_discrepancies (
              hotel_id, po_id, supplier_name,
              po_value, received_value, invoiced_value,
              variance_pct, tolerance_pct
            ) VALUES (
              v_hotel_id, v_po_id, v_po_supplier,
              ROUND(v_po_value,       2),
              ROUND(v_received_value, 2),
              ROUND(v_invoiced_value, 2),
              ROUND(v_variance_pct,   2),
              v_tolerance_pct
            );

            BEGIN
              INSERT INTO notifications (hotel_id, type, title, message, metadata)
              VALUES (
                v_hotel_id,
                'po_discrepancy',
                'Invoice discrepancy detected',
                'Invoice vs. received variance ' || ROUND(v_variance_pct, 1) || '% — review required.',
                jsonb_build_object('po_id', v_po_id, 'supplier_name', v_po_supplier)
              );
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── Request fulfillment check ─────────────────────────────────────────────
  SELECT COALESCE(SUM(quantity_received), 0)
  INTO   v_total_received
  FROM   restock_receives
  WHERE  request_id = p_request_id;

  IF v_total_received >= v_quantity_needed THEN
    UPDATE restock_requests SET status = 'fulfilled' WHERE id = p_request_id;
    v_fulfilled := true;
  END IF;

  RETURN QUERY SELECT v_log_id, v_new_balance, v_fulfilled;
END;
$$;

GRANT EXECUTE ON FUNCTION receive_restock(uuid, integer, text, text, numeric, date, uuid) TO authenticated;
