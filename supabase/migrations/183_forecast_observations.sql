-- Migration 183 — forecast_observations: persist forecasts forward, score later.
--
-- Layer: data + mutation · Scope: hotel (scope-gated). Closes P0.2. The accuracy
-- surface (migration 182) reconstructs forecasts on the fly — faithful only while
-- adapters are pure functions of stock logs. Once an adapter takes external inputs
-- (P1.2 occupancy) we must grade it on what it ACTUALLY produced. This table is
-- that record: a forecast is written at scan time (realized NULL); a daily job
-- fills realized + error once the horizon window closes.
--
-- The write is audited, not a raw insert: the table has NO insert/update RLS
-- policy, so authenticated callers can't write it directly — only the SECURITY
-- DEFINER RPCs below (immutable forecast fields; only the score fields are filled,
-- once). Every RPC follows migration 181: a NULL-auth caller (cron/service) passes;
-- an authenticated caller is scope-gated.

CREATE TABLE IF NOT EXISTS public.forecast_observations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  hotel_id        uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  variant_id      uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  as_of           timestamptz NOT NULL,
  horizon_days    int  NOT NULL,
  projected_units numeric NOT NULL,
  basis           text NOT NULL,
  confidence      numeric NOT NULL,
  sample_size     int  NOT NULL DEFAULT 0,
  source          text NOT NULL DEFAULT 'live',   -- 'live' (forward) | 'backfill'
  realized_units  numeric,                          -- filled when the window closes
  signed_error    numeric,                          -- projected − realized (NULL if realized=0)
  abs_pct_error   numeric,
  censored        boolean,
  scored_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, variant_id, as_of, horizon_days, basis)
);
CREATE INDEX IF NOT EXISTS forecast_observations_hotel_variant_idx
  ON public.forecast_observations (hotel_id, variant_id, as_of);
CREATE INDEX IF NOT EXISTS forecast_observations_due_idx
  ON public.forecast_observations (hotel_id) WHERE realized_units IS NULL;

ALTER TABLE public.forecast_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fo_select ON public.forecast_observations;
CREATE POLICY fo_select ON public.forecast_observations
  FOR SELECT TO authenticated USING (hotel_is_in_user_scope(hotel_id));
-- No insert/update/delete policy: writes go only through the definer RPCs below.
GRANT SELECT ON public.forecast_observations TO authenticated;
GRANT ALL    ON public.forecast_observations TO service_role;

-- ── record_current_forecasts: forward scan-time persist (as_of = today) ───────
CREATE OR REPLACE FUNCTION public.record_current_forecasts(p_hotel_id uuid, p_horizon int DEFAULT 7)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_count int;
BEGIN
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  WITH base AS (
    SELECT pv.id AS variant_id,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=pv.id AND s.quantity_change<0 AND s.timestamp > now()-interval '30 days') AS consumed,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=pv.id AND s.quantity_change<0 AND s.timestamp > now()-interval '30 days') AS active_days,
      (SELECT min(date(timestamp)) FROM stock_logs s WHERE s.variant_id=pv.id AND s.timestamp > now()-interval '30 days') AS earliest,
      (SELECT count(*) FROM stock_logs s WHERE s.variant_id=pv.id AND s.timestamp > now()-interval '30 days') AS samples
    FROM product_variants pv JOIN products p ON p.id=pv.product_id
    WHERE p.hotel_id = p_hotel_id AND pv.enabled = true
  ),
  proj AS (
    SELECT variant_id,
      round(consumed::numeric / least(30, greatest(1,(current_date - earliest)+1)) * p_horizon) AS projected,
      least(0.95, round((0.35 + active_days/30.0*0.5)::numeric, 2)) AS confidence,
      samples
    FROM base WHERE consumed > 0 AND earliest IS NOT NULL
  )
  INSERT INTO forecast_observations
    (organization_id, hotel_id, variant_id, as_of, horizon_days, projected_units, basis, confidence, sample_size, source)
  SELECT (SELECT organization_id FROM hotels WHERE id=p_hotel_id), p_hotel_id, variant_id,
         date_trunc('day', now()), p_horizon, projected, 'baseline-rolling-30d-avg', confidence, samples, 'live'
  FROM proj
  ON CONFLICT (hotel_id, variant_id, as_of, horizon_days, basis) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ── score_due_forecast_observations: fill realized + error for closed windows ──
