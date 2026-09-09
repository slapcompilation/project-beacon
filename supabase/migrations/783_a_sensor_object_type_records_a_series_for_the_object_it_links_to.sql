-- A sensor object type records a series for the object it links to.
--
-- The second of the two ways Foundry stores time series in the ontology, and
-- the one every migration since 774 has excluded by name. This retires that
-- exclusion and the three stubs standing on it.

--   "If you expect time series data to appear on only a subset of objects of a
--    given object type, you should proceed with creating sensor objects linked
--    back to those root object types. However, if you expect time series data
--    to appear for (nearly) all objects of a given object type, you should add
--    a TSP directly on that object type."
--   — time-series/create-sensor-ot.md

-- ── it is an ordinary object type, which is why this is small ──────────────
--
-- CLAUDE.md's third question has an unremarkable answer: a dataset. The page
-- prints the backing schema — a primary key, a series id, a sensor name, a
-- foreign key, and three optional columns — so a sensor object type is a normal
-- dataset-backed object type with a normal FK link. No new table for objects,
-- none for edges, none for series. What is new is CONFIGURATION on the object
-- type, and one reader that walks the link.

--   "A foreign key used to link the sensor object type to a root object type.
--    The primary key may serve this purpose, but at least one link type is
--    required for a sensor object type."
--   — time-series/create-sensor-ot.md

-- ── three corrections carried forward, all of them mine ───────────────────
--
-- 1. **779 gave a reason that stopped being true.** It refused
--    `time_series_is_non_numeric_property_id` because resolving a boolean per
--    series would be "a second lookup for a case no page shows configured".
--    782 made that lookup routine: `time_series_formatting()` already reads a
--    per-object property off `objects.ot_<uuid>` by primary key, which is the
--    same row `time_series_points` already reads the series id from. The cost
--    argument is dead. **The refusal still stands, for a different reason** —
--    see 3.
--
-- 2. **780 withdrew a claim and was right for the wrong mechanism.** It said
--    the sensor `Is categorical` column and the api's
--    `isNonNumericPropertyTypeId` were converging concepts with different
--    mechanisms. Having now parsed the newer configuration capture, they are
--    the SAME mechanism — its Is categorical? picker describes itself as the
--    api field does:

--   "Select a boolean property to indicate whether each sensor has categorical time series data when this property's value is true; otherwise, it is assumed to have numerical data."
--   — time-series/images/sensor-object-om-configuration.png

--    The dataset column is the backing; the property is the reference.
--
-- 3. **So what actually keeps it refused has nothing to do with sensors.** A
--    sync cannot hold two data types, and its value column decides numeric from
--    categorical — so with ONE sync per property, which 780 enforces, the item
--    type is already known and a per-series boolean has no work to do. It earns
--    its keep only for a TSP backed by several syncs of mixed kinds, which is
--    `TimeSeries:MultiSyncNotBuilt`. Building sensor object types does not
--    unblock 779; lifting 780 would. The surface therefore renders
--    `Is categorical?` DISABLED with that reason, rather than hiding it.

--   "different data types cannot exist within one time series sync"
--   — time-series/create-or-select-ts-ot.md

-- ── the designation, and why it is a column rather than a derivation ───────

--   "Note that the **Sensor object type** toggle should be on, and many of the
--    selections may already be filled in for you."
--   — time-series/create-sensor-ot.md

-- The toggle is author-set, and the walkthrough creates the LINK before turning
-- it on — so a link exists without sensor-ness, and the state where the toggle
-- is on and the configuration is incomplete is one Foundry renders on purpose,
-- with a red asterisk and a Setup requirements block. Deriving sensor-ness from
-- "has a sensor link row" would make that documented state unrepresentable.
--
-- **Where Foundry stores it is not published.** `api/` carries no sensor field
-- on the object type, and metadata-typeclasses lists type-class carriers as
-- properties, link types and action types — not object types. So the column's
-- location is OURS, by inference, and this paragraph is the record of it. It is
-- the weakest evidence floor in this arc.

-- ── the sensor link is a PAIR, and repeatable ──────────────────────────────

