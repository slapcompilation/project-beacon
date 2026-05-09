-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 125 — Restore SELECT on storage.objects for authenticated users
--
-- Layer: meta — fixes Bug A2 (Live Stock images don't appear after upload)
--
-- What broke
-- ──────────
-- Migration 121 dropped two SELECT policies on storage.objects:
--   • product_images_read  (bucket = 'product-images')
--   • public_read          (bucket = 'stock-photos')
--
-- The lint advisor flagged them as "public bucket allows listing" and the
-- assumption was that public buckets don't need a SELECT policy because
-- public URL access bypasses RLS.
--
-- That assumption was incomplete. The Supabase storage client's
-- `.upload(path, file, { upsert: true })` calls fall over without SELECT:
-- upsert needs to check whether the object already exists, which goes through
-- RLS on storage.objects. With the SELECT policy gone, upserts to these
-- buckets started silently failing — which is exactly what we observed:
-- products created on May 8/9 all have `image_url = null` while the file
-- never landed in storage.objects.
--
-- The fix
-- ───────
-- Restore the SELECT policy but **scoped to `authenticated` only** (not
-- public/anon). Authenticated users get the storage interactions back; anon
-- listing — the actual concern of the lint — stays blocked.
--
-- Public URL access (GET https://.../storage/v1/object/public/<bucket>/<path>)
-- continues to work as before; it never went through RLS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "product_images_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "stock_photos_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'stock-photos');

-- ─── Verification ────────────────────────────────────────────────────────────
--
-- After applying:
--
--   -- Confirm the two SELECT policies are present + scoped to authenticated only
--   SELECT polname, polcmd, polroles::regrole[]::text AS roles
--   FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polcmd = 'r'
--   ORDER BY polname;
--   -- expected:
--   --   product_images_select_authenticated  | r | {authenticated}
--   --   stock_photos_select_authenticated    | r | {authenticated}
--
-- Manual smoke test:
--   1. Add a product with an image via the UI.
--   2. Confirm the row in `products` has a non-null `image_url`.
--   3. Confirm a corresponding row appears in `storage.objects`.
--   4. Confirm the image renders in the inventory list.
