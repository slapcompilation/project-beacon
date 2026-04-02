-- Sprint 14: Receiving flow + waste/loss categories
-- 1. removal_category column on stock_logs
-- 2. restock_receives table (partial-receive tracking)
-- 3. receive_restock() RPC (atomic: adjust stock + record receive + maybe fulfill)
-- 4. Updated adjust_stock() with optional p_removal_category param

-- ─── 1. Removal category on stock_logs ───────────────────────────────────────

ALTER TABLE stock_logs
  ADD COLUMN IF NOT EXISTS removal_category text
  CHECK (removal_category IN (
    'Breakage', 'Theft', 'Spoilage', 'Consumed', 'Returned to supplier'
  ));

-- Only meaningful on removals, so NULL is valid for additions/reverts.
CREATE INDEX IF NOT EXISTS idx_stock_logs_removal_cat
  ON stock_logs (removal_category)
  WHERE removal_category IS NOT NULL;

-- ─── 2. Restock receives table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restock_receives (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid        NOT NULL REFERENCES restock_requests (id),
  hotel_id          uuid        NOT NULL REFERENCES hotels (id),
  received_by       uuid        REFERENCES auth.users (id),
  quantity_received integer     NOT NULL CHECK (quantity_received > 0),
  lot_number        text,
  notes             text,
  received_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restock_receives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON restock_receives
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON restock_receives
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_receives_request ON restock_receives (request_id);

-- ─── 3. receive_restock() RPC ─────────────────────────────────────────────────
-- Atomically:
--   a) records the receive line
--   b) adjusts variant stock upward by quantity_received
--   c) if cumulative received >= quantity_needed → marks request 'fulfilled'
-- Supports partial receives (multiple calls allowed while status = 'approved').

CREATE OR REPLACE FUNCTION receive_restock(
  p_request_id       uuid,
  p_quantity_received integer,
  p_lot_number       text    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
)
RETURNS TABLE (log_id uuid, new_balance integer, fulfilled boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_variant_id      uuid;
  v_hotel_id        uuid;
  v_quantity_needed integer;
  v_new_balance     integer;
  v_log_id          uuid;
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

  -- Insert stock log
  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason,
    removal_category
  )
  VALUES (
    v_hotel_id, v_variant_id, auth.uid(),
    p_quantity_received, v_new_balance,
    'Received against restock request',
    NULL
  )
  RETURNING id INTO v_log_id;

  -- Record the receive line
  INSERT INTO restock_receives (
    request_id, hotel_id, received_by,
    quantity_received, lot_number, notes
  )
  VALUES (
    p_request_id, v_hotel_id, auth.uid(),
    p_quantity_received, p_lot_number, p_notes
  );

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

-- ─── 4. Update adjust_stock() with optional removal_category ─────────────────
-- Adds p_removal_category parameter (DEFAULT NULL) — fully backwards-compatible.
-- This recreates the function from its original definition plus the new param.

CREATE OR REPLACE FUNCTION adjust_stock(
  p_variant_id       uuid,
  p_delta            integer,
  p_reason           text,
  p_photo_url        text    DEFAULT NULL,
  p_removal_category text    DEFAULT NULL
)
RETURNS TABLE (log_id uuid, new_balance integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_hotel_id    uuid;
  v_new_balance integer;
  v_log_id      uuid;
BEGIN
  SELECT p.hotel_id INTO v_hotel_id
  FROM   product_variants pv
  JOIN   products p ON p.id = pv.product_id
  WHERE  pv.id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant % not found', p_variant_id;
  END IF;

  UPDATE product_variants
  SET    current_stock = current_stock + p_delta
  WHERE  id = p_variant_id
  RETURNING current_stock INTO v_new_balance;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason,
    photo_url, removal_category
  )
  VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    p_delta, v_new_balance, p_reason,
    p_photo_url, p_removal_category
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$$;
