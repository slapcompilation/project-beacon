-- Sprint 18: Floor + Flow Perfection
-- 1. Patch commit_stocktake() to create belongs_to_session edges after commit
-- 2. Add transfer_stock() RPC — moves N units between two variants with graph edge

-- ─── 1. Patch commit_stocktake() ─────────────────────────────────────────────
-- Extends the existing function to also write belongs_to_session edges for
-- every counted line, linking the session node to each touched variant.

CREATE OR REPLACE FUNCTION commit_stocktake(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id    uuid := auth_hotel_id();
  v_adjustments jsonb;
BEGIN
  -- Verify session belongs to this hotel and is still a draft
  IF NOT EXISTS (
    SELECT 1 FROM stocktake_sessions
    WHERE id = p_session_id
      AND hotel_id = v_hotel_id
      AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Session not found or already committed';
  END IF;

  -- Build adjustment payload (only counted lines with a delta)
  SELECT jsonb_agg(
    jsonb_build_object(
      'variant_id', variant_id,
      'delta',      counted_qty - system_qty,
      'reason',     'Stocktake adjustment'
    )
  )
  INTO v_adjustments
  FROM stocktake_lines
  WHERE session_id = p_session_id
    AND counted_qty IS NOT NULL
    AND counted_qty <> system_qty;

  -- Apply all deltas atomically
  IF v_adjustments IS NOT NULL AND jsonb_array_length(v_adjustments) > 0 THEN
    PERFORM batch_stocktake(v_adjustments);
  END IF;

  -- Create belongs_to_session edges for every counted line
  INSERT INTO relationship_edges
    (hotel_id, source_type, source_id, edge_type, target_type, target_id, metadata)
  SELECT
    v_hotel_id,
    'stocktake_session', p_session_id,
    'belongs_to_session',
    'variant', sl.variant_id,
    jsonb_build_object(
      'system_qty',  sl.system_qty,
      'counted_qty', sl.counted_qty,
      'delta',       sl.counted_qty - sl.system_qty
    )
  FROM stocktake_lines sl
  WHERE sl.session_id = p_session_id
    AND sl.counted_qty IS NOT NULL
  ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;

  -- Mark session committed
  UPDATE stocktake_sessions
  SET status = 'committed', committed_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ─── 2. transfer_stock() ──────────────────────────────────────────────────────
-- Moves p_quantity units from one variant to another within the same hotel.
-- Creates two immutable stock_logs and a 'causes' edge linking the debit → credit.
-- Both variants must belong to the authenticated user's hotel.

CREATE OR REPLACE FUNCTION transfer_stock(
  p_from_variant_id uuid,
  p_to_variant_id   uuid,
  p_quantity        integer,
  p_note            text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id      uuid := auth_hotel_id();
  v_from_hotel    uuid;
  v_to_hotel      uuid;
  v_from_balance  integer;
  v_to_balance    integer;
  v_from_log_id   uuid;
  v_to_log_id     uuid;
  v_reason        text;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be a positive integer';
  END IF;

  -- Verify source variant belongs to this hotel
  SELECT p.hotel_id, pv.current_stock
  INTO v_from_hotel, v_from_balance
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = p_from_variant_id;

  IF NOT FOUND OR v_from_hotel <> v_hotel_id THEN
    RAISE EXCEPTION 'Source variant not found or access denied';
  END IF;

  -- Verify destination variant belongs to this hotel
  SELECT p.hotel_id INTO v_to_hotel
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = p_to_variant_id;

  IF NOT FOUND OR v_to_hotel <> v_hotel_id THEN
    RAISE EXCEPTION 'Destination variant not found or access denied';
  END IF;

  IF p_from_variant_id = p_to_variant_id THEN
    RAISE EXCEPTION 'Source and destination variants must be different';
  END IF;

  IF v_from_balance < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for transfer (available: %, requested: %)',
      v_from_balance, p_quantity;
  END IF;

  v_reason := COALESCE(p_note, 'Location transfer');

  -- Deduct from source
  UPDATE product_variants
  SET current_stock = current_stock - p_quantity
  WHERE id = p_from_variant_id
  RETURNING current_stock INTO v_from_balance;

  INSERT INTO stock_logs
    (hotel_id, variant_id, user_id, quantity_change, balance_after, reason)
  VALUES
    (v_hotel_id, p_from_variant_id, auth.uid(), -p_quantity, v_from_balance,
     v_reason || ' (out)')
  RETURNING id INTO v_from_log_id;

  -- Add to destination
  UPDATE product_variants
  SET current_stock = current_stock + p_quantity
  WHERE id = p_to_variant_id
  RETURNING current_stock INTO v_to_balance;

  INSERT INTO stock_logs
    (hotel_id, variant_id, user_id, quantity_change, balance_after, reason)
  VALUES
    (v_hotel_id, p_to_variant_id, auth.uid(), p_quantity, v_to_balance,
     v_reason || ' (in)')
  RETURNING id INTO v_to_log_id;

  -- Wire the two logs together: debit --causes--> credit
  PERFORM create_relationship_edge(
    v_hotel_id,
    'stock_log', v_from_log_id,
    'causes',
    'stock_log', v_to_log_id,
    jsonb_build_object(
      'action',   'transfer',
      'quantity', p_quantity,
      'note',     v_reason
    )
  );
END;
$$;
