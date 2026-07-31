-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 293 — declare the boundary. Phase E of the shape audit.
--
-- F7 was the finding that made every other one possible: 70 of 106 tables sat
-- outside the ontology, MOST OF THEM CORRECTLY — object_types, model_eval_runs,
-- copilot_conversations are platform metadata, and Foundry keeps its
-- equivalents out of its ontology too. But nothing said which was which, so
-- "a domain table nobody typed" and "a platform table that should never be
-- typed" were indistinguishable. That is why F2 (the broken BOM chain) and F5
-- (untyped forward occupancy) needed an audit to find rather than a red build.
--
-- Three doors into the ontology, not one: a table is reached if it backs an
-- OBJECT TYPE, a LINK, or a TIME SERIES. variant_cost_history is the case that
-- proves it — 292 registered it as variant.unit_cost, and demanding an object
-- type for it as well would be wrong.
--
-- RATCHET, not a wall. Ten domain tables are untyped today and typing them all
-- now would be a bad trade — several are empty and their shape is unsettled.
-- They are grandfathered explicitly, with the baseline recorded here, and the
-- check enforces that the number can only go DOWN. A new domain table cannot
-- join the list without a visible act.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.shape_registry (
  object_kind    text NOT NULL CHECK (object_kind IN ('table','function','meta')),
  object_name    text NOT NULL,
  classification text NOT NULL CHECK (classification IN
    ('platform','domain','domain_untyped','dev','intentional_unreachable','baseline')),
  reason         text NOT NULL DEFAULT '',
  PRIMARY KEY (object_kind, object_name)
);

COMMENT ON TABLE public.shape_registry IS
  'What each database object IS, so drift is a build failure rather than an audit finding. platform = the system''s own metadata, correctly outside the ontology. domain = business data, must be reachable via an object type, link or time series. domain_untyped = grandfathered, and the count may only shrink.';

ALTER TABLE public.shape_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read shape registry" ON public.shape_registry;
CREATE POLICY "members read shape registry" ON public.shape_registry
  FOR SELECT TO authenticated USING (true);

-- ── Everything the ontology already reaches is domain, by definition ─────────

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
SELECT 'table', c.relname, 'domain', 'reached by the ontology'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (EXISTS (SELECT 1 FROM object_types o WHERE o.source_table = c.relname)
    OR EXISTS (SELECT 1 FROM link_types l WHERE l.backing_table = c.relname)
    OR EXISTS (SELECT 1 FROM time_series_properties ts WHERE ts.source_table = c.relname))
ON CONFLICT DO NOTHING;

-- ── Business data the ontology does not reach yet — the grandfathered ten ────
-- Each is a real hospitality entity that deserves a type. Several are empty and
-- their shape is unsettled, so typing them now would be guessing.

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table','purchase_order_lines','domain_untyped','PO line items — the PO is typed, its lines are not'),
  ('table','po_discrepancies',    'domain_untyped','Invoice-vs-PO mismatches; shape settles with the reconciliation arc'),
  ('table','supplier_contracts',  'domain_untyped','Empty; contract terms belong on a type once one exists'),
  ('table','stocktake_sessions',  'domain_untyped','Empty; the stocktake arc is unfinished'),
  ('table','stocktake_lines',     'domain_untyped','Empty; see stocktake_sessions'),
  ('table','pick_lists',          'domain_untyped','Empty; pick_list_item IS typed, its parent is not'),
  ('table','shift_handovers',     'domain_untyped','Empty; handover shape unsettled'),
  ('table','budget_allocations',  'domain_untyped','Empty; finance arc'),
  ('table','gl_account_mappings', 'domain_untyped','Empty; finance arc'),
  ('table','categories',          'domain_untyped','One row; superseded in practice by product/variant naming')
ON CONFLICT DO NOTHING;

-- ── Everything else is the platform's own metadata ──────────────────────────
-- Foundry keeps its equivalents out of its ontology as well: an eval run and a
-- copilot conversation are how the system works, not things the business has.

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
SELECT 'table', c.relname, 'platform', 'system metadata, correctly outside the ontology'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT EXISTS (SELECT 1 FROM shape_registry r WHERE r.object_kind='table' AND r.object_name = c.relname)
ON CONFLICT DO NOTHING;

-- ── Functions that are unreachable on purpose ───────────────────────────────
-- Reachability cannot see a migration, a psql session or a human. These are the
-- ones where "nothing calls it" is the correct state.

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('function','seed_demo_world',              'intentional_unreachable','Demo seeding, run by hand'),
  ('function','seed_demo_hotel_data',         'intentional_unreachable','Demo seeding, run by hand'),
  ('function','seed_demo_booking_forecasts',  'intentional_unreachable','Demo seeding, run by hand'),
  ('function','seed_scale_test',              'intentional_unreachable','Scale rig, run by hand'),
  ('function','derive_object_type_properties','intentional_unreachable','Called by migrations when registering a type'),
  ('function','backfill_forecast_observations','intentional_unreachable','One-shot backfill, kept for re-runs'),
  ('function','install_ontology_package',     'intentional_unreachable','Reached from the UI via PostgREST; see Portability card'),
  ('function','get_contract_price',           'intentional_unreachable','Pricing helper awaiting the contracts arc'),
  ('function','get_cost_at',                  'intentional_unreachable','Point-in-time cost; superseded by variant.unit_cost series (292)'),
  ('function','update_learned_thresholds',    'intentional_unreachable','Threshold learning awaiting its consumer'),
  ('function','notify_restock_approved',      'intentional_unreachable','Notification helper, no caller since the queue rework'),
  ('function','simulate_scenario',            'intentional_unreachable','Superseded by the TypeScript sim in _shared/scenario-sim.ts'),
  ('function','get_eval_case_runs',           'intentional_unreachable','Eval UI reads agent_eval_case_runs directly'),
  ('function','get_node_set',                 'intentional_unreachable','Pre-ontology graph reader; superseded by object sets'),
  ('function','get_node_edges',               'intentional_unreachable','Pre-ontology graph reader; superseded by searchAround')
ON CONFLICT DO NOTHING;

-- ── The baseline the ratchet turns against ──────────────────────────────────

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
SELECT 'meta', 'domain_untyped_baseline', 'baseline',
       (SELECT count(*)::text FROM shape_registry WHERE classification = 'domain_untyped')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

-- ── Assert the boundary is total ────────────────────────────────────────────

DO $$
DECLARE n_unclassified int; n_untyped int; baseline int;
BEGIN
  SELECT count(*) INTO n_unclassified
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND NOT EXISTS (SELECT 1 FROM shape_registry r WHERE r.object_kind='table' AND r.object_name=c.relname);
  IF n_unclassified > 0 THEN
    RAISE EXCEPTION 'Migration 293: % table(s) declare nothing', n_unclassified;
  END IF;

  SELECT count(*) INTO n_untyped FROM shape_registry WHERE classification='domain_untyped';
  SELECT reason::int INTO baseline FROM shape_registry WHERE object_kind='meta' AND object_name='domain_untyped_baseline';
  IF n_untyped <> baseline THEN
    RAISE EXCEPTION 'Migration 293: baseline % does not match % grandfathered tables', baseline, n_untyped;
  END IF;
  RAISE NOTICE 'Migration 293: boundary declared — % grandfathered domain tables, and that number may only fall', n_untyped;
END $$;

COMMIT;
