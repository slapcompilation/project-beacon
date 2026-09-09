-- A filter compares a property it can compare.
--
-- A defect in shipped code, found while reading the time series slice and
-- deliberately NOT fixed there, because it is not a time series defect. It is
-- general: `object_set_property_predicate` compiles a range filter against any
-- property at all, without asking whether the comparison exists.

-- ── what it actually does today ────────────────────────────────────────────
--
-- The numeric arm emits, for a `string` property whose index column is `text`:
--
--     (true AND o.some_string >= 5)
--
-- and Postgres answers `42883 operator does not exist: text >= numeric`. I ran
-- that comparison against the live database rather than reasoning about it.
-- Five of the seven filter kinds do the same thing — `numberRangeFilter`,
-- `dateRangeFilter`, `relativeDateFilter`, `timestampRangeFilter` and
-- `relativeTimestampFilter` all compare the column to a typed literal. Only
-- `textFilter` and `valuesFilter` are safe, because both cast the column to
-- `text` first.
--
-- So an exploration carrying a mistyped filter fails with a bare SQLSTATE from
-- the planner. That breaks the one rule this project took from Foundry's own
-- stack rather than from a page:
--
--   **Namespaced, typed errors.** `Phonograph2:SchemaMismatch` is a namespace,
--   a name and a payload. A caller must be able to branch without parsing
--   prose. (CLAUDE.md, Substrate.)
--
-- This is NOT being stricter than Foundry. The query fails either way. The only
-- thing that changes is whether the caller can tell what went wrong.

-- ── why the validator cannot do it ────────────────────────────────────────
--
-- `object_set_filters_valid` is the CHECK on `object_sets.filters`, and a CHECK
-- may not subquery — so it cannot reach `object_type_properties` to learn the
-- property's base type. It validates SHAPE and nothing else, which is why a
-- saved exploration can hold a mistyped filter today. The refusal therefore
-- belongs where the type is known: the point of compilation.

-- ── how reachable, measured rather than assumed ───────────────────────────
--
-- Our own Explorer picks its controls from the property's type, so the UI does
-- not produce one. The platform function is callable directly, `object_sets`
-- accepts it, and the generated client exposes it. Latent through the UI,
-- reachable through the API — the same shape as 778's double negation, which
-- was also written off as unreachable until the validator was read properly.

-- ── what the docs do and do not say ───────────────────────────────────────
--
-- Nothing. `numberRangeFilter` appears in exactly ONE mirrored page,
-- object-explorer/generate-urls, which is the URL-ENCODING page and which
-- disclaims its own example:

--   "This example may be out of date – use the instructions below to find out
--    the latest format."
--   — object-explorer/generate-urls.md

-- It lists the kinds and their fields and says nothing about which property
-- types each applies to; `api/` publishes no object-set filter union at all. So
-- the mapping below is INFERENCE, and it is the narrowest one available: a kind
-- is refused only where the comparison it emits has no operator in Postgres.
-- Nothing is refused on taste.

-- ── 1. which kinds can compare which properties ──────────────────────────

