-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 252 — one edge type per relationship, and a database that says so.
--
-- Foundry: "every link type should answer a clear domain question", and one link
-- type per real-world relationship. Two problems blocked that here.
--
-- 1. FOUR NAMES EACH MEANT TWO RELATIONSHIPS. `influenced_by` covered both
--    stock_log->occupancy_log and proposal->principle; `fulfills` covered both
--    restock_receive->restock_request and stock_log->restock_request. You cannot
--    register a link type per relationship while one name means two.
--
-- 2. TENANCY AND AUTHORSHIP WERE MODELLED AS RELATIONSHIPS. belongs_to_hotel,
--    created_by and belongs_to_org restate columns every table already carries.
--    They answer no domain question. The code that WROTE them (35 push sites in
--    edgesForAction) went in the commit before this one — deleting rows while the
--    writer lived would have re-dirtied on the next action.
--
-- 3. THERE WAS NO CHECK ON edge_type AT ALL. The vocabulary lived only in a
--    TypeScript union, which is exactly why one name covering two relationships
--    never raised anything. That is the durable fix here; the renames are
--    one-time, the constraint is what stops it recurring.
--
-- Order matters: rename, then delete, then constrain — so no row is left
-- violating the constraint at the moment it is added.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Split the overloaded names, keyed on the type pair that disambiguates ──

UPDATE relationship_edges SET edge_type = 'influenced_by_occupancy'
 WHERE edge_type = 'influenced_by' AND source_type = 'stock_log' AND target_type = 'occupancy_log';

UPDATE relationship_edges SET edge_type = 'influenced_by_principle'
 WHERE edge_type = 'influenced_by' AND source_type = 'proposal' AND target_type = 'principle';

UPDATE relationship_edges SET edge_type = 'log_fulfills_request'
 WHERE edge_type = 'fulfills' AND source_type = 'stock_log' AND target_type = 'restock_request';

-- `fulfills` keeps its name for restock_receive->restock_request, which is the
-- relationship the word actually describes.

-- Anything still called influenced_by is a pair we did not know about; fail loudly
-- rather than silently leaving it to violate the constraint below.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM relationship_edges WHERE edge_type = 'influenced_by';
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 252: % influenced_by edges have an unexpected type pair — split them before enforcing the vocabulary', n;
  END IF;
END $$;

-- ── 2. Retire the property-shaped edges ──────────────────────────────────────
-- hotel_id, organization_id and the author column already carry these facts.

DELETE FROM relationship_edges WHERE edge_type IN ('belongs_to_hotel', 'created_by', 'belongs_to_org');

-- ── 3. The database becomes the last word on the vocabulary ──────────────────
-- Mirrors EDGE_TYPES in packages/reality-graph/src/types.ts. When that list
-- grows, this constraint grows with it in the same PR — that is the point.

ALTER TABLE relationship_edges DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;
ALTER TABLE relationship_edges
  ADD CONSTRAINT relationship_edges_edge_type_check CHECK (edge_type IN (
    'causes', 'consumes', 'restocks', 'reverts',
    'belongs_to_session', 'triggered_alert', 'approved_by', 'rejected_by', 'modified_by',
    'fulfills', 'log_fulfills_request', 'sourced_from', 'batch_of', 'discarded_via',
    'linked_to_po', 'invoiced_by',
    'influenced_by_occupancy', 'influenced_by_principle', 'similar_to', 'transfers',
    'proposed_by', 'benchmarks',
    'harmonized_to', 'describes_entity', 'cited_in', 'applies_to', 'derived_from',
    'mentions', 'resolved_to'
  ));

COMMENT ON CONSTRAINT relationship_edges_edge_type_check ON relationship_edges IS
  'The edge vocabulary, mirroring EDGE_TYPES in @beacon/reality-graph. Until migration 252 there was no constraint here at all, which is how one name came to mean two relationships. Grow both together.';

COMMIT;
