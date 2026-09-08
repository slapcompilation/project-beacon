-- A concrete link satisfies the constraint, and a constraint may have several.
--
-- 450 built `interface_link_constraints` — the contract clause. Nothing has
-- ever recorded which concrete link *keeps* it. That gap is why the two
-- interface link rule kinds are still not executable, and the registry's own
-- note gets the reason wrong: it says "a link instance store does not exist
-- yet, and the rule must name an interface link constraint, which no rule
-- column points at". The store has existed since 750, and the rule column is
-- the smaller half. The missing piece is this table. Both halves of the note
-- are corrected in the migration that flips the kinds; this one builds what
-- they will read.
--
-- The obligation is the interface's, and the page states it as a precondition
-- of implementing at all:

--   "Once defined, an interface can be implemented by any object type that
--    conforms to the interface definition. This means that object types must
--    have properties that satisfy the interface's required properties, links
--    that satisfy all required link type constraints, and action types that
--    satisfy all required action type constraints defined on the interface."
--   — interfaces/implement-interface.md

-- and the wizard step that discharges it is step 3 of five:

--   "If any required link type constraints are declared on the interface, you
--    must select a link type on the object type that satisfies each required
--    link type constraint. You can also optionally provide a link mapping for
--    any non-required link type constraints. You can choose an existing link
--    type or create a new one to satisfy each constraint."
--   — interfaces/implement-interface.md

-- The image I read for this is implement-link-type-constraint.png, and it
-- carries the shape the prose leaves out: a dialog titled *Implement an
-- Interface* whose rail is four steps. STEP 4 is *Satisfy link type
-- constraints*, and under it sits one row per constraint whose menu offers
-- *Select link type*, *Create new link type* and *Skip*:

--   "Choose link types that satisfy the link type constraints on the interface"
--   — interfaces/images/implement-link-type-constraint.png

-- So satisfaction is DECLARED by the implementer, not discovered by matching
-- ends — which is the whole reason a table is needed rather than a query. That
-- capture predates interface action type constraints: its rail has four steps
-- where the prose has five, and no action step. I read it only for the link
-- step it does show.
--
-- ── one constraint, SEVERAL links ──────────────────────────────────────────
--
-- The api settles what the prose's *a link type* leaves ambiguous, and prints
-- the contrast against actions in the same block. An implementation carries
--   `links` · map
--     `InterfaceLinkTypeApiName` · string · required
--     `array` · list · required
--       `LinkTypeApiName` · string · required
-- while immediately below it
--   `actionTypes` · map
--     `InterfaceActionTypeConstraintApiName` · string · required
--     `ActionTypeApiName` · string · required
-- both in
-- api/v2/ontologies-v2-resources/object-types-get-object-type-full-metadata.md
--
-- A LIST for links; a single api name for actions. So this table's key carries
-- `link_type_id` where 450's `interface_action_satisfactions` stops at the
-- constraint. That is not a stylistic choice: it is what makes the actions
-- page's two warnings mean anything —

--   "If there are multiple concrete link implementations on the object type
--    for the link constraint, the action will fail."
--   — action-types/actions-on-interfaces.md

--   "If there are multiple concrete link implementations on the object type
--    for the link constraint, the action will attempt to delete all the
--    concrete link implementations."
--   — action-types/actions-on-interfaces.md

-- Keyed like the action table, *multiple* would be unreachable and both
-- sentences would describe a state our schema forbids.
--
-- ── the required default was ours, and it was wrong ────────────────────────
--
-- 450 gave `required` DEFAULT true. Its property clause cites a sentence for
-- that default — *For each property, choose whether it is required or
-- optional* — while the link clause cites nothing and took the property's
-- default by symmetry. Two witnesses say otherwise. The prose's worked example:

--   "the `Facility` interface declares an optional one-to-many link type
--    constraint between any object that implements the `Facility` interface and
--    the `Airline` object type"
--   — interfaces/interface-link-types-overview.md

-- and the configuration modal create-link-type-constraint-modal.png, which I
-- read field by field: Link target (Interface | Object type), Target Object
-- Type, Cardinality (ONE | MANY), Display name, API name, and a Requiredness
-- section whose single toggle is OFF, labelled:

