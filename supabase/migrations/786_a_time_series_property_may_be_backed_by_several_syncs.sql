-- A time series property may be backed by several syncs, and a qualified
-- series id says which.
--
-- This lifts the two refusals that 779 and 780 wrote, and 783 predicted would
-- lift together. No table changes: `object_type_time_series_sources` is keyed
-- (datasource_id, property_id) and has always permitted several rows per
-- property — 780 refused the second in a trigger, not in the schema.

--   "you can link a time series property to multiple time series syncs. To do
--    this, you must have a column of qualified series IDs on your object type
--    backing dataset."
--   — time-series/create-or-select-ts-ot.md

-- ── the encoding, which is what made this buildable ───────────────────────
--
-- The one thing that could have stopped this is an undocumented cell format.
-- It is documented three ways that agree, and to the whitespace:

--   "A qualified series ID has the following shape: `"{"seriesId":"<replace with series ID>","syncRid":"<replace with sync RID containing this series ID>"}"`. The value of a time series property that is backed by multiple time series syncs must be a qualified series ID, and it must be formatted as a JSON string with no newlines or spaces."
--   — time-series/time-series-concepts-glossary.md

--   "The `seriesId` corresponds to the series identifier in the sync dataset,
--    and the `syncRid` corresponds to the RID of the sync that stores that
--    series."
--   — time-series/create-or-select-ts-ot.md

-- and the producer prints its own output, which is where the `null` sentinel
-- below comes from:

--   "| seriesOne | {"seriesId":"seriesOne","syncRid":"ri.time-series-catalog.main.sync.11111111"} |"
--   — pb-functions-expression/createQualifiedTimeSeriesIdV1.md

-- The `syncRid` is our own `time_series_syncs.rid` verbatim — 774 already emits
-- `ri.time-series-catalog.main.sync.<uuid>` — so the join is equality with no
-- translation. The worked-example capture shows the column typed `String` with
-- cells opening on a bare `{`, so the glossary's outer quotes are notation.

-- ── three cell forms, and they MIX in one column ──────────────────────────

--   "Yes! A TSP can have a mix of values which are either a series ID for
--    (non-derived) time series or Codex template RIDs for derived series."
--   — time-series/derived-series-common-questions.md

-- So the reader discriminates per ROW, not per property. A bare id, a qualified
-- object, or a Codex template rid — and the third raises, because derived
-- series are not built. Refusing a legal-but-unbuilt cell by name is the same
-- choice 779 made for the per-series boolean.

-- ── why a bare id is still safe under several syncs ──────────────────────

--   "If a time series property is backed by more than one time series sync, the
--    `seriesIds` in the property values must be fully contained within a single
--    time series sync."
--   — time-series/time-series-syncs.md

-- That is the guarantee that lets an unqualified cell be searched across every
-- bound sync without double counting: at most one can answer.

-- ── markings are ALL, not any ────────────────────────────────────────────

--   "To view a time series property, you must satisfy the access requirements
--    for **all** of its backing data sources."
--   — time-series/time-series-permissions.md

-- So an unreadable sync suppresses the WHOLE property, rather than being
-- skipped to return a partial series. Skipping would hand back something the
-- page says may not be viewed.

-- ── what lifts, and what replaces it ─────────────────────────────────────
--
-- **780's `TimeSeries:MultiSyncNotBuilt` is deleted.** Its stated scope was
-- "exactly as long as `time_series_points` reads a bare series id", and that
-- is now over.
--
-- **779's `TimeSeries:MixedSeriesNotBuilt` is deleted too**, and 783 already
-- corrected the reason it was ever given: 779 refused on cost, "a second lookup
-- for a case no page shows configured", and 782 made that lookup routine. What
-- kept it right until now was that one sync per property already determines the
-- item type, so the boolean had no work. Several syncs of different kinds is
-- exactly the case where it does:

--   "Sometimes, it is not possible to do this because some sensors hold
--    categorical data and others contain numerical data; different data types
--    cannot exist within one time series sync."
--   — time-series/create-or-select-ts-ot.md

