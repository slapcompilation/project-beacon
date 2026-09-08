-- A derived property hops through the object in the middle.
--
-- 758 taught `derived_property_select` two hop shapes — a foreign key and a
-- join table's pair store — and returned NULL for the third, so a derived
-- property whose chain crossed an object-backed link read as NULL rather than
-- failing. 757 put the reason on the ADVISORY list rather than the blocking
-- one, because Foundry traverses object-backed links and refusing the save
-- would be stricter than the page:
--
--   "**Backing object type:** Object-backed link types expand on many-to-one cardinality link types, providing first class support for object types as a link type storage solution."
--   — object-link-types/create-link-type.md
--
-- 765 built that traversal for the two readers and gave the link type the two
-- edges it walks. The same walk fits the evaluator's hop chain, so the third
-- arm is the join-table arm with the middle object's index in place of the
-- pair store and the two edge foreign keys in place of the two key columns:
-- the middle rows that name the near object, joined to the far index by their
-- far key. Every rule the other two arms follow is kept — the far object must
-- exist, and each hop still composes the far type's restricted-view predicate,
-- which is what
--
--   "These properties use the security context of all objects involved in the calculation, ensuring users only see information for which they have access authorization."
--   — object-link-types/derived-properties.md
--
-- asks of a chain that now crosses three kinds of link.
--
-- And the warning narrows to what is left. 757's arm fires for any hop whose
-- link is neither foreign-key nor join-table backed; with object-backed links
-- readable it would now warn about something that works, which is worse than
-- not warning at all — a warning nobody can act on teaches people to ignore
-- the list. What still cannot be read is a link with no backing declared, and
-- the arm names only that.

-- ── the third hop shape ─────────────────────────────────────────────────────

