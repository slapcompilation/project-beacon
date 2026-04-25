-- ═══════════════════════════════════════════════════════════════════════════════
-- 111a — Inventory RLS extended to Organization scope
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- FRAMING — the three influences:
--
--   FOUNDRY    Every inventory node already has RLS. We're not weakening it —
--              we're delegating the scope check to a single function so the
--              ontology has one source of truth for "can this user see this
--              hotel".
--
--   AIP        Agents inherit human scope. After this migration, an
--              org-scope agent (cron'd at portfolio level) reading
--              product_variants will see all properties; a hotel-scope agent
--              still sees only its own.
--
--   GALLATIN   Network reads. A regional manager opening the inventory page
--              sees the whole portfolio. A property GM still sees only their
--              hotel. No code change in either case — the helper does it.
--
-- WHAT THIS MIGRATION DOES:
--   Replaces every `hotel_id = auth_hotel_id()` predicate on inventory tables
--   with `hotel_is_in_user_scope(hotel_id)`. Single-hotel users see zero
--   change (the helper returns true for their own hotel). Org-level users
--   gain read+write across the network.
--
-- TABLES TOUCHED (~25 policies across 12 tables):
--   categories, products, product_variants, locations, stock_logs,
--   product_custom_field_defs, stocktake_sessions, stocktake_lines,
--   variant_cost_history, pick_lists, pick_list_items, product_batches
--
-- NOT TOUCHED (handled elsewhere):
--   - relationship_edges, custom_removal_reasons → already migrated by 112
--   - All procurement / supplier / PO tables → 111b
--   - All intelligence / notification / forecast tables → 111c
--
-- Depends on: 001, 013, 014, 016, 017, 031, 052, 111 (hotel_is_in_user_scope)
-- Idempotent: every policy is dropped before recreation
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
        'categories', 'products', 'product_variants', 'locations',
        'stock_logs', 'product_custom_field_defs',
        'stocktake_sessions', 'stocktake_lines',
        'variant_cost_history', 'pick_lists', 'pick_list_items',
        'product_batches'
      );

  RAISE NOTICE '── 111a PRE-FLIGHT ────────────────────────────────────';
  RAISE NOTICE 'Inventory-domain policies before rewrite: %', v_policy_count;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- categories — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"   ON categories;
DROP POLICY IF EXISTS "categories_scope"  ON categories;

CREATE POLICY "categories_scope" ON categories
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- products — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation" ON products;
DROP POLICY IF EXISTS "products_scope"  ON products;

CREATE POLICY "products_scope" ON products
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- product_variants — INDIRECT scope via parent product
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"        ON product_variants;
DROP POLICY IF EXISTS "product_variants_scope" ON product_variants;

CREATE POLICY "product_variants_scope" ON product_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id
        AND hotel_is_in_user_scope(p.hotel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id
        AND hotel_is_in_user_scope(p.hotel_id)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- locations — 2 policies (read + insert)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"    ON locations;
DROP POLICY IF EXISTS "hotel_insert"       ON locations;
DROP POLICY IF EXISTS "locations_scope"    ON locations;

CREATE POLICY "locations_scope" ON locations
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- stock_logs — 2 policies (read + insert; immutable, no UPDATE/DELETE policies)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation_select" ON stock_logs;
DROP POLICY IF EXISTS "hotel_isolation_insert" ON stock_logs;
DROP POLICY IF EXISTS "stock_logs_select"      ON stock_logs;
DROP POLICY IF EXISTS "stock_logs_insert"      ON stock_logs;

CREATE POLICY "stock_logs_select" ON stock_logs
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "stock_logs_insert" ON stock_logs
  FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- Intentionally NO UPDATE or DELETE policies on stock_logs — immutable by design.

-- ═══════════════════════════════════════════════════════════════════════════════
-- product_custom_field_defs — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"        ON product_custom_field_defs;
DROP POLICY IF EXISTS "hotel_insert"           ON product_custom_field_defs;
DROP POLICY IF EXISTS "custom_field_defs_scope" ON product_custom_field_defs;

CREATE POLICY "custom_field_defs_scope" ON product_custom_field_defs
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- stocktake_sessions — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"          ON stocktake_sessions;
DROP POLICY IF EXISTS "hotel_insert"             ON stocktake_sessions;
DROP POLICY IF EXISTS "stocktake_sessions_scope" ON stocktake_sessions;

CREATE POLICY "stocktake_sessions_scope" ON stocktake_sessions
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- stocktake_lines — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"        ON stocktake_lines;
DROP POLICY IF EXISTS "hotel_insert"           ON stocktake_lines;
DROP POLICY IF EXISTS "stocktake_lines_scope"  ON stocktake_lines;

CREATE POLICY "stocktake_lines_scope" ON stocktake_lines
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- variant_cost_history — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"            ON variant_cost_history;
DROP POLICY IF EXISTS "variant_cost_history_scope" ON variant_cost_history;

CREATE POLICY "variant_cost_history_scope" ON variant_cost_history
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- pick_lists — 4 policies (split by operation)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "pl_select" ON pick_lists;
DROP POLICY IF EXISTS "pl_insert" ON pick_lists;
DROP POLICY IF EXISTS "pl_update" ON pick_lists;
DROP POLICY IF EXISTS "pl_delete" ON pick_lists;

CREATE POLICY "pl_select" ON pick_lists FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "pl_insert" ON pick_lists FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "pl_update" ON pick_lists FOR UPDATE
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "pl_delete" ON pick_lists FOR DELETE
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- pick_list_items — 4 policies, INDIRECT via parent pick_list
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "pli_select" ON pick_list_items;
DROP POLICY IF EXISTS "pli_insert" ON pick_list_items;
DROP POLICY IF EXISTS "pli_update" ON pick_list_items;
DROP POLICY IF EXISTS "pli_delete" ON pick_list_items;

CREATE POLICY "pli_select" ON pick_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND hotel_is_in_user_scope(pl.hotel_id)
  ));
