-- An object-backed link names its edges, and a search-around walks them.
--
-- `object_set_where` and `list_linked_objects` both refuse an object-backed
-- link with the message 751 wrote — "an object-backed link resolves through
-- its intermediary object type, which is not built". This builds it.
--
-- WHAT AN OBJECT-BACKED LINK IS, from the page that offers the choice:
--
--   "**Backing object type:** Object-backed link types expand on many-to-one cardinality link types, providing first class support for object types as a link type storage solution."
--   — object-link-types/create-link-type.md
--
-- and what the middle object is for:
--
--   "The object in the middle serves as the intermediary and provides additional metadata about the connection between the two entities, and backs the link."
--   — object-link-types/create-link-type.md
--
-- WHY IT COULD NOT BE WALKED. Our `link_types` row carried only
-- `backing_object_type_id` — the middle type — and nothing saying how the
-- middle reaches either side. The page says the builder must have made that
-- explicit before the link can exist at all:
--
--   "3. Create the many-to-one link types between each side of the link type to the backing object type."
--   — object-link-types/create-link-type.md
--
-- and that converting an existing link asks for them by name:
--
--   "4. Select the link type from the link edges to the backing object in the **Update link type to object-backed link type** dialog."
--   — object-link-types/create-link-type.md
--
-- So the two edges are part of the link's definition, not something to
-- rediscover: a middle type may carry several links to the same side, and the
-- wizard makes the builder choose. `link_types` gains the two it chose.
--
-- WHICH WAY THE EDGES POINT is not stated in prose, and the page's own
-- example settles it. `Flight Manifest` sits between `Aircraft` and `Flight`;
-- many manifests name one aircraft and many name one flight, so in each
-- many-to-one edge the *manifest* is the many end. 417 already requires a
-- foreign-key link to keep its FK on the source and its primary key on the
-- target ("the 'one' side of the Cardinality is unique"), so each edge is
-- `source = the backing type, target = the side`, with the FK column on the
-- middle. That is asserted rather than assumed: `guard_object_backed_edges`
-- refuses any other shape by name, so a link that saves is a link that walks.
-- INFERENCE, marked: the page's sentence "between each side of the link type
-- to the backing object type" does not say which end is the source; the
-- cardinality and 417 do.
--
-- THE WALK is then the two-hop probe the link reading already predicted from
-- `oss-limitations`' Spark-forcing "intermediary link types" — near key →
-- middle rows whose near FK matches → their far FK → far index. One EXISTS
-- for a filter, one IN for a listing, and both keep the semantics the
-- join-table arm settled in 751: a link counts when the middle row *and* the
-- far object both exist, so a dangling FK is not a link.
--
-- Not changed here, recorded: the derived-property evaluator (758) still
-- refuses a hop through an object-backed link and 757's warning still fires
-- for one — that hop chain reads pair stores and FK indexes, and teaching it
-- this third shape is its own piece. `count_linked_objects` follows for free,
-- since it delegates to `list_linked_objects`.

-- ── the two edges ───────────────────────────────────────────────────────────

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.link_types WHERE backing_kind = 'object_backed';
  IF n > 0 THEN
    RAISE EXCEPTION '765: % object-backed link type(s) exist without edges; name their edges before this CHECK lands', n;
  END IF;
END $$;

ALTER TABLE public.link_types
  ADD COLUMN source_edge_link_type_id uuid REFERENCES public.link_types(id) ON DELETE RESTRICT,
  ADD COLUMN target_edge_link_type_id uuid REFERENCES public.link_types(id) ON DELETE RESTRICT,
  ADD CONSTRAINT link_types_object_backed_edges CHECK (
    (backing_kind = 'object_backed')
    = (source_edge_link_type_id IS NOT NULL AND target_edge_link_type_id IS NOT NULL));
CREATE INDEX link_types_source_edge_idx ON public.link_types (source_edge_link_type_id)
  WHERE source_edge_link_type_id IS NOT NULL;
CREATE INDEX link_types_target_edge_idx ON public.link_types (target_edge_link_type_id)
  WHERE target_edge_link_type_id IS NOT NULL;

COMMENT ON COLUMN public.link_types.source_edge_link_type_id IS
  'For an object-backed link: the many-to-one link type from the backing object type to this link''s SOURCE side — one of the two the builder must create first and then select ("Select the link type from the link edges to the backing object", object-link-types/create-link-type). 765.';
COMMENT ON COLUMN public.link_types.target_edge_link_type_id IS
  'For an object-backed link: the same, to this link''s TARGET side. Together with the source edge these are what a search-around walks: near key → the middle object''s rows → the far key. 765.';