--   "You must select at least one link type which links this sensor object type
--    to a root object type for which this records time series data."
--   — time-series/create-sensor-ot.md

--   "You must also select the property containing the Sensor name for this link
--    type."
--   — time-series/create-sensor-ot.md

-- One entry is (link type, sensor name property), and the section carries an
-- `+ Add new entry` button in both captures, so entries are a SET. The plural
-- root is the screenshot's, not the prose's:

--   "Links between this sensor object type and the root object type(s) for which this records time series data (e.g. this Sensor may link to a Machine object type)."
--   — time-series/images/time-series-setup-sensor-object-type-configuration-section.png

-- ── what needs no schema at all ───────────────────────────────────────────
--
-- `Units` and `Internal interpolation` in the sensor section are PROPERTY
-- PICKERS ONLY:

--   "Select a string property to display units (e.g. `kg` or `PSI`) for each sensor's series."
--   — time-series/images/sensor-object-om-configuration.png

-- That is exactly the `{propertyType}` arm of the operands 782 added, and
-- `time_series_formatting()` already resolves them per object. A
-- `sensor_units_property_id` beside them would be a parallel system over a
-- column that already holds the value. The sensor section is a second EDITOR
-- for 782's storage, not second storage — which is also why Foundry withholds
-- the base formatter for a sensor object type instead of reconciling two
-- values, and why no precedence rule is needed or invented.

-- ── what is NOT built, each with its reason ───────────────────────────────
--
-- **Primary Sensor Link.**

--   "This will only appear if you still have old versions of Quiver accessible in your Foundry instance."
--   — time-series/create-sensor-ot.md

-- And it is absent from the newer configuration capture entirely. A
-- compatibility shim for a product generation we do not have.
--
-- **Sensor-name uniqueness per root object.** The page says the names "must be
-- unique"; that is a fact about INDEXED ROWS across two object types, not about
-- the ontology definition, and no reader here needs it. Recorded, not built.
--
-- **Any cardinality rule on the sensor link.** create-sensor-ot explicitly
-- permits the sensor's own primary key as the foreign key, which is a
-- one-to-one, and `create-link-type` says one-to-one "is not enforced".
-- Refusing shapes Foundry accepts is its own defect.
--
-- **Step 3 of the add-TSP dialog.** Its terminal write must land the toggle and
-- at least one entry in ONE transaction or the type saves straight into a
-- violation — 590's chicken-and-egg. The Capabilities section is a complete
-- path without it: Foundry's own end-to-end walkthrough turns the toggle on
-- there, not in the dialog.

-- ── 1. the designation ────────────────────────────────────────────────────

ALTER TABLE public.object_types
  ADD COLUMN is_sensor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.object_types.is_sensor IS
  'The Capabilities > Time series "Sensor object type" toggle — "Record time series data for a linked object type". Author-set rather than derived, because Foundry renders a configured-but-incomplete state and because its walkthrough creates the link before flipping the toggle. Where Foundry itself stores this is NOT published: api/ carries no sensor field and metadata-typeclasses lists carriers as properties, link types and action types, never object types. The location is ours, by inference (783).';

-- ── 2. the sensor links ───────────────────────────────────────────────────

CREATE TABLE public.object_type_sensor_links (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id          uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  link_type_id            uuid NOT NULL REFERENCES public.link_types(id) ON DELETE CASCADE,
  sensor_name_property_id uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE RESTRICT,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_type_id, link_type_id)
);

COMMENT ON TABLE public.object_type_sensor_links IS
  'One Sensor link entry: the link type reaching a root object type, and the property carrying this sensor''s name for that link. Repeatable — the section has an "+ Add new entry" button and the help text says "root object type(s)" — and unique per link type, because the page says "the property containing the Sensor name for THIS link type", singular.';

CREATE INDEX object_type_sensor_links_link_idx
  ON public.object_type_sensor_links (link_type_id);
CREATE INDEX object_type_sensor_links_property_idx
  ON public.object_type_sensor_links (sensor_name_property_id);

