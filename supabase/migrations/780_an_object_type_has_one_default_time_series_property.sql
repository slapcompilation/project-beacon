-- An object type has one default time series property.
--
-- 774's header lists what it did not build, and two of its entries are here:
-- "the default time series property; and the Capabilities tab surface". They
-- belong together, because the second is what CLAUDE.md's fourth question asks
-- of the first. Measured before writing this: zero rows in `time_series_syncs`,
-- zero in `object_type_time_series_sources`, zero properties of base type
-- `time_series`, and `ObjectTypesPage` excludes `time_series` from the property
-- type dropdown by name. The whole slice is reachable only from SQL.
--
-- The dropdown exclusion is CORRECT and stays. A TSP is not authored by
-- choosing a base type; it is an existing string property designated as one,
-- which is what step 1 of the setup dialog says of itself:

--   "Select an existing object type property with series IDs to set as time series property"
--   — time-series/images/time-series-setup-add-tsp-dialog-2.png

-- ── the designation ────────────────────────────────────────────────────────

--   "An object type can have one time series property designated as the
--    default time series property."
--   — time-series/time-series-properties.md

--   "When configuring the first time series property for an object type, that
--    property will be set as the default time series property."
--   — time-series/time-series-properties.md

-- 408 already models exactly this shape for the title key: a boolean on the
-- property row, a CHECK on eligibility, and a partial unique index for the
-- "one per object type" half. This copies it rather than inventing a second
-- way to say the same thing.

-- ── what the default is FOR, which decides the rung ────────────────────────

--   "In some applications, the default time series property is displayed
--    without additional user intervention. In Quiver, for example, the object
--    property time series card points to the default time series property
--    unless otherwise specified."
--   — time-series/time-series-properties.md

-- An application configures itself differently. Nothing is corrupted and no
-- read returns a wrong answer, so the absence of a default belongs to
-- `ontology_warnings()` and not `ontology_violations()` — "warnings will not
-- prevent you from saving", and a save that cannot proceed because Quiver would
-- need one extra click is the over-strictness CLAUDE.md warns about.
--
-- **That it should be reported at all is a DECISION, not a citation.** I grepped
-- the mirror for what a missing default costs and no page says it is a problem,
-- a warning or a recommendation — the strongest statement of consequence in the
-- corpus is the Quiver sentence above. Every other arm of `ontology_warnings()`
-- quotes a page that says *discouraged* or *warned*; this one quotes a display
-- behaviour and infers that an operator would want to know. Recorded here and in
-- the reading as inference so the next reader does not take it for documentation.

-- ── the primary key may not be the TSP, and that was ALREADY ours ─────────

--   "The primary key property of an object type cannot be selected as the time
--    series property."
--   — time-series/time-series-properties.md

--   "TSPs cannot be a primary key or title property."
--   — time-series/create-sensor-ot.md

-- I wrote a CHECK for this and it was redundant. `object_type_properties`
-- already carries `CHECK (NOT is_primary_key OR primary_key_eligibility(base_type)
-- <> 'no')` from 408, and `primary_key_eligibility('time_series')` has returned
-- 'no' since then — as this section's own reading says in those words. The
-- title half is covered too: `title_key_eligible('time_series')` is false.
--
-- Worse than redundant, it was untestable. The probe caught `check_violation`,
-- which is what the EXISTING constraint raises, so deleting the new CHECK would
-- have left the assertion passing — the failure CLAUDE.md names by asking
-- whether the assertions would still pass if the body were a bare RAISE. The CHECK is
-- gone and the probe below now asserts the rule holds while naming which
-- constraint enforces it, so it cannot silently become a test of nothing.

-- ── one sync per property, and why that is a refusal rather than a pick ────
--
-- I went looking for what the surface should offer and found a defect instead.
-- `time_series_points` resolves a property's sync with `LIMIT 1`:
--
--     FROM object_type_time_series_sources src ... LIMIT 1
--
-- and `object_type_time_series_sources` is keyed (datasource_id, property_id),
-- so a property may carry several. Bind two and the reader answers from
-- whichever row the planner returned — silently, with no error and no marker
-- in the result. Latent, because nothing writes a second one today. Reachable
-- the moment a surface exists, which is the point of this migration.
--
-- Foundry supports several, and says what it costs:

--   "you can link a time series property to multiple time series syncs. To do
--    this, you must have a column of qualified series IDs on your object type
--    backing dataset."
--   — time-series/create-or-select-ts-ot.md