CREATE OR REPLACE FUNCTION public.score_due_forecast_observations(p_hotel_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_count int;
BEGIN
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  WITH due AS (
    SELECT fo.id, fo.variant_id, fo.as_of, fo.horizon_days, fo.projected_units
    FROM forecast_observations fo
    WHERE fo.hotel_id = p_hotel_id AND fo.realized_units IS NULL
      AND now() >= fo.as_of + (fo.horizon_days || ' days')::interval
  ),
  scored AS (
    SELECT d.id, d.projected_units,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=d.variant_id AND s.quantity_change<0
         AND s.timestamp > d.as_of AND s.timestamp <= d.as_of + (d.horizon_days||' days')::interval) AS realized,
      (SELECT bool_or(balance_after<=0) FROM stock_logs s WHERE s.variant_id=d.variant_id
         AND s.timestamp > d.as_of - interval '30 days' AND s.timestamp <= d.as_of + (d.horizon_days||' days')::interval) AS censored
    FROM due d
  )
  UPDATE forecast_observations fo
  SET realized_units = sc.realized,
      signed_error   = CASE WHEN sc.realized > 0 THEN fo.projected_units - sc.realized END,
      abs_pct_error  = CASE WHEN sc.realized > 0 THEN abs(fo.projected_units - sc.realized) / sc.realized END,
      censored       = sc.censored,
      scored_at      = now()
  FROM scored sc
  WHERE fo.id = sc.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ── backfill_forecast_observations: historical record + immediate score ───────
-- Seeds the table from past cutoffs so it has scored data now and the record→score
-- pipeline is demonstrably correct. source='backfill'.
CREATE OR REPLACE FUNCTION public.backfill_forecast_observations(
  p_hotel_id uuid, p_horizon int DEFAULT 7, p_windows int DEFAULT 8)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_count int;
BEGIN
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  WITH cutoffs AS (
    SELECT now() - (g * p_horizon || ' days')::interval AS cutoff FROM generate_series(1, p_windows) g
  ),
  cand AS (
    SELECT pv.id AS variant_id FROM product_variants pv JOIN products p ON p.id=pv.product_id
    WHERE p.hotel_id = p_hotel_id AND pv.enabled = true
  ),
  obs AS (
    SELECT c.variant_id, k.cutoff,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS consumed,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS active_days,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS train_days,
      (SELECT min(date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS earliest,
      (SELECT count(*) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS samples,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS realized,
      (SELECT bool_or(balance_after<=0) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS censored
    FROM cand c CROSS JOIN cutoffs k
  ),
  rows AS (
    SELECT variant_id, cutoff,
      round(consumed::numeric / least(30, greatest(1,(date(cutoff) - earliest)+1)) * p_horizon) AS projected,
      least(0.95, round((0.35 + active_days/30.0*0.5)::numeric, 2)) AS confidence,
      samples, realized, censored
    FROM obs WHERE train_days >= 7 AND realized > 0
  )
  INSERT INTO forecast_observations
    (organization_id, hotel_id, variant_id, as_of, horizon_days, projected_units, basis, confidence, sample_size,
     source, realized_units, signed_error, abs_pct_error, censored, scored_at)
  SELECT (SELECT organization_id FROM hotels WHERE id=p_hotel_id), p_hotel_id, variant_id,
         cutoff, p_horizon, projected, 'baseline-rolling-30d-avg', confidence, samples,
         'backfill', realized, projected - realized, abs(projected - realized) / realized, censored, now()
  FROM rows
  ON CONFLICT (hotel_id, variant_id, as_of, horizon_days, basis) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.record_current_forecasts(uuid, int)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.score_due_forecast_observations(uuid)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_forecast_observations(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_current_forecasts(uuid, int)        TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.score_due_forecast_observations(uuid)       TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.backfill_forecast_observations(uuid, int, int) TO authenticated, service_role;

-- Daily unattended record + score across every hotel (runs before the 07:00
-- intelligence cycle). pg_cron runs as postgres → NULL auth → the RPCs' cron path.
SELECT cron.schedule('beacon-forecast-observe', '30 6 * * *', $cron$
  DO $job$
  DECLARE h record;
  BEGIN
    FOR h IN SELECT id FROM hotels LOOP
      PERFORM record_current_forecasts(h.id, 7);
      PERFORM score_due_forecast_observations(h.id);
    END LOOP;
  END $job$;
$cron$);
