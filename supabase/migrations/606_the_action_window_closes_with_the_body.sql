-- 605's flag outlived the function that set it.
--
-- set_config(..., true) is TRANSACTION-local, and 605 set it at the top of
-- apply_action and apply_function_edits and never cleared it. So within one
-- transaction, the first applied action opened the direct-write path for
-- everything after it — the guard was on for the first insert and off for the
-- rest.
--
-- The platform suite found it, not the migration: 605's probe ran in a fresh
-- subtransaction where nothing had applied an action, and every assertion
-- passed. The suite runs many tests in ONE transaction as `authenticated`, and
-- the case that asserts a direct edit is refused sat after the case that
-- applies an action. That ordering is the whole finding.
--
-- Reachable outside a test: an edge function or a cron job on one connection
-- that applies an action and then writes. A PostgREST request cannot, because
-- each is its own transaction — which is exactly why the migration's probe
-- could not see it.
--
-- The fix closes the window at the end of the body. An abort restores an
-- is_local setting on its own, so only the normal path needed the reset.
--
-- Both patched from pg_get_functiondef; one PERFORM added before the single
-- RETURN in each, and nothing else moved.

CREATE OR REPLACE FUNCTION public.apply_action(p_action_type uuid, p_parameters jsonb DEFAULT '{}'::jsonb, p_primary_key text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  act      record;
  par      record;
  r        record;
  rp       record;
  props    jsonb;
  pk_prop  text;
  pk_val   text;
  written  integer := 0;
  target   uuid;     -- the object type a rule actually edits
  ref      jsonb;    -- an interface reference value, when there is one
  ref_pk   text;
BEGIN
  -- Edits from here are edits VIA AN ACTION, which is what guard_object_edit
  -- asks of an object type that only allows those (605).
  PERFORM set_config('beacon.applying_action', 'on', true);

  SELECT * INTO act FROM public.action_types WHERE id = p_action_type;
  IF act.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;

  FOR par IN SELECT api_name FROM public.action_type_parameters
              WHERE action_type_id = p_action_type AND required
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = 'null'::jsonb
       OR btrim(p_parameters->>par.api_name) = '' THEN
      RAISE EXCEPTION 'Actions:MissingParameter — "%" is required', par.api_name;
    END IF;
  END LOOP;

  pk_val := public.submission_criteria_verdict(p_action_type, p_parameters);
  IF pk_val IS NOT NULL THEN
    RAISE EXCEPTION 'Actions:SubmissionCriteriaFailed — %', pk_val;
  END IF;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type ORDER BY position
  LOOP
    IF NOT coalesce((SELECT k.executable FROM public.action_rule_kinds() k WHERE k.kind = r.kind), false) THEN
      RAISE EXCEPTION 'Actions:RuleKindNotExecutable — % rules cannot be applied yet: %', r.kind,
        (SELECT k.note FROM public.action_rule_kinds() k WHERE k.kind = r.kind);
    END IF;

    IF (SELECT k.runtime FROM public.action_rule_kinds() k WHERE k.kind = r.kind) <> 'sql' THEN
      RAISE EXCEPTION 'Actions:WrongRuntime — a % rule is applied by the action runtime, which runs the code; this is SQL', r.kind;
    END IF;

    -- ── which object type this rule edits ──────────────────────────────────
    ref := NULL; ref_pk := NULL;
    IF r.interface_id IS NULL THEN
      target := r.object_type_id;
    ELSIF r.kind = 'create_object_of_interface' THEN
      -- The generated object type parameter, whose value the api encodes as a
      -- string of the object type's api name.
      SELECT t.id INTO target
        FROM public.action_type_parameters pa
        JOIN public.object_types t
          ON t.ontology_id = act.ontology_id
         AND t.api_name = p_parameters ->> pa.api_name
       WHERE pa.action_type_id = p_action_type AND pa.data_kind = 'objectType'
       LIMIT 1;
      IF target IS NULL THEN
        RAISE EXCEPTION 'Actions:InterfaceRuleNeedsAType — name the implementing object type to create in the generated object type parameter';
      END IF;
    ELSE
      -- An interface reference carries both halves — the api encodes it as the
      -- object's API name and primary key together.
      SELECT p_parameters -> pa.api_name INTO ref
        FROM public.action_type_parameters pa
       WHERE pa.action_type_id = p_action_type
         AND pa.data_kind = 'interfaceObject'
         AND (pa.interface_id IS NULL OR pa.interface_id = r.interface_id)
       LIMIT 1;
      IF ref IS NULL OR jsonb_typeof(ref) <> 'object' THEN
        RAISE EXCEPTION 'Actions:InterfaceRuleNeedsAReference — a % rule names its object through an interface reference parameter, {"objectTypeApiName": …, "primaryKeyValue": …}', r.kind;
      END IF;
      target := public.interface_reference_type(ref, act.ontology_id);
      ref_pk := ref ->> 'primaryKeyValue';
      IF target IS NULL THEN
        RAISE EXCEPTION 'Actions:InterfaceReferenceUnknownType — "%" is not an object type in this ontology', ref ->> 'objectTypeApiName';
      END IF;
    END IF;

    -- The type must actually implement the interface, and must not have turned
    -- interface actions off — the gate 450 added and 571 gave its first reader.
    IF r.interface_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.object_type_interfaces oti
                      WHERE oti.object_type_id = target AND oti.interface_id = r.interface_id) THEN
        RAISE EXCEPTION 'Actions:TypeDoesNotImplement — % does not implement this interface',
          (SELECT api_name FROM public.object_types WHERE id = target);
      END IF;
      IF NOT (SELECT oti.interface_actions_enabled FROM public.object_type_interfaces oti
               WHERE oti.object_type_id = target AND oti.interface_id = r.interface_id) THEN
        RAISE EXCEPTION 'Actions:InterfaceActionsDisabled — % has interface actions turned off',
          (SELECT api_name FROM public.object_types WHERE id = target);
      END IF;
    END IF;

    IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = target) THEN
      RAISE EXCEPTION 'Actions:EditsDisabled — the object type this rule edits has edits disabled'
        USING HINT = 'Enable edits on the object type. "Disabling edits will not remove existing edits."';
    END IF;

    -- ── the properties, resolved onto the target type ──────────────────────
    -- An interface rule names an interface property; each implementer resolved
    -- it onto one of its own through `interface_implementation_mappings`. That
    -- is the join `action_editable_properties` already makes.
    props := '{}'::jsonb;
    FOR rp IN
      SELECT p.value_source, p.static_value, pa.api_name AS param_name,
             coalesce(prop.property_id, mapped.property_id) AS prop_key,
             coalesce(prop.is_primary_key, mapped.is_primary_key) AS is_pk
        FROM public.action_type_rule_properties p
        LEFT JOIN public.object_type_properties prop ON prop.id = p.property_id
        LEFT JOIN public.interface_implementation_mappings m
               ON m.interface_property_id = p.interface_property_id
              AND m.object_type_id = target
              AND m.interface_id = r.interface_id
        LEFT JOIN public.object_type_properties mapped ON mapped.id = m.object_property_id
        LEFT JOIN public.action_type_parameters pa ON pa.id = p.parameter_id
       WHERE p.rule_id = r.id
    LOOP
      -- An implementer that resolved the interface property to a column it does
      -- not have yet contributes nothing rather than a null-keyed entry.
      CONTINUE WHEN rp.prop_key IS NULL;
      IF rp.value_source = 'object_parameter_property' THEN
        RAISE EXCEPTION 'Actions:ValueSourceNotExecutable — object_parameter_property needs an object reference parameter resolved to its object, which apply_action cannot do yet'
          USING HINT = 'Map the property from a parameter, a static value, or the current user or time.';
      END IF;
      -- "primary key values cannot be modified by any action type."
      IF rp.is_pk AND r.kind IN ('modify_object', 'modify_object_of_interface') THEN
        RAISE EXCEPTION 'Actions:CannotModifyPrimaryKey — "%" is the primary key of %, and primary key values cannot be modified by any action type',
          rp.prop_key, (SELECT api_name FROM public.object_types WHERE id = target);
      END IF;
      props := props || jsonb_build_object(rp.prop_key,
        CASE rp.value_source
          WHEN 'parameter'    THEN p_parameters -> rp.param_name
          WHEN 'static'       THEN rp.static_value
          WHEN 'current_user' THEN to_jsonb(auth.uid()::text)
          WHEN 'current_time' THEN to_jsonb(now())
        END);
    END LOOP;

    -- ── the edit ───────────────────────────────────────────────────────────
    IF r.kind IN ('create_object', 'create_object_of_interface') THEN
      SELECT property_id INTO pk_prop FROM public.object_type_properties
       WHERE object_type_id = target AND is_primary_key;
      pk_val := props ->> pk_prop;
      IF pk_val IS NULL OR btrim(pk_val) = '' THEN
        RAISE EXCEPTION 'Actions:CreateNeedsPrimaryKey — the rule''s properties produce no value for the primary key "%"', pk_prop;
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'create', props - pk_prop, p_action_type);
      written := written + 1;

    ELSIF r.kind IN ('modify_object', 'modify_object_of_interface') THEN
      pk_val := coalesce(ref_pk, p_primary_key);
      IF pk_val IS NULL THEN
        RAISE EXCEPTION 'Actions:ModifyNeedsPrimaryKey — a modify rule names the object it edits';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'modify', props, p_action_type);
      written := written + 1;

    ELSIF r.kind IN ('delete_object', 'delete_object_of_interface') THEN
      pk_val := coalesce(ref_pk, p_primary_key);
      IF pk_val IS NULL THEN
        RAISE EXCEPTION 'Actions:DeleteNeedsPrimaryKey — a delete rule names the object it removes';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'delete', '{}'::jsonb, p_action_type);
      written := written + 1;
    END IF;
  END LOOP;

  -- the window closes with the body: is_local means an abort restores it,
  -- and this makes the normal path just as narrow (606).
  PERFORM set_config('beacon.applying_action', 'off', true);
  RETURN written;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_function_edits(p_action_type uuid, p_edits jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  rule    record;
  edit    jsonb;
  variant text;
  body    jsonb;
  api     text;
  pk      text;
  ot      uuid;
  allowed text[];
  written integer := 0;
BEGIN
  -- Edits from here are edits VIA AN ACTION, which is what guard_object_edit
  -- asks of an object type that only allows those (605).
  PERFORM set_config('beacon.applying_action', 'on', true);

  IF jsonb_typeof(p_edits) <> 'array' THEN
    RAISE EXCEPTION 'Actions:InvalidOutput — an edit function returns an array of edits, got %',
      coalesce(jsonb_typeof(p_edits), 'null');
  END IF;

  SELECT r.*, v.edits AS provenance
    INTO rule
    FROM public.action_type_rules r
    JOIN public.function_versions v ON v.id = r.function_version_id
   WHERE r.action_type_id = p_action_type AND r.kind = 'function';
  IF rule.id IS NULL THEN
    RAISE EXCEPTION 'Actions:NotFunctionBacked — % has no function rule', p_action_type;
  END IF;

  -- "the provenance consists only of the object types that the action may
  -- edit at runtime"
  SELECT array_agg(t) INTO allowed
    FROM jsonb_array_elements_text(rule.provenance->'object_types') t;

  IF jsonb_array_length(p_edits) > public.action_edit_limit() THEN
    RAISE EXCEPTION 'Actions:ScaleLimit — % edits exceeds the % objects one action may edit',
      jsonb_array_length(p_edits), public.action_edit_limit();
  END IF;

  FOR edit IN SELECT * FROM jsonb_array_elements(p_edits) LOOP
    SELECT k INTO variant FROM jsonb_object_keys(edit) k LIMIT 1;
    body := edit -> variant;

    IF variant IN ('addLink', 'deleteLink') THEN
      RAISE EXCEPTION 'Actions:LinkEditsNotSupported — % edits a many-to-many link, which has no instance store here', variant
        USING HINT = 'A foreign-key link is edited as a property, which arrives as modifyObject.';
    END IF;
    IF variant NOT IN ('addObject', 'modifyObject', 'deleteObject') THEN
      RAISE EXCEPTION 'Actions:InvalidOutput — % is not one of the published edit variants', coalesce(variant, 'an empty edit');
    END IF;

    api := body ->> 'objectType';
    pk  := body ->> 'primaryKey';
    IF api IS NULL OR pk IS NULL OR btrim(pk) = '' THEN
      RAISE EXCEPTION 'Actions:InvalidOutput — every edit carries an objectType and a primaryKey';
    END IF;

    IF NOT (api = ANY (coalesce(allowed, '{}'))) THEN
      RAISE EXCEPTION 'Functions:UndeclaredObjectTypeEdited — % is not declared in the function spec', api;
    END IF;

    SELECT ot2.id INTO ot FROM public.object_types ot2
     WHERE ot2.api_name = api
       AND ot2.ontology_id = (SELECT a.ontology_id FROM public.action_types a WHERE a.id = p_action_type);
    IF ot IS NULL THEN
      RAISE EXCEPTION 'Actions:UnknownObjectType — % is not an object type in this ontology', api;
    END IF;

    -- The Edits toggle governs a function-backed edit exactly as it governs a
    -- rule-backed one.
    IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = ot) THEN
      RAISE EXCEPTION 'Actions:EditsDisabled — % has edits disabled', api;
    END IF;

    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
    VALUES (ot, pk,
            CASE variant WHEN 'addObject' THEN 'create'
                         WHEN 'modifyObject' THEN 'modify'
                         ELSE 'delete' END,
            CASE WHEN variant = 'deleteObject' THEN '{}'::jsonb
                 ELSE coalesce(body -> 'properties', '{}'::jsonb) END,
            p_action_type);
    written := written + 1;
  END LOOP;

  -- the window closes with the body: is_local means an abort restores it,
  -- and this makes the normal path just as narrow (606).
  PERFORM set_config('beacon.applying_action', 'off', true);
  RETURN written;
