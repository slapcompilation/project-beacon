-- A time series property resolves through a sync.
--
-- `time_series` has been one of the twenty-two base types since 408, read off
-- `properties-overview`'s table by `vocabulary.test.ts`. Nothing has ever backed
-- it. Two capability slots accept it and nothing else —
-- `geospatial.track_latitude` and `geospatial.track_longitude` — so the
-- Geospatial panel ships two slots that no property can fill.

-- ── the two components, and the backing question ───────────────────────────

--   "To use your data for time series analysis, you must set up two major
--    components: a time series object type and a time series sync."
--   — time-series/_index.md

--   "The time series sync is a resource backed by a dataset or a stream that
--    indexes time series data and provides values for time series properties."
--   — time-series/_index.md

-- So CLAUDE.md's third question — what backs it — has a real answer: a dataset.
-- That matters more than usual here, because 628 deleted an earlier
-- `time_series_properties` for being the other thing, and said why: "a table
-- name in a column, which is the generic-table shape this repository has
-- deleted three times". A sync is a resource over a REGISTERED dataset with a
-- named column mapping, which is the opposite of a table name in a column.

-- ── what a time series property IS ─────────────────────────────────────────

--   "Each series ID column in the time series object type backing dataset maps
--    to one TSP."
--   — time-series/time-series-concepts-glossary.md

--   "A foreign key in the time series object type used to fetch values from a
--    time series sync."
--   — time-series/time-series-concepts-glossary.md

-- Not a new property: an existing string column, set as one. The column keeps
-- holding strings and the property becomes a TSP. The api's property-value
-- table gives three legal encodings for that string — a bare series id, a
-- qualified `{seriesId, syncRid}` when several syncs back one property, and a
-- codex template rid for a derived series. All three are strings, which is why
-- the indexed column becomes `text` below rather than the `jsonb` it falls
-- through to today. Only the first is reachable here; the other two need
-- multi-sync TSPs and derived series, both excluded.

-- ── the datasource union, and why the property keeps its dataset ───────────

--   "An object type datasource backed by a time series sync, providing values
--    for time-dependent properties."
--   — api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md

-- That arm requires `timeSeriesSyncRid` and carries `properties`, "The set of
-- properties that are bound to the time series" — a FLAT LIST, where the
-- tabular arms carry a property-to-column mapping. So a time-series datasource
-- names no columns.
--
-- **An earlier draft of this migration repointed the property's
-- `datasource_id` at the time-series datasource, and it would have silently
-- disabled a linter.** `ontology_violations_core` joins a property's datasource
-- to `datasets`; a time-series datasource has none, the inner join drops the
-- row, and the stale-column finding stops applying to exactly the property kind
-- whose entire value is a pointer into a column. 585
-- solved this for media with a join table and this copies it: the property
-- stays on its tabular datasource, and `object_type_time_series_sources` is the
-- flat list, as a table.

-- ── 586 predicted the three lines this changes ─────────────────────────────
--
-- Its header says of the datasource guard, in its own words, that when "a time
-- series sync datasource arrives it is one line", and it quotes the sentence
-- the datasource limit rests on — that the limit does not "include media sets
-- or time series syncs". Both were left undone because no such datasource
-- existed. A fourth kind the guard had never heard of would have failed on
-- every insert: `synced := NEW.media_set_rid IS NULL` makes a sync look like a
-- dataset, and the organization check then raises against a dataset that is
-- not there.

-- ── permissions are not optional here ──────────────────────────────────────

--   "To view a time series property, you must satisfy the access requirements
--    for **all** of its backing data sources."
--   — time-series/time-series-permissions.md

--   "The time series sync will inherit all of the markings from its input
--    dataset."
--   — time-series/time-series-permissions.md

-- The reader below applies `satisfies_markings(effective_data_markings(...))`
-- of the sync's input dataset. 771 and 773 were spent on readers that joined an
-- index without its own type's policy; a new reader that skipped its source's
-- markings would be the same defect on its first day.
--
-- And the sync's FK to `datasets` — not to `restricted_views` — is what keeps
-- this true by construction:

