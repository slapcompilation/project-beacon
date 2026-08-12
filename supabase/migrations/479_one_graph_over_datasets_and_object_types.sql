-- L1 of the Data Lineage phase (readings/data-lineage.md, Decisions refreshed
-- and approved 2026-08-12): one graph, four edge sources, one reader.
--
-- "Data Lineage is an interactive tool that facilitates a holistic view of how
-- data flows through the Foundry platform" — and the graph is not
-- dataset-only: object types are first-class nodes (elements-reference.md),
-- datasets that back them carry the "Defines an object type" indicator
-- ("This indicator appears on datasets that are used to define Ontology
-- object types"), and clicking the link icon "shows the relations between
-- this object type and other object types". Expansion is depth-controlled
-- ("define the number of levels"), with the page's own warning that "Adding
-- too many nodes simultaneously may affect the graph's performance" — hence
-- the node cap and the truncated flag.
--
-- The facts carried per node are Decision 2's honest subset of the 24
-- colorings: resource kind, the latest committed transaction's type ("Append
-- or Snapshot"), out-of-date WITH PARENT ("a direct parent had been updated
-- and the resource itself hasn't"), row count, and the object-type
-- indicator. Out-of-date WITH ANCESTOR needs a transitive-closure cost no
-- page explains and stays recorded (open question 3). A dataset's "built"
-- moment is its latest committed transaction; an object type's is its index.
--
-- RECORDED, NOT BUILT: branch fallbacks (row counts read the master branch
-- where one exists), Data source nodes, Artifacts, Logic out-of-date
-- (job-spec staleness — we have no job specs).

CREATE OR REPLACE FUNCTION public.lineage_graph(
  p_kind text,
  p_id uuid,
  p_up int DEFAULT 2,
  p_down int DEFAULT 2)
RETURNS jsonb
-- VOLATILE only because the walk uses a temp table; it writes nothing else.
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  up_left int := least(greatest(coalesce(p_up, 0), 0), 10);
  down_left int := least(greatest(coalesce(p_down, 0), 0), 10);
  cap int := 300;
  truncated boolean := false;
  added int;
  nodes jsonb; edges jsonb;
BEGIN
  IF p_kind NOT IN ('dataset', 'object_type') THEN
    RAISE EXCEPTION 'Ontology:UnknownLineageKind — a lineage root is a dataset or an object type';
  END IF;

  -- The caller must see the root; the walk then only adds what they may see.
  IF p_kind = 'dataset' AND NOT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_id AND public.project_role(d.project_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Compass:DatasetNotFound — % is not a dataset you can see', p_id;
  END IF;
  IF p_kind = 'object_type' AND NOT EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = p_id AND t.visibility <> 'hidden' AND public.auth_in_ontology(t.ontology_id)) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_id;
  END IF;

  CREATE TEMP TABLE _n (kind text, id uuid, depth int, PRIMARY KEY (kind, id)) ON COMMIT DROP;
  INSERT INTO _n VALUES (p_kind, p_id, 0);

  -- Ancestors: who my data comes from. Frontier depths are negative.
  WHILE up_left > 0 LOOP
    WITH frontier AS (SELECT * FROM _n WHERE depth = -(least(greatest(p_up,0),10) - up_left)),
    parents AS (
      SELECT 'dataset' AS kind, i.input_dataset_id AS id
        FROM frontier f JOIN public.dataset_inputs i ON f.kind = 'dataset' AND i.dataset_id = f.id
      UNION
      SELECT 'dataset', d.dataset_id
        FROM frontier f JOIN public.object_type_datasources d
          ON f.kind = 'object_type' AND d.object_type_id = f.id
      UNION
      SELECT 'object_type', m.object_type_id
        FROM frontier f JOIN public.object_type_materializations m
          ON f.kind = 'dataset' AND m.dataset_id = f.id
    )
    INSERT INTO _n
    SELECT p.kind, p.id, -(least(greatest(p_up,0),10) - up_left) - 1
      FROM parents p
     WHERE (p.kind = 'dataset' AND EXISTS (
              SELECT 1 FROM public.datasets d
               WHERE d.id = p.id AND public.project_role(d.project_id) IS NOT NULL))
        OR (p.kind = 'object_type' AND EXISTS (
              SELECT 1 FROM public.object_types t
               WHERE t.id = p.id AND t.visibility <> 'hidden'
                 AND public.auth_in_ontology(t.ontology_id)))
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added = ROW_COUNT;
    up_left := up_left - 1;
    EXIT WHEN added = 0;
    IF (SELECT count(*) FROM _n) > cap THEN truncated := true; EXIT; END IF;
  END LOOP;

  -- Descendants: where my data goes.
  WHILE down_left > 0 LOOP
    WITH frontier AS (SELECT * FROM _n WHERE depth = least(greatest(p_down,0),10) - down_left),
    children AS (
      SELECT 'dataset' AS kind, i.dataset_id AS id
        FROM frontier f JOIN public.dataset_inputs i ON f.kind = 'dataset' AND i.input_dataset_id = f.id
      UNION
      SELECT 'object_type', d.object_type_id
        FROM frontier f JOIN public.object_type_datasources d
          ON f.kind = 'dataset' AND d.dataset_id = f.id
      UNION
      SELECT 'dataset', m.dataset_id
        FROM frontier f JOIN public.object_type_materializations m
          ON f.kind = 'object_type' AND m.object_type_id = f.id
    )
    INSERT INTO _n
    SELECT c.kind, c.id, least(greatest(p_down,0),10) - down_left + 1
      FROM children c
     WHERE (c.kind = 'dataset' AND EXISTS (
              SELECT 1 FROM public.datasets d
               WHERE d.id = c.id AND public.project_role(d.project_id) IS NOT NULL))
        OR (c.kind = 'object_type' AND EXISTS (
              SELECT 1 FROM public.object_types t
               WHERE t.id = c.id AND t.visibility <> 'hidden'
                 AND public.auth_in_ontology(t.ontology_id)))
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added = ROW_COUNT;
    down_left := down_left - 1;
    EXIT WHEN added = 0;
    IF (SELECT count(*) FROM _n) > cap THEN truncated := true; EXIT; END IF;
  END LOOP;

  -- "shows the relations between this object type and other object types" —
  -- the directly linked types join the graph as one-hop decorations, so the
  -- link edges have both ends to draw.
  INSERT INTO _n
  SELECT 'object_type', other.id, n.depth
    FROM _n n
    JOIN public.link_types l
      ON n.kind = 'object_type'
     AND (l.source_object_type_id = n.id OR l.target_object_type_id = n.id)
    JOIN public.object_types other
      ON other.id = CASE WHEN l.source_object_type_id = n.id
                         THEN l.target_object_type_id ELSE l.source_object_type_id END
   WHERE other.visibility <> 'hidden' AND public.auth_in_ontology(other.ontology_id)
  ON CONFLICT DO NOTHING;

  -- Edges among the included nodes: the three flow kinds, plus link types.
  WITH e AS (
    SELECT 'input' AS edge, 'dataset' AS from_kind, i.input_dataset_id AS from_id,
           'dataset' AS to_kind, i.dataset_id AS to_id, NULL::text AS api_name
      FROM public.dataset_inputs i
     WHERE EXISTS (SELECT 1 FROM _n WHERE kind='dataset' AND id = i.input_dataset_id)
       AND EXISTS (SELECT 1 FROM _n WHERE kind='dataset' AND id = i.dataset_id)
    UNION ALL
    SELECT 'datasource', 'dataset', d.dataset_id, 'object_type', d.object_type_id, NULL
      FROM public.object_type_datasources d
     WHERE EXISTS (SELECT 1 FROM _n WHERE kind='dataset' AND id = d.dataset_id)
       AND EXISTS (SELECT 1 FROM _n WHERE kind='object_type' AND id = d.object_type_id)
    UNION ALL
    SELECT 'materialization', 'object_type', m.object_type_id, 'dataset', m.dataset_id, NULL
      FROM public.object_type_materializations m
     WHERE EXISTS (SELECT 1 FROM _n WHERE kind='object_type' AND id = m.object_type_id)
       AND EXISTS (SELECT 1 FROM _n WHERE kind='dataset' AND id = m.dataset_id)
    UNION ALL
    SELECT 'link_type', 'object_type', l.source_object_type_id, 'object_type', l.target_object_type_id, l.api_name
      FROM public.link_types l
     WHERE EXISTS (SELECT 1 FROM _n WHERE kind='object_type' AND id = l.source_object_type_id)
       AND EXISTS (SELECT 1 FROM _n WHERE kind='object_type' AND id = l.target_object_type_id)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'edge', e.edge, 'from_kind', e.from_kind, 'from_id', e.from_id,
           'to_kind', e.to_kind, 'to_id', e.to_id, 'api_name', e.api_name)), '[]'::jsonb)
    INTO edges FROM e;

  -- Node facts: Decision 2's honest subset. built_at is the staleness clock —
  -- a dataset's latest committed transaction, an object type's index.
  WITH facts AS (
    SELECT n.kind, n.id, n.depth,
      CASE WHEN n.kind = 'dataset' THEN d.name ELSE t.label END AS label,
      CASE WHEN n.kind = 'dataset' THEN d.api_name ELSE t.api_name END AS api_name,
      t.icon, t.status, t.visibility,
      CASE WHEN n.kind = 'dataset' THEN
        (SELECT tx.txn_type FROM public.dataset_transactions tx
          WHERE tx.dataset_id = n.id AND tx.status = 'COMMITTED'
          ORDER BY tx.committed_at DESC LIMIT 1) END AS txn_type,
      CASE WHEN n.kind = 'dataset' THEN
        (SELECT max(tx.committed_at) FROM public.dataset_transactions tx
          WHERE tx.dataset_id = n.id AND tx.status = 'COMMITTED')
      ELSE x.indexed_at END AS built_at,
      CASE WHEN n.kind = 'dataset' THEN
        (SELECT sum(f.row_count)::bigint FROM public.dataset_branches b,
                LATERAL public.dataset_view(b.id, NULL) f
          WHERE b.dataset_id = n.id AND b.name = 'master')
      ELSE x.object_count END AS row_count,
      CASE WHEN n.kind = 'dataset' THEN EXISTS (
        SELECT 1 FROM public.object_type_datasources ods WHERE ods.dataset_id = n.id)
      ELSE NULL END AS defines_object_type
    FROM _n n
    LEFT JOIN public.datasets d ON n.kind = 'dataset' AND d.id = n.id
    LEFT JOIN public.object_types t ON n.kind = 'object_type' AND t.id = n.id
    LEFT JOIN public.object_type_indexes x
      ON n.kind = 'object_type' AND x.object_type_id = n.id AND x.status = 'success'
  ),
  -- "Out-of-date with parent: a direct parent had been updated and the
  -- resource itself hasn't."
  stale AS (
    SELECT f.kind, f.id,
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(edges) e
        JOIN facts pf ON pf.kind = e->>'from_kind' AND pf.id = (e->>'from_id')::uuid
        WHERE e->>'edge' <> 'link_type'
          AND e->>'to_kind' = f.kind AND (e->>'to_id')::uuid = f.id
          -- A never-built node is unbuilt, not out-of-date: the page's words
          -- are "had been updated and the resource itself hasn't" — our
          -- reading is that both clocks must exist to compare. Marked.
          AND pf.built_at IS NOT NULL AND f.built_at IS NOT NULL
          AND f.built_at < pf.built_at
      ) AS out_of_date_with_parent
    FROM facts f
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'kind', f.kind, 'id', f.id, 'depth', f.depth,
           'label', f.label, 'api_name', f.api_name,
           'icon', f.icon, 'status', f.status, 'visibility', f.visibility,
           'txn_type', f.txn_type, 'built_at', f.built_at, 'row_count', f.row_count,
           'defines_object_type', f.defines_object_type,
           'out_of_date_with_parent', s.out_of_date_with_parent)
         ORDER BY f.depth, f.label), '[]'::jsonb)
    INTO nodes
    FROM facts f JOIN stale s ON s.kind = f.kind AND s.id = f.id;

  DROP TABLE _n;
  RETURN jsonb_build_object('nodes', nodes, 'edges', edges, 'truncated', truncated);