COMMENT ON CONSTRAINT link_types_object_backed_edges ON public.link_types IS
  'Both edges belong to an object-backed link and to no other kind — the page makes them a prerequisite of creating one, so a link without them could never be walked. 765.';

-- ── and the shape they must have ────────────────────────────────────────────

CREATE FUNCTION public.guard_object_backed_edges()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE e record; side uuid; which text;
BEGIN
  IF NEW.backing_kind IS DISTINCT FROM 'object_backed' THEN RETURN NEW; END IF;

  FOREACH which IN ARRAY ARRAY['source', 'target'] LOOP
    side := CASE which WHEN 'source' THEN NEW.source_object_type_id ELSE NEW.target_object_type_id END;
    SELECT * INTO e FROM public.link_types
     WHERE id = CASE which WHEN 'source' THEN NEW.source_edge_link_type_id
                           ELSE NEW.target_edge_link_type_id END;
    IF e.id IS NULL THEN
      RAISE EXCEPTION 'Ontology:LinkEdgeNotFound — the % edge of % is not a link type you can see', which, NEW.api_name;
    END IF;
    IF e.backing_kind IS DISTINCT FROM 'foreign_key' THEN
      RAISE EXCEPTION 'Ontology:LinkEdgeNotForeignKey — the % edge of % must be a foreign-key link to the backing object type, and % is backed by %',
        which, NEW.api_name, e.api_name, coalesce(e.backing_kind, 'nothing');
    END IF;
    -- "the many-to-one link types between each side ... to the backing object
    -- type": many middles per side, so the FK is on the middle — which 417
    -- puts on the source.
    IF e.source_object_type_id IS DISTINCT FROM NEW.backing_object_type_id
       OR e.target_object_type_id IS DISTINCT FROM side THEN
      RAISE EXCEPTION 'Ontology:LinkEdgeDoesNotReachTheSide — the % edge of % must run from the backing object type to the % side, and % does not',
        which, NEW.api_name, which, e.api_name;
    END IF;
    IF e.cardinality <> 'many_to_one' THEN
      RAISE EXCEPTION 'Ontology:LinkEdgeNotManyToOne — the % edge of % must be many-to-one from the backing object type, and % is %',
        which, NEW.api_name, e.api_name, e.cardinality;
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.guard_object_backed_edges() IS
  'An object-backed link''s two edges must each be a many-to-one foreign-key link from the backing object type to one side — the shape create-link-type''s prerequisites describe, and the one the two-hop walk reads. Refusing here is what lets the readers assume it. 765.';

CREATE TRIGGER guard_object_backed_edges
BEFORE INSERT OR UPDATE ON public.link_types
FOR EACH ROW EXECUTE FUNCTION public.guard_object_backed_edges();

