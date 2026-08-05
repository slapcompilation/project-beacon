-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 375 — three declarations whose table is gone.
--
-- 359 declared model_deployments.{starting,running,stopped} rather than deleting
-- them, on the argument that the states are Palantir's ("Live deployments will
-- run until they are explicitly stopped or canceled" — manage-models/
-- compute-usage.md) even though our page for them was ours.
--
-- That argument held while the CHECK existed. 373 dropped model_deployments
-- entirely — our deployment model was an approximation, not Foundry's — so the
-- declarations now point at nothing. An allowlist rots in both directions and
-- the guard says so.
--
-- The citation does not disappear with the rows: when live deployments are built
-- properly, the states come back with the table that holds them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM public.shape_registry
 WHERE object_kind = 'vocabulary' AND object_name LIKE 'model_deployments.%';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shape_registry
              WHERE object_kind='vocabulary' AND object_name LIKE 'model_deployments.%') THEN
    RAISE EXCEPTION 'Migration 375: the stale declarations survived';
  END IF;
END $$;

COMMIT;
