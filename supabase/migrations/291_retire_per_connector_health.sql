-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 290 — three health mechanisms become one. Phase B, part 2.
--
-- Foundry (data-integration/health-checks): health checks are ONE service with
-- check types — job-level, build-level, freshness — applied to datasets. Dozens
-- of connectors feed the same machinery; there is no per-connector health API.
-- We had three, each covering a different subset:
--
--   get_pms_health          pms_connections              PMS only
--   get_pos_health          pos_connections              POS only
--   get_integration_health  pos_connections + documents  POS + documents, with
--                                                        "occupancy/PMS
--                                                        deferred" in its own
--                                                        comment
--
-- 289 gave the registry the one thing it lacked (the ingest backlog), so
-- source_freshness now covers all three kinds from rows rather than branches.
-- The web surfaces moved in the same change.
--
-- WHAT DID NOT MOVE, deliberately: the operator's tunable SLA. source_freshness
-- carries built-in 24/48h thresholds, and swapping the monitors band for them
-- would have traded config-as-data back for hardcoded numbers. The registry
-- supplies the METRIC; classifyIntegrationHealth still applies the TRIGGER from
-- org policy. Metric in the database, trigger owned by the operator — the same
-- split every other monitor uses.
--
-- The connection tables go too. Their job was last_received_at + total_events;
-- 283's statement-level stamp records the run, and source_reconciliation counts
-- the rows. Nothing is lost, and the ingest functions stop maintaining a second
-- bookkeeping table nobody reads.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── The two ingest paths stop writing the bookkeeping tables ─────────────────

CREATE OR REPLACE FUNCTION public.ingest_occupancy_webhook(
  p_hotel_id uuid, p_source_system text, p_date date, p_occupancy_pct numeric,
  p_occupied_rooms integer DEFAULT NULL, p_total_rooms integer DEFAULT NULL,
  p_external_reference_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO occupancy_logs
    (hotel_id, date, occupancy_pct, occupied_rooms, total_rooms,
     source, source_system, external_reference_id)
  VALUES (p_hotel_id, p_date, p_occupancy_pct, p_occupied_rooms, p_total_rooms,
          p_source_system, p_source_system, p_external_reference_id)
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET occupancy_pct         = EXCLUDED.occupancy_pct,
        occupied_rooms        = coalesce(EXCLUDED.occupied_rooms, occupancy_logs.occupied_rooms),
        total_rooms           = coalesce(EXCLUDED.total_rooms,   occupancy_logs.total_rooms),
        source                = EXCLUDED.source,
        source_system         = EXCLUDED.source_system,
        external_reference_id = coalesce(EXCLUDED.external_reference_id, occupancy_logs.external_reference_id)
  RETURNING id INTO v_id;
  -- The run is recorded by trg_stamp_source_run on occupancy_logs (283).
  RETURN v_id;
END $$;

-- ingest_pos_sale keeps everything except the pos_connections bump.
DO $mig$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ingest_pos_sale';

  -- Rewritten from the live definition rather than retyped: it is 60 lines and
  -- a transcription slip would be a worse bug than the one being removed.
  def := regexp_replace(def,
    E'\\s*-- Bump POS connection health.*?total_events \\+ 1;',
    '', 'ns');
  IF def LIKE '%pos_connections%' THEN
    RAISE EXCEPTION 'Migration 290: pos_connections bump not removed from ingest_pos_sale';
  END IF;
  EXECUTE def;
END $mig$;

-- ── Documents get the run stamp too ──────────────────────────────────────────
-- 283 attached it to the two staging tables that existed then; documents became
-- a registered source in 289 and would otherwise read 'never run' forever.

DROP TRIGGER IF EXISTS trg_stamp_source_run ON public.documents;
CREATE TRIGGER trg_stamp_source_run AFTER INSERT ON public.documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.stamp_source_run();

-- ── Retire the three functions and their two tables ──────────────────────────

DROP FUNCTION IF EXISTS public.get_pms_health();
DROP FUNCTION IF EXISTS public.get_pos_health();
DROP FUNCTION IF EXISTS public.get_integration_health();
DROP TABLE IF EXISTS public.pms_connections;
DROP TABLE IF EXISTS public.pos_connections;

-- ── Assert one mechanism, still working ──────────────────────────────────────

DO $$
DECLARE n_left int; n_sources int;
BEGIN
  SELECT count(*) INTO n_left FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('get_pms_health','get_pos_health','get_integration_health');
  IF n_left > 0 THEN
    RAISE EXCEPTION 'Migration 290: % per-connector health function(s) survive', n_left;
  END IF;

  SELECT count(*) INTO n_sources FROM source_freshness();
  IF n_sources < 3 THEN
    RAISE EXCEPTION 'Migration 290: registry reports % sources, expected PMS + POS + documents', n_sources;
  END IF;
  RAISE NOTICE 'Migration 290: one health mechanism over % registered sources', n_sources;
END $$;

-- And that POS ingestion still works after the rewrite, rolled back.
DO $$
DECLARE v_hotel uuid; v_menu uuid; v_sale uuid;
BEGIN
  SELECT mi.hotel_id, mi.id INTO v_hotel, v_menu FROM menu_items mi
   WHERE EXISTS (SELECT 1 FROM menu_item_ingredients g WHERE g.menu_item_id = mi.id) LIMIT 1;
  IF v_hotel IS NULL THEN RETURN; END IF;
  BEGIN
    v_sale := ingest_pos_sale(v_hotel, v_menu, 1, now(), 'probe', 'probe-290');
    IF v_sale IS NULL THEN RAISE EXCEPTION 'Migration 290: ingest_pos_sale returned null'; END IF;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN
      RAISE EXCEPTION 'Migration 290: ingest_pos_sale broken by the rewrite: %', SQLERRM;
    END IF;
  END;
END $$;

COMMIT;
