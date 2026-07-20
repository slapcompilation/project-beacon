-- Migration 204: Foundry-exact object model for documents (Track 2, P5-P6)
-- Layer: data
--
-- P5: each chunk gains an LLM summary; the embedding is computed over the
-- summary (Foundry reference: embed the summary, keep content as a property).
-- P6: discovered Entity nodes (fixed hospitality categories, deduped per
-- hotel) + chunk -mentions-> entity edges. Foundry's Entity object type has
-- PK entityName; multi-tenant Beacon dedupes on (hotel, category, name_key).

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS summary text;

COMMENT ON COLUMN document_chunks.summary IS
  'One-sentence LLM summary of the chunk (Foundry Use LLM step). The embedding is computed over THIS, not text_full.';

CREATE TABLE IF NOT EXISTS entities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** Display name as extracted (singular form, per the extraction prompt). */
  name            text        NOT NULL,
  /** Dedupe key. A plain stored column (not an expression index) so
   *  PostgREST ON CONFLICT can target the unique constraint — the partial/
   *  expression-index trap found in Track 1 verification. */
  name_key        text        GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  /** Fixed hospitality vocabulary — the category list is the ontology. */
  category        text        NOT NULL CHECK (category IN ('supplier','product','location','clause','term')),

  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (hotel_id, category, name_key)
);

CREATE INDEX IF NOT EXISTS idx_entities_hotel_category
  ON entities (hotel_id, category, created_at DESC);

COMMENT ON TABLE entities IS
  'Discovered Entity nodes (doc-ingestion Track 2). Mirrors Foundry''s Entity object type; chunk -mentions-> entity edges live in relationship_edges; entity -resolved_to-> supplier/variant when a deterministic match exists.';

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read entities in scope" ON entities;
CREATE POLICY "users read entities in scope" ON entities
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users write entities in scope" ON entities;
CREATE POLICY "users write entities in scope" ON entities
  FOR ALL TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- mentions edges are derived provenance like cited_in: chunk rows are replaced
-- on re-ingest (new ids), so the document's mention edges are refreshed too.
-- resolved_to is NOT in the carve-out: entity ids are stable and the mapping
-- is deterministic, so those edges are never bulk-deleted.
DROP POLICY IF EXISTS "re_delete_provenance" ON relationship_edges;
CREATE POLICY "re_delete_provenance" ON relationship_edges
  FOR DELETE TO authenticated
  USING (edge_type IN ('cited_in','mentions') AND hotel_is_in_user_scope(hotel_id));

CREATE INDEX IF NOT EXISTS idx_re_mentions_meta_doc
  ON relationship_edges ((metadata->>'document_id')) WHERE edge_type = 'mentions';
