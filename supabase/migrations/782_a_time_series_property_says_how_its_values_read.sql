-- A time series property says how its values read.
--
-- The base formatter: the third column of the TSP table, and the last part of
-- `## Time series formatting` that 774 named as unbuilt.

--   "Time series formatting allows setting the desired internal interpolation
--    and units of the time series. Applications like Quiver will respect the
--    provided interpolation and unit values."
--   — time-series/time-series-properties.md

-- ── two corrections this migration owes before it adds anything ────────────
--
-- 1. **780's header is wrong and I wrote it.** It says `ObjectTypesPage`
--    "excludes `time_series` from the property type dropdown by name". It does
--    not. Line 210 offers every member of PROPERTY_TYPES; the filter that names
--    `time_series` is on the ARRAY ELEMENT dropdown twelve lines below, and it
--    is about `array` elements. So an undeclared, unbound time series property
--    IS creatable from the editor today, and this migration's surface has to
--    tolerate one rather than assuming the panel is the only way in.
--
-- 2. **`api/` publishes nothing here.** Zero of 1,821 api pages match
--    `interpolat`; the `timeseries` property type publishes `itemType` and
--    nothing else. CLAUDE.md leans on api/ to settle shape questions and it has
--    falsified our schema four times — here it cannot. Prose is the only
--    source for this feature, which is a weaker rail than usual, and saying so
--    is the point of this paragraph.

-- ── it is NOT the value formatter, and that was the design fork ────────────
--
-- The column is headed BASE FORMATTER, which is also the docs' own name for
-- `value_formatting` (738 says so, citing derived-properties). One name, and
-- the temptation is to add a sixth arm to `value_formatting_valid`. That would
-- be wrong twice over: the api's `valueFormatting` union has exactly five
-- members — date, number, boolean, knownType, timestamp — with no time series
-- member, and 736 exists precisely because 673 invented members the api does
-- not publish. A sixth arm would repeat that migration's mistake.
--
-- What IS reused is the ENCODING, one level down. Every "value or pointer" slot
-- the api publishes — a unit, a currency code, an affix, a timezone id — is the
-- same two-member union, and 736 already validates it as
-- `formatting_operand_valid`:

--   "The unit and interpolation formatting can point to other `string`
--    properties on this object type for more granular control (for example, if
--    each time series contained in the time series property has different units
--    and or interpolation). If granular control is not required, both
--    interpolation and units have a set of standard values to choose from."
--   — time-series/time-series-properties.md

-- That sentence IS the constant-or-pointer union, in prose. So the two columns
-- below are operands, validated by the function that already exists, and the
-- recorded seam in packages/ontology/src/formatting/index.ts holds: the api's
-- `propertyApiName` carries a PROPERTY_ID here, as it does everywhere else in
-- this codebase.

-- ── interpolation is a closed set; units are not, and the page promised one ─

--   "The internal interpolation options available in the Palantir platform
--    are:"
--   — time-series/interpolation-overview.md

-- Five members, enumerated verbatim there and again in create-sensor-ot's
-- "Valid values are:" list. So the interpolation constant takes a CHECK that
-- names its page.
--
-- **Units get no CHECK, and the reason is a promise the corpus does not keep.**
-- The same sentence quoted above says units "have a set of standard values to
-- choose from". That set is nowhere: not on any of 4,123 mirrored pages, not in
-- api/, not in the 214 extracted lessons. The only enumerated unit lists in the
-- corpus belong to other products and print themselves truncated as "and more".
-- Palantir's own worked example uses `ft`, `mph`, `ft/min`, `deg` — and `lat`
-- and `lon`, which are not units at all. Inventing the set here is exactly what
-- CLAUDE.md rule 1 forbids, so the column takes free text and this paragraph is
-- the record of why it has no `Values from` comment.

--   "The units provided in the time series formatter are mainly used for visual
--    display purposes. For example, as an axis label on plots in Quiver."
--   — time-series/time-series-properties.md

-- ── what is deliberately NOT modelled ─────────────────────────────────────
--
-- **External interpolation.** Quiver's cards have one and the ontology does
-- not: no field, no type class, no sensor option, nothing on any Ontology
-- Manager surface. It is a plot setting. Two consuming applications also
-- disagree about its shape — Quiver splits it into Before and After, Workshop
-- carries a single External — which is a second reason the ontology is not
-- where it lives.
--
-- **The sensor branch.** For a sensor object type Foundry replaces this whole
-- cell with an info icon whose tooltip reads:

