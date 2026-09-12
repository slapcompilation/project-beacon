-- 804: the preview table reads the view, and a column knows its stats
--
-- Reading: docs/foundry-reference/readings/dataset-preview.md (§5, decisions 2, 3).
--
--   "Use the preview table to understand the structure of the data and to quickly explore the values in the dataset."
--   — dataset-preview/overview.md
--
--   "By default, the preview table will show a limited sample of the data; the exact number of rows is displayed in the preview table header. However, any action taken on the data, such as filtering or sorting, will apply to the full dataset and increase the preview sample size. Depending on the number of rows, you may not see the entire dataset in the preview."
--   — dataset-preview/overview.md
--
--   "* Select a column’s menu to sort, filter, and generate charts over the column data."
--   — dataset-preview/overview.md
--
--   "* Select an individual cell to exclude or include only the selected value from the preview."
--   — dataset-preview/overview.md
--
--   "* **Columns:** Information on the different columns in the dataset, including the type of data, description, and data stats (percentage of null values, distributions and samples)."
--   — dataset-preview/overview.md
--
-- Rows live in datasets.<physical_table> keyed by _file (393), and until now the
-- only reader was index_object_type (484). A screen needs one: dataset_preview,
-- over the branch's current view (`_file IN dataset_view(branch)`, the indexer's
-- own predicate), gated by can_read_dataset_data — the DATA predicate, which is
-- file access plus every propagated data marking (401) — before any row is
-- touched. SECURITY DEFINER because the physical table's own policy (393) checks
-- only can_read_dataset, the weaker metadata predicate; the gate here is
-- stronger than the table's, never weaker.
--
-- Sort and filter apply BEFORE the sample, which is what "will apply to the full
-- dataset" means: the LIMIT is on the filtered, ordered result. A filter is
-- {column, op, value} with op in include|exclude — the two verbs the cell menu
-- offers (dataset-preview.png) — and a JSON null value means the SQL null,
-- because the grid renders `null` as a cell you can click. Equality is over
-- to_jsonb(column), so the value the grid sends back is compared in the same
-- encoding it received. A column name comes from the schema in force on the
-- branch (dataset_branch_schema, 410), never from the caller's string, so a name
-- that is not a column is refused by name rather than quoted into SQL.
--
-- dataset_column_stats returns the counts the stats panel names (Normal, Null,
-- Empty, Whitespace) with the distinct count and the values by descending
-- count. The length histogram and the Needs trim / Numeric / Non-alpha /
-- Uppercase counts are NOT built; decision 3 records them.
--
-- OURS: the default sample of 300 is read off dataset.png ("Showing 300 of 481
-- rows"); no page states the number. The sample ceiling of 10,000 is ours too.
--
-- PROVED BY DOING: the block at the end uploads a CSV as a real caller through
-- upload_file_to_dataset, reads it back through dataset_preview sampled, sorted
-- and filtered both ways including on null, counts it, and compares every number
-- against the file that went in; reads stats and compares them too; is refused
-- by name for an unknown column, an unknown op, and for a caller in another
-- organization. A dataset with no schema yet returns nothing rather than
-- failing, because "Foundry has schema-less datasets too" (392).

-- ── the WHERE the two readers share ─────────────────────────────────────────
-- Pure: it is handed the legal columns and builds text. Not callable by the
-- app role — nothing gates it, so nothing outside the two gated readers may
-- reach it.
CREATE OR REPLACE FUNCTION public.dataset_preview_where(p_cols text[], p_filters jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE f jsonb; sql text := ''; col text; op text;
BEGIN
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) LOOP
    col := f ->> 'column'; op := f ->> 'op';
    IF col IS NULL OR NOT (col = ANY (p_cols)) THEN
      RAISE EXCEPTION 'Datasets:UnknownColumn — "%" is not a column of this view', coalesce(col, '');
    END IF;
    IF op IS DISTINCT FROM 'include' AND op IS DISTINCT FROM 'exclude' THEN
      RAISE EXCEPTION 'Datasets:UnknownFilterOp — "%" (include or exclude)', coalesce(op, '');
    END IF;
    sql := sql || ' AND ' || CASE
      WHEN f -> 'value' IS NULL OR jsonb_typeof(f -> 'value') = 'null' THEN
        format('r.%I IS %s NULL', col, CASE WHEN op = 'include' THEN '' ELSE 'NOT' END)
      WHEN op = 'include' THEN format('to_jsonb(r.%I) = %L::jsonb', col, f -> 'value')
      -- IS DISTINCT FROM keeps the nulls: excluding one value is not excluding the blanks.
      ELSE format('to_jsonb(r.%I) IS DISTINCT FROM %L::jsonb', col, f -> 'value')
    END;
  END LOOP;
  RETURN sql;
END $$;
COMMENT ON FUNCTION public.dataset_preview_where(text[], jsonb) IS
  'The filter clause dataset_preview and dataset_preview_count share: [{column, op: include|exclude, value}] over a list of legal columns, a JSON null meaning the SQL null. Not granted to the app role; the gated readers call it.';
REVOKE ALL ON FUNCTION public.dataset_preview_where(text[], jsonb) FROM PUBLIC, authenticated;

-- ── the gate and the lookup, once ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dataset_preview_target(p_branch uuid,
  OUT dataset_id uuid, OUT physical_table text, OUT columns text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  SELECT d.id, d.physical_table INTO dataset_id, physical_table
    FROM public.dataset_branches b JOIN public.datasets d ON d.id = b.dataset_id
   WHERE b.id = p_branch;
  IF dataset_id IS NULL OR NOT public.can_read_dataset(dataset_id) THEN
    RAISE EXCEPTION 'Datasets:BranchNotFound — % is not a branch you can see', p_branch;
  END IF;
  IF NOT public.can_read_dataset_data(dataset_id) THEN
    RAISE EXCEPTION 'Datasets:NoDataAccess — you can see this dataset but not its rows';
  END IF;
  SELECT array_agg(f ->> 'name') INTO columns
    FROM jsonb_array_elements(coalesce(public.dataset_branch_schema(p_branch), '[]'::jsonb)) f;
END $$;
COMMENT ON FUNCTION public.dataset_preview_target(uuid) IS
  'The dataset behind a branch, its physical table and the columns of the schema in force — after the two gates every row reader applies: can_read_dataset, then can_read_dataset_data.';
REVOKE ALL ON FUNCTION public.dataset_preview_target(uuid) FROM PUBLIC, authenticated;

-- ── the preview table ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dataset_preview(
  p_branch   uuid,
  p_limit    integer DEFAULT 300,
  p_order_by text    DEFAULT NULL,
  p_desc     boolean DEFAULT false,
  p_filters  jsonb   DEFAULT '[]'::jsonb
) RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t record; order_sql text := ' ORDER BY r._row';
BEGIN
  SELECT * INTO t FROM public.dataset_preview_target(p_branch);
  IF t.physical_table IS NULL THEN RETURN; END IF;
  IF p_order_by IS NOT NULL THEN
    IF NOT (p_order_by = ANY (coalesce(t.columns, '{}'))) THEN
      RAISE EXCEPTION 'Datasets:UnknownColumn — "%" is not a column of this view', p_order_by;
    END IF;
    order_sql := format(' ORDER BY r.%I %s NULLS LAST, r._row', p_order_by,
                        CASE WHEN p_desc THEN 'DESC' ELSE 'ASC' END);
  END IF;
  -- The two system columns are the file's business, not the reader's.
  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(r) - ''_row'' - ''_file'' FROM datasets.%I r
      WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))%s%s LIMIT %s',
    t.physical_table, p_branch,
    public.dataset_preview_where(coalesce(t.columns, '{}'), p_filters), order_sql,
    greatest(1, least(coalesce(p_limit, 300), 10000)));
