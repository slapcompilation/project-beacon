-- Layer: Flow — Storage bucket for product images
-- Mirrors the pattern used for stock-photos (005_stock_log_photo.sql).
-- The bucket is public so image_url values can be rendered without auth headers.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,   -- 5 MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to the bucket
CREATE POLICY "product_images_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Anyone can read (public bucket — needed for <img src> without auth headers)
CREATE POLICY "product_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated users can replace their own uploads
CREATE POLICY "product_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated users can delete
CREATE POLICY "product_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
