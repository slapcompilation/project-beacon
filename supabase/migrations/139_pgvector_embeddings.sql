-- Phase 14.b — pgvector + embeddings.
--
-- Upgrades the tier-1 cache (ApprovedAnswers, Phase 14 v1) from
-- Jaccard token-overlap to true semantic match. Also lays down a
-- document_chunks child table so the document chunks the OCR / Whisper
-- pipelines produced (Phases 16.b / 16.d) become searchable: an agent
-- can ask "find chunks similar to this question" and get back the most
-- relevant page-level snippets across every document in the hotel.
--
-- Embeddings come from OpenAI text-embedding-3-small (1536 dims) via the
-- new embed-text edge function. The vector column stays NULL for
-- existing rows until they're embedded (lazily on next write / curate /
-- ingestion). Cosine similarity ranks results — pgvector's `<=>`
-- operator returns distance, so we sort ascending and threshold low.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. approved_answers gets an embedding ──────────────────────────────────

ALTER TABLE approved_answers
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- IVFFlat for cosine works well at our scale (< 100k rows per hotel).
-- HNSW would be faster but pgvector's IVFFlat is universally available.
CREATE INDEX IF NOT EXISTS idx_approved_answers_embedding
  ON approved_answers USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON COLUMN approved_answers.embedding IS
  'OpenAI text-embedding-3-small vector. NULL means the row predates embedding or the embed call failed; the cache lookup falls back to the Jaccard path when this is NULL.';

-- match_approved_answers — server-side cosine similarity match.
-- Returns the N best matches above the threshold. Used by useCopilotChat
-- to serve tier-1 hits before invoking the LLM.
CREATE OR REPLACE FUNCTION match_approved_answers(
  p_hotel_id  uuid,
  p_query     vector(1536),
  p_threshold float DEFAULT 0.78,
  p_limit     int   DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  question    text,
  answer      text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    a.id,
    a.question,
    a.answer,
    1 - (a.embedding <=> p_query) AS similarity
  FROM approved_answers a
  WHERE a.hotel_id   = p_hotel_id
    AND a.retired_at IS NULL
    AND a.embedding  IS NOT NULL
    AND 1 - (a.embedding <=> p_query) >= p_threshold
  ORDER BY a.embedding <=> p_query
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION match_approved_answers(uuid, vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_approved_answers(uuid, vector, float, int) TO authenticated;

-- ── 2. document_chunks child table ─────────────────────────────────────────
--
-- documents.chunks is a jsonb array (Phase 16.a). For semantic search we
-- need each chunk as its own row with a vector column. The two surfaces
-- coexist: documents.chunks remains the canonical preview store for the
-- detail page; document_chunks is the searchable embedding store.

CREATE TABLE IF NOT EXISTS document_chunks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  hotel_id      uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,

  /** Stable chunk identifier within the document. Mirrors
   *  documents.chunks[].chunk_id so callers can correlate. */
  chunk_key     text        NOT NULL,
  /** Page (PDF) / segment index (Whisper) / 1 (image). */
  page          int         NOT NULL,
  /** Up to 240 chars for compact previews. */
  text_preview  text        NOT NULL,
  /** Full chunk text — populated when available; preview-only ingestion
   *  paths (current vision pipeline) leave this NULL. */
  text_full     text,

  embedding     vector(1536),

  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (document_id, chunk_key)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc
  ON document_chunks (document_id, page);

CREATE INDEX IF NOT EXISTS idx_document_chunks_hotel
  ON document_chunks (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE document_chunks IS
  'Phase 14.b — searchable embedding store for document chunks. Mirrors documents.chunks[] entries one-row-per-chunk.';

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read chunks in scope" ON document_chunks;
CREATE POLICY "users read chunks in scope" ON document_chunks
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users write chunks in scope" ON document_chunks;
CREATE POLICY "users write chunks in scope" ON document_chunks
  FOR ALL TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- match_document_chunks — semantic search across chunks in a hotel.
-- Used by the new query_document_chunks Logic Tool (agent-side).
CREATE OR REPLACE FUNCTION match_document_chunks(
  p_hotel_id  uuid,
  p_query     vector(1536),
  p_threshold float DEFAULT 0.70,
  p_limit     int   DEFAULT 8
)
RETURNS TABLE (
  id            uuid,
  document_id   uuid,
  chunk_key     text,
  page          int,
  text_preview  text,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_key,
    c.page,
    c.text_preview,
    1 - (c.embedding <=> p_query) AS similarity
  FROM document_chunks c
  WHERE c.hotel_id  = p_hotel_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_query) >= p_threshold
  ORDER BY c.embedding <=> p_query
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION match_document_chunks(uuid, vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_document_chunks(uuid, vector, float, int) TO authenticated;

COMMIT;
