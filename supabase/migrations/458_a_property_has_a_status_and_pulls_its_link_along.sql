-- A property has a status, and pulls its link along.
--
--   "Every object type, property, link type, action, or interface in the
--    Ontology has a status"           (object-link-types/metadata-statuses)
--
-- The property phase from readings/statuses-and-coupling.md, built after the
-- Decisions block was read and the questions answered from the page's own
-- tail:
--
--   "When you change an object type to `example`, all of its properties will
--    automatically become `example` also."
--   "If a foreign key property is changed to `deprecated`, its link type will
--    be changed to `deprecated`."     (and the experimental/example bullets)
--   "when marking a property `active`, the application won't change a link
--    type referencing the property as its foreign key to `active`"
--
-- Q1 is answered by absence: the page's Troubleshooting section prints
-- exactly two conflict errors — link-vs-property and link-vs-object-type —
-- and none between a property and its own object type. No such guard exists
-- here either. And the error names are Foundry's own, printed verbatim:
--
--   "OntologyMetadata:ConflictBetweenLinkTypeStatusAndPropertyTypeStatus"
--   "OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus"
--
-- 457 invented `Ontology:LinkStatusDisagrees` for the second of these one
-- migration before reading the section that names it. Corrected forward here.

-- ── the column, its vocabulary, and the documented deprecation ──────────────
ALTER TABLE public.object_type_properties
  ADD COLUMN status text NOT NULL DEFAULT 'experimental'
    CHECK (status IN ('active','experimental','deprecated','example')),
  ADD COLUMN deprecation_reason   text,
  ADD COLUMN deprecation_deadline date,
  ADD COLUMN replaced_by          text,
  ADD CONSTRAINT object_type_properties_deprecation_documented CHECK (
    status <> 'deprecated'
    OR (deprecation_reason IS NOT NULL
        AND btrim(deprecation_reason) <> ''
        AND deprecation_deadline IS NOT NULL));

COMMENT ON COLUMN public.object_type_properties.status IS
  'Developmental state — the same vocabulary as every other resource, without promoted ("object types only"). New properties start experimental.';

-- ── statuses ride the session, absent means unchanged ───────────────────────
-- New rows fall to the column default (status is not in the INSERT list), and
-- rows whose payload carries a status key get it applied per field — so a
-- client that never mentions status changes nothing.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure);
  IF (length(def) - length(replace(def, 'RETURN t;', ''))) / length('RETURN t;') <> 1 THEN
    RAISE EXCEPTION 'apply_object_type has drifted — wire the status pass by hand';
  END IF;
  def := replace(def, 'RETURN t;',
$patch$
  UPDATE public.object_type_properties p
     SET status               = e->>'status',
         deprecation_reason   = nullif(e->>'deprecation_reason', ''),
         deprecation_deadline = nullif(e->>'deprecation_deadline', '')::date,
         replaced_by          = nullif(e->>'replaced_by', '')
    FROM jsonb_array_elements(coalesce(p_properties, '[]'::jsonb)) e
   WHERE p.object_type_id = t
     AND p.property_id = e->>'property_id'
     AND (e ? 'status');

  RETURN t;
$patch$);
  EXECUTE def;
END $$;

-- ── the cascade: an object type pulls its properties ────────────────────────
CREATE OR REPLACE FUNCTION public.cascade_status_to_properties()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('experimental','example') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.object_type_properties p
       SET status = NEW.status
     WHERE p.object_type_id = NEW.id AND p.status IS DISTINCT FROM NEW.status;
  END IF;
  IF NEW.status = 'deprecated' AND OLD.status IS DISTINCT FROM 'deprecated' THEN
    UPDATE public.object_type_properties p
       SET status = 'deprecated',
           deprecation_reason = coalesce(p.deprecation_reason,
             format('Object type %s is deprecated', NEW.api_name)),
           deprecation_deadline = coalesce(p.deprecation_deadline, NEW.deprecation_deadline)
     WHERE p.object_type_id = NEW.id AND p.status IS DISTINCT FROM 'deprecated';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cascade_status_to_properties
  AFTER UPDATE OF status ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.cascade_status_to_properties();

-- ── the cascade: a foreign-key property pulls its link types ────────────────
-- The link's foreign key is (backing_object_type_id, backing_column); the
-- "foreign key property" is the property row that matches. active never
-- cascades, quoted above.
CREATE OR REPLACE FUNCTION public.cascade_property_status_to_link_types()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('experimental','example') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.link_types lt
       SET status = NEW.status
     WHERE lt.backing_object_type_id = NEW.object_type_id
       AND lt.backing_column = NEW.backing_column
       AND lt.status IS DISTINCT FROM NEW.status;
  END IF;
  IF NEW.status = 'deprecated' AND OLD.status IS DISTINCT FROM 'deprecated' THEN
    UPDATE public.link_types lt
       SET status = 'deprecated',
           deprecation_reason = coalesce(lt.deprecation_reason,
             format('Foreign key property %s is deprecated', NEW.api_name)),
           deprecation_deadline = coalesce(lt.deprecation_deadline, NEW.deprecation_deadline)
     WHERE lt.backing_object_type_id = NEW.object_type_id
       AND lt.backing_column = NEW.backing_column
       AND lt.status IS DISTINCT FROM 'deprecated';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cascade_property_status_to_link_types
  AFTER UPDATE OF status ON public.object_type_properties
  FOR EACH ROW EXECUTE FUNCTION public.cascade_property_status_to_link_types();

