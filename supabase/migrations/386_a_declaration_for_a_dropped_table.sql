-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 386 — one declaration outliving its table.
--
-- evidenced_by was declared against relationship_edges_store, which 385 dropped.
-- An allowlist rots in both directions and the guard reports it either way.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM public.shape_registry
 WHERE object_kind = 'vocabulary' AND object_name LIKE 'relationship_edges_store.%';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shape_registry
              WHERE object_kind='vocabulary' AND object_name LIKE 'relationship_edges_store.%') THEN
    RAISE EXCEPTION 'Migration 386: the declaration survived';
  END IF;
END $$;

COMMIT;