-- 774 excluded qualified series ids by name. So the honest state is not
-- *several supported and one picked* but *one supported*, said out loud — the
-- same doctrine 779 took for the per-series boolean: storable and refused,
-- rather than stored and ignored.
--
-- This is a divergence from Foundry and it is scoped: it lasts exactly as long
-- as `time_series_points` reads a bare series id. The error names itself.

-- ── the sync already knows whether its series are numeric ──────────────────

--   "The value of the quantity at the point that it is measured. A `String`
--    type indicates a **Categorical** time series; each categorical time
--    series can have at most 10,000 unique variants."
--   — time-series/time-series-concepts-glossary.md

--   "different data types cannot exist within one time series sync"
--   — time-series/create-or-select-ts-ot.md

-- Which is why the capture tags a sync `Numerical` beside its name
-- (time-series/images/time-series-setup-add-tsp-dialog-3.png) and never asks
-- the operator for it. 779 made `time_series_item_type` a required declaration
-- because the api requires it; a sync's own value column answers it, so the
-- surface computes what it would otherwise have had to ask. The declaration
-- stays required — this is the function that lets a caller make it correctly.
--
-- A claim I drafted here and then withdrew, because it does not hold. Sensor
-- object types carry an `Is categorical` column that is "*\[Required if the TSP
-- is backed by multiple syncs of both numerical and categorical types]*"
-- (time-series/create-sensor-ot.md), and I read that as meaning 779's
-- `TimeSeries:MixedSeriesNotBuilt` now rested on the schema rather than on the
-- reader. It does not. That row is a column of a SENSOR object type's backing
-- dataset; 779's column is the api's `isNonNumericPropertyTypeId`, a field of
-- the `numericOrNonNumeric` property type, which the api conditions on nothing.
-- Converging concepts, different mechanisms. And the arm added below exempts
-- `numericOrNonNumeric` by design, so a single-sync property may still declare
-- it. 779's refusal still rests on 779's RAISE, exactly as it did.

-- ── 1. the column, and the one fact about a row it adds ──────────────────

ALTER TABLE public.object_type_properties
  ADD COLUMN is_default_time_series boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.object_type_properties.is_default_time_series IS
  'The one time series property applications reach for without being told which — Quiver''s object property time series card "points to the default time series property unless otherwise specified". Designated like the title key (408): a flag on the row, one per object type.';

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT default_time_series_is_a_time_series_property
  CHECK (NOT is_default_time_series OR base_type = 'time_series');

-- ── 2. one per object type ────────────────────────────────────────────────

CREATE UNIQUE INDEX object_type_one_default_time_series
  ON public.object_type_properties (object_type_id) WHERE is_default_time_series;

-- ── 3. the first one is the default ───────────────────────────────────────
--
-- Scoped to the moment a property BECOMES a time series property, which is what
-- "when configuring the first time series property" describes. It deliberately
-- does not fire on a later update that clears the flag: Foundry greys the
-- checkbox out rather than refusing the click
-- (time-series/images/time-series-setup-default-tsp.png shows it checked and
-- disabled), so the surface disables it and the database does not silently
-- rewrite a false back to true. An operator who clears it in SQL gets the
-- warning below, not a value they did not write.

CREATE OR REPLACE FUNCTION public.designate_first_time_series_property()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.base_type <> 'time_series' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.base_type = 'time_series' THEN RETURN NEW; END IF;
  -- "the FIRST time series property for an object type". An earlier draft said
  -- "when no default exists", which is a different sentence: delete the default
  -- of two, add a third, and it would have been designated silently — the very
  -- thing the paragraph above promises not to do.
  IF NOT EXISTS (SELECT 1 FROM public.object_type_properties p
                  WHERE p.object_type_id = NEW.object_type_id
                    AND p.base_type = 'time_series'
                    AND p.id <> NEW.id) THEN
    NEW.is_default_time_series := true;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.designate_first_time_series_property() IS
  'The first time series property of an object type is its default. Fires only as a property becomes one, never on a later edit — clearing the designation is the operator''s to make, and ontology_warnings() reports the result.';

CREATE TRIGGER designate_first_time_series_property
BEFORE INSERT OR UPDATE OF base_type ON public.object_type_properties
FOR EACH ROW EXECUTE FUNCTION public.designate_first_time_series_property();

-- ── 4. a sync's series are numeric unless its value column is a string ────

