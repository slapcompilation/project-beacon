-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 378 — two functions the previous CASCADE uncovered.
--
-- time_series_points read a time series over a backing table; its callers went
-- with the domain and the ontology has no time series registered. It comes back
-- with the first one, against whatever backs it then.
--
-- Time series properties themselves STAY: `time_series_properties` is an
-- ontology table and one of Foundry's property base types.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.time_series_points(text, text, uuid, timestamptz, timestamptz, integer) CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname='public' AND p.proname = 'time_series_points') THEN
    RAISE EXCEPTION 'Migration 378: time_series_points survived';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='time_series_properties') THEN
    RAISE EXCEPTION 'Migration 378: the time series property table is the ontology and stays';
  END IF;
END $$;

COMMIT;
