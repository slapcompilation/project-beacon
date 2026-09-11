-- 797 — an action parameter can hold a whole object set
--
-- Reading: docs/foundry-reference/readings/object-set-parameters.md (9 pages;
-- 18 images referenced and none parsed, which that reading records as my debt
-- and bounds — every question here is settled by prose or by an api spec, and
-- the images belong to two neighbouring features this is deliberately not).
--
-- 630's header named the blocker for three of Foundry's four effect-input
-- kinds: an action here cannot declare a parameter that takes many objects, so
-- there is nothing for an object-set input to bind to. This removes that,
-- because the api publishes the missing type outright.
--
--   "A union of all the types supported by Ontology Action parameters."
--   — api/ontologies-v2-resources-action-types-get-action-type.md
--
--   - `objectSet` · object
--   — api/ontologies-v2-resources-action-types-get-action-type.md
--
-- ── THE OBJECT TYPE IS OPTIONAL, AND THAT IS NOT AN OVERSIGHT ──────────────
-- The `objectSet` member carries objectApiName and objectTypeApiName and marks
-- NEITHER required. The `object` member on the same page marks both required.
-- So an object REFERENCE parameter names its type and an object SET parameter
-- need not: a set parameter may be untyped. The CHECK below follows the page
-- rather than tidying the two into agreement.
--
-- ── THE VALUE HAS TWO PUBLISHED FORMS ──────────────────────────────────────
--
--   "| Object Set                          | string OR the object set definition"
--   — api/ontologies-v2-resources-actions-apply-action.md
--
-- The example beside that row is an object-set rid. Two forms of equal
-- standing, so both are accepted: a reference to a stored set, or the set
-- spelled out inline. readings/rid-grammar.md records what the three
-- object-set rid tokens mean and why ours is not being changed.
--
-- ── ONE PUBLISHED REFUSAL ──────────────────────────────────────────────────
--
--   "Submission criteria do not support attachment and object set parameters. These parameter types are removed from the selection panel."
--   — action-types/submission-criteria.md
--
-- A criterion cannot test one. That needs another table to check, so it is a
-- trigger rather than a CHECK. Attachments are in the same sentence and are not
-- a parameter kind here, so only the half that exists is enforced.
--
-- ── AND THE PART THAT MAKES IT REACHED ─────────────────────────────────────
-- The reading's own finding, and it moved where this file's boundary sits: no
-- documented rule kind consumes an object set. `action-types/rules` never
-- mentions one, and the two pages that discuss object sets in an action context
-- — dropdown-security and parameters-filter — are about the DROPDOWN of an
-- object reference parameter, a different feature wearing the same words.
--
-- An object-set parameter is for a FUNCTION-backed action, and ours already has
-- that rule kind. Its guest receives parameter values positionally, so a set's
-- value reaches the guest with no change — and then stops, because the host
-- reader answers only count, page and fetch-one, each keyed on an object type.
-- A guest handed a rid could do nothing with it. So the read is here too: the
-- parameter type alone would be storage nothing consumes.
--
--   "the permissions of the end user running the function determine which objects are loaded"
--   — functions/permissions.md
--
-- which is why the resolver below is INVOKER. A set whose objects the caller
-- cannot see comes back short rather than refused, exactly as the three
-- existing reads behave.
--
-- ── NO NEW RULE KIND ───────────────────────────────────────────────────────
-- Nothing in the documented rule set acts on a set, and adding one would be
-- inventing a mechanism Foundry does not have. `action_rule_kinds()` is
-- untouched.

BEGIN;

-- ── 1. the kind ─────────────────────────────────────────────────────────────

ALTER TABLE public.action_type_parameters
  DROP CONSTRAINT action_type_parameters_data_kind_check;

ALTER TABLE public.action_type_parameters
  ADD CONSTRAINT action_type_parameters_data_kind_check
  CHECK (data_kind = ANY (ARRAY['base_type', 'object', 'interfaceObject', 'objectType', 'objectSet']));

COMMENT ON CONSTRAINT action_type_parameters_data_kind_check ON public.action_type_parameters IS
  'Values from api/ontologies-v2-resources-action-types-get-action-type — the members of the union it captions as all the types supported by Ontology Action parameters, in the api''s own spelling. objectSet joined in 797.';

-- The ELSE arm of the payload CHECK returns NULL, and a CHECK passes on NULL —
-- so a new kind with no arm would silently accept any payload. Rebuilt with an
-- arm for every member, and the ELSE turned into an outright refusal so the
-- next kind cannot ride through the way this one could have.
ALTER TABLE public.action_type_parameters
  DROP CONSTRAINT action_type_parameters_payload_matches_kind;

