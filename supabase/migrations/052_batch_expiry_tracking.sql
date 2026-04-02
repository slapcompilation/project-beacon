-- Migration 052: Per-batch expiry tracking
-- Layer: Flow (receiving) + Eye (expiry intelligence)
-- Purpose: Each delivery with an expiry date creates a product_batches record.
-- Enables FIFO, multi-lot tracking, and accurate per-batch cost-at-risk.
-- The existing variant-level expiry_date is preserved for backwards compatibility.

SET search_path = public;

-- ─── 1. product_batches table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_batches (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid        NOT NULL REFERENCES hotels(id)           ON DELETE CASCADE,
  variant_id   uuid        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  lot_number   text,
  expiry_date  date,
  quantity     integer     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  received_at  timestamptz NOT NULL DEFAULT now(),
  receive_id   uuid        REFERENCES restock_receives(id)          ON DELETE SET NULL,
  notes        text,
  status       text        NOT NULL DEFAULT 'active',
  CONSTRAINT valid_batch_status CHECK (status IN ('active', 'depleted', 'expired', 'discarded'))
);

ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON product_batches
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON product_batches
  FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_update" ON product_batches
  FOR UPDATE USING (hotel_id = auth_hotel_id());

-- Fast expiry alert query: hotel + date + status
CREATE INDEX IF NOT EXISTS idx_batches_expiry
  ON product_batches (hotel_id, expiry_date, status)
  WHERE expiry_date IS NOT NULL AND status = 'active';

-- Fast variant batch lookup
CREATE INDEX IF NOT EXISTS idx_batches_variant
  ON product_batches (variant_id, status);

COMMENT ON TABLE product_batches IS
  'Per-batch inventory tracking. Each received delivery with an expiry date creates a batch '
  'record, enabling FIFO, multi-lot expiry management, and accurate cost-at-risk calculations.';

-- ─── 2. Update receive_restock() to create batch records when expiry provided ──
-- Adds p_expiry_date (DEFAULT NULL) — fully backwards-compatible.

CREATE OR REPLACE FUNCTION receive_restock(
  p_request_id        uuid,
  p_quantity_received integer,
  p_lot_number        text    DEFAULT NULL,
  p_notes             text    DEFAULT NULL,
  p_unit_cost         numeric DEFAULT NULL,
  p_expiry_date       date    DEFAULT NULL
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

  -- Record the receive line (with optional unit_cost)
  INSERT INTO restock_receives (
    request_id, hotel_id, received_by,
    quantity_received, lot_number, notes, unit_cost
  )
  VALUES (
    p_request_id, v_hotel_id, auth.uid(),
    p_quantity_received, p_lot_number, p_notes, p_unit_cost
  )
  RETURNING id INTO v_receive_id;

  -- Create a batch record when expiry date is provided (enables per-lot tracking)
  IF p_expiry_date IS NOT NULL THEN
    INSERT INTO product_batches (
      hotel_id, variant_id, lot_number, expiry_date,
      quantity, receive_id, notes
    )
    VALUES (
      v_hotel_id, v_variant_id, p_lot_number, p_expiry_date,
      p_quantity_received, v_receive_id, p_notes
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

GRANT EXECUTE ON FUNCTION receive_restock(uuid, integer, text, text, numeric, date) TO authenticated;

-- ─── 3. get_expiring_batches() — Eye Layer intelligence ───────────────────────
-- Returns active batches expiring within p_days_ahead, enriched with product
-- context and cost-at-risk. Ordered by expiry ASC (most urgent first).

CREATE OR REPLACE FUNCTION get_expiring_batches(p_days_ahead integer DEFAULT 90)
RETURNS TABLE (
  batch_id          uuid,
  variant_id        uuid,
  variant_name      text,
  sku               text,
  product_name      text,
  category_name     text,
  lot_number        text,
  expiry_date       date,
  quantity          integer,
  unit_cost         numeric,
  cost_at_risk      numeric,
  received_at       timestamptz,
  days_until_expiry integer,
  status            text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pb.id                                        AS batch_id,
    pb.variant_id,
    pv.name                                      AS variant_name,
    pv.sku,
    p.name                                       AS product_name,
    c.name                                       AS category_name,
    pb.lot_number,
    pb.expiry_date,
    pb.quantity,
    pv.cost                                      AS unit_cost,
    ROUND((pb.quantity * pv.cost)::numeric, 2)  AS cost_at_risk,
    pb.received_at,
    (pb.expiry_date - CURRENT_DATE)::integer     AS days_until_expiry,
    pb.status
  FROM product_batches pb
  JOIN product_variants pv ON pv.id = pb.variant_id
  JOIN products p          ON p.id  = pv.product_id
  LEFT JOIN categories c   ON c.id  = p.category_id
  WHERE pb.hotel_id    = auth_hotel_id()
    AND pb.status      = 'active'
    AND pb.quantity    > 0
    AND pb.expiry_date IS NOT NULL
    AND pb.expiry_date <= CURRENT_DATE + p_days_ahead
  ORDER BY pb.expiry_date ASC, pb.quantity DESC;
$$;

GRANT EXECUTE ON FUNCTION get_expiring_batches(integer) TO authenticated;

-- ─── 4. discard_batch() — atomic batch write-off ──────────────────────────────
-- Decrements stock, creates an immutable stock_log (Spoilage), marks batch
-- discarded. Used from the Expiry Radar write-off action.

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

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION discard_batch(uuid, text) TO authenticated;
