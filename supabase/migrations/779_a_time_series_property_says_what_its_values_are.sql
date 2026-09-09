-- A time series property says what its values are.
--
-- 774 built the TSP and left its `itemType` unstored, naming it as the first of
-- the reading's open questions. The api makes it REQUIRED, and it is the one
-- part of a `timeseries` property type that is not derivable from the sync:

--   "A union of the types supported by time series properties."
--   — api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md

-- Three members — `string`, `double`, `numericOrNonNumeric` — and the third
-- carries an optional reference to a boolean property:

--   "The time series property can either contain either numeric or non-numeric
--    data. This enables mixed sensor types where some sensor time series are
--    numeric and others are categorical. A boolean property reference can be
--    used to determine if the series is numeric or non-numeric. Without this
--    property, the series type can be either numeric or non-numeric and must be
--    inferred from the result of a time series query."
--   — api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md

--   "The boolean property type ID specifying whether the series is numeric or
--    non-numeric. If the value is true, the series is non-numeric."
--   — api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md

-- ── what this changes about the reader ─────────────────────────────────────
--
-- `time_series_points` returns a numeric column and a categorical one, always.
-- That was not a shrug: it is exactly the documented behaviour of
-- `numericOrNonNumeric` WITHOUT the boolean property — the series type "must be
-- inferred from the result of a time series query". What was missing is the
-- other two members, where the answer is known in advance and the reader should
-- not hand back a column that is always null.
--
-- So the reader now returns only the column the declaration promises, and both
-- when the declaration is the one that says to infer. The boolean-property form
-- of `numericOrNonNumeric` is NOT built — it resolves per SERIES, from a
-- property of the object being read, and that is a second lookup for a case no
-- page shows configured. The column that would hold it is added, so the
-- declaration can be made, and the guard refuses it until the reader can honour
-- it. Named rather than half-built.

-- ── 1. the declaration ─────────────────────────────────────────────────────

ALTER TABLE public.object_type_properties
  ADD COLUMN time_series_item_type text,
  ADD COLUMN time_series_is_non_numeric_property_id uuid
    REFERENCES public.object_type_properties(id) ON DELETE RESTRICT;

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT object_type_properties_item_type_check
  CHECK (time_series_item_type IS NULL
         OR time_series_item_type IN ('string', 'double', 'numericOrNonNumeric'));

COMMENT ON CONSTRAINT object_type_properties_item_type_check ON public.object_type_properties IS
  'Values from api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata — a union of the types supported by time series properties: string, double, numericOrNonNumeric.';

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT object_type_properties_item_type_belongs_to_a_series
  CHECK ((time_series_item_type IS NULL OR base_type = 'time_series')
         AND (time_series_is_non_numeric_property_id IS NULL
              OR time_series_item_type = 'numericOrNonNumeric'));

COMMENT ON COLUMN public.object_type_properties.time_series_item_type IS
  'What a time series property''s values are, the api''s required itemType: string, double, or numericOrNonNumeric. The last is the mixed case — "Without this property, the series type can be either numeric or non-numeric and must be inferred from the result of a time series query".';

COMMENT ON COLUMN public.object_type_properties.time_series_is_non_numeric_property_id IS
  'The api''s isNonNumericPropertyTypeId — "The boolean property type ID specifying whether the series is numeric or non-numeric. If the value is true, the series is non-numeric." Storable, and refused by the binding guard until the reader resolves it per series.';

CREATE INDEX object_type_properties_is_non_numeric_idx
  ON public.object_type_properties (time_series_is_non_numeric_property_id)
  WHERE time_series_is_non_numeric_property_id IS NOT NULL;

-- ── 2. a bound TSP declares it ─────────────────────────────────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.guard_time_series_source()'::regprocedure), chr(13), '');
  a := '  RETURN NULL;