--   "Set the units and interpolation in the Sensor object type configuration below."
--   — time-series/images/time-series-setup-sensor-object-type-base-formatter.png

-- Sensor object types are excluded from this project, so no object type of ours
-- can be one and that branch would be an engine nothing reaches.
--
-- **A precedence rule.** Nothing in the mirror says what wins when a sensor
-- object type carries both a base formatter and a sensor-section value. The
-- page says the sensor section "should be" used "rather than" the base
-- formatter, inside a warning callout, and the UI withholds the control instead
-- of refusing. Withholding is a surface decision; a precedence rule would be an
-- invention, and it is left uninvented.

-- ── 1. the two operands ───────────────────────────────────────────────────

ALTER TABLE public.object_type_properties
  ADD COLUMN time_series_interpolation jsonb,
  ADD COLUMN time_series_units jsonb;

COMMENT ON COLUMN public.object_type_properties.time_series_interpolation IS
  'The base formatter''s internal interpolation, as the api''s constant-or-property operand (736). A constant carries one of the five members interpolation-overview enumerates; a propertyType points at a string property of this object type holding the token per object. Null means unset, which is not unknown: "numeric time series use LINEAR interpolation and categorical series use PREVIOUS", so time_series_formatting() resolves it from the declared itemType.';

COMMENT ON COLUMN public.object_type_properties.time_series_units IS
  'The base formatter''s units, as the same constant-or-property operand. The constant is FREE TEXT deliberately: time-series-properties says units "have a set of standard values to choose from" and no page in the corpus prints that set, so there is nothing a CHECK could cite. Units are "mainly used for visual display purposes".';

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT time_series_formatting_is_an_operand
  CHECK ((time_series_interpolation IS NULL OR public.formatting_operand_valid(time_series_interpolation))
     AND (time_series_units IS NULL OR public.formatting_operand_valid(time_series_units)));

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT time_series_formatting_only_on_a_time_series_property
  CHECK (base_type = 'time_series'
         OR (time_series_interpolation IS NULL AND time_series_units IS NULL));

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT time_series_interpolation_is_a_published_member
  CHECK (time_series_interpolation -> 'constant' ->> 'value' IS NULL
         OR time_series_interpolation -> 'constant' ->> 'value'
            IN ('LINEAR', 'NEAREST', 'PREVIOUS', 'NEXT', 'NONE'));

COMMENT ON CONSTRAINT time_series_interpolation_is_a_published_member
  ON public.object_type_properties IS
  'Values from time-series/interpolation-overview.md';

-- ── 2. what a given object's formatting actually resolves to ──────────────
--
-- The pointer half is per object — "if each time series contained in the time
-- series property has different units" — so it resolves through the same index
-- and primary key `time_series_points` reads the series id from. Without this
-- the pointer would be stored and never followed, which is the shape 779 and
-- 780 both refused.

