-- E3: a materialization writes the ontology back to a dataset — the loop
-- dataset → object type → indexed objects → dataset, closed.
--
--   "Ontology users can create materializations of indexed data from the
--    Ontology that contains the latest state of each object by combining data
--    from both input datasources and user edits."  (object-edits/materializations)
--
--   "Navigate to the Materializations tab by toggling the Edits configuration
--    in the Datasources tab" — creation is gated on edits being enabled.
--
--   "OSv2 also allows multiple materialized datasets to be created, in case
--    users want to materialize only a subset of the properties."
--
--   "the API Name metadata of each property is used as the schema of the
--    materialized dataset."
--
--   "materialized datasets are subject to a retention that is not
--    customizable. Historical transactions are constantly deleted and only
--    the latest snapshot is guaranteed to be available."
--
--   "`__` prefixed columns (e.g. `__is_deleted`, `__patch_offset`) … are
--    metadata columns used by Foundry for deduplication purposes".
--
-- ── WHAT THIS READS FROM, AND WHY THAT IS THE HONEST SOURCE ────────────────
-- "Materializations of INDEXED data": the source is E2's index table — the
-- merged state the pipeline already computed — not a re-merge here. A type
-- must have a successful index before it can materialize, which is also why
-- the deep dive's Materializations rail entry was greyed until edits were on.
--
-- ── PROPAGATION IS STORED; BUILDING IS CALLED ──────────────────────────────
-- The two documented modes (automatic "latency of a few minutes"; periodic
-- "whenever the input datasources have new data or every 6 hours") are stored
-- as configuration. Nothing here rebuilds on a timer — observe on a timer,
-- never build on one — so the build is a function the surface calls, exactly
-- as the index is. The scheduling half is recorded, not built.
--
-- Restricted-view materializations and branch behaviour are recorded, not
-- built: we model no restricted views, and materializations "cannot be
-- created on a branch", which is vacuously honoured while branch saves are.

CREATE TABLE public.object_type_materializations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  -- The OUTPUT: a real dataset in the registry. One dataset is one
  -- materialization's output and nothing else's.
  dataset_id     uuid NOT NULL UNIQUE REFERENCES public.datasets(id) ON DELETE CASCADE,
  -- "only a subset of the properties" — empty means all.
  property_ids   text[] NOT NULL DEFAULT '{}',
  propagation    text NOT NULL DEFAULT 'periodic' CHECK (propagation IN ('automatic','periodic')),
  built_at       timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.object_type_materializations IS
  'A materialized dataset: the latest state of each object of a type, written back into a dataset whose schema is the properties'' API names. Multiple per type, each optionally a property subset. Propagation mode is configuration; the build is build_materialization().';

CREATE INDEX materializations_type_idx ON public.object_type_materializations (object_type_id);

-- "Navigate to the Materializations tab by toggling the Edits configuration".
CREATE OR REPLACE FUNCTION public.guard_materialization()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = NEW.object_type_id) THEN
    RAISE EXCEPTION 'Ontology:EditsDisabled — materializations require the object type''s edits to be enabled'
      USING HINT = 'The Materializations tab appears by toggling the Edits configuration.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_materialization
  BEFORE INSERT ON public.object_type_materializations
  FOR EACH ROW EXECUTE FUNCTION public.guard_materialization();

ALTER TABLE public.object_type_materializations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read materializations in scope" ON public.object_type_materializations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_materializations.object_type_id
       AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "admins author materializations" ON public.object_type_materializations
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_materializations.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_materializations TO authenticated;

