-- 757 — a derived property refuses what it cannot yet do.
--
-- Chunk 1 of the derived-properties arc. The re-audit found three traps
-- around a property whose source is linked_objects — authorable end to end
-- since 576/591, its stored column correctly deleted by 743, and nothing on
-- the read side yet:
--
--   1. Filtering, sorting, grouping, aggregating or histogramming one CRASHED
--      with a raw undefined-column error: every reader validates its target
--      against property metadata and then formats o.<property_id> against an
--      index table that (correctly) has no such column. Now each names the
--      refusal: Ontology:DerivedPropertyNotComputable.
--   2. An action rule or a function edit could target one, report success,
--      and have the edit silently dropped at rebuild. The page's own rule:
--
--        "Derived properties are read-only and cannot be edited by functions
--         or actions."
--        — object-link-types/derived-properties.md
--
--      Both apply paths now refuse with Actions:DerivedPropertyReadOnly.
--   3. A hop chain may legally cite a link whose backing this platform cannot
--      traverse (object-backed, or none). Foundry traverses object-backed
--      links, so BLOCKING the save would be stricter than Foundry — the arm
--      goes on ontology_warnings(), the list that never blocks.
--
-- The DerivedPropertyNotComputable refusal is OURS, scoped to this platform's
-- missing evaluator, and chunk 2 (the read-time computation) removes it. The
-- read-only refusal is Foundry's rule and stays.