CREATE OR REPLACE FUNCTION public.filter_kind_applies(p_kind text, p_base_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_kind
    -- Both cast the column to text before comparing, so both apply to anything.
    WHEN 'textFilter'   THEN true
    WHEN 'valuesFilter' THEN true
    WHEN 'numberRangeFilter' THEN
      public.property_column_type(p_base_type)
        IN ('smallint', 'integer', 'bigint', 'real', 'double precision', 'numeric')
    WHEN 'dateRangeFilter'          THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'relativeDateFilter'       THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'timestampRangeFilter'     THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'relativeTimestampFilter'  THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    ELSE true
  END
$$;

COMMENT ON FUNCTION public.filter_kind_applies(text, text) IS
  'Whether a value filter kind can compile against a property of this base type. Derived from what each arm of object_set_property_predicate EMITS, not from a page: the two text filters cast the column and apply to everything, the five range filters compare it to a typed literal and need an operator that exists. No page states the mapping — generate-urls lists the kinds and disclaims its own example, and api/ publishes no object set filter union — so this is the narrowest inference available rather than a vocabulary (784).';

GRANT EXECUTE ON FUNCTION public.filter_kind_applies(text, text) TO authenticated, service_role;

-- ── 2. the refusal, at the point where the type is known ─────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef(
    'public.object_set_property_predicate(uuid,jsonb,text)'::regprocedure), chr(13), '');

  a := chr(10) || '  CASE v->>''type''' || chr(10);
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one value CASE to gate, found %', n; END IF;

  EXECUTE replace(src, a, chr(10) ||
'  -- A range filter compares the column to a typed literal, so the comparison
  -- must exist. Without this the planner answers 42883 and the caller cannot
  -- branch on it.
  IF NOT public.filter_kind_applies(v->>''type'', prop.base_type) THEN
    RAISE EXCEPTION ''Ontology:FilterTypeMismatch — a % cannot compare %, which is a % property'',
      v->>''type'', e->>''propertyType'', prop.base_type;
  END IF;
' || a);
END $mig$;

COMMENT ON FUNCTION public.object_set_property_predicate(uuid, jsonb, text) IS
  'One value filter compiled against one property, bound to the given alias — shared by the subject''s own filters and, since 776, by the far side of a link filter. Since 784 a kind whose comparison the property''s type cannot support is refused with Ontology:FilterTypeMismatch rather than emitted for the planner to reject as 42883.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; tbl text;
  ot uuid; msg text; w text; n int;
BEGIN
  -- the mapping itself, before anything is built on it
  IF public.filter_kind_applies('numberRangeFilter', 'string') THEN
    RAISE EXCEPTION 'text has no >= against a number';
  END IF;
  IF NOT public.filter_kind_applies('numberRangeFilter', 'integer') THEN
    RAISE EXCEPTION 'an integer property is exactly what a number range filter is for';
  END IF;
  IF NOT public.filter_kind_applies('numberRangeFilter', 'decimal')
     OR NOT public.filter_kind_applies('numberRangeFilter', 'byte')
     OR NOT public.filter_kind_applies('numberRangeFilter', 'float') THEN
    RAISE EXCEPTION 'every numeric column type answers a number range filter';
  END IF;
  IF public.filter_kind_applies('dateRangeFilter', 'string')
     OR public.filter_kind_applies('relativeTimestampFilter', 'boolean') THEN
    RAISE EXCEPTION 'a temporal filter needs a temporal column';
  END IF;
  IF NOT public.filter_kind_applies('dateRangeFilter', 'timestamp')
     OR NOT public.filter_kind_applies('timestampRangeFilter', 'date') THEN
    RAISE EXCEPTION 'date and timestamp columns both order against both temporal filters';
  END IF;
  -- the two that cast, which must keep applying to everything
  IF NOT public.filter_kind_applies('textFilter', 'integer')
     OR NOT public.filter_kind_applies('valuesFilter', 'timestamp') THEN
    RAISE EXCEPTION 'the text filters cast the column, so nothing is out of range for them';
  END IF;

  INSERT INTO public.organizations (name) VALUES ('m784 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm784-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm784-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M784 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm784p', 'm784 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm784_rows', 'Rows') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"qty","type":"INTEGER"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'r.parquet', 2) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO tbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, qty) VALUES ($1,''A'',1),($1,''B'',9)', tbl)
    USING file;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M784Row', 'Row') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (ot, 'qty', 'Qty', 'qty', 'integer', 'column', 'qty',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot));

  -- THE DEFECT: before 784 this compiled, and the planner raised 42883.
  BEGIN
    PERFORM public.object_set_where(ot,
      '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"numberRangeFilter","min":5}}]'::jsonb);
    RAISE EXCEPTION 'a number range filter compiled against a string property';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:FilterTypeMismatch%' THEN RAISE; END IF;
  END;

  -- the same filter on the numeric property still compiles, and still answers
  w := public.object_set_where(ot,
    '[{"type":"propertyFilter","propertyType":"qty","value":{"type":"numberRangeFilter","min":5}}]'::jsonb);
  PERFORM public.run_index_build(ARRAY[ot]::uuid[], true);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ot), w) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'one row has qty >= 5; got %', n; END IF;

  -- and the filters that cast are untouched on the very same string property
  w := public.object_set_where(ot,
    '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"valuesFilter","values":["A"]}}]'::jsonb);
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
    (SELECT index_table FROM public.object_type_indexes WHERE object_type_id = ot), w) INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'a values filter on a string property is exactly right; got %', n; END IF;

  -- a temporal filter on a string property is refused by the same gate
  BEGIN
    PERFORM public.object_set_where(ot,
      '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"relativeDateFilter","sinceDaysAgo":7}}]'::jsonb);
    RAISE EXCEPTION 'a relative date filter compiled against a string property';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:FilterTypeMismatch%' THEN RAISE; END IF;
  END;

  -- and the gate reaches the FAR side of a link filter too, because 776 made
  -- both sides share this one function
  BEGIN
    PERFORM public.object_set_where(ot,
      '[{"type":"linkFilter","linkType":"nosuch","filters":[
          {"type":"propertyFilter","propertyType":"pk","value":{"type":"numberRangeFilter","min":5}}]}]'::jsonb);
    RAISE EXCEPTION 'the far side of a link filter escaped the gate';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    -- the link itself is unknown, which is a different refusal and arrives
    -- first; what must NOT happen is a bare 42883 from the planner
    IF msg NOT LIKE 'Ontology:%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0784', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0784' THEN
  NULL;
END $$;