--   "*\[Required if the TSP is backed by multiple syncs of both numerical and
--    categorical types]* A Boolean value of `true` indicates a given sensor
--    object has categorical time series data, otherwise the data are assumed to
--    be numerical."
--   — time-series/create-sensor-ot.md

-- It is replaced by a narrower arm: the referenced property must be a boolean
-- COLUMN property of the same object type, because otherwise the reader cannot
-- read it off the index row. That requirement is ours — the api says only
-- "boolean property type ID" — and it is the price of resolving it in the same
-- query that already reads the series id.
--
-- The "otherwise" in that quote covers null: a null boolean reads as numerical.

-- ── what is INFERENCE here, listed rather than buried ────────────────────
--
--  1. The cell discriminator itself — leading `{`, then `templateRid` versus
--     `seriesId`+`syncRid`. All three shapes are published; the rule for
--     telling them apart is not.
--  2. `TimeSeries:SyncNotBoundToProperty` when a qualified cell names a sync
--     the property is not bound to. No page states any behaviour; an error
--     beats an empty series with no cause.
--  3. Treating the producer's `"null"` sentinel as no series. The sentinel is
--     quoted above; the treatment is ours.
--  4. A UNION across bound syncs for a bare id, and ordering the merged stream.
--     The containment rule makes it safe; that a union is the implementation is
--     ours.
--  5. `TimeSeries:DerivedSeriesNotBuilt` rather than skipping a Codex cell.
--  6. Requiring the is-non-numeric property to be an indexed column property.
--  7. That mixed-kind syncs FORCE `numericOrNonNumeric`. It follows from one
--     sync being one kind, but no page tells an operator to declare that member
--     because the bound syncs differ.
--
-- Object Storage v2 is a stated precondition — "Your object type must be in
-- Object Storage v2 to back a time series property with multiple time series
-- syncs" — and it is satisfied here rather than enforced: we have no v1.

-- ── what is NOT built ────────────────────────────────────────────────────
--
-- No producer of qualified series ids: steps 1-4 of the page are Pipeline
-- Builder work and step 3 is a pipeline expression, so a wizard here would be
-- an authoring surface Foundry does not have. No Codex or derived series. No
-- cap, no ordering, no primary-sync flag — every one of those is an ABSENCE in
-- the corpus and adding one would be stricter than Foundry. No sync argument on
-- the reader: none of the five endpoints that read a TSP takes one, because the
-- disambiguation lives in the cell.

-- ── 1. the per-sync query, LIFTED rather than retyped ────────────────────
--
-- 776's pattern. The query construction — the physical table, the master
-- branch, the timestamp-unit CASE and the format string — is extracted from the
-- live `time_series_points` by position and re-parameterised, so that not one
-- character of the part that is easy to get wrong is written from memory.

DO $mig$
DECLARE src text; frag text; a text; b text; ia int; ib int;
BEGIN
  src := replace(pg_get_functiondef(
    'public.time_series_points(uuid,text,text,timestamptz,timestamptz,integer)'::regprocedure), chr(13), '');

  a := '  SELECT d.physical_table INTO tbl FROM public.datasets d WHERE d.id = sync.input_dataset_id;';
  b := 'greatest(coalesce(p_limit, 1000), 0));';
  ia := position(a in src);
  ib := position(b in src);
  IF ia = 0 OR ib = 0 OR ib < ia THEN
    RAISE EXCEPTION 'the query-building span is not where 774 left it (a=%, b=%)', ia, ib;
  END IF;
  frag := substring(src from ia for ib + length(b) - ia);

  -- the fragment reads a record named `sync` and a variable named `series`
  frag := replace(frag, 'sync.', 's.');
  frag := replace(frag, ', series, branch,', ', p_series, branch,');
  -- and it returns from a void body; here it yields a text
  frag := replace(frag, 'IF tbl IS NULL OR branch IS NULL THEN RETURN; END IF;',
                        'IF tbl IS NULL OR branch IS NULL THEN RETURN NULL; END IF;');

  IF frag LIKE '%sync.%' OR frag NOT LIKE '%p_series%' THEN
    RAISE EXCEPTION 'the extraction did not re-parameterise cleanly';
  END IF;

  EXECUTE 'CREATE OR REPLACE FUNCTION public.time_series_sync_query(
  p_sync uuid, p_series text, p_from timestamptz, p_to timestamptz, p_limit integer)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO ''public'', ''pg_temp'' AS $fn$