-- ── 392's field-name grammar was ours, and this page disproves it ──────────
-- dataset_schema_valid() required ^[a-z][a-z0-9_]*$ — an inference, not a
-- quotation. Materializations prove Foundry datasets carry camelCase API
-- names ("the API Name metadata of each property is used as the schema") and
-- double-underscore metadata columns ("__is_deleted", "__patch_offset"). The
-- grammar widens to what the platform itself emits.
CREATE OR REPLACE FUNCTION public.dataset_schema_valid(fields jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE f jsonb; seen text[] := '{}';
BEGIN
  IF jsonb_typeof(fields) <> 'array' THEN RETURN false; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(fields) LOOP
    IF f ->> 'name' !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN RETURN false; END IF;
    IF (f ->> 'name') = ANY (seen) THEN RETURN false; END IF;
    seen := seen || (f ->> 'name');
    -- IS NOT TRUE, not NOT: a NULL from a malformed field must fail closed.
    IF public.dataset_field_valid(f) IS NOT TRUE THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $fn$;

-- Property base type → dataset field type, for the materialized schema.
CREATE OR REPLACE FUNCTION public.property_dataset_field_type(p_base_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_base_type
    WHEN 'string'    THEN 'STRING'
    WHEN 'boolean'   THEN 'BOOLEAN'
    WHEN 'byte'      THEN 'BYTE'
    WHEN 'short'     THEN 'SHORT'
    WHEN 'integer'   THEN 'INTEGER'
    WHEN 'long'      THEN 'LONG'
    WHEN 'float'     THEN 'FLOAT'
    WHEN 'double'    THEN 'DOUBLE'
    WHEN 'date'      THEN 'DATE'
    WHEN 'timestamp' THEN 'TIMESTAMP'
    ELSE 'STRING'    -- structured values travel as their JSON text
  END
$$;

-- ── the build ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.build_materialization(p_materialization uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m       record;
  x       record;
  ds      record;
  fields  jsonb;
  cols    text;
  sel     text;
  txn     uuid;
  fid     uuid;
  ptbl    text;
  n       bigint;
BEGIN
  SELECT om.*, t.ontology_id, t.api_name AS type_api_name
    INTO m
    FROM public.object_type_materializations om
    JOIN public.object_types t ON t.id = om.object_type_id
   WHERE om.id = p_materialization;
  IF m.id IS NULL OR NOT public.auth_in_ontology(m.ontology_id) THEN
    RAISE EXCEPTION 'Ontology:MaterializationNotFound — % is not a materialization you can see', p_materialization;
  END IF;

  -- "materializations of INDEXED data" — the index is the source, and it must
  -- have succeeded.
  SELECT * INTO x FROM public.object_type_indexes
   WHERE object_type_id = m.object_type_id AND status = 'success';
  IF x.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:NotIndexed — a materialization reads indexed data, and this type has no successful index'
      USING HINT = 'Build the index first.';
  END IF;

  SELECT * INTO ds FROM public.datasets WHERE id = m.dataset_id;

  -- The schema is the ontology's: one field per selected property, named by
  -- its API Name, plus the __ metadata column the page reserves.
  SELECT jsonb_agg(jsonb_build_object(
           'name', p.api_name,
           'type', public.property_dataset_field_type(p.base_type))
         ORDER BY p.position)
    INTO fields
    FROM public.object_type_properties p
   WHERE p.object_type_id = m.object_type_id
     AND (m.property_ids = '{}' OR p.property_id = ANY (m.property_ids));
  IF fields IS NULL THEN
    RAISE EXCEPTION 'Ontology:NothingToMaterialize — the property subset matches no properties';
  END IF;
  fields := fields || jsonb_build_array(jsonb_build_object('name','__is_deleted','type','BOOLEAN'));

  -- One SNAPSHOT per build; then retention deletes what came before, because
  -- "only the latest snapshot is guaranteed to be available".
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  SELECT m.dataset_id, b.id, 'SNAPSHOT'
    FROM public.dataset_branches b
   WHERE b.dataset_id = m.dataset_id AND b.name = 'master'
  RETURNING id INTO txn;
  IF txn IS NULL THEN
    RAISE EXCEPTION 'Datasets:NoMasterBranch — the output dataset has no master branch';
  END IF;

  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (m.dataset_id, txn, fields);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (m.dataset_id, txn, m.type_api_name || '.materialized', 0)
  RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;

  ptbl := public.dataset_materialize(m.dataset_id, txn);

  -- Refill: the index table's property_id columns, written under API names.
  SELECT string_agg(format('%I', p.api_name), ', ' ORDER BY p.position),
         string_agg(format('o.%I', p.property_id), ', ' ORDER BY p.position)
    INTO cols, sel
    FROM public.object_type_properties p
   WHERE p.object_type_id = m.object_type_id
     AND (m.property_ids = '{}' OR p.property_id = ANY (m.property_ids));

  EXECUTE format('DELETE FROM datasets.%I', ptbl);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, %s, __is_deleted)
     SELECT %L::uuid, %s, false FROM objects.%I o',
    ptbl, cols, fid, sel, x.index_table);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.dataset_files SET row_count = n WHERE id = fid;

  -- Retention: everything before this snapshot goes.
  DELETE FROM public.dataset_transactions
   WHERE dataset_id = m.dataset_id AND id <> txn;

  UPDATE public.object_type_materializations
     SET built_at = now() WHERE id = p_materialization;

  RETURN n;
END $$;

COMMENT ON FUNCTION public.build_materialization(uuid) IS
  'Write the latest indexed state of the object type into the output dataset: one SNAPSHOT transaction, schema from the properties'' API names plus __is_deleted, prior transactions deleted because only the latest snapshot is guaranteed. Called by the surface; the automatic/periodic propagation modes are stored configuration, not a timer.';

REVOKE ALL ON FUNCTION public.build_materialization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_materialization(uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; t uuid;
  outds uuid; outbr uuid; mat uuid; usr uuid := gen_random_uuid(); before text;
  ptbl text; fid uuid; x public.object_type_indexes; n bigint; k int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('mat-453') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws453@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws453@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS453');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws453', 'WS 453') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws453', 'WS453') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights453', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"flight_id","type":"STRING"},{"name":"status","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'flights.parquet', 2) RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, flight_id, status) VALUES ($1,''F1'',''on time''),($1,''F2'',''delayed'')',
    ptbl) USING fid;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','flight_id','display_name','Flight Id',
      'api_name','flightId','base_type','string','source','column','backing_column','flight_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
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

  -- The output dataset the materialization writes into.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights_latest', 'Flights latest') RETURNING id INTO outds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (outds,'master') RETURNING id INTO outbr;

  -- 1. Gated on edits: disabled refuses with the documented reason.
  BEGIN
    INSERT INTO public.object_type_materializations (object_type_id, dataset_id)
    VALUES (t, outds);
    RAISE EXCEPTION 'a materialization was created with edits disabled';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%EditsDisabled%' THEN RAISE; END IF;
  END;
  UPDATE public.object_types SET edits_enabled = true WHERE id = t;
  INSERT INTO public.object_type_materializations (object_type_id, dataset_id)
  VALUES (t, outds) RETURNING id INTO mat;

  -- 2. No index, no materialization — it reads indexed data.
  BEGIN
    PERFORM public.build_materialization(mat);
    RAISE EXCEPTION 'a build succeeded without an index';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%NotIndexed%' THEN RAISE; END IF;
  END;

  -- 3. Index (datasource ⊕ one user edit), then materialize: the loop closes.
  INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
  VALUES (t, 'F3', 'create', '{"flight_id":"F3","status":"scheduled"}'::jsonb);
  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 3 THEN
    RAISE EXCEPTION 'the fixture index failed (%/%)', x.status, x.error;
  END IF;
  n := public.build_materialization(mat);
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 materialized rows, wrote %', n; END IF;

  -- 4. The schema is the ontology's API names, plus the reserved column.
  SELECT count(*) INTO k
    FROM information_schema.columns
   WHERE table_schema = 'datasets'
     AND table_name = (SELECT physical_table FROM public.datasets WHERE id = outds)
     AND column_name IN ('flightId','status','__is_deleted');
  IF k <> 3 THEN
    RAISE EXCEPTION 'the materialized schema is not the API names (found % of 3)', k;
  END IF;

  -- 5. Retention: a second build leaves exactly one transaction.
  PERFORM public.build_materialization(mat);
  SELECT count(*) INTO k FROM public.dataset_transactions WHERE dataset_id = outds;
  IF k <> 1 THEN
    RAISE EXCEPTION 'only the latest snapshot is guaranteed, but % transactions remain', k;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '453: dataset -> objects -> dataset, with the ontology''s own schema and one snapshot';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
