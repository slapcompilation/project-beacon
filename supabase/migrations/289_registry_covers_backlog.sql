-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 289 — the registry learns what a backlog is. Phase B, part 1.
--
-- Three health mechanisms exist and no two cover the same things:
--
--   get_pms_health          pms_connections                 PMS only
--   get_pos_health          pos_connections                 POS only
--   get_integration_health  pos_connections + documents     POS + documents,
--                                                           "occupancy/PMS
--                                                           deferred" per its
--                                                           own comment
--   source_freshness        data_sources                    whatever is registered
--
-- Only the last can cover all three, because a source is a row rather than a
-- branch in a function. What it could not express was the document pipeline's
-- BACKLOG — how many rows landed and never got processed, and how long the
-- oldest has waited. That is the signal a liveness check cannot see: ingestion
-- accepting uploads it never finishes is green on every other measure.
--
-- Expressed as a COLUMN plus a VALUE, not a predicate. A backlog_predicate
-- taking arbitrary SQL would be an injection surface undoing the RLS these
-- functions preserve — the same reason 277 used a sign enum instead of a SQL
-- fragment. The column name goes through %I; the value is bound.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS backlog_column        text,
  ADD COLUMN IF NOT EXISTS backlog_pending_value text;

COMMENT ON COLUMN public.data_sources.backlog_column IS
  'Column marking whether a landed row has been processed. With backlog_pending_value, expresses "not done yet" as config rather than as SQL a caller could inject into.';

-- ── Documents become the third registered source ─────────────────────────────
-- Registered as `file`: an operator uploads it, nothing polls. Its watermark is
-- when the document arrived; its backlog is everything still sitting at 'raw'.

INSERT INTO public.data_sources
  (organization_id, hotel_id, api_name, label, kind, system,
   staging_table, natural_key, watermark_column, object_type_id,
   backlog_column, backlog_pending_value)
SELECT o.id, NULL, 'documents', 'Document ingestion', 'file', 'upload',
       'documents', 'id', 'created_at', t.id,
       'ingestion_stage', 'raw'
FROM organizations o
LEFT JOIN object_types t ON t.api_name = 'document' AND t.kind = 'builtin'
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- ── Freshness gains the backlog it was missing ───────────────────────────────

-- DROP first: CREATE OR REPLACE cannot widen a RETURNS TABLE, and this adds two
-- columns. Safe inside the transaction — nothing in the database depends on it,
-- only callers, and they arrive with the deploy.
DROP FUNCTION IF EXISTS public.source_freshness();

CREATE FUNCTION public.source_freshness()
RETURNS TABLE (api_name text, label text, last_run_at timestamptz,
               data_changed_at timestamptz, run_age_hours numeric,
               data_age_hours numeric, pending_count bigint,
               oldest_pending_at timestamptz, verdict text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record; v_changed timestamptz; v_pending bigint; v_oldest timestamptz;
BEGIN
  FOR s IN SELECT * FROM data_sources d WHERE d.enabled ORDER BY d.api_name LOOP
    v_changed := NULL; v_pending := NULL; v_oldest := NULL;

    IF s.watermark_column IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT max(%I)::timestamptz FROM public.%I', s.watermark_column, s.staging_table)
          INTO v_changed;
      EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch THEN v_changed := NULL;
      END;
    END IF;

    -- Backlog: rows that landed and were never processed. %I for the column,
    -- $1 for the value — the value never reaches the parser.
    IF s.backlog_column IS NOT NULL AND s.backlog_pending_value IS NOT NULL THEN
      BEGIN
        EXECUTE format(
          'SELECT count(*), min(%I)::timestamptz FROM public.%I WHERE %I::text = $1',
          coalesce(s.watermark_column, s.backlog_column), s.staging_table, s.backlog_column)
          INTO v_pending, v_oldest USING s.backlog_pending_value;
      EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch THEN
        v_pending := NULL; v_oldest := NULL;
      END;
    END IF;

    RETURN QUERY SELECT
      s.api_name, s.label, s.last_run_at, v_changed,
      round(extract(epoch FROM (now() - s.last_run_at))/3600::numeric, 1),
      round(extract(epoch FROM (now() - v_changed))/3600::numeric, 1),
      v_pending, v_oldest,
      CASE
        -- A stalled pipeline outranks staleness: rows ARE arriving and nothing
        -- is finishing them, which is the worse failure and the one a liveness
        -- check reports as healthy.
        WHEN v_pending IS NOT NULL AND v_pending > 0
         AND v_oldest < now() - interval '24 hours'
                                               THEN format('INGEST STALLED — %s row(s) waiting, oldest %s h', v_pending, round(extract(epoch FROM (now() - v_oldest))/3600::numeric, 0))
        WHEN s.last_run_at IS NULL             THEN 'never run'
        WHEN s.watermark_column IS NULL        THEN 'no watermark — data freshness unknowable'
        WHEN v_changed IS NULL                 THEN 'watermark unreadable'
        WHEN v_changed < now() - interval '48 hours'
         AND s.last_run_at > now() - interval '6 hours'
                                               THEN 'RUNNING BUT STALE — polls succeed, nothing new arrives'
        WHEN v_changed < now() - interval '48 hours' THEN 'data stale'
        ELSE 'fresh'
      END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.source_freshness() IS
  'Dataset freshness (when we last ran) against data freshness (when the data last changed), plus the ingest backlog. One function over registered sources — the three per-connector health functions it replaces each covered a different subset and none covered all.';

-- ── Assert the registry now covers all three kinds ───────────────────────────

DO $$
DECLARE n int; missing text;
BEGIN
  SELECT count(*) INTO n FROM data_sources WHERE enabled;
  IF n < 3 THEN
    RAISE EXCEPTION 'Migration 289: expected PMS, POS and documents registered, found %', n;
  END IF;

  SELECT string_agg(format('%s -> %s.%s', d.api_name, d.staging_table, d.backlog_column), '; ')
    INTO missing
  FROM data_sources d
  WHERE d.backlog_column IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name = d.staging_table
                      AND c.column_name = d.backlog_column);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 289: backlog column does not exist: %', missing;
  END IF;
END $$;

COMMIT;
