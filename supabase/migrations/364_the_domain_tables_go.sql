-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 364 — the hospitality schema.
--
-- Forty-two tables of inventory software: products and their variants, stock
-- logs, purchase orders and lines, invoices and discrepancies, suppliers and
-- contracts, restock requests and receives, stocktakes, pick lists, menus and
-- recipes, POS sales, occupancy, budgets, GL mappings, and the learned
-- thresholds and embeddings built on top of them.
--
-- Nothing here is Foundry. Object types describe a customer's own data
-- (`mirror/ontology/core-concepts.md` — the Ontology "reflects the real-world
-- objects that users at a given organization think about"), and a Foundry clone
-- ships with none: they arrive when someone registers an object type over a
-- datasource they brought.
--
-- CASCADE is deliberate and does the work no hand-written list could: it takes
-- the views, constraints, policies and triggers that depend on these tables,
-- including the approved_by / rejected_by edge triggers that have kept
-- db:contracts red since the ontology was emptied.
--
-- Postgres does NOT track function bodies as dependencies, so the domain RPCs
-- survive CASCADE and are dropped by name afterwards — every function that
-- reads a table being dropped and is not called by any surviving code.
--
-- Kept, and asserted below: the ontology framework (object_types, link_types,
-- object_records, object_links, interfaces, shared properties, time series),
-- the AIP tables (proposals, cases, documents, entities, principles,
-- constraints, approved answers), Workshop, projects, models, evals, tenancy
-- (hotels, organizations, profiles, users) and the guards' own tables.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY[
    'alert_preferences','booking_forecasts','budget_allocations','categories',
    'causal_trace_logs','custom_removal_reasons','delivery_events','events',
    'forecast_observations','gl_account_mappings','intelligence_snapshots',
    'link_linked_to_po','locations','menu_item_ingredients','menu_items',
    'occupancy_logs','pending_scans','pick_list_items','pick_lists',
    'po_discrepancies','po_invoices','pos_sales','product_batches',
    'product_custom_field_defs','product_variants','products',
    'purchase_order_lines','purchase_orders','restock_receives','restock_requests',
    'saved_reports','shift_handovers','stock_logs','stock_transfers',
    'stocktake_lines','stocktake_sessions','supplier_contracts','suppliers',
    'variant_alert_overrides','variant_cost_history','variant_embeddings',
    'variant_learned_thresholds','action_history','pending_action_approvals',
    'ontology_proposals','proposal_dismissals'
  ];
  t text;
  fn record;
  kept text[] := ARRAY[
    'object_types','link_types','object_records','object_links','ontology_interfaces',
    'shared_properties','time_series_properties','relationship_edges_store',
    'proposals','cases','documents','document_chunks','entities','principles',
    'constraints','approved_answers','modules','module_widgets','projects',
    'model_releases','model_eval_runs','user_action_types','user_action_log',
    'hotels','organizations','profiles','users','shape_registry'
  ];
  n int;
BEGIN
  FOREACH t IN ARRAY doomed LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', t);
    END IF;
  END LOOP;

  -- Functions are not dependency-tracked against a dropped table, so a domain
  -- RPC would sit there looking callable and fail at run time.
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.prokind = 'f'
       AND EXISTS (
         SELECT 1 FROM unnest(doomed) d
          WHERE p.prosrc ~ ('\m' || d || '\M')
       )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 364: % domain table(s) survived', n; END IF;

  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name = ANY(kept);
  IF n <> array_length(kept, 1) THEN
    RAISE EXCEPTION 'Migration 364: CASCADE took framework tables — % of % remain', n, array_length(kept, 1);
  END IF;
END $$;

COMMIT;