END';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one tail in guard_time_series_source, found %', n; END IF;
  EXECUTE replace(src, a,
'  -- The api makes itemType required on a timeseries property type, so a
  -- property bound to a sync has said what its values are.
  IF pr.time_series_item_type IS NULL THEN
    RAISE EXCEPTION ''TimeSeries:ItemTypeNotDeclared — % must say whether its series are string, double or numericOrNonNumeric'',
      pr.property_id;
  END IF;

  -- The boolean property reference resolves per SERIES, which the reader does
  -- not do yet. Refused rather than stored and ignored.
  IF pr.time_series_is_non_numeric_property_id IS NOT NULL THEN
    RAISE EXCEPTION ''TimeSeries:MixedSeriesNotBuilt — a boolean property deciding numeric-or-not per series is not read yet; leave it unset and the type is inferred from the result'';
  END IF;

' || a);
END $mig$;

-- ── 3. the reader returns what the declaration promises ────────────────
-- The emitted SQL is left alone; the declaration is honoured where the rows
-- come back, which is one anchor rather than surgery on a format string.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef(
    'public.time_series_points(uuid,text,text,timestamptz,timestamptz,integer)'::regprocedure), chr(13), '');
  a := '  RETURN QUERY EXECUTE q;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one RETURN QUERY, found %', n; END IF;

  EXECUTE replace(src, a,
'  -- Only the column the declaration promises. numericOrNonNumeric keeps both,
  -- because that is the member whose type must be inferred from the result.
  FOR point_time, num, cat IN EXECUTE q LOOP
    IF pr.time_series_item_type = ''string'' THEN num := NULL; END IF;
    IF pr.time_series_item_type = ''double'' THEN cat := NULL; END IF;
    RETURN NEXT;
  END LOOP;');
END $mig$;

COMMENT ON FUNCTION public.time_series_points(uuid, text, text, timestamptz, timestamptz, integer) IS
  'The points of one object''s time series property. Resolves the series id from the object''s index row, then reads the sync''s dataset. Returns the column the property''s itemType promises — a double for "double", a categorical for "string", and both for "numericOrNonNumeric", the member whose type must be inferred from the result of a time series query. Applies the sync dataset''s markings, because a TSP is readable only by someone who may read its backing data source.';

-- ── PROVED BY DOING ──────────────────────────────────────────
-- Written before applying, which 774 and 776 both failed to do.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; tbl text;
  ds2 uuid; br2 uuid; txn2 uuid; file2 uuid; tbl2 text;
  machine uuid; src_id uuid; sync uuid; tsd uuid; prop uuid; boolprop uuid;
  build uuid; job_state text; err text; v double precision; cv text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m779 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm779-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm779-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M779 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm779p', 'm779 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm779_machines', 'Machines') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"machine_id","type":"STRING"},{"name":"temperature_id","type":"STRING"},{"name":"is_cat","type":"BOOLEAN"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'machines.parquet', 1) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO tbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, machine_id, temperature_id, is_cat) VALUES ($1,''M1'',''M1-temp'',false)', tbl) USING file;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm779_points', 'Points') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO txn2;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds2, txn2, '[{"name":"series_id","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"val","type":"DOUBLE"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds2, txn2, 'points.parquet', 1) RETURNING id INTO file2;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn2;
  SELECT public.dataset_materialize(ds2, txn2) INTO tbl2;
  EXECUTE format('INSERT INTO datasets.%I (_file, series_id, ts, val) VALUES ($1,''M1-temp'',''2026-01-01T00:00:00Z'',10.0)', tbl2) USING file2;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M779Machine', 'Machine') RETURNING id INTO machine;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (machine, ds, br) RETURNING id INTO src_id;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (machine, 'machine_id', 'Machine Id', 'machineId', 'string', 'column', 'machine_id',
          src_id, true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (machine, 'is_cat', 'Is categorical', 'isCat', 'boolean', 'column', 'is_cat', src_id)
  RETURNING id INTO boolprop;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (machine, 'temperature_id', 'Temperature', 'temperature', 'time_series', 'column',
          'temperature_id', src_id, 'double')
  RETURNING id INTO prop;

  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, ds2, 'M779 points', 'series_id', 'ts', 'val') RETURNING id INTO sync;
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (machine, sync) RETURNING id INTO tsd;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (tsd, prop);

  SELECT public.run_index_build(ARRAY[machine]::uuid[], true) INTO build;
  SELECT string_agg(coalesce(b.error, b.state), ' | ') INTO job_state
    FROM public.build_jobs b WHERE b.build_id = build AND b.state <> 'COMPLETED';
  IF job_state IS NOT NULL THEN RAISE EXCEPTION 'the index build should complete: %', job_state; END IF;

  -- `double`: the numeric column is the answer, the categorical one is not.
  SELECT p.num, p.cat INTO v, cv FROM public.time_series_points(machine, 'M1', 'temperature_id') p LIMIT 1;
  IF v IS DISTINCT FROM 10.0 THEN RAISE EXCEPTION 'a double series returns its number, got %', v; END IF;
  IF cv IS NOT NULL THEN RAISE EXCEPTION 'a double series returns no categorical value, got %', cv; END IF;

  -- `string`: the other way round.
  UPDATE public.object_type_properties SET time_series_item_type = 'string' WHERE id = prop;
  SELECT p.num, p.cat INTO v, cv FROM public.time_series_points(machine, 'M1', 'temperature_id') p LIMIT 1;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'a string series returns no number, got %', v; END IF;
  IF cv IS NULL THEN RAISE EXCEPTION 'a string series returns its value as text'; END IF;

  -- `numericOrNonNumeric`: both, because the type is inferred from the result.
  UPDATE public.object_type_properties SET time_series_item_type = 'numericOrNonNumeric' WHERE id = prop;
  SELECT p.num, p.cat INTO v, cv FROM public.time_series_points(machine, 'M1', 'temperature_id') p LIMIT 1;
  IF v IS NULL OR cv IS NULL THEN
    RAISE EXCEPTION 'the mixed member hands back both, got % and %', v, cv;
  END IF;

  -- The declaration is required of a bound property. The unbind happens OUTSIDE
  -- the block: a subtransaction that catches the refusal would roll the delete
  -- back with it, and the next case would meet the row it thought it removed.
  DELETE FROM public.object_type_time_series_sources WHERE property_id = prop;
  UPDATE public.object_type_properties SET time_series_item_type = NULL WHERE id = prop;
  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (tsd, prop);
    RAISE EXCEPTION 'a bound time series property declares its item type';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:ItemTypeNotDeclared%' THEN RAISE; END IF;
  END;

  -- And the boolean-property form is refused rather than stored and ignored.
  UPDATE public.object_type_properties
     SET time_series_item_type = 'numericOrNonNumeric',
         time_series_is_non_numeric_property_id = boolprop
   WHERE id = prop;
  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (tsd, prop);
    RAISE EXCEPTION 'the per-series boolean is not read yet and must say so';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:MixedSeriesNotBuilt%' THEN RAISE; END IF;
  END;

  -- A non-series property may not carry the declaration at all.
  BEGIN
    UPDATE public.object_type_properties SET time_series_item_type = 'double' WHERE id = boolprop;
    RAISE EXCEPTION 'only a time series property says what its series are';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE EXCEPTION USING errcode = 'P0779', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0779' THEN
  NULL;
END $$;
