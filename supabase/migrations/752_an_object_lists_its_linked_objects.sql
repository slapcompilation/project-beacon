-- 752 — an object lists its linked objects.
--
-- The per-object read the Object View's linked panel needs, and the api
-- defines:
--
--   "Lists the linked objects for a specific object and the given link type."
--   — api/ontologies-v2-resources-linked-objects-list-linked-objects.md
--
-- The response is a page of whole far objects — the endpoint carries no
-- totalCount and no edge object, which the link-reading recorded — so the
-- lister returns far rows exactly the shape evaluate_object_set returns, and
-- the count is a companion function the panel asks separately. Both arms the
-- read path has: foreign-key backing joins on the FK and the far primary
-- key; join-table backing goes through the pair store 750 built. An
-- object-backed link keeps the scoped refusal 751 left it.
--
-- The far type is what gets loaded, so the usage recording (746) lands on
-- the FAR type when the caller names itself — "A read is recorded when an
-- application loads objects for a specified object type", and the objects
-- loaded here are the far side's. The count companion records nothing: the
-- page counts one read per load request, and the panel's badge rides the
-- same request.
--
-- What the reader shares with evaluate_object_set, it takes from the same
-- places: the far type's hidden properties leave the row, and the far type's
-- restricted-view gate arrives through object_set_where — "every reader
-- shares this WHERE", including this one.

