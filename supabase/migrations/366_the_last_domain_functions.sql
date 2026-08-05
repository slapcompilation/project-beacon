-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 366 — the domain functions the tables left behind, and one grant
-- that 365 gave away.
--
-- SECURITY FIRST. `anonymize_user_pii` was dropped by 364 and recreated by 365,
-- and a recreated function gets DEFAULT grants — so anon could EXECUTE a
-- SECURITY DEFINER function again, which migration 176 had revoked. The
-- security_invariants contract caught it on the next run, which is the whole
-- point of that test existing. Revoked here.
--
-- Then the functions 364's table drop orphaned. CASCADE cannot reach a function
-- body, so these survived their own tables: POS variance detection, the GL
-- export summary, variant flow, process mining, the intelligence cycle, the
-- integration-health alert, approval thresholds, and six edge triggers that
-- fired on inserts into tables that no longer exist — including
-- trg_restock_approval_edges, the last writer of approved_by and rejected_by.
--
-- `pnpm check:shape` found every one of them by asking a question no list can
-- answer for you: what reaches this?
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE ALL ON FUNCTION public.anonymize_user_pii(uuid, text) FROM anon;

DO $$
DECLARE
  doomed text[] := ARRAY[
    'detect_and_alert_pos_variance','get_gl_export_summary','get_variant_flow',
    'mine_process','raise_integration_health_alert','run_intelligence_cycle',
    'update_approval_thresholds','trg_po_invoice_edges','trg_po_line_edges',
    'trg_product_batch_edges','trg_restock_approval_edges','trg_restock_fulfilled_edge',
    'trg_restock_receive_edges'
  ];
  fn record;
  n int;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = ANY(doomed)
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 366: % domain function(s) survived', n; END IF;
END $$;

-- Exemptions for functions that no longer exist are an allowlist rotting in the
-- other direction; check:shape reports them for the same reason it reports an
-- unreachable function.
DELETE FROM public.shape_registry
 WHERE object_kind = 'function'
   AND object_name IN ('seed_demo_world','seed_demo_hotel_data','seed_demo_booking_forecasts',
                       'seed_scale_test','backfill_forecast_observations','rebuild_relationship_edges_view');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE grantee = 'anon' AND routine_schema = 'public' AND routine_name = 'anonymize_user_pii'
  ) THEN
    RAISE EXCEPTION 'Migration 366: anon can still execute anonymize_user_pii';
  END IF;
END $$;

COMMIT;