END $$;
COMMENT ON FUNCTION public.dataset_preview(uuid, integer, text, boolean, jsonb) IS
  'The preview table: a sample (default 300) of the branch''s current view, one jsonb per row keyed by column, after the sort and the include/exclude filters — which apply to the whole view, not to the sample. Gated by can_read_dataset_data.';
REVOKE ALL ON FUNCTION public.dataset_preview(uuid, integer, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_preview(uuid, integer, text, boolean, jsonb) TO authenticated;

-- "the exact number of rows is displayed in the preview table header" — the
-- denominator, under the same filters, so "300 of 481" stays true once filtered.
CREATE OR REPLACE FUNCTION public.dataset_preview_count(p_branch uuid, p_filters jsonb DEFAULT '[]'::jsonb)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t record; n bigint;
BEGIN
  SELECT * INTO t FROM public.dataset_preview_target(p_branch);
  IF t.physical_table IS NULL THEN RETURN 0; END IF;
  EXECUTE format(
    'SELECT count(*) FROM datasets.%I r WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))%s',
    t.physical_table, p_branch, public.dataset_preview_where(coalesce(t.columns, '{}'), p_filters))
    INTO n;
  RETURN n;
END $$;
COMMENT ON FUNCTION public.dataset_preview_count(uuid, jsonb) IS
  'How many rows the view holds under the preview''s filters — the "of 481" in "Showing 300 of 481 rows". Gated by can_read_dataset_data.';
REVOKE ALL ON FUNCTION public.dataset_preview_count(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_preview_count(uuid, jsonb) TO authenticated;

-- ── a column's stats ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dataset_column_stats(p_branch uuid, p_column text, p_top integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t record; out jsonb;
BEGIN
  SELECT * INTO t FROM public.dataset_preview_target(p_branch);
  IF p_column IS NULL OR NOT (p_column = ANY (coalesce(t.columns, '{}'))) THEN
    RAISE EXCEPTION 'Datasets:UnknownColumn — "%" is not a column of this view', coalesce(p_column, '');
  END IF;
  IF t.physical_table IS NULL THEN
    RETURN jsonb_build_object('rows', 0, 'normal', 0, 'null', 0, 'empty', 0, 'whitespace', 0,
                              'distinct', 0, 'values', '[]'::jsonb);
  END IF;
  -- Empty and whitespace are text facts; on a typed column they are simply zero.
  EXECUTE format($q$
    WITH v AS (SELECT r.%1$I AS val FROM datasets.%2$I r
                WHERE r._file IN (SELECT file_id FROM public.dataset_view(%3$L))),
    c AS (SELECT count(*) AS rows,
                 count(*) FILTER (WHERE val IS NULL) AS nulls,
                 count(*) FILTER (WHERE val IS NOT NULL AND val::text = '') AS empty,
                 count(*) FILTER (WHERE val IS NOT NULL AND val::text <> '' AND btrim(val::text) = '') AS whitespace,
                 count(DISTINCT val::text) AS distinct_values
            FROM v),
    top AS (SELECT coalesce(jsonb_agg(jsonb_build_object('value', to_jsonb(val), 'count', n)
                                      ORDER BY n DESC, val::text), '[]'::jsonb) AS values
              FROM (SELECT val, count(*) AS n FROM v WHERE val IS NOT NULL
                     GROUP BY val ORDER BY n DESC, val::text LIMIT %4$s) x)
    SELECT jsonb_build_object(
      'rows', c.rows, 'null', c.nulls, 'empty', c.empty, 'whitespace', c.whitespace,
      'normal', c.rows - c.nulls - c.empty - c.whitespace,
      'distinct', c.distinct_values, 'values', top.values)
      FROM c, top
  $q$, p_column, t.physical_table, p_branch, greatest(1, least(coalesce(p_top, 20), 200)))
  INTO out;
  RETURN out;
END $$;
COMMENT ON FUNCTION public.dataset_column_stats(uuid, text, integer) IS
  'The stats panel''s counts for one column of the branch''s current view — rows, normal, null, empty, whitespace, distinct — and the values by descending count (default top 20). Gated by can_read_dataset_data.';
REVOKE ALL ON FUNCTION public.dataset_column_stats(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_column_stats(uuid, text, integer) TO authenticated;

-- ── proved by doing ─────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; org2 uuid; usr uuid; usr2 uuid; sp uuid; proj uuid; ds uuid; br uuid; br2 uuid; ds2 uuid;
  n bigint; first jsonb; st jsonb; msg text;
BEGIN
  -- A real caller, as 790 did: the readers compose can_read_dataset_data, and a
  -- proof run only as the owner would prove nothing about the role that calls.
  INSERT INTO public.organizations (name) VALUES ('m804 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm804-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm804-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M804 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m804proj', 'm804proj', sp, org) RETURNING id INTO proj;
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m804ds', 'm804', proj, org) RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  -- no schema yet: nothing, not an error
  IF (SELECT count(*) FROM public.dataset_preview(br)) <> 0 THEN
    RAISE EXCEPTION 'a dataset with no schema previews as empty';
  END IF;
  IF public.dataset_preview_count(br) <> 0 THEN RAISE EXCEPTION 'and counts zero'; END IF;

  PERFORM public.upload_file_to_dataset(ds, 'crew.csv',
    'name,seats' || chr(10) || 'Ada,2' || chr(10) || 'Grace,3' || chr(10)
      || 'Kay,NA' || chr(10) || 'Ada,5' || chr(10),
    'master', public.csv_parser_defaults() || '{"nullValues":["NA"]}'::jsonb);

  -- the sample, whole, keyed by column and stripped of the system columns
  SELECT count(*) INTO n FROM public.dataset_preview(br);
  IF n <> 4 THEN RAISE EXCEPTION 'four rows went in, % came out', n; END IF;
  SELECT p INTO first FROM public.dataset_preview(br) p LIMIT 1;
  IF first ->> 'name' <> 'Ada' OR (first ->> 'seats')::int <> 2 THEN
    RAISE EXCEPTION 'the first row in file order is Ada,2 — got %', first;
  END IF;
  IF first ? '_file' OR first ? '_row' THEN RAISE EXCEPTION 'system columns leaked: %', first; END IF;
  IF public.dataset_preview_count(br) <> 4 THEN RAISE EXCEPTION 'the denominator is the whole view'; END IF;

  -- the sample is a LIMIT on the ordered result: sorted desc, the top row is 5
  SELECT p INTO first FROM public.dataset_preview(br, 1, 'seats', true) p;
  IF (first ->> 'seats')::int <> 5 THEN RAISE EXCEPTION 'sorted desc and sampled to 1, seats should be 5: %', first; END IF;
  -- nulls sort last in either direction, so ascending puts 2 first and NA last
  SELECT p INTO first FROM public.dataset_preview(br, 1, 'seats', false) p;
  IF (first ->> 'seats')::int <> 2 THEN RAISE EXCEPTION 'sorted asc, seats should be 2: %', first; END IF;
  SELECT p INTO first FROM public.dataset_preview(br, 4, 'seats', false) p OFFSET 3;
  IF first -> 'seats' IS NOT NULL AND jsonb_typeof(first -> 'seats') <> 'null' THEN
    RAISE EXCEPTION 'the null seat sorts last: %', first;
  END IF;

  -- include / exclude, on a value and on the null
  SELECT count(*) INTO n FROM public.dataset_preview(br, 300, NULL, false,
    '[{"column":"name","op":"include","value":"Ada"}]');
  IF n <> 2 THEN RAISE EXCEPTION 'include Ada should give 2 rows, got %', n; END IF;
  SELECT count(*) INTO n FROM public.dataset_preview(br, 300, NULL, false,
    '[{"column":"name","op":"exclude","value":"Ada"}]');
  IF n <> 2 THEN RAISE EXCEPTION 'exclude Ada should give 2 rows, got %', n; END IF;
  SELECT count(*) INTO n FROM public.dataset_preview(br, 300, NULL, false,
    '[{"column":"seats","op":"include","value":null}]');
  IF n <> 1 THEN RAISE EXCEPTION 'include null seats should give Kay alone, got %', n; END IF;
  -- excluding a value keeps the null row: 4 - Ada(2) = Grace, Kay
  SELECT count(*) INTO n FROM public.dataset_preview(br, 300, NULL, false,
    '[{"column":"seats","op":"exclude","value":2}]');
  IF n <> 3 THEN RAISE EXCEPTION 'exclude seats=2 keeps the null row: expected 3, got %', n; END IF;
  -- two filters conjoin, and the count follows the filters
  IF public.dataset_preview_count(br,
       '[{"column":"name","op":"include","value":"Ada"},{"column":"seats","op":"exclude","value":2}]') <> 1 THEN
    RAISE EXCEPTION 'Ada and not 2 is one row';
  END IF;

  -- stats: the panel's counts, then the values by count
  st := public.dataset_column_stats(br, 'name');
  IF (st ->> 'rows')::int <> 4 OR (st ->> 'null')::int <> 0 OR (st ->> 'distinct')::int <> 3
     OR (st ->> 'normal')::int <> 4 THEN
    RAISE EXCEPTION 'name stats wrong: %', st;
  END IF;
  IF st -> 'values' -> 0 ->> 'value' <> 'Ada' OR (st -> 'values' -> 0 ->> 'count')::int <> 2 THEN
    RAISE EXCEPTION 'the top value is Ada x2: %', st;
  END IF;
  st := public.dataset_column_stats(br, 'seats', 2);
  IF (st ->> 'null')::int <> 1 OR (st ->> 'normal')::int <> 3 OR jsonb_array_length(st -> 'values') <> 2 THEN
    RAISE EXCEPTION 'seats stats wrong: %', st;
  END IF;

  -- refusals, by name
  BEGIN
    PERFORM count(*) FROM public.dataset_preview(br, 300, 'rank');
    RAISE EXCEPTION 'an unknown sort column was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:UnknownColumn%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM count(*) FROM public.dataset_preview(br, 300, NULL, false, '[{"column":"name","op":"like","value":"A"}]');
    RAISE EXCEPTION 'an unknown filter op was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:UnknownFilterOp%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.dataset_column_stats(br, 'rank');
    RAISE EXCEPTION 'stats on an unknown column were accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:UnknownColumn%' THEN RAISE; END IF;
  END;

  -- another organization sees no branch at all
  INSERT INTO public.organizations (name) VALUES ('m804 other') RETURNING id INTO org2;
  usr2 := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm804b-' || usr2 || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr2, 'm804b-' || usr2 || '@beacon.test', 'admin', org2);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr2, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org2))::text, true);
  BEGIN
    PERFORM count(*) FROM public.dataset_preview(br);
    RAISE EXCEPTION 'a caller in another organization read the rows';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:BranchNotFound%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.dataset_preview_count(br);
    RAISE EXCEPTION 'a caller in another organization counted the rows';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:BranchNotFound%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION 'M804_PROBE_DONE';
EXCEPTION WHEN others THEN
  msg := SQLERRM;
  PERFORM set_config('request.jwt.claims', '', true);
  IF msg = 'M804_PROBE_DONE' THEN
    RAISE NOTICE '804 proved: preview, count, stats, sort, include/exclude, null, refusals';
  ELSE
    RAISE;
  END IF;
END $$;