--   "Because time series syncs cannot be backed by restricted views, they
--    cannot have granular permissions."
--   — time-series/time-series-permissions.md

-- ── what this does NOT build, named ────────────────────────────────────────
--
-- Streams as a sync backing, and with them the optional streaming
-- ingestion-time column that only a stream could fill; derived series and codex
-- templates; the Time Series Catalog; alerting; geotemporal series;
-- function-backed series; sensor object types; multi-sync TSPs and qualified
-- series ids; interpolation and units formatting; the default time series
-- property; and the Capabilities tab surface. The reader answers one question —
-- what are this object's points — which is what keeps the rest from being a
-- foundation nobody stands on.
--
-- Two enumerations disagree about the sync's columns, and the disagreement is
-- resolved rather than averaged: the glossary says a sync should "contain
-- exactly the following columns" and lists three; `time-series-syncs` lists
-- four, the fourth being the streaming ingestion time. The three-column form is
-- taken, because it is the one stated as exact and because the fourth's only
-- writer is excluded.
--
-- The branch is OURS. The api's `timeSeries` datasource arm carries no branch
-- where `dataset` and `stream` do, and no page names one, so the reader
-- resolves `master` the way `index_object_type` already resolves it for a
-- restricted view. Marked as inference here rather than left to be discovered.

-- ── 1. the sync ────────────────────────────────────────────────────────────

CREATE TABLE public.time_series_syncs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  input_dataset_id   uuid NOT NULL REFERENCES public.datasets(id) ON DELETE RESTRICT,
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "complete the mapping of your dataset columns to the time series sync's
  -- Series ID, Value, and Timestamp" — named, never assumed.
  series_id_column   text NOT NULL,
  timestamp_column   text NOT NULL,
  value_column       text NOT NULL,
  -- Required exactly when the timestamp column is a long. The trigger decides
  -- that, because deciding it needs the dataset's schema.
  timestamp_unit     text,
  rid                text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name),
  CONSTRAINT time_series_syncs_timestamp_unit_check
    CHECK (timestamp_unit IS NULL OR timestamp_unit IN
           ('SECONDS', 'MILLISECONDS', 'MICROSECONDS', 'NANOSECONDS'))
);

COMMENT ON CONSTRAINT time_series_syncs_timestamp_unit_check ON public.time_series_syncs IS
  'Values from time-series/time-series-syncs — specify if it is a SECONDS, MILLISECONDS, MICROSECONDS, or NANOSECONDS unit.';

COMMENT ON TABLE public.time_series_syncs IS
  'A time series sync: "a resource backed by a dataset or a stream that indexes time series data and provides values for time series properties". A dataset only — streams are not built — with the dataset''s Series ID, Timestamp and Value columns named rather than assumed. Addressed by RID, never by an api name, because that is how every page and every api field reaches one. One sync serves many object types, which is the opposite of a dataset datasource.';

CREATE INDEX time_series_syncs_dataset_idx ON public.time_series_syncs (input_dataset_id);
CREATE INDEX time_series_syncs_project_idx ON public.time_series_syncs (project_id);

ALTER TABLE public.time_series_syncs ENABLE ROW LEVEL SECURITY;

-- The two policies restricted_views carries, which is the closest sibling: a
-- dataset-backed resource the ontology reads through.
CREATE POLICY "project members see syncs" ON public.time_series_syncs
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
         AND public.project_role(project_id) IS NOT NULL);

