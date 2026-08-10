-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 381 — five functions the contract suite was the only caller of.
--
-- unbacked_vocabulary, unprojected_link_types and builtin_property_drift were
-- written FOR ontology_drift.sql; create_relationship_edge and get_hotel_graph
-- were the graph read/write the deleted C7/C8 exercised. With the suite gone
-- nothing reaches any of them.
--
-- The suite went because Foundry deals with data contracts another way; these
-- helpers were shaped around ours, so they go with it rather than waiting for a
-- caller that will not arrive in that form.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY['unbacked_vocabulary','unprojected_link_types',
                         'builtin_property_drift','create_relationship_edge','get_hotel_graph'];
  fn record; n int;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname='public' AND p.proname = ANY(doomed)
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 381: % survived', n; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='object_types') THEN
    RAISE EXCEPTION 'Migration 381: CASCADE reached the ontology';
  END IF;
END $$;

COMMIT;
