-- 749 — a fetchOne names its key.
--
-- Found by the isolate production demo, run 2: the guest's
-- `client(Type).fetchOne(pk)` sends `{objectType, primaryKey}` to the host,
-- and the host mediator built filters from `where` alone and took LIMIT 1 —
-- the primary key was never read. Every fetchOne returned the FIRST object of
-- the type, whatever key the author passed; the demo's read only looked right
-- because its target happened to be the first row. The api's own definition
-- of the operation:
--
--   "Gets a specific object with the given primary key."
--   — api/ontologies-v2-resources-ontology-objects-get-object.md
--
-- The engine is where a key lookup belongs — the SQL knows which property is
-- the primary key; the mediator does not. `evaluate_object_set_by_api_name`
-- gains `p_primary_key text DEFAULT NULL`: named, it appends an exact-match
-- filter on the primary-key property before delegating; NULL keeps the
-- signature a superset of every existing call. The mediator's half — passing
-- `payload.primaryKey` through and refusing a fetchOne without one — ships
-- beside this in supabase/functions/_shared/ontology.ts.
--
-- The old signature is DROPPED, not overloaded; grants are re-issued minus
-- PUBLIC.

DO $patch$
DECLARE src text; n int;
  anchor text := '  RETURN QUERY SELECT * FROM public.evaluate_object_set(t, p_filters, ''[]''::jsonb, p_limit, 0);';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'evaluate_object_set_by_api_name';

  n := position(')' || chr(10) || ' RETURNS' IN src);
  IF n = 0 THEN RAISE EXCEPTION 'the CREATE line shape moved'; END IF;
  src := left(src, n - 1) || ', p_primary_key text DEFAULT NULL' || substr(src, n);

  n := position(anchor IN src);
  IF n = 0 THEN RAISE EXCEPTION 'the delegation anchor moved'; END IF;
  src := left(src, n - 1) ||
$a$  -- "Gets a specific object with the given primary key" — the key becomes an
  -- exact-match filter on the primary-key property (749).
  IF p_primary_key IS NOT NULL THEN
    SELECT p_filters || jsonb_build_array(jsonb_build_object(
      'type', 'propertyFilter',
      'propertyType', p.property_id,
      'value', jsonb_build_object('type', 'valuesFilter',
                                  'values', jsonb_build_array(p_primary_key))))
      INTO p_filters
      FROM public.object_type_properties p
     WHERE p.object_type_id = t AND p.is_primary_key;
  END IF;
$a$ || substr(src, n);

  DROP FUNCTION public.evaluate_object_set_by_api_name(uuid, text, jsonb, integer);
  EXECUTE src;
END $patch$;

REVOKE ALL ON FUNCTION public.evaluate_object_set_by_api_name(uuid, text, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_object_set_by_api_name(uuid, text, jsonb, integer, text) TO authenticated, service_role;

-- ── PROVED BY DOING — the key names the SECOND object, not the first ────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; t uuid; b uuid; st text; err text; row_out jsonb; n int; dsrc uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m749 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm749-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm749-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M749 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm749p', 'm749 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm749ds', 'm749ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"label","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, label) VALUES ($1, ''A'', ''first''), ($1, ''B'', ''second'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M749Thing', 'M749 thing') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (t, 'label', 'Label', 'label', 'string', 'column', 'label', dsrc);
  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'no index to fetch from: %', coalesce(err, '?'); END IF;

  -- The key finds B — the run-2 bug returned A for every key.
  SELECT e INTO row_out
    FROM public.evaluate_object_set_by_api_name(ont, 'M749Thing', '[]'::jsonb, 1, 'B') e;
  IF row_out->>'label' IS DISTINCT FROM 'second' THEN
    RAISE EXCEPTION 'fetch by key returned %', row_out;
  END IF;

  -- NULL keeps the old meaning: no key filter, both rows.
  SELECT count(*) INTO n
    FROM public.evaluate_object_set_by_api_name(ont, 'M749Thing') e;
  IF n <> 2 THEN RAISE EXCEPTION 'the keyless call stopped listing (% rows)', n; END IF;

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
