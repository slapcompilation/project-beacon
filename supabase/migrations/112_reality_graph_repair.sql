-- ═══════════════════════════════════════════════════════════════════════════════
-- 112 — Reality Graph Repair (Pre-RLS-Rewrite Hotfix)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXT:
--   Deep rescan after migration 111 surfaced four critical landmines that must
--   be neutralized BEFORE migrations 111a/b/c rewrite 326 RLS policies.
--   Touching policies on top of broken graph infrastructure compounds risk —
--   we fix the foundation first, then extend.
--
-- LANDMINES NEUTRALIZED:
--
--   L1  Migration 098 dropped UNIQUE (source_id, edge_type, target_id) from
--       relationship_edges. Every call to create_relationship_edge() since
--       has been silently allowed to write duplicates. Restoring the constraint
--       requires deduplication first.
--
--   L2  Migration 098 also CASCADE-dropped two critical triggers that were
--       declared in migration 018:
--         - trg_stock_log_edges  (writes 'consumes' + 'reverts' edges)
--         - trg_restock_fulfilled_edge  (writes 'restocks' edge)
--       The trigger FUNCTIONS still exist; only the TRIGGERS were lost.
--       Every stock_log insert and every restock fulfillment since 098 has
--       written ZERO graph edges. The Reality Graph is missing months of
--       causal data. Recreate the triggers AND backfill the gap.
--
--   L3  Migration 110's edge-type CHECK constraint missed two types actively
--       emitted by code: 'batch_of' and 'influenced_by'. Any caller writing
--       these edges (migration 056's batch trigger, migration 077's occupancy
--       trigger) will silently fail the CHECK and abort.
--
--   L4  Migrations 034 and 098 RLS policies query the `users` table directly
--       (`hotel_id IN (SELECT hotel_id FROM users WHERE id = auth.uid())`)
--       instead of using auth_hotel_id(). This is inconsistent with every
--       other RLS policy in the system and prevents org-scope reads from
--       working in 111a/b/c. Rewrite to use hotel_is_in_user_scope().
--
-- ALSO FIXED IN THIS MIGRATION (frontend):
--   F1  supabase/functions/copilot-chat/index.ts:296 calls a non-existent
--       RPC `get_anomaly_explanation` — actual function is `explain_anomaly`
--       (migration 082). Frontend fix committed alongside this migration.
--
-- DEPENDS ON: 018, 056, 077, 098, 110, 111
-- IDEMPOTENT: every operation guards against re-application
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC PRE-FLIGHT — log current state before any changes
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total_edges       int;
  v_dupe_groups       int;
  v_dupe_rows         int;
  v_unique_exists     boolean;
  v_trg_stock_exists  boolean;
  v_trg_restock_exists boolean;
  v_orphan_stocklogs  int;
  v_orphan_restocks   int;
BEGIN
  SELECT COUNT(*) INTO v_total_edges FROM relationship_edges;

  SELECT COUNT(*), COALESCE(SUM(c) - COUNT(*), 0)
    INTO v_dupe_groups, v_dupe_rows
    FROM (
      SELECT COUNT(*) AS c FROM relationship_edges
      GROUP BY source_id, edge_type, target_id
      HAVING COUNT(*) > 1
    ) sub;

  v_unique_exists := EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'relationship_edges'::regclass
      AND contype  = 'u'
      AND conname  = 'relationship_edges_unique_triple'
  );

  v_trg_stock_exists := EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_stock_log_edges'
      AND tgrelid = 'stock_logs'::regclass
  );

  v_trg_restock_exists := EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_restock_fulfilled_edge'
      AND tgrelid = 'restock_requests'::regclass
  );

  SELECT COUNT(*) INTO v_orphan_stocklogs
    FROM stock_logs sl
    WHERE NOT EXISTS (
      SELECT 1 FROM relationship_edges re
      WHERE re.source_type = 'stock_log'
        AND re.source_id   = sl.id
        AND re.edge_type   = 'consumes'
    );

  SELECT COUNT(*) INTO v_orphan_restocks
    FROM restock_requests rr
    WHERE rr.status = 'fulfilled'
      AND NOT EXISTS (
        SELECT 1 FROM relationship_edges re
        WHERE re.source_type = 'restock_request'
          AND re.source_id   = rr.id
          AND re.edge_type   = 'restocks'
      );

  RAISE NOTICE '── DIAGNOSTIC PRE-FLIGHT ──────────────────────────────';
  RAISE NOTICE 'Total relationship_edges:               %', v_total_edges;
  RAISE NOTICE 'Duplicate (source_id, edge_type, target_id) groups: %', v_dupe_groups;
  RAISE NOTICE 'Duplicate rows to be removed:            %', v_dupe_rows;
  RAISE NOTICE 'UNIQUE constraint already in place:      %', v_unique_exists;
  RAISE NOTICE 'trg_stock_log_edges trigger present:     %', v_trg_stock_exists;
  RAISE NOTICE 'trg_restock_fulfilled_edge present:      %', v_trg_restock_exists;
  RAISE NOTICE 'stock_logs without consumes edge:        %', v_orphan_stocklogs;
  RAISE NOTICE 'fulfilled restock_requests without restocks edge: %', v_orphan_restocks;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- L3 — Add missing edge types BEFORE backfill writes them
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE relationship_edges
  DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;

