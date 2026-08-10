-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 389 — 106 declarations for tables that no longer exist.
--
-- shape_registry is the guards' allowlist. Three kinds of row:
--   table       classifies a table as `domain` (the ontology must reach it) or
--               framework, so audit-shape.mjs knows what to demand of it
--   function    an exemption: this function is deliberately unreachable, here is why
--   vocabulary  a CHECK value deliberately ahead of its runtime, with a citation
--
-- It held 120 table rows against 14 live tables. audit-shape.mjs joins to
-- information_schema and reported OK, so the rot was invisible in the direction
-- that mattered: it checks for a function exemption naming a function that does
-- not exist, and for a vocabulary declaration whose CHECK is gone, but never for
-- a TABLE row whose table is gone.
--
-- The rows go. The asymmetry in the guard is worth its own fix and is not one.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM public.shape_registry sr
 WHERE sr.object_kind = 'table'
   AND NOT EXISTS (
     SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = sr.object_name);

DO $$
DECLARE stale int;
BEGIN
  SELECT count(*) INTO stale FROM shape_registry sr
   WHERE sr.object_kind='table'
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables t
                      WHERE t.table_schema='public' AND t.table_name = sr.object_name);
  IF stale > 0 THEN RAISE EXCEPTION 'Migration 389: % stale table row(s) remain', stale; END IF;
END $$;

COMMIT;
