-- Migration 033: Required custom fields, variant status, set_variant_stock RPC

-- ─── 1. Required flag on custom field definitions ──────────────────────────

ALTER TABLE product_custom_field_defs
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;

-- ─── 2. Variant status workflow ────────────────────────────────────────────
-- Statuses: available (default), in_use, maintenance, retired, ordered

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available'
  CHECK (status IN ('available', 'in_use', 'maintenance', 'retired', 'ordered'));

-- ─── 3. set_variant_stock — for cycle-count bulk import ────────────────────
-- Sets a variant to an absolute stock level, logging the delta as an audit entry.
-- Returns the delta applied (positive = increase, negative = decrease).

CREATE OR REPLACE FUNCTION set_variant_stock(
  p_variant_id uuid,
  p_new_stock  int,
  p_note       text DEFAULT 'Bulk import update'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current  int;
  v_delta    int;
  v_hotel_id uuid := auth_hotel_id();
BEGIN
  SELECT current_stock INTO v_current
  FROM product_variants pv
  JOIN products pr ON pr.id = pv.product_id
  WHERE pv.id = p_variant_id
    AND pr.hotel_id = v_hotel_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found or access denied';
  END IF;

  v_delta := p_new_stock - v_current;
  IF v_delta = 0 THEN RETURN 0; END IF;

  UPDATE product_variants SET current_stock = p_new_stock WHERE id = p_variant_id;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason,
    is_revert, revert_of, sync_batch_id, was_offline
  ) VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    v_delta, p_new_stock, p_note,
    false, null, null, false
  );

  RETURN v_delta;
END;
$$;

GRANT EXECUTE ON FUNCTION set_variant_stock(uuid, int, text) TO authenticated;