ALTER TABLE public.action_type_parameters
  ADD CONSTRAINT action_type_parameters_payload_matches_kind
  CHECK (
    CASE data_kind
      WHEN 'base_type'       THEN base_type IS NOT NULL AND object_type_id IS NULL AND interface_id IS NULL
      WHEN 'object'          THEN object_type_id IS NOT NULL AND base_type IS NULL AND interface_id IS NULL
      WHEN 'interfaceObject' THEN base_type IS NULL AND object_type_id IS NULL
      WHEN 'objectType'      THEN base_type IS NULL AND object_type_id IS NULL AND interface_id IS NULL
      -- objectApiName and objectTypeApiName are both optional on the api's
      -- objectSet member, where the object member marks both required.
      WHEN 'objectSet'       THEN base_type IS NULL AND interface_id IS NULL
      ELSE false
    END);

COMMENT ON CONSTRAINT action_type_parameters_payload_matches_kind ON public.action_type_parameters IS
  'One arm per data_kind, and an ELSE that refuses rather than returning NULL — a CHECK passes on NULL, so the previous ELSE would have let a new kind carry any payload at all. objectSet may name an object type or not, because the api marks both of its naming fields optional.';

-- ── 2. the value's two published forms ──────────────────────────────────────

CREATE FUNCTION public.object_set_parameter_value_valid(v jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE t text;
BEGIN
  IF v IS NULL THEN RETURN false; END IF;
  t := coalesce(jsonb_typeof(v), '');

  -- "string OR the object set definition"
  IF t = 'string' THEN
    RETURN public.rid_valid(v #>> '{}') AND (v #>> '{}') LIKE 'ri.object-set.%';
  END IF;

  IF t = 'object' THEN
    -- An inline definition names the type it is over and may carry filters.
    -- The filter grammar itself is not validated here: no page read says the
    -- inline form and the exploration filter grammar are one language, and
    -- guessing that they are would be inventing the join.
    RETURN coalesce(jsonb_typeof(v -> 'objectType'), '') = 'string'
       AND (NOT (v ? 'filters') OR jsonb_typeof(v -> 'filters') = 'array');
  END IF;

  RETURN false;
END $fn$;

COMMENT ON FUNCTION public.object_set_parameter_value_valid(jsonb) IS
  'The two forms api/ontologies-v2-resources-actions-apply-action gives an Object Set parameter value equal standing: a stored set''s rid, or the definition inline. The inline filter grammar is deliberately unvalidated — no page read says it is the exploration grammar, and assuming so would invent the join.';

-- ── 3. the published refusal ────────────────────────────────────────────────

CREATE FUNCTION public.guard_criterion_parameter_kind()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE k text;
BEGIN
  FOR k IN
    SELECT p.data_kind FROM public.action_type_parameters p
     WHERE p.id IN (NEW.parameter_id, NEW.value_parameter_id)
  LOOP
    IF k = 'objectSet' THEN
      RAISE EXCEPTION 'Actions:CriterionParameterKind — submission criteria do not support object set parameters'
        USING HINT = 'The page removes these parameter types from the selection panel.';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

CREATE TRIGGER guard_criterion_parameter_kind
  BEFORE INSERT OR UPDATE ON public.action_type_submission_criteria
  FOR EACH ROW EXECUTE FUNCTION public.guard_criterion_parameter_kind();

COMMENT ON FUNCTION public.guard_criterion_parameter_kind() IS
  'Submission criteria do not support attachment and object set parameters (action-types/submission-criteria). Only the object-set half is enforced, because attachment is not a parameter kind here; enforcing a kind we do not have would be a rule with no subject.';

-- ── 4. the read that makes it reachable ─────────────────────────────────────

CREATE FUNCTION public.evaluate_object_set_by_rid(p_rid text, p_limit integer DEFAULT 100)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE s record;
BEGIN
  -- INVOKER, not definer: the objects a function loads are the ones its CALLER
  -- may see, and a definer here would quietly widen every guest.
  SELECT * INTO s FROM public.object_sets WHERE rid = p_rid;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectSetNotFound — % is not an object set you can see', p_rid;
  END IF;
  IF s.subject_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectSetHasNoSubject — % is over an interface, and a function reads object types', p_rid
      USING HINT = 'An interface-backed set needs the interface read, which is not built.';
  END IF;

  RETURN QUERY
    SELECT * FROM public.evaluate_object_set(
      s.subject_type_id, coalesce(s.filters, '[]'::jsonb), NULL,
      greatest(coalesce(p_limit, 100), 1), 0, NULL);
END $fn$;

COMMENT ON FUNCTION public.evaluate_object_set_by_rid(text, integer) IS
  'Resolves a stored object set by its rid and evaluates it as the caller — the fourth read a function''s host can perform, beside count, page and fetch-one. functions/permissions: the permissions of the end user running the function determine which objects are loaded, so this is INVOKER and a set whose objects the caller cannot see comes back short rather than refused.';

GRANT EXECUTE ON FUNCTION public.object_set_parameter_value_valid(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_object_set_by_rid(text, integer) TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; sp uuid; proj uuid; ont uuid; ot uuid; act uuid;
  par uuid; oset uuid; setrid text; n integer; k integer;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m797 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm797-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm797-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M797 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m797proj', 'm797proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M797Thing', 'Thing') RETURNING id INTO ot;
  INSERT INTO public.action_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'm797-act', 'Act') RETURNING id INTO act;

  -- 1. the kind exists, and an untyped set parameter is legal
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, data_kind, position)
  VALUES (act, 'targets', 'Targets', 'objectSet', 0) RETURNING id INTO par;

  -- and a typed one is too, because the api marks the naming fields optional
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, data_kind, object_type_id, position)
  VALUES (act, 'typedTargets', 'Typed targets', 'objectSet', ot, 1);

  -- 2. the payload arm bites: a set parameter carries no base type
  BEGIN
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, base_type, position)
    VALUES (act, 'bad', 'Bad', 'objectSet', 'string', 2);
    RAISE EXCEPTION 'an objectSet parameter with a base type was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 3. and the ELSE now refuses rather than returning NULL
  BEGIN
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, position)
    VALUES (act, 'unknown', 'Unknown', 'somethingElse', 3);
    RAISE EXCEPTION 'an unenumerated data_kind was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 4. the two published value forms, and what is neither
  IF public.object_set_parameter_value_valid(
       to_jsonb('ri.object-set.main.object-set.7b7f1d1e-0000-4000-8000-000000000001'::text)) IS NOT TRUE THEN
    RAISE EXCEPTION 'a stored set''s rid is one of the two forms';
  END IF;
  IF public.object_set_parameter_value_valid('{"objectType":"M797Thing","filters":[]}'::jsonb) IS NOT TRUE THEN
    RAISE EXCEPTION 'an inline definition is the other';
  END IF;
  IF public.object_set_parameter_value_valid(to_jsonb('ri.foundry.main.dataset.d1'::text)) IS NOT FALSE THEN
    RAISE EXCEPTION 'a rid of some other service is not an object set';
  END IF;
  IF public.object_set_parameter_value_valid('{"filters":[]}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'an inline definition names the type it is over';
  END IF;
  IF public.object_set_parameter_value_valid('42'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'a number is neither form';
  END IF;

  -- 5. submission criteria refuse the kind, by name
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, node_type, position, parameter_id, operator, value_source, static_value)
    VALUES (act, 'condition', 0, par, 'eq', 'static', '"x"'::jsonb);
    RAISE EXCEPTION 'a criterion on an object set parameter was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Actions:CriterionParameterKind%' THEN RAISE; END IF;
  END;

  -- 6. the read resolves a stored set, and says so when there is none
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M797 set', 'm797_set', ot, proj, ont, '[]'::jsonb) RETURNING id, rid INTO oset, setrid;
  SELECT count(*) INTO n FROM public.evaluate_object_set_by_rid(setrid, 10);
  IF n <> 0 THEN
    RAISE EXCEPTION 'the probe type has no objects, so the set evaluates empty; got %', n;
  END IF;
  BEGIN
    PERFORM public.evaluate_object_set_by_rid('ri.object-set.main.object-set.7b7f1d1e-0000-4000-8000-000000000009', 10);
    RAISE EXCEPTION 'an unknown set rid was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Ontology:ObjectSetNotFound%' THEN RAISE; END IF;
  END;

  -- 7. nothing gained a rule kind
  SELECT count(*) INTO k FROM public.action_rule_kinds();
  IF k <> 13 THEN
    RAISE EXCEPTION 'the rule kinds moved — expected 13, got %. No rule consumes a set, so none was added', k;
  END IF;

  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.action_type_parameters WHERE action_type_id = act;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '797 proved: the kind, its payload arm, both value forms, the criterion refusal, and the read';
END $do$;

COMMIT;