ALTER TABLE relationship_edges
  ADD CONSTRAINT relationship_edges_edge_type_check
    CHECK (edge_type IN (
      -- Migration 018 baseline
      'belongs_to_hotel', 'created_by', 'causes',
      'consumes', 'restocks', 'reverts',
      'belongs_to_session', 'triggered_alert',
      -- Migration 056 + edges.ts (Phase 5 Reality Graph)
      'approved_by', 'rejected_by', 'fulfills',
      'sourced_from', 'linked_to_po', 'invoiced_by', 'discarded_via',
      'batch_of', 'influenced_by',
      -- Ontology canon (packages/types/src/index.ts)
      'caused_by', 'triggered', 'manages', 'operates',
      'proposed_by', 'similar_to', 'benchmarks',
      -- Phase R1 (Network tier — multi-echelon)
      'belongs_to_org', 'transfers'
    ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- L1 — Deduplicate relationship_edges, then restore UNIQUE constraint
-- ═══════════════════════════════════════════════════════════════════════════════

-- Keep the OLDEST row per (source_id, edge_type, target_id) — earliest is the
-- canonical record; later writes were unintended duplicates.
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY source_id, edge_type, target_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM relationship_edges
)
DELETE FROM relationship_edges
 WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now safe to add UNIQUE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'relationship_edges'::regclass
      AND contype  = 'u'
      AND conname  = 'relationship_edges_unique_triple'
  ) THEN
    ALTER TABLE relationship_edges
      ADD CONSTRAINT relationship_edges_unique_triple
        UNIQUE (source_id, edge_type, target_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT relationship_edges_unique_triple ON relationship_edges IS
  'Restored by migration 112. Migration 018 declared this constraint; '
  'migration 098''s DROP TABLE CASCADE removed it. create_relationship_edge() '
  'depends on this for idempotent ON CONFLICT DO NOTHING upsert.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- L4 — Realign relationship_edges RLS to canonical pattern
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 098's policies query `users` directly. Replace with
-- hotel_is_in_user_scope() so org-scope users (Phase R1) get visibility too.

DROP POLICY IF EXISTS "Hotel members can view relationship edges" ON relationship_edges;
DROP POLICY IF EXISTS "Hotel members can insert relationship edges" ON relationship_edges;

CREATE POLICY "re_select_in_scope" ON relationship_edges
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "re_insert_in_scope" ON relationship_edges
  FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- L4 (continued) — Same fix for migration 034's `removal_reasons` policy
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 034 also uses the FROM users anti-pattern. Realign.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_removal_reasons'
      AND policyname IN ('removal_reasons_select', 'removal_reasons_modify')
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "removal_reasons_select" ON custom_removal_reasons';
    EXECUTE 'DROP POLICY IF EXISTS "removal_reasons_modify" ON custom_removal_reasons';

    EXECUTE 'CREATE POLICY "removal_reasons_select" ON custom_removal_reasons
              FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "removal_reasons_modify" ON custom_removal_reasons
              FOR ALL USING (hotel_is_in_user_scope(hotel_id))
              WITH CHECK (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- L2a — Fix the broken trg_restock_fulfilled_edge() function BEFORE recreating
-- ═══════════════════════════════════════════════════════════════════════════════
-- The function defined in migration 018 references NEW.quantity_received on a
-- restock_requests row — but that column lives on restock_receives (migration
-- 015), not restock_requests. The 098 CASCADE inadvertently shielded production
-- from this latent bug. If we recreate the trigger without fixing the function
-- first, every restock UPDATE would fail.
--
-- Fix: use NEW.quantity_needed (the requested quantity, which DOES exist on
-- restock_requests). Actual received qty per restock lives on restock_receives
-- and is captured via 'fulfills' edges from receive events.

CREATE OR REPLACE FUNCTION trg_restock_fulfilled_edge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled' AND (OLD.status IS DISTINCT FROM 'fulfilled') THEN
    INSERT INTO relationship_edges (
      hotel_id, source_type, source_id, edge_type, target_type, target_id,
      triggered_by, metadata
    ) VALUES (
      NEW.hotel_id,
      'restock_request', NEW.id,
      'restocks',
      'variant', NEW.variant_id,
      'system',
      jsonb_build_object('quantity_needed', NEW.quantity_needed)
    )
    ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_restock_fulfilled_edge() IS
  'Writes a restocks edge when a restock_request transitions to fulfilled. '
  'Fixed by migration 112: original 018 version referenced NEW.quantity_received '
  'which does not exist on restock_requests (it lives on restock_receives). '
  'Now uses NEW.quantity_needed (requested qty) for metadata.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- L2b — Recreate the two critical edge-writing triggers lost by 098 CASCADE
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_stock_log_edges'
      AND tgrelid = 'stock_logs'::regclass
  ) THEN
    CREATE TRIGGER trg_stock_log_edges
      AFTER INSERT ON stock_logs
      FOR EACH ROW EXECUTE FUNCTION trg_stock_log_edges();
    RAISE NOTICE 'Recreated trg_stock_log_edges on stock_logs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_restock_fulfilled_edge'
      AND tgrelid = 'restock_requests'::regclass
  ) THEN
    CREATE TRIGGER trg_restock_fulfilled_edge
      AFTER UPDATE ON restock_requests
      FOR EACH ROW EXECUTE FUNCTION trg_restock_fulfilled_edge();
    RAISE NOTICE 'Recreated trg_restock_fulfilled_edge on restock_requests';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- L2 (continued) — Backfill missing edges since the trigger gap
