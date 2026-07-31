-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 276 — a time series is a property of an object type. Tier 5.7.
--
-- Foundry (ontologies-v2 time-series-properties): "A Time Series property is a
-- property that contains a time series of data points", attached to an object
-- type, with three operations — get first point, get last point, stream points.
-- Those three are copied exactly; the point's internal field structure was not
-- in the page fetched, so this defines the minimum a point needs (a time and a
-- value) rather than inventing more.
--
-- Audit §8.3: we derive daily series inside the forecasting adapters
-- (daily_series.ts) and THROW THEM AWAY. There is no time-series object, so
-- nobody can ask "show me this variant's consumption over the last 90 days"
-- without a tool being written for it. Meanwhile the data is right there:
-- stock_logs has a timestamp and a quantity, occupancy_logs a date and a
-- percentage, forecast_observations an as_of and a projection.
--
-- Config-as-data like every other registration here: a series names its backing
-- table, the column that identifies the object, the time column and the value
-- column. Registering one is a row, not a deployment.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.time_series_properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id  uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  property_key    text NOT NULL CHECK (property_key ~ '^[a-z][a-z0-9_]*$'),
  label           text NOT NULL,
  unit            text NOT NULL DEFAULT '',

  -- Where the points live.
  source_table    text NOT NULL,
  entity_column   text NOT NULL,   -- which column holds the object's id
  time_column     text NOT NULL,
  value_column    text NOT NULL,
  -- Optional sign flip: consumption is a negative stock movement, and a series
  -- an operator reads as "units consumed" should not be drawn upside down.
  negate          boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_type_id, property_key)
);

COMMENT ON TABLE public.time_series_properties IS
  'Time series attached to an object type, Foundry-style: a property that contains a series of points. Registration is config — table, entity column, time column, value column — so adding one is a row rather than a deployment.';

ALTER TABLE public.time_series_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read time series props" ON public.time_series_properties;
CREATE POLICY "members read time series props" ON public.time_series_properties
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM object_types t WHERE t.id = object_type_id
                 AND t.organization_id IS NOT DISTINCT FROM auth_org_id()));

DROP POLICY IF EXISTS "admins author time series props" ON public.time_series_properties;
CREATE POLICY "admins author time series props" ON public.time_series_properties
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND EXISTS (
    SELECT 1 FROM object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM auth_org_id()))
  WITH CHECK (auth_role() IN ('owner','admin') AND EXISTS (
    SELECT 1 FROM object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM auth_org_id()));

-- ── The three operations Foundry defines ─────────────────────────────────────
-- stream_points is the general one; first and last are the two special cases
-- worth their own name because "when did this start" and "what is it now" are
-- asked far more often than a range.

CREATE OR REPLACE FUNCTION public.time_series_points(
  p_type_api_name text, p_property_key text, p_record_id uuid,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 5000)
RETURNS TABLE (at timestamptz, value numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  SELECT ts.* INTO s FROM time_series_properties ts
   JOIN object_types t ON t.id = ts.object_type_id
   WHERE t.api_name = p_type_api_name AND ts.property_key = p_property_key
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TimeSeries:PropertyNotRegistered' USING
      DETAIL = format('%s has no time series property %s', p_type_api_name, p_property_key);
  END IF;

  -- SECURITY INVOKER plus the backing table's own RLS: a series cannot show a
  -- caller points from a hotel they cannot read.
  RETURN QUERY EXECUTE format(
    'SELECT %I::timestamptz, (%s%I)::numeric FROM public.%I
      WHERE %I = $1 AND ($2 IS NULL OR %I >= $2) AND ($3 IS NULL OR %I <= $3)
      ORDER BY %I LIMIT $4',
    s.time_column, CASE WHEN s.negate THEN '-' ELSE '' END, s.value_column, s.source_table,
    s.entity_column, s.time_column, s.time_column, s.time_column)
  USING p_record_id, p_from, p_to, p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.time_series_last_point(
  p_type_api_name text, p_property_key text, p_record_id uuid)
RETURNS TABLE (at timestamptz, value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT * FROM time_series_points(p_type_api_name, p_property_key, p_record_id)
  ORDER BY at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.time_series_first_point(
  p_type_api_name text, p_property_key text, p_record_id uuid)
RETURNS TABLE (at timestamptz, value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT * FROM time_series_points(p_type_api_name, p_property_key, p_record_id)
  ORDER BY at ASC LIMIT 1;
$$;

COMMENT ON FUNCTION public.time_series_points(text, text, uuid, timestamptz, timestamptz, integer) IS
  'Stream points for one object, Foundry''s stream-points. SECURITY INVOKER so the backing table''s RLS still decides what a caller may see.';

-- ── Register the series the data already supports ────────────────────────────

INSERT INTO public.time_series_properties
  (object_type_id, property_key, label, unit, source_table, entity_column, time_column, value_column, negate)
SELECT t.id, v.key, v.label, v.unit, v.tbl, v.entity_col, v.time_col, v.value_col, v.negate
FROM object_types t
JOIN (VALUES
  -- A consumption movement is a negative quantity_change; an operator reading
  -- "units consumed" should not see it drawn below zero.
  ('variant', 'consumption',      'Consumption',      'units', 'stock_logs',            'variant_id', 'timestamp', 'quantity_change', true),
  ('variant', 'projected_demand', 'Projected demand', 'units', 'forecast_observations', 'variant_id', 'as_of',     'projected_units', false),
  ('hotel',   'occupancy',        'Occupancy',        '%',     'occupancy_logs',        'hotel_id',   'date',      'occupancy_pct',   false)
) AS v(type_api, key, label, unit, tbl, entity_col, time_col, value_col, negate)
  ON t.api_name = v.type_api AND t.kind = 'builtin'
ON CONFLICT (object_type_id, property_key) DO NOTHING;

-- A registration whose backing column does not exist is a series that will fail
-- the first time anybody asks for it. Catch it here, not there.
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
    RAISE EXCEPTION 'Migration 276: time series registered against a column that does not exist: %', bad;
  END IF;
END $$;

COMMIT;
