-- A geotemporal series reference is one per object type, and never an array.
--
-- The geospatial section read whole (17 pages) before anything here. The
-- headline of that reading is a decision NOT to build: the geotemporal series
-- FEATURE is not buildable from what the corpus publishes, and this migration
-- deliberately builds only the storage rules that are.

-- ── what a GTSR is, and the two rules in one sentence ─────────────────────

--   "Within an ontology object type, a geotemporal series reference (GTSR)
--    property type is used to reference a particular geotemporal series from a
--    geotemporal series sync. Applications use this reference to fetch the
--    backing geotemporal data for the series. Each object type may have at most
--    one GTSR property type, and it may not allow multiple values."
--   — geospatial/types-of-geospatial-and-geotemporal-data.md

-- Two rules, both stated, and neither of them ours today:
--
--   * at most one per object type — a fact about a SET of rows, so a partial
--     unique index, exactly as 408 designates the title key and 780 the default
--     time series property;
--   * it may not allow multiple values — a fact about ONE row, so the existing
--     `array_element_allowed` CHECK, which today excludes `vector`,
--     `time_series` and `media_reference` and NOT this.
--
-- The array rule survives a conflict between two pages, and the tie-break is
-- this repository's own: an enumeration beats a description. `base-types`
-- DESCRIBES the exclusion as "excluding the `Vector` and `Time series` types",
-- a list that is simply incomplete. `action-types/scale-property-limits`
-- ENUMERATES array support per property type and gives Geotemporal series
-- reference its own row and its own answer. Three feature-page sentences agree
-- with the enumeration, so nothing here rests on the tie-break alone:

--   "An object type can have at most one geotemporal series reference property, and it may not be an array of geotemporal series references."
--   — geospatial/integrate-geotemporal-series-with-the-ontology.md