-- ═══════════════════════════════════════════════════════════════════════════════
-- Every stock_log without a 'consumes' edge gets one written.
-- Every stock_log with revert_of and no 'reverts' edge gets one.
-- Every fulfilled restock_request without a 'restocks' edge gets one.
-- Idempotent via UNIQUE constraint just restored above.

-- Backfill consumes edges for stock_logs.
INSERT INTO relationship_edges (
  hotel_id, source_type, source_id, edge_type, target_type, target_id,
  triggered_by, metadata
)
SELECT
  COALESCE(p.hotel_id, sl.hotel_id),
  'stock_log', sl.id,
  'consumes',
  'variant', sl.variant_id,
  CASE
    WHEN sl.is_revert THEN 'revert'
    ELSE 'system'
  END,
  jsonb_build_object(
    'delta',  sl.quantity_change,
    'reason', sl.reason,
    'backfilled_by_migration', 112
  )
FROM stock_logs sl
LEFT JOIN product_variants pv ON pv.id = sl.variant_id
LEFT JOIN products p           ON p.id  = pv.product_id
WHERE NOT EXISTS (
  SELECT 1 FROM relationship_edges re
  WHERE re.source_type = 'stock_log'
    AND re.source_id   = sl.id
    AND re.edge_type   = 'consumes'
    AND re.target_id   = sl.variant_id
)
ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;

-- Backfill reverts edges for compensating transactions.
INSERT INTO relationship_edges (
  hotel_id, source_type, source_id, edge_type, target_type, target_id,
  triggered_by, metadata
)
SELECT
  COALESCE(p.hotel_id, sl.hotel_id),
  'stock_log', sl.id,
  'reverts',
  'stock_log', sl.revert_of,
  'revert',
  jsonb_build_object(
    'reason', sl.reason,
    'backfilled_by_migration', 112
  )
FROM stock_logs sl
LEFT JOIN product_variants pv ON pv.id = sl.variant_id
LEFT JOIN products p           ON p.id  = pv.product_id
WHERE sl.revert_of IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM relationship_edges re
    WHERE re.source_type = 'stock_log'
      AND re.source_id   = sl.id
      AND re.edge_type   = 'reverts'
      AND re.target_id   = sl.revert_of
  )
ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;

-- Backfill restocks edges for fulfilled restock_requests.
-- Uses quantity_needed (the requested qty); actual receives are tracked via
-- separate fulfills edges from restock_receives → restock_request.
INSERT INTO relationship_edges (
  hotel_id, source_type, source_id, edge_type, target_type, target_id,
  triggered_by, metadata
)
SELECT
  rr.hotel_id,
  'restock_request', rr.id,
  'restocks',
  'variant', rr.variant_id,
  'system',
  jsonb_build_object(
    'quantity_needed', rr.quantity_needed,
    'backfilled_by_migration', 112
  )
