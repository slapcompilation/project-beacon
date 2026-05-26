-- Phase 16.g — auto entity-link suggestions.
--
-- entity-extract edge function scans document chunks, asks the LLM which
-- variants / suppliers / products the chunks reference, and writes one
-- row per high-confidence guess. Operator reviews on a queue page and
-- either approves (writes a describes_entity edge into relationship_edges)
-- or rejects.
--
-- Same pattern as proposals + pending_action_approvals + cases: append-mostly,
-- status flips through decide(), hotel-scoped RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS entity_link_suggestions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** Document that surfaced this suggestion. */
  document_id         uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  /** Chunk_key from documents.chunks[] that the model cited as evidence.
   *  NULL when the suggestion came from the document as a whole rather
   *  than a specific chunk. */
  chunk_key           text,

  /** What kind of node the document is suggesting to describe. */
  entity_type         text        NOT NULL
                                  CHECK (entity_type IN ('variant','supplier','product','purchase_order','restock_request','hotel','organization','case')),
  /** Resolved entity id in the hotel's graph. */
  entity_id           uuid        NOT NULL,

  /** Model confidence 0–1; cards on the queue are sorted by this DESC. */
  confidence          numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  /** Operator-readable explanation from the LLM. */
  reasoning           text        NOT NULL,
  /** The exact text snippet from the chunk that triggered the match.
   *  Lets the operator verify without opening the source document. */
  evidence_snippet    text,

  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','superseded')),

  /** When approved, the relationship_edges row id created. NULL otherwise. */
  resulting_edge_id   uuid,

  decided_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_link_suggestions_pending
  ON entity_link_suggestions (hotel_id, confidence DESC, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_entity_link_suggestions_document
  ON entity_link_suggestions (document_id, created_at DESC);

-- Dedup: same (document, chunk, entity) shouldn't accumulate dupes across
-- re-runs of the extractor. New runs supersede older still-pending rows.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_entity_link_pending
  ON entity_link_suggestions (document_id, chunk_key, entity_type, entity_id)
  WHERE status = 'pending';

COMMENT ON TABLE entity_link_suggestions IS
  'Phase 16.g — LLM-proposed describes_entity links. Operator reviews on /entity-link-suggestions.';

ALTER TABLE entity_link_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read entity suggestions in scope" ON entity_link_suggestions;
CREATE POLICY "users read entity suggestions in scope" ON entity_link_suggestions
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users write entity suggestions in scope" ON entity_link_suggestions;
CREATE POLICY "users write entity suggestions in scope" ON entity_link_suggestions
  FOR ALL TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
