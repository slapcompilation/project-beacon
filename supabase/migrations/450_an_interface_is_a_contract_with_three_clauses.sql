-- An interface is a contract with three clauses — properties, link
-- constraints, action constraints — and an implementation declares how it
-- satisfies each. Built from readings/interfaces-phase.md (17 decisions, all
-- ten section pages, 32 screenshots) plus actions-on-interfaces, mirrored
-- today.
--
--   "An interface is composed of interface properties, link type constraints,
--    action type constraints, and metadata"            (interfaces/_index)
--
--   "an object type must declare a mapping of existing object properties onto
--    the required interface properties"        (interfaces/implement-interface)
--
--   "An interface inherits the shared properties, link type constraints, and
--    action type constraints of the interface it extends. An interface can
--    extend any number of other interfaces."   (interfaces/extend-interface)
--
--   "Searchable: A boolean value… Searchable interfaces are limited to 50
--    implementing object types, whereas non-searchable interfaces are limited
--    to 1,000."                                (interfaces/interface-metadata)
--
-- ── DECISIONS carried from the reading, and the four defaults it left open ──
-- · Properties become ROWS (the jsonb array migrates and drops) — twelve
--   authored fields and a referenced identity make jsonb untenable; same move
--   O2 made for object types.
-- · Local vs shared is a discriminator + nullable shared_property_id, one table.
-- · The five mapping resolutions come from the wizard menu, which the prose
--   never names — `choose_existing`, `replace_existing`, `choose_backing_column`,
--   `edit_only`, `skip`. THE IDENTIFIERS ARE OURS; the menu items are theirs.
-- · `skip` is a stored row: the editor reopens it, and absence cannot say
--   "deliberately skipped".
-- · Q1 default (INFERENCE): the primary-key constraint tri-state obliges the
--   MAPPED property — `must` ⇒ it is the implementer's primary key, `cannot` ⇒
--   it is not. The one sentence: "Indicate whether a property should be a
--   primary key or cannot be a primary key."
-- · Q2 default (INFERENCE): an inherited api-name collision — override or
--   diamond — REFUSES by name rather than resolving silently.
-- · Q3 (DECLARED INVENTION): extension cycles are refused; no page mentions them.
-- · Q4 default (INFERENCE): the 50/1,000 limits are hard caps, enforced when an
--   implementation is added and when `searchable` flips.
-- · Interface-level `visibility` DROPS: the metadata reference is exhaustive by
--   its own framing, lists seven fields, and visibility is not one — while the
--   object-type and shared-property references both carry it. Per-PROPERTY
--   visibility is attested (screenshot) and stays.
-- · `promoted` is "not available for… interfaces" — the CHECK already says
--   four values; asserted below rather than re-narrowed.
-- · API names go PascalCase (reading D17), matching object types; the prose's
--   one lowercase example loses to every screenshot title.
-- · `Interface action control` is now ATTESTED (actions-on-interfaces, mirrored
--   today): "disable interface actions for specific object types… in the
--   Interface action control section" — a boolean on the implementation.
--
-- The name-matching conformance trigger (436) is DELETED, as 436 itself said
-- it would be: conformance now reads the declared mapping, at commit, so the
-- implementation row and its mappings can land in one transaction.

-- ── the interface itself ────────────────────────────────────────────────────
ALTER TABLE public.ontology_interfaces DROP COLUMN visibility CASCADE;
ALTER TABLE public.ontology_interfaces
  ADD COLUMN icon text NOT NULL DEFAULT 'cube',
  ADD COLUMN searchable boolean NOT NULL DEFAULT false;
ALTER TABLE public.ontology_interfaces DROP CONSTRAINT ontology_interfaces_api_name_check;
ALTER TABLE public.ontology_interfaces ADD CONSTRAINT ontology_interfaces_api_name_check
  CHECK (api_name ~ '^[A-Z][A-Za-z0-9]*$');

