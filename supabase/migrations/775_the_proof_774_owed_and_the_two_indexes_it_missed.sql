-- The proof 774 owed, and the two indexes it missed.
--
-- 774 shipped without a `PROVED BY DOING` block. CLAUDE.md asks for both
-- halves: assertions prove the change at the moment it lands, and the platform
-- suite proves it still holds — both, not either. 774 got one.
-- Applied migrations are immutable, so the proof lands here and exercises 774's
-- mechanisms end to end rather than restating them.
--
-- The suite caught the other half within one run: 464's rule is that every
-- foreign key has an index on its leading column, and `time_series_syncs`
-- indexed its dataset and its project while leaving `organization_id` and
-- `created_by_user_id` bare. `catalog.test.ts` named both. That is the guard
-- working, and it is why the suite runs before a push.

CREATE INDEX time_series_syncs_organization_idx
  ON public.time_series_syncs (organization_id);
CREATE INDEX time_series_syncs_created_by_idx
  ON public.time_series_syncs (created_by_user_id);

-- ── PROVED BY DOING — a machine, its temperature, and the points ───────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds_obj uuid; br_obj uuid; txn uuid; file uuid; tbl_obj text;
  ds_sync uuid; br_sync uuid; txn2 uuid; file2 uuid; tbl_sync text;
  machine uuid; sync uuid; src uuid; prop uuid; build uuid; job_state text;
  n int; err text; v double precision;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m775 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm775-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm775-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M775 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm775p', 'm775 probe') RETURNING id INTO proj;

  -- The object type's backing dataset: a primary key and one series id column,
  -- which is the shape the glossary prints for a time series object type.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm775_machines', 'Machines') RETURNING id INTO ds_obj;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds_obj, 'master') RETURNING id INTO br_obj;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds_obj, br_obj, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds_obj, txn, '[{"name":"machine_id","type":"STRING"},{"name":"temperature_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds_obj, txn, 'machines.parquet', 2) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds_obj, txn) INTO tbl_obj;
  EXECUTE format('INSERT INTO datasets.%I (_file, machine_id, temperature_id) VALUES ($1,''M1'',''M1-temp''), ($1,''M2'',''M2-temp'')', tbl_obj) USING file;

  -- The sync's dataset: exactly the three columns the glossary calls exact.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm775_points', 'Points') RETURNING id INTO ds_sync;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds_sync, 'master') RETURNING id INTO br_sync;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds_sync, br_sync, 'SNAPSHOT') RETURNING id INTO txn2;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds_sync, txn2, '[{"name":"series_id","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"val","type":"DOUBLE"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds_sync, txn2, 'points.parquet', 3) RETURNING id INTO file2;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn2;
  SELECT public.dataset_materialize(ds_sync, txn2) INTO tbl_sync;
  EXECUTE format($f$INSERT INTO datasets.%I (_file, series_id, ts, val) VALUES
      ($1,'M1-temp','2026-01-01T00:00:00Z',10.0),
      ($1,'M1-temp','2026-01-01T01:00:00Z',11.5),
      ($1,'M2-temp','2026-01-01T00:00:00Z',99.0)$f$, tbl_sync) USING file2;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M775Machine', 'Machine') RETURNING id INTO machine;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (machine, ds_obj, br_obj) RETURNING id INTO src;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (machine, 'machine_id', 'Machine Id', 'machineId', 'string', 'column', 'machine_id',
          src, true, true, true);
  -- The TSP: a column that keeps holding strings, and a property that is a TSP.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (machine, 'temperature_id', 'Temperature', 'temperature', 'time_series', 'column',
          'temperature_id', src)
  RETURNING id INTO prop;

  -- The sync, and the guards on its columns.
  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, ds_sync, 'M775 points', 'series_id', 'ts', 'val') RETURNING id INTO sync;

  IF (SELECT rid FROM public.time_series_syncs WHERE id = sync)
     IS DISTINCT FROM public.rid_of('time-series-catalog', 'sync', sync) THEN
    RAISE EXCEPTION 'a sync carries the rid its catalogue names it by';
  END IF;

  BEGIN
    INSERT INTO public.time_series_syncs
      (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
    VALUES (org, proj, ds_sync, 'M775 bad column', 'nope', 'ts', 'val');
    RAISE EXCEPTION 'a column that is not in the dataset should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:SyncColumnNotInDataset%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.time_series_syncs
      (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
    VALUES (org, proj, ds_sync, 'M775 bad value', 'series_id', 'ts', 'series_id');
    -- series_id is a STRING, which IS an allowed value type, so this must SUCCEED.
    NULL;
  EXCEPTION WHEN raise_exception THEN
    RAISE EXCEPTION 'a string value column is a categorical series and is allowed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.time_series_syncs
      (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
    VALUES (org, proj, ds_sync, 'M775 wrong time', 'series_id', 'val', 'val');
    RAISE EXCEPTION 'a double time column should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:TimestampTypeNotAllowed%' THEN RAISE; END IF;
  END;

  -- The fourth arm of the union, and the binding.
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (machine, sync) RETURNING id INTO src;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id)
  VALUES (src, prop);

  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id)
    VALUES (src, (SELECT id FROM public.object_type_properties
                   WHERE object_type_id = machine AND property_id = 'machine_id'));
    RAISE EXCEPTION 'a sync provides values for time series properties only';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:NotATimeSeriesProperty%' THEN RAISE; END IF;
  END;

  -- Index the object type, so the series id can be resolved from its row.
  SELECT public.run_index_build(ARRAY[machine]::uuid[], true) INTO build;
  SELECT b.state INTO job_state FROM public.build_jobs b WHERE b.build_id = build;
  IF job_state <> 'COMPLETED' THEN
    RAISE EXCEPTION 'the index build should complete, got %: %', job_state,
      (SELECT error FROM public.build_jobs WHERE build_id = build);
  END IF;

  -- THE POINT OF ALL OF IT: the object's points come back.
  SELECT count(*) INTO n FROM public.time_series_points(machine, 'M1', 'temperature_id');
  IF n <> 2 THEN RAISE EXCEPTION 'M1 has two points, got %', n; END IF;

  SELECT count(*) INTO n FROM public.time_series_points(machine, 'M2', 'temperature_id');
  IF n <> 1 THEN RAISE EXCEPTION 'M2 has one point, got %', n; END IF;

  SELECT p.num INTO v FROM public.time_series_points(machine, 'M1', 'temperature_id') p
   ORDER BY p.point_time LIMIT 1;
  IF v IS DISTINCT FROM 10.0 THEN RAISE EXCEPTION 'the first point of M1 is 10.0, got %', v; END IF;

  -- A window narrows it, which is what a range is for.
  SELECT count(*) INTO n FROM public.time_series_points(
    machine, 'M1', 'temperature_id', '2026-01-01T00:30:00Z'::timestamptz, NULL);
  IF n <> 1 THEN RAISE EXCEPTION 'one point falls after the half hour, got %', n; END IF;

  -- And a property nobody bound resolves to nothing rather than to noise.
  BEGIN
    PERFORM public.time_series_points(machine, 'M1', 'machine_id');
    RAISE EXCEPTION 'a non-series property is not a series';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'TimeSeries:NotATimeSeriesProperty%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0775', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0775' THEN
  NULL;
END $$;
