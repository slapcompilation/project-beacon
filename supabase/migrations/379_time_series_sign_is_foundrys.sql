-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 379 — value sign on a time series property.
--
-- Its consumer was time_series_points(), dropped in 378 with the domain. The
-- VALUES are Foundry's: a time series property declares whether its values are
-- positive or negative, and `mirror/object-link-types/` carries time series as
-- one of the property base types the ontology offers.
--
-- Declared rather than deleted, on the same reasoning as link cardinality in
-- 355: the grammar of a property base type outlives the absence of any property
-- using it. Deleting it would mean the first time series someone registers
-- cannot say which way its values run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason)
VALUES
  ('vocabulary', 'time_series_properties.positive', 'intentional_unreachable',
   'Value sign on a Foundry time series property. Unconsumed only because no time series is registered; the grammar outlives the content.'),
  ('vocabulary', 'time_series_properties.negative', 'intentional_unreachable',
   'Value sign on a Foundry time series property. See positive.')
ON CONFLICT (object_kind, object_name) DO UPDATE
  SET classification = EXCLUDED.classification, reason = EXCLUDED.reason;

DO $$
BEGIN
  IF (SELECT count(*) FROM shape_registry
       WHERE object_kind='vocabulary' AND object_name LIKE 'time_series_properties.%') <> 2 THEN
    RAISE EXCEPTION 'Migration 379: the declarations did not land';
  END IF;
END $$;

COMMIT;
