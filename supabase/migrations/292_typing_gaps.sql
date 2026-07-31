-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 292 — the two typing gaps. Phase D of the shape audit.
--
-- D1. variant_cost_history is a time series living in a table. 20 rows of
--     (variant_id, effective_from, cost) — the exact shape 5.7 registers — while
--     the primitive shipped with four series and cost was not one of them.
--     One row of config, not a migration's worth of code.
--
-- D2. booking_forecasts was the untyped half of a typed concept. occupancy_log
--     is an object type AND carries hotel.occupancy; forward-looking occupancy
--     (60 rows, 2 hotels, a month ahead) was neither — invisible to
--     searchAround, to object views, to every typed read the copilot has.
--
--     NOT folded into forecast_observations, though the roadmap offered that as
--     an option. Checked the data first: forecast_observations is per-VARIANT
--     demand with a scoring pipeline (realized_units, abs_pct_error, censored);
--     booking_forecasts is per-HOTEL occupancy. Different subject, different
--     grain, different consumer. Merging them would have put two unrelated
--     forecasts in one table for the sake of tidiness — the "different shape,
--     quietly" the stage directive warns about.
--
--     So it becomes its own object type, and the forward curve becomes a second
--     series on hotel beside the actuals. Reading hotel.occupancy against
--     hotel.expected_occupancy is then one question rather than two tables.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── D2: the dish of this migration — forward occupancy becomes a type ────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, 'booking_forecast', 'Booking Forecast', 'timeline-line-chart',
       'Expected occupancy for a future date. Actuals land in occupancy_log; this is the forward curve.',
       '[]'::jsonb, 'builtin', 'booking_forecasts',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── D1 + D2: two series the data already supported ──────────────────────────

INSERT INTO public.time_series_properties
  (object_type_id, property_key, label, unit, source_table, entity_column, time_column, value_column, negate)
SELECT t.id, v.key, v.label, v.unit, v.tbl, v.entity_col, v.time_col, v.value_col, false
FROM object_types t
JOIN (VALUES
  ('variant', 'unit_cost',           'Unit cost',          '€', 'variant_cost_history', 'variant_id', 'effective_from', 'cost'),
  ('hotel',   'expected_occupancy',  'Expected occupancy', '%', 'booking_forecasts',    'hotel_id',   'date',           'expected_occupancy_pct')
) AS v(type_api, key, label, unit, tbl, entity_col, time_col, value_col)
  ON t.api_name = v.type_api AND t.kind = 'builtin'
ON CONFLICT (object_type_id, property_key) DO NOTHING;

-- A registration whose backing column does not exist is a series that fails the
-- first time anybody asks for it. Catch it here, not there (276's rule).
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s.%s -> %s.%s', t.api_name, ts.property_key, ts.source_table, ts.value_column), '; ')
    INTO bad
  FROM time_series_properties ts JOIN object_types t ON t.id = ts.object_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = ts.source_table AND c.column_name = ts.value_column);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 292: series registered against a column that does not exist: %', bad;
  END IF;
END $$;

-- And that both new series actually return points, because a registration that
-- reads empty is the failure this whole audit keeps finding.
DO $$
DECLARE v_variant uuid; v_hotel uuid; n_cost int; n_fwd int;
BEGIN
  SELECT variant_id INTO v_variant FROM variant_cost_history LIMIT 1;
  SELECT hotel_id   INTO v_hotel   FROM booking_forecasts LIMIT 1;

  IF v_variant IS NOT NULL THEN
    SELECT count(*) INTO n_cost FROM time_series_points('variant', 'unit_cost', v_variant);
    IF n_cost = 0 THEN RAISE EXCEPTION 'Migration 292: variant.unit_cost returns no points'; END IF;
  END IF;

  IF v_hotel IS NOT NULL THEN
    SELECT count(*) INTO n_fwd FROM time_series_points('hotel', 'expected_occupancy', v_hotel);
    IF n_fwd = 0 THEN RAISE EXCEPTION 'Migration 292: hotel.expected_occupancy returns no points'; END IF;
  END IF;

  RAISE NOTICE 'Migration 292: unit_cost % points, expected_occupancy % points', n_cost, n_fwd;
END $$;

COMMIT;
