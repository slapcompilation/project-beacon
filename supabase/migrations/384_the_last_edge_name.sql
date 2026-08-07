-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 384 — cited_in, the last name in the edge vocabulary.
--
-- Its only consumer was the re_delete_provenance policy, which let a document's
-- citation edges be deleted; 382 dropped that policy with the hotel scope it was
-- written against. Document ingestion went in 373, so nothing writes it either.
--
-- The edge_type CHECK is now empty. That is the correct state: link_types is the
-- authority, it has no rows, and no edge type is valid until one is registered.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE def text; n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store WHERE edge_type = 'cited_in';
  IF n > 0 THEN RAISE EXCEPTION 'Migration 384: % row(s) hold cited_in', n; END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname='relationship_edges_store' AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 384: the CHECK is missing'; END IF;

  -- cited_in is the LAST value, so trimming it by string edit leaves ARRAY[],
  -- which Postgres cannot type. State the empty vocabulary explicitly instead.
  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check '
       || 'CHECK (edge_type = ANY (ARRAY[]::text[]))';
END $$;

-- The constraint must still REFUSE, or an empty vocabulary would mean "anything".
DO $$
DECLARE raised boolean := false;
BEGIN
  BEGIN
    INSERT INTO relationship_edges_store (edge_type, source_type, source_id, target_type, target_id)
    VALUES ('anything_at_all', 'x', gen_random_uuid(), 'y', gen_random_uuid());
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    DELETE FROM relationship_edges_store WHERE edge_type = 'anything_at_all';
    RAISE EXCEPTION 'Migration 384: the edge CHECK stopped refusing unknown types';
  END IF;
END $$;

COMMIT;