END $$;

REVOKE ALL ON FUNCTION public.lineage_graph(text, uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lineage_graph(text, uuid, int, int) TO authenticated;

COMMENT ON FUNCTION public.lineage_graph(text, uuid, int, int) IS
  'One lineage graph over datasets and object types: dataset inputs, datasource bindings, materializations as flow edges, link types as relations. Depth-limited each way, capped at 300 nodes with a truncated flag, visibility enforced per node with the caller''s claims.';

-- ── assertions: a chain, its indicator, and the staleness clock ────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid;
  raw_ds uuid; clean_ds uuid; export_ds uuid; br uuid; brc uuid; bre uuid;
  txn uuid; fid uuid; ptbl text;
  t uuid; t2 uuid; usr uuid := gen_random_uuid(); before text;
  x public.object_type_indexes; g jsonb; n jsonb;
  outsider uuid := gen_random_uuid(); org2 uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('lineage-479') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws479@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws479@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS479');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ws479', 'WS 479', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws479', 'WS479') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);

  -- raw → clean (dataset input), clean → T (datasource), T → export
  -- (materialization), T — T2 (link type).
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'raw479', 'raw') RETURNING id INTO raw_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (raw_ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (raw_ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'clean479', 'clean') RETURNING id INTO clean_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (clean_ds,'master') RETURNING id INTO brc;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean_ds, raw_ds);
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (clean_ds, brc, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (clean_ds, txn, '[{"name":"k","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (clean_ds, txn, 'clean.parquet', 2) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(clean_ds, txn);
  EXECUTE format('INSERT INTO datasets.%I (_file, k) VALUES ($1,''a''),($1,''b'')', ptbl) USING fid;

  RESET ROLE;
  -- Materializations require edits enabled (453's guard).
  INSERT INTO public.object_types (ontology_id, api_name, label, edits_enabled)
  VALUES (ont, 'Thing479', 'Thing', true) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (t, clean_ds, brc);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key, is_title_key)
  VALUES (t, 'k', 'K', 'k', 'string', 'k', true, true, true);
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Other479', 'Other') RETURNING id INTO t2;
  INSERT INTO public.link_types (ontology_id, source_object_type_id, target_object_type_id,
    api_name, label, source_api_name, source_label, target_api_name, target_label, cardinality)
  VALUES (ont, t, t2, 'thing-to-other', 'Thing to Other',
    'things', 'Things', 'other', 'Other', 'many_to_one');
  SET LOCAL ROLE authenticated;

  x := public.index_object_type(t);
  IF x.status <> 'success' THEN RAISE EXCEPTION 'index failed: %', x.error; END IF;
  -- indexed_at is now(), frozen at this transaction's start, while the
  -- fixture's commits use clock_timestamp() — one transaction, two clocks.
  -- Align the index's clock so the staleness comparison means what it would
  -- mean across real transactions.
  RESET ROLE;
  UPDATE public.object_type_indexes SET indexed_at = clock_timestamp() WHERE object_type_id = t;
  SET LOCAL ROLE authenticated;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'export479', 'export') RETURNING id INTO export_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (export_ds,'master') RETURNING id INTO bre;
  INSERT INTO public.object_type_materializations (object_type_id, dataset_id) VALUES (t, export_ds);

  -- 1. The whole chain from the middle: five nodes, four edges of four kinds.
  g := public.lineage_graph('dataset', clean_ds, 3, 3);
  IF jsonb_array_length(g->'nodes') <> 5 THEN
    RAISE EXCEPTION 'expected 5 nodes, got %: %', jsonb_array_length(g->'nodes'), g->'nodes';
  END IF;
  IF (SELECT count(DISTINCT e->>'edge') FROM jsonb_array_elements(g->'edges') e) <> 4 THEN
    RAISE EXCEPTION 'expected all four edge kinds, got %', g->'edges';
  END IF;

  -- 2. The dataset that backs the type carries the indicator; raw does not.
  SELECT e INTO n FROM jsonb_array_elements(g->'nodes') e
   WHERE e->>'kind' = 'dataset' AND (e->>'id')::uuid = clean_ds;
  IF (n->>'defines_object_type')::boolean IS DISTINCT FROM true
     OR (n->>'row_count')::bigint <> 2 OR n->>'txn_type' <> 'SNAPSHOT' THEN
    RAISE EXCEPTION 'the clean node''s facts are wrong: %', n;
  END IF;
  SELECT e INTO n FROM jsonb_array_elements(g->'nodes') e
   WHERE e->>'kind' = 'dataset' AND (e->>'id')::uuid = raw_ds;
  IF (n->>'defines_object_type')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'raw claims to define an object type';
  END IF;

  -- 3. Nothing is stale yet — then the parent updates, and only the child
  --    turns out-of-date with parent.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(g->'nodes') e
              WHERE (e->>'out_of_date_with_parent')::boolean) THEN
    RAISE EXCEPTION 'something was born stale: %', g->'nodes';
  END IF;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (raw_ds, br, 'APPEND') RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  g := public.lineage_graph('dataset', clean_ds, 3, 3);
  SELECT e INTO n FROM jsonb_array_elements(g->'nodes') e
   WHERE e->>'kind' = 'dataset' AND (e->>'id')::uuid = clean_ds;
  IF (n->>'out_of_date_with_parent')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'clean did not notice its parent moved';
  END IF;
  SELECT e INTO n FROM jsonb_array_elements(g->'nodes') e
   WHERE e->>'kind' = 'dataset' AND (e->>'id')::uuid = raw_ds;
  IF (n->>'out_of_date_with_parent')::boolean IS DISTINCT FROM false
     OR n->>'txn_type' <> 'APPEND' THEN
    RAISE EXCEPTION 'raw''s staleness or transaction type is wrong: %', n;
  END IF;

  -- 4. From the object type, the link decoration brings the related type.
  g := public.lineage_graph('object_type', t, 1, 1);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g->'nodes') e
                  WHERE e->>'kind' = 'object_type' AND (e->>'id')::uuid = t2) THEN
    RAISE EXCEPTION 'the linked type did not join the graph';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g->'edges') e
                  WHERE e->>'edge' = 'link_type' AND e->>'api_name' = 'thing-to-other') THEN
    RAISE EXCEPTION 'the link edge is missing';
  END IF;

  -- 5. An outsider sees no root at all.
  RESET ROLE;
  INSERT INTO public.organizations (name) VALUES ('lineage-479-other') RETURNING id INTO org2;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (outsider, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws479b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (outsider, 'ws479b@beacon.test', 'admin', org2);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', outsider::text,
      'app_metadata', json_build_object('role','admin','org_id',org2))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    g := public.lineage_graph('dataset', clean_ds, 1, 1);
    RAISE EXCEPTION 'an outsider walked the lineage';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:DatasetNotFound%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '479: one graph, four edge kinds, the indicator, and the staleness clock';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
