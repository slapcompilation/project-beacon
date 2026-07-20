-- Migration 203: Foundry-exact chunk grain + cited_in provenance edges (Track 1, P2-P4)
-- Layer: data
--
-- The doc-ingestion pipeline moves from 1-chunk-per-page-preview to the
-- Foundry reference grain: full page text split into 512-char overlapping
-- chunks, keyed by the composite docId_page_chunk. Foundry keeps pageNumber
-- AND chunkNumber as columns alongside the composite chunkId; we mirror that.

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS chunk_number int NOT NULL DEFAULT 1;

COMMENT ON COLUMN document_chunks.chunk_number IS
  'Position of this chunk within its page (1-based). chunk_key = <document_id>_<page>_<chunk_number>.';

COMMENT ON COLUMN document_chunks.text_full IS
  'Full chunk text (~512 chars, 128 overlap). Always written by document-ingest since Track 1; the embedding is computed over this, not the preview.';

-- cited_in edges (document -> chunk) are derived provenance, not audit events:
-- re-ingesting a document replaces its chunk rows (new ids), so the old edges
-- would dangle. The append-only rule on relationship_edges protects the audit
-- trail; provenance sync edges get a narrow delete carve-out instead.
DROP POLICY IF EXISTS "re_delete_provenance" ON relationship_edges;
CREATE POLICY "re_delete_provenance" ON relationship_edges
  FOR DELETE TO authenticated
  USING (edge_type = 'cited_in' AND hotel_is_in_user_scope(hotel_id));

-- Fast lookup for "which chunks does this document cite" + the refresh delete.
CREATE INDEX IF NOT EXISTS idx_re_cited_in_source
  ON relationship_edges (source_id) WHERE edge_type = 'cited_in';
