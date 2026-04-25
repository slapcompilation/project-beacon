-- ═══════════════════════════════════════════════════════════════════════════════
-- 111c — Intelligence RLS extended to Organization scope
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- FRAMING — the three influences:
--
--   FOUNDRY    Closes the loop on the RLS rewrite. Every node in the Reality
--              Graph — inventory (111a), procurement (111b), and now
--              intelligence — uses one helper for scope. Single source of
--              truth for "can this user see this hotel".
--
--   AIP        The agent stack now has uniform scope. A portfolio-level
--              chain-benchmarking agent reads occupancy_logs, booking_forecasts,
--              proposal_outcomes, and learned_thresholds across every property.
--              The feedback flywheel learns from the whole network, not one
--              hotel in isolation.
--
--   GALLATIN   Org-level briefing pages can now show consolidated alerts,
--              network-wide demand forecasts, chain-level POS variance, and
--              cross-property handover patterns. This is what makes the
--              Mind Layer (Phase R4 benchmarking) actually meaningful.
--
-- WHAT THIS MIGRATION DOES:
--   Replaces every `hotel_id = auth_hotel_id()` predicate on intelligence
--   tables with `hotel_is_in_user_scope(hotel_id)`.
--
--   Each table block is wrapped in IF EXISTS so missing tables (from
--   migrations not yet applied to this database) are silently skipped.
--   Re-running this migration after applying those backfilled tables will
--   correctly migrate them.
--
--   Special cases:
--     - `notifications`: user_id filter MUST stay on read (notifications are
--       personal, not hotel-shared). Even an org_director should not see
--       another user's notifications.
--     - `alert_preferences`, `webhook_endpoints`, `webhook_deliveries`:
--       admin role check extended to accept org-level roles too.
--
-- TABLES TOUCHED (~27 policies across up-to-14 tables):
--   notifications, action_history, saved_reports,
--   occupancy_logs, pms_connections, booking_forecasts,
--   menu_items, pos_sales,
--   proposal_outcomes, variant_learned_thresholds, alert_preferences,
--   shift_handovers,
--   webhook_endpoints, webhook_deliveries
--
-- Depends on: 001, 006, 053, 064, 065, 093, 094, 101, 104, 105, 111
-- Idempotent: every policy dropped before recreation; missing tables skipped
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC PRE-FLIGHT
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_policy_count int;
  v_table_present_count int;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      );

  SELECT COUNT(*) INTO v_table_present_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      );

  RAISE NOTICE '── 111c PRE-FLIGHT ────────────────────────────────────';
  RAISE NOTICE 'Tables present (out of 14):                  %', v_table_present_count;
  RAISE NOTICE 'Intelligence-domain policies before rewrite: %', v_policy_count;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;

-- ─── Helper macro: each block guards on table existence ────────────────────────
-- If a table doesn't exist (migration not applied), the block silently skips.
-- Re-running 111c after backfilling that table will pick it up.

