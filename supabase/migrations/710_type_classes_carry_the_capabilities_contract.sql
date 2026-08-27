-- 710: type classes — the mechanism Capabilities configuration hangs from.
--
-- Vertex's event and threshold contract is not a Vertex table; it is TYPE
-- CLASSES on ontology properties and link types, and the page that LISTS
-- them is object-link-types/metadata-typeclasses. The adversary pass
-- corrected the reading here twice: the event half lives under the
-- `timeseries` kind, not `vertex` —
--
--   "The property specifying the start time of an event object. This field should be a time value (e.g. a `TIMESTAMP)`."
--   — object-link-types/metadata-typeclasses.md
--
-- with every event row marked Configure in Capabilities page of object
-- type — and three MORE vertex classes live on link types, on a page the
-- reading had already read:
--
--   "This can be configured per link type using the following Ontology type classes:"
--   — vertex/graphs-display-options.md
--
-- (link_primary_direction, link_undirectional, link_bidirectional, with the
-- default keyed to the link's cardinality.)
--
-- An event is then a CONVENTION over object types, never a table:
--
--   "Events are object types configured in the Ontology that include temporal information—minimally, two timestamps that indicate the start and end of the event."
--   — vertex/events-overview.md
--
-- Some names are parameterised — event_intent.<intent>, event_value_unit.<unit>,
-- threshold_measure.<measure>, threshold_exceed_intent.<intent>,
-- key_measure.<measure> — so the guard accepts the exact names and those
-- prefixes, and refuses anything else by name. Kinds outside the two this
-- platform consumes (the page also carries schedules and others) refuse
-- until they are catalogued deliberately.

-- ── the catalogue ───────────────────────────────────────────────────────────

CREATE FUNCTION public.ontology_type_classes_catalogue()
RETURNS TABLE (kind text, name text, applies_to text, parameterised boolean, deprecated boolean)
LANGUAGE sql IMMUTABLE AS $$
  -- object-link-types/metadata-typeclasses' vertex and timeseries rows, plus
  -- graphs-display-options' three link-direction classes. applies_to is the
  -- table's own Property/Relation column.
  SELECT * FROM (VALUES
    -- vertex, on properties and relations (17 rows of the table)
    ('vertex', 'link_merge',              'property', false, false),
    ('vertex', 'link_merge_incoming',     'relation', false, false),
    ('vertex', 'link_merge_outgoing',     'relation', false, false),
    ('vertex', 'component',               'relation', false, false),
    ('vertex', 'component_subtype',       'property', false, false),
    ('vertex', 'event_intent',            'property', true,  false),
    ('vertex', 'event_value',             'property', false, false),
    ('vertex', 'event_value_unit',        'property', true,  false),
    ('vertex', 'event_property',          'property', false, false),
    ('vertex', 'min',                     'property', false, false),
    ('vertex', 'max',                     'property', false, false),
    ('vertex', 'threshold_measure',       'property', true,  false),
    ('vertex', 'threshold_high_limit',    'property', false, false),
    ('vertex', 'threshold_low_limit',     'property', false, false),
    ('vertex', 'threshold_exceed_intent', 'property', true,  false),
    ('vertex', 'key_measure',             'property', true,  false),
    ('vertex', 'enum_values',             'property', false, true),
    -- vertex, on link types (graphs-display-options)
    ('vertex', 'link_primary_direction',  'relation', false, false),
    ('vertex', 'link_undirectional',      'relation', false, false),
    ('vertex', 'link_bidirectional',      'relation', false, false),
    -- timeseries (the series half)
    ('timeseries', 'timeseries_id',          'property', false, false),
    ('timeseries', 'timeseries_measure',     'property', false, false),
    ('timeseries', 'timeseries_sensor_type', 'property', false, true),
    ('timeseries', 'timeseries_units',       'property', false, false),
    ('timeseries', 'timeseries_internal_interpolation', 'property', false, false),
    ('timeseries', 'timeseries_root_object_id', 'property', false, false),
    ('timeseries', 'timeseries_is_enum',     'property', false, false),
    -- timeseries (the EVENT half — the Vertex event contract)
    ('timeseries', 'event_id',               'property', false, false),
    ('timeseries', 'event_start_time',       'property', false, false),
    ('timeseries', 'event_end_time',         'property', false, false),
    ('timeseries', 'event_description',      'property', false, false),
    ('timeseries', 'event_root_object_id',   'property', false, false),
    ('timeseries', 'event_linked_series_id', 'property', false, false)
  ) AS t(kind, name, applies_to, parameterised, deprecated)
$$;
COMMENT ON FUNCTION public.ontology_type_classes_catalogue() IS
  'The vertex and timeseries type classes object-link-types/metadata-typeclasses enumerates (17 vertex + 13 timeseries rows, two deprecated), plus the three link-direction classes vertex/graphs-display-options defines on link types. applies_to is the table''s own Property/Relation column; parameterised rows take a dot suffix (event_intent.danger). Kinds the page carries that no application here consumes yet (schedules, …) refuse until catalogued deliberately.';

-- ── the assignment: a property or a link type wears a class ─────────────────

CREATE TABLE public.ontology_type_classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  link_type_id uuid REFERENCES public.link_types(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  name         text NOT NULL,
  created_by   uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(property_id, link_type_id) = 1),
  UNIQUE (property_id, kind, name),
  UNIQUE (link_type_id, kind, name)
);
CREATE INDEX ontology_type_classes_property_idx ON public.ontology_type_classes (property_id);
CREATE INDEX ontology_type_classes_link_idx ON public.ontology_type_classes (link_type_id);
CREATE INDEX ontology_type_classes_created_by_idx ON public.ontology_type_classes (created_by);
COMMENT ON TABLE public.ontology_type_classes IS
  'One type-class assignment — the Capabilities-page configuration metadata-typeclasses describes, held as (kind, name) on a property or a link type. Applications read conventions off it: an EVENT is an object type whose properties wear timeseries event_start_time and event_end_time ("Events are object types configured in the Ontology that include temporal information", vertex/events-overview) — never a table.';

