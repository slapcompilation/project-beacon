-- Migration 191: advance a document to the terminal 'linked' ingestion stage
-- when it gains its first describes_entity edge.
--
-- The document pipeline is raw → ocr → embedded → contextualized → linked.
-- OCR + embedding + the entity-link suggestion pass (contextualized) are driven
-- by the document-ingest edge function. The last hop — 'linked' — happens the
-- moment a describes_entity edge from the document lands in relationship_edges
-- (an operator approving a suggestion, or any future auto-approval / agent). We
-- own that transition on the graph, not in a component, so every path that
-- creates the edge advances the stage identically.
--
-- SECURITY DEFINER so the stage bump always lands regardless of who created the
-- edge (the approver may lack a documents UPDATE grant in some future RLS split);
-- search_path pinned and EXECUTE revoked from anon/authenticated to satisfy the
-- self-apply security invariants (a trigger fn inherits PUBLIC EXECUTE otherwise).

BEGIN;

CREATE OR REPLACE FUNCTION advance_document_to_linked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.edge_type = 'describes_entity' AND NEW.source_type = 'document' THEN
    UPDATE documents
       SET ingestion_stage = 'linked',
           updated_at      = now()
     WHERE id = NEW.source_id
       AND ingestion_stage <> 'linked';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_document_to_linked() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_document_linked_on_edge ON relationship_edges;
CREATE TRIGGER trg_document_linked_on_edge
  AFTER INSERT ON relationship_edges
  FOR EACH ROW
  EXECUTE FUNCTION advance_document_to_linked();

COMMENT ON FUNCTION advance_document_to_linked() IS
  'Advances documents.ingestion_stage to the terminal ''linked'' when a '
  'describes_entity edge from the document is created. Closes the pipeline''s '
  'last hop for every edge-creation path (migration 191).';

COMMIT;
