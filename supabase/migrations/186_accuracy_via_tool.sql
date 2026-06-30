-- Migration 186 — surface grades the actual per-variant adapter via the Logic Tool.
--
-- The SQL forecast_accuracy_summary (migration 185) could only grade ONE estimator
-- (EWMA) — it can't reproduce auto-select's per-variant choice in SQL. So the
-- dashboard understated production (auto-select-v1 picks the best adapter per
-- variant). P1.2 moves grading to the actual model: the web calls the
-- score_forecast_accuracy Logic Tool (defaulted to auto-select) per variant — the
-- exact production model, the sanctioned dual-callable path, no SQL duplication.
--
-- This RPC just supplies the variant LIST to grade (top-N by recent consumption);
-- the tool does the scoring client-side. forecast_accuracy_summary is dropped, and
-- the SQL EWMA forward-recorder cron is unscheduled (it wrote rows nothing reads;
-- the forecast_observations table stays as the forward-recording foundation for
-- when adapters go non-deterministic and reconstruction stops being faithful).

CREATE OR REPLACE FUNCTION public.forecast_gradeable_variants(p_hotel_id uuid, p_limit int DEFAULT 24)
RETURNS TABLE(variant_id uuid, variant_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.variant_id, pv.name
  FROM stock_logs s
  JOIN product_variants pv ON pv.id = s.variant_id
  WHERE s.hotel_id = p_hotel_id AND s.quantity_change < 0
    AND s.timestamp > now() - interval '75 days'
  GROUP BY s.variant_id, pv.name
  HAVING count(*) >= 10
  ORDER BY count(*) DESC
  LIMIT p_limit;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.forecast_gradeable_variants(uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.forecast_gradeable_variants(uuid, int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.forecast_accuracy_summary(uuid, int, int);

-- Stop the SQL EWMA forward-recorder: the surface no longer reads the table, and it
-- recorded the EWMA estimator (not the auto-select production model). The table +
-- functions stay defined (dormant) for the future non-deterministic recording path.
DO $$ BEGIN PERFORM cron.unschedule('beacon-forecast-observe'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
