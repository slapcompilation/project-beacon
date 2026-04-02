-- Migration 055: Persisted Purchase Orders + Invoice Intelligence
-- Layer: Mind (procure-to-pay lifecycle, 3-way matching)
-- Purpose: Persist POs to the database so they can be tracked from creation
-- through delivery confirmation and invoice approval. Enables 3-way matching:
--   PO total  vs  received goods total  vs  invoice amount
-- Discrepancies are auto-flagged and feed into the cost variance pipeline.

SET search_path = public;

-- ─── 1. purchase_orders ───────────────────────────────────────────────────────

CREATE TABLE purchase_orders (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id               uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  po_number              text        NOT NULL,
  supplier_id            uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name          text        NOT NULL,
  status                 text        NOT NULL DEFAULT 'draft'
    CONSTRAINT po_status_check
    CHECK (status IN ('draft', 'sent', 'confirmed', 'partially_received', 'closed', 'cancelled')),
  notes                  text,
  total_amount           numeric(12,2) NOT NULL DEFAULT 0,
  expected_delivery_date date,
  sent_at                timestamptz,
  confirmed_at           timestamptz,
  closed_at              timestamptz,
  created_by             uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, po_number)
);

COMMENT ON TABLE purchase_orders IS 'One record per sent purchase order. Groups one or more line items to a single supplier.';
COMMENT ON COLUMN purchase_orders.total_amount IS 'Sum of all line totals. Kept in sync by trigger on purchase_order_lines.';

-- ─── 2. purchase_order_lines ──────────────────────────────────────────────────