--   "Object types will not be able to Implement this interface unless a link
--    type that satisfies this constraint is provided."
--   — interfaces/images/create-link-type-constraint-modal.png

-- That label is also the exact statement of the guard below, which is why the
-- default and the guard land together: turning the obligation on while every
-- constraint defaults to required would make an unsatisfiable demand of every
-- interface that already has a link clause. There are no such rows in this
-- database today, so nothing is migrated — but the fixtures build them, and one
-- of them omits `required` precisely because it does not want the obligation.
--
-- ── what this does NOT do ──────────────────────────────────────────────────
--
-- Cardinality compatibility is a WARNING, not a refusal. The page says a ONE
-- constraint means each implementing object "should link to one object of the
-- target type" — should, not must — and CLAUDE.md's ladder puts *warned* in
-- `ontology_warnings()`. It does not block a save.
--
-- Satisfactions do not travel through `ontology_resource_row`: its object_type
-- arm carries `properties` and `datasources` only, so interface
-- implementations and their action satisfactions already live outside the
-- working-state round trip. Link satisfactions get exactly the treatment the
-- action ones already get, and nothing here changes that. Recorded because it
-- looks like an omission and is instead the existing contract.

-- ── 1. the satisfaction ────────────────────────────────────────────────────

CREATE TABLE public.interface_link_satisfactions (
  object_type_id uuid NOT NULL,
  interface_id   uuid NOT NULL,
  constraint_id  uuid NOT NULL REFERENCES public.interface_link_constraints(id) ON DELETE CASCADE,
  -- RESTRICT, like the action table's action_type_id: dropping a link type
  -- that is keeping a contract should say so rather than quietly break it.
  link_type_id   uuid NOT NULL REFERENCES public.link_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (object_type_id, interface_id, constraint_id, link_type_id),
  FOREIGN KEY (object_type_id, interface_id)
    REFERENCES public.object_type_interfaces(object_type_id, interface_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.interface_link_satisfactions IS
  'Which concrete link types satisfy each interface link type constraint, per implementing object type. A SET, not a single value: the api types an implementation''s `links` as a map from InterfaceLinkTypeApiName to a list of LinkTypeApiName, where `actionTypes` maps to one api name.';

-- 464: every foreign key has an index. The primary key covers the composite
-- one by its leading columns; these two cover the rest.
CREATE INDEX interface_link_satisfactions_constraint_idx
  ON public.interface_link_satisfactions (constraint_id);
CREATE INDEX interface_link_satisfactions_link_type_idx
  ON public.interface_link_satisfactions (link_type_id);

ALTER TABLE public.interface_link_satisfactions ENABLE ROW LEVEL SECURITY;

-- The same two policies the action satisfactions carry, word for word in
-- shape: read follows ontology membership, authoring follows the role. The
-- helpers are wrapped in scalar subqueries because an unwrapped one runs per
-- row (619).
CREATE POLICY "read link satisfactions in scope" ON public.interface_link_satisfactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.object_types t
                  WHERE t.id = interface_link_satisfactions.object_type_id
                    AND public.auth_in_ontology(t.ontology_id)));