FROM restock_requests rr
WHERE rr.status = 'fulfilled'
  AND NOT EXISTS (
    SELECT 1 FROM relationship_edges re
    WHERE re.source_type = 'restock_request'
      AND re.source_id   = rr.id
      AND re.edge_type   = 'restocks'
      AND re.target_id   = rr.variant_id
  )
ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC POST-FLIGHT — log final state
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total_edges       int;
  v_remaining_dupes   int;
  v_orphan_stocklogs  int;
  v_orphan_restocks   int;
  v_consumes_added    int;
  v_reverts_added     int;
  v_restocks_added    int;
BEGIN
  SELECT COUNT(*) INTO v_total_edges FROM relationship_edges;

  SELECT COUNT(*) INTO v_remaining_dupes
    FROM (
      SELECT 1 FROM relationship_edges
      GROUP BY source_id, edge_type, target_id
      HAVING COUNT(*) > 1
    ) sub;

  SELECT COUNT(*) INTO v_orphan_stocklogs
    FROM stock_logs sl
    WHERE NOT EXISTS (
      SELECT 1 FROM relationship_edges re
      WHERE re.source_type = 'stock_log'
        AND re.source_id   = sl.id
        AND re.edge_type   = 'consumes'
    );

  SELECT COUNT(*) INTO v_orphan_restocks
    FROM restock_requests rr
    WHERE rr.status = 'fulfilled'
      AND NOT EXISTS (
        SELECT 1 FROM relationship_edges re
        WHERE re.source_type = 'restock_request'
          AND re.source_id   = rr.id
          AND re.edge_type   = 'restocks'
      );

  SELECT COUNT(*) INTO v_consumes_added
    FROM relationship_edges
    WHERE edge_type = 'consumes'
      AND metadata->>'backfilled_by_migration' = '112';

  SELECT COUNT(*) INTO v_reverts_added
    FROM relationship_edges
    WHERE edge_type = 'reverts'
      AND metadata->>'backfilled_by_migration' = '112';

  SELECT COUNT(*) INTO v_restocks_added
    FROM relationship_edges
    WHERE edge_type = 'restocks'
      AND metadata->>'backfilled_by_migration' = '112';

  RAISE NOTICE '── DIAGNOSTIC POST-FLIGHT ─────────────────────────────';
  RAISE NOTICE 'Total relationship_edges:                %', v_total_edges;
  RAISE NOTICE 'Remaining duplicate groups:              %  (expect 0)', v_remaining_dupes;
  RAISE NOTICE 'Orphaned stock_logs after backfill:      %  (expect 0)', v_orphan_stocklogs;
  RAISE NOTICE 'Orphaned fulfilled restocks after backfill: %  (expect 0)', v_orphan_restocks;
  RAISE NOTICE 'Consumes edges added by this migration:  %', v_consumes_added;
  RAISE NOTICE 'Reverts edges added by this migration:   %', v_reverts_added;
  RAISE NOTICE 'Restocks edges added by this migration:  %', v_restocks_added;
  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'Reality Graph repair complete. Safe to proceed to 111a/b/c.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary of what migration 112 fixed:
--
--   ┌────┬─────────────────────────────────────────────────────────────────────┐
--   │ L1 │ relationship_edges UNIQUE (source_id, edge_type, target_id)         │
--   │    │ restored — create_relationship_edge() ON CONFLICT now works         │
--   ├────┼─────────────────────────────────────────────────────────────────────┤
--   │ L2 │ trg_stock_log_edges + trg_restock_fulfilled_edge triggers           │
--   │    │ recreated; missing edges backfilled                                 │
--   ├────┼─────────────────────────────────────────────────────────────────────┤
--   │ L3 │ batch_of, influenced_by added to edge_type CHECK constraint         │
--   ├────┼─────────────────────────────────────────────────────────────────────┤
--   │ L4 │ relationship_edges + custom_removal_reasons RLS policies            │
--   │    │ realigned to use hotel_is_in_user_scope() instead of users table    │
--   └────┴─────────────────────────────────────────────────────────────────────┘
--
-- NEXT:  111a (inventory RLS)  →  111b (procurement RLS)  →  111c (intelligence RLS)
--        Now safe to extend the remaining ~324 RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════════
