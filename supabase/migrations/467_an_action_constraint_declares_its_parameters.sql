-- An action constraint declares its parameters, and the mapping is validated.
--
-- The unbuilt half of interfaces/interface-action-type-constraints.md, found
-- by the nightly gap run; the page was read whole during the interfaces phase
-- and again before this:
--
--   "Parameter constraints define the shape of the action parameters that
--    satisfying action types must provide. Each parameter constraint
--    includes: Type… Single or list value… Display name… API name… Whether
--    the parameter must be mapped by implementing object types."
--   "Required parameter constraints must be mapped to required parameters on
--    the concrete action type."
--   "the same concrete action parameter cannot satisfy multiple parameter
--    constraints on the same action type constraint."
--   "Ontology Manager validates action type constraint mappings when you save
--    changes to the Ontology. You will not be allowed to save if: A required
--    action type constraint is not mapped… A required parameter constraint is
--    not mapped… A mapped parameter has an incompatible parameter type… The
--    same concrete action parameter is mapped to more than one parameter
--    constraint… The mapped action type constraint or parameter constraint no
--    longer exists."
--   "Action type constraints are inherited through interface extensions."
--
-- The type vocabulary is the parameter-kind list: our property base types
-- plus the three reference kinds the page names (object reference, interface
-- reference, object set). "the constraint does not itself bind to one
-- specific object type" — so the reference kinds carry no binding column.
-- Ours today: an object-reference parameter is object_type_id set with
-- base_type NULL; interface-reference and object-set parameters have no
-- representation yet, so a constraint may DECLARE those kinds but no mapping
-- can satisfy them until the kinds exist — refused by name, recorded.
-- "Single or list value" is stored; action parameters carry no list shape
-- yet, so is_list does not participate in compatibility until they do.

-- ── the parameter constraints ───────────────────────────────────────────────
CREATE TABLE public.interface_action_parameter_constraints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id uuid NOT NULL REFERENCES public.interface_action_constraints(id) ON DELETE CASCADE,
  api_name      text NOT NULL CHECK (api_name ~ '^[a-z][a-zA-Z0-9]*$'),
  display_name  text NOT NULL CHECK (length(btrim(display_name)) > 0),
  base_type     text NOT NULL CHECK (
    base_type = ANY (public.property_base_types())
    OR base_type IN ('object_reference','interface_reference','object_set')),
  is_list       boolean NOT NULL DEFAULT false,
  required      boolean NOT NULL DEFAULT true,
  position      integer NOT NULL DEFAULT 0,
  UNIQUE (constraint_id, api_name)
);

COMMENT ON TABLE public.interface_action_parameter_constraints IS
  '"The parameters that a satisfying action type must expose." The type list is the base-type vocabulary plus the page''s three reference kinds, which carry no binding — "the constraint does not itself bind to one specific object type".';

ALTER TABLE public.interface_action_parameter_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read parameter constraints in scope" ON public.interface_action_parameter_constraints
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.interface_action_constraints ac
      JOIN public.ontology_interfaces i ON i.id = ac.interface_id
     WHERE ac.id = interface_action_parameter_constraints.constraint_id
       AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins author parameter constraints" ON public.interface_action_parameter_constraints
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_action_parameter_constraints TO authenticated;

-- ── the mappings, per satisfaction ──────────────────────────────────────────
CREATE TABLE public.interface_action_parameter_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id          uuid NOT NULL,
  interface_id            uuid NOT NULL,
  constraint_id           uuid NOT NULL,
  parameter_constraint_id uuid NOT NULL REFERENCES public.interface_action_parameter_constraints(id) ON DELETE CASCADE,
  action_parameter_id     uuid NOT NULL REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  -- "The mapped action type constraint … no longer exists" is a save blocker:
  -- the mapping hangs off the satisfaction, and both fall with it.
  FOREIGN KEY (object_type_id, interface_id, constraint_id)
    REFERENCES public.interface_action_satisfactions (object_type_id, interface_id, constraint_id)
    ON DELETE CASCADE,
  -- One mapping per parameter constraint per satisfaction…
  UNIQUE (object_type_id, interface_id, constraint_id, parameter_constraint_id),
  -- …and "the same concrete action parameter cannot satisfy multiple
  -- parameter constraints on the same action type constraint."
  UNIQUE (object_type_id, interface_id, constraint_id, action_parameter_id)
);

ALTER TABLE public.interface_action_parameter_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read parameter mappings in scope" ON public.interface_action_parameter_mappings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.object_types t
     WHERE t.id = interface_action_parameter_mappings.object_type_id
       AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "admins author parameter mappings" ON public.interface_action_parameter_mappings
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_action_parameter_mappings TO authenticated;

