-- ═══════════════════════════════════════════════════════════════════════════════
-- 110 — Pre-R1 Hotfix: Edge Constraint Alignment + Transfer Rename
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Clear two landmines before the Organization-tier restructure (migrations 111+):
--
--   A. Align `relationship_edges.edge_type` CHECK with reality.
--      Migration 018 declared 8 types; `packages/reality-graph/src/actions/edges.ts`
--      writes 14. Seven edges (`approved_by`, `rejected_by`, `fulfills`,
--      `sourced_from`, `linked_to_po`, `invoiced_by`, `discarded_via`) would
--      violate the constraint on write. This migration expands the CHECK to
--      include every type currently used PLUS network-tier types reserved for
--      Phase R1 (`belongs_to_org`, `transfers`) and ontology types declared in
--      `packages/types/src/edges.ts` (`proposed_by`, `similar_to`, `benchmarks`,
--      `caused_by`, `triggered`, `manages`, `operates`, `approved_by`).
--
--   B. Rename the existing `transfer_stock(variant, variant)` RPC to
--      `swap_variant_stock` so the name `transfer_stock(from_hotel, to_hotel, ...)`
--      is free for the multi-echelon lateral-resupply action in migration 112.
--      The existing RPC does *intra-hotel variant-to-variant* movement — a
--      different operation semantically from inter-property transfer.
--
-- Depends on: 018 (relationship_edges), 019 (transfer_stock)
-- Safe to ship immediately: only enables new behavior; no current caller breaks.
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─── A. Align relationship_edges.edge_type CHECK constraint ─────────────────

ALTER TABLE relationship_edges
  DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;

ALTER TABLE relationship_edges
  ADD CONSTRAINT relationship_edges_edge_type_check
    CHECK (edge_type IN (
      -- Original set (migration 018)
      'belongs_to_hotel', 'created_by', 'causes',
      'consumes', 'restocks', 'reverts',
      'belongs_to_session', 'triggered_alert',
      -- Used in packages/reality-graph/src/actions/edges.ts but previously undeclared
      'approved_by', 'rejected_by', 'fulfills',
      'sourced_from', 'linked_to_po', 'invoiced_by', 'discarded_via',
      -- Declared in packages/types/src/edges.ts (ontology canon)
      'caused_by', 'triggered', 'manages', 'operates',
      'proposed_by', 'similar_to', 'benchmarks',
      -- Reserved for Phase R1 (Network tier — multi-echelon)
      'belongs_to_org', 'transfers'
    ));

COMMENT ON CONSTRAINT relationship_edges_edge_type_check ON relationship_edges IS
  'Edge type vocabulary aligned with packages/types/src/edges.ts and '
  'packages/reality-graph/src/actions/edges.ts. Updated by migration 110 to close '
  'the code/schema gap left by migration 018.';

-- ─── B. Rename existing variant-to-variant transfer_stock() ─────────────────
-- The function in migration 019 moves stock between two *variants* within the
-- same hotel. Phase R1 introduces a distinct `transfer_stock(from_hotel, to_hotel, ...)`
-- for inter-property lateral resupply. Rename the legacy function to free the name.

ALTER FUNCTION transfer_stock(uuid, uuid, integer, text)
  RENAME TO swap_variant_stock;

COMMENT ON FUNCTION swap_variant_stock(uuid, uuid, integer, text) IS
  'Moves N units between two variants within the same hotel. Creates two '
  'immutable stock_logs plus a causes edge linking debit→credit. '
  'Renamed from transfer_stock in migration 110 to free that name for the '
  'multi-echelon inter-property transfer action introduced in Phase R1.';

-- Ensure authenticated callers retain execute privilege under the new name.
GRANT EXECUTE ON FUNCTION swap_variant_stock(uuid, uuid, integer, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - relationship_edges.edge_type CHECK now accepts all 22 declared types.
--   - swap_variant_stock(uuid, uuid, integer, text) replaces transfer_stock(...)
--     for intra-hotel variant-to-variant movement.
--   - Frontend callers (TransferModal.tsx) updated in the same commit.
--
-- Next: migration 111 introduces the `organizations` table and scope-aware RLS.
-- ═══════════════════════════════════════════════════════════════════════════════
