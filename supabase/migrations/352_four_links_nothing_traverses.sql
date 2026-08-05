-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 352 — four link types nothing traverses.
--
-- A link type exists to be walked. Foundry's definition is a relationship
-- between two object types whose instances connect two objects
-- (`mirror/object-link-types/link-types-overview.md`), and the whole value is
-- that something crosses it — a tool, an agent, a search-around, an Object View
-- section.
--
-- These four are crossed by nothing:
--
--   causes                   pos_sale -> stock_log            0 rows
--   log_fulfills_request     stock_log -> restock_request     0 rows
--   triggered_alert          stock_log -> alert               0 rows
--   influenced_by_occupancy  stock_log -> occupancy_log   3,802 rows
--
-- The first three were empty. The fourth had rows and still qualifies, which is
-- the part worth writing down: its only consumers were a CSS class in
-- GraphConnections and a display label in objectPresentation. No tool, no agent,
-- no computed property, no query read the edges. Rows are not a capability, and
-- "it has data" is not the same claim as "something uses it".
--
-- log_fulfills_request also had a WRITER in the action registry that produced
-- nothing. Checked before assuming a broken write path: link_influenced_by_
-- principle holds 261 rows and link_mentions 76, so edge writes land correctly
-- elsewhere. That code path simply never fires. Removing the writer with the
-- link type keeps the two in step.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM public.link_types
 WHERE api_name IN ('causes', 'log_fulfills_request', 'triggered_alert', 'influenced_by_occupancy');

-- Rebuild BEFORE dropping. relationship_edges is a projection whose body is
-- generated from link_types, so while it still names these tables they cannot be
-- dropped. Rebuilding with the rows already gone removes the references first.
SELECT public.rebuild_relationship_edges_view();

DROP TABLE IF EXISTS public.link_causes;
DROP TABLE IF EXISTS public.link_log_fulfills_request;
DROP TABLE IF EXISTS public.link_triggered_alert;
DROP TABLE IF EXISTS public.link_influenced_by_occupancy;

DO $$
DECLARE n int; leftover text;
BEGIN
  SELECT count(*) INTO n FROM link_types
   WHERE api_name IN ('causes', 'log_fulfills_request', 'triggered_alert', 'influenced_by_occupancy');
  IF n > 0 THEN RAISE EXCEPTION 'Migration 352: % link type(s) survived', n; END IF;

  SELECT string_agg(c.relname, ', ') INTO leftover
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('link_causes','link_log_fulfills_request',
                      'link_triggered_alert','link_influenced_by_occupancy');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 352: backing table(s) survived: %', leftover;
  END IF;

  -- The projection must not still claim an edge type whose backing is gone.
  SELECT string_agg(DISTINCT edge_type, ', ') INTO leftover
  FROM relationship_edges
  WHERE edge_type IN ('causes','log_fulfills_request','triggered_alert','influenced_by_occupancy');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 352: relationship_edges still projects: %', leftover;
  END IF;

  -- Every remaining projected link type must still surface, or the rebuild
  -- dropped more than it was asked to.
  SELECT count(*) INTO n FROM link_types WHERE projected;
  IF n < 30 THEN RAISE EXCEPTION 'Migration 352: only % projected link types remain', n; END IF;
END $$;

COMMIT;
