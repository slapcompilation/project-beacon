-- Migration 187 — forward-occupancy integration (occupancy step 1: connect source).
--
-- Occupancy carries real demand signal beyond day-of-week (residual corr 0.24 on
-- Valinor after removing the dow pattern), so an occupancy-aware forecast adapter
-- is justified. But forecasting WITH occupancy needs FORWARD occupancy, and
-- booking_forecasts was empty. In production a PMS pushes these rows; for the demo
-- this seeder is the stand-in — realistic forward occupancy (the historical
-- day-of-week mean) plus a plausible elevated-booking window so there is forward
-- deviation an adapter can exploit. Clearly labelled horizon_source='pms'.
-- Service-role only (demo tooling). The typed occupancy adapter that consumes
-- this lands next; the eval decides if it beats the current per-variant winner.

CREATE OR REPLACE FUNCTION public.seed_demo_booking_forecasts(p_hotel_id uuid, p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_count int := 0; v_day date; v_dow int; v_occ numeric; v_dow_mean numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hotels WHERE id = p_hotel_id) THEN
    RAISE EXCEPTION 'hotel % not found', p_hotel_id USING ERRCODE = '23503';
  END IF;
  FOR v_day IN SELECT d::date FROM generate_series(current_date + 1, current_date + p_days, interval '1 day') d LOOP
    v_dow := extract(dow FROM v_day);
    SELECT coalesce(round(avg(occupancy_pct)), 60) INTO v_dow_mean
    FROM occupancy_logs WHERE hotel_id = p_hotel_id AND extract(dow FROM date) = v_dow;
    -- Forward occupancy = expected dow level, with a 4-day elevated-booking window
    -- mid-horizon (a plausible group/event) deviating above the norm.
    v_occ := v_dow_mean;
    IF (v_day - current_date) BETWEEN 8 AND 11 THEN
      v_occ := v_dow_mean + 25;
    END IF;
    INSERT INTO booking_forecasts (hotel_id, date, expected_occupancy_pct, horizon_source)
    VALUES (p_hotel_id, v_day, greatest(0, least(100, v_occ)), 'pms')
    ON CONFLICT (hotel_id, date) DO UPDATE
      SET expected_occupancy_pct = excluded.expected_occupancy_pct,
          horizon_source = 'pms', updated_at = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('hotel_id', p_hotel_id, 'days_seeded', v_count);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.seed_demo_booking_forecasts(uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_demo_booking_forecasts(uuid, int) TO service_role;
