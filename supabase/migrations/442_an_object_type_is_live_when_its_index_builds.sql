-- E2: an object type is not live when it is saved. It is live when its index
-- builds.
--
--   "Only once this indexing pipeline completes successfully will you be able
--    to see your new objects in Object Explorer and other Foundry
--    applications. Once it's done, you can refresh the page to see an object
--    count in top left of your screen: 183,999 objects."   (deep-dive, lesson 1)
--
--   "In the Ontology, indexing is the process of making tabular or other forms
--    of data in Foundry datasources available for faster data retrieval
--    operations through specialized databases."   (object-indexing/overview)
--
-- Foundry's Funnel batch pipeline is four jobs (funnel-batch-pipelines):
-- Changelog ("computes the data difference"), Merge changes ("all changelog
-- datasets… and any recent user edits coming from Actions are joined by the
-- object type's primary key"), Indexing, Hydration. Ours collapses to the one
-- job Postgres can do honestly: read the datasource's current view, merge the
-- edit log through object_state() (E1's replay), and write a real table with
-- real columns per property — never a jsonb heap, which is the three-times
-- mistake.
--
--   "These merged datasets are owned and controlled by Funnel, and thus are
--    not accessible to users."
--
-- So the `objects` schema takes no grants; reads go through functions that
-- check ontology visibility.
--
-- The status vocabulary is the page's, exactly:
--
--   "Index status: The status of the last reindex of the object type and its
--    backing datasources. It can be `success`, `failed`, or `not started`."
--                                       (object-link-types/object-type-metadata)
--
-- No 'running': the build is synchronous here, so the spinner is the pending
-- call, not a stored state. A failure is recorded, not raised — the save
-- already succeeded, and Foundry shows failures as job details ("If Foundry
-- encounters any issues — such as non-unique primary keys — you'll be able to
-- get to detailed job details and error messages from here").
--
-- ── RECORDED, NOT BUILT ────────────────────────────────────────────────────
-- Incremental indexing ("the default threshold is set to 80%"), the six-hourly
-- live pipeline for edits, streaming pipelines, hydration as a separate step,
-- and branch-aware index status. Every build here is a full reindex — the
-- documented special case "When user triggers a full reindex through Ontology
-- Manager" — and staleness marks are the replacement-pipeline trigger:
-- "Schema changes can include adding a new property type to an object type,
-- changing an existing property type, or replacing the input datasource".

CREATE SCHEMA IF NOT EXISTS objects;
REVOKE ALL ON SCHEMA objects FROM PUBLIC;

-- ── the ledger the spinner reads ───────────────────────────────────────────
CREATE TABLE public.object_type_indexes (
  object_type_id uuid PRIMARY KEY REFERENCES public.object_types(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'not started'
                   CHECK (status IN ('not started','success','failed')),
  -- The job details a failure points at.
  error          text,
  object_count   bigint,
  index_table    text,
  indexed_at     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.object_type_indexes IS
  'The status of the last reindex of each object type — success, failed, or not started. An absent row means the type has never been indexed, which is also not started.';

ALTER TABLE public.object_type_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read index status of visible object types" ON public.object_type_indexes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_indexes.object_type_id
       AND public.auth_in_ontology(t.ontology_id)));

-- No write grants: only the indexer writes, as definer.
GRANT SELECT ON public.object_type_indexes TO authenticated;

-- ── property base type → column type ───────────────────────────────────────
-- Postgres stands in for OSv2, as it already stands in for Spark in
-- dataset_materialize(). The scalars map; everything structured stays jsonb.
CREATE OR REPLACE FUNCTION public.property_column_type(p_base_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_base_type
    WHEN 'string'    THEN 'text'
    WHEN 'boolean'   THEN 'boolean'
    WHEN 'byte'      THEN 'smallint'
    WHEN 'short'     THEN 'smallint'
    WHEN 'integer'   THEN 'integer'
    WHEN 'long'      THEN 'bigint'
    WHEN 'float'     THEN 'real'
    WHEN 'double'    THEN 'double precision'
    WHEN 'decimal'   THEN 'numeric'
    WHEN 'date'      THEN 'date'
    WHEN 'timestamp' THEN 'timestamptz'
    ELSE 'jsonb'
  END
$$;

-- ── marking stale: the replacement-pipeline trigger ────────────────────────
-- "When the schema of an object type changes and the previous pipeline's
--  schema is no longer up-to-date, a new replacement pipeline must be
--  provisioned" — ours records that as `not started` on a type that HAS been
-- indexed, so the surface can say the index no longer matches the definition.
CREATE OR REPLACE FUNCTION public.mark_index_stale()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only ever on object_types; the children have their own body, because a
  -- record's fields are resolved at plan time and untaken CASE branches plan too.
  UPDATE public.object_type_indexes
     SET status = 'not started', error = NULL, updated_at = now()
   WHERE object_type_id = NEW.id AND status <> 'not started';
  RETURN NULL;
END $$;

CREATE TRIGGER mark_index_stale AFTER UPDATE ON public.object_types
  FOR EACH ROW WHEN (NEW.version IS DISTINCT FROM OLD.version)
  EXECUTE FUNCTION public.mark_index_stale();
-- The properties trigger needs OLD on delete, so it gets its own body.
CREATE OR REPLACE FUNCTION public.mark_index_stale_properties()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.object_type_indexes
     SET status = 'not started', error = NULL, updated_at = now()
   WHERE object_type_id = coalesce(NEW.object_type_id, OLD.object_type_id)
     AND status <> 'not started';
  RETURN NULL;
END $$;

-- "Live pipelines run whenever their respective datasources are updated."
-- Ours marks; it does not build. Building on a timer is the line we do not cross.
CREATE OR REPLACE FUNCTION public.mark_index_stale_on_commit()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.object_type_indexes x
     SET status = 'not started', error = NULL, updated_at = now()
    FROM public.object_type_datasources d
   WHERE d.object_type_id = x.object_type_id
     AND d.dataset_id = NEW.dataset_id AND d.branch_id = NEW.branch_id
     AND x.status <> 'not started';
  RETURN NULL;
END $$;

CREATE TRIGGER mark_index_stale_on_commit
  AFTER UPDATE OF status ON public.dataset_transactions
  FOR EACH ROW WHEN (NEW.status = 'COMMITTED')
  EXECUTE FUNCTION public.mark_index_stale_on_commit();

-- ── the build ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.index_object_type(p_object_type uuid)
RETURNS public.object_type_indexes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ont      uuid;
  tbl      text := 'ot_' || replace(p_object_type::text, '-', '');
  cols     text;
  pk_prop  text;
  n        bigint := 0;
  ds       record;
  rows_sql text;
  merged   record;
  staged   record;
  bad      text;
  result   public.object_type_indexes;
BEGIN
  SELECT ontology_id INTO ont FROM public.object_types WHERE id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;

  INSERT INTO public.object_type_indexes (object_type_id)
  VALUES (p_object_type)
  ON CONFLICT (object_type_id) DO NOTHING;

  BEGIN
    -- Well-formedness first: an index of a type with no primary key is not a
    -- thing that can fail later; it is a thing that cannot start.
    SELECT string_agg(problem, '; ') INTO bad
      FROM public.ontology_violations() v
      JOIN public.object_types t ON t.api_name = v.object_type
     WHERE t.id = p_object_type;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION '%', bad;
    END IF;

    SELECT property_id INTO pk_prop FROM public.object_type_properties
     WHERE object_type_id = p_object_type AND is_primary_key;

    -- The staging area the merge-changes job writes: one row per primary key,
    -- keyed the way the edit log keys properties.
    CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb) ON COMMIT DROP;

    -- Changelog + gather, per datasource: the current view's rows only.
    FOR ds IN
      SELECT d.dataset_id, d.branch_id, ds2.physical_table
        FROM public.object_type_datasources d
        JOIN public.datasets ds2 ON ds2.id = d.dataset_id
       WHERE d.object_type_id = p_object_type AND ds2.physical_table IS NOT NULL
    LOOP
      -- Each physical row becomes jsonb keyed by property_id via its
      -- backing_column, which is the shape object_state() replays edits onto.
      SELECT string_agg(format('%L, r.%I', p.property_id, p.backing_column), ', ')
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type AND p.source = 'column'
         AND p.backing_column IS NOT NULL;
      CONTINUE WHEN cols IS NULL;

      rows_sql := format(
        'SELECT jsonb_build_object(%s) AS row FROM datasets.%I r
          WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
        cols, ds.physical_table, ds.branch_id);

      FOR merged IN EXECUTE rows_sql LOOP
        IF merged.row ->> pk_prop IS NULL THEN
          RAISE EXCEPTION 'a datasource row has no value in the primary key column';
        END IF;
        -- "You may not have duplicate primary keys" — the failure the deep
        -- dive names ("such as non-unique primary keys").
        BEGIN
          INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row);
        EXCEPTION WHEN unique_violation THEN
          RAISE EXCEPTION 'non-unique primary keys: "%" appears more than once in the backing datasources',
            merged.row ->> pk_prop;
        END;
      END LOOP;
    END LOOP;

    -- "it is possible for users to create additional objects that do not exist
    --  in the backing datasource" — edit-only objects join the merge by pk.
    INSERT INTO _staged
    SELECT DISTINCT e.primary_key, NULL::jsonb
      FROM public.object_edits e
     WHERE e.object_type_id = p_object_type
    ON CONFLICT (pk) DO NOTHING;

    -- The index dataset: a real table, real columns, one per property.
    SELECT string_agg(format('%I %s', p.property_id, public.property_column_type(p.base_type)),
                      ', ' ORDER BY p.position)
      INTO cols
      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;

    EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
    EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);

    -- Merge changes: the datasource row replayed through the edit log, per
    -- object, dropping the deleted.
    FOR staged IN SELECT s.pk, s.row FROM _staged s LOOP
      SELECT * INTO merged FROM public.object_state(p_object_type, staged.pk, staged.row);
      CONTINUE WHEN merged.deleted;
      EXECUTE format(
        'INSERT INTO objects.%I SELECT * FROM jsonb_populate_record(NULL::objects.%I, $1)',
        tbl, tbl) USING merged.properties;
      n := n + 1;
    END LOOP;

    DROP TABLE _staged;

    UPDATE public.object_type_indexes
       SET status = 'success', error = NULL, object_count = n,
           index_table = tbl, indexed_at = now(), updated_at = now()
     WHERE object_type_id = p_object_type;

  EXCEPTION WHEN OTHERS THEN
    -- The pipeline failed; the record of why is the deliverable.
    DROP TABLE IF EXISTS _staged;
    UPDATE public.object_type_indexes
       SET status = 'failed', error = sqlerrm, object_count = NULL, updated_at = now()
     WHERE object_type_id = p_object_type;
  END;

  SELECT * INTO result FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  RETURN result;
END $$;

COMMENT ON FUNCTION public.index_object_type(uuid) IS
  'Full reindex of one object type: the current datasource view merged with the edit log through object_state(), written to a real table in the objects schema. Failure is recorded on object_type_indexes, not raised — the save already succeeded, and the error is the job details.';

REVOKE ALL ON FUNCTION public.index_object_type(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.index_object_type(uuid) TO authenticated;

-- ── reading what was indexed ───────────────────────────────────────────────
-- The objects schema takes no grants, so the peek goes through a definer that
-- asks the same visibility question the type itself answers.
CREATE OR REPLACE FUNCTION public.indexed_objects(p_object_type uuid, p_limit int DEFAULT 100)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tbl text; ont uuid;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN
    RETURN; -- not indexed yet: no objects to see, which is the point of E2
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(o) FROM objects.%I o LIMIT %s', tbl, greatest(p_limit, 0));
END $$;

REVOKE ALL ON FUNCTION public.indexed_objects(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.indexed_objects(uuid, int) TO authenticated;

-- ── assertions: the lesson-1 slice, end to end, as authenticated ───────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; t uuid;
  usr uuid := gen_random_uuid(); before text; x public.object_type_indexes;
  ptbl text; fid uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('index-442') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws442@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws442@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS442');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws442', 'WS 442') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws442', 'WS442') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights442', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"flight_id","type":"STRING"},{"name":"status","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'flights.parquet', 3) RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, flight_id, status) VALUES ($1,''F1'',''on time''),($1,''F2'',''delayed''),($1,''F3'',''on time'')',
    ptbl) USING fid;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','flight_id','display_name','Flight Id','api_name','flightId',
        'base_type','string','source','column','backing_column','flight_id',
        'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  -- The status property names its datasource ROW, which exists only now.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Flight','label','Flight'),
    jsonb_build_array(
      jsonb_build_object('property_id','flight_id','display_name','Flight Id','api_name','flightId',
        'base_type','string','source','column','backing_column','flight_id',
        'is_primary_key',true,'is_title_key',true,'required',true),
      jsonb_build_object('property_id','status','display_name','Status','api_name','status',
        'base_type','string','source','column','backing_column','status',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources
                           WHERE object_type_id = t))));
  PERFORM public.save_working_state();
  -- Edits are gated per type ("Edits: Disabled" on the Overview); the fixture
  -- needs them on for step 3.
  UPDATE public.object_types SET edits_enabled = true WHERE id = t;

  -- 1. Saved is not live: no index, no objects.
  IF EXISTS (SELECT 1 FROM public.indexed_objects(t)) THEN
    RAISE EXCEPTION 'objects were visible before the index built';
  END IF;

  -- 2. The index builds, and the count is the deep dive''s moment.
  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 3 THEN
    RAISE EXCEPTION 'expected success/3, got %/% (%)', x.status, x.object_count, x.error;
  END IF;
  IF (SELECT count(*) FROM public.indexed_objects(t)) <> 3 THEN
    RAISE EXCEPTION 'the indexed objects do not read back';
  END IF;

  -- 3. An edit-created object joins the merge on the next build.
  INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
  VALUES (t, 'F4', 'create', '{"flight_id":"F4","status":"scheduled"}'::jsonb);
  x := public.index_object_type(t);
  IF x.object_count <> 4 THEN
    RAISE EXCEPTION 'the edit-created object did not index (count %)', x.object_count;
  END IF;

  -- 4. A schema change marks the index stale — the replacement pipeline.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Flight','label','Flight Leg'), NULL);
  PERFORM public.save_working_state();
  IF (SELECT status FROM public.object_type_indexes WHERE object_type_id = t) <> 'not started' THEN
    RAISE EXCEPTION 'a schema change did not mark the index stale';
  END IF;

  -- 5. Non-unique primary keys fail the build and name themselves.
  EXECUTE format('INSERT INTO datasets.%I (_file, flight_id, status) VALUES ($1,''F1'',''dup'')', ptbl)
    USING fid;
  x := public.index_object_type(t);
  IF x.status <> 'failed' OR x.error NOT LIKE '%non-unique primary keys%' THEN
    RAISE EXCEPTION 'a duplicate primary key did not fail the pipeline (%: %)', x.status, x.error;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '442: save, index, count, edit-created object, stale on change, failure with job details';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
