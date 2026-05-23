-- Phase 6 — close the Phase 3 plumbing gap.
--
-- approve_stock_transfer(p_transfer_id) atomically:
--   1. resolves the destination variant by name in the destination hotel
--   2. decrements the source variant (and writes a stock_logs row to source hotel)
--   3. increments the destination variant (and writes a stock_logs row to dest hotel)
--   4. flips the transfer to 'completed' with both log ids + approver stamp
--
-- SECURITY DEFINER because a single user is hotel-scoped via auth_hotel_id(),
-- but the function must touch stock_logs in both hotels. We still gate access
-- with hotel_is_in_user_scope() so org-level operators (who scope both) are
-- the only ones who can drive lateral transfers end-to-end.

BEGIN;

CREATE OR REPLACE FUNCTION approve_stock_transfer(p_transfer_id uuid)
RETURNS TABLE(from_log_id uuid, to_log_id uuid, from_balance integer, to_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer       stock_transfers%ROWTYPE;
  v_source_variant product_variants%ROWTYPE;
  v_source_product products%ROWTYPE;
  v_dest_variant_id uuid;
  v_dest_balance   integer;
  v_source_balance integer;
  v_from_log_id    uuid;
  v_to_log_id      uuid;
  v_approver       uuid := auth.uid();
BEGIN
  IF v_approver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer % not found', p_transfer_id;
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer % is %, not pending', p_transfer_id, v_transfer.status;
  END IF;

  -- Caller must have scope on at least one side; refuse outsiders.
  IF NOT (
    hotel_is_in_user_scope(v_transfer.from_hotel_id)
    OR hotel_is_in_user_scope(v_transfer.to_hotel_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve transfer %', p_transfer_id;
  END IF;

  SELECT * INTO v_source_variant FROM product_variants WHERE id = v_transfer.variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source variant % not found', v_transfer.variant_id;
  END IF;

  IF v_source_variant.current_stock < v_transfer.quantity THEN
    RAISE EXCEPTION 'Source has % units, transfer needs %', v_source_variant.current_stock, v_transfer.quantity;
  END IF;

  SELECT * INTO v_source_product FROM products WHERE id = v_source_variant.product_id;

  -- Name-based matching: destination hotel must own a product+variant with the
  -- same names. Future work: persist destination variant on the transfer row.
  SELECT pv.id
    INTO v_dest_variant_id
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE p.hotel_id = v_transfer.to_hotel_id
     AND p.name     = v_source_product.name
     AND pv.name    = v_source_variant.name
   LIMIT 1
   FOR UPDATE;

  IF v_dest_variant_id IS NULL THEN
    RAISE EXCEPTION 'Destination hotel % has no matching variant for %/%',
      v_transfer.to_hotel_id, v_source_product.name, v_source_variant.name;
  END IF;

  -- Source decrement + log
  UPDATE product_variants
     SET current_stock = current_stock - v_transfer.quantity
   WHERE id = v_transfer.variant_id
   RETURNING current_stock INTO v_source_balance;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason
  ) VALUES (
    v_transfer.from_hotel_id, v_transfer.variant_id, v_approver,
    -v_transfer.quantity, v_source_balance,
    'Transfer out: ' || v_transfer.reason || ' (transfer:' || p_transfer_id || ')'
  ) RETURNING id INTO v_from_log_id;

  -- Destination increment + log
  UPDATE product_variants
     SET current_stock = current_stock + v_transfer.quantity
   WHERE id = v_dest_variant_id
   RETURNING current_stock INTO v_dest_balance;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason
  ) VALUES (
    v_transfer.to_hotel_id, v_dest_variant_id, v_approver,
    v_transfer.quantity, v_dest_balance,
    'Transfer in: ' || v_transfer.reason || ' (transfer:' || p_transfer_id || ')'
  ) RETURNING id INTO v_to_log_id;

  -- Close out the transfer
  UPDATE stock_transfers
     SET status              = 'completed',
         approved_by_user_id = v_approver,
         approved_at         = now(),
         from_log_id         = v_from_log_id,
         to_log_id           = v_to_log_id
   WHERE id = p_transfer_id;

  RETURN QUERY SELECT v_from_log_id, v_to_log_id, v_source_balance, v_dest_balance;
END;
$$;

COMMENT ON FUNCTION approve_stock_transfer(uuid) IS
  'Phase 6: atomically completes a stock_transfers row — decrement source, increment destination, write both audit logs, flip status to completed.';

REVOKE ALL ON FUNCTION approve_stock_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_stock_transfer(uuid) TO authenticated;

COMMIT;
