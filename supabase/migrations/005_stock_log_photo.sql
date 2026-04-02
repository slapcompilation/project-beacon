-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Stock Log Photo Support
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Add photo_url column ─────────────────────────────────────────────────
ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS photo_url text;

-- ─── 2. Update adjust_stock RPC to accept optional photo URL ─────────────────
-- p_photo_url defaults to NULL so all existing callers continue to work.
CREATE OR REPLACE FUNCTION adjust_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_reason     text,
  p_photo_url  text DEFAULT NULL
)
RETURNS TABLE(log_id uuid, new_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hotel_id    uuid;
  v_new_balance integer;
  v_log_id      uuid;
BEGIN
  SELECT p.hotel_id INTO v_hotel_id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found or access denied';
  END IF;

  UPDATE product_variants
  SET current_stock = current_stock + p_delta
  WHERE id = p_variant_id
  RETURNING current_stock INTO v_new_balance;

  INSERT INTO stock_logs (
    hotel_id, variant_id, user_id,
    quantity_change, balance_after, reason, photo_url
  )
  VALUES (
    v_hotel_id, p_variant_id, auth.uid(),
    p_delta, v_new_balance, p_reason, p_photo_url
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_log_id, v_new_balance;
END;
$$;

-- ─── 3. Storage bucket setup ──────────────────────────────────────────────────
-- Create the 'stock-photos' bucket manually in Supabase Dashboard:
--   Storage → New bucket → Name: "stock-photos" → Public: ON
-- Then add this policy so authenticated users can upload:
--
--   CREATE POLICY "authenticated_upload" ON storage.objects
--     FOR INSERT TO authenticated
--     WITH CHECK (bucket_id = 'stock-photos');
--
--   CREATE POLICY "public_read" ON storage.objects
--     FOR SELECT USING (bucket_id = 'stock-photos');
