-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 283 — the source registry stops describing nothing.
--
-- 273 built data_sources and seeded zero rows, so source_freshness() looped
-- over an empty set and returned nothing — which reads exactly like health.
-- 5.5 and 5.6 were structurally complete and observing an empty universe, the
-- same shape 5.2 was in until a real document went through it.
--
-- Two feeds actually carry data today, so those are what gets registered.
-- Nothing aspirational: no SAP row here until somebody streams SAP.
--
--   occupancy_logs   360 rows   source 'pms'         via ingest-occupancy / mews-webhook
--   pos_sales       1092 rows   source 'demo_seed'   via ingest-pos / square-webhook
--
-- WATERMARK IS THE DATA'S OWN CLOCK, not ours. 278 exists to separate "when did
-- we last run" from "when did the data last change", so watermark_column is
-- `date` and `sale_time` — the business event — while last_run_at is when rows
-- last arrived. Pointing the watermark at created_at would collapse the two and
-- make the distinction unobservable, which is the whole point of 5.6.
--
-- STAMPING last_run_at. Nothing wrote it, so every source would report 'never
-- run' forever and the RUNNING-BUT-STALE verdict — the one case the old
-- liveness check could not see — would be unreachable. A statement-level
-- trigger stamps it: one update per INSERT statement regardless of row count,
-- and it fires even when the statement lands ZERO rows, which is precisely the
-- "polled fine, nothing arrived" signal worth catching.
--
-- SECURITY DEFINER on the stamp: data_sources is admin-write, and a floor
-- manager entering occupancy by hand must not have their insert rejected
-- because a bookkeeping row was out of their scope.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── The run stamp ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.stamp_source_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE data_sources SET last_run_at = now(), updated_at = now()
   WHERE staging_table = TG_TABLE_NAME AND enabled;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.stamp_source_run() IS
  'Records that a source ran, statement-level so it costs one update per batch and still fires when the statement landed nothing — "polled fine, nothing arrived" is the case 278 was written for.';

DROP TRIGGER IF EXISTS trg_stamp_source_run ON public.occupancy_logs;
CREATE TRIGGER trg_stamp_source_run AFTER INSERT ON public.occupancy_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.stamp_source_run();

DROP TRIGGER IF EXISTS trg_stamp_source_run ON public.pos_sales;
CREATE TRIGGER trg_stamp_source_run AFTER INSERT ON public.pos_sales
  FOR EACH STATEMENT EXECUTE FUNCTION public.stamp_source_run();

-- ── Register what actually exists ────────────────────────────────────────────
-- organization_id is set explicitly: the column defaults to auth_org_id(), which
-- is NULL in a migration, and a source belonging to no organization is readable
-- by nobody.

INSERT INTO public.data_sources
  (organization_id, hotel_id, api_name, label, kind, system,
   staging_table, natural_key, watermark_column, object_type_id)
SELECT o.id, NULL, v.api_name, v.label, v.kind, v.system,
       v.staging_table, v.natural_key, v.watermark_column, t.id
FROM organizations o
CROSS JOIN (VALUES
  ('pms_occupancy', 'PMS occupancy feed', 'webhook', 'pms',
   'occupancy_logs', 'hotel_id,date', 'date', 'occupancy_log'),
  ('pos_sales',     'POS sales feed',     'webhook', 'pos',
   'pos_sales',      'external_reference_id', 'sale_time', 'pos_sale')
) AS v(api_name, label, kind, system, staging_table, natural_key, watermark_column, type_api)
LEFT JOIN object_types t ON t.api_name = v.type_api AND t.kind = 'builtin'
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- ── Reconciliation has to stay honest about direct-landing sources ───────────
-- The registry's model is staging -> ontologized target, and staged-vs-landed
-- is the loss measure. A webhook lands straight into the table that backs its
-- object type, so those counts are equal BY CONSTRUCTION. Reporting that as
-- 'reconciled' would be a green that means nothing, which is the exact failure
-- mode this whole audit keeps finding. Say what is actually true instead.

CREATE OR REPLACE FUNCTION public.source_reconciliation()
RETURNS TABLE (api_name text, label text, staging_rows bigint, landed_rows bigint,
               dead_letters bigint, ontologized boolean, verdict text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record; n_stage bigint; n_land bigint; n_dead bigint;
BEGIN
  FOR s IN SELECT d.*, t.source_table AS target_table FROM data_sources d
           LEFT JOIN object_types t ON t.id = d.object_type_id
           WHERE d.enabled ORDER BY d.api_name
  LOOP
    n_stage := NULL; n_land := NULL;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', s.staging_table) INTO n_stage;
    EXCEPTION WHEN undefined_table THEN n_stage := NULL;
    END;
    IF s.target_table IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', s.target_table) INTO n_land;
      EXCEPTION WHEN undefined_table THEN n_land := NULL;
      END;
    END IF;
    SELECT count(*) INTO n_dead FROM source_dead_letters dl
     WHERE dl.source_id = s.id AND dl.resolved_at IS NULL;

    RETURN QUERY SELECT s.api_name, s.label, n_stage, n_land, n_dead,
      (s.object_type_id IS NOT NULL),
      CASE
        WHEN n_stage IS NULL              THEN 'staging table missing'
        WHEN s.object_type_id IS NULL     THEN 'landing, not yet ontologized'
        WHEN n_dead > 0                   THEN format('%s row(s) dead-lettered', n_dead)
        -- Equal counts prove nothing when it is the same table twice.
        WHEN s.target_table = s.staging_table
                                          THEN 'lands directly — no staging hop to reconcile, freshness is the signal'
        WHEN n_land IS NOT NULL AND n_land < n_stage THEN format('%s staged row(s) never landed', n_stage - n_land)
        ELSE 'reconciled'
      END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.source_reconciliation() IS
  'Staged vs landed vs dead-lettered, per source. A source is healthy when its numbers agree — not when its last call returned 200. Direct-landing sources say so rather than claiming a reconciliation they got for free.';

-- ── Assert the registry describes something ──────────────────────────────────

DO $$
DECLARE n int; bad text;
BEGIN
  SELECT count(*) INTO n FROM data_sources WHERE enabled;
  IF n = 0 THEN
    RAISE EXCEPTION 'Migration 283: registry still empty';
  END IF;

  -- A registration pointing at a table or column that does not exist is a
  -- source that fails the first time anybody asks. Catch it here instead.
  SELECT string_agg(format('%s -> %s.%s', d.api_name, d.staging_table, d.watermark_column), '; ')
    INTO bad
  FROM data_sources d
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = d.staging_table
      AND c.column_name = d.watermark_column);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 283: source registered against a column that does not exist: %', bad;
  END IF;
END $$;

COMMIT;
