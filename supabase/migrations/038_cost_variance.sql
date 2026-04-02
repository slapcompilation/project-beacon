-- Layer: Mind — Cost variance at receiving
-- Adds unit_cost to restock_receives so every delivery line captures the
-- actual invoice price. The receive_restock() RPC is updated to accept it.
-- get_cost_variance_report() surfaces all lines where invoice price deviates
-- from the product's expected cost — the core invoice-matching engine.

SET search_path = public;

-- ─── 1. Add unit_cost to restock_receives ─────────────────────────────────────
-- NULL = cost not recorded at receiving (backwards compatible).

ALTER TABLE restock_receives
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12,4);

-- ─── 2. Update receive_restock() to accept and store unit_cost ────────────────

CREATE OR REPLACE FUNCTION receive_restock(
  p_request_id        uuid,
  p_quantity_received integer,
  p_lot_number        text    DEFAULT NULL,
  p_notes             text    DEFAULT NULL,
  p_unit_cost         numeric DEFAULT NULL
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

  -- Record the receive line (now with optional unit_cost)
  INSERT INTO restock_receives (
    request_id, hotel_id, received_by,
    quantity_received, lot_number, notes, unit_cost
  )
  VALUES (
    p_request_id, v_hotel_id, auth.uid(),
    p_quantity_received, p_lot_number, p_notes, p_unit_cost
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

GRANT EXECUTE ON FUNCTION receive_restock(uuid, integer, text, text, numeric) TO authenticated;

-- ─── 3. get_cost_variance_report() ────────────────────────────────────────────
-- Returns all receive lines where a unit_cost was recorded.
-- Compares against product_variants.cost (the expected/master cost).
-- variance_pct  = (actual - expected) / expected * 100
-- variance_amount = (actual - expected) × quantity_received
-- Positive variance = being overcharged vs master price.
-- Sorted by |variance_amount| DESC — biggest financial impact first.

CREATE OR REPLACE FUNCTION get_cost_variance_report(p_days int DEFAULT 90)
RETURNS TABLE (
  receive_id          uuid,
  received_at         timestamptz,
  product_name        text,
  variant_name        text,
  sku                 text,
  supplier            text,
  quantity_received   int,
  unit_cost_actual    numeric,
  unit_cost_expected  numeric,
  variance_pct        numeric,   -- positive = overcharged
  variance_amount     numeric    -- (actual - expected) × qty; positive = overcharged
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rr2.id                                                                      AS receive_id,
    rr2.received_at,
    p.name                                                                      AS product_name,
    pv.name                                                                     AS variant_name,
    pv.sku,
    COALESCE(rr.supplier, '—')                                                  AS supplier,
    rr2.quantity_received,
    rr2.unit_cost                                                               AS unit_cost_actual,
    pv.cost                                                                     AS unit_cost_expected,
    ROUND(
      CASE
        WHEN pv.cost > 0
        THEN (rr2.unit_cost - pv.cost) / pv.cost * 100
        ELSE NULL
      END,
      2
    )                                                                           AS variance_pct,
    ROUND(
      CASE
        WHEN pv.cost > 0
        THEN (rr2.unit_cost - pv.cost) * rr2.quantity_received
        ELSE NULL
      END,
      2
    )                                                                           AS variance_amount
  FROM restock_receives rr2
  JOIN restock_requests rr  ON rr.id  = rr2.request_id
  JOIN product_variants pv  ON pv.id  = rr.variant_id
  JOIN products p           ON p.id   = pv.product_id
  WHERE rr2.hotel_id   = auth_hotel_id()
    AND rr2.unit_cost  IS NOT NULL
    AND pv.cost        IS NOT NULL
    AND pv.cost        > 0
    AND rr2.received_at >= NOW() - (p_days || ' days')::interval
  ORDER BY ABS((rr2.unit_cost - pv.cost) * rr2.quantity_received) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_cost_variance_report(int) TO authenticated;