-- ── properties become rows ──────────────────────────────────────────────────
CREATE TABLE public.interface_properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_id  uuid NOT NULL REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  property_id   text NOT NULL CHECK (property_id ~ '^[a-z][a-z0-9_]*$'),
  display_name  text NOT NULL CHECK (length(btrim(display_name)) > 0),
  api_name      text NOT NULL,
  description   text NOT NULL DEFAULT '',
  base_type     text NOT NULL CHECK (base_type = ANY (public.property_base_types())),
  array_element_type text,
  -- "You can define properties locally on the interface (recommended) or use
  --  shared properties." One table, a discriminator, as object types do it.
  source        text NOT NULL DEFAULT 'local' CHECK (source IN ('local','shared')),
  shared_property_id uuid REFERENCES public.shared_properties(id) ON DELETE RESTRICT,
  -- "For each property, choose whether it is required or optional."
  required      boolean NOT NULL DEFAULT true,
  -- "Indicate whether a property should be a primary key or cannot be a
  --  primary key." Tri-state; the obligation lands on the mapped property.
  pk_constraint text NOT NULL DEFAULT 'none' CHECK (pk_constraint IN ('must','cannot','none')),
  visibility    text NOT NULL DEFAULT 'normal' CHECK (visibility IN ('prominent','normal','hidden')),
  position      integer NOT NULL DEFAULT 0,
  CHECK ((source = 'shared') = (shared_property_id IS NOT NULL)),
  CHECK ((base_type = 'array') = (array_element_type IS NOT NULL)),
  CHECK (array_element_type IS DISTINCT FROM 'array'),
  UNIQUE (interface_id, property_id),
  UNIQUE (interface_id, api_name)
);

COMMENT ON TABLE public.interface_properties IS
  'The property clause of the contract. Local or shared-backed (one table, a discriminator), required or optional, with the primary-key tri-state whose obligation lands on whatever property the implementer maps.';

-- The jsonb array migrates before it drops. {key,type} rows were all the old
-- shape could say; they become local, required properties.
INSERT INTO public.interface_properties
  (interface_id, property_id, display_name, api_name, base_type, position)
SELECT i.id, e->>'key', e->>'key', e->>'key', e->>'type', ord - 1
  FROM public.ontology_interfaces i,
       jsonb_array_elements(i.properties) WITH ORDINALITY AS a(e, ord);

ALTER TABLE public.ontology_interfaces DROP COLUMN properties CASCADE;

ALTER TABLE public.interface_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read interface properties in scope" ON public.interface_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_properties.interface_id AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins author interface properties" ON public.interface_properties
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_properties.interface_id AND public.auth_member_of_ontology(i.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_properties.interface_id AND public.auth_member_of_ontology(i.ontology_id)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_properties TO authenticated;

-- ── extensions ──────────────────────────────────────────────────────────────
CREATE TABLE public.interface_extensions (
  interface_id        uuid NOT NULL REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  parent_interface_id uuid NOT NULL REFERENCES public.ontology_interfaces(id) ON DELETE RESTRICT,
  PRIMARY KEY (interface_id, parent_interface_id),
  CHECK (interface_id <> parent_interface_id)
);

COMMENT ON TABLE public.interface_extensions IS
  '"An interface can extend any number of other interfaces." Edges, resolved transitively; cycles are refused by the guard — a declared invention, since no page mentions them.';

CREATE OR REPLACE FUNCTION public.interface_ancestors(p_interface uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH RECURSIVE up AS (
    SELECT parent_interface_id AS id FROM public.interface_extensions
     WHERE interface_id = p_interface
    UNION
    SELECT e.parent_interface_id FROM public.interface_extensions e
      JOIN up ON up.id = e.interface_id
  )
  SELECT id FROM up
$$;

CREATE OR REPLACE FUNCTION public.guard_interface_extension()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- A cycle would make "inherits" unbounded. Declared invention (Q3).
  IF NEW.interface_id IN (SELECT public.interface_ancestors(NEW.parent_interface_id))
     OR NEW.interface_id = NEW.parent_interface_id THEN
    RAISE EXCEPTION 'Ontology:InterfaceExtensionCycle — % already inherits from this interface', NEW.interface_id;
  END IF;
  -- Q2 default: an inherited api-name collision refuses rather than resolving.
  IF EXISTS (
    SELECT 1 FROM public.interface_properties mine
    JOIN public.interface_properties theirs
      ON lower(theirs.api_name) = lower(mine.api_name)
   WHERE mine.interface_id = NEW.interface_id
     AND theirs.interface_id IN (
       SELECT public.interface_ancestors(NEW.parent_interface_id)
       UNION SELECT NEW.parent_interface_id)) THEN
    RAISE EXCEPTION 'Ontology:InheritedPropertyCollision — the parent already declares a property with the same API name'
      USING HINT = 'Nothing documents overriding an inherited property; rename one side.';
  END IF;
  -- Same ontology: an interface inherits within the ontology it lives in.
  IF (SELECT ontology_id FROM public.ontology_interfaces WHERE id = NEW.interface_id)
     IS DISTINCT FROM
     (SELECT ontology_id FROM public.ontology_interfaces WHERE id = NEW.parent_interface_id) THEN
    RAISE EXCEPTION 'Ontology:ExtensionCrossesOntologies — an interface extends interfaces of its own ontology';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_interface_extension
  BEFORE INSERT OR UPDATE ON public.interface_extensions
  FOR EACH ROW EXECUTE FUNCTION public.guard_interface_extension();

ALTER TABLE public.interface_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read extensions in scope" ON public.interface_extensions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_extensions.interface_id AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins author extensions" ON public.interface_extensions
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_extensions.interface_id AND public.auth_member_of_ontology(i.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_extensions.interface_id AND public.auth_member_of_ontology(i.ontology_id)));
GRANT SELECT, INSERT, DELETE ON public.interface_extensions TO authenticated;

-- ── the two constraint clauses ──────────────────────────────────────────────
CREATE TABLE public.interface_link_constraints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  api_name     text NOT NULL,
  -- "the other side of the link" carries the one display name; do not symmetrise.
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  required     boolean NOT NULL DEFAULT true,
  -- SINGLE in one screenshot is read as a typo for ONE (reading §10.5).
  cardinality  text NOT NULL CHECK (cardinality IN ('ONE','MANY')),
  target_kind  text NOT NULL CHECK (target_kind IN ('interface','object_type')),
  target_interface_id   uuid REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  target_object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  CHECK ((target_kind = 'interface') = (target_interface_id IS NOT NULL)),
  CHECK ((target_kind = 'object_type') = (target_object_type_id IS NOT NULL)),
  UNIQUE (interface_id, api_name)
);

