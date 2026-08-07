-- 417 — a link type has two ends
--
-- Reading: docs/foundry-reference/readings/deep-dive-ontology.md (§10)
--          docs/foundry-reference/readings/materializations-links-media-and-rids.md (§3)
--          docs/ONTOLOGY-BUILD-MAP.md, phase B2
--
-- The link type screenshot shows ONE resource with TWO directional sections, and
-- each section carries its own API name and its own visibility:
--
--   Flight Alert -> [OFT] Flight   "Each Flight Alert has ONE  [OFT] Flight"
--                                  API Name  FlightAlert. oftFlight   .get()
--                                  Visibility  Normal
--
--   [OFT] Flight -> Flight Alert   "Each [OFT] Flight has MANY Flight Alerts"
--                                  API Name  oftFlight.  FlightAlerts2  .all()
--                                  Visibility  Normal
--
-- NOT A CHILD TABLE, and the map said otherwise — this is a deliberate change.
-- The map proposed `link_type_ends(link_type_id, side, …)`. The screenshot
-- argues against it: the RID sits on the LINK TYPE, the two sections live inside
-- its own Overview, and neither end is separately addressable. A child table
-- would imply the end is a resource. It is a direction, so it is two columns.
-- `link_types` already carried source_api_name / target_api_name half-built;
-- this finishes the pair rather than migrating it sideways.
--
-- THE SUFFIX IS DERIVED, NEVER STORED. `.get()` for a `one` side, `.all()` for a
-- `many` side — it is a function of cardinality, and storing it would let the
-- two disagree.
--
-- ALSO DELETED HERE. Four columns that belong to no page:
--   backing_hotel_column, backing_time_column   hospitality, from the old product
--   edge_type, projected                        the reality-graph edge model
-- Nothing in TypeScript reads them and no function or view mentions them; only
-- superseded migrations do, and those are history.

BEGIN;

ALTER TABLE public.link_types
  DROP COLUMN backing_hotel_column,
  DROP COLUMN backing_time_column,
  DROP COLUMN edge_type,
  DROP COLUMN projected;

-- Each end's visibility, beside the api_name and label it already had.
-- "A `prominent` link type will prompt applications to show this link type
--  first to users. A `hidden` link type will not appear in user applications."
ALTER TABLE public.link_types
  ADD COLUMN source_visibility text NOT NULL DEFAULT 'normal'
    CHECK (source_visibility IN ('prominent','normal','hidden')),
  ADD COLUMN target_visibility text NOT NULL DEFAULT 'normal'
    CHECK (target_visibility IN ('prominent','normal','hidden'));

COMMENT ON COLUMN public.link_types.source_api_name IS
  'The accessor name on the SOURCE object type, reading toward the target. One of the link type''s two ends; the .get()/.all() suffix is derived from cardinality.';
COMMENT ON COLUMN public.link_types.target_api_name IS
  'The accessor name on the TARGET object type, reading back toward the source.';

