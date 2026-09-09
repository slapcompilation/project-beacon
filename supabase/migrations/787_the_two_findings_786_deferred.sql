-- The two findings 786 deferred.
--
-- 786 held these back deliberately, and said why: 586's third arm fired on six
-- suites when a linter arm was written too wide, and 426 makes a violation
-- BLOCK a save that introduces one. Two arms, written apart from the feature
-- that motivated them so that a mistake in either is a mistake in one file.

-- ── 1. a sync's dataset can stop agreeing with the declaration ────────────
--
-- 780 added a bind-time check that a `string`/`double` declaration matches its
-- sync's value column, and 782's header already named the gap in it: the guard
-- fires on `object_type_time_series_sources`, so it catches the disagreement
-- when the binding is made and never again. Three edges pass unremarked — the
-- declaration is edited, the sync is repointed at another value column, or the
-- sync's dataset commits a schema where that column changes type.
--
-- That is exactly the rung CLAUDE.md describes for the linter: a fact that goes
-- stale without anyone editing the ontology. `ontology_violations()`, because
-- the reader's answer is wrong rather than merely unhelpful — 780 measured it:
-- a `double` declaration against a categorical sync makes 779's projection null
-- the column it named, and every point comes back empty with no error.

-- ── 2. a mixed-kind TSP with nothing to decide by ─────────────────────────
--
-- 786 made a TSP backed by syncs of two kinds declare `numericOrNonNumeric`,
-- which is the member whose type "must be inferred from the result of a time
-- series query". Inference is a real answer, so this is NOT broken — but for a
-- SENSOR object type the page is explicit that the boolean is required:

--   "*\[Required if the TSP is backed by multiple syncs of both numerical and
--    categorical types]* A Boolean value of `true` indicates a given sensor
--    object has categorical time series data, otherwise the data are assumed to
--    be numerical."
--   — time-series/create-sensor-ot.md

--   "If your TSP is backed by multiple syncs which are a mix of both numerical
--    and categorical syncs, you must select a boolean property used to indicate
--    whether a sensor object has categorical time series data."
--   — time-series/create-sensor-ot.md

-- **This is the one place in the slice where the two audiences split, and both
-- sides are cited.** The sensor page says *must select*; the api publishes
-- `isNonNumericPropertyTypeId` as optional and publishes the working fallback
-- for its absence. So: a violation when the object type is a sensor, a warning
-- otherwise. CLAUDE.md's rule about deciding which audience a column serves,
-- and saying so, is usually about vocabulary; here it decides a RUNG.
--
-- The split itself is inference: no page says it is an error for a sensor object
-- type and advice elsewhere. What is quoted is *required* on one side and
-- *optional* on the other, and the rungs follow from that.

-- ── the arms ─────────────────────────────────────────────────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_violations_core()'::regprocedure), chr(13), '');

  a := '     AND NOT EXISTS (SELECT 1 FROM public.object_type_sensor_links s
                      WHERE s.object_type_id = t.id)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 783''s sensor-link arm once, found %', n; END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- A declaration its own sync has stopped agreeing with. 780 checks this when
  -- the binding is made; nothing rechecks it when the declaration is edited,
  -- the sync is repointed, or the dataset commits a new schema.
  SELECT t.api_name, ''property'', pr.property_id,
         format(''The time series property declares %s and the sync %s now holds %s values'',
                pr.time_series_item_type, sy.name, k.kind)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_time_series_sources src ON src.property_id = pr.id
    JOIN public.object_type_datasources d ON d.id = src.datasource_id
    JOIN public.time_series_syncs sy ON sy.id = d.time_series_sync_id
    JOIN LATERAL (SELECT public.time_series_sync_item_type(sy.id) AS kind) k ON true
   WHERE pr.time_series_item_type IN (''string'', ''double'')
     AND k.kind IS NOT NULL
     AND k.kind <> pr.time_series_item_type

  UNION ALL

  -- "you must select a boolean property used to indicate whether a sensor
  -- object has categorical time series data" — required, for a SENSOR object
  -- type. Elsewhere the api publishes the field as optional with a working
  -- fallback, so elsewhere it warns instead (787).
  SELECT t.api_name, ''property'', pr.property_id,
         ''A sensor object type backed by syncs of both kinds must name the boolean property saying which each sensor holds''
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE t.is_sensor
     AND pr.base_type = ''time_series''
     AND pr.time_series_is_non_numeric_property_id IS NULL
     AND (SELECT count(DISTINCT public.time_series_sync_item_type(d.time_series_sync_id))
            FROM public.object_type_time_series_sources src
            JOIN public.object_type_datasources d ON d.id = src.datasource_id
           WHERE src.property_id = pr.id
             AND public.time_series_sync_item_type(d.time_series_sync_id) IS NOT NULL) > 1');
END $mig$;

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_warnings()'::regprocedure), chr(13), '');

  a := '     AND pr.time_series_interpolation -> ''constant'' ->> ''value'' = ''LINEAR''';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 782''s LINEAR arm once, found %', n; END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- The same configuration on a NON-sensor object type. The api publishes
  -- isNonNumericPropertyTypeId as optional and publishes what happens without
  -- it — the type "must be inferred from the result of a time series query" —
  -- so inference is a real answer and this advises rather than blocks.
  SELECT t.api_name, ''property'', pr.property_id,
         ''Backed by syncs of both kinds with no boolean property saying which; the type is inferred from each query result''
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE NOT t.is_sensor
     AND pr.base_type = ''time_series''
     AND pr.time_series_is_non_numeric_property_id IS NULL
     AND (SELECT count(DISTINCT public.time_series_sync_item_type(d.time_series_sync_id))
            FROM public.object_type_time_series_sources src
            JOIN public.object_type_datasources d ON d.id = src.datasource_id
           WHERE src.property_id = pr.id
             AND public.time_series_sync_item_type(d.time_series_sync_id) IS NOT NULL) > 1');