CREATE TABLE public.interface_action_constraints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  api_name     text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description  text NOT NULL DEFAULT '',
  required     boolean NOT NULL DEFAULT true,
  UNIQUE (interface_id, api_name)
);

COMMENT ON TABLE public.interface_action_constraints IS
  '"Action type constraints define an interface-level action contract; action rules define the edits performed" (actions-on-interfaces). Satisfaction — "you must select an action type on the object type that satisfies each required action type constraint" — is the implementation''s row below; its parameter mappings are recorded as not built.';

ALTER TABLE public.interface_link_constraints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interface_action_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read link constraints in scope" ON public.interface_link_constraints
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_link_constraints.interface_id AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins author link constraints" ON public.interface_link_constraints
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_link_constraints.interface_id AND public.auth_member_of_ontology(i.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
CREATE POLICY "read action constraints in scope" ON public.interface_action_constraints
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_action_constraints.interface_id AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins author action constraints" ON public.interface_action_constraints
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = interface_action_constraints.interface_id AND public.auth_member_of_ontology(i.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_link_constraints,
      public.interface_action_constraints TO authenticated;

-- ── the implementation: mapping, control, satisfaction ─────────────────────
ALTER TABLE public.object_type_interfaces
  -- "disable interface actions for specific object types… in the Interface
  --  action control section" (actions-on-interfaces).
  ADD COLUMN interface_actions_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE public.interface_implementation_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id        uuid NOT NULL,
  interface_id          uuid NOT NULL,
  interface_property_id uuid NOT NULL REFERENCES public.interface_properties(id) ON DELETE CASCADE,
  -- The wizard's five menu items, under our identifiers (reading D4).
  resolution            text NOT NULL CHECK (resolution IN
    ('choose_existing','replace_existing','choose_backing_column','edit_only','skip')),
  object_property_id    uuid REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  backing_column        text,
  FOREIGN KEY (object_type_id, interface_id)
    REFERENCES public.object_type_interfaces (object_type_id, interface_id) ON DELETE CASCADE,
  CHECK ((resolution IN ('choose_existing','replace_existing')) = (object_property_id IS NOT NULL)),
  CHECK ((resolution = 'choose_backing_column') = (backing_column IS NOT NULL)),
  UNIQUE (object_type_id, interface_id, interface_property_id)
);

COMMENT ON TABLE public.interface_implementation_mappings IS
  'What the implementer declared per interface property. skip is a stored row — the editor reopens it, and absence cannot say "deliberately skipped". choose_backing_column and edit_only create a property on the implementing type at apply time; that creation is the surface''s job and is validated here only as a declared intent.';

ALTER TABLE public.interface_implementation_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read mappings in scope" ON public.interface_implementation_mappings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.object_types t
     WHERE t.id = interface_implementation_mappings.object_type_id
       AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "admins author mappings" ON public.interface_implementation_mappings
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = interface_implementation_mappings.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_implementation_mappings TO authenticated;

CREATE TABLE public.interface_action_satisfactions (
  object_type_id uuid NOT NULL,
  interface_id   uuid NOT NULL,
  constraint_id  uuid NOT NULL REFERENCES public.interface_action_constraints(id) ON DELETE CASCADE,
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (object_type_id, interface_id, constraint_id),
  FOREIGN KEY (object_type_id, interface_id)
    REFERENCES public.object_type_interfaces (object_type_id, interface_id) ON DELETE CASCADE
);

ALTER TABLE public.interface_action_satisfactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read satisfactions in scope" ON public.interface_action_satisfactions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.object_types t
     WHERE t.id = interface_action_satisfactions.object_type_id
       AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "admins author satisfactions" ON public.interface_action_satisfactions
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = interface_action_satisfactions.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, DELETE ON public.interface_action_satisfactions TO authenticated;

-- ── conformance reads the mapping, at commit ────────────────────────────────
DROP TRIGGER IF EXISTS trg_assert_interface_conformance ON public.object_type_interfaces;
DROP FUNCTION IF EXISTS public.assert_interface_conformance();

CREATE OR REPLACE FUNCTION public.assert_implementation_conforms()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE bad text; impl record;
BEGIN
  SELECT * INTO impl FROM public.object_type_interfaces WHERE id = NEW.id;
  IF impl.id IS NULL THEN RETURN NULL; END IF;   -- deleted within the transaction

  -- Every REQUIRED property of the interface AND its ancestors has a non-skip
  -- mapping. "An interface inherits the shared properties… of the interface it
  -- extends", so the obligation includes the inherited clause.
  SELECT string_agg(p.api_name, ', ') INTO bad
    FROM public.interface_properties p
   WHERE p.interface_id IN (SELECT public.interface_ancestors(impl.interface_id)
                            UNION SELECT impl.interface_id)
     AND p.required
     AND NOT EXISTS (
       SELECT 1 FROM public.interface_implementation_mappings m
        WHERE m.object_type_id = impl.object_type_id
          AND m.interface_id = impl.interface_id
          AND m.interface_property_id = p.id
          AND m.resolution <> 'skip');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:DoesNotConform — required interface properties are unmapped or skipped: %', bad
      USING HINT = 'An object type must declare a mapping of existing object properties onto the required interface properties.';
  END IF;

  -- A mapped existing property must match the base type, and honour the
  -- primary-key tri-state (Q1 default, marked in the header).
  SELECT string_agg(p.api_name, ', ') INTO bad
    FROM public.interface_implementation_mappings m
    JOIN public.interface_properties p ON p.id = m.interface_property_id
    JOIN public.object_type_properties op ON op.id = m.object_property_id
   WHERE m.object_type_id = impl.object_type_id AND m.interface_id = impl.interface_id
     AND m.resolution IN ('choose_existing','replace_existing')
     AND (op.base_type IS DISTINCT FROM p.base_type
          OR (p.pk_constraint = 'must'   AND NOT op.is_primary_key)
          OR (p.pk_constraint = 'cannot' AND op.is_primary_key));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:MappingMismatch — mapped properties disagree on base type or the primary-key constraint: %', bad;
  END IF;

  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER assert_implementation_conforms
  AFTER INSERT OR UPDATE ON public.object_type_interfaces
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_implementation_conforms();

-- ── the searchable caps (Q4 default: hard, at both doors) ──────────────────
CREATE OR REPLACE FUNCTION public.guard_interface_capacity()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE i record; n int; cap int;
BEGIN
  IF TG_TABLE_NAME = 'object_type_interfaces' THEN
    SELECT * INTO i FROM public.ontology_interfaces WHERE id = NEW.interface_id;
    SELECT count(*) INTO n FROM public.object_type_interfaces
     WHERE interface_id = NEW.interface_id AND id IS DISTINCT FROM NEW.id;
    cap := CASE WHEN i.searchable THEN 50 ELSE 1000 END;
    IF n >= cap THEN
      RAISE EXCEPTION 'Ontology:TooManyImplementations — % interfaces are limited to % implementing object types',
        CASE WHEN i.searchable THEN 'searchable' ELSE 'non-searchable' END, cap;
    END IF;
    RETURN NEW;
  END IF;
  -- Flipping searchable on with more than 50 implementers refuses.
  IF NEW.searchable AND NOT OLD.searchable THEN
    SELECT count(*) INTO n FROM public.object_type_interfaces WHERE interface_id = NEW.id;
    IF n > 50 THEN
      RAISE EXCEPTION 'Ontology:TooManyImplementations — searchable interfaces are limited to 50 implementing object types, and this one has %', n;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_implementation_capacity
  BEFORE INSERT ON public.object_type_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_interface_capacity();
CREATE TRIGGER guard_searchable_capacity
  BEFORE UPDATE OF searchable ON public.ontology_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_interface_capacity();

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  base_i uuid; child_i uuid; ip uuid; opid uuid;
  usr uuid := gen_random_uuid(); before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('iface-450') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws450@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws450@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS450');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws450', 'WS 450') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws450', 'WS450') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'i450', 'i450') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Ticket','label','Ticket','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','ticket_id','display_name','Ticket Id',
      'api_name','ticketId','base_type','string','source','column','backing_column','ticket_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  SELECT id INTO opid FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'ticket_id';

  -- 1. PascalCase api names; four statuses; promoted refused.
  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Identifiable', 'Identifiable') RETURNING id INTO base_i;
  BEGIN
    UPDATE public.ontology_interfaces SET status = 'promoted' WHERE id = base_i;
    RAISE EXCEPTION 'an interface accepted promoted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.interface_properties
    (interface_id, property_id, display_name, api_name, base_type, required, pk_constraint)
  VALUES (base_i, 'identifier', 'Identifier', 'identifier', 'string', true, 'must')
  RETURNING id INTO ip;

  -- 2. An implementation with no mapping refuses at commit.
  BEGIN
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id) VALUES (t, base_i);
    SET CONSTRAINTS assert_implementation_conforms IMMEDIATE;
    RAISE EXCEPTION 'an unmapped implementation conformed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%DoesNotConform%' THEN RAISE; END IF;
  END;
  DELETE FROM public.object_type_interfaces WHERE object_type_id = t;

  -- 3. The declared mapping conforms — and the pk tri-state holds because the
  --    mapped property IS the primary key.
  INSERT INTO public.object_type_interfaces (object_type_id, interface_id) VALUES (t, base_i);
  INSERT INTO public.interface_implementation_mappings
    (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
  VALUES (t, base_i, ip, 'choose_existing', opid);
  SET CONSTRAINTS assert_implementation_conforms IMMEDIATE;

  -- 4. Extensions: a child inherits the obligation; a colliding property refuses.
  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Ticketish', 'Ticketish') RETURNING id INTO child_i;
  INSERT INTO public.interface_extensions (interface_id, parent_interface_id)
  VALUES (child_i, base_i);
  BEGIN
    INSERT INTO public.interface_extensions (interface_id, parent_interface_id)
    VALUES (base_i, child_i);
    RAISE EXCEPTION 'a cycle was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%InterfaceExtensionCycle%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.interface_properties
      (interface_id, property_id, display_name, api_name, base_type)
    VALUES (child_i, 'identifier2', 'Identifier', 'identifier', 'string');
    INSERT INTO public.interface_extensions (interface_id, parent_interface_id)
    SELECT child_i, base_i WHERE NOT EXISTS (
      SELECT 1 FROM public.interface_extensions
       WHERE interface_id = child_i AND parent_interface_id = base_i);
    -- the collision is checked on extension writes; re-fire it:
    DELETE FROM public.interface_extensions WHERE interface_id = child_i;
    INSERT INTO public.interface_extensions (interface_id, parent_interface_id)
    VALUES (child_i, base_i);
    RAISE EXCEPTION 'an inherited api-name collision was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%InheritedPropertyCollision%' THEN RAISE; END IF;
  END;

  -- 5. The searchable cap refuses at the flip when implementers exceed it.
  UPDATE public.ontology_interfaces SET searchable = true WHERE id = base_i;  -- 1 implementer: fine
  IF (SELECT searchable FROM public.ontology_interfaces WHERE id = base_i) IS NOT TRUE THEN
    RAISE EXCEPTION 'searchable did not flip with one implementer';
  END IF;

  -- 6. The old jsonb properties migrated as rows (none live, but the shape holds).
  SELECT count(*) INTO n FROM public.interface_properties WHERE interface_id = base_i;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one interface property, found %', n; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '450: the contract has three clauses, a mapping, an inheritance and two caps';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
