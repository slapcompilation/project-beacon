-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 278 — data freshness is not dataset freshness. Tier 5.6.
--
-- Foundry: "Freshness checks validate that data is being kept up-to-date."
-- Audit §7.1 drew the distinction we were missing: get_integration_health tells
-- us a connection is ALIVE, never that the data is CURRENT. Those come apart in
-- the one way that matters — a pipeline running happily on schedule and
-- producing nothing new.
--
--   dataset freshness  when did we last RUN            (last_run_at)
--   data freshness     when did the data last CHANGE   (max watermark in staging)
--
-- A source that ran five minutes ago over data last touched eleven days ago is
-- green on every check we had and broken in the only way anybody cares about.
-- This is D1 restated at the pipeline level: success reported, nothing produced.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.source_freshness()
RETURNS TABLE (api_name text, label text, last_run_at timestamptz,
               data_changed_at timestamptz, run_age_hours numeric,
               data_age_hours numeric, verdict text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record; v_changed timestamptz;
BEGIN
  FOR s IN SELECT * FROM data_sources d WHERE d.enabled ORDER BY d.api_name LOOP
    v_changed := NULL;
    IF s.watermark_column IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT max(%I)::timestamptz FROM public.%I', s.watermark_column, s.staging_table)
          INTO v_changed;
      EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch THEN v_changed := NULL;
      END;
    END IF;

    RETURN QUERY SELECT
      s.api_name, s.label, s.last_run_at, v_changed,
      round(extract(epoch FROM (now() - s.last_run_at))/3600::numeric, 1),
      round(extract(epoch FROM (now() - v_changed))/3600::numeric, 1),
      CASE
        WHEN s.last_run_at IS NULL             THEN 'never run'
        WHEN s.watermark_column IS NULL        THEN 'no watermark — data freshness unknowable'
        WHEN v_changed IS NULL                 THEN 'watermark unreadable'
        -- The case the old health check could not see: running fine, data stale.
        WHEN v_changed < now() - interval '48 hours'
         AND s.last_run_at > now() - interval '6 hours'
                                               THEN 'RUNNING BUT STALE — polls succeed, nothing new arrives'
        WHEN v_changed < now() - interval '48 hours' THEN 'data stale'
        ELSE 'fresh'
      END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.source_freshness() IS
  'Dataset freshness (when we last ran) against data freshness (when the data last changed). A source polling happily over data nobody has touched for a week is green on a liveness check and broken in the only way that matters.';