DO $patch$
DECLARE src text; a text;
BEGIN
  src := replace(pg_get_functiondef('public.derived_property_select(uuid,text)'::regprocedure), chr(13), '');

  a := '  far_tbl text; far_pk text; fk_prop text; store text;';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '767: the declaration anchor is not exactly once in derived_property_select';
  END IF;
  src := replace(src, a, a || chr(10) || '  ob_near text; ob_far text;');

  a := '    ELSE
      RETURN NULL;   -- object-backed or unbacked: 757''s warning names it
    END IF;';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '767: the fallthrough anchor is not exactly once in derived_property_select';
  END IF;
  src := replace(src, a,
'    ELSIF lk.backing_kind = ''object_backed'' THEN
      -- 765''s two-hop walk, as a link in the chain: the middle object''s index
      -- stands where the pair store stands for a join table, and the two edge
      -- foreign keys stand where its two key columns do.
      SELECT x.index_table INTO store FROM public.object_type_indexes x
       WHERE x.object_type_id = lk.backing_object_type_id
         AND public.object_type_index_ready(lk.backing_object_type_id);
      SELECT pp.property_id INTO ob_near
        FROM public.link_types el
        JOIN public.object_type_properties pp
          ON pp.object_type_id = el.source_object_type_id
         AND pp.backing_column = el.backing_column
       WHERE el.id = CASE WHEN lk.source_object_type_id = cur
                          THEN lk.source_edge_link_type_id ELSE lk.target_edge_link_type_id END;
      SELECT pp.property_id INTO ob_far
        FROM public.link_types el
        JOIN public.object_type_properties pp
          ON pp.object_type_id = el.source_object_type_id
         AND pp.backing_column = el.backing_column
       WHERE el.id = CASE WHEN lk.source_object_type_id = cur
                          THEN lk.target_edge_link_type_id ELSE lk.source_edge_link_type_id END;
      IF store IS NULL OR ob_near IS NULL OR ob_far IS NULL THEN RETURN NULL; END IF;
      jal := format(''m%s'', step);
      IF step = 1 THEN
        body := format(''FROM objects.%I %s JOIN objects.%I %s ON %s.%I::text = %s.%I::text'',
                       store, jal, far_tbl, hop_alias, hop_alias, far_pk, jal, ob_far);
        conds := format(''%s.%I::text = %s.%I::text'', jal, ob_near, prev_alias, prev_pk);
      ELSE
        body := body || format('' JOIN objects.%I %s ON %s.%I::text = %s.%I::text JOIN objects.%I %s ON %s.%I::text = %s.%I::text'',
                       store, jal, jal, ob_near, prev_alias, prev_pk,
                       far_tbl, hop_alias, hop_alias, far_pk, jal, ob_far);
      END IF;

' || a);

  EXECUTE src;
END $patch$;

-- ── and the warning names only what is left ─────────────────────────────────

DO $patch$
DECLARE src text; a text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'ontology_warnings';

  a := '   WHERE l.backing_kind IS DISTINCT FROM ''foreign_key''
     AND l.backing_kind IS DISTINCT FROM ''join_table''';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '767: the warning anchor is not exactly once in ontology_warnings';
  END IF;
  src := replace(src, a, a || chr(10) ||
    '     AND l.backing_kind IS DISTINCT FROM ''object_backed''');
  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — a count over the manifest between two types ───────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; dsm uuid; bra uuid; brb uuid; brm uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; tm uuid; ea uuid; eb uuid; ln uuid; drv uuid; b uuid;
  n int; got jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m767 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm767-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm767-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M767 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm767p', 'm767 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm767a', 'm767a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"a_pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, a_pk) VALUES ($1,''A1''), ($1,''A2'')', phys) USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm767b', 'm767b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"b_pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, b_pk) VALUES ($1,''B1''), ($1,''B2'')', phys) USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm767m', 'm767m') RETURNING id INTO dsm;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsm, 'master') RETURNING id INTO brm;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsm, brm, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsm, txn, '[{"name":"pk","type":"STRING"},{"name":"a_pk","type":"STRING"},{"name":"b_pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsm, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(dsm, txn) INTO phys;
  -- A1 reaches B1 and B2; A2's manifest names a B that does not exist.
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, a_pk, b_pk) VALUES ($1,''M1'',''A1'',''B1''), ($1,''M2'',''A1'',''B2''), ($1,''M3'',''A2'',''GONE'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M767A', 'M767 A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ta, dsa, bra);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (ta, 'a_pk', 'Id', 'id', 'string', 'column', 'a_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ta), true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M767B', 'M767 B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (tb, dsb, brb);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (tb, 'b_pk', 'Id', 'id', 'string', 'column', 'b_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = tb), true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M767M', 'M767 Manifest') RETURNING id INTO tm;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (tm, dsm, brm);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (tm, 'pk', 'Id', 'id', 'string', 'column', 'pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = tm), true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (tm, 'a_pk', 'A key', 'aKey', 'string', 'column', 'a_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = tm)),
         (tm, 'b_pk', 'B key', 'bKey', 'string', 'column', 'b_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = tm));

  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, tm, ta, 'm767-of-a', 'M767 of A', 'many_to_one', 'foreign_key', 'a_pk')
  RETURNING id INTO ea;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, tm, tb, 'm767-of-b', 'M767 of B', 'many_to_one', 'foreign_key', 'b_pk')
  RETURNING id INTO eb;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_object_type_id,
                                 source_edge_link_type_id, target_edge_link_type_id,
                                 source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm767-via', 'M767 via', 'many_to_one', 'object_backed', tm, ea, eb,
          'as', 'As', 'bs', 'Bs')
  RETURNING id INTO ln;

  -- the derived property: how many Bs each A reaches through the manifest
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, derived_aggregation)
  VALUES (ta, 'b_count', 'B count', 'bCount', 'integer', 'linked_objects', 'count')
  RETURNING id INTO drv;
  INSERT INTO public.derived_property_hops (property_id, position, link_type_id) VALUES (drv, 1, ln);

  -- the warning no longer fires for a hop this platform can now read
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.subject = 'b_count' AND w.problem LIKE '%cannot read yet%';
  IF n <> 0 THEN RAISE EXCEPTION 'the untraversable-hop warning still fires for a readable hop'; END IF;

  SELECT public.run_index_build(ARRAY[ta, tb, tm]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    RAISE EXCEPTION 'the three indexes did not land';
  END IF;

  -- and the value computes: A1 reaches two Bs, A2 none that exist
  SELECT e INTO got FROM public.evaluate_object_set(ta, '[]'::jsonb, '[]'::jsonb, 50, 0) e
   WHERE e ->> 'a_pk' = 'A1';
  IF (got ->> 'b_count')::int <> 2 THEN
    RAISE EXCEPTION 'A1 should reach two Bs through the manifest, got %', got ->> 'b_count';
  END IF;
  SELECT e INTO got FROM public.evaluate_object_set(ta, '[]'::jsonb, '[]'::jsonb, 50, 0) e
   WHERE e ->> 'a_pk' = 'A2';
  IF (got ->> 'b_count')::int <> 0 THEN
    RAISE EXCEPTION 'A2 reaches nothing that exists, got %', got ->> 'b_count';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0767', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0767' THEN
  NULL;
END $$;
