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
--   Special cases:
--     - `notifications`: user_id filter MUST stay on read (notifications are
--       personal, not hotel-shared). Even an org_director should not see
--       another user's notifications.
--     - `alert_preferences`, `webhook_endpoints`, `webhook_deliveries`:
--       admin role check extended to accept org-level roles too.
--
-- TABLES TOUCHED (~27 policies across 14 tables):
--   notifications, action_history, saved_reports,
--   occupancy_logs, pms_connections, booking_forecasts,
--   menu_items, pos_sales,
--   proposal_outcomes, variant_learned_thresholds, alert_preferences,
--   shift_handovers,
--   webhook_endpoints, webhook_deliveries
--
-- NOT TOUCHED (handled elsewhere):
--   - relationship_edges, custom_removal_reasons → migration 112
--   - Inventory tables → 111a
--   - Procurement tables → 111b
--   - Functions and views without RLS (cross_domain_incidents, copilot_feedback,
--     variant_embeddings) → no policies needed
--
-- Depends on: 001, 006, 053, 064, 065, 093, 094, 101, 104, 105, 111
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
        'notifications', 'action_history', 'saved_reports',
        'occupancy_logs', 'pms_connections', 'booking_forecasts',
        'menu_items', 'pos_sales',
        'proposal_outcomes', 'variant_learned_thresholds', 'alert_preferences',
        'shift_handovers',
        'webhook_endpoints', 'webhook_deliveries'
      );

  RAISE NOTICE '── 111c PRE-FLIGHT ────────────────────────────────────';
  RAISE NOTICE 'Intelligence-domain policies before rewrite: %', v_policy_count;
  RAISE NOTICE '──────────────────────────────────────────────────────';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- notifications — 3 policies (read user-scoped, insert hotel-scoped, mark_read user-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
-- READS preserve the personal user_id filter — notifications are private to
-- the recipient. Org directors cannot read another user's inbox.
-- INSERTS use hotel scope so cross-hotel agents can fan out alerts.
-- UPDATE (mark read) stays user-scoped.

DROP POLICY IF EXISTS "own_notifications"        ON notifications;
DROP POLICY IF EXISTS "hotel_isolation_insert"   ON notifications;
DROP POLICY IF EXISTS "mark_read"                ON notifications;
DROP POLICY IF EXISTS "hotel_isolation"          ON notifications;
DROP POLICY IF EXISTS "notifications_select"     ON notifications;
DROP POLICY IF EXISTS "notifications_insert"     ON notifications;
DROP POLICY IF EXISTS "notifications_update"     ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- action_history — 2 policies (read + insert)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation_select" ON action_history;
DROP POLICY IF EXISTS "hotel_isolation_insert" ON action_history;
DROP POLICY IF EXISTS "action_history_select"  ON action_history;
DROP POLICY IF EXISTS "action_history_insert"  ON action_history;

CREATE POLICY "action_history_select" ON action_history
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "action_history_insert" ON action_history
  FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- saved_reports — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_isolation"     ON saved_reports;
DROP POLICY IF EXISTS "saved_reports_scope" ON saved_reports;

CREATE POLICY "saved_reports_scope" ON saved_reports
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- occupancy_logs — 4 policies (split SELECT/INSERT/UPDATE/DELETE)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "occ_select" ON occupancy_logs;
DROP POLICY IF EXISTS "occ_insert" ON occupancy_logs;
DROP POLICY IF EXISTS "occ_update" ON occupancy_logs;
DROP POLICY IF EXISTS "occ_delete" ON occupancy_logs;

CREATE POLICY "occ_select" ON occupancy_logs FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "occ_insert" ON occupancy_logs FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "occ_update" ON occupancy_logs FOR UPDATE
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "occ_delete" ON occupancy_logs FOR DELETE
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- pms_connections — 1 policy (read-only; writes via service_role)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "pms_conn_select"   ON pms_connections;
DROP POLICY IF EXISTS "pms_conn_scope"    ON pms_connections;

CREATE POLICY "pms_conn_scope" ON pms_connections
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- booking_forecasts — 4 policies
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "bkf_select" ON booking_forecasts;
DROP POLICY IF EXISTS "bkf_insert" ON booking_forecasts;
DROP POLICY IF EXISTS "bkf_update" ON booking_forecasts;
DROP POLICY IF EXISTS "bkf_delete" ON booking_forecasts;

CREATE POLICY "bkf_select" ON booking_forecasts FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "bkf_insert" ON booking_forecasts FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "bkf_update" ON booking_forecasts FOR UPDATE
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "bkf_delete" ON booking_forecasts FOR DELETE
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- menu_items — 1 policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "mi_all"            ON menu_items;
DROP POLICY IF EXISTS "menu_items_scope"  ON menu_items;

CREATE POLICY "menu_items_scope" ON menu_items
  FOR ALL
  USING      (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- pos_sales — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ps_select"        ON pos_sales;
DROP POLICY IF EXISTS "pos_sales_select" ON pos_sales;

CREATE POLICY "pos_sales_select" ON pos_sales
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- proposal_outcomes — 1 policy (read-only; writes via service_role agent)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "po_select"               ON proposal_outcomes;
DROP POLICY IF EXISTS "proposal_outcomes_scope" ON proposal_outcomes;

CREATE POLICY "proposal_outcomes_scope" ON proposal_outcomes
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- variant_learned_thresholds — 1 policy (read-only)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "vlt_select"                       ON variant_learned_thresholds;
DROP POLICY IF EXISTS "variant_learned_thresholds_scope" ON variant_learned_thresholds;

CREATE POLICY "variant_learned_thresholds_scope" ON variant_learned_thresholds
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- alert_preferences — 2 policies (read + admin write)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Write extended to accept org-level roles.

DROP POLICY IF EXISTS "hotel_members_read_alert_preferences"  ON alert_preferences;
DROP POLICY IF EXISTS "admins_write_alert_preferences"        ON alert_preferences;
DROP POLICY IF EXISTS "alert_preferences_read"                ON alert_preferences;
DROP POLICY IF EXISTS "alert_preferences_write"               ON alert_preferences;

CREATE POLICY "alert_preferences_read" ON alert_preferences
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "alert_preferences_write" ON alert_preferences
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
-- shift_handovers — 2 policies (read + insert)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hotel_members_read_handovers"   ON shift_handovers;
DROP POLICY IF EXISTS "hotel_members_write_handovers"  ON shift_handovers;
DROP POLICY IF EXISTS "shift_handovers_read"           ON shift_handovers;
DROP POLICY IF EXISTS "shift_handovers_insert"         ON shift_handovers;

CREATE POLICY "shift_handovers_read" ON shift_handovers
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "shift_handovers_insert" ON shift_handovers
  FOR INSERT
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

-- ═══════════════════════════════════════════════════════════════════════════════
-- webhook_endpoints — 2 policies (read + admin write)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Write extended to accept org-level roles.

DROP POLICY IF EXISTS "hotel_members_read_webhook_endpoints" ON webhook_endpoints;
DROP POLICY IF EXISTS "admins_manage_webhook_endpoints"      ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_read"               ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_write"              ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_read" ON webhook_endpoints
  FOR SELECT
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "webhook_endpoints_write" ON webhook_endpoints
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
-- webhook_deliveries — 1 policy (admin read only; inserts via service_role)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Read extended to accept org-level roles. Writes still service_role only
-- (no policy → blocked for client; service_role bypasses RLS).

DROP POLICY IF EXISTS "admins_read_webhook_deliveries"  ON webhook_deliveries;
DROP POLICY IF EXISTS "webhook_deliveries_read"         ON webhook_deliveries;

CREATE POLICY "webhook_deliveries_read" ON webhook_deliveries
  FOR SELECT
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND (
      auth_role()     IN ('admin', 'owner')
      OR auth_org_role() IS NOT NULL
    )
  );

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
  RAISE NOTICE 'Policies now using hotel_is_in_user_scope: % (expect = total minus 1 for notifications mark_read)', v_uses_helper;
  RAISE NOTICE 'Policies still using legacy auth_hotel_id(): % (expect 0)', v_uses_legacy;
  RAISE NOTICE '──────────────────────────────────────────────────────';
  RAISE NOTICE 'Phase R1 RLS rewrite COMPLETE.';
  RAISE NOTICE 'Inventory (111a) + Procurement (111b) + Intelligence (111c) all org-aware.';
  RAISE NOTICE 'Next: portfolio switcher in Topbar, then 112 (TRANSFER_STOCK action).';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Behavioral change summary:
--
--   notifications:
--     - Personal inbox semantics PRESERVED. Each user sees only their own
--       notifications, even if they have org_director role.
--     - Insert can target any in-scope hotel (so cross-hotel agents can
--       fan out alerts to the right recipients).
--
--   action_history, occupancy_logs, booking_forecasts, menu_items,
--   pos_sales, saved_reports, shift_handovers, pms_connections:
--     - Hotel users: unchanged.
--     - Org users: portfolio-wide read+write (where the original policy allowed).
--
--   proposal_outcomes, variant_learned_thresholds:
--     - Read-only for clients; writes via service_role (agents).
--     - Org users gain portfolio-wide visibility into the feedback flywheel.
--
--   alert_preferences, webhook_endpoints, webhook_deliveries:
--     - Read scope-aware.
--     - Write extended: hotel admin/owner OR any org-level role.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase R1 complete on the database side. Frontend portfolio surfaces
-- (Topbar org switcher, /portfolio briefing) follow next.
-- ═══════════════════════════════════════════════════════════════════════════════