-- ═══════════════════════════════════════════════════════════════════════════════
-- notifications — 3 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'DROP POLICY IF EXISTS "own_notifications"      ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "hotel_isolation_insert" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "mark_read"              ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "hotel_isolation"        ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_select"   ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_insert"   ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_update"   ON notifications';

    EXECUTE 'CREATE POLICY "notifications_select" ON notifications
      FOR SELECT USING (user_id = auth.uid() AND hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "notifications_insert" ON notifications
      FOR INSERT WITH CHECK (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "notifications_update" ON notifications
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- action_history — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'action_history') THEN
    EXECUTE 'DROP POLICY IF EXISTS "hotel_isolation_select" ON action_history';
    EXECUTE 'DROP POLICY IF EXISTS "hotel_isolation_insert" ON action_history';
    EXECUTE 'DROP POLICY IF EXISTS "action_history_select"  ON action_history';
    EXECUTE 'DROP POLICY IF EXISTS "action_history_insert"  ON action_history';

    EXECUTE 'CREATE POLICY "action_history_select" ON action_history
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "action_history_insert" ON action_history
      FOR INSERT WITH CHECK (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- saved_reports — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'saved_reports') THEN
    EXECUTE 'DROP POLICY IF EXISTS "hotel_isolation"     ON saved_reports';
    EXECUTE 'DROP POLICY IF EXISTS "saved_reports_scope" ON saved_reports';

    EXECUTE 'CREATE POLICY "saved_reports_scope" ON saved_reports
      FOR ALL USING (hotel_is_in_user_scope(hotel_id))
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- occupancy_logs — 4 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'occupancy_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "occ_select" ON occupancy_logs';
    EXECUTE 'DROP POLICY IF EXISTS "occ_insert" ON occupancy_logs';
    EXECUTE 'DROP POLICY IF EXISTS "occ_update" ON occupancy_logs';
    EXECUTE 'DROP POLICY IF EXISTS "occ_delete" ON occupancy_logs';

    EXECUTE 'CREATE POLICY "occ_select" ON occupancy_logs FOR SELECT
      USING (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "occ_insert" ON occupancy_logs FOR INSERT
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "occ_update" ON occupancy_logs FOR UPDATE
      USING (hotel_is_in_user_scope(hotel_id))
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "occ_delete" ON occupancy_logs FOR DELETE
      USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- pms_connections — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'pms_connections') THEN
    EXECUTE 'DROP POLICY IF EXISTS "pms_conn_select" ON pms_connections';
    EXECUTE 'DROP POLICY IF EXISTS "pms_conn_scope"  ON pms_connections';

    EXECUTE 'CREATE POLICY "pms_conn_scope" ON pms_connections
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- booking_forecasts — 4 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'booking_forecasts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "bkf_select" ON booking_forecasts';
    EXECUTE 'DROP POLICY IF EXISTS "bkf_insert" ON booking_forecasts';
    EXECUTE 'DROP POLICY IF EXISTS "bkf_update" ON booking_forecasts';
    EXECUTE 'DROP POLICY IF EXISTS "bkf_delete" ON booking_forecasts';

    EXECUTE 'CREATE POLICY "bkf_select" ON booking_forecasts FOR SELECT
      USING (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "bkf_insert" ON booking_forecasts FOR INSERT
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "bkf_update" ON booking_forecasts FOR UPDATE
      USING (hotel_is_in_user_scope(hotel_id))
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "bkf_delete" ON booking_forecasts FOR DELETE
      USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- menu_items — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "mi_all"           ON menu_items';
    EXECUTE 'DROP POLICY IF EXISTS "menu_items_scope" ON menu_items';

    EXECUTE 'CREATE POLICY "menu_items_scope" ON menu_items
      FOR ALL USING (hotel_is_in_user_scope(hotel_id))
      WITH CHECK (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- pos_sales — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'pos_sales') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ps_select"        ON pos_sales';
    EXECUTE 'DROP POLICY IF EXISTS "pos_sales_select" ON pos_sales';

    EXECUTE 'CREATE POLICY "pos_sales_select" ON pos_sales
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- proposal_outcomes — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'proposal_outcomes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "po_select"               ON proposal_outcomes';
    EXECUTE 'DROP POLICY IF EXISTS "proposal_outcomes_scope" ON proposal_outcomes';

    EXECUTE 'CREATE POLICY "proposal_outcomes_scope" ON proposal_outcomes
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- variant_learned_thresholds — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'variant_learned_thresholds') THEN
    EXECUTE 'DROP POLICY IF EXISTS "vlt_select"                       ON variant_learned_thresholds';
    EXECUTE 'DROP POLICY IF EXISTS "variant_learned_thresholds_scope" ON variant_learned_thresholds';

    EXECUTE 'CREATE POLICY "variant_learned_thresholds_scope" ON variant_learned_thresholds
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- alert_preferences — 2 policies (role-gated write extended to org roles)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'alert_preferences') THEN
    EXECUTE 'DROP POLICY IF EXISTS "hotel_members_read_alert_preferences" ON alert_preferences';
    EXECUTE 'DROP POLICY IF EXISTS "admins_write_alert_preferences"       ON alert_preferences';
    EXECUTE 'DROP POLICY IF EXISTS "alert_preferences_read"               ON alert_preferences';
    EXECUTE 'DROP POLICY IF EXISTS "alert_preferences_write"              ON alert_preferences';

    EXECUTE 'CREATE POLICY "alert_preferences_read" ON alert_preferences
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';

    EXECUTE 'CREATE POLICY "alert_preferences_write" ON alert_preferences
      FOR ALL
      USING (
        hotel_is_in_user_scope(hotel_id)
        AND (auth_role() IN (''admin'', ''owner'') OR auth_org_role() IS NOT NULL)
      )
      WITH CHECK (
        hotel_is_in_user_scope(hotel_id)
        AND (auth_role() IN (''admin'', ''owner'') OR auth_org_role() IS NOT NULL)
      )';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- shift_handovers — 2 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'shift_handovers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "hotel_members_read_handovers"  ON shift_handovers';
    EXECUTE 'DROP POLICY IF EXISTS "hotel_members_write_handovers" ON shift_handovers';
    EXECUTE 'DROP POLICY IF EXISTS "shift_handovers_read"          ON shift_handovers';
    EXECUTE 'DROP POLICY IF EXISTS "shift_handovers_insert"        ON shift_handovers';

    EXECUTE 'CREATE POLICY "shift_handovers_read" ON shift_handovers
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';
    EXECUTE 'CREATE POLICY "shift_handovers_insert" ON shift_handovers
      FOR INSERT WITH CHECK (hotel_is_in_user_scope(hotel_id))';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- webhook_endpoints — 2 policies (role-gated write extended)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'webhook_endpoints') THEN
    EXECUTE 'DROP POLICY IF EXISTS "hotel_members_read_webhook_endpoints" ON webhook_endpoints';
    EXECUTE 'DROP POLICY IF EXISTS "admins_manage_webhook_endpoints"      ON webhook_endpoints';
    EXECUTE 'DROP POLICY IF EXISTS "webhook_endpoints_read"               ON webhook_endpoints';
    EXECUTE 'DROP POLICY IF EXISTS "webhook_endpoints_write"              ON webhook_endpoints';

    EXECUTE 'CREATE POLICY "webhook_endpoints_read" ON webhook_endpoints
      FOR SELECT USING (hotel_is_in_user_scope(hotel_id))';

    EXECUTE 'CREATE POLICY "webhook_endpoints_write" ON webhook_endpoints
      FOR ALL
      USING (
        hotel_is_in_user_scope(hotel_id)
        AND (auth_role() IN (''admin'', ''owner'') OR auth_org_role() IS NOT NULL)
      )
      WITH CHECK (
        hotel_is_in_user_scope(hotel_id)
        AND (auth_role() IN (''admin'', ''owner'') OR auth_org_role() IS NOT NULL)
      )';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- webhook_deliveries — 1 policy (role-gated read)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'webhook_deliveries') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admins_read_webhook_deliveries" ON webhook_deliveries';
    EXECUTE 'DROP POLICY IF EXISTS "webhook_deliveries_read"        ON webhook_deliveries';

    EXECUTE 'CREATE POLICY "webhook_deliveries_read" ON webhook_deliveries
      FOR SELECT
      USING (
        hotel_is_in_user_scope(hotel_id)
        AND (auth_role() IN (''admin'', ''owner'') OR auth_org_role() IS NOT NULL)
      )';
  END IF;
END $$;

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
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      );

  SELECT COUNT(*) INTO v_uses_helper
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      )
      AND (qual LIKE '%hotel_is_in_user_scope%' OR with_check LIKE '%hotel_is_in_user_scope%');

  SELECT COUNT(*) INTO v_uses_legacy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      )
      AND (qual LIKE '%= auth_hotel_id()%' OR with_check LIKE '%= auth_hotel_id()%');

  RAISE NOTICE '── 111c POST-FLIGHT ───────────────────────────────────';
  RAISE NOTICE 'Intelligence-domain policies after rewrite: %', v_policy_count;
  RAISE NOTICE 'Policies now using hotel_is_in_user_scope: % (notifications.mark_read excluded by design)', v_uses_helper;
  RAISE NOTICE 'Policies still using legacy auth_hotel_id(): % (expect 0)', v_uses_legacy;
  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'Phase R1 RLS rewrite COMPLETE.';
  RAISE NOTICE 'Inventory (111a) + Procurement (111b) + Intelligence (111c) all org-aware.';
END $$;