-- ── the cell, which IS documented, and the read, which is not ─────────────
--
-- The producer prints its own output, the way the qualified-series-id producer
-- did for 786 — base case, null, and three awkward inputs including the empty
-- string. So the cell shape can be checked without inventing anything:
--
--     {"seriesId":"series1","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.<uuid>"}
--
-- (`pb-functions-expression/constructGeotemporalSeriesReferenceV1.md`, whose
-- Output column carries that object; rendered here as code rather than quoted
-- because its inner double quotes break the citation checker's quote pairing.)
--
-- **So `geotemporal_series` stays `jsonb` and gains a CHECK.** It does NOT
-- become `text`: that was the right answer for `time_series`, whose cell is a
-- bare series id string, and applying it here would be reasoning from a shared
-- word rather than a shared shape — the mistake 782 came close to making with
-- "base formatter". The ELSE branch that used to catch it is replaced by an
-- explicit arm so the decision is visible rather than inherited.
--
-- Two things the CHECK deliberately does NOT do:
--
--   * it does not bound the series id's length. `data-modeling` bounds a Series
--     ID to 1-100 characters, but that is the SYNC's observation schema column,
--     and the producer page prints the empty string producing a full reference.
--     Refusing it would be stricter than Foundry's own printed answer.
--   * it does not pin the RID's instance segment. The service and type segments
--     are documented; the only sample has an empty instance segment, and
--     generalising a uuid grammar from one example is how a CHECK starts
--     refusing real values.

-- ── why the FEATURE is not built, stated rather than left implied ────────
--
-- Reading it back cannot be built from what is published. The api's canonical
-- PropertyValue encoding table — printed on the geotemporal endpoint's OWN
-- page — has a Timeseries row and no geotemporal row at all. The single read
-- endpoint carries its own banner:

--   "This endpoint is in preview and may be modified or removed at any time."
--   — api/v2-ontologies-v2-resources-geotemporal-series-properties-load-geotemporal-series-entries.md

-- and it reads an observation database — hot and cold storage, observation
-- schemas, source systems, destination namespaces — that we would have to
-- invent whole. The feature is Beta besides:

--   "Geotemporal series are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development."
--   — geospatial/geotemporal-series-overview.md

-- CLAUDE.md's fourth question decides the rest. The rules below reach a live
-- path — the property CHECKs, `save_working_state`, and `index_object_type`,
-- which today would emit an unconstrained jsonb column. A GTSR *value* reaches
-- nothing and could not: there is no producer for an integration RID here and
-- no reader for the entries. So the storage rules ship and the datasource and
-- reader do not.
--
-- A note for whoever picks this up: `all-foundry-urls.txt` still lists six
-- `geotemporal-series/` URLs and all six now 404. They were not lost — the
-- section was REORGANISED into `geospatial/`, and every one of them has a
-- successor on disk. An entry in that file is not proof a page exists.

-- ── 1. the two refusals ──────────────────────────────────────────────────

ALTER TABLE public.object_type_properties
  DROP CONSTRAINT array_element_allowed;

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT array_element_allowed
  CHECK (array_element_type IS NULL
         OR (array_element_type = ANY (public.property_base_types())
             AND array_element_type <> ALL
                 (ARRAY['vector', 'time_series', 'media_reference', 'geotemporal_series'])));

COMMENT ON CONSTRAINT array_element_allowed ON public.object_type_properties IS
  'Values from object-link-types/properties-overview.md';

CREATE UNIQUE INDEX object_type_one_geotemporal_series
  ON public.object_type_properties (object_type_id)
  WHERE base_type = 'geotemporal_series';

-- ── 2. the cell shape ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.geotemporal_reference_valid(j jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jsonb_typeof(j) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(j)) = 2
     AND j ? 'seriesId'
     AND j ? 'geotimeSeriesIntegrationRid'
     AND jsonb_typeof(j -> 'seriesId') = 'string'
     AND jsonb_typeof(j -> 'geotimeSeriesIntegrationRid') = 'string'
     AND j ->> 'geotimeSeriesIntegrationRid' ~ '^ri\.geotime-catalog\.[^.]*\.integration\.'
$$;

COMMENT ON FUNCTION public.geotemporal_reference_valid(jsonb) IS
  'A geotemporal series reference cell: the two-key object constructGeotemporalSeriesReferenceV1 prints, naming the series and the integration that holds it. The series id is NOT length-bounded here — data-modeling bounds the sync''s own Series ID column, and the producer prints the empty string producing a full reference — and the RID''s instance segment is not pinned, because the only published sample leaves it empty. 788.';

GRANT EXECUTE ON FUNCTION public.geotemporal_reference_valid(jsonb) TO authenticated, service_role;

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  -- the CHECK an indexed column carries
  src := replace(pg_get_functiondef('public.property_column_check(text,text)'::regprocedure), chr(13), '');
  a := '    WHEN ''geoshape'' THEN format('' CHECK (public.geoshape_valid(%I))'', p_column)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 632''s geoshape arm once, found %', n; END IF;
  EXECUTE replace(src, a, a || chr(10) ||
'    WHEN ''geotemporal_series'' THEN format('' CHECK (public.geotemporal_reference_valid(%I))'', p_column)');

  -- and the column type it carries it on, made explicit rather than inherited
  src := replace(pg_get_functiondef('public.property_column_type(text)'::regprocedure), chr(13), '');
  a := '    WHEN ''time_series'' THEN ''text''';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 774''s time_series mapping once, found %', n; END IF;
  EXECUTE replace(src, a, a || chr(10) ||
'    WHEN ''geotemporal_series'' THEN ''jsonb''');
END $mig$;

COMMENT ON FUNCTION public.property_column_type(text) IS
  'The physical column an indexed property gets for its base type. geopoint and geoshape are text because the pages say what those columns contain (632); geotemporal_series is jsonb and says so explicitly since 788, rather than falling through the ELSE — its cell is a two-key object, not the bare string a time series cell holds, and inheriting the time-series answer from a shared word would be the wrong reading.';

-- ── 3. two corrections to headers that cannot be edited ──────────────────
--
-- **774 said the Geospatial panel "ships two slots that no property can fill".
-- That was false when written**, and 415 proves it in its own assertion block:
-- it creates a `time_series` property and nominates it for
-- `geospatial/track_latitude`, under a comment reading "The documented case: a
-- time series property becomes Track Latitude." That has run on every apply
-- since 415. What 774 could truthfully have said is that no property of a REAL
-- ontology filled them, because nothing could author a time series property
-- until 780's panel.
--
-- And the slots settle a question this reading opened: they are the TIME SERIES
-- feature, not the geotemporal one.

--   "To configure the track for the object type, select the **Track Latitude**
--    and **Track Longitude** properties in the **Geospatial** section of the
--    object type's **Capabilities** tab. Both properties must be numeric time
--    series properties representing the object's location over time."
--   — map/integrate-objects.md

-- **So the slots are too WIDE**, and narrowly fixable now: they accept any
-- time series property, and the page says numeric. Since 779 a property
-- declares its itemType, so `string` — the member that means categorical — can
-- be refused. `numericOrNonNumeric` is NOT refused: its type "must be inferred
-- from the result of a time series query", so refusing it would be stricter
-- than Foundry about a value nobody has resolved yet.

COMMENT ON FUNCTION public.capability_slots() IS
  'The slot-based Capabilities vocabulary, from metadata-typeclasses and the Geospatial panel screenshot. Time series is the other panel shape and lives in the time series properties table, not here. The geospatial track slots take TIME SERIES properties — "Both properties must be numeric time series properties representing the object''s location over time" (map/integrate-objects) — so they are the time series feature and not the geotemporal one; 774''s header said no property could fill them, which was false when written, since 415''s own assertion nominates one. Corrected by 788.';

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.guard_object_type_capability()'::regprocedure), chr(13), '');

  a := chr(10) || '  RETURN NEW;' || chr(10);
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one trailing RETURN NEW, found %', n; END IF;

  EXECUTE replace(src, a, chr(10) ||
'  -- "Both properties must be numeric time series properties". A property that
  -- declares string values is categorical and cannot be a track coordinate;
  -- numericOrNonNumeric is left alone, because its type is inferred from the
  -- result and refusing it would be stricter than the page.
  IF NEW.capability = ''geospatial'' AND NEW.slot IN (''track_latitude'', ''track_longitude'') THEN
    IF (SELECT p.time_series_item_type FROM public.object_type_properties p
         WHERE p.id = NEW.property_id) = ''string'' THEN
      RAISE EXCEPTION ''Ontology:TrackMustBeNumeric — a track coordinate is a numeric time series property, and this one declares string values'';
    END IF;
  END IF;
' || a);
END $mig$;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; ds2 uuid; br2 uuid; txn uuid; ot uuid; pk uuid; g1 uuid; msg text; c text;
BEGIN
  -- 1. the cell shape, before anything is built on it
  IF NOT public.geotemporal_reference_valid(
       '{"seriesId":"series1","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.05a40ec0-3a7d-406d-88d6-043ed2cb6af8"}'::jsonb) THEN
    RAISE EXCEPTION 'the producer''s own base-case output must validate';
  END IF;
  -- the empty series id is what the producer prints for it, so it is legal
  IF NOT public.geotemporal_reference_valid(
       '{"seriesId":"","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.x"}'::jsonb) THEN
    RAISE EXCEPTION 'the empty string round-trips through the producer; refusing it is stricter than Foundry';
  END IF;
  IF public.geotemporal_reference_valid('{"seriesId":"a"}'::jsonb)
     OR public.geotemporal_reference_valid('"a"'::jsonb)
     OR public.geotemporal_reference_valid(
          '{"seriesId":"a","geotimeSeriesIntegrationRid":"ri.time-series-catalog.main.sync.1"}'::jsonb)
     OR public.geotemporal_reference_valid(
          '{"seriesId":"a","geotimeSeriesIntegrationRid":"ri.geotime-catalog..integration.x","extra":1}'::jsonb) THEN
    RAISE EXCEPTION 'a half reference, a bare string, a time series rid and a third key are all refused';
  END IF;

  -- 2. the column it lands on
  IF public.property_column_type('geotemporal_series') <> 'jsonb' THEN
    RAISE EXCEPTION 'a geotemporal reference is an object, so its column is jsonb';
  END IF;
  c := public.property_column_check('geotemporal_series', 'gt');
  IF c NOT LIKE '%geotemporal_reference_valid%' THEN
    RAISE EXCEPTION 'the indexed column must carry the reference check; got "%"', c;
  END IF;

  INSERT INTO public.organizations (name) VALUES ('m788 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm788-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm788-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M788 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm788p', 'm788 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm788_rows', 'Rows') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M788Flight', 'Flight') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true) RETURNING id INTO pk;

  -- 3. "it may not allow multiple values"
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, array_element_type,
       source, backing_column)
    VALUES (ot, 'tracks', 'Tracks', 'tracks', 'array', 'geotemporal_series', 'column', 'tracks');
    RAISE EXCEPTION 'an array of geotemporal series references was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS msg = CONSTRAINT_NAME;
    IF msg <> 'array_element_allowed' THEN
      RAISE EXCEPTION 'expected array_element_allowed to refuse it, got %', msg;
    END IF;
  END;

  -- 4. "Each object type may have at most one GTSR property type"
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id)
  VALUES (ot, 'path', 'Path', 'path', 'geotemporal_series', 'column', 'path',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot))
  RETURNING id INTO g1;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
       datasource_id)
    VALUES (ot, 'path2', 'Path 2', 'path2', 'geotemporal_series', 'column', 'path2',
            (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot));
    RAISE EXCEPTION 'an object type was allowed two geotemporal series references';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- and ANOTHER object type may of course have its own. It needs its OWN
  -- dataset: one datasource backs one object type.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm788_birds', 'Birds') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M788Bird', 'Bird') RETURNING id INTO pk;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (pk, ds2, br2);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (pk, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id)
  VALUES (pk, 'path', 'Path', 'path', 'geotemporal_series', 'column', 'path',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = pk));

  -- 5. a track coordinate declaring string values is refused; a double is not
  DELETE FROM public.object_type_properties WHERE id = g1;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'lat', 'Lat', 'lat', 'time_series', 'column', 'lat',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = ot), 'string')
  RETURNING id INTO g1;
  BEGIN
    INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
    VALUES (ot, 'geospatial', 'track_latitude', g1);
    RAISE EXCEPTION 'a categorical series was accepted as a track coordinate';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:TrackMustBeNumeric%' THEN RAISE; END IF;
  END;

  -- a numeric one is exactly what the page asks for
  UPDATE public.object_type_properties SET time_series_item_type = 'double' WHERE id = g1;
  INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
  VALUES (ot, 'geospatial', 'track_latitude', g1);

  -- and numericOrNonNumeric is NOT refused: its type is inferred from the result
  UPDATE public.object_type_properties
     SET time_series_item_type = 'numericOrNonNumeric' WHERE id = g1;
  DELETE FROM public.object_type_capabilities
   WHERE object_type_id = ot AND capability = 'geospatial' AND slot = 'track_latitude';
  INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
  VALUES (ot, 'geospatial', 'track_latitude', g1);

  RAISE EXCEPTION USING errcode = 'P0788', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0788' THEN
  NULL;
END $$;
