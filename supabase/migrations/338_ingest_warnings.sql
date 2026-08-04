-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 338 — an ingest warning that outlives the HTTP response.
--
-- `document-ingest` detects two things and tells nobody who matters:
--
--   blank_template     the document is an unfilled form. INV11122 reached
--                      `contextualized` with no supplier and two lines called
--                      "Item 1" and "Item 2", and every stage gate passed,
--                      because a form produces output fine.
--   rejected_entities  names the model offered that identify nothing —
--                      "supplier", "food product" — refused by checkEntityName.
--
-- Both were returned in the response body and nowhere else. The caller sees them
-- for one render and then they are gone: a document ingested yesterday carries no
-- record, and the documents list cannot show a warning it never received. A
-- signal with a lifetime shorter than the thing it describes is not a signal.
--
-- One jsonb column rather than two typed ones, deliberately: this is a bag of
-- advisory findings from a pipeline that will grow more of them, and none of it
-- is queried — it is read back whole and rendered. A CHECK on the shape would be
-- vocabulary nothing enforces.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ingest_warnings jsonb;

COMMENT ON COLUMN public.documents.ingest_warnings IS
  'Advisory findings from the last ingest: { blankTemplate: {score, signals[]}, rejectedEntities: [] }. NULL means never ingested; {} means ingested cleanly.';

DO $$
DECLARE v_doc uuid; v_read jsonb;
BEGIN
  SELECT id INTO v_doc FROM documents LIMIT 1;
  IF v_doc IS NULL THEN
    RAISE NOTICE 'Migration 338: no documents to probe against';
    RETURN;
  END IF;

  BEGIN
    UPDATE documents SET ingest_warnings =
      '{"blankTemplate":{"score":0.8,"signals":["probe"]},"rejectedEntities":["x (category-word)"]}'::jsonb
     WHERE id = v_doc;
    SELECT ingest_warnings INTO v_read FROM documents WHERE id = v_doc;
    IF v_read->'blankTemplate'->>'score' <> '0.8' THEN
      RAISE EXCEPTION 'Migration 338: the warning did not round-trip';
    END IF;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