CREATE POLICY "project owners author syncs" ON public.time_series_syncs
  FOR ALL TO authenticated
  USING (organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
         AND public.role_rank(public.project_role(project_id)) >= public.role_rank('owner'))
  WITH CHECK (organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
              AND public.role_rank(public.project_role(project_id)) >= public.role_rank('owner'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_series_syncs TO authenticated, service_role;

-- The RID, minted the way every other resource's is.
CREATE OR REPLACE FUNCTION public.stamp_time_series_sync_rid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rid IS NULL THEN
    NEW.rid := public.rid_of('time-series-catalog', 'sync', NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stamp_time_series_sync_rid
BEFORE INSERT ON public.time_series_syncs
FOR EACH ROW EXECUTE FUNCTION public.stamp_time_series_sync_rid();

-- ── 2. the sync's columns must be in its dataset, and of the printed types ──

CREATE OR REPLACE FUNCTION public.guard_time_series_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE fields jsonb; ftype text; fn text;
BEGIN
  fields := public.dataset_current_fields(NEW.input_dataset_id);
  IF fields IS NULL OR jsonb_array_length(fields) = 0 THEN
    RAISE EXCEPTION 'TimeSeries:SyncDatasetHasNoSchema — % has no committed schema to map columns from',
      (SELECT api_name FROM public.datasets WHERE id = NEW.input_dataset_id);
  END IF;

  FOREACH fn IN ARRAY ARRAY[NEW.series_id_column, NEW.timestamp_column, NEW.value_column] LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'name' = fn) THEN
      RAISE EXCEPTION 'TimeSeries:SyncColumnNotInDataset — "%" is not a column of the sync''s input dataset', fn;
    END IF;
  END LOOP;

  -- "seriesId: The identifier of a series (`string`)."
  SELECT upper(f->>'type') INTO ftype FROM jsonb_array_elements(fields) f
   WHERE f->>'name' = NEW.series_id_column;
  IF ftype <> 'STRING' THEN
    RAISE EXCEPTION 'TimeSeries:SeriesIdMustBeString — the series id column is %, and a series id is a string', ftype;
  END IF;

  -- "timestamp: The time the associated value occurred (`timestamp` or `long`)."
  SELECT upper(f->>'type') INTO ftype FROM jsonb_array_elements(fields) f
   WHERE f->>'name' = NEW.timestamp_column;
  IF ftype NOT IN ('TIMESTAMP', 'LONG') THEN
    RAISE EXCEPTION 'TimeSeries:TimestampTypeNotAllowed — the timestamp column is %, and a sync takes a timestamp or a long', ftype;
  END IF;
  -- "For long typed time columns, the units must be specified."
  IF ftype = 'LONG' AND NEW.timestamp_unit IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:LongTimestampNeedsAUnit — a long timestamp column names its unit';
  END IF;
  IF ftype = 'TIMESTAMP' AND NEW.timestamp_unit IS NOT NULL THEN
    RAISE EXCEPTION 'TimeSeries:UnitIsForLongTimestamps — a timestamp column carries its own unit';
  END IF;

  -- "value: The value of the series at a given timestamp (`double`, `integer`,
  --  `float` or `string`)."
  SELECT upper(f->>'type') INTO ftype FROM jsonb_array_elements(fields) f
   WHERE f->>'name' = NEW.value_column;
  IF ftype NOT IN ('DOUBLE', 'INTEGER', 'FLOAT', 'STRING') THEN
    RAISE EXCEPTION 'TimeSeries:ValueTypeNotAllowed — the value column is %, and a sync takes a double, integer, float or string', ftype;
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.guard_time_series_sync() IS
  'A sync''s three named columns must exist in its input dataset and be of the types time-series-syncs prints — a string series id, a timestamp or long time, and a double, integer, float or string value. A long time column names its unit; a timestamp one may not.';

CREATE CONSTRAINT TRIGGER guard_time_series_sync
AFTER INSERT OR UPDATE ON public.time_series_syncs
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_time_series_sync();

-- ── 3. the fourth arm of the datasource union ──────────────────────────────

ALTER TABLE public.object_type_datasources
  ADD COLUMN time_series_sync_id uuid REFERENCES public.time_series_syncs(id) ON DELETE RESTRICT;

CREATE INDEX object_type_datasources_time_series_idx
  ON public.object_type_datasources (time_series_sync_id)
  WHERE time_series_sync_id IS NOT NULL;

ALTER TABLE public.object_type_datasources DROP CONSTRAINT object_type_datasources_one_backing;

ALTER TABLE public.object_type_datasources
  ADD CONSTRAINT object_type_datasources_one_backing CHECK (
       (dataset_id IS NOT NULL AND branch_id IS NOT NULL
        AND restricted_view_id IS NULL AND media_set_rid IS NULL AND time_series_sync_id IS NULL)
    OR (restricted_view_id IS NOT NULL
        AND dataset_id IS NULL AND branch_id IS NULL AND media_set_rid IS NULL AND time_series_sync_id IS NULL)
    OR (media_set_rid IS NOT NULL AND media_set_view_rid IS NOT NULL
        AND dataset_id IS NULL AND branch_id IS NULL AND restricted_view_id IS NULL AND time_series_sync_id IS NULL)
    OR (time_series_sync_id IS NOT NULL
        AND dataset_id IS NULL AND branch_id IS NULL AND restricted_view_id IS NULL AND media_set_rid IS NULL));

COMMENT ON COLUMN public.object_type_datasources.time_series_sync_id IS
  'The sync a time-series datasource reads, the api''s required timeSeriesSyncRid. Like a media set view and unlike a dataset, it names no columns: the properties bound to it are object_type_time_series_sources.';

-- ── 4. which properties the sync provides values for ───────────────────────
-- The api's flat "properties" list, as a table — 585's shape for media, for the
-- same reason: a non-tabular datasource binds properties, it does not map them.

CREATE TABLE public.object_type_time_series_sources (
  datasource_id uuid NOT NULL REFERENCES public.object_type_datasources(id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  PRIMARY KEY (datasource_id, property_id)
);

COMMENT ON TABLE public.object_type_time_series_sources IS
  'Which time series properties a sync datasource provides values for — the api''s "properties" list on a timeSeries datasource. One sync, many properties, and one sync may serve several object types, which the sync page shows directly.';

CREATE INDEX object_type_time_series_sources_property_idx
  ON public.object_type_time_series_sources (property_id);

ALTER TABLE public.object_type_time_series_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read time series sources in scope" ON public.object_type_time_series_sources
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.object_type_datasources d
                   JOIN public.object_types t ON t.id = d.object_type_id
                  WHERE d.id = object_type_time_series_sources.datasource_id
                    AND public.auth_in_ontology(t.ontology_id)));

