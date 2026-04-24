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
--
-- Idempotent: if transfer_stock doesn't exist (e.g. migration 019 was not applied
-- to this database) we skip silently. If swap_variant_stock already exists
-- (migration was partially applied) we skip silently. Either way we end up in a
-- consistent state: transfer_stock is free for Phase R1 migration 112.

DO $$
BEGIN
  -- If the legacy function exists and the target name is free, rename it.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'transfer_stock'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, integer, text'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'swap_variant_stock'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, integer, text'
  ) THEN
    ALTER FUNCTION public.transfer_stock(uuid, uuid, integer, text)
      RENAME TO swap_variant_stock;
    RAISE NOTICE 'Renamed transfer_stock → swap_variant_stock';
  ELSIF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'swap_variant_stock'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, integer, text'
  ) THEN
    RAISE NOTICE 'swap_variant_stock already exists — rename skipped (idempotent).';
  ELSE
    RAISE NOTICE 'transfer_stock(uuid, uuid, integer, text) does not exist — nothing to rename. '
                 'Migration 019 may not have been applied. The name transfer_stock is free for Phase R1.';
  END IF;
END $$;

-- If we renamed (or swap_variant_stock was pre-existing), ensure metadata + grant are applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'swap_variant_stock'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, integer, text'
  ) THEN
    EXECUTE $cmt$
      COMMENT ON FUNCTION public.swap_variant_stock(uuid, uuid, integer, text) IS
        'Moves N units between two variants within the same hotel. Creates two '
        'immutable stock_logs plus a causes edge linking debit→credit. '
        'Renamed from transfer_stock in migration 110 to free that name for the '
        'multi-echelon inter-property transfer action introduced in Phase R1.'
    $cmt$;
    GRANT EXECUTE ON FUNCTION public.swap_variant_stock(uuid, uuid, integer, text) TO authenticated;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - relationship_edges.edge_type CHECK now accepts all 22 declared types.
--   - swap_variant_stock(uuid, uuid, integer, text) replaces transfer_stock(...)
--     for intra-hotel variant-to-variant movement.
--   - Frontend callers (TransferModal.tsx) updated in the same commit.
--
-- Next: migration 111 introduces the `organizations` table and scope-aware RLS.
-- ═══════════════════════════════════════════════════════════════════════════════