-- ── the guard, under Foundry's own error names ──────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_link_type_status()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE a text; b text; fk text; allowed text[];
BEGIN
  SELECT status INTO a FROM public.object_types WHERE id = NEW.source_object_type_id;
  SELECT status INTO b FROM public.object_types WHERE id = NEW.target_object_type_id;
  allowed := CASE
    WHEN 'deprecated' IN (a, b)   THEN ARRAY['deprecated']
    WHEN 'experimental' IN (a, b) THEN ARRAY['experimental']
    WHEN 'example' IN (a, b)      THEN ARRAY['example']
    ELSE ARRAY['experimental','active','deprecated']
  END;
  IF NEW.status <> ALL (allowed) THEN
    RAISE EXCEPTION 'OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus — a link between % and % object types may only be %',
      a, b, array_to_string(allowed, ' or ')
      USING HINT = 'The link type''s status follows its object types. Change theirs first.';
  END IF;

  -- "if a foreign key is deprecated, link types that reference that foreign
  -- key should also be deprecated" — and an experimental foreign key
  -- "shouldn't be marked active".
  SELECT p.status INTO fk
    FROM public.object_type_properties p
   WHERE p.object_type_id = NEW.backing_object_type_id
     AND p.backing_column = NEW.backing_column;
  IF (fk = 'deprecated' AND NEW.status <> 'deprecated')
     OR (fk = 'experimental' AND NEW.status = 'active') THEN
    RAISE EXCEPTION 'OntologyMetadata:ConflictBetweenLinkTypeStatusAndPropertyTypeStatus — the foreign key property is % and this link type may not be %',
      fk, NEW.status;
  END IF;
  RETURN NEW;
END $$;

-- The trigger from 457 already points at this function; replacing the body is
-- the whole change.

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; ta uuid; tb uuid; lt uuid; pid uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('prop-458') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','prop458@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'prop458@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Prop458');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'prop458', 'Prop 458', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Prop458A', 'A', 'active') RETURNING id INTO ta;
  INSERT INTO public.object_types (ontology_id, api_name, label, status)
  VALUES (ont, 'Prop458B', 'B', 'active') RETURNING id INTO tb;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, status)
  VALUES (ta, 'b_id', 'B Id', 'bId', 'string', 'column', 'b_id', 'active')
  RETURNING id INTO pid;
  INSERT INTO public.link_types
    (ontology_id, api_name, label, source_object_type_id, target_object_type_id,
     cardinality, backing_kind, backing_object_type_id, backing_column, status)
  VALUES (ont, 'prop458_ab', 'A to B', ta, tb, 'many_to_one', 'foreign_key', ta, 'b_id', 'active')
  RETURNING id INTO lt;

  -- New property without a status lands experimental.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
  VALUES (tb, 'plain', 'Plain', 'plain', 'string', 'column', 'plain');
  IF (SELECT status FROM public.object_type_properties
       WHERE object_type_id = tb AND property_id = 'plain') <> 'experimental' THEN
    RAISE EXCEPTION 'assertion failed: a new property should start experimental';
  END IF;

  -- The foreign-key property pulls the link to experimental; active does not pull back.
  UPDATE public.object_type_properties SET status = 'experimental' WHERE id = pid;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'experimental' THEN
    RAISE EXCEPTION 'assertion failed: the link did not follow its foreign key property';
  END IF;
  UPDATE public.object_type_properties SET status = 'active' WHERE id = pid;
  IF (SELECT status FROM public.link_types WHERE id = lt) <> 'experimental' THEN
    RAISE EXCEPTION 'assertion failed: active must never cascade';
  END IF;

  -- An experimental foreign key refuses an active link, by Foundry's name.
  BEGIN
    UPDATE public.object_type_properties SET status = 'experimental' WHERE id = pid;
    UPDATE public.link_types SET status = 'active' WHERE id = lt;
    RAISE EXCEPTION 'assertion failed: the property conflict should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ConflictBetweenLinkTypeStatusAndPropertyTypeStatus%' THEN RAISE; END IF;
  END;

  -- Example on the type pulls every property.
  UPDATE public.object_types SET status = 'example' WHERE id = tb;
  IF (SELECT count(*) FROM public.object_type_properties
       WHERE object_type_id = tb AND status <> 'example') > 0 THEN
    RAISE EXCEPTION 'assertion failed: example did not pull the properties along';
  END IF;

  -- The session pass: a property row carrying status applies it; one without
  -- leaves it alone.
  UPDATE public.object_type_properties SET status = 'active' WHERE id = pid;
  PERFORM public.apply_object_type(
    jsonb_build_object('id', ta),
    jsonb_build_array(jsonb_build_object(
      'property_id','b_id','display_name','B Id','api_name','bId',
      'base_type','string','source','column','backing_column','b_id')));
  IF (SELECT status FROM public.object_type_properties WHERE id = pid) <> 'active' THEN
    RAISE EXCEPTION 'assertion failed: a payload without status must change nothing';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
