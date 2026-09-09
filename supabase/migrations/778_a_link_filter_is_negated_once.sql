-- A link filter is negated once.
--
-- 776 gave a link filter two forms — the flat `value` that generate-urls.md
-- prints and saved explorations hold, and the nested `filters` list — and left
-- both negations running. `object_set_filters_valid` branches on
-- `IF e ? 'filters'` and never inspects `value`, so a filter carrying BOTH is
-- ACCEPTED; `object_set_where` then applies the nested `far_neg` and, on the
-- very next statement, the flat `v->>'matchType'`. The result is `NOT NOT cond`
-- — a caller who asked twice for "has no link" is told which objects HAVE one.
--
-- Latent, because the web sends one form or the other and nothing yet writes
-- both. Reachable, because the validator is the CHECK on `object_sets.filters`
-- and it says such a filter is well-formed, so a saved exploration can carry it.
--
-- The fix is the precedence the validator already implies: when `filters` is
-- present it is the filter, and `value` is not consulted. One condition, on the
-- line 776 spliced past.
--
-- Found by a reader sent to reconcile the THIRD link filter kind, which is not
-- built here — the same pass that found this. Recorded because it is the second
-- defect this session that came out of a reconcile aimed somewhere else, after
-- the far-side leak 771 closed.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.object_set_where(uuid,jsonb)'::regprocedure), chr(13), '');

  a := 'IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 3 THEN
    RAISE EXCEPTION 'expected the flat negation once per backing arm, found %', n;
  END IF;

  EXECUTE replace(src, a,
    'IF e->''filters'' IS NULL AND v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;');
END $mig$;

COMMENT ON FUNCTION public.object_set_where(uuid, jsonb) IS
  'The WHERE every object-set reader shares. Property filters bind to the subject alias "o"; a link filter compiles to an EXISTS over the far index aliased "x", carrying the FAR type''s own row-level policy (771) and, since 776, the far predicates of its nested filter list. A link filter carries either the flat presenceFilter value or the nested list — never both at once, and since 778 the nested one wins rather than negating twice.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied, which 774 and 776 both failed to do.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; tbl text;
  ds2 uuid; br2 uuid; txn2 uuid; file2 uuid; tbl2 text;
  ta uuid; tb uuid; lk uuid; build uuid; job_state text; w text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m778 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm778-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm778-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M778 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm778p', 'm778 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm778_rows', 'Rows') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"other","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 3) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO tbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, other) VALUES ($1,''A1'',''B1''),($1,''A2'',''B1''),($1,''A3'',null)', tbl)
    USING file;

  -- B needs its own dataset: one datasource backs one object type.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm778_bs', 'Bs') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO txn2;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds2, txn2, '[{"name":"other","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds2, txn2, 'bs.parquet', 1) RETURNING id INTO file2;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn2;
  SELECT public.dataset_materialize(ds2, txn2) INTO tbl2;
  EXECUTE format('INSERT INTO datasets.%I (_file, other) VALUES ($1,''B1'')', tbl2) USING file2;

  -- Two types joined by a foreign key: A3 names nobody.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M778B', 'B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (tb, ds2, br2);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (tb, 'other', 'Other', 'other', 'string', 'column', 'other', true, true, true);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M778A', 'A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ta, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (ta, 'other', 'Other', 'other', 'string', 'column', 'other',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ta));

  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, ta, tb, 'm778-to-b', 'B', 'many_to_one', 'foreign_key', 'other')
  RETURNING id INTO lk;

  SELECT public.run_index_build(ARRAY[ta, tb]::uuid[], true) INTO build;
  SELECT string_agg(coalesce(b.error, b.state), ' | ') INTO job_state
    FROM public.build_jobs b WHERE b.build_id = build AND b.state <> 'COMPLETED';
  IF job_state IS NOT NULL THEN RAISE EXCEPTION 'the index build should complete: %', job_state; END IF;

  -- A1 and A2 name B1; A3 names nobody.
  w := public.object_set_where(ta, '[{"type":"linkFilter","linkType":"m778-to-b",
        "value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ta), w) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'two rows name a B; got %', n; END IF;

  -- THE DEFECT: both forms at once. The validator says it is well-formed, so
  -- the engine must not double-negate it — the nested list wins.
  IF NOT public.object_set_filters_valid('[{"type":"linkFilter","linkType":"m778-to-b",
       "filters":[{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}],
       "value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]'::jsonb) THEN
    RAISE EXCEPTION 'the validator has always accepted both forms; this proof rests on that';
  END IF;

  w := public.object_set_where(ta, '[{"type":"linkFilter","linkType":"m778-to-b",
        "filters":[{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}],
        "value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]'::jsonb);
  IF (length(w) - length(replace(w, 'NOT EXISTS', ''))) / length('NOT EXISTS') <> 1
     OR w LIKE '%NOT NOT%' THEN
    RAISE EXCEPTION 'a link filter is negated once, got: %', w;
  END IF;
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ta), w) INTO n;
  IF n <> 1 THEN
    RAISE EXCEPTION 'only A3 names no B — before 778 this returned the two that do; got %', n;
  END IF;

  -- and each form alone still means what it meant
  w := public.object_set_where(ta, '[{"type":"linkFilter","linkType":"m778-to-b",
        "filters":[{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}]}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ta), w) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the nested form alone still negates once; got %', n; END IF;

  w := public.object_set_where(ta, '[{"type":"linkFilter","linkType":"m778-to-b",
        "value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ta), w) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the flat form alone is untouched; got %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0778', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0778' THEN
  NULL;
END $$;