DO $patch$
DECLARE src text; n int; anchor text; addition text;
BEGIN
  -- ── object_set_where: the filter target ─────────────────────────────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'object_set_where';
  anchor := 'p.visibility, p.searchable';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'object_set_where: select anchor found % times', n; END IF;
  src := replace(src, anchor, 'p.visibility, p.searchable, p.source');
  anchor := '''Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer'';' || chr(10) || chr(10) || '      END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'object_set_where: hidden anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '      IF prop.source = ''linked_objects'' THEN' || chr(10) ||
    '        RAISE EXCEPTION ''Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and its read-time computation is not built'', e->>''propertyType'';' || chr(10) ||
    '      END IF;');
  EXECUTE src;

  -- ── evaluate_object_set: the sort target ────────────────────────────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'evaluate_object_set';
  anchor := ', p.sortable INTO prop';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'evaluate: select anchor found % times', n; END IF;
  src := replace(src, anchor, ', p.sortable, p.source INTO prop');
  anchor := '''Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer'';' || chr(10) || '    END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'evaluate: hidden anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '    IF prop.source = ''linked_objects'' THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and its read-time computation is not built'', s->>''property'';' || chr(10) ||
    '    END IF;');
  EXECUTE src;

  -- ── aggregate_object_set: group-by and aggregation targets ──────────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'aggregate_object_set';
  anchor := ', p.selectable INTO grp';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'aggregate: grp select anchor found % times', n; END IF;
  src := replace(src, anchor, ', p.selectable, p.source INTO grp');
  anchor := 'IF grp.visibility = ''hidden'' THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer'';' || chr(10) || '    END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'aggregate: grp hidden anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '    IF grp.source = ''linked_objects'' THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and its read-time computation is not built'', p_group_by;' || chr(10) ||
    '    END IF;');
  anchor := ', p.visibility INTO agg';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'aggregate: agg select anchor found % times', n; END IF;
  src := replace(src, anchor, ', p.visibility, p.source INTO agg');
  anchor := 'IF agg.visibility = ''hidden'' THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer'';' || chr(10) || '    END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'aggregate: agg hidden anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '    IF agg.source = ''linked_objects'' THEN' || chr(10) ||
    '      RAISE EXCEPTION ''Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and its read-time computation is not built'', p_agg_property;' || chr(10) ||
    '    END IF;');
  EXECUTE src;

  -- ── histogram_object_set: the property ──────────────────────────────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'histogram_object_set';
  anchor := ', p.visibility INTO prop';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'histogram: select anchor found % times', n; END IF;
  src := replace(src, anchor, ', p.visibility, p.source INTO prop');
  anchor := 'IF prop.visibility = ''hidden'' THEN' || chr(10) ||
    '    RAISE EXCEPTION ''Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer'';' || chr(10) || '  END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'histogram: hidden anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '  IF prop.source = ''linked_objects'' THEN' || chr(10) ||
    '    RAISE EXCEPTION ''Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and its read-time computation is not built'', p_property;' || chr(10) ||
    '  END IF;');
  EXECUTE src;

  -- ── apply_action: a rule property may not target a derived property ─────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_action';
  anchor := 'coalesce(prop.is_primary_key, mapped.is_primary_key) AS is_pk';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action: select anchor found % times', n; END IF;
  src := replace(src, anchor,
    anchor || ',' || chr(10) || '             coalesce(prop.source, mapped.source) AS prop_source');
  anchor := '      CONTINUE WHEN rp.prop_key IS NULL;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_action: continue anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '      -- "Derived properties are read-only and cannot be edited by' || chr(10) ||
    '      -- functions or actions" (757).' || chr(10) ||
    '      IF rp.prop_source = ''linked_objects'' THEN' || chr(10) ||
    '        RAISE EXCEPTION ''Actions:DerivedPropertyReadOnly — % is a derived property: read-only, and not editable by functions or actions'', rp.prop_key;' || chr(10) ||
    '      END IF;');
  EXECUTE src;

  -- ── apply_function_edits: the translate refuses a derived key ───────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_function_edits';
  anchor := 'SELECT p2.property_id, p2.is_primary_key, p2.base_type, p2.datasource_id';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_function_edits: select anchor found % times', n; END IF;
  src := replace(src, anchor,
    'SELECT p2.property_id, p2.is_primary_key, p2.base_type, p2.datasource_id, p2.source');
  anchor := 'RAISE EXCEPTION ''Actions:UnknownProperty — % is not a property of %'', k, api;' || chr(10) ||
    '          END IF;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply_function_edits: unknown anchor found % times', n; END IF;
  src := replace(src, anchor, anchor || chr(10) ||
    '          -- "Derived properties are read-only and cannot be edited by' || chr(10) ||
    '          -- functions or actions" (757).' || chr(10) ||
    '          IF prop.source = ''linked_objects'' THEN' || chr(10) ||
    '            RAISE EXCEPTION ''Actions:DerivedPropertyReadOnly — % is a derived property: read-only, and not editable by functions or actions'', k;' || chr(10) ||
    '          END IF;');
  EXECUTE src;

  -- ── ontology_warnings: a hop over a backing we cannot read yet ──────────
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'ontology_warnings';
  src := rtrim(src, ' ' || chr(10));
  IF right(src, 10) <> '$function$' THEN
    RAISE EXCEPTION 'ontology_warnings: the definition does not end where expected';
  END IF;
  addition :=
    '  UNION ALL' || chr(10) ||
    '  -- A hop may legally cite a link whose backing this platform cannot' || chr(10) ||
    '  -- traverse yet. Foundry traverses object-backed links, so the save is' || chr(10) ||
    '  -- not blocked — warned (757).' || chr(10) ||
    '  SELECT t.api_name, ''property'', pr.property_id,' || chr(10) ||
    '         format(''Derived through link "%s", whose %s backing this platform cannot read yet'',' || chr(10) ||
    '                l.api_name, coalesce(l.backing_kind, ''missing''))' || chr(10) ||
    '    FROM public.derived_property_hops h' || chr(10) ||
    '    JOIN public.object_type_properties pr ON pr.id = h.property_id' || chr(10) ||
    '    JOIN public.object_types t ON t.id = pr.object_type_id' || chr(10) ||
    '    JOIN public.link_types l ON l.id = h.link_type_id' || chr(10) ||
    '   WHERE l.backing_kind IS DISTINCT FROM ''foreign_key''' || chr(10) ||
    '     AND l.backing_kind IS DISTINCT FROM ''join_table''' || chr(10);
  src := left(src, length(src) - 10) || addition || '$function$';
  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — every refusal fires, and the warning warns ────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  file_id uuid; phys text; ta uuid; tb uuid; ln uuid; b uuid; st text; err text;
  act uuid; fn uuid; ver uuid; app uuid; n int; drv uuid; lp uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m757 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm757-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm757-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M757 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm757p', 'm757 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm757ds', 'm757ds') RETURNING id INTO ds;
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

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M757Thing', 'M757 thing', true) RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M757Far', 'M757 far') RETURNING id INTO tb;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  -- An object-backed link, and a derived property hopping over it.
  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_object_type_id,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm757-via', 'M757 via', 'many_to_one', 'object_backed', tb,
          'as', 'As', 'bs', 'Bs')
  RETURNING id INTO ln;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, derived_aggregation)
  VALUES (ta, 'far_count', 'Far count', 'farCount', 'integer', 'linked_objects', 'count')
  RETURNING id INTO drv;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
  VALUES (drv, 1, ln);

  SELECT public.run_index_build(ARRAY[ta]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj WHERE bj.build_id = b;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'no index to read: %', coalesce(err, '?'); END IF;

  -- 1. The five read refusals, each by name where a 42703 crash used to be.
  BEGIN
    PERFORM public.count_object_set(ta,
      '[{"type":"propertyFilter","propertyType":"far_count","value":{"type":"valuesFilter","values":["3"]}}]'::jsonb);
    RAISE EXCEPTION 'a derived filter target was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Ontology:DerivedPropertyNotComputable%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.evaluate_object_set(ta, '[]'::jsonb,
      '[{"property":"far_count"}]'::jsonb);
    RAISE EXCEPTION 'a derived sort target was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Ontology:DerivedPropertyNotComputable%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.aggregate_object_set(ta, '[]'::jsonb, 'far_count');
    RAISE EXCEPTION 'a derived group-by was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Ontology:DerivedPropertyNotComputable%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.aggregate_object_set(ta, '[]'::jsonb, 'id', 'far_count');
    RAISE EXCEPTION 'a derived aggregation target was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Ontology:DerivedPropertyNotComputable%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.histogram_object_set(ta, '[]'::jsonb, 'far_count');
    RAISE EXCEPTION 'a derived histogram property was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Ontology:DerivedPropertyNotComputable%' THEN RAISE; END IF;
  END;
  -- And an untouched read still reads: the derived column is simply absent.
  SELECT count(*) INTO n FROM public.evaluate_object_set(ta);
  IF n <> 1 THEN RAISE EXCEPTION 'the plain read broke'; END IF;

  -- 2. The edit refusals: an action rule and a function edit, both by name.
  INSERT INTO public.action_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'm757-edit', 'M757 edit') RETURNING id INTO act;
  INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id, position)
  VALUES (act, 'modify_object', ta, 0);
  INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, static_value)
  SELECT r.id, drv, 'static', to_jsonb(9)
    FROM public.action_type_rules r WHERE r.action_type_id = act;
  BEGIN
    PERFORM public.apply_action(act, '{}'::jsonb, 'R1');
    RAISE EXCEPTION 'an action edited a derived property';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Actions:DerivedPropertyReadOnly%' THEN RAISE; END IF;
  END;

  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm757EditFn', 'M757 edit fn') RETURNING id INTO fn;
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          '{"object_types":[],"link_types":[]}'::jsonb,
          '{"object_types":["M757Thing"]}'::jsonb) RETURNING id INTO ver;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'm757-run', 'M757 run') RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm757EditFn', ver);
  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  BEGIN
    PERFORM public.apply_function_edits(act, jsonb_build_array(
      jsonb_build_object('modifyObject', jsonb_build_object(
        'objectType', 'M757Thing', 'primaryKey', 'R1',
        'properties', jsonb_build_object('farCount', 9)))), app);
    RAISE EXCEPTION 'a function edited a derived property';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%Actions:DerivedPropertyReadOnly%' THEN RAISE; END IF;
  END;

  -- 3. The warning warns — and does not block.
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.subject = 'far_count' AND w.problem LIKE '%cannot read yet%';
  IF n <> 1 THEN RAISE EXCEPTION 'the untraversable-hop warning did not fire (% rows)', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_violations() v WHERE v.subject = 'far_count';
  IF n <> 0 THEN RAISE EXCEPTION 'the hop landed on the BLOCKING list, which is stricter than Foundry'; END IF;

  DELETE FROM public.object_edits WHERE object_type_id IN (ta, tb);
  DELETE FROM public.action_types WHERE ontology_id = ont;
  DELETE FROM public.functions WHERE id = fn;
  -- The hop restricts its link's delete by design (576); it goes first.
  DELETE FROM public.derived_property_hops WHERE property_id = drv;
  DELETE FROM public.object_types WHERE id IN (ta, tb);
  DELETE FROM public.link_types WHERE id = ln;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
