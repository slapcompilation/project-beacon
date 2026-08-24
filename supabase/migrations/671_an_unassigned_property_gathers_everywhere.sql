-- 670 scoped the indexer's column gather to each datasource's own properties
-- — necessary for multi-datasource types — and the platform suite caught the
-- collateral within the hour: properties that name NO datasource (the
-- fixtures', and any legacy single-datasource shape) stopped gathering at
-- all, so the primary key itself went missing. An unassigned property
-- belongs to every datasource, which is exactly what the single-datasource
-- world always meant. Corrected forward, because the applied 670 cannot be
-- edited.

DO $do$
DECLARE src text; a text; i int;
BEGIN
  src := replace(pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure), chr(13), '');
  a := 'AND p.datasource_id = ds.otds_id;';
  i := position(a in src);
  IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
    RAISE EXCEPTION 'an anchor moved or repeats: index_object_type is not the text 671 read';
  END IF;
  src := replace(src, a,
    'AND (p.datasource_id = ds.otds_id OR p.datasource_id IS NULL);');
  EXECUTE src;
END $do$;

-- Proved by doing: a type whose properties name no datasource indexes again.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid;
  v_ds uuid; v_br uuid; v_txn uuid; v_file uuid; v_phys text; v_ot uuid;
  v_dsid uuid; v_build uuid; v_state text; v_err text; v_n bigint;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe671') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe671') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe671', 'Probe671') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe671', 'Probe 671', false) RETURNING id INTO v_ont;
    v_usr := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe671-' || v_usr || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, 'probe671-' || v_usr || '@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe671', 'Probe671') RETURNING id INTO v_ds;
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
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''A''), ($1, ''B'')', v_phys)
      USING v_file;

    INSERT INTO public.object_types (ontology_id, api_name, label)
      VALUES (v_ont, 'Probe671', 'Probe 671') RETURNING id INTO v_ot;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_dsid;
    -- the legacy shape: no datasource named on the property
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required)
      VALUES (v_ot, 'pk', 'pk', 'Id', 'string', 'column', 'pk', true, true, true);

    SELECT public.run_index_build(ARRAY[v_ot], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the unassigned-property type should index, got % / %', v_state, v_err;
    END IF;
    SELECT object_count INTO v_n FROM public.object_type_indexes WHERE object_type_id = v_ot;
    IF v_n IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'both rows should index, got %', v_n;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '671 proved: a property that names no datasource gathers from every datasource again, and the two rows index';
  END;
END $$;
