-- 751 — a search-around reads the pair store.
--
-- 750 built the pair store; this migration makes the read path read it. The
-- semantics come from the page that defines the operation:
--
--   "OSS implements Search Around operations using a left-semi join, which
--    returns only the objects from the result set that have matching links,
--    without duplicating data from the starting set."
--   — ontologies/oss-limitations.md
--
-- So the link presence filter's join-table arm is a left-semi join through
-- objects.lt_<uuid> and the far side's own index — the same existence
-- semantics the foreign-key arm has always had: a link counts when the pair
-- row AND the far object both exist. The refusal our 475 invented for every
-- non-FK backing (a name the mirror does not contain, branching on a
-- distinction the public API deliberately hides) now covers only what is
-- genuinely unbuilt: the object-backed link, whose resolution is a two-hop
-- probe through its intermediary object type — the shape oss-limitations
-- lists among the features that force Spark even in Foundry. That arc is its
-- own.
--
-- One seam, every reader: evaluate, count, aggregate and histogram all take
-- their WHERE from object_set_where, so traversal arrives in all four at
-- once.

DO $patch$
DECLARE src text; n int; anchor text; addition text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'object_set_where';

  -- The pair store's table name needs a variable of its own.
  anchor := '  other_tbl text; fk_prop text; one_pk text; cond text;';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'declare anchor found % times', n; END IF;
  src := replace(src, anchor, '  other_tbl text; fk_prop text; one_pk text; cond text; lk_tbl text;');

  -- The join-table arm goes ahead of the refusal, and leaves through
  -- CONTINUE so the foreign-key code below never sees it.
  anchor := '      IF lk.backing_kind IS DISTINCT FROM ''foreign_key'' THEN';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'refusal anchor found % times', n; END IF;
  addition :=
    '      -- The join-table arm (751): a left-semi join through the pair store' || chr(10) ||
    '      -- and the far side''s index — a link counts when the pair row and' || chr(10) ||
    '      -- the far object both exist, the FK arm''s own semantics.' || chr(10) ||
    '      IF lk.backing_kind = ''join_table'' THEN' || chr(10) ||
    '        SELECT i.index_table INTO lk_tbl' || chr(10) ||
    '          FROM public.link_type_indexes i' || chr(10) ||
    '         WHERE i.link_type_id = lk.id AND public.link_type_index_ready(lk.id);' || chr(10) ||
    '        IF lk_tbl IS NULL THEN' || chr(10) ||
    '          RAISE EXCEPTION ''Ontology:LinkNotIndexed — % has no successful pair index to read'', lk.api_name;' || chr(10) ||
    '        END IF;' || chr(10) ||
    '        SELECT p.property_id INTO fk_prop' || chr(10) ||
    '          FROM public.object_type_properties p' || chr(10) ||
    '         WHERE p.object_type_id = p_object_type AND p.is_primary_key;' || chr(10) ||
    '        SELECT p.property_id INTO one_pk' || chr(10) ||
    '          FROM public.object_type_properties p' || chr(10) ||
    '         WHERE p.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type' || chr(10) ||
    '                                       THEN lk.target_object_type_id ELSE lk.source_object_type_id END' || chr(10) ||
    '           AND p.is_primary_key;' || chr(10) ||
    '        SELECT x.index_table INTO other_tbl' || chr(10) ||
    '          FROM public.object_type_indexes x' || chr(10) ||
    '         WHERE x.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type' || chr(10) ||
    '                                       THEN lk.target_object_type_id ELSE lk.source_object_type_id END' || chr(10) ||
    '           AND public.object_type_index_ready(x.object_type_id);' || chr(10) ||
    '        IF fk_prop IS NULL OR one_pk IS NULL OR other_tbl IS NULL THEN' || chr(10) ||
    '          RAISE EXCEPTION ''Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join'', lk.api_name;' || chr(10) ||
    '        END IF;' || chr(10) ||
    '        IF lk.source_object_type_id = p_object_type THEN' || chr(10) ||
    '          cond := format(''EXISTS (SELECT 1 FROM objects.%I j JOIN objects.%I x ON x.%I::text = j.%I::text WHERE j.%I::text = o.%I::text)'',' || chr(10) ||
    '                         lk_tbl, other_tbl, one_pk, lk.target_key_column, lk.source_key_column, fk_prop);' || chr(10) ||
    '        ELSE' || chr(10) ||
    '          cond := format(''EXISTS (SELECT 1 FROM objects.%I j JOIN objects.%I x ON x.%I::text = j.%I::text WHERE j.%I::text = o.%I::text)'',' || chr(10) ||
    '                         lk_tbl, other_tbl, one_pk, lk.source_key_column, lk.target_key_column, fk_prop);' || chr(10) ||
    '        END IF;' || chr(10) ||
    '        IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;' || chr(10) ||
    '        parts := parts || cond;' || chr(10) ||
    '        CONTINUE;' || chr(10) ||
    '      END IF;' || chr(10);
  src := replace(src, anchor, addition || anchor);

  -- The refusal now names only what is actually unbuilt.
  anchor := '        RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — a presence filter reads foreign-key backing; % is backed by %'',';
  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'message anchor found % times', n; END IF;
  src := replace(src, anchor,
    '        RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — an object-backed link resolves through its intermediary object type, which is not built; % is backed by %'',');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — both directions, both match types, and the refusals ───

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; jds uuid; bra uuid; brb uuid; jbr uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; ln uuid; ln2 uuid; b uuid; st text; err text; n bigint;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m751 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm751-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm751-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M751 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm751p', 'm751 probe') RETURNING id INTO proj;

  -- Side A: A1..A3. Side B: B1..B3. Pairs: A1-B1, A1-B2, A2-B1.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm751a', 'm751a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1,''A1''),($1,''A2''),($1,''A3'')', phys)
    USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm751b', 'm751b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk) VALUES ($1,''B1''),($1,''B2''),($1,''B3'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M751A', 'M751 A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, dsa, bra);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M751B', 'M751 B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tb, dsb, brb);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  SELECT public.run_index_build(ARRAY[ta, tb]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    SELECT bj.error INTO err FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED' LIMIT 1;
    RAISE EXCEPTION 'the side indexes did not land: %', coalesce(err, '?');
  END IF;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm751join', 'm751join') RETURNING id INTO jds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (jds, 'master') RETURNING id INTO jbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (jds, jbr, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (jds, txn, '[{"name":"a_key","type":"STRING"},{"name":"b_key","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (jds, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(jds, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, a_key, b_key)
                  VALUES ($1,''A1'',''B1''), ($1,''A1'',''B2''), ($1,''A2'',''B1'')', phys)
    USING file_id;

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, dataset_id, branch_id,
     source_key_column, target_key_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm751-pairs', 'M751 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'a_key', 'b_key', 'bs', 'Bs', 'as', 'As')
  RETURNING id INTO ln;

  -- An unbuilt pair store refuses by name, before anything is wrong.
  BEGIN
    PERFORM public.count_object_set(ta,
      '[{"type":"linkFilter","linkType":"m751-pairs","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb);
    RAISE EXCEPTION 'an unindexed link was traversed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%Ontology:LinkNotIndexed%' THEN RAISE; END IF;
  END;

  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj
   WHERE bj.build_id = b AND bj.output_link_type_id = ln;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'the pair build did not land: %', coalesce(err, '?'); END IF;

  -- "returns only the objects from the result set that have matching links" —
  -- from the source side: A1 and A2 have links, A3 does not.
  SELECT public.count_object_set(ta,
    '[{"type":"linkFilter","linkType":"m751-pairs","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'MUST_HAVE from the source side counted %', n; END IF;
  SELECT public.count_object_set(ta,
    '[{"type":"linkFilter","linkType":"m751-pairs","value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'MUST_NOT_HAVE from the source side counted %', n; END IF;

  -- And from the target side: B1 and B2 are linked, B3 is not.
  SELECT public.count_object_set(tb,
    '[{"type":"linkFilter","linkType":"m751-pairs","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'MUST_HAVE from the target side counted %', n; END IF;

  -- The rescoped refusal: an object-backed link still refuses by name.
  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_object_type_id,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm751-via', 'M751 via', 'many_to_one', 'object_backed', tb,
          'bs2', 'Bs2', 'as2', 'As2')
  RETURNING id INTO ln2;
  BEGIN
    PERFORM public.count_object_set(ta,
      '[{"type":"linkFilter","linkType":"m751-via","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb);
    RAISE EXCEPTION 'an object-backed link was traversed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%Ontology:LinkFilterBackingUnsupported%' THEN RAISE; END IF;
  END;

  DELETE FROM public.link_types WHERE id IN (ln, ln2);
  DELETE FROM public.object_types WHERE id IN (ta, tb);
  DELETE FROM public.datasets WHERE id IN (dsa, dsb, jds);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
