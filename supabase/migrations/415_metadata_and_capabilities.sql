-- 415 — the object type's descriptive metadata, and Capabilities
--
-- Reading: docs/foundry-reference/readings/capabilities-typeclasses-and-branching.md
--          docs/ONTOLOGY-BUILD-MAP.md, phases B1 and B4
--
-- ── B1, and what is deliberately NOT in it ───────────────────────────────────
-- The annotated Overview screenshot shows eleven fields. Four are missing here
-- and each for the same reason: their mechanism belongs to a later phase, and a
-- flag nothing reads is the half-built version CLAUDE.md warns about.
--
--   Edits / Track user edit history  -> E1. They gate the edit store, and the
--                                       Materializations tab only appears when
--                                       Edits is on.
--   Index status                     -> E2. It reads "Not indexed on branch",
--                                       so it needs both an index and a branch.
--   ID (distinct from API name)      -> still an open question. The course shows
--                                       `username-flight-alerts` for a type named
--                                       "[username] Flight Alert", and the other
--                                       screenshot shows `generated-6a437f16-…`.
--                                       Two different forms, and no page states
--                                       the rule. Not guessed at.
--
-- What is here is the metadata that is complete on its own.
--
-- ── B4: Capabilities ─────────────────────────────────────────────────────────
-- "object types now have a Capabilities page to configure features historically
--  defined as type classes. The configuration of all supported type classes will
--  move to the Capabilities page."   — object-link-types/metadata-typeclasses
--
-- So an object type NOMINATES which of its properties fulfil a platform
-- capability. It is the inverse of the reflex: Map does not read properties by
-- convention, the object type offers them.
--
-- Two panel shapes exist. This builds the SLOT-BASED one (Geospatial, Event).
-- The LIST-BASED one is `time_series_properties`, which we already have.

BEGIN;

-- ── B1 ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.object_types
  ADD COLUMN plural_label     text NOT NULL DEFAULT '',
  ADD COLUMN aliases          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN point_of_contact uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN contributors     uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.object_types.plural_label IS
  'The Plural name field. "The Plural name should update accordingly" when the name is set, so the surface derives it and the operator may override.';
COMMENT ON COLUMN public.object_types.aliases IS
  'Alternative names. The Ontology Manager search bar reads "Search by name, RID, aliases…", which is what these are for.';

-- ── B4 ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capability_slots()
RETURNS TABLE (capability text, slot text, accepts text[], note text)
LANGUAGE sql IMMUTABLE AS $$
  -- Every row is quoted from the Capabilities page or from the type-class table
  -- it replaces. `accepts` is the base types the slot will take.
  VALUES
    ('geospatial', 'altitude',        ARRAY['integer','short','long','byte','float','double','decimal','time_series'],
       'Numeric (or numeric time series) property specifying altitude/elevation of each Object in meters'),
    ('geospatial', 'radius',          ARRAY['integer','short','long','byte','float','double','decimal'],
       'Numeric property specifying the radius in meters, to render object as circles - must also have a Geopoint property indicating the center of the circle'),
    ('geospatial', 'h3_cell',         ARRAY['string','array'],
       'String property, or array of strings, containing H3 cell IDs'),
    ('geospatial', 'track_latitude',  ARRAY['time_series'],
       'Time series property, representing the Object''s Latitude'),
    ('geospatial', 'track_longitude', ARRAY['time_series'],
       'Time series property, representing the Object''s Longitude'),
    ('event',      'event_id',        ARRAY['string'],
       'The event identifier. Should be globally unique across all event objects'),
    ('event',      'event_start_time', ARRAY['timestamp'],
       'The property specifying the start time of an event object'),
    ('event',      'event_end_time',   ARRAY['timestamp'],
       'The property specifying the end time of an event object'),
    ('event',      'event_description', ARRAY['string'],
       'Required if the event object type will be used for annotation writeback'),
    ('event',      'event_root_object_id', ARRAY['string'],
       'The root object of an event object. Each event object can only have one'),
    ('event',      'event_linked_series_id', ARRAY['string','array'],
       'The series object to which an event relates. String arrays as well as single strings are supported')
$$;

COMMENT ON FUNCTION public.capability_slots() IS
  'The slot-based Capabilities vocabulary, from metadata-typeclasses (the page it replaces) and the Geospatial panel screenshot. Time series is the other panel shape and lives in time_series_properties.';

CREATE TABLE public.object_type_capabilities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  capability     text NOT NULL,
  slot           text NOT NULL,
  -- The nomination itself. A property, chosen from this object type's own.
  property_id    uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- One property per slot: the panel shows a single "Choose a property" per row.
  UNIQUE (object_type_id, capability, slot)
);

-- The slot must exist and must accept the property's base type. Not a CHECK:
-- Postgres refuses a subquery there, and the rule needs one either way — plus a
-- trigger can say WHICH slot, WHAT it takes, and quote the page's own sentence.

