-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 332 — app thumbnails become required, because there is now somewhere
-- to put one.
--
-- G4 was "blocked on a decision, not on code": Foundry requires a thumbnail to
-- promote an application, ours is nullable, and DIVERGENCES records the reason —
-- "a required column nobody can populate is a promotion nobody can make". The
-- open question was where application art lives.
--
-- THE ANSWER IS ITS OWN PUBLIC BUCKET, and the reasoning is what makes it a
-- decision rather than a coin toss:
--
--   NOT `documents`. That bucket is private, sensitivity-marked and PII-scanned,
--   and everything in it goes through the ingestion pipeline. A thumbnail is
--   chrome; running it through OCR and clearance gating would be absurd, and a
--   private bucket cannot serve an <img> without a signed URL per card.
--
--   NOT `product-images`. Right visibility, wrong owner and lifecycle — those
--   belong to inventory and are managed by whoever manages stock. An app
--   thumbnail belongs to whoever curates the portal.
--
-- So `app-art`, public-read like the other two, writable by the admins who can
-- promote in the first place.
--
-- The column can go NOT NULL immediately: there are zero promotions today, so
-- nothing needs backfilling and nobody's app disappears from the portal.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-art', 'app-art', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "app art is readable" ON storage.objects;
CREATE POLICY "app art is readable" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'app-art');

-- Whoever may promote may supply the art. Portal curation is an admin act.
DROP POLICY IF EXISTS "admins write app art" ON storage.objects;
CREATE POLICY "admins write app art" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'app-art' AND auth_role() IN ('owner', 'admin'))
  WITH CHECK (bucket_id = 'app-art' AND auth_role() IN ('owner', 'admin'));

ALTER TABLE public.app_promotions
  ALTER COLUMN thumbnail_url SET NOT NULL;

COMMENT ON COLUMN public.app_promotions.thumbnail_url IS
  'Required, per Foundry''s curating-apps. Lives in the public app-art bucket — chrome, not a document.';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM app_promotions WHERE thumbnail_url IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 332: % promotion(s) still have no thumbnail', n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'app-art' AND public) THEN
    RAISE EXCEPTION 'Migration 332: the app-art bucket is missing or not public';
  END IF;
END $$;

COMMIT;
