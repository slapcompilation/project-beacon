-- Migration: 041_never_stocked_indicator
-- Layer: Flow — ontological distinction between "never stocked" and "depleted"
--
-- Adds has_stock_history boolean to product_variants.
-- FALSE  = variant was created but has never received positive inbound stock → "Never stocked"
-- TRUE   = variant has received at least one positive stock log → may be depleted, but existed
--
-- This powers the AlertsPage distinction:
--   current_stock = 0 AND has_stock_history = false → info band "Needs initial stock"
--   current_stock = 0 AND has_stock_history = true  → critical band "Out of stock"

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS has_stock_history boolean NOT NULL DEFAULT false;

-- Backfill: mark all variants that already have at least one positive stock log
UPDATE product_variants pv
SET has_stock_history = true
WHERE EXISTS (
  SELECT 1 FROM stock_logs sl
  WHERE sl.variant_id = pv.id
    AND sl.quantity_change > 0
);

-- Trigger function: flip has_stock_history = true on first positive inbound log
CREATE OR REPLACE FUNCTION trg_fn_update_stock_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity_change > 0 THEN
    UPDATE product_variants
    SET has_stock_history = true
    WHERE id = NEW.variant_id
      AND has_stock_history = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_history_flag ON stock_logs;
CREATE TRIGGER trg_stock_history_flag
  AFTER INSERT ON stock_logs
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_update_stock_history();