CREATE POLICY "admins author link satisfactions" ON public.interface_link_satisfactions
  FOR ALL TO authenticated
  USING ((SELECT public.auth_role()) IN ('owner', 'admin')
         AND EXISTS (SELECT 1 FROM public.object_types t
                      WHERE t.id = interface_link_satisfactions.object_type_id
                        AND public.auth_member_of_ontology(t.ontology_id)))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
              AND EXISTS (SELECT 1 FROM public.object_types t
                           WHERE t.id = interface_link_satisfactions.object_type_id
                             AND public.auth_member_of_ontology(t.ontology_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_link_satisfactions
  TO authenticated, service_role;

-- ── 2. a named link must actually satisfy the constraint ───────────────────

CREATE OR REPLACE FUNCTION public.guard_link_satisfaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE lk record; c record; far uuid;
BEGIN
  SELECT * INTO c FROM public.interface_link_constraints WHERE id = NEW.constraint_id;
  SELECT * INTO lk FROM public.link_types WHERE id = NEW.link_type_id;
  IF c.id IS NULL OR lk.id IS NULL THEN RETURN NULL; END IF;  -- gone within the txn

  -- The constraint is a clause of the interface being implemented, or of one
  -- of its ancestors: "action type constraints are inherited through interface
  -- extensions" holds of the link clause the same way, and 467 already reads
  -- the ancestor walk for actions.
  IF c.interface_id <> ALL (ARRAY(SELECT public.interface_ancestors(NEW.interface_id)
                                  UNION SELECT NEW.interface_id)) THEN
    RAISE EXCEPTION 'Ontology:LinkConstraintNotOnThisInterface — "%" is not a link type constraint of this interface or its ancestors',
      c.api_name;
  END IF;

  -- One end of the concrete link is the implementing object type; the other is
  -- the side the constraint names. "if the implementing object type (for
  -- example `Airport`) has a concrete link type to the `Airlines` object type,
  -- that link can be accessed through the interface link type API name."
  IF lk.source_object_type_id = NEW.object_type_id THEN
    far := lk.target_object_type_id;
  ELSIF lk.target_object_type_id = NEW.object_type_id THEN
    far := lk.source_object_type_id;
  ELSE
    RAISE EXCEPTION 'Ontology:LinkDoesNotTouchTheImplementer — "%" has no end on %',
      lk.api_name, (SELECT api_name FROM public.object_types WHERE id = NEW.object_type_id);
  END IF;

  IF c.target_kind = 'object_type' THEN
    IF far <> c.target_object_type_id THEN
      RAISE EXCEPTION 'Ontology:LinkTargetDoesNotSatisfyConstraint — "%" links to %, and "%" names %',
        lk.api_name, (SELECT api_name FROM public.object_types WHERE id = far),
        c.api_name, (SELECT api_name FROM public.object_types WHERE id = c.target_object_type_id);
    END IF;
  ELSE
    -- The far end implements the target interface, and inheritance counts
    -- there too:
    --   "From there, you can define a concrete link type from `Airport` to
    --    `Flight Alert` to satisfy the `Facility` interface’s link type
    --    constraint."
    --   — interfaces/interface-link-types-overview.md
    IF NOT EXISTS (SELECT 1 FROM public.object_type_interfaces oti
                    WHERE oti.object_type_id = far
                      AND c.target_interface_id = ANY (ARRAY(
                            SELECT public.interface_ancestors(oti.interface_id)
                            UNION SELECT oti.interface_id))) THEN
      RAISE EXCEPTION 'Ontology:LinkTargetDoesNotImplement — "%" links to %, which does not implement %',
        lk.api_name, (SELECT api_name FROM public.object_types WHERE id = far),
        (SELECT api_name FROM public.ontology_interfaces WHERE id = c.target_interface_id);
    END IF;
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.guard_link_satisfaction() IS
  'A link type named as satisfying an interface link type constraint must have an end on the implementing object type and its other end must be what the constraint names — the object type itself, or any type implementing the target interface. A CONSTRAINT TRIGGER, so the foreign keys answer for a bad id before this answers for a bad shape (766).';

CREATE CONSTRAINT TRIGGER guard_link_satisfaction
AFTER INSERT OR UPDATE ON public.interface_link_satisfactions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_link_satisfaction();

-- ── 3. the requiredness default, corrected forward ─────────────────────────

ALTER TABLE public.interface_link_constraints ALTER COLUMN required SET DEFAULT false;

COMMENT ON COLUMN public.interface_link_constraints.required IS
  'Whether an object type must satisfy this clause to implement the interface: "Object types will not be able to Implement this interface unless a link type that satisfies this constraint is provided." Defaults to false since 768 — 450 inherited true from the property clause, which cites a sentence for it; the link modal''s toggle is off and the page''s worked example is "an optional one-to-many link type constraint".';

-- `apply_interface` carries the same default in a coalesce, and the property
-- arm above it is byte-identical on that line — so the anchor spans the two
-- lines around it, which only the link arm has.
DO $$
DECLARE src text; anchor text; repl text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_interface(jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  anchor :=
'    VALUES (t, e->>''api_name'', e->>''display_name'',
            coalesce((e->>''required'')::boolean, true),
            e->>''cardinality'', e->>''target_kind'',';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected the link-constraint VALUES anchor exactly once, found %',
      (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  END IF;
  repl := replace(anchor, 'coalesce((e->>''required'')::boolean, true),',
                          'coalesce((e->>''required'')::boolean, false),');
  EXECUTE replace(src, anchor, repl);
END $$;

-- ── 4. the obligation the toggle describes ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.assert_link_constraints_conform()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE impl record; bad text;
BEGIN
  IF TG_TABLE_NAME = 'object_type_interfaces' THEN
    SELECT object_type_id, interface_id INTO impl
      FROM public.object_type_interfaces WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT object_type_id, interface_id INTO impl
      FROM public.object_type_interfaces
     WHERE object_type_id = OLD.object_type_id AND interface_id = OLD.interface_id;
  ELSE
    SELECT object_type_id, interface_id INTO impl
      FROM public.object_type_interfaces
     WHERE object_type_id = NEW.object_type_id AND interface_id = NEW.interface_id;
  END IF;
  IF impl.object_type_id IS NULL THEN RETURN NULL; END IF;  -- gone within the txn

  -- The toggle's own sentence. The obligation includes the inherited clause,
  -- as the action one does:
  --   "Object types will not be able to Implement this interface unless a link
  --    type that satisfies this constraint is provided."
  --   — interfaces/images/create-link-type-constraint-modal.png
  SELECT string_agg(lc.api_name, ', ') INTO bad
    FROM public.interface_link_constraints lc
   WHERE lc.interface_id IN (SELECT public.interface_ancestors(impl.interface_id)
                             UNION SELECT impl.interface_id)
     AND lc.required
     AND NOT EXISTS (
       SELECT 1 FROM public.interface_link_satisfactions s
        WHERE s.object_type_id = impl.object_type_id
          AND s.interface_id = impl.interface_id
          AND s.constraint_id = lc.id);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:LinkConstraintNotSatisfied — required link type constraints are unsatisfied: %', bad
      USING HINT = 'Select a link type on the implementing object type for each required constraint, or create one.';
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.assert_link_constraints_conform() IS
  'The requiredness toggle''s own sentence, enforced: an object type cannot implement an interface while a required link type constraint has no satisfying link. DEFERRED, so the implementation and its satisfactions may land in either order within one transaction.';

CREATE CONSTRAINT TRIGGER assert_link_constraints_conform
AFTER INSERT OR UPDATE ON public.object_type_interfaces
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_link_constraints_conform();

CREATE CONSTRAINT TRIGGER assert_link_constraints_conform
AFTER INSERT OR UPDATE OR DELETE ON public.interface_link_satisfactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_link_constraints_conform();

-- ── 5. the door the wizard's step goes through ─────────────────────────────

CREATE OR REPLACE FUNCTION public.satisfy_link_constraint(
  p_object_type uuid, p_interface uuid, p_constraint uuid, p_link_types uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  -- One row per constraint in the wizard, and its value is the whole set — so
  -- this replaces rather than adds. "Skip" is the empty array.
  DELETE FROM public.interface_link_satisfactions
   WHERE object_type_id = p_object_type AND interface_id = p_interface
     AND constraint_id = p_constraint;

  INSERT INTO public.interface_link_satisfactions
    (object_type_id, interface_id, constraint_id, link_type_id)
  SELECT p_object_type, p_interface, p_constraint, l
    FROM unnest(coalesce(p_link_types, '{}'::uuid[])) l;
END $$;

COMMENT ON FUNCTION public.satisfy_link_constraint(uuid, uuid, uuid, uuid[]) IS
  'Step 3 of implementing an interface: "you must select a link type on the object type that satisfies each required link type constraint". Takes the whole set for one constraint, because the api types an implementation''s links as a list; the empty array is the wizard''s "Skip".';

REVOKE ALL ON FUNCTION public.satisfy_link_constraint(uuid, uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.satisfy_link_constraint(uuid, uuid, uuid, uuid[])
  TO authenticated, service_role;

-- ── 6. cardinality is advice, not a refusal ────────────────────────────────

DO $$
DECLARE src text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_warnings()'::regprocedure), chr(13), '');
  -- 757's arm is the last in the union; append after its final predicate.
  anchor :=
'   WHERE l.backing_kind IS DISTINCT FROM ''foreign_key''
     AND l.backing_kind IS DISTINCT FROM ''join_table''
     AND l.backing_kind IS DISTINCT FROM ''object_backed''';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected 757''s warning arm exactly once, found %',
      (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  END IF;
  EXECUTE replace(src, anchor, anchor || '

  UNION ALL

  -- "A `ONE` cardinality indicates that each object implementing the interface
  -- should link to one object of the target type." Should, not must — so the
  -- ladder puts it here. Which concrete cardinalities can return more than one
  -- depends on which end the implementer is.
  SELECT t.api_name, ''interface'', lc.api_name,
         format(''A ONE link type constraint is satisfied by "%s", which is %s and can return more than one object'',
                l.api_name, l.cardinality)
    FROM public.interface_link_satisfactions s
    JOIN public.interface_link_constraints lc ON lc.id = s.constraint_id
    JOIN public.link_types l ON l.id = s.link_type_id
    JOIN public.object_types t ON t.id = s.object_type_id
   WHERE lc.cardinality = ''ONE''
     AND ((l.source_object_type_id = s.object_type_id
           AND l.cardinality IN (''one_to_many'', ''many_to_many''))
       OR (l.target_object_type_id = s.object_type_id
           AND l.cardinality IN (''many_to_one'', ''many_to_many'')))');
END $$;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid;
  airport uuid; airline uuid; alert uuid; other uuid;
  facility uuid; alert_iface uuid;
  c_obj uuid; c_iface uuid; c_req uuid;
  lk_ok uuid; lk_far uuid; lk_alert uuid; lk_many uuid;
  impl uuid; err text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m768 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm768-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm768-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M768 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm768p', 'm768 probe') RETURNING id INTO proj;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Airport', 'Airport') RETURNING id INTO airport;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Airline', 'Airline') RETURNING id INTO airline;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Alert', 'Flight Alert') RETURNING id INTO alert;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Other', 'Other') RETURNING id INTO other;

  INSERT INTO public.ontology_interfaces (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Facility', 'Facility') RETURNING id INTO facility;
  INSERT INTO public.ontology_interfaces (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M768Alertable', 'Alert') RETURNING id INTO alert_iface;

  -- the page's own two examples: Facility → Airlines (object type), and
  -- Facility → Alert (interface).
  INSERT INTO public.interface_link_constraints
    (interface_id, api_name, display_name, cardinality, target_kind, target_object_type_id)
  VALUES (facility, 'airlines', 'Airlines', 'MANY', 'object_type', airline)
  RETURNING id INTO c_obj;
  INSERT INTO public.interface_link_constraints
    (interface_id, api_name, display_name, cardinality, target_kind, target_interface_id)
  VALUES (facility, 'alerts', 'Alerts', 'MANY', 'interface', alert_iface)
  RETURNING id INTO c_iface;

  -- the default is now false: the row above named no requiredness.
  IF (SELECT required FROM public.interface_link_constraints WHERE id = c_obj) THEN
    RAISE EXCEPTION 'a constraint that names no requiredness should be optional';
  END IF;

  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id,
                                 target_object_type_id, api_name, label, cardinality)
  VALUES (ont, proj, airport, airline, 'm768-serves', 'Serves', 'one_to_many')
  RETURNING id INTO lk_ok;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id,
                                 target_object_type_id, api_name, label, cardinality)
  VALUES (ont, proj, airport, other, 'm768-elsewhere', 'Elsewhere', 'one_to_many')
  RETURNING id INTO lk_far;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id,
                                 target_object_type_id, api_name, label, cardinality)
  VALUES (ont, proj, airport, alert, 'm768-alerts', 'Alerts', 'one_to_many')
  RETURNING id INTO lk_alert;

  SELECT public.implement_interface(airport, facility) INTO impl;
  INSERT INTO public.object_type_interfaces (object_type_id, interface_id)
  VALUES (alert, alert_iface);

  -- the happy path, through the door the wizard uses
  PERFORM public.satisfy_link_constraint(airport, facility, c_obj, ARRAY[lk_ok]);
  IF (SELECT count(*) FROM public.interface_link_satisfactions
       WHERE object_type_id = airport AND constraint_id = c_obj) <> 1 THEN
    RAISE EXCEPTION 'the satisfaction should have landed';
  END IF;

  -- SEVERAL, which is the whole point of the key
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id,
                                 target_object_type_id, api_name, label, cardinality)
  VALUES (ont, proj, airport, airline, 'm768-also-serves', 'Also serves', 'one_to_many')
  RETURNING id INTO lk_many;
  PERFORM public.satisfy_link_constraint(airport, facility, c_obj, ARRAY[lk_ok, lk_many]);
  SELECT count(*) INTO n FROM public.interface_link_satisfactions
   WHERE object_type_id = airport AND constraint_id = c_obj;
  IF n <> 2 THEN
    RAISE EXCEPTION 'a constraint takes several concrete links, got %', n;
  END IF;

  -- an interface-targeted constraint is satisfied by a link to an implementer
  PERFORM public.satisfy_link_constraint(airport, facility, c_iface, ARRAY[lk_alert]);

  -- and the guard answers each of its three questions
  BEGIN
    PERFORM public.satisfy_link_constraint(airport, facility, c_obj, ARRAY[lk_far]);
    RAISE EXCEPTION 'a link to the wrong object type should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:LinkTargetDoesNotSatisfyConstraint%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.satisfy_link_constraint(airport, facility, c_iface, ARRAY[lk_far]);
    RAISE EXCEPTION 'a link to a type that does not implement the target should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:LinkTargetDoesNotImplement%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id,
                                   target_object_type_id, api_name, label, cardinality)
    VALUES (ont, proj, alert, other, 'm768-untouched', 'Untouched', 'one_to_many');
    PERFORM public.satisfy_link_constraint(airport, facility, c_obj,
      ARRAY[(SELECT id FROM public.link_types WHERE api_name = 'm768-untouched')]);
    RAISE EXCEPTION 'a link with no end on the implementer should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Ontology:LinkDoesNotTouchTheImplementer%' THEN RAISE; END IF;
  END;

  -- the obligation: a REQUIRED clause blocks an implementation that skips it,
  -- and the deferred trigger lets the two land in either order.
  INSERT INTO public.interface_link_constraints
    (interface_id, api_name, display_name, required, cardinality, target_kind, target_object_type_id)
  VALUES (facility, 'mandatory', 'Mandatory', true, 'MANY', 'object_type', airline)
  RETURNING id INTO c_req;

  BEGIN
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id)
    VALUES (other, facility);
    -- DEFERRED: it fires at commit, so force it here.
    SET CONSTRAINTS assert_link_constraints_conform IMMEDIATE;
    RAISE EXCEPTION 'implementing while a required clause is unsatisfied should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'OntologyMetadata:LinkConstraintNotSatisfied%' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;

  -- ONE against a link that can return many is a warning, not a refusal
  UPDATE public.interface_link_constraints SET cardinality = 'ONE' WHERE id = c_obj;
  IF NOT EXISTS (SELECT 1 FROM public.ontology_warnings() w
                  WHERE w.scope = 'interface' AND w.subject = 'airlines'
                    AND w.problem LIKE '%can return more than one object%') THEN
    RAISE EXCEPTION 'a ONE constraint kept by a one_to_many link should warn';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ontology_violations() v WHERE v.subject = 'airlines') THEN
    RAISE EXCEPTION 'and it should not block the save';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0768', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0768' THEN
  NULL;
END $$;