CREATE OR REPLACE FUNCTION public.guard_object_type_capability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE accepts text[]; base text; owner uuid;
BEGIN
  SELECT cs.accepts INTO accepts FROM public.capability_slots() cs
   WHERE cs.capability = NEW.capability AND cs.slot = NEW.slot;
  IF accepts IS NULL THEN
    RAISE EXCEPTION 'Ontology:UnknownCapabilitySlot — % / % is not a capability slot', NEW.capability, NEW.slot
      USING HINT = 'Slots come from capability_slots(), which mirrors the Capabilities page.';
  END IF;

  -- The nominated property must belong to the object type doing the nominating.
  SELECT p.object_type_id, p.base_type INTO owner, base
    FROM public.object_type_properties p WHERE p.id = NEW.property_id;
  IF owner IS DISTINCT FROM NEW.object_type_id THEN
    RAISE EXCEPTION 'Ontology:PropertyNotOnThisObjectType — a capability may only nominate a property of its own object type';
  END IF;

  IF NOT (base = ANY (accepts)) THEN
    RAISE EXCEPTION 'Ontology:CapabilitySlotTypeMismatch — % / % takes % but "%" is %',
      NEW.capability, NEW.slot, array_to_string(accepts, ', '), NEW.property_id, base
      USING HINT = (SELECT note FROM public.capability_slots() cs
                     WHERE cs.capability = NEW.capability AND cs.slot = NEW.slot);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_type_capability
  BEFORE INSERT OR UPDATE ON public.object_type_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.guard_object_type_capability();

COMMENT ON TABLE public.object_type_capabilities IS
  'An object type nominating its properties against platform capability slots — what type classes became. Slot-based panels only; Time series is the list-shaped panel and lives in time_series_properties.';

CREATE INDEX idx_object_type_capabilities_type ON public.object_type_capabilities (object_type_id);

ALTER TABLE public.object_type_capabilities ENABLE ROW LEVEL SECURITY;

-- A capability follows its object type, the same way a property does (408).
CREATE POLICY "read capabilities of visible object types" ON public.object_type_capabilities
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()));

CREATE POLICY "authors write capabilities" ON public.object_type_capabilities
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      AND (public.auth_role() IN ('owner','admin')
           OR public.has_resource_role('object_type', t.id, 'editor'))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      AND (public.auth_role() IN ('owner','admin')
           OR public.has_resource_role('object_type', t.id, 'editor'))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_capabilities TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; ds uuid; br uuid; bind uuid; proj uuid;
  p_lat uuid; p_name uuid; p_when uuid;
  usr uuid := gen_random_uuid(); claims text; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '415@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m415') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m415') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm415', 'm415') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm415', 'm415') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'ships', 'ships') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label, plural_label, aliases)
       VALUES (org, ont, 'Ship', 'Ship', 'Ships', ARRAY['vessel','boat']) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, ds, br) RETURNING id INTO bind;

  IF (SELECT aliases FROM public.object_types WHERE id = t) <> ARRAY['vessel','boat'] THEN
    RAISE EXCEPTION 'Migration 415: aliases did not round-trip';
  END IF;

  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column, datasource_id)
  VALUES (t, 'lat_series', 'Latitude Series', 'latitudeSeries', 'time_series', 'lat', bind)
  RETURNING id INTO p_lat;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column, datasource_id)
  VALUES (t, 'name', 'Name', 'name', 'string', 'name', bind) RETURNING id INTO p_name;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column, datasource_id)
  VALUES (t, 'seen', 'Seen', 'seen', 'timestamp', 'seen', bind) RETURNING id INTO p_when;

  -- The documented case: a time series property becomes Track Latitude.
  INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
       VALUES (t, 'geospatial', 'track_latitude', p_lat);

  -- "Time series property, representing the Object's Latitude" — a string is not.
  BEGIN
    INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
         VALUES (t, 'geospatial', 'track_longitude', p_name);
    RAISE EXCEPTION 'Migration 415: a string was accepted as Track Longitude';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:CapabilitySlotTypeMismatch%' THEN RAISE; END IF;
  END;

  -- Event start time takes a timestamp, and nothing else.
  INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
       VALUES (t, 'event', 'event_start_time', p_when);
  BEGIN
    INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
         VALUES (t, 'event', 'event_end_time', p_name);
    RAISE EXCEPTION 'Migration 415: a string was accepted as an event end time';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:CapabilitySlotTypeMismatch%' THEN RAISE; END IF;
  END;

  -- A slot that does not exist is refused rather than stored.
  BEGIN
    INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
         VALUES (t, 'geospatial', 'colour', p_name);
    RAISE EXCEPTION 'Migration 415: an unknown capability slot was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:UnknownCapabilitySlot%' THEN RAISE; END IF;
  END;

  -- One property per slot.
  BEGIN
    INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
         VALUES (t, 'geospatial', 'track_latitude', p_lat);
    RAISE EXCEPTION 'Migration 415: a slot accepted a second property';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- And a capability may not nominate someone else's property.
  DECLARE t2 uuid; p_other uuid;
  BEGIN
    INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
         VALUES (org, ont, 'Port', 'Port') RETURNING id INTO t2;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source)
    VALUES (t2, 'code', 'Code', 'code', 'string', 'user_input') RETURNING id INTO p_other;
    BEGIN
      INSERT INTO public.object_type_capabilities (object_type_id, capability, slot, property_id)
           VALUES (t, 'event', 'event_id', p_other);
      RAISE EXCEPTION 'Migration 415: a capability nominated another object type''s property';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:PropertyNotOnThisObjectType%' THEN RAISE; END IF;
    END;
    DELETE FROM public.object_type_properties WHERE object_type_id = t2;
    DELETE FROM public.object_types WHERE id = t2;
  END;

  -- Readable as the role the product runs as.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);
  IF (SELECT count(*) FROM public.object_type_capabilities WHERE object_type_id = t) <> 2 THEN
    RAISE EXCEPTION 'Migration 415: authenticated cannot read the capabilities it owns';
  END IF;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.object_type_capabilities WHERE object_type_id = t;
  DELETE FROM public.object_type_properties WHERE object_type_id = t;
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.object_types WHERE ontology_id = ont;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.dataset_branches WHERE dataset_id = ds;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