CREATE OR REPLACE FUNCTION public.time_series_formatting(
  p_object_type uuid,
  p_property    text,
  p_primary_key text DEFAULT NULL
)
RETURNS TABLE (interpolation text, units text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE pr record; idx text; pk text;
BEGIN
  SELECT p.* INTO pr FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND (p.property_id = p_property OR p.api_name = p_property)
     AND p.base_type = 'time_series';
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:NotATimeSeriesProperty — % is not a time series property of this object type', p_property;
  END IF;

  -- "By default, numeric time series use LINEAR interpolation and categorical
  --  series use PREVIOUS." numericOrNonNumeric decides nothing until query
  --  time, so it resolves to null rather than guessing.
  interpolation := CASE pr.time_series_item_type
                     WHEN 'double' THEN 'LINEAR'
                     WHEN 'string' THEN 'PREVIOUS'
                     ELSE NULL END;
  units := NULL;

  IF pr.time_series_interpolation ? 'constant' THEN
    interpolation := pr.time_series_interpolation -> 'constant' ->> 'value';
  END IF;
  IF pr.time_series_units ? 'constant' THEN
    units := pr.time_series_units -> 'constant' ->> 'value';
  END IF;

  -- A pointer needs an object to point at. Asked without one, the declaration
  -- is reported as far as it goes rather than pretending a default.
  IF p_primary_key IS NULL
     OR (NOT (pr.time_series_interpolation ? 'propertyType')
         AND NOT (pr.time_series_units ? 'propertyType')) THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT x.index_table INTO idx FROM public.object_type_indexes x
   WHERE x.object_type_id = p_object_type AND public.object_type_index_ready(p_object_type);
  IF idx IS NULL THEN RETURN NEXT; RETURN; END IF;

  SELECT p.property_id INTO pk FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;

  IF pr.time_series_interpolation ? 'propertyType' THEN
    EXECUTE format('SELECT o.%I::text FROM objects.%I o WHERE o.%I::text = %L',
                   pr.time_series_interpolation -> 'propertyType' ->> 'propertyApiName',
                   idx, pk, p_primary_key)
      INTO interpolation;
  END IF;
  IF pr.time_series_units ? 'propertyType' THEN
    EXECUTE format('SELECT o.%I::text FROM objects.%I o WHERE o.%I::text = %L',
                   pr.time_series_units -> 'propertyType' ->> 'propertyApiName',
                   idx, pk, p_primary_key)
      INTO units;
  END IF;

  RETURN NEXT;
END $$;

COMMENT ON FUNCTION public.time_series_formatting(uuid, text, text) IS
  'What one object''s time series reads as: the base formatter resolved. A constant answers for every object; a propertyType operand is read per object from the index, because the page''s reason for the pointer is that "each time series contained in the time series property has different units and or interpolation". Called without a primary key it answers the constants and the itemType defaults only. Interpolation defaults are the page''s own — LINEAR for numeric, PREVIOUS for categorical — and numericOrNonNumeric resolves to null because the api says its type "must be inferred from the result of a time series query".';

GRANT EXECUTE ON FUNCTION public.time_series_formatting(uuid, text, text) TO authenticated, service_role;

-- ── 3. a pointer that names nothing is broken; LINEAR on a categorical is not ─
--
-- Two rules, two rungs, and the difference is whether a page states a
-- consequence.
--
-- A pointer must name "other `string` properties ON THIS OBJECT TYPE". If it
-- names a property that is gone, or one that is not a string, the formatter
-- cannot resolve — and that can become true without anyone editing the
-- formatter, which is the `ontology_violations()` shape exactly.
--
-- LINEAR is different. "Only applicable to numerical time series" is stated,
-- but NOTHING anywhere says what happens when it is set on a categorical one —
-- no error, no fallback, no ignore. A refusal would be stricter than Foundry,
-- so it warns.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_violations_core()'::regprocedure), chr(13), '');

  a := '   WHERE s.ontology_id <> lt.ontology_id OR g.ontology_id <> lt.ontology_id';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the cross-ontology link arm to end the function once, found %', n; END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- A base formatter pointing at a property that is gone, or is not a string.
  SELECT t.api_name, ''property'', pr.property_id,
         format(''The time series %s formatter points at a property that is not a string property of this object type'',
                f.which)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    CROSS JOIN LATERAL (VALUES (''interpolation'', pr.time_series_interpolation),
                               (''units'', pr.time_series_units)) AS f(which, operand)
   WHERE f.operand ? ''propertyType''
     AND NOT EXISTS (SELECT 1 FROM public.object_type_properties tgt
                      WHERE tgt.object_type_id = pr.object_type_id
                        AND tgt.property_id = f.operand -> ''propertyType'' ->> ''propertyApiName''
                        AND tgt.base_type = ''string'')');
END $mig$;

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_warnings()'::regprocedure), chr(13), '');

  a := '     AND NOT EXISTS (SELECT 1 FROM public.object_type_properties p
                      WHERE p.object_type_id = t.id AND p.is_default_time_series)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 780''s default arm to end the function once, found %', n; END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- "LINEAR: Linearly interpolate between the two points. Only applicable to
  -- numerical time series." No page says what happens if it is set anyway.
  SELECT t.api_name, ''property'', pr.property_id,
         ''LINEAR interpolation is only applicable to numerical time series, and this property declares string values''
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE pr.time_series_item_type = ''string''
     AND pr.time_series_interpolation -> ''constant'' ->> ''value'' = ''LINEAR''');
END $mig$;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; tbl text;
  ot uuid; pk uuid; tsp uuid; unitp uuid; n int; got record;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m782 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm782-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm782-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M782 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm782p', 'm782 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm782_sensors', 'Sensors') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"id","type":"STRING"},{"name":"temp_id","type":"STRING"},{"name":"uom","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 's.parquet', 2) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO tbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, id, temp_id, uom) VALUES ($1,''S1'',''S1-t'',''PSI''),($1,''S2'',''S2-t'',''kg'')', tbl)
    USING file;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M782Sensor', 'Sensor') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'id', 'Id', 'id', 'string', 'column', 'id', true, true, true) RETURNING id INTO pk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (ot, 'uom', 'Uom', 'uom', 'string', 'column', 'uom',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot)) RETURNING id INTO unitp;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'temp_id', 'Temperature', 'temperature', 'time_series', 'column', 'temp_id',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot), 'double')
  RETURNING id INTO tsp;

  -- 1. only a time series property carries a formatter
  BEGIN
    UPDATE public.object_type_properties
       SET time_series_units = '{"constant":{"value":"kg"}}'::jsonb WHERE id = unitp;
    RAISE EXCEPTION 'a string property was allowed a time series formatter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 2. the operand shape is the api's, and an invented one is refused
  BEGIN
    UPDATE public.object_type_properties
       SET time_series_units = '{"value":"kg"}'::jsonb WHERE id = tsp;
    RAISE EXCEPTION 'a non-operand jsonb was accepted as a formatter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. the interpolation constant is one of the five the page enumerates
  BEGIN
    UPDATE public.object_type_properties
       SET time_series_interpolation = '{"constant":{"value":"SPLINE"}}'::jsonb WHERE id = tsp;
    RAISE EXCEPTION 'an interpolation the page does not publish was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 4. unset is not unknown — the itemType supplies the page's own default
  SELECT * INTO got FROM public.time_series_formatting(ot, 'temp_id');
  IF got.interpolation <> 'LINEAR' OR got.units IS NOT NULL THEN
    RAISE EXCEPTION 'a numeric series defaults to LINEAR with no units; got % / %', got.interpolation, got.units;
  END IF;

  -- 5. a constant answers for every object
  UPDATE public.object_type_properties
     SET time_series_interpolation = '{"constant":{"value":"NEAREST"}}'::jsonb,
         time_series_units = '{"constant":{"value":"PSI"}}'::jsonb
   WHERE id = tsp;
  SELECT * INTO got FROM public.time_series_formatting(ot, 'temp_id');
  IF got.interpolation <> 'NEAREST' OR got.units <> 'PSI' THEN
    RAISE EXCEPTION 'the constants should answer; got % / %', got.interpolation, got.units;
  END IF;

  -- 6. a pointer is READ, per object, which is the whole reason it exists
  UPDATE public.object_type_properties
     SET time_series_units = jsonb_build_object('propertyType',
           jsonb_build_object('propertyApiName', 'uom'))
   WHERE id = tsp;
  PERFORM public.run_index_build(ARRAY[ot]::uuid[], true);

  SELECT * INTO got FROM public.time_series_formatting(ot, 'temp_id', 'S1');
  IF got.units <> 'PSI' THEN RAISE EXCEPTION 'S1 wears PSI; got %', got.units; END IF;
  SELECT * INTO got FROM public.time_series_formatting(ot, 'temp_id', 'S2');
  IF got.units <> 'kg' THEN RAISE EXCEPTION 'S2 wears kg; got %', got.units; END IF;

  -- asked without an object, a pointer answers as far as it goes
  SELECT * INTO got FROM public.time_series_formatting(ot, 'temp_id');
  IF got.units IS NOT NULL THEN
    RAISE EXCEPTION 'without a primary key a pointer has nothing to resolve; got %', got.units;
  END IF;

  -- 7. a pointer at a property that is not a string is a VIOLATION
  UPDATE public.object_type_properties
     SET time_series_units = jsonb_build_object('propertyType',
           jsonb_build_object('propertyApiName', 'nosuch'))
   WHERE id = tsp;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M782Sensor' AND v.problem LIKE '%points at a property that is not a string%';
  IF n <> 1 THEN RAISE EXCEPTION 'a dangling formatter pointer is a violation; got %', n; END IF;

  UPDATE public.object_type_properties
     SET time_series_units = jsonb_build_object('propertyType',
           jsonb_build_object('propertyApiName', 'uom'))
   WHERE id = tsp;

  -- 8. LINEAR on a categorical series WARNS and does not block
  UPDATE public.object_type_properties
     SET time_series_item_type = 'string',
         time_series_interpolation = '{"constant":{"value":"LINEAR"}}'::jsonb
   WHERE id = tsp;
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.object_type = 'M782Sensor' AND w.problem LIKE 'LINEAR interpolation is only applicable%';
  IF n <> 1 THEN RAISE EXCEPTION 'LINEAR on a categorical series warns; got %', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M782Sensor' AND v.problem LIKE '%LINEAR%';
  IF n <> 0 THEN RAISE EXCEPTION 'no page states a consequence, so it must not block a save; got %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0782', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0782' THEN
  NULL;
END $$;
