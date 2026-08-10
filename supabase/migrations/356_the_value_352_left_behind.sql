-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 356 — 352 deleted the link type and left its name in the CHECK.
--
-- Migration 352 removed four link types nothing traversed, together with their
-- backing tables. It did not remove their names from the edge_type vocabulary on
-- relationship_edges_store, and three of the four went unnoticed because they
-- still appear in legacy code: 'causes' in FlowGraph.tsx, 'triggered_alert' and
-- 'influenced_by_occupancy' inside auto_create_alerts, ingest_pos_sale,
-- seed_demo_world, swap_variant_stock and trg_stock_log_occupancy_edge. Those
-- fall with the domain layer they belong to.
--
-- 'log_fulfills_request' had no such cover — no code, no policy, no function, and
-- no row — so `pnpm check:vocabulary` reported it, which is precisely its job:
-- "a CHECK value with no code, no data and no declaration reads as a working
-- feature and is not one."
--
-- There is nothing to cite from Foundry here and nothing to decide. A link type
-- is "a relationship between object types" (mirror/object-link-types/
-- link-types-overview.md); this one was deleted four migrations ago, so its name
-- in a constraint is residue, not vocabulary.
--
-- The store is empty, so no row can contradict the narrower list.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  def text;
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store
   WHERE edge_type = 'log_fulfills_request';
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 356: % row(s) still hold log_fulfills_request', n;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname = 'public' AND t.relname = 'relationship_edges_store'
     AND c.conname = 'relationship_edges_edge_type_check';

  IF def IS NULL THEN
    RAISE EXCEPTION 'Migration 356: the edge_type CHECK is not there to edit';
  END IF;
  IF position('''log_fulfills_request''::text, ' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 356: the CHECK does not list log_fulfills_request';
  END IF;

  -- Rewriting the whole list by hand is how a value gets dropped by accident, so
  -- the migration edits the definition it just read.
  def := replace(def, '''log_fulfills_request''::text, ', '');

  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check ' || def;
END $$;

DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname = 'public' AND t.relname = 'relationship_edges_store'
     AND c.conname = 'relationship_edges_edge_type_check';

  IF def IS NULL OR position('log_fulfills_request' IN def) > 0 THEN
    RAISE EXCEPTION 'Migration 356: log_fulfills_request survived the rewrite';
  END IF;
  -- A neighbour lost to a sloppy replace would be silent otherwise.
  IF position('''line_fulfills_request''::text' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 356: the rewrite took line_fulfills_request with it';
  END IF;
END $$;

COMMIT;
