-- Migration 056: Reality Graph Core — Expanded Edge Types + Trigger Coverage
-- Layer: meta (Reality Graph spans all four layers)
-- Purpose: Extend relationship_edges with 9 new edge types covering the full
-- procure-to-pay + approval + demand lifecycle. Add 6 new auto-edge triggers
-- so the graph captures every meaningful causal relationship without any manual
-- wiring by application code. Introduce get_node_context() for 2-hop traversal.
--
-- New EdgeTypes: approved_by, rejected_by, fulfills, sourced_from, batch_of,
--               discarded_via, linked_to_po, invoiced_by, influenced_by
-- New NodeTypes (logical — no new tables): supplier, product_batch,
--               restock_receive, purchase_order, po_invoice, occupancy_log

SET search_path = public;

-- ─── 1. Expand edge_type CHECK constraint ─────────────────────────────────────
-- Drop the inline CHECK added in migration 018 and replace with the full set.

ALTER TABLE relationship_edges
  DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;

ALTER TABLE relationship_edges
  ADD CONSTRAINT relationship_edges_edge_type_check
  CHECK (edge_type IN (
    -- original
    'belongs_to_hotel', 'created_by', 'causes',
    'consumes', 'restocks', 'reverts',
    'belongs_to_session', 'triggered_alert',
    -- approval layer
    'approved_by', 'rejected_by',
    -- fulfillment
    'fulfills', 'sourced_from',
    -- batch / expiry
    'batch_of', 'discarded_via',
    -- procurement
    'linked_to_po', 'invoiced_by',
    -- demand sensing
    'influenced_by'
  ));

-- ─── 2. Trigger: restock approval / rejection edges ───────────────────────────
-- restock_request --approved_by--> user  (on status → 'approved')
-- restock_request --rejected_by--> user  (on status → 'rejected')

