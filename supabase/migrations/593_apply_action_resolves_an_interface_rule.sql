-- 592 made the three interface object rules executable and nothing executes
-- them. `apply_action` dispatches on `r.object_type_id`, which is null on every
-- interface rule — so its edits-enabled gate reads `NOT (SELECT edits_enabled ...
-- WHERE id = NULL)` evaluates to NULL, the IF does not fire, and the rule would
-- fall through all three branches writing nothing at all. Silence, not an error.
--
-- An interface rule resolves to a concrete object type at submission, and the
-- resolution comes from the generated parameter:
--
--   "Because the action type is only associated with an interface, an "Object
--    type" parameter will be automatically generated to indicate the object type
--    that should be created."
--
--   ""Modify" rules on an interface can modify any object of the configured
--    interface. An "interface reference" parameter will be generated,
--    constrained to the selected interface."
--
--   — action-types/actions-on-interfaces.md
--
-- Two failures the page states are SUBMISSION failures, and they are raised here
-- rather than refused at configuration time, because refusing the rule would be
-- stricter than Foundry:
--
--   "objects cannot be created without a primary key. Therefore, any object type
--    without a primary key assigned in the rule will fail during submission."
--
--   "primary key values *cannot be modified* by any action type.  Therefore, an
--    action will fail on submission if the action tries to modify a primary key
--    property for a selected object type."

CREATE OR REPLACE FUNCTION public.apply_action(
  p_action_type uuid, p_parameters jsonb DEFAULT '{}'::jsonb, p_primary_key text DEFAULT NULL::text)
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
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

  RETURN written;
END $fn$;