ALTER TABLE public.object_type_sensor_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read sensor links in scope" ON public.object_type_sensor_links
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.object_types t
                  WHERE t.id = object_type_sensor_links.object_type_id
                    AND public.auth_in_ontology(t.ontology_id)));

CREATE POLICY "admins author sensor links" ON public.object_type_sensor_links
  FOR ALL TO authenticated
  USING ((SELECT public.auth_role()) IN ('owner', 'admin')
         AND EXISTS (SELECT 1 FROM public.object_types t
                      WHERE t.id = object_type_sensor_links.object_type_id
                        AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
              AND EXISTS (SELECT 1 FROM public.object_types t
                           WHERE t.id = object_type_sensor_links.object_type_id
                             AND public.auth_member_of_ontology(t.ontology_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_sensor_links
  TO authenticated, service_role;

-- ── 3. an entry names a link this type is on, and a string property it owns ─

CREATE OR REPLACE FUNCTION public.guard_sensor_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE lk record; pr record; t record;
BEGIN
  SELECT * INTO t  FROM public.object_types WHERE id = NEW.object_type_id;
  SELECT * INTO lk FROM public.link_types WHERE id = NEW.link_type_id;
  SELECT * INTO pr FROM public.object_type_properties WHERE id = NEW.sensor_name_property_id;
  IF t.id IS NULL OR lk.id IS NULL OR pr.id IS NULL THEN RETURN NULL; END IF;

  IF NOT t.is_sensor THEN
    RAISE EXCEPTION 'TimeSeries:NotASensorObjectType — % is not a sensor object type, so it configures no sensor links', t.api_name;
  END IF;
  IF lk.source_object_type_id <> NEW.object_type_id
     AND lk.target_object_type_id <> NEW.object_type_id THEN
    RAISE EXCEPTION 'TimeSeries:SensorLinkNotOnThisObjectType — % does not join %', lk.api_name, t.api_name;
  END IF;
  IF pr.object_type_id <> NEW.object_type_id THEN
    RAISE EXCEPTION 'Ontology:PropertyNotOnThisObjectType — % is not a property of %', pr.property_id, t.api_name;
  END IF;
  -- "Sensor name | `String` | [Required] A name identifying what the time
  --  series data for a given sensor object represents."
  IF pr.base_type <> 'string' THEN
    RAISE EXCEPTION 'TimeSeries:SensorNameMustBeString — % is %, and a sensor name is a string', pr.property_id, pr.base_type;
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.guard_sensor_link() IS
  'A Sensor link entry belongs to a sensor object type, names a link type that object type is on, and names a string property of that same object type as the sensor name. A CONSTRAINT trigger rather than CHECKs because every arm reads another table.';

CREATE CONSTRAINT TRIGGER guard_sensor_link
AFTER INSERT OR UPDATE ON public.object_type_sensor_links
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_sensor_link();

-- ── 4. the two things a linter must say, and why they are not triggers ────
--
-- A trigger on `object_types` would refuse the toggle before any entry could
-- exist — 590's chicken-and-egg, where a new object type could not be saved
-- because its own linter refused it. Both are therefore linter arms, and both
-- BLOCK a save: the page marks Sensor link *(required)* and renders a red
-- asterisk beside it.
--
-- **The rung is inference.** No page files either finding on the errors list or
-- the warnings list. `required` reading as a refusal is the reasoning, and it is
-- recorded here rather than presented as documentation.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_violations_core()'::regprocedure), chr(13), '');

  a := '                        AND tgt.base_type = ''string'')';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected 782''s formatter-pointer arm to end the function once, found %', n; END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- "You must select at least one link type which links this sensor object
  -- type to a root object type for which this records time series data."
  SELECT t.api_name, ''object_type'', t.api_name,
         ''A sensor object type records time series data for a linked object type, and this one configures no sensor link''
    FROM public.object_types t
   WHERE t.is_sensor
     AND NOT EXISTS (SELECT 1 FROM public.object_type_sensor_links s
                      WHERE s.object_type_id = t.id)

  UNION ALL

  -- "A series ID for the sole TSP" — and the Add control on the time series
  -- properties table renders disabled for a sensor object type.
  SELECT t.api_name, ''object_type'', t.api_name,
         format(''A sensor object type has one time series property, and this one has %s'', c.n)
    FROM public.object_types t
    JOIN LATERAL (SELECT count(*) AS n FROM public.object_type_properties p
                   WHERE p.object_type_id = t.id AND p.base_type = ''time_series'') c ON true
   WHERE t.is_sensor AND c.n > 1');
END $mig$;

-- ── 5. the reader: a root object's sensors, and their series ──────────────

--   "* Fetch all TSPs on the object set.
--    * Conduct a search-around on the object set for any links with this
--      special metadata.
--    * Fetch the sensor names for the linked sensor objects."
--   — time-series/_index.md

-- Built on `list_linked_objects` rather than a direct index join, so 771-773's
-- rule holds without restating it: every index a reader joins carries its own
-- type's policy, and the near side is gated too.

CREATE OR REPLACE FUNCTION public.sensor_series(
  p_root_object_type uuid,
  p_primary_key      text,
  p_from             timestamptz DEFAULT NULL,
  p_to               timestamptz DEFAULT NULL,
  p_limit            integer     DEFAULT 1000
)
RETURNS TABLE (
  sensor_object_type uuid,
  sensor_primary_key text,
  sensor_name        text,
  point_time         timestamptz,
  num                double precision,
  cat                text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  entry record; obj jsonb; far_pk text; name_prop text; tsp text;
BEGIN
  FOR entry IN
    SELECT s.object_type_id AS sensor_ot, l.api_name AS link_api,
           s.sensor_name_property_id
      FROM public.object_type_sensor_links s
      JOIN public.link_types l ON l.id = s.link_type_id
      JOIN public.object_types t ON t.id = s.object_type_id AND t.is_sensor
     WHERE (l.source_object_type_id = s.object_type_id AND l.target_object_type_id = p_root_object_type)
        OR (l.target_object_type_id = s.object_type_id AND l.source_object_type_id = p_root_object_type)
  LOOP
    SELECT p.property_id INTO far_pk FROM public.object_type_properties p
     WHERE p.object_type_id = entry.sensor_ot AND p.is_primary_key;
    SELECT p.property_id INTO name_prop FROM public.object_type_properties p
     WHERE p.id = entry.sensor_name_property_id;
    -- "The single time series property of a sensor object type must be a
    --  default time series property", so the default IS the series.
    SELECT p.property_id INTO tsp FROM public.object_type_properties p
     WHERE p.object_type_id = entry.sensor_ot AND p.is_default_time_series;
    IF far_pk IS NULL OR tsp IS NULL THEN CONTINUE; END IF;

    FOR obj IN
      SELECT * FROM public.list_linked_objects(
        p_root_object_type, p_primary_key, entry.link_api, 1000, 0, NULL)
    LOOP
      sensor_object_type := entry.sensor_ot;
      sensor_primary_key := obj ->> far_pk;
      sensor_name        := obj ->> name_prop;
      IF sensor_primary_key IS NULL THEN CONTINUE; END IF;

      FOR point_time, num, cat IN
        SELECT s.point_time, s.num, s.cat
          FROM public.time_series_points(
                 entry.sensor_ot, sensor_primary_key, tsp, p_from, p_to, p_limit) s
      LOOP
        RETURN NEXT;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.sensor_series(uuid, text, timestamptz, timestamptz, integer) IS
  'One root object''s sensors and their points — the three steps time-series/_index prints for a unified view: find the links carrying the sensor designation, search around them, and fetch the sensor names with the series. Composed from list_linked_objects so the far type''s own policy and the near-side gate apply unchanged (771-773), and from time_series_points so the sync''s markings do too. A sensor object type''s single TSP is its default, so the default is the series read.';

REVOKE ALL ON FUNCTION public.sensor_series(uuid, text, timestamptz, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sensor_series(uuid, text, timestamptz, timestamptz, integer)
  TO authenticated, service_role;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  rds uuid; rbr uuid; rtx uuid; rfile uuid; rtbl text;
  sds uuid; sbr uuid; stx uuid; sfile uuid; stbl text;
  pds uuid; pbr uuid; ptx uuid; pfile uuid; ptbl text;
  root uuid; sens uuid; rpk uuid; spk uuid; snm uuid; tsp uuid;
  lk uuid; sync uuid; tsdatasrc uuid; entry uuid; msg text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m783 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm783-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm783-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M783 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm783p', 'm783 probe') RETURNING id INTO proj;

  -- the ROOT object type's dataset
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm783_machines', 'Machines') RETURNING id INTO rds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (rds, 'master') RETURNING id INTO rbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (rds, rbr, 'SNAPSHOT') RETURNING id INTO rtx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (rds, rtx, '[{"name":"machine_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (rds, rtx, 'm.parquet', 1) RETURNING id INTO rfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = rtx;
  SELECT public.dataset_materialize(rds, rtx) INTO rtbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, machine_id) VALUES ($1,''M1'')', rtbl) USING rfile;

  -- the SENSOR object type's dataset: pk, series id, sensor name, foreign key
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm783_sensors', 'Sensors') RETURNING id INTO sds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (sds, 'master') RETURNING id INTO sbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (sds, sbr, 'SNAPSHOT') RETURNING id INTO stx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (sds, stx, '[{"name":"sensor_id","type":"STRING"},{"name":"series_id","type":"STRING"},
                      {"name":"sensor_name","type":"STRING"},{"name":"machine_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (sds, stx, 's.parquet', 2) RETURNING id INTO sfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = stx;
  SELECT public.dataset_materialize(sds, stx) INTO stbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, sensor_id, series_id, sensor_name, machine_id)
                  VALUES ($1,''S1'',''S1-series'',''Inlet pressure'',''M1''),
                         ($1,''S2'',''S2-series'',''Outlet pressure'',''M1'')', stbl) USING sfile;

  -- the sync's dataset
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm783_points', 'Points') RETURNING id INTO pds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (pds, 'master') RETURNING id INTO pbr;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (pds, pbr, 'SNAPSHOT') RETURNING id INTO ptx;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (pds, ptx, '[{"name":"series_id","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"val","type":"DOUBLE"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (pds, ptx, 'p.parquet', 3) RETURNING id INTO pfile;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = ptx;
  SELECT public.dataset_materialize(pds, ptx) INTO ptbl;
  EXECUTE format('INSERT INTO datasets.%I (_file, series_id, ts, val)
                  VALUES ($1,''S1-series'',''2026-01-01T00:00:00Z'',10.0),
                         ($1,''S1-series'',''2026-01-01T01:00:00Z'',11.0),
                         ($1,''S2-series'',''2026-01-01T00:00:00Z'',50.0)', ptbl) USING pfile;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M783Machine', 'Machine') RETURNING id INTO root;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (root, rds, rbr);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (root, 'machine_id', 'Machine Id', 'machineId', 'string', 'column', 'machine_id', true, true, true)
  RETURNING id INTO rpk;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M783Sensor', 'Sensor') RETURNING id INTO sens;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (sens, sds, sbr);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (sens, 'sensor_id', 'Sensor Id', 'sensorId', 'string', 'column', 'sensor_id', true, true, true)
  RETURNING id INTO spk;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (sens, 'sensor_name', 'Sensor Name', 'sensorName', 'string', 'column', 'sensor_name',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = sens))
  RETURNING id INTO snm;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id)
  VALUES (sens, 'machine_id', 'Machine Id', 'machineId', 'string', 'column', 'machine_id',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = sens));
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (sens, 'series_id', 'Series Id', 'seriesId', 'time_series', 'column', 'series_id',
          (SELECT id FROM public.object_type_datasources WHERE object_type_id = sens), 'double')
  RETURNING id INTO tsp;

  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, pds, 'M783 points', 'series_id', 'ts', 'val') RETURNING id INTO sync;
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (sens, sync) RETURNING id INTO tsdatasrc;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (tsdatasrc, tsp);

  -- the sensor's foreign key to the root
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, sens, root, 'm783-machine', 'Machine', 'many_to_one', 'foreign_key', 'machine_id')
  RETURNING id INTO lk;

  -- 1. an entry on a type that is not a sensor is refused
  BEGIN
    INSERT INTO public.object_type_sensor_links (object_type_id, link_type_id, sensor_name_property_id)
    VALUES (sens, lk, snm);
    RAISE EXCEPTION 'a sensor link was accepted on a type whose toggle is off';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:NotASensorObjectType%' THEN RAISE; END IF;
  END;

  UPDATE public.object_types SET is_sensor = true WHERE id = sens;

  -- 2. a sensor object type with no entry is a violation, and one entry clears it
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M783Sensor' AND v.problem LIKE '%configures no sensor link%';
  IF n <> 1 THEN RAISE EXCEPTION 'a sensor object type with no link is one violation; got %', n; END IF;

  -- 3. the name property must belong to this type and be a string
  BEGIN
    INSERT INTO public.object_type_sensor_links (object_type_id, link_type_id, sensor_name_property_id)
    VALUES (sens, lk, rpk);
    RAISE EXCEPTION 'a property of another object type was accepted as the sensor name';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:PropertyNotOnThisObjectType%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.object_type_sensor_links (object_type_id, link_type_id, sensor_name_property_id)
    VALUES (sens, lk, tsp);
    RAISE EXCEPTION 'a time series property was accepted as the sensor name';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:SensorNameMustBeString%' THEN RAISE; END IF;
  END;

  INSERT INTO public.object_type_sensor_links (object_type_id, link_type_id, sensor_name_property_id)
  VALUES (sens, lk, snm) RETURNING id INTO entry;

  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M783Sensor' AND v.problem LIKE '%configures no sensor link%';
  IF n <> 0 THEN RAISE EXCEPTION 'one entry clears the finding; got %', n; END IF;

  -- 4. a second time series property on a sensor object type is a violation
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (sens, 'second_id', 'Second', 'secondId', 'time_series', 'column', 'series_id',
          (SELECT d.id FROM public.object_type_datasources d
            WHERE d.object_type_id = sens AND d.dataset_id IS NOT NULL), 'double');
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M783Sensor' AND v.problem LIKE 'A sensor object type has one time series property%';
  IF n <> 1 THEN RAISE EXCEPTION 'a second TSP on a sensor is one violation; got %', n; END IF;
  DELETE FROM public.object_type_properties WHERE object_type_id = sens AND property_id = 'second_id';

  -- 5. THE READ: a root object's sensors, their names, and their points
  PERFORM public.run_index_build(ARRAY[root, sens]::uuid[], true);

  SELECT count(*) INTO n FROM public.sensor_series(root, 'M1');
  IF n <> 3 THEN
    RAISE EXCEPTION 'M1 has two sensors carrying three points between them; got %', n;
  END IF;
  SELECT count(DISTINCT s.sensor_name) INTO n FROM public.sensor_series(root, 'M1') s;
  IF n <> 2 THEN RAISE EXCEPTION 'the two sensors are named apart; got % name(s)', n; END IF;
  SELECT count(*) INTO n FROM public.sensor_series(root, 'M1') s
   WHERE s.sensor_name = 'Inlet pressure';
  IF n <> 2 THEN RAISE EXCEPTION 'Inlet pressure carries two points; got %', n; END IF;

  -- a window narrows it, which proves the points are really being read
  SELECT count(*) INTO n FROM public.sensor_series(root, 'M1', '2026-01-01T00:30:00Z'::timestamptz);
  IF n <> 1 THEN RAISE EXCEPTION 'one point falls after the window opens; got %', n; END IF;

  -- and a root object with no sensors reads empty rather than raising
  SELECT count(*) INTO n FROM public.sensor_series(root, 'NOSUCH');
  IF n <> 0 THEN RAISE EXCEPTION 'an unknown root object has no sensors; got %', n; END IF;

  RAISE EXCEPTION USING errcode = 'P0783', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0783' THEN
  NULL;
END $$;