DECLARE s record; tbl text; branch uuid; tcol text; unit text; q text;
BEGIN
  SELECT * INTO s FROM public.time_series_syncs WHERE id = p_sync;
  IF s.id IS NULL THEN RETURN NULL; END IF;
' || frag || '
  RETURN q;
END $fn$;';
END $mig$;

COMMENT ON FUNCTION public.time_series_sync_query(uuid, text, timestamptz, timestamptz, integer) IS
  'The SELECT that reads one series out of one sync, as text. Lifted verbatim out of 774''s time_series_points by 786 rather than retyped, because a property may now be backed by several syncs and the same query is built once per sync. Null when the sync is gone or its dataset has no materialized table or master branch.';

GRANT EXECUTE ON FUNCTION public.time_series_sync_query(uuid, text, timestamptz, timestamptz, integer)
  TO service_role;

-- ── 2. the reader, rebuilt around the sync SET ───────────────────────────

CREATE OR REPLACE FUNCTION public.time_series_points(
  p_object_type uuid, p_primary_key text, p_property text,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (point_time timestamptz, num double precision, cat text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  pr record; s record; idx text; pk text; series text; flagcol text; flag text;
  v text; j jsonb; want uuid; parts text[] := '{}'; q text; n int := 0;
BEGIN
  SELECT p.* INTO pr FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND (p.property_id = p_property OR p.api_name = p_property)
     AND p.base_type = 'time_series';
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:NotATimeSeriesProperty — % is not a time series property of this object type', p_property;
  END IF;

  SELECT count(*) INTO n FROM public.object_type_time_series_sources src
   WHERE src.property_id = pr.id;
  IF n = 0 THEN
    RAISE EXCEPTION 'TimeSeries:PropertyHasNoSync — % is bound to no time series sync', p_property;
  END IF;

  -- "you must satisfy the access requirements for **all** of its backing data
  --  sources" — so ANY unreadable sync suppresses the property, and absence is
  --  how the api masks access everywhere on this path.
  FOR s IN
    SELECT sy.* FROM public.object_type_time_series_sources src
      JOIN public.object_type_datasources d ON d.id = src.datasource_id
      JOIN public.time_series_syncs sy ON sy.id = d.time_series_sync_id
     WHERE src.property_id = pr.id
  LOOP
    IF NOT public.satisfies_markings(public.effective_data_markings(s.input_dataset_id)) THEN
      RETURN;
    END IF;
  END LOOP;

  SELECT x.index_table INTO idx FROM public.object_type_indexes x
   WHERE x.object_type_id = p_object_type AND public.object_type_index_ready(p_object_type);
  IF idx IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:ObjectTypeNotIndexed — % has no successful index to read the series id from',
      (SELECT api_name FROM public.object_types WHERE id = p_object_type);
  END IF;
  SELECT p.property_id INTO pk FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;
  SELECT p.property_id INTO flagcol FROM public.object_type_properties p
   WHERE p.id = pr.time_series_is_non_numeric_property_id;

  -- One read of the index row, for the series id and — when the declaration
  -- names one — the per-object boolean beside it. 779 refused this feature on
  -- the cost of "a second lookup"; there is no second lookup.
  IF flagcol IS NULL THEN
    EXECUTE format('SELECT o.%I::text, NULL::text FROM objects.%I o WHERE o.%I::text = %L',
                   pr.property_id, idx, pk, p_primary_key) INTO series, flag;
  ELSE
    EXECUTE format('SELECT o.%I::text, o.%I::text FROM objects.%I o WHERE o.%I::text = %L',
                   pr.property_id, flagcol, idx, pk, p_primary_key) INTO series, flag;
  END IF;
  IF series IS NULL OR btrim(series) = '' THEN RETURN; END IF;

  -- Three cell forms, and they mix in one column, so the discrimination is per
  -- ROW. The leading brace is ours; the shapes are the api's.
  v := btrim(series);
  IF left(v, 1) <> '{' THEN
    -- A bare series id is "searched for within that property's data sources",
    -- and the containment rule promises at most one can answer.
    FOR s IN
      SELECT sy.* FROM public.object_type_time_series_sources src
        JOIN public.object_type_datasources d ON d.id = src.datasource_id
        JOIN public.time_series_syncs sy ON sy.id = d.time_series_sync_id
       WHERE src.property_id = pr.id
    LOOP
      q := public.time_series_sync_query(s.id, v, p_from, p_to, p_limit);
      IF q IS NOT NULL THEN parts := parts || ('(' || q || ')'); END IF;
    END LOOP;
  ELSE
    BEGIN
      j := v::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'TimeSeries:UnreadableSeriesValue — % holds a value that is neither a series id nor a qualified series id', pr.property_id;
    END;

    IF j ? 'templateRid' THEN
      RAISE EXCEPTION 'TimeSeries:DerivedSeriesNotBuilt — % holds a Codex template rid, and derived series are not built', pr.property_id;
    ELSIF j ? 'seriesId' AND j ? 'syncRid' THEN
      -- The producer emits the four-character string `null` when either of its
      -- arguments was null; such a row names no series.
      IF j->>'seriesId' IS NULL OR j->>'syncRid' IS NULL
         OR j->>'seriesId' = 'null' OR j->>'syncRid' = 'null' THEN
        RETURN;
      END IF;
      SELECT sy.id INTO want FROM public.object_type_time_series_sources src
        JOIN public.object_type_datasources d ON d.id = src.datasource_id
        JOIN public.time_series_syncs sy ON sy.id = d.time_series_sync_id
       WHERE src.property_id = pr.id AND sy.rid = j->>'syncRid';
      IF want IS NULL THEN
        RAISE EXCEPTION 'TimeSeries:SyncNotBoundToProperty — % names sync %, which does not back it',
          pr.property_id, j->>'syncRid';
      END IF;
      q := public.time_series_sync_query(want, j->>'seriesId', p_from, p_to, p_limit);
      IF q IS NOT NULL THEN parts := parts || ('(' || q || ')'); END IF;
    ELSE
      RAISE EXCEPTION 'TimeSeries:UnreadableSeriesValue — % holds an object that is not a qualified series id', pr.property_id;
    END IF;
  END IF;

  IF cardinality(parts) = 0 THEN RETURN; END IF;

  -- Only the column the declaration promises. numericOrNonNumeric keeps both,
  -- unless a per-object boolean says which — "a Boolean value of `true`
  -- indicates ... categorical time series data, otherwise the data are assumed
  -- to be numerical", and "otherwise" covers a null.
  FOR point_time, num, cat IN
    -- Each lifted part already carries its own ORDER BY and LIMIT, so the
    -- merged stream is ordered in a wrapper rather than beside them.
    EXECUTE format('SELECT * FROM (%s) m ORDER BY 1 LIMIT %s',
                   array_to_string(parts, ' UNION ALL '),
                   greatest(coalesce(p_limit, 1000), 0))
  LOOP
    IF pr.time_series_item_type = 'string' THEN num := NULL; END IF;
    IF pr.time_series_item_type = 'double' THEN cat := NULL; END IF;
    IF pr.time_series_item_type = 'numericOrNonNumeric' AND flagcol IS NOT NULL THEN
      IF flag = 'true' THEN num := NULL; ELSE cat := NULL; END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.time_series_points(uuid, text, text, timestamptz, timestamptz, integer) IS
  'One object''s points for one time series property. Since 786 a property may be backed by SEVERAL syncs: the cell decides which is read — a bare series id is searched across all of them, which the containment rule makes unambiguous, and a qualified {seriesId,syncRid} names one. Markings are checked over every bound sync because the page says ALL, so one unreadable sync suppresses the property rather than returning a partial series. A Codex template rid raises, being legal in Foundry and unbuilt here. The declared itemType decides which column is returned, and for numericOrNonNumeric a per-object boolean property may decide it per object instead — read off the same index row as the series id.';

-- ── 3. the guard: two refusals out, two narrower rules in ────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.guard_time_series_source()'::regprocedure), chr(13), '');

  -- 780's multi-sync refusal, deleted whole
  a := '  -- Several syncs need "a column of qualified series IDs", which 774 excluded,
  -- and time_series_points resolves the binding with LIMIT 1.
  IF EXISTS (SELECT 1 FROM public.object_type_time_series_sources s
              WHERE s.property_id = NEW.property_id
                AND s.datasource_id <> NEW.datasource_id) THEN
    RAISE EXCEPTION ''TimeSeries:MultiSyncNotBuilt — % is already bound to a time series sync, and a qualified series id spanning several is not read yet'', pr.property_id;
  END IF;
';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 780''s multi-sync refusal once, found %', n; END IF;
  src := replace(src, a, '');

  -- 779's blanket refusal of the per-series boolean, replaced by a readability
  -- rule: the reader takes it off the index row, so it must be an indexed
  -- column property of this object type.
  a := '  -- The boolean property reference resolves per SERIES, which the reader does
  -- not do yet. Refused rather than stored and ignored.
  IF pr.time_series_is_non_numeric_property_id IS NOT NULL THEN
    RAISE EXCEPTION ''TimeSeries:MixedSeriesNotBuilt — a boolean property deciding numeric-or-not per series is not read yet; leave it unset and the type is inferred from the result'';
  END IF;
';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 779''s mixed-series refusal once, found %', n; END IF;
  src := replace(src, a,
'  -- 786 reads this per object, off the same index row as the series id, so it
  -- must be a boolean column property of this object type.
  IF pr.time_series_is_non_numeric_property_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.object_type_properties b
                    WHERE b.id = pr.time_series_is_non_numeric_property_id
                      AND b.object_type_id = pr.object_type_id
                      AND b.base_type = ''boolean''
                      AND b.source = ''column'') THEN
      RAISE EXCEPTION ''TimeSeries:IsNonNumericPropertyUnreadable — the boolean deciding numeric-or-not must be a boolean column property of this object type'';
    END IF;
  END IF;
');

  -- 780's item-type agreement arm only looked at NEW's sync; with several it
  -- has to quantify over the whole bound set.
  a := '  -- "different data types cannot exist within one time series sync", so the
  -- sync settles it and a disagreeing declaration silences the reader.
  IF pr.time_series_item_type IN (''string'', ''double'') THEN
    sync_item := public.time_series_sync_item_type(d.time_series_sync_id);
    IF sync_item IS NOT NULL AND sync_item <> pr.time_series_item_type THEN
      RAISE EXCEPTION ''TimeSeries:ItemTypeDisagreesWithSync — % declares % and the sync''''s value column is %'',
        pr.property_id, pr.time_series_item_type, sync_item;
    END IF;
  END IF;
';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 780''s item-type arm once, found %', n; END IF;
  src := replace(src, a,
'  -- One sync is one kind, so several syncs of DIFFERENT kinds are exactly the
  -- case numericOrNonNumeric exists for. Quantified over the whole bound set,
  -- including this row, because 786 allows several.
  SELECT count(DISTINCT k) INTO kinds
    FROM (SELECT public.time_series_sync_item_type(coalesce(d2.time_series_sync_id, d.time_series_sync_id)) AS k
            FROM public.object_type_time_series_sources s2
            JOIN public.object_type_datasources d2 ON d2.id = s2.datasource_id
           WHERE s2.property_id = NEW.property_id
             AND s2.datasource_id <> NEW.datasource_id
           UNION ALL
          SELECT public.time_series_sync_item_type(d.time_series_sync_id)) x
   WHERE k IS NOT NULL;

  IF kinds > 1 AND pr.time_series_item_type <> ''numericOrNonNumeric'' THEN
    RAISE EXCEPTION ''TimeSeries:ItemTypeMustBeMixed — % is backed by syncs of different kinds, so it declares numericOrNonNumeric'', pr.property_id;
  END IF;
  IF kinds = 1 AND pr.time_series_item_type IN (''string'', ''double'') THEN
    sync_item := public.time_series_sync_item_type(d.time_series_sync_id);
    IF sync_item IS NOT NULL AND sync_item <> pr.time_series_item_type THEN
      RAISE EXCEPTION ''TimeSeries:ItemTypeDisagreesWithSync — % declares % and the sync''''s value column is %'',
        pr.property_id, pr.time_series_item_type, sync_item;
    END IF;
  END IF;
');

  src := replace(src, 'DECLARE d record; pr record; ftype text; sync_item text;',
                      'DECLARE d record; pr record; ftype text; sync_item text; kinds int;');
  EXECUTE src;
END $mig$;

COMMENT ON FUNCTION public.guard_time_series_source() IS
  'A property bound to a sync must be a time series property of that datasource''s own object type, must name the string column holding its series ids on its TABULAR datasource, and must have declared its itemType. Since 786 SEVERAL syncs are allowed — the cell says which is read — so the item type is checked against the whole bound set: one kind must match a string/double declaration, and two kinds force numericOrNonNumeric. The per-series boolean is no longer refused; it must be a boolean column property of the same object type, because the reader takes it off the index row.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied, and it CALLS the reader rather than
-- reading the catalogue: if the body below were a bare RAISE, every count fails.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  mds uuid; mbr uuid; mtx uuid; mfile uuid; mtbl text;
  nds uuid; nbr uuid; ntx uuid; nfile uuid; ntbl text;
  cds uuid; cbr uuid; ctx uuid; cfile uuid; ctbl text;
  ot uuid; pk uuid; tsp uuid; flagp uuid;
  numsync uuid; catsync uuid; d1 uuid; d2 uuid; idx text;
  msg text; n int; numrid text; catrid text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m786 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm786-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm786-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M786 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm786p', 'm786 probe') RETURNING id INTO proj;

  -- the object type's dataset: a pk, a qualified-id column, a boolean
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm786_things', 'Things') RETURNING id INTO mds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (mds, 'master') RETURNING id INTO mbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (mds, mbr, 'SNAPSHOT') RETURNING id INTO mtx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (mds, mtx, '[{"name":"pk","type":"STRING"},{"name":"qsid","type":"STRING"},{"name":"is_cat","type":"BOOLEAN"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (mds, mtx, 't.parquet', 5) RETURNING id INTO mfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = mtx;
  SELECT public.dataset_materialize(mds, mtx) INTO mtbl;

  -- a NUMERIC sync dataset and a CATEGORICAL one
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm786_num', 'Numeric') RETURNING id INTO nds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (nds, 'master') RETURNING id INTO nbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (nds, nbr, 'SNAPSHOT') RETURNING id INTO ntx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (nds, ntx, '[{"name":"sid","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"val","type":"DOUBLE"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (nds, ntx, 'n.parquet', 2) RETURNING id INTO nfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = ntx;
  SELECT public.dataset_materialize(nds, ntx) INTO ntbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, sid, ts, val)
                  VALUES ($1,''NS1'',''2026-01-01T00:00:00Z'',10.0),
                         ($1,''NS1'',''2026-01-01T01:00:00Z'',11.0)', ntbl) USING nfile;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm786_cat', 'Categorical') RETURNING id INTO cds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (cds, 'master') RETURNING id INTO cbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (cds, cbr, 'SNAPSHOT') RETURNING id INTO ctx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (cds, ctx, '[{"name":"sid","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"val","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (cds, ctx, 'c.parquet', 1) RETURNING id INTO cfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = ctx;
  SELECT public.dataset_materialize(cds, ctx) INTO ctbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, sid, ts, val)
                  VALUES ($1,''CS1'',''2026-01-01T00:00:00Z'',''RUNNING'')', ctbl) USING cfile;

  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, nds, 'M786 numeric', 'sid', 'ts', 'val') RETURNING id INTO numsync;
  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, cds, 'M786 categorical', 'sid', 'ts', 'val') RETURNING id INTO catsync;
  SELECT rid INTO numrid FROM public.time_series_syncs WHERE id = numsync;
  SELECT rid INTO catrid FROM public.time_series_syncs WHERE id = catsync;

  -- five rows: a qualified id into each sync, a bare id, the null sentinel,
  -- and a Codex template rid
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, qsid, is_cat) VALUES
      ($1,''Q1'',%L,false),
      ($1,''Q2'',%L,true),
      ($1,''B1'',''NS1'',false),
      ($1,''N1'',%L,false),
      ($1,''T1'',%L,false)',
    mtbl,
    format('{"seriesId":"NS1","syncRid":"%s"}', numrid),
    format('{"seriesId":"CS1","syncRid":"%s"}', catrid),
    format('{"seriesId":"null","syncRid":"%s"}', numrid),
    '{"templateRid":"ri.codex.main.template.1","templateVersion":"0.0.0"}')
    USING mfile;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M786Thing', 'Thing') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, mds, mbr);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true) RETURNING id INTO pk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (ot, 'is_cat', 'Is categorical', 'isCat', 'boolean', 'column', 'is_cat',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot))
  RETURNING id INTO flagp;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'qsid', 'Series', 'series', 'time_series', 'column', 'qsid',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot), 'double')
  RETURNING id INTO tsp;

  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, numsync) RETURNING id INTO d1;
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, catsync) RETURNING id INTO d2;

  -- 1. THE REFUSAL 780 WROTE IS GONE: a second sync binds.
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d1, tsp);
  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp);
    RAISE EXCEPTION 'a double declaration was allowed against syncs of two kinds';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:ItemTypeMustBeMixed%' THEN RAISE; END IF;
  END;

  UPDATE public.object_type_properties
     SET time_series_item_type = 'numericOrNonNumeric' WHERE id = tsp;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp);
  SELECT count(*) INTO n FROM public.object_type_time_series_sources WHERE property_id = tsp;
  IF n <> 2 THEN RAISE EXCEPTION 'both syncs back the property; got %', n; END IF;

  PERFORM public.run_index_build(ARRAY[ot]::uuid[], true);

  -- 2. a qualified cell reads the sync it names, and only that one
  SELECT count(*) INTO n FROM public.time_series_points(ot, 'Q1', 'qsid');
  IF n <> 2 THEN RAISE EXCEPTION 'Q1 names the numeric sync and its two points; got %', n; END IF;
  SELECT count(*) INTO n FROM public.time_series_points(ot, 'Q2', 'qsid');
  IF n <> 1 THEN RAISE EXCEPTION 'Q2 names the categorical sync and its one point; got %', n; END IF;

  -- 3. a bare id is searched across every bound sync
  SELECT count(*) INTO n FROM public.time_series_points(ot, 'B1', 'qsid');
  IF n <> 2 THEN RAISE EXCEPTION 'a bare id finds NS1 in the numeric sync; got %', n; END IF;

  -- 4. the producer's null sentinel names no series
  SELECT count(*) INTO n FROM public.time_series_points(ot, 'N1', 'qsid');
  IF n <> 0 THEN RAISE EXCEPTION 'a null sentinel reads empty; got %', n; END IF;

  -- 5. a Codex template rid is legal in Foundry and refused here, by name
  BEGIN
    PERFORM public.time_series_points(ot, 'T1', 'qsid');
    RAISE EXCEPTION 'a Codex template rid was read as a series';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:DerivedSeriesNotBuilt%' THEN RAISE; END IF;
  END;

  -- 6. THE REFUSAL 779 WROTE IS GONE: the per-object boolean decides the column
  UPDATE public.object_type_properties
     SET time_series_is_non_numeric_property_id = flagp WHERE id = tsp;
  PERFORM public.run_index_build(ARRAY[ot]::uuid[], true);

  SELECT count(*) INTO n FROM public.time_series_points(ot, 'Q1', 'qsid') p
   WHERE p.num IS NOT NULL AND p.cat IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'Q1 is_cat=false, so it reads numeric only; got %', n; END IF;
  SELECT count(*) INTO n FROM public.time_series_points(ot, 'Q2', 'qsid') p
   WHERE p.cat IS NOT NULL AND p.num IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Q2 is_cat=true, so it reads categorical only; got %', n; END IF;

  -- and a boolean that is not a column property of this type is refused
  BEGIN
    UPDATE public.object_type_properties
       SET time_series_is_non_numeric_property_id = pk WHERE id = tsp;
    DELETE FROM public.object_type_time_series_sources WHERE property_id = tsp AND datasource_id = d2;
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp);
    RAISE EXCEPTION 'a string property was accepted as the is-categorical boolean';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:IsNonNumericPropertyUnreadable%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0786', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0786' THEN
  NULL;
END $$;
