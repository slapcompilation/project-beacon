-- Migration 058: Receive → Batch + Supplier FK + FEFO + Supplier Waste Analytics
-- Layer: Flow (batch auto-creation on receive) + Eye (FEFO picks, supplier waste)
-- Sprint 3 focused scope:
--   1. supplier_id FK on restock_receives and product_batches
--   2. receive_restock() always creates a batch (not just when expiry provided)
--   3. sourced_from edge auto-wired when supplier_id provided
--   4. get_fefo_batch_map() — earliest-expiring active batch per variant
--   5. get_supplier_waste_analytics() — waste rate by supplier for Eye Layer

SET search_path = public;

-- ─── 1. supplier_id on restock_receives ───────────────────────────────────────

ALTER TABLE restock_receives
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receives_supplier ON restock_receives (supplier_id)
  WHERE supplier_id IS NOT NULL;

-- ─── 2. supplier_id on product_batches ────────────────────────────────────────

ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_batches_supplier ON product_batches (supplier_id)
  WHERE supplier_id IS NOT NULL;

-- ─── 3. receive_restock() — always create batch + supplier linkage ─────────────
-- Breaking change: batch is now created for every receive, not just when expiry
-- is supplied. Batches without expiry_date are valid (lot tracking without dates).
-- Adds p_supplier_id parameter — fully backwards compatible (DEFAULT NULL).

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

  -- Check cumulative received
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

-- ─── 4. get_fefo_batch_map() — FEFO pick suggestions ─────────────────────────
-- Returns the earliest-expiring active batch for each variant that has stock.
-- FEFO = First Expired, First Out. Variants with no active batches are excluded.
-- Used by PickListsPage to show "Use Lot X · exp [date]" inline per item.
-- Batches without expiry_date sort LAST (no expiry = not urgent to use first).

CREATE OR REPLACE FUNCTION get_fefo_batch_map()
RETURNS TABLE (
  variant_id        uuid,
  batch_id          uuid,
  lot_number        text,
  expiry_date       date,
  quantity          integer,
  days_until_expiry integer,
  supplier_id       uuid,
  supplier_name     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (pb.variant_id)
    pb.variant_id,
    pb.id              AS batch_id,
    pb.lot_number,
    pb.expiry_date,
    pb.quantity,
    (pb.expiry_date - CURRENT_DATE)::integer AS days_until_expiry,
    pb.supplier_id,
    s.name             AS supplier_name
  FROM product_batches pb
  LEFT JOIN suppliers s ON s.id = pb.supplier_id
  WHERE pb.hotel_id = auth_hotel_id()
    AND pb.status   = 'active'
    AND pb.quantity > 0
  ORDER BY pb.variant_id,
           pb.expiry_date ASC NULLS LAST,  -- FEFO: earliest expiry first; no date = last
           pb.received_at ASC              -- tie-break: older lot first
$$;

GRANT EXECUTE ON FUNCTION get_fefo_batch_map() TO authenticated;

-- ─── 5. get_supplier_waste_analytics() — Eye Layer ────────────────────────────
-- Aggregates waste (discarded batches) by supplier over the lookback window.
-- Requires supplier_id FK on product_batches — populated from migration 058+.
-- Only suppliers with at least one batch in the window appear.

CREATE OR REPLACE FUNCTION get_supplier_waste_analytics(p_days integer DEFAULT 90)
RETURNS TABLE (
  supplier_id      uuid,
  supplier_name    text,
  batches_received bigint,
  batches_wasted   bigint,
  waste_rate_pct   numeric,
  units_wasted     bigint,
  cost_wasted      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id                                                                    AS supplier_id,
    s.name                                                                  AS supplier_name,
    COUNT(pb.id)                                                            AS batches_received,
    COUNT(pb.id) FILTER (WHERE pb.status = 'discarded')                    AS batches_wasted,
    ROUND(
      100.0
        * COUNT(pb.id) FILTER (WHERE pb.status = 'discarded')
        / NULLIF(COUNT(pb.id), 0),
      1
    )                                                                       AS waste_rate_pct,
    COALESCE(
      SUM(pb.quantity) FILTER (WHERE pb.status = 'discarded'), 0
    )                                                                       AS units_wasted,
    COALESCE(
      SUM(
        CASE WHEN pb.status = 'discarded'
          THEN pb.quantity * COALESCE(pv.cost, 0)
          ELSE 0
        END
      ), 0
    )                                                                       AS cost_wasted
  FROM suppliers s
  JOIN product_batches pb ON pb.supplier_id = s.id
  JOIN product_variants pv ON pv.id = pb.variant_id
  WHERE s.hotel_id = auth_hotel_id()
    AND pb.received_at >= now() - (p_days || ' days')::interval
  GROUP BY s.id, s.name
  HAVING COUNT(pb.id) > 0
  ORDER BY waste_rate_pct DESC NULLS LAST, units_wasted DESC
$$;

GRANT EXECUTE ON FUNCTION get_supplier_waste_analytics(integer) TO authenticated;