-- ── compatibility, at the moment of mapping ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_parameter_mapping()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE pc record; ap record;
BEGIN
  SELECT * INTO pc FROM public.interface_action_parameter_constraints
   WHERE id = NEW.parameter_constraint_id;
  SELECT * INTO ap FROM public.action_type_parameters
   WHERE id = NEW.action_parameter_id;

  IF pc.base_type IN ('interface_reference','object_set') THEN
    RAISE EXCEPTION 'OntologyMetadata:ParameterKindNotRepresentable — no action parameter kind can satisfy a % constraint yet', pc.base_type;
  END IF;

  IF pc.base_type = 'object_reference' THEN
    IF ap.object_type_id IS NULL THEN
      RAISE EXCEPTION 'OntologyMetadata:IncompatibleParameterType — an object reference constraint takes an object reference parameter';
    END IF;
  ELSIF ap.base_type IS DISTINCT FROM pc.base_type THEN
    RAISE EXCEPTION 'OntologyMetadata:IncompatibleParameterType — the mapped parameter is %, the constraint wants %',
      coalesce(ap.base_type, 'an object reference'), pc.base_type;
  END IF;

  -- "Required parameter constraints must be mapped to required parameters."
  IF pc.required AND NOT ap.required THEN
    RAISE EXCEPTION 'OntologyMetadata:IncompatibleParameterType — a required parameter constraint takes a required parameter';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_parameter_mapping
  BEFORE INSERT OR UPDATE ON public.interface_action_parameter_mappings
  FOR EACH ROW EXECUTE FUNCTION public.guard_parameter_mapping();

-- ── the save-time validations, at commit like 450's conformance ─────────────
CREATE OR REPLACE FUNCTION public.assert_action_constraints_conform()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
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

  -- "A required action type constraint is not mapped by an implementing
  --  object type" — the obligation includes the inherited clause.
  SELECT string_agg(ac.api_name, ', ') INTO bad
    FROM public.interface_action_constraints ac
   WHERE ac.interface_id IN (SELECT public.interface_ancestors(impl.interface_id)
                             UNION SELECT impl.interface_id)
     AND ac.required
     AND NOT EXISTS (
       SELECT 1 FROM public.interface_action_satisfactions s
        WHERE s.object_type_id = impl.object_type_id
          AND s.interface_id = impl.interface_id
          AND s.constraint_id = ac.id);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:ActionConstraintNotSatisfied — required action type constraints are unmapped: %', bad
      USING HINT = 'Select a concrete action type on the implementing object type for each required constraint.';
  END IF;

  -- "A required parameter constraint is not mapped."
  SELECT string_agg(ac.api_name || '.' || pc.api_name, ', ') INTO bad
    FROM public.interface_action_satisfactions s
    JOIN public.interface_action_constraints ac ON ac.id = s.constraint_id
    JOIN public.interface_action_parameter_constraints pc ON pc.constraint_id = ac.id
   WHERE s.object_type_id = impl.object_type_id
     AND s.interface_id = impl.interface_id
     AND pc.required
     AND NOT EXISTS (
       SELECT 1 FROM public.interface_action_parameter_mappings m
        WHERE m.object_type_id = s.object_type_id
          AND m.interface_id = s.interface_id
          AND m.constraint_id = s.constraint_id
          AND m.parameter_constraint_id = pc.id);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:ParameterConstraintNotMapped — required parameter constraints are unmapped: %', bad
      USING HINT = 'Map each required parameter constraint to a compatible required parameter on the selected action type.';
  END IF;

  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER assert_action_constraints_conform
  AFTER INSERT OR UPDATE ON public.object_type_interfaces
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_action_constraints_conform();
CREATE CONSTRAINT TRIGGER assert_action_constraints_conform
  AFTER INSERT OR UPDATE OR DELETE ON public.interface_action_satisfactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_action_constraints_conform();

