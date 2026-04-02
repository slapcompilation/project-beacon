-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — RPC Functions
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── adjust_stock ─────────────────────────────────────────────────────────────
-- Atomically updates variant current_stock and inserts an immutable StockLog.
-- Runs as the calling user so RLS applies on all touched tables.

CREATE OR REPLACE FUNCTION adjust_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_reason     text
)
RETURNS TABLE(log_id uuid, new_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hotel_id    uuid;
  v_new_balance integer;
  v_log_id      uuid;
BEGIN
  -- Resolve hotel_id from the variant's product (also implicitly checks access via RLS)
  SELECT p.hotel_id INTO v_hotel_id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found or access denied';
  END IF;

  -- Lock row and update stock atomically
  UPDATE product_variants
  SET current_stock = current_stock + p_delta
  WHERE id = p_variant_id
  RETURNING current_stock INTO v_new_balance;

  -- Insert immutable log entry
  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason
  )
  VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    p_delta, v_new_balance, p_reason
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$$;

-- ─── undo_stock_adjustment ────────────────────────────────────────────────────
-- Creates a compensating transaction for an existing StockLog.
-- The original log is never modified — this appends a new revert entry.

CREATE OR REPLACE FUNCTION undo_stock_adjustment(p_log_id uuid)
RETURNS TABLE(new_log_id uuid, new_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_original    stock_logs%ROWTYPE;
  v_new_balance integer;
  v_new_log_id  uuid;
BEGIN
  SELECT * INTO v_original FROM stock_logs WHERE id = p_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log entry not found or access denied';
  END IF;

  IF v_original.is_revert THEN
    RAISE EXCEPTION 'Cannot undo a revert transaction';
  END IF;

  IF EXISTS (SELECT 1 FROM stock_logs WHERE revert_of = p_log_id) THEN
    RAISE EXCEPTION 'This adjustment has already been undone';
  END IF;

  -- Apply the inverse delta
  UPDATE product_variants
  SET current_stock = current_stock + (-v_original.quantity_change)
  WHERE id = v_original.variant_id
  RETURNING current_stock INTO v_new_balance;

  -- Append the compensating log (immutable)
  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after,
    reason, is_revert, revert_of
  )
  VALUES (
    v_original.hotel_id, v_original.variant_id, auth.uid(),
    -v_original.quantity_change, v_new_balance,
    'Undo: ' || v_original.reason, true, p_log_id
  )
  RETURNING id INTO v_new_log_id;

  RETURN QUERY SELECT v_new_log_id, v_new_balance;
END;
$$;
