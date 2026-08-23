-- The KNN read path has never executed, and executing it found three defects.
--
--   "KNN is only supported on object types indexed into OSv2."
--   — functions/api-object-sets.md
--
--   "Vectors can only be queried by KNN."
--   — object-link-types/property-metadata.md
--
-- 581 built `object_type_nearest` and 583 rebuilt it for the api's shape. Both
-- probes called it — and both calls exited on an early guard
-- (SimilarityFunctionNotSupported, then ObjectTypeNotIndexed), so the query at
-- the bottom never ran. A test can pass against the wrong guard. What the
-- happy path finds, in the order it fails:
--
-- 1. `public.object_table_name` and `public.object_primary_key_column` DO NOT
--    EXIST. Both versions of the function call them; no migration ever created
--    them. plpgsql resolves at execution, so every static check stayed green —
--    the auth_org_id() failure class, live since 581.
-- 2. The 4-arg overload from 581 survived 583, whose 5-arg replacement has a
--    DEFAULT — so every 4-arg call is ambiguous ("function is not unique") and
--    BOTH versions were unreachable at that arity.
-- 3. The query reads the index table through `prop.backing_column` — the
--    DATASET's column name. The indexer names physical columns by property_id.
--    583's probe used the same string for both, which hid it.
--
-- The repairs, one per defect. `object_table_name` reads the
-- `object_type_indexes.index_table` pointer rather than re-encoding the naming
-- rule — every other reader resolves through that pointer, and one source
-- means 644's staging swap cannot strand it. `object_primary_key_column` is
-- the property_id of the primary key, because that is the column name the
-- indexer writes. The query gains one cast: a vector lands in the index as
-- jsonb (property_column_type says so), and `#>> '{}'` unwraps it to the text
-- pgvector parses.
--
-- The probe below does what 581 and 583 did not: it builds a real vector-typed
-- object type through the real pipeline — datasource, edits carrying the
-- embeddings, run_index_build — and executes the KNN query to its result rows.