-- ── the session travels the nested parameters ───────────────────────────────
-- apply_interface's action-constraint loop learns `parameters` inside each
-- element, upserting by natural key like everything else in the session.
DO $$
DECLARE def text; needle text;
BEGIN
  def := pg_get_functiondef('public.apply_interface(jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  needle := 'ON CONFLICT (interface_id, api_name) DO UPDATE SET
      display_name = EXCLUDED.display_name, description = EXCLUDED.description,
      required = EXCLUDED.required;
  END LOOP;';
  IF (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 THEN
    RAISE EXCEPTION 'apply_interface has drifted — wire nested parameter constraints by hand';
  END IF;
  def := replace(def, needle, needle || '

  -- Nested parameter constraints, upserted by (constraint, api_name); what a
  -- listed element omits is deleted with the same absent-means-unchanged rule
  -- as every other clause: only elements CARRYING ''parameters'' are touched.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_action_constraints, ''[]''::jsonb)) LOOP
    IF e ? ''parameters'' THEN
      DELETE FROM public.interface_action_parameter_constraints pc
       USING public.interface_action_constraints ac
       WHERE ac.interface_id = t AND ac.api_name = e->>''api_name''
         AND pc.constraint_id = ac.id
         AND pc.api_name <> ALL (coalesce(
           (SELECT array_agg(x->>''api_name'') FROM jsonb_array_elements(e->''parameters'') x),
           ''{}''::text[]));
      INSERT INTO public.interface_action_parameter_constraints
        (constraint_id, api_name, display_name, base_type, is_list, required, position)
      SELECT ac.id, x->>''api_name'', x->>''display_name'', x->>''base_type'',
             coalesce((x->>''is_list'')::boolean, false),
             coalesce((x->>''required'')::boolean, true),
             coalesce((x->>''position'')::integer, 0)
        FROM public.interface_action_constraints ac,
             jsonb_array_elements(e->''parameters'') x
       WHERE ac.interface_id = t AND ac.api_name = e->>''api_name''
      ON CONFLICT (constraint_id, api_name) DO UPDATE SET
        display_name = EXCLUDED.display_name, base_type = EXCLUDED.base_type,
        is_list = EXCLUDED.is_list, required = EXCLUDED.required,
        position = EXCLUDED.position;
    END IF;
  END LOOP;');
  EXECUTE def;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; iface uuid; ac uuid; pc1 uuid; pc2 uuid;
  t uuid; act uuid; ap_req uuid; ap_opt uuid; ap_ref uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('iatc-467') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','iatc467@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'iatc467@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Iatc467');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'iatc467', 'Iatc 467', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Ticketed', 'Ticketed') RETURNING id INTO iface;
  INSERT INTO public.interface_action_constraints (interface_id, api_name, display_name, required)
  VALUES (iface, 'create-ticket', 'Create ticket', true) RETURNING id INTO ac;
  INSERT INTO public.interface_action_parameter_constraints
    (constraint_id, api_name, display_name, base_type, required)
  VALUES (ac, 'title', 'Title', 'string', true) RETURNING id INTO pc1;
  INSERT INTO public.interface_action_parameter_constraints
    (constraint_id, api_name, display_name, base_type, required)
  VALUES (ac, 'about', 'About', 'object_reference', false) RETURNING id INTO pc2;

  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Iatc467Bug', 'Bug') RETURNING id INTO t;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'iatc467-create-bug', 'Create bug') RETURNING id INTO act;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, base_type, required)
  VALUES (act, 'title', 'Title', 'string', true) RETURNING id INTO ap_req;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, base_type, required)
  VALUES (act, 'note', 'Note', 'string', false) RETURNING id INTO ap_opt;
  INSERT INTO public.action_type_parameters (action_type_id, api_name, display_name, object_type_id, required)
  VALUES (act, 'bug', 'Bug', t, false) RETURNING id INTO ap_ref;

  -- 1. A required action type constraint is not mapped: the implementation
  --    refuses at (forced) commit.
  BEGIN
    PERFORM public.implement_interface(t, iface, '[]'::jsonb);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: the unsatisfied action constraint should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ActionConstraintNotSatisfied%' THEN RAISE; END IF;
  END;

  -- 2. Satisfied but a required parameter constraint unmapped: refuses.
  BEGIN
    PERFORM public.implement_interface(t, iface, '[]'::jsonb);
    INSERT INTO public.interface_action_satisfactions
      (object_type_id, interface_id, constraint_id, action_type_id)
    VALUES (t, iface, ac, act);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: the unmapped required parameter should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ParameterConstraintNotMapped%' THEN RAISE; END IF;
  END;

  -- The full claim conforms: implementation, satisfaction, required mapping.
  PERFORM public.implement_interface(t, iface, '[]'::jsonb);
  INSERT INTO public.interface_action_satisfactions
    (object_type_id, interface_id, constraint_id, action_type_id)
  VALUES (t, iface, ac, act);
  INSERT INTO public.interface_action_parameter_mappings
    (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
  VALUES (t, iface, ac, pc1, ap_req);
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- 3. An incompatible type refuses: a required string constraint cannot take
  --    the optional parameter, nor an object reference.
  BEGIN
    INSERT INTO public.interface_action_parameter_mappings
      (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
    VALUES (t, iface, ac, pc2, ap_opt);
    RAISE EXCEPTION 'assertion failed: a string parameter cannot satisfy an object reference constraint';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%IncompatibleParameterType%' THEN RAISE; END IF;
  END;

  -- 4. "The same concrete action parameter cannot satisfy multiple parameter
  --    constraints": the second mapping of ap_req refuses on the unique.
  BEGIN
    INSERT INTO public.interface_action_parameter_mappings
      (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
    VALUES (t, iface, ac, pc2, ap_req);
    RAISE EXCEPTION 'assertion failed: one parameter cannot satisfy two constraints';
  EXCEPTION WHEN unique_violation THEN NULL;
             WHEN raise_exception THEN
               IF SQLERRM NOT LIKE '%IncompatibleParameterType%' THEN RAISE; END IF;
  END;

  -- The optional object-reference constraint maps to the reference parameter.
  INSERT INTO public.interface_action_parameter_mappings
    (object_type_id, interface_id, constraint_id, parameter_constraint_id, action_parameter_id)
  VALUES (t, iface, ac, pc2, ap_ref);

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
