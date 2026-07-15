-- Migration 200 — Q2: record the forecast that DROVE each decision, link it, score it.
-- Layer: data + mutation · Scope: hotel (scope-gated).
--
-- Q1 routed reorder sizing through the auto-select adapter; Q2 records what that
-- forecast actually said at proposal time — not a SQL re-derivation like
-- record_current_forecasts (which rebuilds a flat baseline, the WRONG forecast) —
-- and links it to the proposal, so prediction → decision → outcome is one
-- queryable chain. score_due_forecast_observations (migration 183, model-agnostic)
-- grades it once the horizon window closes.

-- 1. Structured lineage: which proposal a recorded forecast drove.
ALTER TABLE public.forecast_observations
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS forecast_observations_proposal_idx
  ON public.forecast_observations (proposal_id) WHERE proposal_id IS NOT NULL;

-- 2. record_decision_forecast: persist the ACTUAL adapter forecast at decision
-- time, linked to the proposal. Immutable forecast fields (no update path). A
-- NULL-auth caller (cron/service) passes; an authenticated caller is scope-gated
-- (migration 181 pattern). Returns the new row id so the caller can write the
-- proposal --derived_from--> forecast_observation edge.
CREATE OR REPLACE FUNCTION public.record_decision_forecast(
  p_hotel_id uuid, p_variant_id uuid, p_proposal_id uuid,
  p_horizon int, p_projected numeric, p_basis text,
  p_confidence numeric, p_sample_size int DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_id uuid; v_org uuid;
BEGIN
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM hotels WHERE id = p_hotel_id;
  INSERT INTO forecast_observations
    (organization_id, hotel_id, variant_id, as_of, horizon_days, projected_units,
     basis, confidence, sample_size, source, proposal_id)
  VALUES
    (v_org, p_hotel_id, p_variant_id, now(), greatest(1, p_horizon), p_projected,
     p_basis, p_confidence, coalesce(p_sample_size, 0), 'decision', p_proposal_id)
  ON CONFLICT (hotel_id, variant_id, as_of, horizon_days, basis) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- REVOKE FROM PUBLIC (not just anon): the default PUBLIC grant would otherwise let
-- anon execute, and anon has NULL auth_hotel_id() → it would pass the scope gate.
REVOKE EXECUTE ON FUNCTION public.record_decision_forecast(uuid,uuid,uuid,integer,numeric,text,numeric,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_decision_forecast(uuid,uuid,uuid,integer,numeric,text,numeric,integer) TO authenticated, service_role;

-- 3. Reschedule SCORING only — never the old SQL recorder record_current_forecasts
-- (it re-derives a flat baseline, the wrong forecast). The scorer is model-agnostic:
-- it fills realized + error for any recorded forecast once its horizon closes.
DO $$ BEGIN PERFORM cron.unschedule('beacon-forecast-score'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('beacon-forecast-score', '30 6 * * *', $cron$
  DO $inner$
  DECLARE h record;
  BEGIN
    FOR h IN SELECT id FROM hotels LOOP
      PERFORM score_due_forecast_observations(h.id);
    END LOOP;
  END $inner$;
$cron$);
