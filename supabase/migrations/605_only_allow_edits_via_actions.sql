-- The second writeback toggle, which Foundry has and we did not.
--
--   "Object edits can either be locked down so that edits are only allowed via
--   actions, or reopened so that edits are allowed via actions, Foundry Forms,
--   direct Object Explorer edits, and API calls. To enforce a consistent
--   security paradigm across many workflows, by default, new object types only
--   allow edits via actions."
--   — action-types/permissions.md
--
-- We had one toggle, `edits_enabled` (the course's Allow edits), and behaved as
-- the reopened mode permanently: any ontology member could write an edit with
-- no action involved. That is the mode the page calls discouraged, and three
-- other pages name the control we lacked by its label —
--
--   "Toggle on `Only allow edits via actions` to unblock the migration of that
--   object type."
--   — object-backend/osv1-osv2-migration.md
--
-- The error is not invented either; it is the one the marketplace page prints
-- for exactly this misconfiguration:
--
--   "Without this step, users will encounter an `Actions:PermissionDenied`
--   error when attempting to create a proposal."
--   — foundry-rules/marketplace.md
--
-- WHERE THE RULE GOES. The ladder's trigger rung, because it needs another
-- table AND a namespaced error, and because a trigger binds the owner too —
-- RLS does not, and the direct-insert path is the one being closed. The arm
-- joins the guard that is already there rather than adding a second trigger.
--
-- WHAT MAKES AN INSERT "VIA AN ACTION". A transaction-local setting the two
-- writers set. apply_action stays INVOKER — the edit still lands through
-- object_edits' own policy, which was the point of it being invoker — and a
-- PostgREST caller cannot set the flag, because set_config lives in pg_catalog
-- and only public is exposed.
--
-- NOT RETROACTIVE, and existing rows are untouched:
--
--   "will not remove historical, non-action edits, but they will prevent
--   further edits from Foundry Forms, direct Object Explorer edits, and API
--   calls."
--   — action-types/permissions.md

ALTER TABLE public.object_types
  ADD COLUMN only_edits_via_actions boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.object_types.only_edits_via_actions IS
  'The Only allow edits via actions toggle in the Datasources tab. Default true: "by default, new object types only allow edits via actions" (action-types/permissions).';

-- The page's default is for NEW object types. A type that already has an edit
-- nothing applied is working in the reopened mode today, and turning it on
-- under them would break it silently — so those keep the mode they have and
-- their owner can lock them down from the tab.
UPDATE public.object_types t SET only_edits_via_actions = false
 WHERE EXISTS (SELECT 1 FROM public.object_edits e
                WHERE e.object_type_id = t.id AND e.action_type_id IS NULL);

CREATE OR REPLACE FUNCTION public.in_action_apply()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('beacon.applying_action', true), '') = 'on'
$$;

COMMENT ON FUNCTION public.in_action_apply() IS
  'True inside apply_action or apply_function_edits. Transaction-local, and unreachable from PostgREST: set_config is in pg_catalog and only public is exposed.';

-- Patched from pg_get_functiondef; the ObjectIsDeleted arm below is unchanged.
CREATE OR REPLACE FUNCTION public.guard_object_edit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE latest text;
BEGIN
  IF (SELECT t.only_edits_via_actions FROM public.object_types t WHERE t.id = NEW.object_type_id)
     AND NOT public.in_action_apply() THEN
    RAISE EXCEPTION 'Actions:PermissionDenied — this object type only allows edits via actions'
      USING HINT = 'Apply an action type that edits it, or turn off "Only allow edits via actions" on the Datasources tab.';
  END IF;

  SELECT e.instruction INTO latest
    FROM public.object_edits e
   WHERE e.object_type_id = NEW.object_type_id AND e.primary_key = NEW.primary_key
   ORDER BY e.seq DESC LIMIT 1;

  IF latest = 'delete' AND NEW.instruction = 'modify' THEN
    RAISE EXCEPTION 'Ontology:ObjectIsDeleted — a Modify object action cannot be applied to a deleted object'
      USING HINT = 'Create it again first; a create marks a new starting point.';
  END IF;
  RETURN NEW;
END $function$;

-- Both writers, patched from pg_get_functiondef with one PERFORM added at the
-- top of each body; nothing else in either function moved.
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

  RETURN written;
END $function$;

-- The arm has to REFUSE the direct insert and ALLOW the action's, and both are
-- probed by doing them. A migration's INSERTs commit, so this runs in a
-- subtransaction and rolls itself back.
DO $$
DECLARE
  v_ont uuid;
  v_ot  uuid;
  v_err text;
BEGIN
  BEGIN
    SELECT id INTO v_ont FROM public.ontologies ORDER BY created_at LIMIT 1;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'no ontology: 605 cannot prove its own guard';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label, icon, edits_enabled)
    VALUES (v_ont, 'Probe605', 'Probe 605', 'cube', true) RETURNING id INTO v_ot;

    -- default on, so a direct edit is refused BY NAME
    BEGIN
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
      VALUES (v_ot, 'pk1', 'create', '{}'::jsonb);
      RAISE EXCEPTION 'a direct edit was accepted on a type that only allows edits via actions';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      IF v_err NOT LIKE 'Actions:PermissionDenied%' THEN RAISE; END IF;
    END;

    -- the same insert inside the action's flag is accepted
    PERFORM set_config('beacon.applying_action', 'on', true);
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (v_ot, 'pk1', 'create', '{}'::jsonb);
    PERFORM set_config('beacon.applying_action', 'off', true);

    -- and with the toggle off, a direct edit is accepted again
    UPDATE public.object_types SET only_edits_via_actions = false WHERE id = v_ot;
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (v_ot, 'pk2', 'create', '{}'::jsonb);

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'refused a direct edit by name, allowed the action''s, and allowed a direct edit once the toggle was off';
  END;
END $$;