-- ── the filter arm ──────────────────────────────────────────────────────────
-- object_set_where's source carries DOUBLED newlines, so every anchor here is
-- a single line, and each is kept in its replacement (764's rule).

DO $patch$
DECLARE src text; a text;
BEGIN
  src := replace(pg_get_functiondef('public.object_set_where(uuid,jsonb)'::regprocedure), chr(13), '');

  a := '  other_tbl text; fk_prop text; one_pk text; cond text; lk_tbl text;';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the declaration anchor is not exactly once in object_set_where';
  END IF;
  src := replace(src, a, a || chr(10) || '  ob_near text; ob_far text;');

  a := '      IF lk.backing_kind IS DISTINCT FROM ''foreign_key'' THEN';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the refusal anchor is not exactly once in object_set_where';
  END IF;
  src := replace(src, a,
'      -- The object-backed arm (765): the middle object is the intermediary,
      -- so a link counts when a middle row names me on one edge and something
      -- real on the other — the join-table arm''s semantics, one hop longer.
      IF lk.backing_kind = ''object_backed'' THEN
        SELECT x.index_table INTO lk_tbl
          FROM public.object_type_indexes x
         WHERE x.object_type_id = lk.backing_object_type_id
           AND public.object_type_index_ready(lk.backing_object_type_id);
        IF lk_tbl IS NULL THEN
          RAISE EXCEPTION ''Ontology:LinkNotIndexed — the intermediary object type of % has no successful index to read'', lk.api_name;
        END IF;
        SELECT p.property_id INTO fk_prop
          FROM public.object_type_properties p
         WHERE p.object_type_id = p_object_type AND p.is_primary_key;
        SELECT p.property_id INTO one_pk
          FROM public.object_type_properties p
         WHERE p.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type
                                       THEN lk.target_object_type_id ELSE lk.source_object_type_id END
           AND p.is_primary_key;
        SELECT x.index_table INTO other_tbl
          FROM public.object_type_indexes x
         WHERE x.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type
                                       THEN lk.target_object_type_id ELSE lk.source_object_type_id END
           AND public.object_type_index_ready(x.object_type_id);
        SELECT p.property_id INTO ob_near
          FROM public.link_types el
          JOIN public.object_type_properties p
            ON p.object_type_id = el.source_object_type_id AND p.backing_column = el.backing_column
         WHERE el.id = CASE WHEN lk.source_object_type_id = p_object_type
                            THEN lk.source_edge_link_type_id ELSE lk.target_edge_link_type_id END;
        SELECT p.property_id INTO ob_far
          FROM public.link_types el
          JOIN public.object_type_properties p
            ON p.object_type_id = el.source_object_type_id AND p.backing_column = el.backing_column
         WHERE el.id = CASE WHEN lk.source_object_type_id = p_object_type
                            THEN lk.target_edge_link_type_id ELSE lk.source_edge_link_type_id END;
        IF fk_prop IS NULL OR one_pk IS NULL OR other_tbl IS NULL OR ob_near IS NULL OR ob_far IS NULL THEN
          RAISE EXCEPTION ''Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join'', lk.api_name;
        END IF;
        cond := format(''EXISTS (SELECT 1 FROM objects.%I m JOIN objects.%I x ON x.%I::text = m.%I::text WHERE m.%I::text = o.%I::text)'',
                       lk_tbl, other_tbl, one_pk, ob_far, ob_near, fk_prop);
        IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;
        parts := parts || cond;
        CONTINUE;
      END IF;
' || a);

  -- the refusal now names only what is left: a link with no backing at all
  a := '        RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — an object-backed link resolves through its intermediary object type, which is not built; % is backed by %'',';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the message anchor is not exactly once in object_set_where';
  END IF;
  src := replace(src, a,
    '        RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — % declares no backing, so there is nothing to read; it is backed by %'',');

  EXECUTE src;
END $patch$;

-- ── the listing arm ─────────────────────────────────────────────────────────

DO $patch$
DECLARE src text; a text;
BEGIN
  src := replace(pg_get_functiondef(
    'public.list_linked_objects(uuid,text,text,integer,integer,text)'::regprocedure), chr(13), '');

  a := '  far_pk text; my_pk text; fk_prop text;';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the declaration anchor is not exactly once in list_linked_objects';
  END IF;
  src := replace(src, a, a || chr(10) || '  ob_near text; ob_far text; ob_tbl text;');

  a := '  ELSE
    RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the refusal anchor is not exactly once in list_linked_objects';
  END IF;
  src := replace(src, a,
'  ELSIF lk.backing_kind = ''object_backed'' THEN
    -- The same two hops, read forwards: the middle rows that name me, and the
    -- far keys they carry (765).
    SELECT x.index_table INTO ob_tbl
      FROM public.object_type_indexes x
     WHERE x.object_type_id = lk.backing_object_type_id
       AND public.object_type_index_ready(lk.backing_object_type_id);
    IF ob_tbl IS NULL THEN
      RAISE EXCEPTION ''Ontology:LinkNotIndexed — the intermediary object type of % has no successful index to read'', lk.api_name;
    END IF;
    SELECT p.property_id INTO ob_near
      FROM public.link_types el
      JOIN public.object_type_properties p
        ON p.object_type_id = el.source_object_type_id AND p.backing_column = el.backing_column
     WHERE el.id = CASE WHEN lk.source_object_type_id = p_object_type
                        THEN lk.source_edge_link_type_id ELSE lk.target_edge_link_type_id END;
    SELECT p.property_id INTO ob_far
      FROM public.link_types el
      JOIN public.object_type_properties p
        ON p.object_type_id = el.source_object_type_id AND p.backing_column = el.backing_column
     WHERE el.id = CASE WHEN lk.source_object_type_id = p_object_type
                        THEN lk.target_edge_link_type_id ELSE lk.source_edge_link_type_id END;
    IF ob_near IS NULL OR ob_far IS NULL THEN
      RAISE EXCEPTION ''Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join'', lk.api_name;
    END IF;
    link_cond := format(''o.%I::text IN (SELECT m.%I::text FROM objects.%I m WHERE m.%I::text = %L)'',
                        far_pk, ob_far, ob_tbl, ob_near, p_primary_key);

' || a);

  a := '    RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — an object-backed link resolves through its intermediary object type, which is not built; % is backed by %'',';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '765: the message anchor is not exactly once in list_linked_objects';
  END IF;
  src := replace(src, a,
    '    RAISE EXCEPTION ''Ontology:LinkFilterBackingUnsupported — % declares no backing, so there is nothing to read; it is backed by %'',');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — Aircraft, Flight and the manifest between them ────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  dsa uuid; dsb uuid; dsm uuid; bra uuid; brb uuid; brm uuid;
  txn uuid; file_id uuid; phys text;
  ta uuid; tb uuid; tm uuid; ea uuid; eb uuid; ln uuid; b uuid; n bigint; err text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m765 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm765-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm765-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M765 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm765p', 'm765 probe') RETURNING id INTO proj;

  -- three datasets: the two sides and the manifest in the middle
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm765a', 'm765a') RETURNING id INTO dsa;
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
  VALUES (org, proj, 'm765b', 'm765b') RETURNING id INTO dsb;
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
  VALUES (org, proj, 'm765m', 'm765m') RETURNING id INTO dsm;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsm, 'master') RETURNING id INTO brm;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsm, brm, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (dsm, txn, '[{"name":"pk","type":"STRING"},{"name":"a_pk","type":"STRING"},{"name":"b_pk","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsm, txn, 'rows.parquet', 2) RETURNING id INTO file_id;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
  SELECT public.dataset_materialize(dsm, txn) INTO phys;
  -- A1 reaches B1 through M1; M2 names A2 and a B that does not exist.
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, a_pk, b_pk) VALUES ($1,''M1'',''A1'',''B1''), ($1,''M2'',''A2'',''GONE'')', phys)
    USING file_id;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M765A', 'M765 A') RETURNING id INTO ta;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ta, dsa, bra);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (ta, 'a_pk', 'Id', 'id', 'string', 'column', 'a_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ta), true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M765B', 'M765 B') RETURNING id INTO tb;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (tb, dsb, brb);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, is_primary_key, is_title_key, required)
  VALUES (tb, 'b_pk', 'Id', 'id', 'string', 'column', 'b_pk',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = tb), true, true, true);
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M765M', 'M765 Manifest') RETURNING id INTO tm;
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

  -- the two edges: manifest → each side, many-to-one, FK on the manifest
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, tm, ta, 'm765-of-a', 'M765 of A', 'many_to_one', 'foreign_key', 'a_pk')
  RETURNING id INTO ea;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, tm, tb, 'm765-of-b', 'M765 of B', 'many_to_one', 'foreign_key', 'b_pk')
  RETURNING id INTO eb;

  -- the guard refuses an edge that does not reach the side
  BEGIN
    INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                   api_name, label, cardinality, backing_kind, backing_object_type_id,
                                   source_edge_link_type_id, target_edge_link_type_id)
    VALUES (ont, proj, ta, tb, 'm765-wrong', 'M765 wrong', 'many_to_one', 'object_backed', tm, eb, ea);
    RAISE EXCEPTION 'the guard should refuse edges pointing at the wrong sides';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:LinkEdgeDoesNotReachTheSide%' THEN RAISE; END IF;
  END;

  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_object_type_id,
                                 source_edge_link_type_id, target_edge_link_type_id)
  VALUES (ont, proj, ta, tb, 'm765-via', 'M765 via', 'many_to_one', 'object_backed', tm, ea, eb)
  RETURNING id INTO ln;

  SELECT public.run_index_build(ARRAY[ta, tb, tm]::uuid[], true) INTO b;
  IF EXISTS (SELECT 1 FROM public.build_jobs bj WHERE bj.build_id = b AND bj.state <> 'COMPLETED') THEN
    RAISE EXCEPTION 'the three indexes did not land';
  END IF;

  -- the filter walks it: A1 has a link (M1 → B1), A2 does not (M2 → GONE)
  SELECT public.count_object_set(ta,
    '[{"type":"linkFilter","linkType":"m765-via","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'one A should have a link through the manifest, got %', n; END IF;
  SELECT public.count_object_set(ta,
    '[{"type":"linkFilter","linkType":"m765-via","value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the other A should have none, got %', n; END IF;

  -- and from the far side, which reads the edges the other way round
  SELECT public.count_object_set(tb,
    '[{"type":"linkFilter","linkType":"m765-via","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]'::jsonb)
    INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'one B should be reachable, got %', n; END IF;

  -- the listing walks it too, in both directions
  SELECT count(*) INTO n FROM public.list_linked_objects(ta, 'A1', 'm765-via') s;
  IF n <> 1 THEN RAISE EXCEPTION 'A1 should list one linked object, listed %', n; END IF;
  SELECT count(*) INTO n FROM public.list_linked_objects(ta, 'A2', 'm765-via') s;
  IF n <> 0 THEN RAISE EXCEPTION 'A2 links to nothing that exists, listed %', n; END IF;
  SELECT count(*) INTO n FROM public.list_linked_objects(tb, 'B1', 'm765-via') s;
  IF n <> 1 THEN RAISE EXCEPTION 'B1 should list one linked object, listed %', n; END IF;
  SELECT public.count_linked_objects(ta, 'A1', 'm765-via') INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the count follows the listing, got %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0765', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0765' THEN
  NULL;
END $$;
