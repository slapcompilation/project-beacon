-- A rebuild becomes a replacement pipeline: build beside, then swap.
--
--   "While the live pipeline continues to run on its usual cadence, Funnel will orchestrate a replacement pipeline in the background without impacting the live data being served to users."
--   — object-indexing/funnel-batch-pipelines.md
--
--   "After the replacement pipeline successfully runs for the first time, the live pipeline will be discarded and replaced by the replacement pipeline; the object type’s schema and data will be updated accordingly."
--   — object-indexing/funnel-batch-pipelines.md
--
-- Ours did the opposite: `index_object_type` DROPPED the live table before the
-- row loop began, so the type went dark for the whole rebuild and stayed dark
-- forever if the build failed — the exact impact the page rules out. The
-- recorded residual of the index arc (DELIVERABLE-MAP, Known gaps).
--
-- The patch keeps every reader working by changing nothing they see: the build
-- writes `objects.<tbl>__next`, and only after the last row lands does the
-- swap run — drop the old live table, rename the staging table into its name.
-- The `object_type_indexes.index_table` pointer never changes value, and 643's
-- `object_table_name` reads that pointer, so no resolver needs to know a swap
-- happened. The primary-key constraint is renamed with the table because index
-- names are schema-global — left as `<tbl>__next_pkey`, the NEXT replacement's
-- auto-named primary key would collide with it.
--
-- A failed build now leaves the previous index serving. The staging table a
-- failure leaves behind (if its transaction ever commits) is dropped by the
-- next replacement's opening DROP IF EXISTS.
--
-- Three single-line anchors on the live definition, a refusal if any moved,
-- and nothing else retyped.

DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure);
  IF position($a$EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);$a$ in src) = 0
     OR position($a$EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);$a$ in src) = 0
     OR position('tbl, tbl) USING merged.properties;' in src) = 0
     OR position('DROP TABLE _staged;' in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: index_object_type is not the text 644 read';
  END IF;

  -- the build region targets the staging table; the live one is not touched
  src := replace(src,
    $a$EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);$a$,
    $b$EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl || '__next');$b$);
  src := replace(src,
    $a$EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);$a$,
    $b$EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl || '__next', cols, pk_prop);$b$);
  src := replace(src,
    'tbl, tbl) USING merged.properties;',
    $b$tbl || '__next', tbl || '__next') USING merged.properties;$b$);

  -- the swap, after the last row landed: the live table is discarded and
  -- replaced only once the replacement has fully built
  src := replace(src,
    'DROP TABLE _staged;',
    $b$DROP TABLE _staged;

    EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
    EXECUTE format('ALTER TABLE objects.%I RENAME TO %I', tbl || '__next', tbl);
    -- index names are schema-global: renamed with the table, or the next
    -- replacement's auto-named primary key collides
    EXECUTE format('ALTER TABLE objects.%I RENAME CONSTRAINT %I TO %I',
                   tbl, tbl || '__next_pkey', tbl || '_pkey');$b$);
  EXECUTE src;
END $$;