CREATE FUNCTION public.object_primary_key_column(p_object_type uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT pr.property_id FROM public.object_type_properties pr
   WHERE pr.object_type_id = p_object_type AND pr.is_primary_key
$$;

COMMENT ON FUNCTION public.object_primary_key_column(uuid) IS
  'The property_id of the primary key — which is the physical column name in the index table, because index_object_type names every column by property_id.';

CREATE FUNCTION public.object_table_name(p_object_type uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE t text;
BEGIN
  SELECT i.index_table INTO t FROM public.object_type_indexes i
   WHERE i.object_type_id = p_object_type;
  IF t IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotIndexed — KNN is only supported on an indexed object type';
  END IF;
  RETURN t;
END $$;

COMMENT ON FUNCTION public.object_table_name(uuid) IS
  'The physical index table, read from the object_type_indexes.index_table pointer — the one source every index reader resolves through, never a second encoding of the naming rule.';

-- 583's function has a DEFAULT for its fifth argument, so 581's four-argument
-- version made every four-argument call ambiguous. 583 replaced it and should
-- have dropped it.
DROP FUNCTION public.object_type_nearest(uuid, text, real[], integer);

-- Patch the live definition, never retype it: three single-line anchors, and
-- a refusal if any of them moved.
DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.object_type_nearest(uuid,text,real[],integer,text)'::regprocedure);
  IF position($a$(%I %s $1::vector)$a$ in src) = 0
     OR position('prop.backing_column, op,' in src) = 0
     OR position('tbl, prop.backing_column)' in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: object_type_nearest is not the text 643 read';
  END IF;
  -- the stored value is jsonb; unwrap it to the text pgvector parses
  src := replace(src, $a$(%I %s $1::vector)$a$, $b$((%I #>> ''{}'')::vector %s $1::vector)$b$);
  -- the index table's columns are named by property_id, not the dataset's column
  src := replace(src, 'prop.backing_column, op,', 'prop.property_id, op,');
  src := replace(src, 'tbl, prop.backing_column)', 'tbl, prop.property_id)');
  EXECUTE src;
END $$;

-- The whole path, executed: a vector property through the real pipeline, and
-- the query down to its rows. Self-contained, rolled back at the end.
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid; v_email text;
  v_ds uuid; v_br uuid; v_txn uuid; v_file uuid; v_phys text;
  v_type uuid; v_dsid uuid; v_vprop uuid; v_build uuid;
  v_state text; v_err text; v_tbl text;
  v_keys text[]; v_n int; v_d1 double precision; v_d2 double precision;
  v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe643') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe643') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe643', 'Probe643') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe643', 'Probe643', false) RETURNING id INTO v_ont;

    v_usr := gen_random_uuid();
    v_email := 'probe643-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- A datasource with two rows: the pk comes from the dataset, the
    -- embedding arrives as a user edit — object_state's modify path.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe643', 'Probe643 DS') RETURNING id INTO v_ds;
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

    SELECT public.save_object_type(
      jsonb_build_object('api_name', 'Probe643', 'label', 'Probe 643', 'ontology_id', v_ont,
        'datasources', jsonb_build_array(jsonb_build_object('dataset_id', v_ds, 'branch_id', v_br))),
      jsonb_build_array(jsonb_build_object(
        'property_id', 'pk', 'display_name', 'Id', 'api_name', 'pk', 'base_type', 'string',
        'source', 'column', 'backing_column', 'pk',
        'is_primary_key', true, 'is_title_key', true, 'required', true)))
      INTO v_type;
    -- save_object_type stages; the live rows land on the save
    PERFORM public.save_working_state();
    SELECT d.id INTO v_dsid FROM public.object_type_datasources d WHERE d.object_type_id = v_type;

    -- user_input: no backing column, so the gather skips it and the edit log
    -- is its only writer — which is what this shape is for.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, datasource_id,
       vector_dimension, vector_distance_function, vector_embedding_kind, vector_embedding_model,
       searchable, sortable, selectable)
      VALUES (v_type, 'embedding', 'embedding', 'Embedding', 'vector', 'user_input', v_dsid,
              2, 'cosine_similarity', 'lms', 'openai_text_embedding_ada_002',
              false, false, false)
      RETURNING id INTO v_vprop;
    INSERT INTO public.object_type_vector_searches (property_id, similarity_function)
      VALUES (v_vprop, 'cosine_similarity');

    -- the guard's own hint: 'turn off "Only allow edits via actions"'
    UPDATE public.object_types SET only_edits_via_actions = false WHERE id = v_type;
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
      VALUES (v_type, 'A', 'modify', '{"embedding": [1, 0]}'),
             (v_type, 'B', 'modify', '{"embedding": [0, 1]}');

    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the index build did not complete: % — %', v_state, v_err;
    END IF;

    -- both helpers, executed against what the build wrote
    SELECT i.index_table INTO v_tbl FROM public.object_type_indexes i
     WHERE i.object_type_id = v_type;
    IF public.object_table_name(v_type) IS DISTINCT FROM v_tbl THEN
      RAISE EXCEPTION 'object_table_name does not read the pointer';
    END IF;
    IF public.object_primary_key_column(v_type) <> 'pk' THEN
      RAISE EXCEPTION 'object_primary_key_column is not the pk property_id';
    END IF;

    -- the query itself, to its rows: nearest to [1,0] is A at distance 0,
    -- then B at distance 1
    SELECT array_agg(nk.object_key ORDER BY nk.distance), count(*),
           min(nk.distance), max(nk.distance)
      INTO v_keys, v_n, v_d1, v_d2
      FROM public.object_type_nearest(v_type, 'embedding', ARRAY[1,0]::real[], 2,
                                      'cosine_similarity') nk;
    IF v_n <> 2 OR v_keys[1] <> 'A' OR v_keys[2] <> 'B' THEN
      RAISE EXCEPTION 'KNN returned % row(s) ordered %, expected A then B', v_n, v_keys;
    END IF;
    IF v_d1 > 0.001 OR v_d2 < 0.9 THEN
      RAISE EXCEPTION 'cosine distances % and % are not the expected 0 and 1', v_d1, v_d2;
    END IF;

    -- the arity 581 left ambiguous now resolves through the DEFAULT
    SELECT count(*) INTO v_n
      FROM public.object_type_nearest(v_type, 'embedding', ARRAY[1,0]::real[], 1);
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the four-argument call did not resolve';
    END IF;

    -- and the contrast: an unindexed type still refuses, from the new helper
    v_ok := false;
    BEGIN
      PERFORM public.object_table_name(gen_random_uuid());
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ObjectTypeNotIndexed%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'an unindexed type was given a table name';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '643 proved: the KNN query executed to its rows for the first time — A then B by cosine distance, the four-argument arity resolves, and an unindexed type still refuses';
  END;
END $$;
