-- ═══════════════════════════════════════════════════════════════════════════════
-- 111b — Procurement RLS extended to Organization scope
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- FRAMING — the three influences:
--
--   FOUNDRY    Same delegation pattern as 111a — every procurement node now
--              checks scope through one helper. Suppliers, POs, invoices,
--              contracts all become first-class portfolio nodes.
--
--   AIP        Cross-hotel agents (e.g. portfolio-wide procurement leverage,
--              chain-level invoice variance) can now read from every property
--              they're scoped to. The 3-way-match agent at org scope sees
--              every PO across the network.
--
--   GALLATIN   This is where multi-echelon procurement begins to work.
--              `transfer_stock` (Phase R1, migration 112-future) moves stock
--              laterally between sister properties. To check a sister's
--              available stock before going external, the agent needs portfolio
--              read access — granted here.
--
-- WHAT THIS MIGRATION DOES:
--   Replaces every `hotel_id = auth_hotel_id()` predicate on procurement
--   tables with `hotel_is_in_user_scope(hotel_id)`.
--
--   Special: `supplier_contracts` had a role-gated write policy
--   (`auth_role() IN ('admin','owner')`). We extend it so org-level roles
--   (org_director, regional_manager) can ALSO write — the network needs
--   chain-level contract management.
--
-- TABLES TOUCHED (~12 policies across 10 tables):
--   suppliers, supplier_contracts, restock_requests, restock_receives,
--   delivery_events, purchase_orders, purchase_order_lines, po_invoices,
--   po_discrepancies, gl_account_mappings
--
-- NOT TOUCHED (handled elsewhere):
--   - Inventory: 111a
--   - Notifications, alerts, forecasts, learned thresholds: 111c
--
-- Depends on: 001, 009, 015, 036, 055, 066, 067, 095, 111
-- Idempotent: every policy dropped before recreation
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC PRE-FLIGHT
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_policy_count int;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'suppliers', 'supplier_contracts',
        'restock_requests', 'restock_receives',
        'delivery_events',
        'purchase_orders', 'purchase_order_lines', 'po_invoices', 'po_discrepancies',
        'gl_account_mappings'
      );

  RAISE NOTICE '── 111b PRE-FLIGHT ────────────────────────────────────';
  RAISE NOTICE 'Procurement-domain policies before rewrite: %', v_policy_count;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- suppliers — 1 policy (FOR ALL)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation" ON suppliers;
DROP POLICY IF EXISTS "suppliers_scope" ON suppliers;

CREATE POLICY "suppliers_scope" ON suppliers
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- supplier_contracts — 2 policies (read + role-gated write)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Special: write policy keeps role check but accepts org-level roles too.
-- Hotel admin/owner can write contracts for own hotel; org_director or
-- regional_manager can write contracts portfolio-wide.

DROP POLICY IF EXISTS "hotel_members_read_contracts" ON supplier_contracts;
DROP POLICY IF EXISTS "admins_write_contracts"      ON supplier_contracts;
DROP POLICY IF EXISTS "supplier_contracts_read"     ON supplier_contracts;
DROP POLICY IF EXISTS "supplier_contracts_write"    ON supplier_contracts;

