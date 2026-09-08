-- The proof 776 owed, and the second time I forgot one.
--
-- 775 exists because 774 shipped without a `PROVED BY DOING` block. 776 then
-- shipped without one too, one migration later, in the same session, by the
-- same person. Recorded plainly because a lesson written once and broken
-- immediately is not a lesson yet: the omission is not that I forget the rule,
-- it is that I write the header and the mechanism and then treat the migration
-- as finished before the assertions exist.
--
-- What follows proves 776 the way 775 proved 774 — by building the thing and
-- reading it back, rather than by asserting that the catalogue changed.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; tbl text;
  ds2 uuid; br2 uuid; txn2 uuid; file2 uuid; tbl2 text;
  airport uuid; airline uuid; lk uuid; build uuid; job_state text;
  src_air uuid; src_apt uuid;
  w text; n int; err text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m777 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm777-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm777-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M777 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm777p', 'm777 probe') RETURNING id INTO proj;

  -- Airlines, with a number of carriers to filter on at the FAR end.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm777_airlines', 'Airlines') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO txn2;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds2, txn2, '[{"name":"airline_id","type":"STRING"},{"name":"carriers","type":"LONG"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds2, txn2, 'airlines.parquet', 2) RETURNING id INTO file2;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn2;
  SELECT public.dataset_materialize(ds2, txn2) INTO tbl2;
  EXECUTE format('INSERT INTO datasets.%I (_file, airline_id, carriers) VALUES ($1,''BA'',12), ($1,''LH'',3)', tbl2)
    USING file2;

  -- Airports, each naming one airline by foreign key.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm777_airports', 'Airports') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"airport_id","type":"STRING"},{"name":"airline_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'airports.parquet', 3) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO tbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, airport_id, airline_id) VALUES ($1,''LHR'',''BA''), ($1,''LGW'',''BA''), ($1,''MUC'',''LH'')', tbl)
    USING file;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M777Airline', 'Airline') RETURNING id INTO airline;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (airline, ds2, br2) RETURNING id INTO src_air;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (airline, 'airline_id', 'Airline Id', 'airlineId', 'string', 'column', 'airline_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, searchable, datasource_id)
  VALUES (airline, 'carriers', 'Carriers', 'carriers', 'integer', 'column', 'carriers', true, src_air);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M777Airport', 'Airport') RETURNING id INTO airport;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (airport, ds, br) RETURNING id INTO src_apt;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (airport, 'airport_id', 'Airport Id', 'airportId', 'string', 'column', 'airport_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (airport, 'airline_id', 'Airline Id', 'airlineId', 'string', 'column', 'airline_id', src_apt);

  -- 417: the foreign key link's backing_column names the TARGET's primary key.
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, airport, airline, 'm777-serves', 'Airline', 'many_to_one', 'foreign_key', 'airline_id')
  RETURNING id INTO lk;

  -- Two types in one build means two job rows; ask about all of them.
  SELECT public.run_index_build(ARRAY[airline, airport]::uuid[], true) INTO build;
  SELECT string_agg(coalesce(b.error, b.state), ' | ') INTO job_state
    FROM public.build_jobs b WHERE b.build_id = build AND b.state <> 'COMPLETED';
  IF job_state IS NOT NULL THEN
    RAISE EXCEPTION 'the index build should complete: %', job_state;
  END IF;

  -- ── the far-end property predicate compiles into the arm's EXISTS ────────
  w := public.object_set_where(airport, '[{"type":"linkFilter","linkType":"m777-serves",
        "filters":[{"type":"propertyFilter","propertyType":"carriers",
                    "value":{"type":"numberRangeFilter","min":10}}]}]'::jsonb);
  IF w NOT LIKE '%EXISTS%' OR w NOT LIKE '%x.carriers%' THEN
    RAISE EXCEPTION 'the far predicate should bind to the far index alias, got: %', w;
  END IF;

  -- and it SELECTS: two airports serve an airline with ten or more carriers.
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
                 (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = airport), w)
    INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'LHR and LGW serve BA, which has twelve carriers; got %', n; END IF;

  -- the other side of the same predicate
  w := public.object_set_where(airport, '[{"type":"linkFilter","linkType":"m777-serves",
        "filters":[{"type":"propertyFilter","propertyType":"carriers",
                    "value":{"type":"numberRangeFilter","max":5}}]}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
                 (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = airport), w)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'only MUC serves LH, which has three; got %', n; END IF;

  -- presence is a MEMBER of the list now, and it still negates the whole arm
  w := public.object_set_where(airport, '[{"type":"linkFilter","linkType":"m777-serves",
        "filters":[{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"},
                   {"type":"propertyFilter","propertyType":"carriers",
                    "value":{"type":"numberRangeFilter","min":10}}]}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
                 (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = airport), w)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'only MUC does NOT serve a large airline; got %', n; END IF;

  -- the flat form saved explorations use still compiles, unchanged
  w := public.object_set_where(airport, '[{"type":"linkFilter","linkType":"m777-serves",
        "value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
                 (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = airport), w)
    INTO n;
  IF n <> 3 THEN RAISE EXCEPTION 'every airport names an airline; got %', n; END IF;

  -- a far property that is not on the far type is refused by name
  BEGIN
    PERFORM public.object_set_where(airport, '[{"type":"linkFilter","linkType":"m777-serves",
      "filters":[{"type":"propertyFilter","propertyType":"nope",
                  "value":{"type":"valuesFilter","values":["x"]}}]}]'::jsonb);
    RAISE EXCEPTION 'a far property that does not exist should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:PropertyNotFound%' THEN RAISE; END IF;
  END;

  -- and the cap, in the form 776 gave it
  IF NOT public.object_set_filters_valid('[{"type":"linkFilter","linkType":"A","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}},
                                           {"type":"linkFilter","linkType":"B","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb) THEN
    RAISE EXCEPTION 'two different links are what the captures show';
  END IF;
  IF public.object_set_filters_valid('[{"type":"linkFilter","linkType":"A","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}},
                                       {"type":"linkFilter","linkType":"A","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb) THEN
    RAISE EXCEPTION 'one link filter per link';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0777', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0777' THEN
  NULL;
END $$;
