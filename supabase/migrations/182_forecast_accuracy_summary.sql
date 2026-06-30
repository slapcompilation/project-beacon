-- Migration 182 — forecast_accuracy_summary: the P0.2 measuring stick, surfaced.
--
-- Layer: compute (read-only scoring) · Scope: hotel (scope-gated). Reconstructs
-- the baseline forecast the adapter would have made at p_windows rolling cutoffs
-- and scores each against realized consumption — MAPE + signed bias % (negative =
-- under-forecast) + censored-window count, per variant. The TS instrument
-- (objectives/consumption_forecast/accuracy.ts, PR #243) is the source of truth
-- for the math; this SQL reconstruction was verified to match it exactly
-- (variant f8807aa5: MAPE 3.167 / bias +3.083 by hand == both impls). It powers
-- the objective page's Accuracy section so the over-forecast is visible to
-- operators now; forward-recorded observations supersede it as they accumulate.
--
-- Scope-gated per migration 181 (definer fn taking p_hotel_id must check scope).

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
    SELECT now() - (g * p_horizon || ' days')::interval AS cutoff
    FROM generate_series(1, p_windows) g
  ),
  cand AS (
    SELECT s.variant_id
    FROM stock_logs s
    WHERE s.hotel_id = p_hotel_id AND s.quantity_change < 0
      AND s.timestamp > now() - ((p_horizon * (p_windows + 1) + 35) || ' days')::interval
    GROUP BY s.variant_id HAVING count(*) >= 10
  ),
  obs AS (
    SELECT c.variant_id, k.cutoff,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS train_consumed,
      (SELECT count(distinct date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS train_days,
      (SELECT min(date(timestamp)) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff) AS earliest_day,
      (SELECT coalesce(sum(-quantity_change),0) FROM stock_logs s WHERE s.variant_id=c.variant_id AND s.quantity_change<0
          AND s.timestamp > k.cutoff AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS realized,
      (SELECT bool_or(balance_after <= 0) FROM stock_logs s WHERE s.variant_id=c.variant_id
          AND s.timestamp > k.cutoff - interval '30 days' AND s.timestamp <= k.cutoff + (p_horizon||' days')::interval) AS censored
    FROM cand c CROSS JOIN cutoffs k
  ),
  scored AS (
    SELECT o.variant_id, o.censored,
      round(o.train_consumed::numeric / least(30, greatest(1, (date(o.cutoff) - o.earliest_day) + 1)) * p_horizon) AS projected,
      o.realized
    FROM obs o WHERE o.train_days >= 7 AND o.realized > 0
  )
  SELECT sc.variant_id, pv.name,
    count(*)::int,
    round(avg(abs(sc.projected - sc.realized) / greatest(sc.realized, 1)), 3),
    round(avg((sc.projected - sc.realized) / greatest(sc.realized, 1)), 3),
    sum((sc.censored)::int)::int
  FROM scored sc JOIN product_variants pv ON pv.id = sc.variant_id
  GROUP BY sc.variant_id, pv.name
  ORDER BY 4 DESC;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.forecast_accuracy_summary(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.forecast_accuracy_summary(uuid, int, int) TO authenticated, service_role;
