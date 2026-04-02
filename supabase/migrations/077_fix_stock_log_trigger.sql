-- Migration 077: Fix stock_log occupancy edge trigger
-- Bug: trg_stock_log_occupancy_edge referenced NEW.created_at but stock_logs
--      uses the column name "timestamp" (not "created_at").
-- This caused "record 'new' has no field 'created_at'" on every stock adjustment.

SET search_path = public;

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

  -- Fix: stock_logs uses "timestamp" not "created_at"
  v_log_date := NEW.timestamp::date;

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
