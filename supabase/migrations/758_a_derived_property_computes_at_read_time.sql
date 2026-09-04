-- 758 — a derived property computes at read time.
--
-- Chunk 2 of the arc: the evaluator. The definition side has been complete
-- since 576 and the concept page says what the value IS:
--
--   "Derived properties are properties that are calculated at runtime based
--    on the values of other properties or links on objects. This includes
--    aggregating on or selecting properties of linked objects."
--   — ontology/derived-properties.md
--
-- The chain walks up to 3 links, each hop a link type, and terminates in an
-- aggregation the registry publishes — our nine map one-to-one onto the api's
-- SelectedPropertyOperation members, and the api states the semantics this
-- evaluator implements:
--
--   "Lists all values of a property up to the specified limit. The maximum
--    supported limit is 100, by default. NOTE: A separate count aggregation
--    should be used to determine the total count of values, to account for a
--    possible truncation of the returned list. Ignores objects for which a
--    property is absent, so the returned list will contain non-null values
--    only. Returns an empty list when none of the objects have values for a
--    provided property."
--   — api/ontologies-v2-resources-ontology-object-sets-aggregate-object-set.md
--
--   "The value of the metric. This will be a double in the case of a numeric
--    metric, or a date string in the case of a date metric."
--   — api/ontologies-v2-resources-ontology-object-sets-aggregate-object-set.md
--
-- So collects skip NULLs, return [] when empty, and honour the limit (ours
-- defaults to the panel's documented 10); average and sum come back as
-- doubles; minimum and maximum keep their property's own shape, which is how
-- a date metric stays a date. Security follows the concept page —
--
--   "These properties use the security context of all objects involved in
--    the calculation, ensuring users only see information for which they
--    have access authorization."
--   — object-link-types/derived-properties.md
--
-- — so every hop's type contributes its restricted-view gate. Three scoped
-- choices, stated: approximate_cardinality is computed exactly (we have no
-- sketch; an exact answer is within any approximation's promise); a chain
-- that cannot be computed — an unbuilt far index, an untraversable backing
-- (757 already warns), an unfinished chain — yields NULL rather than failing
-- the whole read; and far rows returned by list_linked_objects do not carry
-- THEIR derived properties yet (recorded residual).
--
-- 757's read refusals stay for filter, sort, group-by, aggregation and
-- histogram targets — computing a value per row is not the same as indexing
-- one — but their message stops claiming no computation exists.

CREATE FUNCTION public.derived_property_select(p_property uuid, p_alias text)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  p record; h record; lk record;
  cur uuid; far_id uuid; prev_alias text; prev_pk text;
  far_tbl text; far_pk text; fk_prop text; store text;
  hop_alias text; jal text; step int := 0;
  body text := ''; conds text := ''; pred text;
  term_col text; lim int; last_alias text;
BEGIN
  SELECT * INTO p FROM public.object_type_properties
   WHERE id = p_property AND source = 'linked_objects';
  IF p IS NULL THEN RETURN NULL; END IF;

  cur := p.object_type_id;
  prev_alias := p_alias;
  SELECT pp.property_id INTO prev_pk FROM public.object_type_properties pp
   WHERE pp.object_type_id = cur AND pp.is_primary_key;
  IF prev_pk IS NULL THEN RETURN NULL; END IF;

  FOR h IN SELECT * FROM public.derived_property_hops
            WHERE property_id = p_property ORDER BY position
  LOOP
    step := step + 1;
    hop_alias := format('h%s', step);
    SELECT l.* INTO lk FROM public.link_types l WHERE l.id = h.link_type_id;
    far_id := public.link_other_end(lk.id, cur);
    IF far_id IS NULL THEN RETURN NULL; END IF;

    SELECT x.index_table INTO far_tbl FROM public.object_type_indexes x
     WHERE x.object_type_id = far_id AND public.object_type_index_ready(far_id);
    SELECT pp.property_id INTO far_pk FROM public.object_type_properties pp
     WHERE pp.object_type_id = far_id AND pp.is_primary_key;
    IF far_tbl IS NULL OR far_pk IS NULL THEN RETURN NULL; END IF;

    IF lk.backing_kind = 'foreign_key' THEN
      SELECT pp.property_id INTO fk_prop FROM public.object_type_properties pp
       WHERE pp.object_type_id = lk.source_object_type_id
         AND pp.backing_column = lk.backing_column;
      IF fk_prop IS NULL THEN RETURN NULL; END IF;
      IF step = 1 THEN
        body := format('FROM objects.%I %s', far_tbl, hop_alias);
        conds := CASE WHEN lk.source_object_type_id = cur
          THEN format('%s.%I::text = %s.%I::text', hop_alias, far_pk, prev_alias, fk_prop)
          ELSE format('%s.%I::text = %s.%I::text', hop_alias, fk_prop, prev_alias, prev_pk)
        END;
      ELSE
        body := body || CASE WHEN lk.source_object_type_id = cur
          THEN format(' JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      far_tbl, hop_alias, hop_alias, far_pk, prev_alias, fk_prop)
          ELSE format(' JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      far_tbl, hop_alias, hop_alias, fk_prop, prev_alias, prev_pk)
        END;
      END IF;

    ELSIF lk.backing_kind = 'join_table' THEN
      SELECT i.index_table INTO store FROM public.link_type_indexes i
       WHERE i.link_type_id = lk.id AND public.link_type_index_ready(lk.id);
      IF store IS NULL THEN RETURN NULL; END IF;
      jal := format('j%s', step);
      IF step = 1 THEN
        body := CASE WHEN lk.source_object_type_id = cur
          THEN format('FROM objects.%I %s JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      store, jal, far_tbl, hop_alias, hop_alias, far_pk, jal, lk.target_key_column)
          ELSE format('FROM objects.%I %s JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      store, jal, far_tbl, hop_alias, hop_alias, far_pk, jal, lk.source_key_column)
        END;
        conds := CASE WHEN lk.source_object_type_id = cur
          THEN format('%s.%I::text = %s.%I::text', jal, lk.source_key_column, prev_alias, prev_pk)
          ELSE format('%s.%I::text = %s.%I::text', jal, lk.target_key_column, prev_alias, prev_pk)
        END;
      ELSE
        body := body || CASE WHEN lk.source_object_type_id = cur
          THEN format(' JOIN objects.%I %s ON %s.%I::text = %s.%I::text JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      store, jal, jal, lk.source_key_column, prev_alias, prev_pk,
                      far_tbl, hop_alias, hop_alias, far_pk, jal, lk.target_key_column)
          ELSE format(' JOIN objects.%I %s ON %s.%I::text = %s.%I::text JOIN objects.%I %s ON %s.%I::text = %s.%I::text',
                      store, jal, jal, lk.target_key_column, prev_alias, prev_pk,
                      far_tbl, hop_alias, hop_alias, far_pk, jal, lk.source_key_column)
        END;
      END IF;

    ELSE
      RETURN NULL;   -- object-backed or unbacked: 757's warning names it
    END IF;

    -- "the security context of all objects involved in the calculation"
    pred := public.restricted_view_predicate(far_id);
    IF pred IS NOT NULL THEN
      conds := conds || ' AND ' || replace(pred, '= o.', format('= %s.', hop_alias));
    END IF;

    cur := far_id; prev_alias := hop_alias; prev_pk := far_pk;
  END LOOP;

  IF step = 0 THEN RETURN NULL; END IF;   -- authored, chain not finished
  last_alias := prev_alias;

  IF p.derived_aggregation IS DISTINCT FROM 'count' THEN
    SELECT fp.property_id INTO term_col FROM public.object_type_properties fp
     WHERE fp.id = p.derived_from_property_id AND fp.object_type_id = cur;
    IF term_col IS NULL THEN RETURN NULL; END IF;
  END IF;
  lim := coalesce(p.derived_limit, 10);

  RETURN CASE p.derived_aggregation
    WHEN 'count' THEN
      format('(SELECT count(*) %s WHERE %s)', body, conds)
    WHEN 'average' THEN
      format('(SELECT avg(%s.%I)::double precision %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'sum' THEN
      format('(SELECT sum(%s.%I)::double precision %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'minimum' THEN
      format('(SELECT min(%s.%I) %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'maximum' THEN
      format('(SELECT max(%s.%I) %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'exact_cardinality' THEN
      format('(SELECT count(DISTINCT %s.%I) %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'approximate_cardinality' THEN
      -- computed exactly: an exact answer is within any approximation's promise
      format('(SELECT count(DISTINCT %s.%I) %s WHERE %s)', last_alias, term_col, body, conds)
    WHEN 'collect_list' THEN
      -- "non-null values only" and "an empty list when none", up to the limit
      format('(SELECT coalesce(jsonb_agg(cv.v), ''[]''::jsonb) FROM (SELECT %s.%I AS v %s WHERE %s AND %s.%I IS NOT NULL LIMIT %s) cv)',
             last_alias, term_col, body, conds, last_alias, term_col, lim)
    WHEN 'collect_set' THEN
      format('(SELECT coalesce(jsonb_agg(cv.v), ''[]''::jsonb) FROM (SELECT DISTINCT %s.%I AS v %s WHERE %s AND %s.%I IS NOT NULL LIMIT %s) cv)',
             last_alias, term_col, body, conds, last_alias, term_col, lim)
    ELSE
      -- No aggregation: the api's get — a single selected value, legal only
      -- over an all-one chain, which the linter already holds.
      format('(SELECT %s.%I %s WHERE %s LIMIT 1)', last_alias, term_col, body, conds)
  END;
END $fn$;

COMMENT ON FUNCTION public.derived_property_select(uuid, text) IS
  'The correlated scalar subquery that computes one derived property for the row aliased p_alias: the hop chain joined over the objects'' indexes and the pair stores, each hop gated by its type''s restricted-view predicate, terminated by the registry aggregation. NULL when the chain cannot be computed (unbuilt index, untraversable backing, unfinished chain) — the value then reads as NULL rather than failing the read. 758.';

REVOKE ALL ON FUNCTION public.derived_property_select(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.derived_property_select(uuid, text) TO service_role;

-- ── evaluate_object_set computes them; the refusal messages stop lying ──────

DO $patch$
DECLARE src text; n int; anchor text; fnname text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'evaluate_object_set';
  anchor := '  ont uuid; tbl text; wh text; hidden text[]; s jsonb; ord text[] := ''{}''; prop record;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'evaluate: declare anchor found % times', n; END IF;
  src := replace(src, anchor,
    anchor || chr(10) || '  dpairs text;');
  anchor := '  RETURN QUERY EXECUTE format(' || chr(10) ||
    '    ''SELECT to_jsonb(o) - $1 FROM objects.%I o WHERE %s %s LIMIT %s OFFSET %s'',' || chr(10) ||
    '    tbl, wh,';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'evaluate: execute anchor found % times', n; END IF;
  src := replace(src, anchor,
    '  -- "calculated at runtime based on the values of other properties or' || chr(10) ||
    '  -- links on objects" — each visible derived property joins the row as a' || chr(10) ||
    '  -- computed key; an uncomputable chain reads as NULL (758).' || chr(10) ||
    '  SELECT string_agg(format(''%L, %s'', dp.property_id,' || chr(10) ||
    '           coalesce(public.derived_property_select(dp.id, ''o''), ''NULL'')), '', '')' || chr(10) ||
    '    INTO dpairs' || chr(10) ||
    '    FROM public.object_type_properties dp' || chr(10) ||
    '   WHERE dp.object_type_id = p_object_type AND dp.source = ''linked_objects''' || chr(10) ||
    '     AND dp.visibility <> ''hidden'';' || chr(10) ||
    '  RETURN QUERY EXECUTE format(' || chr(10) ||
    '    ''SELECT (to_jsonb(o) - $1)%s FROM objects.%I o WHERE %s %s LIMIT %s OFFSET %s'',' || chr(10) ||
    '    CASE WHEN dpairs IS NULL THEN '''' ELSE '' || jsonb_build_object('' || dpairs || '')'' END,' || chr(10) ||
    '    tbl, wh,');
  EXECUTE src;

  -- The five refusal messages: computation exists now; what stays unbuilt is
  -- filtering, sorting and aggregating BY the computed value.
  FOR fnname, n IN
    SELECT * FROM (VALUES
      ('object_set_where', 1), ('evaluate_object_set', 1),
      ('aggregate_object_set', 2), ('histogram_object_set', 1)) v(f, c)
  LOOP
    SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = fnname;
    anchor := ' is derived from linked objects, and its read-time computation is not built';
    IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> n THEN
      RAISE EXCEPTION '%: message anchor count moved', fnname;
    END IF;
    src := replace(src, anchor,
      ' is derived from linked objects, and filtering, sorting or aggregating by its computed value is not built');
    EXECUTE src;
  END LOOP;
END $patch$;

-- ── PROVED BY DOING — nine aggregations, get, both backings, two hops ───────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; dsc uuid; jds uuid; bra uuid; brb uuid; brc uuid; jbr uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; tc uuid; fkl uuid; jl uuid; b uuid;
  bprop uuid; cprop uuid; r jsonb; n int;
  mk uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m758 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm758-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm758-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M758 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm758p', 'm758 probe') RETURNING id INTO proj;

  -- A: two rows, FK at b_id. B: keyed b_id with an int val. C: far side of a
  -- join link from B. Chain under test: A -FK-> B (-join-> C for two hops).
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm758a', 'm758a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"pk","type":"STRING"},{"name":"b_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, b_id) VALUES ($1,''A1'',''B1''), ($1,''A2'',NULL)', phys)
    USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm758b', 'm758b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"b_id","type":"STRING"},{"name":"val","type":"INTEGER"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 1) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, b_id, val) VALUES ($1,''B1'',7)', phys)
    USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm758c', 'm758c') RETURNING id INTO dsc;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsc, 'master') RETURNING id INTO brc;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsc, brc, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsc, txn, '[{"name":"pk","type":"STRING"},{"name":"score","type":"INTEGER"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsc, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsc, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, score) VALUES ($1,''C1'',10), ($1,''C2'',20), ($1,''C3'',NULL)', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M758A', 'M758 A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, dsa, bra) RETURNING id INTO mk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (ta, 'b_id', 'B ref', 'bId', 'string', 'column', 'b_id', mk);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M758B', 'M758 B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tb, dsb, brb) RETURNING id INTO mk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'b_id', 'Id', 'id', 'string', 'column', 'b_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (tb, 'val', 'Val', 'val', 'integer', 'column', 'val', mk)
  RETURNING id INTO bprop;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M758C', 'M758 C') RETURNING id INTO tc;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tc, dsc, brc) RETURNING id INTO mk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tc, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (tc, 'score', 'Score', 'score', 'integer', 'column', 'score', mk)
  RETURNING id INTO cprop;
  SELECT public.run_index_build(ARRAY[ta, tb, tc]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    RAISE EXCEPTION 'the side indexes did not land';
  END IF;

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm758-ref', 'M758 ref', 'many_to_one', 'foreign_key', 'b_id',
          'as', 'As', 'bs', 'Bs')
  RETURNING id INTO fkl;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm758join', 'm758join') RETURNING id INTO jds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (jds, 'master') RETURNING id INTO jbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (jds, jbr, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (jds, txn, '[{"name":"bk","type":"STRING"},{"name":"ck","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(jds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, bk, ck)
                  VALUES ($1,''B1'',''C1''), ($1,''B1'',''C2''), ($1,''B1'',''C3'')', phys)
    USING file_id;
  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, dataset_id, branch_id,
     source_key_column, target_key_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, tb, tc, 'm758-pairs', 'M758 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'bk', 'ck', 'bs2', 'Bs2', 'cs', 'Cs')
  RETURNING id INTO jl;
  SELECT public.run_link_index_build(ARRAY[jl]::uuid[], true) INTO b;

  -- One-hop get over the all-one FK chain: A1 reads B1's val; A2 reads NULL.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, derived_from_property_id)
  VALUES (ta, 'b_val', 'B val', 'bVal', 'integer', 'linked_objects', bprop)
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);

  -- Two-hop aggregations: A -FK-> B -join-> C, over C.score {10, 20, NULL}.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation)
  VALUES (ta, 'c_count', 'C count', 'cCount', 'integer', 'linked_objects', 'count')
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 2, jl);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation, derived_from_property_id)
  VALUES (ta, 'c_avg', 'C avg', 'cAvg', 'double', 'linked_objects', 'average', cprop)
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 2, jl);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation, derived_from_property_id, derived_limit)
  VALUES (ta, 'c_scores', 'C scores', 'cScores', 'integer', 'linked_objects', 'collect_list', cprop, 2)
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 2, jl);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation, derived_from_property_id)
  VALUES (ta, 'c_max', 'C max', 'cMax', 'integer', 'linked_objects', 'maximum', cprop)
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 2, jl);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation, derived_from_property_id)
  VALUES (ta, 'c_kinds', 'C kinds', 'cKinds', 'integer', 'linked_objects', 'exact_cardinality', cprop)
  RETURNING id INTO mk;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 1, fkl);
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (mk, 2, jl);

  -- A1: the whole family computes in one read.
  SELECT e INTO r FROM public.evaluate_object_set(ta,
    '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"valuesFilter","values":["A1"]}}]'::jsonb) e;
  IF (r->>'b_val')::int IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'get read %', r->'b_val'; END IF;
  IF (r->>'c_count')::int IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'count read %', r->'c_count'; END IF;
  IF (r->>'c_avg')::numeric IS DISTINCT FROM 15.0 THEN RAISE EXCEPTION 'average read %', r->'c_avg'; END IF;
  IF (r->>'c_max')::int IS DISTINCT FROM 20 THEN RAISE EXCEPTION 'maximum read %', r->'c_max'; END IF;
  IF (r->>'c_kinds')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'cardinality read %', r->'c_kinds'; END IF;
  -- collect: non-null values only, bounded by the limit of 2.
  IF jsonb_array_length(r->'c_scores') IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'collect read %', r->'c_scores';
  END IF;
  IF r->'c_scores' @> 'null'::jsonb THEN RAISE EXCEPTION 'a collect carried a NULL'; END IF;

  -- A2 has no B: get is NULL, count is 0, collect is the documented [].
  SELECT e INTO r FROM public.evaluate_object_set(ta,
    '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"valuesFilter","values":["A2"]}}]'::jsonb) e;
  IF r->'b_val' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'unlinked get read %', r->'b_val'; END IF;
  IF (r->>'c_count')::int IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'unlinked count read %', r->'c_count'; END IF;
  IF r->'c_scores' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'unlinked collect read %', r->'c_scores'; END IF;

  -- An uncomputable chain reads NULL, not an error: drop C's index.
  DELETE FROM public.build_jobs WHERE output_object_type_id = tc;
  DELETE FROM public.object_type_indexes WHERE object_type_id = tc;
  SELECT e INTO r FROM public.evaluate_object_set(ta,
    '[{"type":"propertyFilter","propertyType":"pk","value":{"type":"valuesFilter","values":["A1"]}}]'::jsonb) e;
  IF r->'c_count' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'an unbuilt far index should read NULL, got %', r->'c_count';
  END IF;
  IF (r->>'b_val')::int IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'the computable chain should survive its neighbour, got %', r->'b_val';
  END IF;

  DELETE FROM public.derived_property_hops WHERE property_id IN
    (SELECT id FROM public.object_type_properties WHERE object_type_id = ta AND source = 'linked_objects');
  DELETE FROM public.object_types WHERE id IN (ta, tb, tc);
  DELETE FROM public.link_types WHERE id IN (fkl, jl);
  DELETE FROM public.datasets WHERE id IN (dsa, dsb, dsc, jds);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