CREATE POLICY "supplier_contracts_read" ON supplier_contracts
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "supplier_contracts_write" ON supplier_contracts
  FOR ALL
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND (
      auth_role()     IN ('admin', 'owner')
      OR auth_org_role() IS NOT NULL
    )
  )
  WITH CHECK (
    hotel_is_in_user_scope(hotel_id)
    AND (
      auth_role()     IN ('admin', 'owner')
      OR auth_org_role() IS NOT NULL
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- restock_requests — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"        ON restock_requests;
DROP POLICY IF EXISTS "restock_requests_scope" ON restock_requests;

CREATE POLICY "restock_requests_scope" ON restock_requests
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- restock_receives — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"        ON restock_receives;
DROP POLICY IF EXISTS "hotel_insert"           ON restock_receives;
DROP POLICY IF EXISTS "restock_receives_scope" ON restock_receives;

CREATE POLICY "restock_receives_scope" ON restock_receives
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- delivery_events — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"       ON delivery_events;
DROP POLICY IF EXISTS "delivery_events_scope" ON delivery_events;

CREATE POLICY "delivery_events_scope" ON delivery_events
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- purchase_orders — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS po_hotel_isolation       ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_scope"  ON purchase_orders;

CREATE POLICY "purchase_orders_scope" ON purchase_orders
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- purchase_order_lines — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS pol_hotel_isolation           ON purchase_order_lines;
DROP POLICY IF EXISTS "purchase_order_lines_scope"  ON purchase_order_lines;

CREATE POLICY "purchase_order_lines_scope" ON purchase_order_lines
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- po_invoices — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS poi_hotel_isolation   ON po_invoices;
DROP POLICY IF EXISTS "po_invoices_scope"   ON po_invoices;

CREATE POLICY "po_invoices_scope" ON po_invoices
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- po_discrepancies — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "pod_all"                ON po_discrepancies;
DROP POLICY IF EXISTS "po_discrepancies_scope" ON po_discrepancies;

CREATE POLICY "po_discrepancies_scope" ON po_discrepancies
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- gl_account_mappings — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "glm_all"               ON gl_account_mappings;
DROP POLICY IF EXISTS "gl_mappings_scope"     ON gl_account_mappings;

CREATE POLICY "gl_mappings_scope" ON gl_account_mappings
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC POST-FLIGHT
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_policy_count int;
  v_uses_helper  int;
  v_uses_legacy  int;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'suppliers', 'supplier_contracts',
        'restock_requests', 'restock_receives',
        'delivery_events',
        'purchase_orders', 'purchase_order_lines', 'po_invoices', 'po_discrepancies',
        'gl_account_mappings'
      );

  SELECT COUNT(*) INTO v_uses_helper
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'suppliers', 'supplier_contracts',
        'restock_requests', 'restock_receives',
        'delivery_events',
        'purchase_orders', 'purchase_order_lines', 'po_invoices', 'po_discrepancies',
        'gl_account_mappings'
      )
      AND (qual LIKE '%hotel_is_in_user_scope%' OR with_check LIKE '%hotel_is_in_user_scope%');

  SELECT COUNT(*) INTO v_uses_legacy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'suppliers', 'supplier_contracts',
        'restock_requests', 'restock_receives',
        'delivery_events',
        'purchase_orders', 'purchase_order_lines', 'po_invoices', 'po_discrepancies',
        'gl_account_mappings'
      )
      AND (qual LIKE '%= auth_hotel_id()%' OR with_check LIKE '%= auth_hotel_id()%');

  RAISE NOTICE '── 111b POST-FLIGHT ───────────────────────────────────';
  RAISE NOTICE 'Procurement-domain policies after rewrite: %', v_policy_count;
  RAISE NOTICE 'Policies now using hotel_is_in_user_scope: % (expect = total)', v_uses_helper;
  RAISE NOTICE 'Policies still using legacy auth_hotel_id(): % (expect 0)', v_uses_legacy;
  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'Procurement tier now org-aware. Next: 111c (intelligence).';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Behavioral change summary:
--
--   Hotel admin / owner       → unchanged scope (still own hotel only)
--   Org director              → can read + write across all org hotels
--   Regional manager          → can read + write across all org hotels
--   Hotel manager / staff     → unchanged scope
--
--   supplier_contracts has the only role gate left:
--     - hotel admin/owner: write contracts in own hotel (existing behavior)
--     - any org-level role: write contracts portfolio-wide (new)
--     - hotel team_member:  cannot write contracts (existing behavior)
--
-- ═══════════════════════════════════════════════════════════════════════════════
