-- ─── Suppliers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name        text NOT NULL,
  contact_name text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON suppliers
  USING (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

-- ─── Low-stock alert trigger ─────────────────────────────────────────────────
-- Fires after every UPDATE on product_variants.
-- Inserts one notification per profile in the hotel when current_stock drops
-- to or below low_stock_threshold (and threshold > 0).
-- Deduplicates: skips insert if an unread low_stock notification for that
-- variant already exists in the hotel.

CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid;
  v_product_name text;
  v_variant_label text;
  v_already_notified boolean;
  rec record;
BEGIN
  -- Only act when stock changed and is now at or below threshold
  IF NEW.current_stock > NEW.low_stock_threshold
     OR NEW.low_stock_threshold <= 0
     OR NEW.current_stock = OLD.current_stock THEN
    RETURN NEW;
  END IF;

  -- Resolve hotel_id from the parent product
  SELECT p.hotel_id, p.name
    INTO v_hotel_id, v_product_name
    FROM products p
   WHERE p.id = NEW.product_id;

  IF v_hotel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build a human-readable variant label
  v_variant_label := CASE
    WHEN NEW.name IS NOT NULL AND NEW.name <> '' THEN v_product_name || ' — ' || NEW.name
    ELSE v_product_name
  END;

  -- Deduplication: skip if an unread low_stock notification for this variant exists
  SELECT EXISTS (
    SELECT 1 FROM notifications
     WHERE hotel_id = v_hotel_id
       AND type = 'low_stock'
       AND read = false
       AND message LIKE '%' || NEW.sku || '%'
  ) INTO v_already_notified;

  IF v_already_notified THEN
    RETURN NEW;
  END IF;

  -- Insert one notification per team member in the hotel
  FOR rec IN
    SELECT id FROM profiles WHERE hotel_id = v_hotel_id
  LOOP
    INSERT INTO notifications (hotel_id, user_id, message, type)
    VALUES (
      v_hotel_id,
      rec.id,
      v_variant_label || ' is low on stock (' || NEW.current_stock || ' left, SKU: ' || NEW.sku || ')',
      'low_stock'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON product_variants;

CREATE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF current_stock ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();