-- Executed both ways on 643's proven fixture: a schema change rebuilds into
-- the same physical name with the new column and no staging debris, and a
-- build broken by a duplicate primary key leaves the previous index serving.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid; v_email text;
  v_ds uuid; v_br uuid; v_txn uuid; v_file uuid; v_phys text;
  v_type uuid; v_dsid uuid; v_build uuid;
  v_state text; v_err text; v_tbl text; v_tbl2 text;
  v_n int; v_cols int; v_head uuid;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe644') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe644') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe644', 'Probe644') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe644', 'Probe644', false) RETURNING id INTO v_ont;

    v_usr := gen_random_uuid();
    v_email := 'probe644-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe644', 'Probe644 DS') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_br, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 2) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    v_head := v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''A''), ($1, ''B'')', v_phys)
      USING v_file;

    SELECT public.save_object_type(
      jsonb_build_object('api_name', 'Probe644', 'label', 'Probe 644', 'ontology_id', v_ont,
        'datasources', jsonb_build_array(jsonb_build_object('dataset_id', v_ds, 'branch_id', v_br))),
      jsonb_build_array(jsonb_build_object(
        'property_id', 'pk', 'display_name', 'Id', 'api_name', 'pk', 'base_type', 'string',
        'source', 'column', 'backing_column', 'pk',
        'is_primary_key', true, 'is_title_key', true, 'required', true)))
      INTO v_type;
    PERFORM public.save_working_state();
    SELECT d.id INTO v_dsid FROM public.object_type_datasources d WHERE d.object_type_id = v_type;

    -- first build: the swap path also serves the from-nothing case
    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the first build did not complete: % — %', v_state, v_err;
    END IF;
    SELECT i.index_table INTO v_tbl FROM public.object_type_indexes i
     WHERE i.object_type_id = v_type;
    IF to_regclass('objects.' || v_tbl) IS NULL THEN
      RAISE EXCEPTION 'the live table does not exist after the first build';
    END IF;
    IF to_regclass('objects.' || v_tbl || '__next') IS NOT NULL THEN
      RAISE EXCEPTION 'staging debris survived a successful build';
    END IF;

    -- the page's own example of a schema change: "adding a new property type
    -- to an object type" — then the replacement builds beside and swaps
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, datasource_id,
       searchable, sortable, selectable)
      VALUES (v_type, 'note', 'note', 'Note', 'string', 'user_input', v_dsid,
              false, false, false);
    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the replacement build did not complete: % — %', v_state, v_err;
    END IF;
    SELECT i.index_table INTO v_tbl2 FROM public.object_type_indexes i
     WHERE i.object_type_id = v_type;
    IF v_tbl2 IS DISTINCT FROM v_tbl THEN
      RAISE EXCEPTION 'the physical name moved across a replacement: % then %', v_tbl, v_tbl2;
    END IF;
    SELECT count(*) INTO v_cols FROM information_schema.columns
     WHERE table_schema = 'objects' AND table_name = v_tbl AND column_name = 'note';
    IF v_cols <> 1 THEN
      RAISE EXCEPTION 'the schema change did not reach the replaced index';
    END IF;
    EXECUTE format('SELECT count(*) FROM objects.%I', v_tbl) INTO v_n;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'the replaced index holds % row(s), expected 2', v_n;
    END IF;
    -- the constraint rename kept the next staging name free
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'objects' AND tablename = v_tbl
                      AND indexname = v_tbl || '_pkey') THEN
      RAISE EXCEPTION 'the primary key index did not take the live name';
    END IF;

    -- a build broken mid-loop leaves the previous index serving: an APPEND
    -- transaction whose file repeats a primary key
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
      VALUES (v_ds, v_br, 'APPEND', v_head) RETURNING id INTO v_txn;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'dup.parquet', 1) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''A'')', v_phys)
      USING v_file;

    BEGIN
      SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
      SELECT bj.state, bj.error INTO v_state, v_err
        FROM public.build_jobs bj WHERE bj.build_id = v_build;
      -- the failure may surface as a recorded FAILED job or as a raise;
      -- either way it must be the duplicate, nothing else
      IF v_state = 'COMPLETED' THEN
        RAISE EXCEPTION 'BAD: a duplicate primary key indexed cleanly';
      END IF;
      IF coalesce(v_err, '') !~ 'non-unique primary keys' THEN
        RAISE EXCEPTION 'BAD: the build failed for the wrong reason: %', v_err;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm ~ '^BAD: ' OR sqlerrm !~ 'non-unique primary keys' THEN RAISE; END IF;
    END;

    IF to_regclass('objects.' || v_tbl) IS NULL THEN
      RAISE EXCEPTION 'the failed replacement took the live index down';
    END IF;
    EXECUTE format('SELECT count(*) FROM objects.%I', v_tbl) INTO v_n;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'the live index no longer serves its 2 rows after a failed replacement';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '644 proved: a schema change rebuilt into the same name with the new column and no debris, and a broken build left the previous index serving';
  END;
END $$;