-- ── the accessor, derived ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_accessor(p_link uuid, p_side text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE p_side
    -- Reading from the source: how many targets does each source have?
    WHEN 'source' THEN s.api_name || '.' || lt.source_api_name || '.'
      || CASE WHEN lt.cardinality IN ('one_to_one','many_to_one') THEN 'get()' ELSE 'all()' END
    WHEN 'target' THEN g.api_name || '.' || lt.target_api_name || '.'
      || CASE WHEN lt.cardinality IN ('one_to_one','one_to_many') THEN 'get()' ELSE 'all()' END
  END
  FROM public.link_types lt
  JOIN public.object_types s ON s.id = lt.source_object_type_id
  JOIN public.object_types g ON g.id = lt.target_object_type_id
 WHERE lt.id = p_link
$$;

COMMENT ON FUNCTION public.link_accessor(uuid, text) IS
  'The generated accessor for one end of a link type: .get() where that side sees one, .all() where it sees many. Derived from cardinality so the two can never disagree.';

REVOKE ALL ON FUNCTION public.link_accessor(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_accessor(uuid, text) TO authenticated;

-- ── the rules edit-link-types states ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_link_type()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src_pk text; tgt_pk text; s_ont uuid; g_ont uuid;
BEGIN
  -- A link joins two types of its own ontology (412 gave link_types one).
  SELECT ontology_id INTO s_ont FROM public.object_types WHERE id = NEW.source_object_type_id;
  SELECT ontology_id INTO g_ont FROM public.object_types WHERE id = NEW.target_object_type_id;
  IF s_ont IS DISTINCT FROM NEW.ontology_id OR g_ont IS DISTINCT FROM NEW.ontology_id THEN
    RAISE EXCEPTION 'Ontology:LinkCrossesOntologies — a link type joins two object types of its own ontology';
  END IF;

  -- "you cannot change the API name for link types with an `active` status."
  IF TG_OP = 'UPDATE' AND OLD.status = 'active'
     AND (NEW.source_api_name IS DISTINCT FROM OLD.source_api_name
       OR NEW.target_api_name IS DISTINCT FROM OLD.target_api_name) THEN
    RAISE EXCEPTION 'Ontology:ActiveLinkApiNameIsFixed — an active link type''s API name cannot change'
      USING HINT = 'Move it to experimental or deprecated first.';
  END IF;

  -- "the key of one of the object types must map to the Primary key of that
  --  object type, ensuring that the 'one' side of the Cardinality is unique."
  -- For a foreign-key link, the side that sees ONE must be joined on its primary
  -- key; otherwise the cardinality is a claim the data cannot keep.
  IF NEW.backing_kind = 'foreign_key' AND NEW.cardinality IN ('many_to_one','one_to_one') THEN
    SELECT p.backing_column INTO tgt_pk
      FROM public.object_type_properties p
     WHERE p.object_type_id = NEW.target_object_type_id AND p.is_primary_key;
    IF tgt_pk IS NOT NULL AND NEW.backing_column IS DISTINCT FROM tgt_pk THEN
      RAISE EXCEPTION 'Ontology:LinkKeyIsNotAPrimaryKey — % is % so the target must be joined on its primary key column "%"',
        NEW.api_name, NEW.cardinality, tgt_pk
        USING HINT = 'The "one" side of a cardinality has to be unique, and only the primary key is.';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_link_type
  BEFORE INSERT OR UPDATE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_link_type();

-- "Note that link types with an `active` status cannot be deleted."
CREATE OR REPLACE FUNCTION public.guard_link_type_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'active' THEN
    RAISE EXCEPTION 'Ontology:CannotDeleteActiveLinkType — an active link type cannot be deleted'
      USING HINT = 'Deprecate it first, so anything using it is warned before it disappears.';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER guard_link_type_delete
  BEFORE DELETE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_link_type_delete();

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; ont2 uuid; sp2 uuid; proj uuid; ds uuid; br uuid;
  bind_f uuid; bind_a uuid; flight uuid; alert uuid; elsewhere uuid; lt uuid;
  usr uuid := gen_random_uuid(); claims text; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '417@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m417') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m417') RETURNING id INTO sp;
  INSERT INTO public.spaces (name) VALUES ('m417 dev') RETURNING id INTO sp2;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org), (sp2, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm417', 'm417') RETURNING id INTO ont;
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp2, org, 'm417dev', 'm417 dev') RETURNING id INTO ont2;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm417', 'm417') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Flight', 'Flight') RETURNING id INTO flight;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'FlightAlert', 'Flight Alert') RETURNING id INTO alert;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont2, 'Elsewhere', 'Elsewhere') RETURNING id INTO elsewhere;

  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (flight, ds, br) RETURNING id INTO bind_f;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column,
     required, is_primary_key)
  VALUES (flight, 'flight_id', 'Flight Id', 'flightId', 'string', 'flight_id', true, true);

  -- The documented example: each Flight Alert has ONE Flight; each Flight has
  -- MANY Flight Alerts. Joined on the Flight's primary key column.
  INSERT INTO public.link_types
    (organization_id, ontology_id, source_object_type_id, target_object_type_id,
     api_name, label, source_api_name, source_label, target_api_name, target_label,
     cardinality, backing_kind, backing_table, backing_column, status)
  VALUES (org, ont, alert, flight, 'flight_alert_flight', 'Flight Alert / Flight',
          'oftFlight', 'Flight', 'flightAlerts', 'Flight Alerts',
          'many_to_one', 'foreign_key', 'flight_alerts', 'flight_id', 'experimental')
  RETURNING id INTO lt;

  -- ".get() for a one side, .all() for a many side" — derived, both directions.
  IF public.link_accessor(lt, 'source') <> 'FlightAlert.oftFlight.get()' THEN
    RAISE EXCEPTION 'Migration 417: the source accessor is %, expected FlightAlert.oftFlight.get()',
      public.link_accessor(lt, 'source');
  END IF;
  IF public.link_accessor(lt, 'target') <> 'Flight.flightAlerts.all()' THEN
    RAISE EXCEPTION 'Migration 417: the target accessor is %, expected Flight.flightAlerts.all()',
      public.link_accessor(lt, 'target');
  END IF;

  -- Each end has its own visibility.
  UPDATE public.link_types SET source_visibility = 'prominent', target_visibility = 'hidden'
   WHERE id = lt;
  IF (SELECT source_visibility || '/' || target_visibility FROM public.link_types WHERE id = lt)
     <> 'prominent/hidden' THEN
    RAISE EXCEPTION 'Migration 417: the two ends do not carry separate visibilities';
  END IF;

  -- "the 'one' side of the Cardinality is unique" — joined on a non-key column.
  BEGIN
    UPDATE public.link_types SET backing_column = 'tail_number' WHERE id = lt;
    RAISE EXCEPTION 'Migration 417: a many-to-one link joined on a non-primary-key column';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:LinkKeyIsNotAPrimaryKey%' THEN RAISE; END IF;
  END;

  -- A link may not reach into another ontology.
  BEGIN
    INSERT INTO public.link_types
      (organization_id, ontology_id, source_object_type_id, target_object_type_id,
       api_name, label, cardinality, backing_kind, backing_table, backing_column)
    VALUES (org, ont, alert, elsewhere, 'reach', 'Reach', 'many_to_one',
            'foreign_key', 't', 'c');
    RAISE EXCEPTION 'Migration 417: a link type crossed ontologies';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:LinkCrossesOntologies%' THEN RAISE; END IF;
  END;

  -- Status gates both an API-name change and deletion. A link type's status is
  -- constrained by its two ends (sync_link_type_status, migration 321): it is
  -- pulled DOWN to the weakest end, and "both ends turning active does not
  -- restore a link somebody deliberately marked experimental". So the ends go
  -- active first — which lifts the ceiling — and only then can the link.
  -- Two earlier versions of this assertion got that wrong in both directions.
  UPDATE public.object_types SET status = 'active' WHERE id IN (flight, alert);
  UPDATE public.link_types SET status = 'active' WHERE id = lt;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'active' THEN
    RAISE EXCEPTION 'Migration 417: the link would not go active with both ends active (got %)',
      (SELECT status FROM public.link_types WHERE id = lt);
  END IF;
  BEGIN
    UPDATE public.link_types SET source_api_name = 'renamed' WHERE id = lt;
    RAISE EXCEPTION 'Migration 417: an active link type''s API name was changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:ActiveLinkApiNameIsFixed%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.link_types WHERE id = lt;
    RAISE EXCEPTION 'Migration 417: an active link type was deleted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:CannotDeleteActiveLinkType%' THEN RAISE; END IF;
  END;

  -- Deprecating an end pulls the link down with it, which is the downward rule
  -- doing its job — and then it can be deleted.
  UPDATE public.object_types
     SET status = 'deprecated', deprecation_reason = 'superseded',
         deprecation_deadline = current_date + 30
   WHERE id IN (flight, alert);
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'deprecated' THEN
    RAISE EXCEPTION 'Migration 417: deprecating an end did not pull the link down (got %)',
      (SELECT status FROM public.link_types WHERE id = lt);
  END IF;
  DELETE FROM public.link_types WHERE id = lt;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.object_type_properties WHERE object_type_id = flight;
  DELETE FROM public.object_type_datasources WHERE object_type_id = flight;
  DELETE FROM public.object_types WHERE ontology_id IN (ont, ont2);
  DELETE FROM public.ontologies WHERE id IN (ont, ont2);
  DELETE FROM public.dataset_branches WHERE dataset_id = ds;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.space_organizations WHERE space_id IN (sp, sp2);
  DELETE FROM public.spaces WHERE id IN (sp, sp2);
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