CREATE FUNCTION public.list_linked_objects(
  p_object_type uuid, p_primary_key text, p_link text,
  p_limit integer DEFAULT 100, p_offset integer DEFAULT 0,
  p_application text DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $fn$
DECLARE
  lk record; far uuid; ont uuid;
  far_tbl text; my_tbl text; lk_tbl text;
  far_pk text; my_pk text; fk_prop text;
  hidden text[]; wh text; link_cond text; q text; r jsonb;
BEGIN
  SELECT l.* INTO lk
    FROM public.link_types l
    JOIN public.object_types t ON t.id = p_object_type AND t.ontology_id = l.ontology_id
   WHERE (l.api_name = p_link OR l.id::text = p_link)
     AND (l.source_object_type_id = p_object_type OR l.target_object_type_id = p_object_type);
  IF lk IS NULL THEN
    RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type of this object type', p_link;
  END IF;
  SELECT t.ontology_id INTO ont FROM public.object_types t WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  far := CASE WHEN lk.source_object_type_id = p_object_type
              THEN lk.target_object_type_id ELSE lk.source_object_type_id END;

  -- The objects loaded are the far side's, so the read records there (746).
  IF p_application IS NOT NULL THEN
    BEGIN
      PERFORM public.record_ontology_usage(far, NULL, p_application, 1, 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  SELECT x.index_table INTO far_tbl
    FROM public.object_type_indexes x
   WHERE x.object_type_id = far AND public.object_type_index_ready(x.object_type_id);
  SELECT p.property_id INTO far_pk
    FROM public.object_type_properties p
   WHERE p.object_type_id = far AND p.is_primary_key;
  IF far_tbl IS NULL OR far_pk IS NULL THEN
    RAISE EXCEPTION 'Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join', lk.api_name;
  END IF;

  IF lk.backing_kind = 'join_table' THEN
    SELECT i.index_table INTO lk_tbl
      FROM public.link_type_indexes i
     WHERE i.link_type_id = lk.id AND public.link_type_index_ready(lk.id);
    IF lk_tbl IS NULL THEN
      RAISE EXCEPTION 'Ontology:LinkNotIndexed — % has no successful pair index to read', lk.api_name;
    END IF;
    IF lk.source_object_type_id = p_object_type THEN
      link_cond := format('o.%I::text IN (SELECT j.%I::text FROM objects.%I j WHERE j.%I::text = %L)',
                          far_pk, lk.target_key_column, lk_tbl, lk.source_key_column, p_primary_key);
    ELSE
      link_cond := format('o.%I::text IN (SELECT j.%I::text FROM objects.%I j WHERE j.%I::text = %L)',
                          far_pk, lk.source_key_column, lk_tbl, lk.target_key_column, p_primary_key);
    END IF;

  ELSIF lk.backing_kind = 'foreign_key' THEN
    SELECT p.property_id INTO fk_prop
      FROM public.object_type_properties p
     WHERE p.object_type_id = lk.source_object_type_id AND p.backing_column = lk.backing_column;
    IF fk_prop IS NULL THEN
      RAISE EXCEPTION 'Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join', lk.api_name;
    END IF;
    IF lk.source_object_type_id = p_object_type THEN
      -- The FK sits on MY row; the far objects are the ones my key names.
      SELECT x.index_table INTO my_tbl
        FROM public.object_type_indexes x
       WHERE x.object_type_id = p_object_type AND public.object_type_index_ready(x.object_type_id);
      SELECT p.property_id INTO my_pk
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type AND p.is_primary_key;
      IF my_tbl IS NULL OR my_pk IS NULL THEN
        RAISE EXCEPTION 'Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join', lk.api_name;
      END IF;
      link_cond := format('o.%I::text IN (SELECT m.%I::text FROM objects.%I m WHERE m.%I::text = %L)',
                          far_pk, fk_prop, my_tbl, my_pk, p_primary_key);
    ELSE
      -- The FK sits on the far rows; the far objects are the ones naming me.
      link_cond := format('o.%I::text = %L', fk_prop, p_primary_key);
    END IF;

  ELSE
    RAISE EXCEPTION 'Ontology:LinkFilterBackingUnsupported — an object-backed link resolves through its intermediary object type, which is not built; % is backed by %',
      lk.api_name, coalesce(lk.backing_kind, 'nothing');
  END IF;

  -- The far type's own reading rules: hidden properties leave the row, and
  -- the restricted-view gate arrives through the shared WHERE.
  SELECT coalesce(array_agg(p.property_id), '{}') INTO hidden
    FROM public.object_type_properties p
   WHERE p.object_type_id = far AND p.visibility = 'hidden';
  wh := public.object_set_where(far, '[]'::jsonb);

  q := format('SELECT to_jsonb(o) - %L::text[] FROM objects.%I o WHERE (%s) AND %s ORDER BY o.%I LIMIT %s OFFSET %s',
              hidden, far_tbl, wh, link_cond, far_pk, p_limit, p_offset);
  FOR r IN EXECUTE q LOOP
    RETURN NEXT r;
  END LOOP;
END $fn$;

COMMENT ON FUNCTION public.list_linked_objects(uuid, text, text, integer, integer, text) IS
  'Lists the linked objects for a specific object and the given link type (api list-linked-objects): a page of whole far objects, no totalCount — count_linked_objects is the companion. FK and join-table backing; object-backed refused. 752.';

CREATE FUNCTION public.count_linked_objects(p_object_type uuid, p_primary_key text, p_link text)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $fn$
DECLARE n bigint := 0; r jsonb;
BEGIN
  -- The lister is the one shape; the badge is a count over the same rows.
  -- Counting through the lister keeps one implementation of the join arms —
  -- the panel's badge cannot disagree with its rows.
  FOR r IN SELECT * FROM public.list_linked_objects(p_object_type, p_primary_key, p_link, 2147483647, 0, NULL) LOOP
    n := n + 1;
  END LOOP;
  RETURN n;
END $fn$;

REVOKE ALL ON FUNCTION public.list_linked_objects(uuid, text, text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_linked_objects(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_linked_objects(uuid, text, text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_linked_objects(uuid, text, text) TO authenticated, service_role;

-- ── PROVED BY DOING — both backings, both directions, paging, hidden strip ──

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; jds uuid; bra uuid; brb uuid; jbr uuid;
  dsrc uuid; txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; ln uuid; fk uuid; b uuid; st text; err text; n bigint; row_out jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m752 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm752-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm752-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M752 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false, metrics_enabled = true
   WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm752p', 'm752 probe') RETURNING id INTO proj;

  -- Side A carries a foreign key at b_id; side B carries a hidden note.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm752a', 'm752a') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa, 'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsa, txn, '[{"name":"pk","type":"STRING"},{"name":"b_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsa, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, b_id)
                  VALUES ($1,''A1'',''B1''), ($1,''A2'',''B2''), ($1,''A3'',NULL)', phys)
    USING file_id;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm752b', 'm752b') RETURNING id INTO dsb;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsb, 'master') RETURNING id INTO brb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsb, brb, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsb, txn, '[{"name":"b_id","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsb, txn, 'rows.parquet', 3) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(dsb, txn) INTO phys;
  EXECUTE format('INSERT INTO datasets.%I (_file, b_id, note)
                  VALUES ($1,''B1'',''n1''), ($1,''B2'',''n2''), ($1,''B3'',''n3'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M752A', 'M752 A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ta, dsa, bra) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ta, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (ta, 'b_id', 'B ref', 'bRef', 'string', 'column', 'b_id', dsrc);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M752B', 'M752 B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (tb, dsb, brb) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (tb, 'pk', 'Id', 'id', 'string', 'column', 'b_id', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id, visibility)
  VALUES (tb, 'note', 'Note', 'note', 'string', 'column', 'note', dsrc, 'hidden');
  SELECT public.run_index_build(ARRAY[ta, tb]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    SELECT bj.error INTO err FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED' LIMIT 1;
    RAISE EXCEPTION 'the side indexes did not land: %', coalesce(err, '?');
  END IF;

  -- The join dataset: A1-B1, A1-B2, A2-B1.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm752join', 'm752join') RETURNING id INTO jds;
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
  VALUES (ont, proj, ta, tb, 'm752-pairs', 'M752 pairs', 'many_to_many', 'join_table',
          jds, jbr, 'a_key', 'b_key', 'bs', 'Bs', 'as', 'As')
  RETURNING id INTO ln;
  SELECT public.run_link_index_build(ARRAY[ln]::uuid[], true) INTO b;
  SELECT bj.state, bj.error INTO st, err FROM public.build_jobs bj
   WHERE bj.build_id = b AND bj.output_link_type_id = ln;
  IF st <> 'COMPLETED' THEN RAISE EXCEPTION 'the pair build did not land: %', coalesce(err, '?'); END IF;

  INSERT INTO public.link_types
    (ontology_id, project_id, source_object_type_id, target_object_type_id,
     api_name, label, cardinality, backing_kind, backing_column,
     source_api_name, source_label, target_api_name, target_label)
  VALUES (ont, proj, ta, tb, 'm752-ref', 'M752 ref', 'many_to_one', 'foreign_key', 'b_id',
          'bs2', 'Bs2', 'as2', 'As2')
  RETURNING id INTO fk;

  -- Join-table, source side: A1 lists B1 and B2, whole rows, hidden stripped.
  SELECT count(*) INTO n FROM public.list_linked_objects(ta, 'A1', 'm752-pairs');
  IF n <> 2 THEN RAISE EXCEPTION 'A1 should list 2 linked objects, got %', n; END IF;
  SELECT e INTO row_out FROM public.list_linked_objects(ta, 'A1', 'm752-pairs', 1, 0) e;
  IF row_out->>'pk' IS DISTINCT FROM 'B1' THEN
    RAISE EXCEPTION 'the first page should hold B1, got %', row_out;
  END IF;
  IF row_out ? 'note' THEN
    RAISE EXCEPTION 'a hidden far property reached the row: %', row_out;
  END IF;
  -- Paging: the second page holds the second row.
  SELECT e INTO row_out FROM public.list_linked_objects(ta, 'A1', 'm752-pairs', 1, 1) e;
  IF row_out->>'pk' IS DISTINCT FROM 'B2' THEN
    RAISE EXCEPTION 'the second page should hold B2, got %', row_out;
  END IF;
  -- Target side, and the unlinked.
  SELECT count(*) INTO n FROM public.list_linked_objects(tb, 'B1', 'm752-pairs');
  IF n <> 2 THEN RAISE EXCEPTION 'B1 should list 2 linked objects, got %', n; END IF;
  SELECT count(*) INTO n FROM public.list_linked_objects(ta, 'A3', 'm752-pairs');
  IF n <> 0 THEN RAISE EXCEPTION 'A3 has no links and listed %', n; END IF;
  -- The badge agrees with the rows.
  SELECT public.count_linked_objects(ta, 'A1', 'm752-pairs') INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'the count disagrees with the rows: %', n; END IF;

  -- Foreign-key backing, both directions.
  SELECT e INTO row_out FROM public.list_linked_objects(ta, 'A1', 'm752-ref') e;
  IF row_out->>'pk' IS DISTINCT FROM 'B1' THEN
    RAISE EXCEPTION 'A1''s FK names B1, got %', row_out;
  END IF;
  SELECT count(*) INTO n FROM public.list_linked_objects(tb, 'B1', 'm752-ref');
  IF n <> 1 THEN RAISE EXCEPTION 'B1 should be named by A1 alone, got %', n; END IF;

  -- A named caller records a read on the FAR type.
  PERFORM * FROM public.list_linked_objects(ta, 'A1', 'm752-pairs', 100, 0, 'object-views');
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = tb;
  IF n <> 1 THEN RAISE EXCEPTION 'the far-type read was not recorded (% reads)', n; END IF;
  SELECT coalesce(sum(reads), 0) INTO n FROM public.ontology_usage WHERE object_type_id = ta;
  IF n <> 0 THEN RAISE EXCEPTION 'the near type was recorded, wrongly'; END IF;

  DELETE FROM public.ontology_usage WHERE object_type_id = tb;
  DELETE FROM public.link_types WHERE id IN (ln, fk);
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