END $mig$;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied. Both arms are exercised in BOTH
-- directions — firing and not firing — because an arm written too wide is the
-- failure this migration was split off to avoid.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  mds uuid; mbr uuid; mtx uuid; mfile uuid;
  nds uuid; nbr uuid; ntx uuid;
  cds uuid; cbr uuid; ctx uuid;
  ot uuid; pk uuid; tsp uuid; flagp uuid; root uuid;
  numsync uuid; catsync uuid; d1 uuid; d2 uuid; lk uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m787 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm787-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm787-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M787 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm787p', 'm787 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm787_things', 'Things') RETURNING id INTO mds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (mds, 'master') RETURNING id INTO mbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (mds, mbr, 'SNAPSHOT') RETURNING id INTO mtx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (mds, mtx, '[{"name":"pk","type":"STRING"},{"name":"sid","type":"STRING"},{"name":"is_cat","type":"BOOLEAN"}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = mtx;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm787_num', 'Numeric') RETURNING id INTO nds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (nds, 'master') RETURNING id INTO nbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (nds, nbr, 'SNAPSHOT') RETURNING id INTO ntx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (nds, ntx, '[{"name":"s","type":"STRING"},{"name":"t","type":"TIMESTAMP"},{"name":"v","type":"DOUBLE"}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = ntx;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm787_cat', 'Categorical') RETURNING id INTO cds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (cds, 'master') RETURNING id INTO cbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (cds, cbr, 'SNAPSHOT') RETURNING id INTO ctx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (cds, ctx, '[{"name":"s","type":"STRING"},{"name":"t","type":"TIMESTAMP"},{"name":"v","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = ctx;

  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, nds, 'M787 numeric', 's', 't', 'v') RETURNING id INTO numsync;
  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, cds, 'M787 categorical', 's', 't', 'v') RETURNING id INTO catsync;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M787Thing', 'Thing') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, mds, mbr);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true) RETURNING id INTO pk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (ot, 'is_cat', 'Is categorical', 'isCat', 'boolean', 'column', 'is_cat',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot))
  RETURNING id INTO flagp;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'sid', 'Series', 'series', 'time_series', 'column', 'sid',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot), 'double')
  RETURNING id INTO tsp;

  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, numsync) RETURNING id INTO d1;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d1, tsp);

  -- ARM 1, NOT firing: a double declaration against a numeric sync agrees.
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%now holds%';
  IF n <> 0 THEN RAISE EXCEPTION 'an agreeing declaration must not be reported; got %', n; END IF;

  -- ARM 1 firing: repoint the sync at the categorical dataset's shape by
  -- pointing it at the categorical dataset. Nothing rechecks the binding.
  UPDATE public.time_series_syncs SET input_dataset_id = cds WHERE id = numsync;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%now holds string values%';
  IF n <> 1 THEN RAISE EXCEPTION 'a sync that stopped agreeing is one finding; got %', n; END IF;
  UPDATE public.time_series_syncs SET input_dataset_id = nds WHERE id = numsync;

  -- ARM 2: two kinds, no boolean. On a NON-sensor type it warns and does not block.
  UPDATE public.object_type_properties
     SET time_series_item_type = 'numericOrNonNumeric' WHERE id = tsp;
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, catsync) RETURNING id INTO d2;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp);

  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.object_type = 'M787Thing' AND w.problem LIKE 'Backed by syncs of both kinds%';
  IF n <> 1 THEN RAISE EXCEPTION 'a non-sensor mixed TSP warns once; got %', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%boolean property saying which%';
  IF n <> 0 THEN RAISE EXCEPTION 'the api publishes a working fallback, so it must not block; got %', n; END IF;

  -- The SAME configuration on a sensor object type blocks, because the sensor
  -- page says the boolean must be selected.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M787Root', 'Root') RETURNING id INTO root;
  UPDATE public.object_types SET is_sensor = true WHERE id = ot;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, ot, root, 'm787-root', 'Root', 'many_to_one', 'foreign_key', 'pk')
  RETURNING id INTO lk;
  INSERT INTO public.object_type_sensor_links (object_type_id, link_type_id, sensor_name_property_id)
  VALUES (ot, lk, pk);

  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%boolean property saying which%';
  IF n <> 1 THEN RAISE EXCEPTION 'a sensor object type must name the boolean; got %', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.object_type = 'M787Thing' AND w.problem LIKE 'Backed by syncs of both kinds%';
  IF n <> 0 THEN RAISE EXCEPTION 'the sensor case blocks instead of warning; got % warning(s)', n; END IF;

  -- and naming the boolean clears it
  UPDATE public.object_type_properties
     SET time_series_is_non_numeric_property_id = flagp WHERE id = tsp;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%boolean property saying which%';
  IF n <> 0 THEN RAISE EXCEPTION 'naming the boolean clears the finding; got %', n; END IF;

  -- A SINGLE-kind multi-sync TSP is not mixed and must not be reported at all.
  UPDATE public.object_type_properties
     SET time_series_is_non_numeric_property_id = NULL WHERE id = tsp;
  UPDATE public.time_series_syncs SET input_dataset_id = nds WHERE id = catsync;
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M787Thing' AND v.problem LIKE '%boolean property saying which%';
  IF n <> 0 THEN RAISE EXCEPTION 'two syncs of ONE kind are not mixed; got %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0787', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0787' THEN
  NULL;
END $$;
