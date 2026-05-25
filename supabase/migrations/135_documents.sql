-- Phase 16.a — Document nodes + private storage bucket.
--
-- DocumentPayload has been declared in packages/reality-graph/src/nodes/aip.ts
-- since Phase 0; this migration finally gives it a table + the place files
-- live. OCR/embedding/chunks land in Phase 16.b — the chunks column is
-- reserved here so the upgrade is additive.
--
-- Documents are sensitive (contracts, invoices, scanned forms). The bucket
-- is private; the client reads files via signed URLs scoped per-request.

BEGIN;

-- ── 1. documents table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  title                text        NOT NULL,
  mime_type            text        NOT NULL,
  source               text        NOT NULL DEFAULT 'upload'
                                   CHECK (source IN ('upload','email','integration','ocr-capture')),

  /** Ingestion lifecycle. Stays 'raw' until 16.b's OCR pipeline lifts it
   *  through 'ocr' → 'embedded' → 'contextualized' → 'linked'. */
  ingestion_stage      text        NOT NULL DEFAULT 'raw'
                                   CHECK (ingestion_stage IN ('raw','ocr','embedded','contextualized','linked')),

  /** Storage coordinates. bucket_name is reserved for the day we shard
   *  uploads across buckets; today it's always 'documents'. */
  bucket_name          text        NOT NULL DEFAULT 'documents',
  storage_path         text        NOT NULL,
  size_bytes           bigint      NOT NULL DEFAULT 0,

  page_count           int,
  /** Per-chunk anchors populated by the OCR pipeline.
   *  Shape: [{ chunk_id, page, text_preview }, ...]. NULL until 16.b. */
  chunks               jsonb       DEFAULT NULL,

  uploaded_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_hotel_recent
  ON documents (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_stage
  ON documents (hotel_id, ingestion_stage)
  WHERE ingestion_stage <> 'linked';

COMMENT ON TABLE documents IS
  'Phase 16.a — Document nodes. Mirrors DocumentPayload in @beacon/reality-graph. chunks column reserved for the OCR pipeline (16.b).';

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read documents in scope" ON documents;
CREATE POLICY "users read documents in scope" ON documents
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create documents in scope" ON documents;
CREATE POLICY "users create documents in scope" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update documents in scope" ON documents;
CREATE POLICY "users update documents in scope" ON documents
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users delete documents in scope" ON documents;
CREATE POLICY "users delete documents in scope" ON documents
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

-- ── 2. private storage bucket ──────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                  -- private bucket; files only accessible via signed URLs
  52428800,               -- 50 MB max per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
    'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users read/write objects in the 'documents'
-- bucket. App-level RLS on the documents table is the real authorization
-- boundary (a user only ever sees rows for their hotel; the storage_path
-- is opaque without the row).

DROP POLICY IF EXISTS "documents bucket read"   ON storage.objects;
CREATE POLICY "documents bucket read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents bucket insert" ON storage.objects;
CREATE POLICY "documents bucket insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents bucket update" ON storage.objects;
CREATE POLICY "documents bucket update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents bucket delete" ON storage.objects;
CREATE POLICY "documents bucket delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

COMMIT;
