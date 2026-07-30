-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 259 — retire the edges that now have a real backing.
--
-- Two groups, both now represented somewhere better:
--
--   FK-DUPLICATING (10 relationships). Their link types were registered in 256
--   against columns that already hold the relationship — stock_logs.variant_id,
--   document_chunks.document_id and the rest. The edge rows restated a foreign
--   key, and a traversal reading the column cannot disagree with itself.
--
--   JOIN-TABLE MIGRATED (7 relationships). Copied in 258 into link_* tables with
--   real foreign keys to both endpoints. 4,072 of them made it; 2,574 could not,
--   because they referenced rows that no longer exist — 2,548 `causes` edges
--   whose stock_logs are gone, 11 `mentions` whose chunks D3's cascade took, and
--   so on. A reference to a deleted row is not data; it is the absence of a
--   constraint, which the new tables now supply.
--
-- What remains in relationship_edges afterwards is only what has no link type
-- yet, so the table shrinks to the honest remainder rather than being emptied by
-- assertion.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE before_n int; after_n int; kept text;
BEGIN
  SELECT count(*) INTO before_n FROM relationship_edges;

  -- Every relationship that now has a registered link type over its own backing.
  DELETE FROM relationship_edges
   WHERE edge_type IN (
     -- FK-backed (migration 256)
     'consumes', 'sourced_from', 'restocks', 'approved_by', 'fulfills',
     'invoiced_by', 'batch_of', 'derived_from', 'cited_in', 'reverts',
     -- join-table backed (migration 258)
     'causes', 'influenced_by_occupancy', 'influenced_by_principle', 'mentions',
     'linked_to_po', 'triggered_alert', 'log_fulfills_request'
   );

  SELECT count(*) INTO after_n FROM relationship_edges;
  SELECT coalesce(string_agg(DISTINCT edge_type, ', '), '(none)') INTO kept FROM relationship_edges;
  RAISE NOTICE 'relationship_edges: % -> % rows. Remaining vocabulary: %', before_n, after_n, kept;
END $$;

COMMIT;