CREATE POLICY "admins author time series sources" ON public.object_type_time_series_sources
  FOR ALL TO authenticated
  USING ((SELECT public.auth_role()) IN ('owner', 'admin')
         AND EXISTS (SELECT 1 FROM public.object_type_datasources d
                       JOIN public.object_types t ON t.id = d.object_type_id
                      WHERE d.id = object_type_time_series_sources.datasource_id
                        AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
              AND EXISTS (SELECT 1 FROM public.object_type_datasources d
                            JOIN public.object_types t ON t.id = d.object_type_id
                           WHERE d.id = object_type_time_series_sources.datasource_id
                             AND public.auth_member_of_ontology(t.ontology_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_time_series_sources
  TO authenticated, service_role;

-- ── 5. a bound property is a time series property of THIS object type ──────

CREATE OR REPLACE FUNCTION public.guard_time_series_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE d record; pr record; ftype text;
BEGIN
  SELECT * INTO d FROM public.object_type_datasources WHERE id = NEW.datasource_id;
  SELECT * INTO pr FROM public.object_type_properties WHERE id = NEW.property_id;
  IF d.id IS NULL OR pr.id IS NULL THEN RETURN NULL; END IF;   -- gone within the txn

  IF d.time_series_sync_id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:NotASyncDatasource — only a time series sync datasource provides values for time series properties';
  END IF;
  IF pr.object_type_id <> d.object_type_id THEN
    RAISE EXCEPTION 'TimeSeries:PropertyOnAnotherType — a sync datasource binds properties of the object type it is on';
  END IF;
  IF pr.base_type <> 'time_series' THEN
    RAISE EXCEPTION 'TimeSeries:NotATimeSeriesProperty — % is %, and a sync provides values for time series properties',
      pr.property_id, pr.base_type;
  END IF;

  -- "Each series ID column in the time series object type backing dataset maps
  --  to one TSP" — the column keeps holding strings; the property is the TSP.
  IF pr.source IS DISTINCT FROM 'column' OR pr.backing_column IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:SeriesIdColumnMissing — a time series property names the column holding its series ids';
  END IF;
  IF pr.datasource_id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:SeriesIdColumnHasNoDatasource — the series id column belongs to the object type''s own datasource, not to the sync';
  END IF;

  SELECT upper(f->>'type') INTO ftype
    FROM public.object_type_datasources od
    JOIN LATERAL jsonb_array_elements(public.dataset_current_fields(od.dataset_id)) f ON true
   WHERE od.id = pr.datasource_id AND f->>'name' = pr.backing_column;
  IF ftype IS NOT NULL AND ftype <> 'STRING' THEN
    RAISE EXCEPTION 'TimeSeries:SeriesIdMustBeString — "%" is %, and a series id is a string', pr.backing_column, ftype;
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.guard_time_series_source() IS
  'A property bound to a sync must be a time series property of that datasource''s own object type, and must name the string column holding its series ids on the object type''s TABULAR datasource — the sync names no columns.';

CREATE CONSTRAINT TRIGGER guard_time_series_source
AFTER INSERT OR UPDATE ON public.object_type_time_series_sources
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_time_series_source();

-- ── 6. the three lines 586 and 588 left for this migration ─────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.guard_object_type_datasource()'::regprocedure), chr(13), '');

  -- A sync is no more "synced to object storage" than a media set is.
  a := 'synced := NEW.media_set_rid IS NULL;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the synced assignment once, found %', n; END IF;
  src := replace(src, a, 'synced := NEW.media_set_rid IS NULL AND NEW.time_series_sync_id IS NULL;');

  -- "it does not include media sets or time series syncs" — 586 quoted the
  -- sentence and could only implement half of it.
  a := 'AND media_set_rid IS NULL;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the datasource count filter once, found %', n; END IF;
  src := replace(src, a, 'AND media_set_rid IS NULL AND time_series_sync_id IS NULL;');

  EXECUTE src;
END $mig$;

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.datasource_mapping_problems()'::regprocedure), chr(13), '');
  a := 'AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m WHERE m.datasource_id = d.id)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the media exemption once, found %', n; END IF;
  EXECUTE replace(src, a, a || '
     AND NOT EXISTS (SELECT 1 FROM public.object_type_time_series_sources ts WHERE ts.datasource_id = d.id)');
END $mig$;

-- ── 7. the indexed value is a series id, and a series id is a string ───────
-- Not the `jsonb` it falls through to today. No index carries one yet — there
-- are zero properties of either series base type — so nothing needs rebuilding.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.property_column_type(text)'::regprocedure), chr(13), '');
  a := 'ELSE ';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one ELSE in property_column_type, found %', n; END IF;
  EXECUTE replace(src, a, 'WHEN ''time_series'' THEN ''text''
    ELSE ');
END $mig$;

-- ── 8. the reader ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.time_series_points(
  p_object_type uuid, p_primary_key text, p_property text,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 1000)
RETURNS TABLE (point_time timestamptz, num double precision, cat text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  pr record; sync record; ds record; tbl text; idx text; series text;
  branch uuid; tcol text; unit text; q text;
BEGIN
  SELECT p.* INTO pr FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND (p.property_id = p_property OR p.api_name = p_property)
     AND p.base_type = 'time_series';
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:NotATimeSeriesProperty — % is not a time series property of this object type', p_property;
  END IF;

  SELECT s.* INTO sync
    FROM public.object_type_time_series_sources src
    JOIN public.object_type_datasources d ON d.id = src.datasource_id
    JOIN public.time_series_syncs s ON s.id = d.time_series_sync_id
   WHERE src.property_id = pr.id
   LIMIT 1;
  IF sync.id IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:PropertyHasNoSync — % is bound to no time series sync', p_property;
  END IF;

  -- The sync's markings, because a reader must "satisfy the access
  -- requirements for **all** of its backing data sources" and the sync
  -- "will inherit all of the markings from its input dataset". Absence rather
  -- than an error: the api masks access as absence everywhere on this path.
  IF NOT public.satisfies_markings(public.effective_data_markings(sync.input_dataset_id)) THEN
    RETURN;
  END IF;

  SELECT x.index_table INTO idx FROM public.object_type_indexes x
   WHERE x.object_type_id = p_object_type AND public.object_type_index_ready(p_object_type);
  IF idx IS NULL THEN
    RAISE EXCEPTION 'TimeSeries:ObjectTypeNotIndexed — % has no successful index to read the series id from',
      (SELECT api_name FROM public.object_types WHERE id = p_object_type);
  END IF;
  EXECUTE format('SELECT o.%I::text FROM objects.%I o WHERE o.%I::text = %L',
                 pr.property_id, idx,
                 (SELECT property_id FROM public.object_type_properties
                   WHERE object_type_id = p_object_type AND is_primary_key),
                 p_primary_key) INTO series;
  IF series IS NULL OR btrim(series) = '' THEN RETURN; END IF;

  SELECT d.physical_table INTO tbl FROM public.datasets d WHERE d.id = sync.input_dataset_id;
  SELECT b.id INTO branch FROM public.dataset_branches b
   WHERE b.dataset_id = sync.input_dataset_id AND b.name = 'master';
  IF tbl IS NULL OR branch IS NULL THEN RETURN; END IF;

  -- A long time column carries its unit; a timestamp one is already one.
  unit := sync.timestamp_unit;
  tcol := CASE unit
            WHEN 'SECONDS'      THEN format('to_timestamp((r.%I)::double precision)', sync.timestamp_column)
            WHEN 'MILLISECONDS' THEN format('to_timestamp((r.%I)::double precision / 1000)', sync.timestamp_column)
            WHEN 'MICROSECONDS' THEN format('to_timestamp((r.%I)::double precision / 1000000)', sync.timestamp_column)
            WHEN 'NANOSECONDS'  THEN format('to_timestamp((r.%I)::double precision / 1000000000)', sync.timestamp_column)
            ELSE format('(r.%I)::timestamptz', sync.timestamp_column)
          END;

  q := format(
    'SELECT %s AS point_time,
            CASE WHEN (r.%I)::text ~ ''^-?[0-9]+(\.[0-9]+)?$'' THEN (r.%I)::text::double precision END,
            (r.%I)::text
       FROM datasets.%I r
      WHERE r.%I::text = %L
        AND r._file IN (SELECT file_id FROM public.dataset_view(%L))
        AND (%L::timestamptz IS NULL OR %s >= %L::timestamptz)
        AND (%L::timestamptz IS NULL OR %s <= %L::timestamptz)
      ORDER BY 1
      LIMIT %s',
    tcol, sync.value_column, sync.value_column, sync.value_column, tbl,
    sync.series_id_column, series, branch,
    p_from, tcol, p_from, p_to, tcol, p_to, greatest(coalesce(p_limit, 1000), 0));

  RETURN QUERY EXECUTE q;
END $$;

COMMENT ON FUNCTION public.time_series_points(uuid, text, text, timestamptz, timestamptz, integer) IS
  'The points of one object''s time series property. Resolves the series id from the object''s index row, then reads the sync''s dataset: "the seriesId contained in the property''s value will be searched for within that property''s data sources and its associated time series data will be returned". Returns a numeric and a categorical column because a sync''s value may be a double, integer, float or string. Applies the sync dataset''s markings, because a TSP is readable only by someone who may read its backing data source.';

REVOKE ALL ON FUNCTION public.time_series_points(uuid, text, text, timestamptz, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.time_series_points(uuid, text, text, timestamptz, timestamptz, integer)
  TO authenticated, service_role;

-- ── 9. and the comment that said this could not exist ──────────────────────

COMMENT ON FUNCTION public.capability_slots() IS
  'The slot-based Capabilities vocabulary, from metadata-typeclasses (the page it replaces) and the Geospatial panel screenshot. Its time_series slots are fillable since 774: time_series IS one of the twenty-two base types — it has been since 408 — and a sync now backs it. Foundry gives time series a 42-page section, of which this builds the ontology slice only.';
