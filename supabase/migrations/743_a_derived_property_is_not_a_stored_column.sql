-- 743 — a derived property is not a stored column.
--
-- `index_object_type` builds the index table with one column per property —
-- ALL properties, while the gather step only ever fills the column-backed
-- ones. A derived property is the third source —
--
--   "Linked objects: Use a property from another object type"
--   — object-link-types/images/media-reference-source.png
--
-- and it became a real, typed, permanently-NULL column that
-- `evaluate_object_set` then returned as if it were data. The value of a
-- derived property is computed from the link chain at read time; nothing can
-- ever populate a stored cell for it, so the cell is a false claim.
--
-- Latent rather than live — zero derived properties exist — which is why
-- sixteen platform cases stayed green over it. The fix deletes a wrong claim
-- rather than adding a mechanism: the DDL takes the same predicate the gather
-- already has. The row insert is `jsonb_populate_record`, which is
-- column-driven, so it needs no matching change.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'index_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'columns anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$      FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type
       -- A derived property is computed from its link chain at read time;
       -- a stored cell for it can only ever be NULL, and a NULL column is a
       -- false claim (743).
       AND p.source <> 'linked_objects';$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the derived column is not there, and the build lands ──

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; t uuid; b uuid; st text; err text; n int; itbl text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m743 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm743-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm743-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M743 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm743p', 'm743 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm743ds', 'm743ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1, ''R1'')', phys) USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M743Thing', 'M743 thing') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation)
  VALUES (t, 'cnt', 'Count', 'cnt', 'integer', 'linked_objects', 'count');

  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN
    RAISE EXCEPTION 'the build did not land: %', coalesce(err, '(no error)');
  END IF;

  SELECT x.index_table INTO itbl FROM public.object_type_indexes x WHERE x.object_type_id = t;
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'objects' AND table_name = itbl AND column_name = 'cnt';
  IF n <> 0 THEN RAISE EXCEPTION 'the derived property became a stored column'; END IF;
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'objects' AND table_name = itbl AND column_name = 'pk';
  IF n <> 1 THEN RAISE EXCEPTION 'the column-backed property is missing'; END IF;

  EXECUTE format('DROP TABLE IF EXISTS objects.%I', itbl);
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