CREATE TABLE purchase_order_lines (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid    NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  hotel_id    uuid    NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  variant_id  uuid    NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  request_id  uuid    REFERENCES restock_requests(id) ON DELETE SET NULL,
  ordered_qty integer NOT NULL CHECK (ordered_qty > 0),
  received_qty integer NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_cost   numeric(10,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total  numeric(12,2) NOT NULL GENERATED ALWAYS AS (ordered_qty * unit_cost) STORED,
  notes       text
);

COMMENT ON TABLE purchase_order_lines IS 'One row per SKU per PO.';
COMMENT ON COLUMN purchase_order_lines.received_qty IS 'Cumulative units received. Updated when restock_receives are recorded.';

-- ─── 3. po_invoices ───────────────────────────────────────────────────────────

CREATE TABLE po_invoices (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           uuid          NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  po_id              uuid          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  invoice_number     text          NOT NULL,
  invoice_date       date          NOT NULL,
  invoice_amount     numeric(12,2) NOT NULL CHECK (invoice_amount > 0),
  po_amount          numeric(12,2) NOT NULL,  -- snapshot of PO total at submission time
  discrepancy_amount numeric(12,2) NOT NULL GENERATED ALWAYS AS (invoice_amount - po_amount) STORED,
  status             text          NOT NULL DEFAULT 'pending'
    CONSTRAINT po_invoice_status_check
    CHECK (status IN ('pending', 'matched', 'disputed', 'approved')),
  notes              text,
  submitted_by       uuid          REFERENCES users(id) ON DELETE SET NULL,
  approved_by        uuid          REFERENCES users(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, invoice_number)
);

COMMENT ON TABLE po_invoices IS 'Invoices submitted against a PO. discrepancy_amount = invoice_amount - po_amount.';
COMMENT ON COLUMN po_invoices.discrepancy_amount IS 'Positive = over-invoiced (invoice > PO). Negative = under-invoiced. Zero = matched.';

-- ─── 4. RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_invoices          ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_hotel_isolation ON purchase_orders
  FOR ALL USING (hotel_id = auth_hotel_id());

CREATE POLICY pol_hotel_isolation ON purchase_order_lines
  FOR ALL USING (hotel_id = auth_hotel_id());

CREATE POLICY poi_hotel_isolation ON po_invoices
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── 5. Trigger: keep purchase_orders.total_amount in sync ────────────────────

CREATE OR REPLACE FUNCTION sync_po_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE purchase_orders
     SET total_amount = (
           SELECT COALESCE(SUM(line_total), 0)
             FROM purchase_order_lines
            WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
         ),
         updated_at   = now()
   WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_po_total
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_lines
FOR EACH ROW EXECUTE FUNCTION sync_po_total();

-- ─── 6. create_purchase_order() ───────────────────────────────────────────────
-- Creates a PO and its lines atomically.
-- p_lines: JSON array of {variant_id, request_id, ordered_qty, unit_cost, notes}

CREATE OR REPLACE FUNCTION create_purchase_order(
  p_supplier_id            uuid,
  p_supplier_name          text,
  p_po_number              text,
  p_expected_delivery_date date    DEFAULT NULL,
  p_notes                  text    DEFAULT NULL,
  p_lines                  jsonb   DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id   uuid;
  v_hotel   uuid;
  v_line    jsonb;
BEGIN
  v_hotel := auth_hotel_id();

  IF p_po_number IS NULL OR trim(p_po_number) = '' THEN
    RAISE EXCEPTION 'PO number is required';
  END IF;

  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'PO must have at least one line item';
  END IF;

  INSERT INTO purchase_orders (
    hotel_id, supplier_id, supplier_name, po_number,
    expected_delivery_date, notes, created_by
  ) VALUES (
    v_hotel, p_supplier_id, p_supplier_name, p_po_number,
    p_expected_delivery_date, p_notes, auth.uid()
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO purchase_order_lines (
      po_id, hotel_id, variant_id, request_id, ordered_qty, unit_cost, notes
    ) VALUES (
      v_po_id,
      v_hotel,
      (v_line->>'variant_id')::uuid,
      NULLIF(v_line->>'request_id', '')::uuid,
      (v_line->>'ordered_qty')::integer,
      (v_line->>'unit_cost')::numeric,
      v_line->>'notes'
    );
  END LOOP;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_purchase_order(uuid, text, text, date, text, jsonb) TO authenticated;

-- ─── 7. update_po_status() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_po_status(
  p_po_id                  uuid,
  p_status                 text,
  p_expected_delivery_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_po
    FROM purchase_orders
   WHERE id = p_po_id AND hotel_id = auth_hotel_id()
     FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;

  UPDATE purchase_orders
     SET status = p_status,
         updated_at = now(),
         sent_at      = CASE WHEN p_status = 'sent'      AND sent_at IS NULL      THEN now() ELSE sent_at      END,
         confirmed_at = CASE WHEN p_status = 'confirmed' AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
         closed_at    = CASE WHEN p_status = 'closed'    AND closed_at IS NULL    THEN now() ELSE closed_at    END,
         expected_delivery_date = COALESCE(p_expected_delivery_date, expected_delivery_date)
   WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_po_status(uuid, text, date) TO authenticated;

-- ─── 8. submit_po_invoice() ───────────────────────────────────────────────────
-- Submits an invoice against a PO and auto-classifies match status.
-- status = 'matched' if |discrepancy| < 0.01, else 'pending' (awaiting review).

CREATE OR REPLACE FUNCTION submit_po_invoice(
  p_po_id          uuid,
  p_invoice_number text,
  p_invoice_date   date,
  p_invoice_amount numeric,
  p_notes          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po         purchase_orders%ROWTYPE;
  v_invoice_id uuid;
  v_status     text;
BEGIN
  SELECT * INTO v_po
    FROM purchase_orders
   WHERE id = p_po_id AND hotel_id = auth_hotel_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;

  -- Auto-classify
  v_status := CASE
    WHEN abs(p_invoice_amount - v_po.total_amount) < 0.01 THEN 'matched'
    ELSE 'pending'
  END;

  INSERT INTO po_invoices (
    hotel_id, po_id, invoice_number, invoice_date,
    invoice_amount, po_amount, status, notes, submitted_by
  ) VALUES (
    v_po.hotel_id, p_po_id, p_invoice_number, p_invoice_date,
    p_invoice_amount, v_po.total_amount, v_status, p_notes, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_po_invoice(uuid, text, date, numeric, text) TO authenticated;

-- ─── 9. update_invoice_status() ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_invoice_status(
  p_invoice_id uuid,
  p_status     text,
  p_notes      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admin or owner can approve/dispute invoices';
  END IF;

  UPDATE po_invoices
     SET status      = p_status,
         notes       = COALESCE(p_notes, notes),
         approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
         approved_at = CASE WHEN p_status = 'approved' AND approved_at IS NULL THEN now() ELSE approved_at END
   WHERE id = p_invoice_id
     AND hotel_id = auth_hotel_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_invoice_status(uuid, text, text) TO authenticated;

-- ─── 10. get_po_summary() ─────────────────────────────────────────────────────
-- Returns POs with aggregated line + invoice data for the list view.

CREATE OR REPLACE FUNCTION get_po_summary()
RETURNS TABLE (
  id                     uuid,
  po_number              text,
  supplier_name          text,
  supplier_id            uuid,
  status                 text,
  total_amount           numeric,
  line_count             bigint,
  received_lines         bigint,
  expected_delivery_date date,
  sent_at                timestamptz,
  closed_at              timestamptz,
  created_at             timestamptz,
  invoice_count          bigint,
  invoice_status         text,
  invoice_discrepancy    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    po.id,
    po.po_number,
    po.supplier_name,
    po.supplier_id,
    po.status,
    po.total_amount,
    COUNT(DISTINCT pol.id)              AS line_count,
    COUNT(DISTINCT pol.id) FILTER (WHERE pol.received_qty >= pol.ordered_qty) AS received_lines,
    po.expected_delivery_date,
    po.sent_at,
    po.closed_at,
    po.created_at,
    COUNT(DISTINCT inv.id)              AS invoice_count,
    -- worst invoice status in order: disputed > pending > matched > approved
    CASE
      WHEN bool_or(inv.status = 'disputed') THEN 'disputed'
      WHEN bool_or(inv.status = 'pending')  THEN 'pending'
      WHEN bool_or(inv.status = 'matched')  THEN 'matched'
      WHEN bool_or(inv.status = 'approved') THEN 'approved'
      ELSE NULL
    END                                 AS invoice_status,
    SUM(inv.discrepancy_amount)         AS invoice_discrepancy
  FROM purchase_orders po
  LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
  LEFT JOIN po_invoices inv           ON inv.po_id = po.id
  WHERE po.hotel_id = auth_hotel_id()
  GROUP BY po.id
  ORDER BY
    CASE po.status
      WHEN 'sent'               THEN 1
      WHEN 'confirmed'          THEN 2
      WHEN 'partially_received' THEN 3
      WHEN 'draft'              THEN 4
      WHEN 'closed'             THEN 5
      WHEN 'cancelled'          THEN 6
    END,
    po.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_po_summary() TO authenticated;
