-- E1 of the Object Explorer phase: the exploration engine. An object set goes
-- in; filtered rows, counts and aggregations come out — over the same index
-- tables 442 builds and 443 searches. (readings/object-explorer.md, Decisions
-- 1–5, recited and approved 2026-08-12; Decision 5 amended to OpenSearch with
-- the schema half landing now.)
--
-- The filter grammar is not invented. `generate-urls.md` prints it:
-- propertyFilter values are textFilter, valuesFilter, dateRangeFilter, plus
-- "numberRangeFilter: min (optional number), max (optional number)",
-- "relativeDateFilter: sinceDaysAgo (optional number), untilDaysAgo (optional
-- number)", "timestampRangeFilter: startMillis (optional number), endMillis
-- (optional number)", "relativeTimestampFilter: sinceMillisAgo (optional
-- number), untilMillisAgo (optional number)"; a linkFilter carries a
-- presenceFilter with matchType MUST_HAVE; and "You can have many *PROPERTY*
-- filters, but only 1 *LINK* filter." MUST_NOT_HAVE is our name for the
-- documented negative mode ("This filter can be used to show either objects
-- that have the associated link, or objects that do not have the associated
-- link", filter-results.md) — the behaviour is attested, the wire name is
-- inference, marked here.
--
-- Render hints come from object-link-types/metadata-render-hints.md:
-- "Searchable must be selected in order for applications to apply the
-- Selectable, Sortable, or Low cardinality render hints." Three hints land —
-- the three this engine consumes — plus the analyzer declaration OpenSearch
-- will read (understanding-text-search.md's five analyzer types, Language
-- flattened to its seven documented languages). The remaining hints wait for
-- a consumer, per the no-allowlist rule. Defaults are true: the one
-- render-hints screenshot shows Searchable, Sortable and Selectable checked —
-- an inference from one example, recorded as such.
--
-- What refuses, refuses by name, and why:
--   Ontology:PropertyNotSearchable  — "Properties must have the Searchable
--     render hint enabled to be searchable" (understanding-text-search.md)
--   Ontology:PropertyNotSortable    — "Enable on string properties to allow
--     users to sort on this property"; "Numeric and date properties are
--     always sortable" so the hint binds strings only
--   Ontology:PropertyNotSelectable  — "Enable on string properties to allow
--     users to perform aggregations on this property"
--   Ontology:PropertyIsHidden       — "No hidden object or property types
--     will be displayed as search results here or elsewhere in Object
--     Explorer" (search-objects.md); a hidden property neither filters, nor
--     sorts, nor aggregates, nor appears in a result row
--   Ontology:LinkFilterBackingUnsupported — join-table and object-backed
--     links need the dataset read path; a typed refusal today, per 469's
--     pattern, rather than a wrong answer
--
-- RECORDED, NOT BUILT: Exclude semantics for a values selection (the URL
-- grammar carries no negation flag; Keep is what it prints), Est. Unique
-- Count as an estimator (ours is exact and the column says so), histogram
-- bucket count (Foundry "will scale to fit all relevant data and
-- automatically bucket"; ours takes a bucket count with a default of 20).

-- ── render hints, and the analyzer OpenSearch will read ────────────────────

ALTER TABLE public.object_type_properties
  ADD COLUMN searchable boolean NOT NULL DEFAULT true,
  ADD COLUMN sortable   boolean NOT NULL DEFAULT true,
  ADD COLUMN selectable boolean NOT NULL DEFAULT true,
  ADD COLUMN analyzer   text    NOT NULL DEFAULT 'standard'
    CONSTRAINT object_type_properties_analyzer_check CHECK (analyzer IN
      ('standard','simple','not_analyzed','whitespace',
       'english','french','german','japanese','korean','arabic','combined_arabic_english'));

-- "Searchable must be selected in order for applications to apply the
-- Selectable, Sortable, or Low cardinality render hints."
ALTER TABLE public.object_type_properties
  ADD CONSTRAINT object_type_properties_hints_need_searchable
  CHECK (searchable OR (NOT sortable AND NOT selectable));

COMMENT ON COLUMN public.object_type_properties.searchable IS
  'Render hint: the property is searchable. Parent of sortable and selectable — metadata-render-hints.md.';
COMMENT ON COLUMN public.object_type_properties.sortable IS
  'Render hint: string properties sort only when set; numeric and date properties are always sortable.';
COMMENT ON COLUMN public.object_type_properties.selectable IS
  'Render hint: the property can be aggregated (grouped) in charts.';
COMMENT ON COLUMN public.object_type_properties.analyzer IS
  'The analyzer OpenSearch indexes this string property with — standard, simple, not_analyzed, whitespace, or one of the seven documented languages (understanding-text-search.md).';

-- ── the documented filter grammar ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.object_set_filters_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE e jsonb; v jsonb; links int := 0;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    v := e->'value';
    IF e->>'type' = 'propertyFilter' THEN
      IF e->>'propertyType' IS NULL OR v IS NULL THEN RETURN false; END IF;
      CASE v->>'type'
        WHEN 'textFilter'              THEN IF v->>'text' IS NULL THEN RETURN false; END IF;
        WHEN 'valuesFilter'            THEN IF jsonb_typeof(v->'values') <> 'array' THEN RETURN false; END IF;
        WHEN 'dateRangeFilter'         THEN IF jsonb_typeof(v->'dateRangeFilter') <> 'object' THEN RETURN false; END IF;
        WHEN 'numberRangeFilter'       THEN IF v->'min' IS NULL AND v->'max' IS NULL THEN RETURN false; END IF;
        WHEN 'relativeDateFilter'      THEN IF v->'sinceDaysAgo' IS NULL AND v->'untilDaysAgo' IS NULL THEN RETURN false; END IF;
        WHEN 'timestampRangeFilter'    THEN IF v->'startMillis' IS NULL AND v->'endMillis' IS NULL THEN RETURN false; END IF;
        WHEN 'relativeTimestampFilter' THEN IF v->'sinceMillisAgo' IS NULL AND v->'untilMillisAgo' IS NULL THEN RETURN false; END IF;
        ELSE RETURN false;
      END CASE;
    ELSIF e->>'type' = 'linkFilter' THEN
      links := links + 1;
      IF e->>'linkType' IS NULL
         OR v->>'type' IS DISTINCT FROM 'presenceFilter'
         OR v->>'matchType' NOT IN ('MUST_HAVE','MUST_NOT_HAVE') THEN RETURN false; END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;
  -- "You can have many PROPERTY filters, but only 1 LINK filter."
  RETURN links <= 1;
END $$;

COMMENT ON FUNCTION public.object_set_filters_valid(jsonb) IS
  'The filter grammar generate-urls.md prints: propertyFilter with seven value kinds, at most one linkFilter carrying a presenceFilter.';

-- The saved set now speaks the documented grammar, not just "an array".
ALTER TABLE public.object_sets DROP CONSTRAINT object_sets_filters_check;
ALTER TABLE public.object_sets
  ADD CONSTRAINT object_sets_filters_check CHECK (public.object_set_filters_valid(filters));

-- An exploration is "the same set of search parameters ... retaining the
-- applied filters and the configured layout" (save-explorations.md). No page
-- in the section gives a saved set parameters; the column predates the
-- teardown and nothing reads it. The table is empty, so the drop loses nothing.
ALTER TABLE public.object_sets DROP COLUMN parameters;

-- ── the WHERE builder every reader shares ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.object_set_where(p_object_type uuid, p_filters jsonb)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
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
         AND x.status = 'success';
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

  RETURN CASE WHEN parts = '{}' THEN 'true' ELSE array_to_string(parts, ' AND ') END;
END $$;

REVOKE ALL ON FUNCTION public.object_set_where(uuid, jsonb) FROM PUBLIC, authenticated;

COMMENT ON FUNCTION public.object_set_where(uuid, jsonb) IS
  'Internal: the documented filter grammar compiled to a WHERE clause over one index table. Every reader shares it so the filters mean one thing.';

-- ── the readers ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.evaluate_object_set(
  p_object_type uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_sort jsonb DEFAULT '[]'::jsonb,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ont uuid; tbl text; wh text; hidden text[]; s jsonb; ord text[] := '{}'; prop record;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
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
END $$;

CREATE OR REPLACE FUNCTION public.count_object_set(
  p_object_type uuid,
  p_filters jsonb DEFAULT '[]'::jsonb)
RETURNS bigint
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ont uuid; tbl text; n bigint;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
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
END $$;

-- One shape serves every chart: a listogram row is (group_value, object_count),
-- a Single Statistic is the NULL-group row, a Statistics Table reads the
-- numeric columns per group. "Display as" vocabulary: Count, Sum, Average,
-- Min, Max, Property Count, Est. Unique Count (charts_listogram_controls.png)
-- — ours computes them all at once, and unique_count is exact.
CREATE OR REPLACE FUNCTION public.aggregate_object_set(
  p_object_type uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_group_by text DEFAULT NULL,
  p_agg_property text DEFAULT NULL,
  p_sort_by text DEFAULT 'count',
  p_desc boolean DEFAULT true,
  p_limit int DEFAULT 5)
RETURNS TABLE (group_value text, object_count bigint,
               sum numeric, average numeric, min numeric, max numeric,
               property_count bigint, unique_count bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ont uuid; tbl text; wh text; grp record; agg record;
  grp_expr text; agg_expr text; ord text;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
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
END $$;

-- "The histogram chart will scale to fit all relevant data and automatically
-- bucket" — the bounds come from the filtered set; the bucket count is ours.
CREATE OR REPLACE FUNCTION public.histogram_object_set(
  p_object_type uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_property text DEFAULT NULL,
  p_buckets int DEFAULT 20)
RETURNS TABLE (bucket_min double precision, bucket_max double precision, object_count bigint)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ont uuid; tbl text; wh text; prop record; expr text;
  lo double precision; hi double precision; n int;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x ON x.object_type_id = t.id AND x.status = 'success'
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
END $$;

REVOKE ALL ON FUNCTION public.evaluate_object_set(uuid, jsonb, jsonb, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_object_set(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aggregate_object_set(uuid, jsonb, text, text, text, boolean, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.histogram_object_set(uuid, jsonb, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_object_set(uuid, jsonb, jsonb, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_object_set(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_object_set(uuid, jsonb, text, text, text, boolean, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.histogram_object_set(uuid, jsonb, text, int) TO authenticated;

COMMENT ON FUNCTION public.evaluate_object_set(uuid, jsonb, jsonb, int, int) IS
  'The exploration engine''s row reader: documented filters in, index rows out as jsonb, hidden properties stripped, multi-sort applied in order.';
COMMENT ON FUNCTION public.count_object_set(uuid, jsonb) IS
  'The Results count over the same WHERE the rows use.';
COMMENT ON FUNCTION public.aggregate_object_set(uuid, jsonb, text, text, text, boolean, int) IS
  'One shape for listogram, Single Statistic and Statistics Table: group_value plus Count/Sum/Average/Min/Max/Property Count/Unique Count. Unique count is exact, not estimated.';
COMMENT ON FUNCTION public.histogram_object_set(uuid, jsonb, text, int) IS
  'Histogram buckets over a numeric or date property of the filtered set; bounds from the data, bucket count from the caller.';

-- ── assertions: the engine against a small known world ─────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; fid uuid; ptbl text;
  dsa uuid; bra uuid; txna uuid; fida uuid; ptbla text;
  t uuid; ta uuid; lt uuid;
  usr uuid := gen_random_uuid(); before text; x public.object_type_indexes;
  n bigint; r record; j jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('explore-475') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws475@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws475@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS475');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws475', 'WS 475') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws475', 'WS475') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);

  -- Flights: pk, status, origin, a number, a date, and the airline FK column.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights475', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"flight_id","type":"STRING"},{"name":"status","type":"STRING"},
      {"name":"origin","type":"STRING"},{"name":"distance","type":"DOUBLE"},
      {"name":"day","type":"DATE"},{"name":"airline_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'flights.parquet', 4) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, flight_id, status, origin, distance, day, airline_id) VALUES
       ($1,''F1'',''on time'',''JFK'',100,''2026-01-01'',''A1''),
       ($1,''F2'',''delayed'',''JFK'',2500,''2026-02-01'',''A1''),
       ($1,''F3'',''on time'',''SFO'',900,''2026-03-01'',''A1''),
       ($1,''F4'',''delayed'',''LAX'',1200,''2026-04-01'',NULL)', ptbl) USING fid;

  -- Airlines: the ONE side the FK joins on its primary key.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'airlines475', 'airlines') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa,'master') RETURNING id INTO bra;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (dsa, bra, 'SNAPSHOT') RETURNING id INTO txna;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (dsa, txna,
    '[{"name":"airline_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (dsa, txna, 'airlines.parquet', 2) RETURNING id INTO fida;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txna;
  ptbla := public.dataset_materialize(dsa, txna);
  EXECUTE format('INSERT INTO datasets.%I (_file, airline_id) VALUES ($1,''A1''),($1,''A2'')', ptbla) USING fida;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'project_id', proj::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','flight_id','display_name','Flight Id','api_name','flightId',
        'base_type','string','source','column','backing_column','flight_id',
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
        'datasource_id', (SELECT id::text FROM public.object_type_datasources WHERE object_type_id = t)),
      jsonb_build_object('property_id','origin','display_name','Origin','api_name','origin',
        'base_type','string','source','column','backing_column','origin',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources WHERE object_type_id = t)),
      jsonb_build_object('property_id','distance','display_name','Distance','api_name','distance',
        'base_type','double','source','column','backing_column','distance',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources WHERE object_type_id = t)),
      jsonb_build_object('property_id','day','display_name','Day','api_name','day',
        'base_type','date','source','column','backing_column','day',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources WHERE object_type_id = t)),
      jsonb_build_object('property_id','airline_id','display_name','Airline Id','api_name','airlineId',
        'base_type','string','source','column','backing_column','airline_id',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources WHERE object_type_id = t))));
  PERFORM public.save_working_state();

  ta := public.save_object_type(
    jsonb_build_object('api_name','Airline','label','Airline','ontology_id', ont::text,
      'project_id', proj::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', dsa::text,'branch_id', bra::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','airline_id','display_name','Airline Id','api_name','airlineId',
        'base_type','string','source','column','backing_column','airline_id',
        'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  INSERT INTO public.link_types (ontology_id, project_id,
    source_object_type_id, target_object_type_id, api_name, label,
    source_api_name, source_label, target_api_name, target_label,
    cardinality, backing_kind, backing_column)
  VALUES (ont, proj, t, ta, 'flight-to-airline', 'Flight to Airline',
    'flights', 'Flights', 'airline', 'Airline',
    'many_to_one', 'foreign_key', 'airline_id')
  RETURNING id INTO lt;

  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 4 THEN
    RAISE EXCEPTION 'flight index expected success/4, got %/% (%)', x.status, x.object_count, x.error;
  END IF;
  x := public.index_object_type(ta);
  IF x.status <> 'success' OR x.object_count <> 2 THEN
    RAISE EXCEPTION 'airline index expected success/2, got %/% (%)', x.status, x.object_count, x.error;
  END IF;

  -- 1. No filters: everything, and the count agrees with the rows.
  n := public.count_object_set(t, '[]');
  IF n <> 4 THEN RAISE EXCEPTION 'count of all expected 4, got %', n; END IF;

  -- 2. A values selection keeps "any of N selected values".
  n := public.count_object_set(t,
    '[{"type":"propertyFilter","propertyType":"status","value":{"type":"valuesFilter","values":["on time"]}}]');
  IF n <> 2 THEN RAISE EXCEPTION 'valuesFilter expected 2, got %', n; END IF;

  -- 3. A keyword filter contains ALL tokens, in any order.
  n := public.count_object_set(t,
    '[{"type":"propertyFilter","propertyType":"status","value":{"type":"textFilter","text":"time on"}}]');
  IF n <> 2 THEN RAISE EXCEPTION 'textFilter expected 2, got %', n; END IF;

  -- 4. Ranges: number and date, each side optional.
  n := public.count_object_set(t,
    '[{"type":"propertyFilter","propertyType":"distance","value":{"type":"numberRangeFilter","min":1000}}]');
  IF n <> 2 THEN RAISE EXCEPTION 'numberRangeFilter expected 2, got %', n; END IF;
  n := public.count_object_set(t,
    '[{"type":"propertyFilter","propertyType":"day","value":{"type":"dateRangeFilter","dateRangeFilter":{"start":"2026-02-15"}}}]');
  IF n <> 2 THEN RAISE EXCEPTION 'dateRangeFilter expected 2, got %', n; END IF;

  -- 5. Multi-sort applies in order; the widest flight leads.
  SELECT e INTO j FROM public.evaluate_object_set(t, '[]',
    '[{"property":"distance","direction":"desc"}]', 1, 0) e;
  IF (j->>'distance')::numeric <> 2500 THEN
    RAISE EXCEPTION 'sort by distance desc expected 2500 first, got %', j->>'distance';
  END IF;

  -- 6. Listogram: grouped counts with a numeric aggregation beside them.
  SELECT * INTO r FROM public.aggregate_object_set(t, '[]', 'status', 'distance') LIMIT 1;
  IF r.group_value <> 'delayed' OR r.object_count <> 2 OR r.sum <> 3700 THEN
    RAISE EXCEPTION 'listogram expected delayed/2/3700, got %/%/%', r.group_value, r.object_count, r.sum;
  END IF;

  -- 7. Single Statistic: the NULL group is the whole set.
  SELECT * INTO r FROM public.aggregate_object_set(t, '[]', NULL, 'distance');
  IF r.object_count <> 4 OR r.sum <> 4700 OR r.unique_count <> 4 THEN
    RAISE EXCEPTION 'single statistic expected 4/4700/4, got %/%/%', r.object_count, r.sum, r.unique_count;
  END IF;

  -- 8. Histogram buckets partition the filtered set.
  SELECT coalesce(sum(h.object_count), 0) INTO n FROM public.histogram_object_set(t, '[]', 'distance', 4) h;
  IF n <> 4 THEN RAISE EXCEPTION 'histogram buckets expected to hold 4, got %', n; END IF;

  -- 9. The link presence filter, both ways, over foreign-key backing.
  n := public.count_object_set(t,
    '[{"type":"linkFilter","linkType":"flight-to-airline","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]');
  IF n <> 3 THEN RAISE EXCEPTION 'MUST_HAVE expected 3, got %', n; END IF;
  n := public.count_object_set(t,
    '[{"type":"linkFilter","linkType":"flight-to-airline","value":{"type":"presenceFilter","matchType":"MUST_NOT_HAVE"}}]');
  IF n <> 1 THEN RAISE EXCEPTION 'MUST_NOT_HAVE expected 1, got %', n; END IF;

  -- 10. A hidden property vanishes from rows and refuses to filter. The flip
  -- runs elevated: this fixture proves the engine, not the metadata write path.
  RESET ROLE;
  UPDATE public.object_type_properties SET visibility = 'hidden'
   WHERE object_type_id = t AND property_id = 'origin';
  IF NOT FOUND THEN RAISE EXCEPTION 'the visibility flip matched no row'; END IF;
  SET LOCAL ROLE authenticated;
  -- The flip marked the index stale (442's replacement-pipeline trigger);
  -- rebuild so the engine answers again.
  x := public.index_object_type(t);
  IF x.status <> 'success' THEN RAISE EXCEPTION 'reindex after flip failed: %', x.error; END IF;
  SELECT e INTO j FROM public.evaluate_object_set(t, '[]', '[]', 1, 0) e;
  IF j ? 'origin' THEN RAISE EXCEPTION 'a hidden property appeared in a result row'; END IF;
  BEGIN
    n := public.count_object_set(t,
      '[{"type":"propertyFilter","propertyType":"origin","value":{"type":"valuesFilter","values":["JFK"]}}]');
    RAISE EXCEPTION 'a hidden property accepted a filter';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:PropertyIsHidden%' THEN RAISE; END IF;
  END;

  -- 11. The render hints gate what the page says they gate.
  RESET ROLE;
  UPDATE public.object_type_properties
     SET searchable = false, sortable = false, selectable = false
   WHERE object_type_id = t AND property_id = 'status';
  IF NOT FOUND THEN RAISE EXCEPTION 'the hint flip matched no row'; END IF;
  SET LOCAL ROLE authenticated;
  x := public.index_object_type(t);
  IF x.status <> 'success' THEN RAISE EXCEPTION 'reindex after hint flip failed: %', x.error; END IF;
  BEGIN
    n := public.count_object_set(t,
      '[{"type":"propertyFilter","propertyType":"status","value":{"type":"textFilter","text":"on"}}]');
    RAISE EXCEPTION 'an unsearchable property accepted a keyword filter';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:PropertyNotSearchable%' THEN RAISE; END IF;
  END;
  BEGIN
    SELECT e INTO j FROM public.evaluate_object_set(t, '[]',
      '[{"property":"status","direction":"asc"}]', 1, 0) e;
    RAISE EXCEPTION 'an unsortable string accepted a sort';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:PropertyNotSortable%' THEN RAISE; END IF;
  END;
  BEGIN
    SELECT * INTO r FROM public.aggregate_object_set(t, '[]', 'status', NULL);
    RAISE EXCEPTION 'an unselectable property accepted an aggregation';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Ontology:PropertyNotSelectable%' THEN RAISE; END IF;
  END;
  -- The dependency CHECK: sortable without searchable is not a state.
  RESET ROLE;
  BEGIN
    UPDATE public.object_type_properties SET sortable = true
     WHERE object_type_id = t AND property_id = 'status';
    RAISE EXCEPTION 'sortable without searchable was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SET LOCAL ROLE authenticated;

  -- 12. The grammar: a second link filter is refused, and the saved set
  --     carries the same CHECK.
  IF public.object_set_filters_valid(
    '[{"type":"linkFilter","linkType":"a","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}},
      {"type":"linkFilter","linkType":"b","value":{"type":"presenceFilter","matchType":"MUST_HAVE"}}]') THEN
    RAISE EXCEPTION 'two link filters passed the grammar';
  END IF;
  INSERT INTO public.object_sets (ontology_id, name, api_name, subject_type_id, filters)
  VALUES (ont, 'Delayed flights', 'delayed_flights', t,
    '[{"type":"propertyFilter","propertyType":"status","value":{"type":"valuesFilter","values":["delayed"]}}]');
  BEGIN
    INSERT INTO public.object_sets (ontology_id, name, api_name, subject_type_id, filters)
    VALUES (ont, 'Bad', 'bad_set', t, '[{"type":"nonsense"}]');
    RAISE EXCEPTION 'a saved set accepted filters outside the grammar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '475: filters, sorts, hints, hidden properties, links, aggregates, histogram, saved-set grammar';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
