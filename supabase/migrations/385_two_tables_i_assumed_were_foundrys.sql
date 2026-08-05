-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 385 — the generic edge store, and a policy table nothing reads.
--
-- relationship_edges_store is the SAME MISTAKE as object_links, which 382
-- deleted for exactly this reason: a universal edge-per-row table is not how
-- Foundry backs a relationship. `create-link-type.md` offers object type foreign
-- keys or a join dataset — a DATASOURCE either way. I deleted one and kept the
-- other in the same migration without noticing they were the same shape.
--
-- org_policy held auto-execution thresholds, monitor configuration and loop
-- goals for gates deleted in 373. No code reads it.
--
-- The relationship_edges view goes with the store it projected.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP VIEW IF EXISTS public.relationship_edges CASCADE;
DROP TABLE IF EXISTS public.relationship_edges_store CASCADE;
DROP TABLE IF EXISTS public.org_policy CASCADE;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('relationship_edges_store','org_policy');
  IF n > 0 THEN RAISE EXCEPTION 'Migration 385: % survived', n; END IF;

  -- link_types is the authority on relationships and must be untouched.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='link_types') THEN
    RAISE EXCEPTION 'Migration 385: CASCADE took link_types';
  END IF;
END $$;

COMMIT;
