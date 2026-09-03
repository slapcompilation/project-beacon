-- 744 — deleting a type removes its storage.
--
-- The Cleanup page's own description of the delete workflow:
--
--   "Delete object types from the Ontology and remove associated data from
--    object storage."
--   — ontology-manager/cleanup.md
--
-- Ours did the first half. `deleteObjectType` is a plain row delete, every
-- orchestration foreign key cascades — and the one thing with no foreign key,
-- the physical index table `objects.ot_<uuid>`, survived as an orphan holding
-- the deleted type's data. Only `index_object_type` ever drops one, and it
-- only runs for types that exist.
--
-- The rung is a trigger: the fact spans a DDL side effect no CHECK can carry,
-- and it must run whenever a row goes, however it goes — the page's Cleanup
-- flow, the OMA's delete button, a cascade from a project. AFTER DELETE, so a
-- refusal elsewhere (the lifecycle guard, a foreign key) keeps the storage
-- exactly as it keeps the row.

CREATE FUNCTION public.drop_object_type_storage()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE tbl text := 'ot_' || replace(OLD.id::text, '-', '');
BEGIN
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
  -- A build interrupted between stage and rename leaves the staging half.
  EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl || '__next');
  RETURN OLD;
END $fn$;

COMMENT ON FUNCTION public.drop_object_type_storage() IS
  'Delete object types from the Ontology and remove associated data from object storage (cleanup) — the second half. The orchestration rows cascade by foreign key; the physical objects.ot_ table has none, so the trigger carries it. 744.';

CREATE TRIGGER drop_object_type_storage
  AFTER DELETE ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.drop_object_type_storage();

-- ── PROVED BY DOING — the delete takes the table with it ────────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; t uuid; b uuid; st text; err text; itbl text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m744 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm744-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm744-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M744 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm744p', 'm744 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm744ds', 'm744ds') RETURNING id INTO ds;
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
  VALUES (ont, proj, 'M744Thing', 'M744 thing') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);

  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'no index to delete: %', coalesce(err, '?'); END IF;
  SELECT x.index_table INTO itbl FROM public.object_type_indexes x WHERE x.object_type_id = t;
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'objects' AND table_name = itbl;
  IF n <> 1 THEN RAISE EXCEPTION 'the index table never existed'; END IF;

  -- The web's own delete: one row, everything else follows.
  DELETE FROM public.object_types WHERE id = t;
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'objects' AND table_name = itbl;
  IF n <> 0 THEN RAISE EXCEPTION 'the storage survived the delete'; END IF;

  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
