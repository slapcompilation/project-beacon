-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 277 — a series called Consumption must contain consumption.
--
-- 276 registered variant.consumption over stock_logs.quantity_change with a sign
-- flip, and the first read gave it away: first point -253, last +17. The -253 is
-- a RESTOCK — a positive movement negated — sitting in a series labelled
-- "Consumption". The numbers were right and the name was a lie, which is the
-- failure mode this whole audit keeps finding wearing a different hat.
--
-- The series was really net stock movement. So: filter by sign, as an enum
-- rather than a SQL fragment, because a filter column that takes arbitrary SQL
-- is an injection surface that would undo the RLS this function carefully keeps.
--
--   consumption    movements OUT of stock, negated so the chart reads upward
--   stock_movement everything, raw sign — in is positive, out is negative
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.time_series_properties
  ADD COLUMN IF NOT EXISTS value_sign text NOT NULL DEFAULT 'any'
    CHECK (value_sign IN ('any','positive','negative'));

COMMENT ON COLUMN public.time_series_properties.value_sign IS
  'Which movements belong in this series. An enum, not a SQL fragment: a filter taking arbitrary SQL would be an injection surface undoing the RLS these functions preserve.';

CREATE OR REPLACE FUNCTION public.time_series_points(
  p_type_api_name text, p_property_key text, p_record_id uuid,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 5000)
RETURNS TABLE (at timestamptz, value numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE s record; sign_clause text;
BEGIN
  SELECT ts.* INTO s FROM time_series_properties ts
   JOIN object_types t ON t.id = ts.object_type_id
   WHERE t.api_name = p_type_api_name AND ts.property_key = p_property_key
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TimeSeries:PropertyNotRegistered' USING
      DETAIL = format('%s has no time series property %s', p_type_api_name, p_property_key);
  END IF;

  sign_clause := CASE s.value_sign
    WHEN 'positive' THEN format(' AND %I > 0', s.value_column)
    WHEN 'negative' THEN format(' AND %I < 0', s.value_column)
    ELSE '' END;

  RETURN QUERY EXECUTE format(
    'SELECT %I::timestamptz, (%s%I)::numeric FROM public.%I
      WHERE %I = $1 AND ($2 IS NULL OR %I >= $2) AND ($3 IS NULL OR %I <= $3)%s
      ORDER BY %I LIMIT $4',
    s.time_column, CASE WHEN s.negate THEN '-' ELSE '' END, s.value_column, s.source_table,
    s.entity_column, s.time_column, s.time_column, sign_clause, s.time_column)
  USING p_record_id, p_from, p_to, p_limit;
END $$;

-- consumption = stock going OUT, negated so it reads as units consumed.
UPDATE public.time_series_properties ts
   SET value_sign = 'negative'
  FROM object_types t
 WHERE t.id = ts.object_type_id AND t.api_name = 'variant' AND ts.property_key = 'consumption';

-- and the honest general series alongside it.
INSERT INTO public.time_series_properties
  (object_type_id, property_key, label, unit, source_table, entity_column, time_column, value_column, negate, value_sign)
SELECT t.id, 'stock_movement', 'Stock movement', 'units', 'stock_logs', 'variant_id', 'timestamp', 'quantity_change', false, 'any'
FROM object_types t WHERE t.api_name = 'variant' AND t.kind = 'builtin'
ON CONFLICT (object_type_id, property_key) DO NOTHING;

COMMIT;
