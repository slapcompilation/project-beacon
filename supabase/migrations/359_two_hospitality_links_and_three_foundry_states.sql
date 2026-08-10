-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 359 — the engine teardown reaches the vocabulary, and the two halves
-- get opposite treatment.
--
-- Deleting the hospitality half of packages/reality-graph took the last
-- consumers of five CHECK values with it. They are not the same kind of thing.
--
-- HOSPITALITY, so removed: contracted_with and contract_covers were read only by
-- get_contract_terms — a Logic Tool about supplier contracts, deleted with the
-- rest of the domain tools. No link type backs either, and the store is empty.
--
-- FOUNDRY, so declared: model_deployments.{starting,running,stopped} lost their
-- consumer when DeploymentDetailPage went, and that page was ours. The states
-- are Palantir's. `mirror/manage-models/compute-usage.md`:
--
--   "Live deployments will run until they are explicitly stopped or canceled.
--    It is important to monitor for live deployment usage to ensure that
--    deployments are not erroneously left running when they are not needed."
--
-- and `mirror/manage-models/create-a-model-deployment.md`: "To create and start
-- a direct model deployment... Once running, you can interactively test the
-- deployment by selecting Run."
--
-- A live deployment that starts, runs and stops is the documented lifecycle.
-- Removing those names to satisfy the guard would delete Foundry's grammar
-- because our page for it went — the same mistake migration 355 refused to make
-- with link cardinality.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  dead text[] := ARRAY['contracted_with','contract_covers'];
  v text; def text; n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store WHERE edge_type = ANY(dead);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 359: % row(s) still hold a retired name', n; END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 359: the edge_type CHECK is missing'; END IF;

  FOREACH v IN ARRAY dead LOOP
    IF position('''' || v || '''::text' IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 359: the CHECK does not list %', v;
    END IF;
    def := replace(def, '''' || v || '''::text, ', '');
    def := replace(def, ', ''' || v || '''::text', '');
  END LOOP;

  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check ' || def;
END $$;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
VALUES
  ('vocabulary', 'model_deployments.starting', 'intentional_unreachable',
   'Foundry live-deployment lifecycle (manage-models/create-a-model-deployment.md). Unconsumed only because our deployment page went with the hospitality teardown.'),
  ('vocabulary', 'model_deployments.running', 'intentional_unreachable',
   'Foundry live-deployment lifecycle — "deployments... erroneously left running" (manage-models/compute-usage.md).'),
  ('vocabulary', 'model_deployments.stopped', 'intentional_unreachable',
   'Foundry live-deployment lifecycle — "run until they are explicitly stopped or canceled" (manage-models/compute-usage.md).')
ON CONFLICT (object_kind, object_name) DO UPDATE
  SET classification = EXCLUDED.classification, reason = EXCLUDED.reason;

DO $$
DECLARE def text; v text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 359: the CHECK did not come back'; END IF;

  FOREACH v IN ARRAY ARRAY['contracted_with','contract_covers'] LOOP
    IF position('''' || v || '''::text' IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 359: % survived', v;
    END IF;
  END LOOP;
  -- contract_covers is a prefix-neighbour of nothing, but sourced_from is the
  -- one a sloppy replace would take.
  IF position('''sourced_from''::text' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 359: the rewrite took sourced_from with it';
  END IF;

  IF (SELECT count(*) FROM shape_registry
       WHERE object_kind='vocabulary' AND object_name LIKE 'model_deployments.%') <> 3 THEN
    RAISE EXCEPTION 'Migration 359: the deployment-state declarations did not land';
  END IF;
END $$;

COMMIT;
