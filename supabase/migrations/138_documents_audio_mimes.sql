-- Phase 16.d — expand documents bucket allowed_mime_types for Whisper.
-- The 16.a bucket allowed mpeg/wav/webm/mp4. Phase 16.d adds m4a + ogg
-- since both are common audio capture formats (iPhone VM, Android recorder).
-- Idempotent: re-running is safe.

BEGIN;

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY(
     SELECT DISTINCT unnest(
       coalesce(allowed_mime_types, ARRAY[]::text[])
       || ARRAY['audio/x-m4a', 'audio/ogg']
     )
   )
 WHERE id = 'documents';

COMMIT;