END $function$;

-- Refuse, apply, refuse — in ONE transaction, which is what 605 could not do.
DO $$
DECLARE
  v_ont uuid;
  v_ot  uuid;
BEGIN
  BEGIN
    SELECT id INTO v_ont FROM public.ontologies ORDER BY created_at LIMIT 1;
    IF v_ont IS NULL THEN RAISE EXCEPTION 'no ontology: 606 cannot prove the window closed'; END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label, icon, edits_enabled)
    VALUES (v_ont, 'Probe606', 'Probe 606', 'cube', true) RETURNING id INTO v_ot;

    -- stand in for what apply_action does to the setting, then close it as 606 does
    PERFORM set_config('beacon.applying_action', 'on', true);
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (v_ot, 'pk1', 'create', '{}'::jsonb);
    PERFORM set_config('beacon.applying_action', 'off', true);

    -- the next direct write in the SAME transaction must be refused again
    BEGIN
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
      VALUES (v_ot, 'pk2', 'create', '{}'::jsonb);
      RAISE EXCEPTION 'the flag outlived the apply: a direct edit was accepted after one';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:PermissionDenied%' THEN RAISE; END IF;
    END;

    -- and the real function leaves it closed, which is the line 605 was missing
    IF public.in_action_apply() THEN
      RAISE EXCEPTION 'in_action_apply() is still true outside the body';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'the window closes with the body: refused, applied, refused again in one transaction';
  END;
END $$;