CREATE POLICY "pli_insert" ON pick_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND hotel_is_in_user_scope(pl.hotel_id)
  ));
CREATE POLICY "pli_update" ON pick_list_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND hotel_is_in_user_scope(pl.hotel_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND hotel_is_in_user_scope(pl.hotel_id)
  ));
CREATE POLICY "pli_delete" ON pick_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND hotel_is_in_user_scope(pl.hotel_id)
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- product_batches — 3 policies (read + insert + update)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"      ON product_batches;
DROP POLICY IF EXISTS "hotel_insert"         ON product_batches;
DROP POLICY IF EXISTS "hotel_update"         ON product_batches;
DROP POLICY IF EXISTS "product_batches_scope" ON product_batches;

CREATE POLICY "product_batches_scope" ON product_batches
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
        'categories', 'products', 'product_variants', 'locations',
        'stock_logs', 'product_custom_field_defs',
        'stocktake_sessions', 'stocktake_lines',
        'variant_cost_history', 'pick_lists', 'pick_list_items',
        'product_batches'
      );

  SELECT COUNT(*) INTO v_uses_helper
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'categories', 'products', 'product_variants', 'locations',
        'stock_logs', 'product_custom_field_defs',
        'stocktake_sessions', 'stocktake_lines',
        'variant_cost_history', 'pick_lists', 'pick_list_items',
        'product_batches'
      )
      AND (qual LIKE '%hotel_is_in_user_scope%' OR with_check LIKE '%hotel_is_in_user_scope%');

  SELECT COUNT(*) INTO v_uses_legacy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'categories', 'products', 'product_variants', 'locations',
        'stock_logs', 'product_custom_field_defs',
        'stocktake_sessions', 'stocktake_lines',
        'variant_cost_history', 'pick_lists', 'pick_list_items',
        'product_batches'
      )
      AND (qual LIKE '%= auth_hotel_id()%' OR with_check LIKE '%= auth_hotel_id()%');

  RAISE NOTICE '── 111a POST-FLIGHT ───────────────────────────────────';
  RAISE NOTICE 'Inventory-domain policies after rewrite: %', v_policy_count;
  RAISE NOTICE 'Policies now using hotel_is_in_user_scope: % (expect = total)', v_uses_helper;
  RAISE NOTICE 'Policies still using legacy auth_hotel_id(): % (expect 0)', v_uses_legacy;
  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'Inventory tier now org-aware. Next: 111b (procurement).';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary of behavioral change:
--
--   Before: every inventory query implicitly filtered to auth_hotel_id().
--           Org-level users saw nothing across the portfolio.
--
--   After:  hotel_is_in_user_scope(hotel_id) returns true when:
--             (a) hotel_id = auth_hotel_id()   — direct hotel membership, OR
--             (b) caller has org_director/regional_manager role on the
--                 organization that owns hotel_id
--
--           Single-hotel users:    zero behavioral change (case (a) wins)
--           Multi-property users:  full portfolio visibility (case (b) wins)
--
-- NEXT:  111b (procurement RLS) → 111c (intelligence RLS)
-- ═══════════════════════════════════════════════════════════════════════════════