CREATE OR REPLACE FUNCTION public.time_series_sync_item_type(p_sync uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN upper(f->>'type') = 'STRING' THEN 'string' ELSE 'double' END
    FROM public.time_series_syncs s
    JOIN LATERAL jsonb_array_elements(public.dataset_current_fields(s.input_dataset_id)) f
      ON f->>'name' = s.value_column
   WHERE s.id = p_sync;
$$;

COMMENT ON FUNCTION public.time_series_sync_item_type(uuid) IS
  'The itemType a property bound to this sync should declare. "A String type indicates a Categorical time series" and "different data types cannot exist within one time series sync", so the sync answers it for every property it backs — which is why the setup dialog tags a sync Numerical instead of asking. Null when the sync''s dataset has no committed schema to read the value column from.';

GRANT EXECUTE ON FUNCTION public.time_series_sync_item_type(uuid) TO authenticated, service_role;

-- ── 5. one sync per property, and an itemType the sync agrees with ────────
--
-- The second arm is the probe's doing. It was written to show the surface must
-- copy the sync's answer, and it showed instead that nothing stops a property
-- declaring `double` while bound to a categorical sync — whereupon 779's reader
-- runs `IF pr.time_series_item_type = 'double' THEN cat := NULL; END IF;` and
-- every point comes back empty, with no error. That is the third defect of this
-- shape found by a probe aimed at something else, so it is closed here rather
-- than written down as a question.
--
-- Closed ON ONE EDGE, and the scope is worth stating: the guard fires on
-- `object_type_time_series_sources`, so it catches the disagreement at bind
-- time. It does not re-run when the property's declaration is edited later,
-- when a sync is repointed at another value column, or when the sync's dataset
-- commits a schema that changes that column's type. Those three are a linter's
-- job — `ontology_violations()`, whose rung on CLAUDE.md''s ladder is the fact
-- that goes stale without anyone editing the ontology — and they are named here
-- rather than implied to be covered.
--
-- `numericOrNonNumeric` is exempt: it is the member that declines to decide,
-- and 779's reader returns both columns for it.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.guard_time_series_source()'::regprocedure), chr(13), '');

  a := 'DECLARE d record; pr record; ftype text;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected one DECLARE line, found %', n; END IF;
  src := replace(src, a, 'DECLARE d record; pr record; ftype text; sync_item text;');

  a := chr(10) || '  RETURN NULL;' || chr(10);
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected the guard to end with one bare RETURN NULL, found %', n;
  END IF;

  EXECUTE replace(src, a, chr(10) ||
'  -- Several syncs need "a column of qualified series IDs", which 774 excluded,
  -- and time_series_points resolves the binding with LIMIT 1.
  IF EXISTS (SELECT 1 FROM public.object_type_time_series_sources s
              WHERE s.property_id = NEW.property_id
                AND s.datasource_id <> NEW.datasource_id) THEN
    RAISE EXCEPTION ''TimeSeries:MultiSyncNotBuilt — % is already bound to a time series sync, and a qualified series id spanning several is not read yet'', pr.property_id;
  END IF;

  -- "different data types cannot exist within one time series sync", so the
  -- sync settles it and a disagreeing declaration silences the reader.
  IF pr.time_series_item_type IN (''string'', ''double'') THEN
    sync_item := public.time_series_sync_item_type(d.time_series_sync_id);
    IF sync_item IS NOT NULL AND sync_item <> pr.time_series_item_type THEN
      RAISE EXCEPTION ''TimeSeries:ItemTypeDisagreesWithSync — % declares % and the sync''''s value column is %'',
        pr.property_id, pr.time_series_item_type, sync_item;
    END IF;
  END IF;
' || a);
END $mig$;

COMMENT ON FUNCTION public.guard_time_series_source() IS
  'A property bound to a sync must be a time series property of that datasource''s own object type, must name the string column holding its series ids on the object type''s TABULAR datasource, must have declared its itemType (779), and since 780 must be bound to exactly one sync — several are legal in Foundry only with qualified series ids, which the reader does not parse.';

-- ── 6. an object type with time series properties and no default ──────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_warnings()'::regprocedure), chr(13), '');

  a := '       OR (l.target_object_type_id = s.object_type_id
           AND l.cardinality IN (''many_to_one'', ''many_to_many'')))';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected the interface-link arm to end the function once, found %', n;
  END IF;

  EXECUTE replace(src, a, a || '

  UNION ALL

  -- "the object property time series card points to the default time series
  -- property unless otherwise specified" — without one, those applications ask.
  SELECT t.api_name, ''object_type'', t.api_name,
         ''Time series properties are configured but none is the default, so applications that display one without user intervention will not.''
    FROM public.object_types t
   WHERE EXISTS (SELECT 1 FROM public.object_type_properties p
                  WHERE p.object_type_id = t.id AND p.base_type = ''time_series'')
     AND NOT EXISTS (SELECT 1 FROM public.object_type_properties p
                      WHERE p.object_type_id = t.id AND p.is_default_time_series)');
END $mig$;

-- ── 7. a live comment that says this is not built ─────────────────────────
--
-- `object_type_capabilities` still carries "The list-shaped Time series panel
-- is not built YET: its reading is incomplete (8 of 42 time-series pages
-- read)". The reading is now all 42, and this migration plus the panel it
-- serves is that list. 745 exists because a live comment was read next session
-- as fact; leaving this one would repeat it exactly. Corrected forward, since
-- an applied migration cannot be edited.

COMMENT ON TABLE public.object_type_capabilities IS
  'An object type nominating its properties against platform capability slots — what type classes became. Slot-based panels only. The list-shaped Time series panel is NOT one of these rows and never was: a time series property is a property whose base type is time_series, bound to a sync through object_type_time_series_sources (774), with one of them designated the default (780). It is drawn on the same Capabilities tab because that is where Foundry draws it. 629''s earlier claim here that "no base type admits a series" was false when written; 628 asserted the set''s count, never its membership. Corrected 745, and again in 780 once the reading was complete and the panel existed.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid;
  tsd uuid; tsb uuid; tst uuid;
  tsd2 uuid; tsb2 uuid; tst2 uuid;
  ot uuid; pk uuid; tsp uuid; tsp2 uuid; tsp3 uuid;
  sync uuid; sync2 uuid; d1 uuid; d2 uuid; dsrc uuid;
  msg text; n int; it text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m780 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm780-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm780-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M780 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm780p', 'm780 probe') RETURNING id INTO proj;

  -- the object type's own tabular datasource
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm780_machines', 'Machines') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"id","type":"STRING"},{"name":"temperature_id","type":"STRING"},{"name":"pressure_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'm.parquet', 1) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  -- a NUMERICAL sync dataset and a CATEGORICAL one
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm780_num', 'Numeric points') RETURNING id INTO tsd;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (tsd, 'master') RETURNING id INTO tsb;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (tsd, tsb, 'SNAPSHOT') RETURNING id INTO tst;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (tsd, tst, '[{"name":"series_id","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"value","type":"DOUBLE"}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = tst;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm780_cat', 'Categorical points') RETURNING id INTO tsd2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (tsd2, 'master') RETURNING id INTO tsb2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (tsd2, tsb2, 'SNAPSHOT') RETURNING id INTO tst2;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (tsd2, tst2, '[{"name":"series_id","type":"STRING"},{"name":"ts","type":"TIMESTAMP"},{"name":"value","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = tst2;

  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, tsd, 'Machine time series sync', 'series_id', 'ts', 'value') RETURNING id INTO sync;
  INSERT INTO public.time_series_syncs
    (organization_id, project_id, input_dataset_id, name, series_id_column, timestamp_column, value_column)
  VALUES (org, proj, tsd2, 'Machine states sync', 'series_id', 'ts', 'value') RETURNING id INTO sync2;

  -- 4. the sync answers the itemType question the operator would otherwise be asked
  IF public.time_series_sync_item_type(sync) <> 'double' THEN
    RAISE EXCEPTION 'a DOUBLE value column is a numerical sync, got %', public.time_series_sync_item_type(sync);
  END IF;
  IF public.time_series_sync_item_type(sync2) <> 'string' THEN
    RAISE EXCEPTION 'a STRING value column is a categorical sync, got %', public.time_series_sync_item_type(sync2);
  END IF;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M780Machine', 'Machine') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ot, ds, br) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'id', 'Id', 'id', 'string', 'column', 'id', true, true, true) RETURNING id INTO pk;

  -- The primary key may not be the time series property, and 408 already says
  -- so. Asserted with the constraint NAMED, because an unnamed check_violation
  -- here would pass whether or not this migration had added anything.
  BEGIN
    UPDATE public.object_type_properties SET base_type = 'time_series' WHERE id = pk;
    RAISE EXCEPTION 'the primary key was allowed to become the time series property';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS msg = CONSTRAINT_NAME;
    IF msg <> 'object_type_properties_check1' THEN
      RAISE EXCEPTION 'expected 408''s primary_key_eligibility check to refuse it, got %', msg;
    END IF;
  END;
  IF public.primary_key_eligibility('time_series') <> 'no'
     OR public.title_key_eligible('time_series') THEN
    RAISE EXCEPTION '"TSPs cannot be a primary key or title property" stopped being true';
  END IF;

  -- 3. the FIRST time series property becomes the default, unasked
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'temperature_id', 'Temperature', 'temperatureId', 'time_series', 'column',
          'temperature_id', dsrc, 'double') RETURNING id INTO tsp;
  IF NOT (SELECT is_default_time_series FROM public.object_type_properties WHERE id = tsp) THEN
    RAISE EXCEPTION 'the first time series property should have been designated the default';
  END IF;

  -- and the SECOND does not
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'pressure_id', 'Pressure', 'pressureId', 'time_series', 'column',
          'pressure_id', dsrc, 'double') RETURNING id INTO tsp2;
  IF (SELECT is_default_time_series FROM public.object_type_properties WHERE id = tsp2) THEN
    RAISE EXCEPTION 'only one property is the default, and the first one already was';
  END IF;

  -- 2. two defaults at once are refused
  BEGIN
    UPDATE public.object_type_properties SET is_default_time_series = true WHERE id = tsp2;
    RAISE EXCEPTION 'an object type was allowed two default time series properties';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- and a property that is not a time series one cannot be the default
  BEGIN
    UPDATE public.object_type_properties SET is_default_time_series = true WHERE id = pk;
    RAISE EXCEPTION 'a string property was allowed to be the default time series property';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 5. one sync per property
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, sync) RETURNING id INTO d1;
  INSERT INTO public.object_type_datasources (object_type_id, time_series_sync_id)
  VALUES (ot, sync2) RETURNING id INTO d2;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d1, tsp);

  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp);
    RAISE EXCEPTION 'a property was bound to two syncs, and the reader takes whichever comes first';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:MultiSyncNotBuilt%' THEN RAISE; END IF;
  END;

  -- a declaration the sync disagrees with is refused, because 779's reader
  -- would null the column it named and return every point empty
  BEGIN
    INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp2);
    RAISE EXCEPTION 'a double property was bound to a categorical sync, and every point would read null';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'TimeSeries:ItemTypeDisagreesWithSync%' THEN RAISE; END IF;
  END;

  -- a DIFFERENT property may use the other sync — the refusal is per property,
  -- once its declaration says what the sync's values actually are
  UPDATE public.object_type_properties
     SET time_series_item_type = public.time_series_sync_item_type(sync2) WHERE id = tsp2;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp2);

  -- 6. clearing the last default warns, and does not block
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.object_type = 'M780Machine' AND w.problem LIKE 'Time series properties are configured%';
  IF n <> 0 THEN RAISE EXCEPTION 'a default is set, so nothing should warn yet; got %', n; END IF;

  UPDATE public.object_type_properties SET is_default_time_series = false WHERE id = tsp;
  SELECT count(*) INTO n FROM public.ontology_warnings() w
   WHERE w.object_type = 'M780Machine' AND w.problem LIKE 'Time series properties are configured%';
  IF n <> 1 THEN RAISE EXCEPTION 'time series properties with no default should warn once; got %', n; END IF;

  -- and it is a WARNING, so it does not join the list that blocks a save
  SELECT count(*) INTO n FROM public.ontology_violations() v
   WHERE v.object_type = 'M780Machine' AND v.problem LIKE '%default time series%';
  IF n <> 0 THEN RAISE EXCEPTION 'the missing default must not block a save; got % violation(s)', n; END IF;

  -- numericOrNonNumeric is the member that declines to decide, so no sync
  -- disagrees with it
  UPDATE public.object_type_properties
     SET time_series_item_type = 'numericOrNonNumeric' WHERE id = tsp2;
  DELETE FROM public.object_type_time_series_sources WHERE property_id = tsp2;
  INSERT INTO public.object_type_time_series_sources (datasource_id, property_id) VALUES (d2, tsp2);
  SELECT p.time_series_item_type INTO it
    FROM public.object_type_properties p WHERE p.id = tsp2;
  IF it <> 'numericOrNonNumeric' THEN
    RAISE EXCEPTION 'the undecided declaration should have survived the binding, got %', it;
  END IF;

  -- The path an adversary found untested, and which an earlier draft of the
  -- trigger got wrong: with the default gone and another TSP still present, a
  -- NEW time series property is not the first, so it is not designated.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, time_series_item_type)
  VALUES (ot, 'flow_id', 'Flow', 'flowId', 'time_series', 'column',
          'temperature_id', dsrc, 'double') RETURNING id INTO tsp3;
  IF (SELECT is_default_time_series FROM public.object_type_properties WHERE id = tsp3) THEN
    RAISE EXCEPTION 'a third time series property was silently designated the default';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0780', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0780' THEN
  NULL;
END $$;
