-- The engine stops asking Phonograph whether an index is ready.
--
-- 520 replaced the OSv1 scalar's MEANING with object_type_index_state(); this
-- replaces its READERS. Ten live functions gated on `x.status = 'success'`,
-- and eight of them are the hot read path — every object read, count,
-- aggregation, histogram and search goes through one.
--
-- The predicate they wanted is "the last index build job COMPLETED", which is
-- what OSv2 means by a ready index: the status is the pipeline's job state,
-- and "A green tick in the Object Storage v2 node in the graph indicates that
-- the indexing is complete and the object type is ready to be queried from
-- OSv2" (object-indexing/faq).
--
-- The substitution is uniform — `x.status = 'success'` becomes
-- `object_type_index_ready(x.object_type_id)` — because every one of the ten
-- binds the object type through that same alias, in four different join
-- shapes. Each function below is its LIVE definition with that one string
-- changed, taken from pg_get_functiondef and not retyped.
--
-- The column itself stays until index_object_type stops writing it; dropping
-- it is the last step and is recorded in DELIVERABLE-MAP §5.

-- "ready" is the last index job having COMPLETED. A type never indexed is not
-- ready, which is the same answer the old scalar gave for 'not started'.
CREATE OR REPLACE FUNCTION public.object_type_index_ready(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.object_type_index_state(p_type) = 'COMPLETED'
$$;
REVOKE ALL ON FUNCTION public.object_type_index_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_type_index_ready(uuid) TO authenticated;
COMMENT ON FUNCTION public.object_type_index_ready(uuid) IS
  'Whether this object type may be read: its last index build job COMPLETED. The OSv2 answer, replacing Phonograph''s success/failed/not started scalar.';

CREATE OR REPLACE FUNCTION public.aggregate_object_set(p_object_type uuid, p_filters jsonb DEFAULT '[]'::jsonb, p_group_by text DEFAULT NULL::text, p_agg_property text DEFAULT NULL::text, p_sort_by text DEFAULT 'count'::text, p_desc boolean DEFAULT true, p_limit integer DEFAULT 5)
 RETURNS TABLE(group_value text, object_count bigint, sum numeric, average numeric, min numeric, max numeric, property_count bigint, unique_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ont uuid; tbl text; wh text; grp record; agg record;
  grp_expr text; agg_expr text; ord text;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN RETURN; END IF;
  IF NOT public.object_set_filters_valid(p_filters) THEN
    RAISE EXCEPTION 'Ontology:InvalidFilters — the filters do not follow the documented grammar';
  END IF;
  IF p_sort_by NOT IN ('count','value') THEN
    RAISE EXCEPTION 'Ontology:InvalidSort — sort by count or by value (explore-charts.md: "sort by the count ascending, or sort alphabetically by the property values")';
  END IF;

  wh := public.object_set_where(p_object_type, p_filters);

  IF p_group_by IS NOT NULL THEN
    SELECT p.property_id, p.visibility, p.selectable INTO grp
      FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type
       AND (p.api_name = p_group_by OR p.property_id = p_group_by);
    IF grp IS NULL THEN
      RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', p_group_by;
    END IF;
    IF grp.visibility = 'hidden' THEN
      RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
    END IF;
    IF NOT grp.selectable THEN
      RAISE EXCEPTION 'Ontology:PropertyNotSelectable — the Selectable render hint is not enabled on %', p_group_by;
    END IF;
    grp_expr := format('o.%I::text', grp.property_id);
  ELSE
    grp_expr := 'NULL::text';
  END IF;

  IF p_agg_property IS NOT NULL THEN
    SELECT p.property_id, p.base_type, p.visibility INTO agg
      FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type
       AND (p.api_name = p_agg_property OR p.property_id = p_agg_property);
    IF agg IS NULL THEN
      RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', p_agg_property;
    END IF;
    IF agg.visibility = 'hidden' THEN
      RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
    END IF;
    -- "Statistics tables show aggregates for numeric properties."
    IF agg.base_type NOT IN ('byte','short','integer','long','float','double','decimal') THEN
      RAISE EXCEPTION 'Ontology:AggregationNeedsNumeric — % is %, and Sum/Average/Min/Max aggregate numeric properties', p_agg_property, agg.base_type;
    END IF;
    agg_expr := format('o.%I', agg.property_id);
  ELSE
    agg_expr := 'NULL::numeric';
  END IF;

  ord := CASE WHEN p_sort_by = 'value' THEN '1' ELSE '2' END
      || CASE WHEN p_desc THEN ' DESC' ELSE ' ASC' END;

  RETURN QUERY EXECUTE format(
    'SELECT %s AS group_value, count(*) AS object_count,
            sum(%s)::numeric, avg(%s)::numeric, min(%s)::numeric, max(%s)::numeric,
            count(%s) AS property_count, count(DISTINCT %s) AS unique_count
       FROM objects.%I o WHERE %s GROUP BY 1 ORDER BY %s LIMIT %s',
    grp_expr, agg_expr, agg_expr, agg_expr, agg_expr,
    coalesce(nullif(agg_expr, 'NULL::numeric'), grp_expr),
    coalesce(nullif(agg_expr, 'NULL::numeric'), grp_expr),
    tbl, wh, ord,
    CASE WHEN p_group_by IS NULL THEN 1 ELSE greatest(coalesce(p_limit, 5), 1) END);
END $function$
;
CREATE OR REPLACE FUNCTION public.count_object_set(p_object_type uuid, p_filters jsonb DEFAULT '[]'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ont uuid; tbl text; n bigint;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN RETURN 0; END IF;
  IF NOT public.object_set_filters_valid(p_filters) THEN
    RAISE EXCEPTION 'Ontology:InvalidFilters — the filters do not follow the documented grammar';
  END IF;
  EXECUTE format('SELECT count(*) FROM objects.%I o WHERE %s',
                 tbl, public.object_set_where(p_object_type, p_filters)) INTO n;
  RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.evaluate_object_set(p_object_type uuid, p_filters jsonb DEFAULT '[]'::jsonb, p_sort jsonb DEFAULT '[]'::jsonb, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ont uuid; tbl text; wh text; hidden text[]; s jsonb; ord text[] := '{}'; prop record;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN RETURN; END IF;
  IF NOT public.object_set_filters_valid(p_filters) THEN
    RAISE EXCEPTION 'Ontology:InvalidFilters — the filters do not follow the documented grammar';
  END IF;

  wh := public.object_set_where(p_object_type, p_filters);

  -- "No hidden object or property types will be displayed ... here or
  -- elsewhere in Object Explorer" — a hidden property leaves the row.
  SELECT coalesce(array_agg(p.property_id), '{}') INTO hidden
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.visibility = 'hidden';

  -- Multi-sort, "applied in order" (view-results.md).
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(p_sort, '[]'::jsonb)) LOOP
    SELECT p.property_id, p.base_type, p.visibility, p.sortable INTO prop
      FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type
       AND (p.api_name = s->>'property' OR p.property_id = s->>'property');
    IF prop IS NULL THEN
      RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', s->>'property';
    END IF;
    IF prop.visibility = 'hidden' THEN
      RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
    END IF;
    -- "Numeric and date properties are always sortable"; the hint binds strings.
    IF prop.base_type = 'string' AND NOT prop.sortable THEN
      RAISE EXCEPTION 'Ontology:PropertyNotSortable — the Sortable render hint is not enabled on %', s->>'property';
    END IF;
    ord := ord || format('o.%I %s', prop.property_id,
                         CASE WHEN lower(coalesce(s->>'direction','asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END);
  END LOOP;

  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(o) - $1 FROM objects.%I o WHERE %s %s LIMIT %s OFFSET %s',
    tbl, wh,
    CASE WHEN ord = '{}' THEN '' ELSE 'ORDER BY ' || array_to_string(ord, ', ') END,
    greatest(coalesce(p_limit, 100), 0), greatest(coalesce(p_offset, 0), 0))
  USING hidden;
END $function$
;
CREATE OR REPLACE FUNCTION public.histogram_object_set(p_object_type uuid, p_filters jsonb DEFAULT '[]'::jsonb, p_property text DEFAULT NULL::text, p_buckets integer DEFAULT 20)
 RETURNS TABLE(bucket_min double precision, bucket_max double precision, object_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ont uuid; tbl text; wh text; prop record; expr text;
  lo double precision; hi double precision; n int;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  IF tbl IS NULL THEN RETURN; END IF;
  IF NOT public.object_set_filters_valid(p_filters) THEN
    RAISE EXCEPTION 'Ontology:InvalidFilters — the filters do not follow the documented grammar';
  END IF;

  SELECT p.property_id, p.base_type, p.visibility INTO prop
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND (p.api_name = p_property OR p.property_id = p_property);
  IF prop IS NULL THEN
    RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', p_property;
  END IF;
  IF prop.visibility = 'hidden' THEN
    RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
  END IF;
  -- "Histograms display bar chart aggregations on numeric or date properties."
  IF prop.base_type IN ('byte','short','integer','long','float','double','decimal') THEN
    expr := format('o.%I::double precision', prop.property_id);
  ELSIF prop.base_type IN ('date','timestamp') THEN
    expr := format('extract(epoch from o.%I)::double precision', prop.property_id);
  ELSE
    RAISE EXCEPTION 'Ontology:HistogramNeedsNumericOrDate — % is %', p_property, prop.base_type;
  END IF;

  wh := public.object_set_where(p_object_type, p_filters);
  n := greatest(coalesce(p_buckets, 20), 1);

  EXECUTE format('SELECT min(%s), max(%s) FROM objects.%I o WHERE %s AND %s IS NOT NULL',
                 expr, expr, tbl, wh, expr) INTO lo, hi;
  IF lo IS NULL THEN RETURN; END IF;
  IF lo = hi THEN
    RETURN QUERY EXECUTE format(
      'SELECT %L::double precision, %L::double precision, count(*) FROM objects.%I o WHERE %s AND %s IS NOT NULL',
      lo, hi, tbl, wh, expr);
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT %L::double precision + (b - 1) * (%L::double precision - %L::double precision) / %s,
            %L::double precision + b       * (%L::double precision - %L::double precision) / %s,
            count(*)
       FROM (SELECT width_bucket(%s, %L, %L, %s) AS b
               FROM objects.%I o WHERE %s AND %s IS NOT NULL) w
      WHERE b BETWEEN 1 AND %s + 1
      GROUP BY b ORDER BY b',
    lo, hi, lo, n, lo, hi, lo, n,
    expr, lo, hi, n, tbl, wh, expr, n);
END $function$
;
CREATE OR REPLACE FUNCTION public.indexed_objects(p_object_type uuid, p_limit integer DEFAULT 100)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE tbl text; ont uuid;

BEGIN

  SELECT t.ontology_id, x.index_table INTO ont, tbl

    FROM public.object_types t

    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)

   WHERE t.id = p_object_type;

  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN

    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;

  END IF;

  IF tbl IS NULL THEN

    RETURN; -- not indexed yet: no objects to see, which is the point of E2

  END IF;

  RETURN QUERY EXECUTE format(

    'SELECT to_jsonb(o) FROM objects.%I o WHERE %s LIMIT %s',

    tbl, COALESCE(public.restricted_view_predicate(p_object_type), 'true'),

    greatest(p_limit, 0));

END $function$
;
CREATE OR REPLACE FUNCTION public.lineage_graph(p_kind text, p_id uuid, p_up integer DEFAULT 2, p_down integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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

      ON n.kind = 'object_type' AND x.object_type_id = n.id AND public.object_type_index_ready(x.object_type_id)

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

END $function$
;
CREATE OR REPLACE FUNCTION public.object_set_where(p_object_type uuid, p_filters jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$

DECLARE

  e jsonb; v jsonb; frag text; parts text[] := '{}';

  prop record; lk record; tok text; vals text[];

  other_tbl text; fk_prop text; one_pk text; cond text;

BEGIN

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) LOOP

    v := e->'value';



    IF e->>'type' = 'propertyFilter' THEN

      SELECT p.property_id, p.base_type, p.visibility, p.searchable

        INTO prop

        FROM public.object_type_properties p

       WHERE p.object_type_id = p_object_type

         AND (p.api_name = e->>'propertyType' OR p.property_id = e->>'propertyType');

      IF prop IS NULL THEN

        RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', e->>'propertyType';

      END IF;

      IF prop.visibility = 'hidden' THEN

        RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';

      END IF;



      CASE v->>'type'

        WHEN 'textFilter' THEN

          -- "Matches objects where the property contains all search tokens."

          IF NOT prop.searchable THEN

            RAISE EXCEPTION 'Ontology:PropertyNotSearchable — the Searchable render hint is not enabled on %', e->>'propertyType';

          END IF;

          frag := 'true';

          FOREACH tok IN ARRAY regexp_split_to_array(btrim(v->>'text'), '\s+') LOOP

            CONTINUE WHEN tok = '';

            frag := frag || format(' AND o.%I::text ILIKE %L',

              prop.property_id, '%' || replace(replace(tok, '_', '\_'), '%', '\%') || '%');

          END LOOP;

          parts := parts || ('(' || frag || ')');

        WHEN 'valuesFilter' THEN

          SELECT array_agg(x) INTO vals FROM jsonb_array_elements_text(v->'values') x;

          parts := parts || format('(o.%I::text = ANY (%L::text[]))', prop.property_id, vals);

        WHEN 'numberRangeFilter' THEN

          frag := 'true';

          IF v->'min' IS NOT NULL THEN frag := frag || format(' AND o.%I >= %s', prop.property_id, (v->>'min')::numeric); END IF;

          IF v->'max' IS NOT NULL THEN frag := frag || format(' AND o.%I <= %s', prop.property_id, (v->>'max')::numeric); END IF;

          parts := parts || ('(' || frag || ')');

        WHEN 'dateRangeFilter' THEN

          frag := 'true';

          IF v->'dateRangeFilter'->>'start' IS NOT NULL THEN

            frag := frag || format(' AND o.%I >= %L::date', prop.property_id, (v->'dateRangeFilter'->>'start')::date);

          END IF;

          IF v->'dateRangeFilter'->>'end' IS NOT NULL THEN

            frag := frag || format(' AND o.%I <= %L::date', prop.property_id, (v->'dateRangeFilter'->>'end')::date);

          END IF;

          parts := parts || ('(' || frag || ')');

        WHEN 'relativeDateFilter' THEN

          frag := 'true';

          IF v->'sinceDaysAgo' IS NOT NULL THEN

            frag := frag || format(' AND o.%I >= current_date - %s', prop.property_id, (v->>'sinceDaysAgo')::int);

          END IF;

          IF v->'untilDaysAgo' IS NOT NULL THEN

            frag := frag || format(' AND o.%I <= current_date - %s', prop.property_id, (v->>'untilDaysAgo')::int);

          END IF;

          parts := parts || ('(' || frag || ')');

        WHEN 'timestampRangeFilter' THEN

          frag := 'true';

          IF v->'startMillis' IS NOT NULL THEN

            frag := frag || format(' AND o.%I >= to_timestamp(%s / 1000.0)', prop.property_id, (v->>'startMillis')::numeric);

          END IF;

          IF v->'endMillis' IS NOT NULL THEN

            frag := frag || format(' AND o.%I <= to_timestamp(%s / 1000.0)', prop.property_id, (v->>'endMillis')::numeric);

          END IF;

          parts := parts || ('(' || frag || ')');

        WHEN 'relativeTimestampFilter' THEN

          frag := 'true';

          IF v->'sinceMillisAgo' IS NOT NULL THEN

            frag := frag || format(' AND o.%I >= now() - make_interval(secs => %s / 1000.0)', prop.property_id, (v->>'sinceMillisAgo')::numeric);

          END IF;

          IF v->'untilMillisAgo' IS NOT NULL THEN

            frag := frag || format(' AND o.%I <= now() - make_interval(secs => %s / 1000.0)', prop.property_id, (v->>'untilMillisAgo')::numeric);

          END IF;

          parts := parts || ('(' || frag || ')');

      END CASE;



    ELSIF e->>'type' = 'linkFilter' THEN

      SELECT l.* INTO lk

        FROM public.link_types l

        JOIN public.object_types t ON t.id = p_object_type AND t.ontology_id = l.ontology_id

       WHERE (l.api_name = e->>'linkType' OR l.id::text = e->>'linkType')

         AND (l.source_object_type_id = p_object_type OR l.target_object_type_id = p_object_type);

      IF lk IS NULL THEN

        RAISE EXCEPTION 'Ontology:LinkTypeNotFound — % is not a link type of this object type', e->>'linkType';

      END IF;

      IF lk.backing_kind IS DISTINCT FROM 'foreign_key' THEN

        RAISE EXCEPTION 'Ontology:LinkFilterBackingUnsupported — a presence filter reads foreign-key backing; % is backed by %',

          lk.api_name, coalesce(lk.backing_kind, 'nothing');

      END IF;



      -- The FK property lives on the source; the target joins on its primary

      -- key ("the 'one' side of the Cardinality is unique", 417's guard).

      SELECT p.property_id INTO fk_prop

        FROM public.object_type_properties p

       WHERE p.object_type_id = lk.source_object_type_id AND p.backing_column = lk.backing_column;

      SELECT p.property_id INTO one_pk

        FROM public.object_type_properties p

       WHERE p.object_type_id = lk.target_object_type_id AND p.is_primary_key;

      SELECT x.index_table INTO other_tbl

        FROM public.object_type_indexes x

       WHERE x.object_type_id = CASE WHEN lk.source_object_type_id = p_object_type

                                     THEN lk.target_object_type_id ELSE lk.source_object_type_id END

         AND public.object_type_index_ready(x.object_type_id);

      IF fk_prop IS NULL OR one_pk IS NULL OR other_tbl IS NULL THEN

        RAISE EXCEPTION 'Ontology:LinkedTypeNotIndexed — the other side of % has no successful index to join', lk.api_name;

      END IF;



      IF lk.source_object_type_id = p_object_type THEN

        cond := format('EXISTS (SELECT 1 FROM objects.%I x WHERE x.%I::text = o.%I::text)',

                       other_tbl, one_pk, fk_prop);

      ELSE

        cond := format('EXISTS (SELECT 1 FROM objects.%I x WHERE x.%I::text = o.%I::text)',

                       other_tbl, fk_prop, one_pk);

      END IF;

      IF v->>'matchType' = 'MUST_NOT_HAVE' THEN cond := 'NOT ' || cond; END IF;

      parts := parts || cond;

    END IF;

  END LOOP;



  -- The policy gate, when this type is restricted-view-backed. Every reader

  -- shares this WHERE, so the gate cannot be forgotten by a new one.

  frag := public.restricted_view_predicate(p_object_type);

  IF frag IS NOT NULL THEN parts := parts || frag; END IF;



  RETURN CASE WHEN parts = '{}' THEN 'true' ELSE array_to_string(parts, ' AND ') END;

END $function$
;
CREATE OR REPLACE FUNCTION public.search_index_payload(p_object_type uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tbl text; docs jsonb; mappings jsonb; pk_prop text;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Ontology:ServiceRoleOnly — the index payload is the whole table';
  END IF;

  SELECT x.index_table INTO tbl
    FROM public.object_type_indexes x
   WHERE x.object_type_id = p_object_type AND public.object_type_index_ready(x.object_type_id);
  IF tbl IS NULL THEN RETURN NULL; END IF;

  -- A restricted-view-backed type's rows are policy-gated per caller; the
  -- shared index cannot hold them. NULL is "nothing to push", which the
  -- search-index function already answers with indexed: 0.
  IF EXISTS (SELECT 1 FROM public.object_type_datasources d
              WHERE d.object_type_id = p_object_type AND d.restricted_view_id IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  SELECT p.property_id INTO pk_prop
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;

  -- One field per property. A string is a text field with its analyzer, plus
  -- a keyword subfield when sorting or aggregation needs the raw term — the
  -- documented "adds raw index". not_analyzed IS the keyword field. An
  -- unsearchable property is stored but not indexed. Hidden properties are
  -- not indexed at all — they appear nowhere in Object Explorer.
  SELECT jsonb_object_agg(p.property_id,
    CASE
      WHEN p.base_type = 'string' AND NOT p.searchable THEN
        jsonb_build_object('type', 'keyword', 'index', false)
      WHEN p.base_type = 'string' AND p.analyzer = 'not_analyzed' THEN
        jsonb_build_object('type', 'keyword')
      WHEN p.base_type = 'string' THEN
        jsonb_build_object('type', 'text',
          'analyzer', public.opensearch_analyzer(p.analyzer))
        || CASE WHEN p.sortable OR p.selectable
             THEN jsonb_build_object('fields', jsonb_build_object('keyword',
                    jsonb_build_object('type', 'keyword', 'ignore_above', 1024)))
             ELSE '{}'::jsonb END
      WHEN p.base_type IN ('byte','short') THEN jsonb_build_object('type', 'short')
      WHEN p.base_type = 'integer' THEN jsonb_build_object('type', 'integer')
      WHEN p.base_type = 'long'    THEN jsonb_build_object('type', 'long')
      WHEN p.base_type = 'float'   THEN jsonb_build_object('type', 'float')
      WHEN p.base_type IN ('double','decimal','number') THEN jsonb_build_object('type', 'double')
      WHEN p.base_type = 'boolean' THEN jsonb_build_object('type', 'boolean')
      WHEN p.base_type = 'date'    THEN jsonb_build_object('type', 'date')
      WHEN p.base_type = 'timestamp' THEN jsonb_build_object('type', 'date')
      ELSE jsonb_build_object('type', 'object', 'enabled', false)
    END)
    INTO mappings
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.visibility <> 'hidden';

  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(o)), ''[]''::jsonb) FROM objects.%I o', tbl)
    INTO docs;

  RETURN jsonb_build_object(
    'index', tbl,
    'primary_key', pk_prop,
    'mappings', jsonb_build_object('properties', mappings),
    'documents', docs);
END $function$
;
CREATE OR REPLACE FUNCTION public.search_objects(p_query text, p_limit integer DEFAULT 8)
 RETURNS TABLE(object_type_id uuid, object_type_label text, primary_key text, title text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  t record;

  matched int;

  remaining int := greatest(least(p_limit, 25), 0);

BEGIN

  IF btrim(coalesce(p_query, '')) = '' THEN RETURN; END IF;



  FOR t IN

    SELECT ot.id, ot.label, x.index_table,

           pt.property_id AS title_col, pk.property_id AS pk_col

      FROM public.object_types ot

      JOIN public.object_type_indexes x

        ON x.object_type_id = ot.id AND public.object_type_index_ready(x.object_type_id)

      JOIN public.object_type_properties pt

        ON pt.object_type_id = ot.id AND pt.is_title_key

      JOIN public.object_type_properties pk

        ON pk.object_type_id = ot.id AND pk.is_primary_key

     WHERE ot.status <> 'deprecated'

       AND ot.visibility <> 'hidden'

       AND public.auth_in_ontology(ot.ontology_id)

     -- "prioritized by Active object types with Prominent, then Normal, and

     -- then Experimental" — promoted sorts first, as active's protected form.

     ORDER BY CASE

       WHEN ot.status = 'promoted' THEN 0

       WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0

       WHEN ot.status = 'active' THEN 1

       WHEN ot.status = 'experimental' THEN 2

       ELSE 3

     END, ot.created_at

     LIMIT 250

  LOOP

    EXIT WHEN remaining <= 0;

    RETURN QUERY EXECUTE format(

      'SELECT %L::uuid, %L::text, o.%I::text, o.%I::text

         FROM objects.%I o

        WHERE o.%I::text ILIKE %L

          AND %s

        LIMIT %s',

      t.id, t.label, t.pk_col, t.title_col, t.index_table,

      t.title_col, '%' || p_query || '%',

      COALESCE(public.restricted_view_predicate(t.id), 'true'), remaining);

    GET DIAGNOSTICS matched = ROW_COUNT;

    remaining := remaining - matched;

  END LOOP;

END $function$
;
CREATE OR REPLACE FUNCTION public.search_visible_types()
 RETURNS TABLE(object_type_id uuid, object_type_label text, index_table text, title_property text, primary_key_property text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT ot.id, ot.label, x.index_table, pt.property_id, pk.property_id

    FROM public.object_types ot

    JOIN public.object_type_indexes x

      ON x.object_type_id = ot.id AND public.object_type_index_ready(x.object_type_id)

    JOIN public.object_type_properties pt

      ON pt.object_type_id = ot.id AND pt.is_title_key

    JOIN public.object_type_properties pk

      ON pk.object_type_id = ot.id AND pk.is_primary_key

   WHERE ot.status <> 'deprecated'

     AND ot.visibility <> 'hidden'

     AND public.auth_in_ontology(ot.ontology_id)

     AND NOT EXISTS (SELECT 1 FROM public.object_type_datasources d

                      WHERE d.object_type_id = ot.id AND d.restricted_view_id IS NOT NULL)

   ORDER BY CASE

     WHEN ot.status = 'promoted' THEN 0

     WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0

     WHEN ot.status = 'active' THEN 1

     WHEN ot.status = 'experimental' THEN 2

     ELSE 3

   END, ot.created_at

   LIMIT 250

$function$
;
-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE n int; t uuid;
BEGIN
  -- No live function asks the legacy scalar any more.
  SELECT count(*) INTO n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname <> 'index_object_type'
     AND pg_get_functiondef(p.oid) LIKE '%x.status = ''success''%';
  IF n > 0 THEN RAISE EXCEPTION '% function(s) still gate on the Phonograph scalar', n; END IF;

  -- The predicate agrees with the ledger.
  SELECT bj.output_object_type_id INTO t FROM public.build_jobs bj
   WHERE bj.output_object_type_id IS NOT NULL AND bj.state = 'COMPLETED'
   ORDER BY bj.finished_at DESC NULLS LAST LIMIT 1;
  IF t IS NOT NULL AND NOT public.object_type_index_ready(t) THEN
    RAISE EXCEPTION 'a completed index reported not ready';
  END IF;
  IF public.object_type_index_ready(gen_random_uuid()) THEN
    RAISE EXCEPTION 'an unindexed type reported ready';
  END IF;

  -- And the read path still answers, on a real type: executed, not matched.
  IF t IS NOT NULL THEN
    PERFORM public.count_object_set(t, '[]'::jsonb);
    PERFORM count(*) FROM public.indexed_objects(t, 1);
  END IF;

  RAISE NOTICE '523: the engine reads the build, not the scalar';
END $$;
