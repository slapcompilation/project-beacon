-- ─── Batch stocktake RPC ─────────────────────────────────────────────────────
-- Applies all stocktake adjustments atomically in one transaction.
-- If any single adjustment fails the entire batch rolls back, so partial
-- commits are impossible even if the client disconnects mid-flight.
--
-- p_adjustments: [{variant_id: uuid, delta: int, reason: text}, ...]

CREATE OR REPLACE FUNCTION batch_stocktake(p_adjustments jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  adj           jsonb;
  v_variant_id  uuid;
  v_delta       integer;
  v_reason      text;
  v_hotel_id    uuid;
  v_new_balance integer;
BEGIN
  FOR adj IN SELECT * FROM jsonb_array_elements(p_adjustments) LOOP
    v_variant_id := (adj->>'variant_id')::uuid;
    v_delta      := (adj->>'delta')::integer;
    v_reason     := adj->>'reason';

    -- Resolve hotel_id; also verifies variant exists and RLS allows access
    SELECT p.hotel_id INTO v_hotel_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
     WHERE pv.id = v_variant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % not found or access denied', v_variant_id;
    END IF;

    -- Atomic stock update
    UPDATE product_variants
       SET current_stock = current_stock + v_delta
     WHERE id = v_variant_id
    RETURNING current_stock INTO v_new_balance;

    -- Immutable log entry (mirrors adjust_stock logic)
    INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason)
    VALUES (v_hotel_id, v_variant_id, auth.uid(), v_delta, v_new_balance, v_reason);
  END LOOP;
END;
$$;
