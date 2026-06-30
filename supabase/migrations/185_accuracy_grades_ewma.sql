-- Migration 185 — grade the surface + recorder against EWMA, the new default.
--
-- PR #247 made ewma-v1 the default forecast adapter, but the accuracy surface
-- (forecast_accuracy_summary, migration 182) and the forward recorder
-- (record_current_forecasts, migration 183) still reconstructed the OLD flat
-- rolling-30d baseline — so the dashboard graded a model production no longer
-- runs. This switches both to the EWMA estimator: a day-of-consumption series
-- exponentially weighted by age (alpha = 0.3 → decay 0.7), the steady-state form
-- of the TS ewma-v1 adapter. Validated against the real adapter on live Valinor
-- data (both ≈ 13.9% MAPE / −9.7% bias). Return shapes are unchanged — the web
-- needs no change.
--
-- Note: this SQL estimator tracks ewma-v1 closely on dense daily data (it omits
-- the adapter's zero-day fill, which only diverges on sparse/intermittent
-- variants). The exact "grade the adapter's actual recorded output" path is the
-- forecast_observations table, switched on in P1.2 when adapters go
-- non-deterministic and reconstruction would no longer be faithful.

CREATE OR REPLACE FUNCTION public.forecast_accuracy_summary(
  p_hotel_id uuid, p_horizon int DEFAULT 7, p_windows int DEFAULT 4)
RETURNS TABLE(variant_id uuid, variant_name text, n int, mape numeric, bias_pct numeric, n_censored int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH cutoffs AS (
    SELECT now() - (g * p_horizon || ' days')::interval AS cutoff FROM generate_series(1, p_windows) g
  ),
  cand AS (
    SELECT s.variant_id FROM stock_logs s
    WHERE s.hotel_id = p_hotel_id AND s.quantity_change < 0
      AND s.timestamp > now() - ((p_horizon * (p_windows + 1) + 35) || ' days')::interval
    GROUP BY s.variant_id HAVING count(*) >= 10
  ),
  obs AS (
    SELECT c.variant_id, k.cutoff,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS train_days,
      -- EWMA rate: per-day consumption exp-weighted by age (alpha 0.3 → 0.7^age).
      (SELECT sum(daycons * power(0.7, dayage)) / nullif(sum(power(0.7, dayage)), 0)
         FROM (SELECT sum(-s.quantity_change) AS daycons,
                      floor(extract(epoch FROM (k.cutoff - s.timestamp))/86400) AS dayage
               FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
                 AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff
               GROUP BY floor(extract(epoch FROM (k.cutoff - s.timestamp))/86400)) d) AS ewma_rate,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS realized,
      (SELECT bool_or(balance_after <= 0) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS censored
    FROM cand c CROSS JOIN cutoffs k
  ),
  scored AS (
    SELECT o.variant_id, o.censored,
      round(coalesce(o.ewma_rate, 0) * p_horizon) AS projected, o.realized
    FROM obs o WHERE o.train_days >= 7 AND o.realized > 0
  )
  SELECT sc.variant_id, pv.name, count(*)::int,
    round(avg(abs(sc.projected - sc.realized) / greatest(sc.realized, 1)), 3),
    round(avg((sc.projected - sc.realized) / greatest(sc.realized, 1)), 3),
    sum((sc.censored)::int)::int
  FROM scored sc JOIN product_variants pv ON pv.id = sc.variant_id
  GROUP BY sc.variant_id, pv.name
  ORDER BY 4 DESC;
END $fn$;

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
      (SELECT sum(daycons * power(0.7, dayage)) / nullif(sum(power(0.7, dayage)), 0)
         FROM (SELECT sum(-s.quantity_change) AS daycons,
                      floor(extract(epoch FROM (now() - s.timestamp))/86400) AS dayage
               FROM stock_logs s WHERE s.variant_id=pv.id AND s.quantity_change<0
                 AND s.timestamp > now() - interval '30 days'
               GROUP BY floor(extract(epoch FROM (now() - s.timestamp))/86400)) d) AS ewma_rate,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=pv.id AND s.quantity_change<0 AND s.timestamp > now()-interval '30 days') AS active_days,
      (SELECT count(*) FROM stock_logs s WHERE s.variant_id=pv.id AND s.timestamp > now()-interval '30 days') AS samples
    FROM product_variants pv JOIN products p ON p.id=pv.product_id
    WHERE p.hotel_id = p_hotel_id AND pv.enabled = true
  ),
  proj AS (
    SELECT variant_id, round(coalesce(ewma_rate, 0) * p_horizon) AS projected,
      least(0.95, round((0.35 + active_days/30.0*0.5)::numeric, 2)) AS confidence, samples
    FROM base WHERE ewma_rate IS NOT NULL AND ewma_rate > 0
  )
  INSERT INTO forecast_observations
    (organization_id, hotel_id, variant_id, as_of, horizon_days, projected_units, basis, confidence, sample_size, source)
  SELECT (SELECT organization_id FROM hotels WHERE id=p_hotel_id), p_hotel_id, variant_id,
         date_trunc('day', now()), p_horizon, projected, 'ewma-v1', confidence, samples, 'live'
  FROM proj
  ON CONFLICT (hotel_id, variant_id, as_of, horizon_days, basis) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;