CREATE FUNCTION public.guard_ontology_type_class()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; base text;
BEGIN
  base := split_part(NEW.name, '.', 1);
  SELECT * INTO c FROM public.ontology_type_classes_catalogue() k
   WHERE k.kind = NEW.kind AND k.name = base;
  IF c.kind IS NULL THEN
    RAISE EXCEPTION 'Ontology:UnknownTypeClass — %.% is not a type class the catalogue holds', NEW.kind, NEW.name;
  END IF;
  IF NEW.name <> base AND NOT c.parameterised THEN
    RAISE EXCEPTION 'Ontology:TypeClassTakesNoParameter — %.% does not take a dot suffix', NEW.kind, base;
  END IF;
  IF c.deprecated THEN
    RAISE EXCEPTION 'Ontology:TypeClassDeprecated — %.% is marked Deprecated on the enumerating page', NEW.kind, base;
  END IF;
  IF c.applies_to = 'property' AND NEW.property_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:TypeClassOnWrongTarget — %.% applies to a Property', NEW.kind, base;
  END IF;
  IF c.applies_to = 'relation' AND NEW.link_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:TypeClassOnWrongTarget — %.% applies to a Relation', NEW.kind, base;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ontology_type_class
  BEFORE INSERT OR UPDATE ON public.ontology_type_classes
  FOR EACH ROW EXECUTE FUNCTION public.guard_ontology_type_class();

-- ── the conventions applications read ───────────────────────────────────────