CREATE OR REPLACE FUNCTION trg_restock_approval_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
    AND OLD.status IS DISTINCT FROM 'approved'
    AND NEW.approved_by IS NOT NULL
  THEN
    PERFORM create_relationship_edge(
      NEW.hotel_id,
      'restock_request', NEW.id,
      'approved_by',
      'user', NEW.approved_by,
      jsonb_build_object('tier', NEW.required_approval_tier, 'notes', NEW.approval_notes)
    );
  END IF;

  IF NEW.status = 'rejected'
    AND OLD.status IS DISTINCT FROM 'rejected'
    AND NEW.rejected_by IS NOT NULL
  THEN
    PERFORM create_relationship_edge(
      NEW.hotel_id,
      'restock_request', NEW.id,
      'rejected_by',
      'user', NEW.rejected_by,
      jsonb_build_object('reason', NEW.rejected_reason)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restock_approval_edges
  AFTER UPDATE ON restock_requests
  FOR EACH ROW EXECUTE FUNCTION trg_restock_approval_edges();

-- ─── 3. Trigger: restock receive → fulfills → restock_request ─────────────────
-- Records which receive event fulfilled which request.

CREATE OR REPLACE FUNCTION trg_restock_receive_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_id IS NOT NULL THEN
    PERFORM create_relationship_edge(
      NEW.hotel_id,
      'restock_receive', NEW.id,
      'fulfills',
      'restock_request', NEW.request_id,
      jsonb_build_object('quantity_received', NEW.quantity_received)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restock_receive_edges
  AFTER INSERT ON restock_receives
  FOR EACH ROW EXECUTE FUNCTION trg_restock_receive_edges();

-- ─── 4. Trigger: product_batch → batch_of → variant ──────────────────────────
-- Every delivered batch is a specific instance of a variant.

CREATE OR REPLACE FUNCTION trg_product_batch_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_relationship_edge(
    NEW.hotel_id,
    'product_batch', NEW.id,
    'batch_of',
    'variant', NEW.variant_id,
    jsonb_build_object('quantity', NEW.quantity, 'expiry_date', NEW.expiry_date)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_batch_edges
  AFTER INSERT ON product_batches
  FOR EACH ROW EXECUTE FUNCTION trg_product_batch_edges();

-- ─── 5. Trigger: restock_request → linked_to_po → purchase_order ─────────────
-- When a PO line references a restock request, wire the graph edge.

CREATE OR REPLACE FUNCTION trg_po_line_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_id IS NOT NULL THEN
    PERFORM create_relationship_edge(
      NEW.hotel_id,
      'restock_request', NEW.request_id,
      'linked_to_po',
      'purchase_order', NEW.po_id,
      jsonb_build_object('variant_id', NEW.variant_id, 'ordered_qty', NEW.ordered_qty)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_line_edges
  AFTER INSERT ON purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION trg_po_line_edges();

-- ─── 6. Trigger: purchase_order → invoiced_by → po_invoice ───────────────────
-- Every submitted invoice is an outbound edge from its parent PO.

CREATE OR REPLACE FUNCTION trg_po_invoice_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_relationship_edge(
    NEW.hotel_id,
    'purchase_order', NEW.po_id,
    'invoiced_by',
    'po_invoice', NEW.id,
    jsonb_build_object(
      'invoice_number',     NEW.invoice_number,
      'invoice_amount',     NEW.invoice_amount,
      'discrepancy_amount', NEW.discrepancy_amount,
      'status',             NEW.status
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_invoice_edges
  AFTER INSERT ON po_invoices
  FOR EACH ROW EXECUTE FUNCTION trg_po_invoice_edges();

-- ─── 7. Trigger: stock_log → influenced_by → occupancy_log ───────────────────
-- When a stock movement is recorded and occupancy data exists for the same
-- calendar date, wire the cross-domain edge so the Eye Layer can surface
-- demand-driven consumption patterns (high occupancy → elevated burn rate).

CREATE OR REPLACE FUNCTION trg_stock_log_occupancy_edge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occ_id   uuid;
  v_hotel_id uuid;
  v_log_date date;
BEGIN
  -- Resolve hotel_id via product_variants → products
  SELECT p.hotel_id INTO v_hotel_id
  FROM   product_variants pv
  JOIN   products p ON p.id = pv.product_id
  WHERE  pv.id = NEW.variant_id;

  IF v_hotel_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_log_date := NEW.created_at::date;

  SELECT id INTO v_occ_id
  FROM   occupancy_logs
  WHERE  hotel_id = v_hotel_id AND date = v_log_date
  LIMIT  1;

  IF v_occ_id IS NOT NULL THEN
    PERFORM create_relationship_edge(
      v_hotel_id,
      'stock_log', NEW.id,
      'influenced_by',
      'occupancy_log', v_occ_id,
      jsonb_build_object('date', v_log_date, 'delta', NEW.quantity_change)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach as a second trigger on stock_logs (alongside the existing
-- trg_stock_log_edges which creates consumes/reverts edges).
CREATE TRIGGER trg_stock_log_occupancy_edge
  AFTER INSERT ON stock_logs
  FOR EACH ROW EXECUTE FUNCTION trg_stock_log_occupancy_edge();

-- ─── 8. Update discard_batch() — add discarded_via edge ───────────────────────
-- product_batch --discarded_via--> stock_log
-- Links the expiry write-off event back to the batch so the Eye Layer can
-- attribute waste cost to specific batches, not just variants.

CREATE OR REPLACE FUNCTION discard_batch(
  p_batch_id uuid,
  p_reason   text DEFAULT 'Expired — written off'
)
RETURNS TABLE (log_id uuid, new_balance integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_variant_id  uuid;
  v_hotel_id    uuid;
  v_quantity    integer;
  v_log_id      uuid;
  v_new_balance integer;
BEGIN
  SELECT pb.variant_id, pb.hotel_id, pb.quantity
  INTO   v_variant_id, v_hotel_id, v_quantity
  FROM   product_batches pb
  WHERE  pb.id = p_batch_id AND pb.status = 'active' AND pb.quantity > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found or already inactive', p_batch_id;
  END IF;

  -- Decrement stock (floor at 0)
  UPDATE product_variants
  SET    current_stock = GREATEST(current_stock - v_quantity, 0)
  WHERE  id = v_variant_id
  RETURNING current_stock INTO v_new_balance;

  -- Immutable stock log
  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason, removal_category
  )
  VALUES (
    v_hotel_id, v_variant_id, auth.uid(),
    -v_quantity, v_new_balance, p_reason, 'Spoilage'
  )
  RETURNING id INTO v_log_id;

  -- Mark batch discarded, zero out quantity
  UPDATE product_batches
  SET    status = 'discarded', quantity = 0
  WHERE  id = p_batch_id;

  -- Graph edge: batch --discarded_via--> stock_log
  PERFORM create_relationship_edge(
    v_hotel_id,
    'product_batch', p_batch_id,
    'discarded_via',
    'stock_log', v_log_id,
    jsonb_build_object('quantity', v_quantity, 'reason', p_reason)
  );

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION discard_batch(uuid, text) TO authenticated;

-- ─── 9. get_node_context() — 2-hop graph traversal ───────────────────────────
-- Returns all edges within 2 hops of a given node, labeled by hop number.
-- hop=1: edges directly incident on p_node_id (in or out)
-- hop=2: edges incident on hop-1 neighbors, not already in hop-1
--
-- Use cases:
--   get_node_context('variant',          '<id>') → full supply chain context
--   get_node_context('purchase_order',   '<id>') → requests + invoices
--   get_node_context('restock_request',  '<id>') → approval + PO + receive chain
--   get_node_context('product_batch',    '<id>') → variant + waste write-off
--
-- Capped at 500 edges; p_max_hops is for future recursive extension (2 only now).

CREATE OR REPLACE FUNCTION get_node_context(
  p_node_type text,
  p_node_id   uuid,
  p_max_hops  integer DEFAULT 2
)
RETURNS TABLE (
  hop         integer,
  id          uuid,
  edge_type   text,
  source_type text,
  source_id   uuid,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  hop1 AS (
    SELECT
      1                 AS hop,
      re.id,
      re.edge_type,
      re.source_type,
      re.source_id,
      re.target_type,
      re.target_id,
      re.metadata,
      re.created_at
    FROM relationship_edges re
    WHERE re.hotel_id = auth_hotel_id()
      AND (re.source_id = p_node_id OR re.target_id = p_node_id)
  ),
  neighbor_ids AS (
    SELECT source_id AS nid FROM hop1
    UNION
    SELECT target_id AS nid FROM hop1
  ),
  hop2 AS (
    SELECT DISTINCT
      2                 AS hop,
      re.id,
      re.edge_type,
      re.source_type,
      re.source_id,
      re.target_type,
      re.target_id,
      re.metadata,
      re.created_at
    FROM relationship_edges re
    WHERE re.hotel_id = auth_hotel_id()
      AND (
        re.source_id IN (SELECT nid FROM neighbor_ids)
        OR re.target_id IN (SELECT nid FROM neighbor_ids)
      )
      AND re.id NOT IN (SELECT id FROM hop1)
  )
  SELECT * FROM hop1
  UNION ALL
  SELECT * FROM hop2
  ORDER BY hop, created_at DESC
  LIMIT 500
$$;

GRANT EXECUTE ON FUNCTION get_node_context(text, uuid, integer) TO authenticated;