CREATE FUNCTION public.vertex_event_types()
RETURNS TABLE (object_type_id uuid, start_property text, end_property text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  -- "All events must have a distinct start and end time"
  -- (vertex/explore-related-events) — an event type is one wearing both.
  SELECT p1.object_type_id, p1.api_name, p2.api_name
    FROM public.ontology_type_classes c1
    JOIN public.object_type_properties p1 ON p1.id = c1.property_id
    JOIN public.ontology_type_classes c2 ON c2.kind = 'timeseries' AND c2.name = 'event_end_time'
    JOIN public.object_type_properties p2 ON p2.id = c2.property_id
                                         AND p2.object_type_id = p1.object_type_id
   WHERE c1.kind = 'timeseries' AND c1.name = 'event_start_time'
$$;
COMMENT ON FUNCTION public.vertex_event_types() IS
  'The event convention, read: an object type whose properties wear timeseries.event_start_time and timeseries.event_end_time is an event type — "Events are object types configured in the Ontology that include temporal information—minimally, two timestamps" (vertex/events-overview). No events table exists, deliberately.';

-- ── RLS: the type classes follow the ontology's editing rules ───────────────

ALTER TABLE public.ontology_type_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read type classes" ON public.ontology_type_classes
  FOR SELECT USING (true);
CREATE POLICY "org members author type classes" ON public.ontology_type_classes
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ontology_type_classes TO authenticated;
COMMENT ON POLICY "org members author type classes" ON public.ontology_type_classes IS
  'Capabilities configuration is ontology metadata; the properties and link types it decorates carry the real access, and their own policies gate what a caller can SEE through the convention views. Tightening to OMA editor roles is a recorded follow-up.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; ot uuid; p_start uuid; p_end uuid; p_pk uuid;
  n integer;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('vx-710') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('vx-710') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'vx710', 'VX710', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vx710@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'vx710@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'FlightDelay710', 'Flight delay') RETURNING id INTO ot;
    INSERT INTO public.object_type_properties (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
    VALUES (ot, 'delayId', 'Delay id', 'delayId', 'string', 'column', 'delay_id') RETURNING id INTO p_pk;
    INSERT INTO public.object_type_properties (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
    VALUES (ot, 'startedAt', 'Started at', 'startedAt', 'timestamp', 'column', 'started_at') RETURNING id INTO p_start;
    INSERT INTO public.object_type_properties (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
    VALUES (ot, 'endedAt', 'Ended at', 'endedAt', 'timestamp', 'column', 'ended_at') RETURNING id INTO p_end;

    -- 1. The catalogue holds 33 rows (17 vertex + 3 link-direction + 13 timeseries), two deprecated.
    SELECT count(*) INTO n FROM public.ontology_type_classes_catalogue();
    IF n <> 33 THEN RAISE EXCEPTION 'the catalogue holds %, not 33', n; END IF;
    SELECT count(*) INTO n FROM public.ontology_type_classes_catalogue() c WHERE c.deprecated;
    IF n <> 2 THEN RAISE EXCEPTION '% deprecated rows, not 2', n; END IF;

    -- 2. Half an event is not an event; both timestamps make one.
    INSERT INTO public.ontology_type_classes (property_id, kind, name)
    VALUES (p_start, 'timeseries', 'event_start_time');
    IF EXISTS (SELECT 1 FROM public.vertex_event_types() e WHERE e.object_type_id = ot) THEN
      RAISE EXCEPTION 'a start time alone made an event type';
    END IF;
    INSERT INTO public.ontology_type_classes (property_id, kind, name)
    VALUES (p_end, 'timeseries', 'event_end_time');
    IF NOT EXISTS (SELECT 1 FROM public.vertex_event_types() e
                    WHERE e.object_type_id = ot
                      AND e.start_property = 'startedAt' AND e.end_property = 'endedAt') THEN
      RAISE EXCEPTION 'both timestamps did not make an event type';
    END IF;

    -- 3. A parameterised class takes its suffix; a plain one refuses a suffix;
    --    an invented class, a deprecated class and a wrong target refuse.
    INSERT INTO public.ontology_type_classes (property_id, kind, name)
    VALUES (p_pk, 'vertex', 'event_intent.danger');
    BEGIN
      INSERT INTO public.ontology_type_classes (property_id, kind, name)
      VALUES (p_pk, 'vertex', 'min.celsius');
      RAISE EXCEPTION 'a suffix landed on a non-parameterised class';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:TypeClassTakesNoParameter%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.ontology_type_classes (property_id, kind, name)
      VALUES (p_pk, 'vertex', 'sparkline');
      RAISE EXCEPTION 'an invented class was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:UnknownTypeClass%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.ontology_type_classes (property_id, kind, name)
      VALUES (p_pk, 'vertex', 'enum_values');
      RAISE EXCEPTION 'a deprecated class was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:TypeClassDeprecated%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.ontology_type_classes (property_id, kind, name)
      VALUES (p_pk, 'vertex', 'link_primary_direction');
      RAISE EXCEPTION 'a relation class landed on a property';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:TypeClassOnWrongTarget%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '710 proved, as the caller: the catalogue holds the 33 enumerated classes with two deprecated; one timestamp does not make an event and two do, through the convention view; parameterised names take their suffix and plain ones refuse it; and an invented class, a deprecated class and a wrong target each refuse by name';
  END;
END $$;
