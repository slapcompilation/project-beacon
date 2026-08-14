-- The action applies the batch; the function only returned it.
--
--   "The only way to update objects using a function is by configuring an
--    action to use the function"                    (functions/edits-overview)
--   "running an edit function outside of an Action will not actually modify
--    any object data"
--
-- The isolate cannot write, and this is the door it hands its result to. One
-- transaction, all of it or none:
--
--   "The entire function must succeed in order to generate the list of edits
--    which is passed to the actions service executing the atomic transaction."
--                                              (functions/api-ontology-edits)
--   "all edits are applied atomically at the end of the action call"
--                                  (action-types/function-actions-batched-execution)
--
-- ── THE BATCH SHAPE ─────────────────────────────────────────────────────────
-- The published ObjectEdit union, from apply-action's response:
-- `addObject`, `modifyObject`, `deleteObject`, `addLink`, `deleteLink`, each
-- carrying `objectType` and `primaryKey`. The three object variants map onto
-- object_edits' own instructions, which are Foundry's word too — the
-- how-edits-applied flowchart labels its branches `Instructions: Delete`,
-- `Create`, `(Modification)`.
--
-- The two link variants are refused by name. They are many-to-many edits;
-- a foreign-key link is edited as a property, which arrives as modifyObject.
--
-- ── THE TWO REFUSALS THAT ARE NOT OURS ──────────────────────────────────────
--   "Undeclared object types edited error: The function execution attempts to
--    update, create or delete an object whose object type is not declared in
--    the function spec."                        (functions/function-metrics)
--   "If a newer release of the function returns edits outside of this
--    provenance (for example, an additional object type), action execution
--    will fail."           (action-types/function-actions-getting-started)
--
--   "Scale limit failure: The action affected more than the permitted limit
--    of object types (by default, usually 10,000)."  (action-types/action-metrics)
--   "enabling up to 10,000 objects to be edited in a single Action"
--                                                  (object-backend/overview)
-- The second sentence is the precise one: the unit is objects.

-- The published cap, named once.
CREATE OR REPLACE FUNCTION public.action_edit_limit()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 10000 $$;
COMMENT ON FUNCTION public.action_edit_limit() IS
  'Objects editable in one action: "enabling up to 10,000 objects to be edited in a single Action" (object-backend/overview).';

CREATE OR REPLACE FUNCTION public.apply_function_edits(
  p_action_type uuid,
  p_edits       jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apply_function_edits(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_function_edits(uuid, jsonb) TO authenticated;
COMMENT ON FUNCTION public.apply_function_edits(uuid, jsonb) IS
  'Writes the edit batch an Ontology edit function returned, in one transaction: the published ObjectEdit variants become object_edits instructions, an edit outside the version''s provenance fails the action, and link edits are refused by name.';

-- What the runtime needs to run the rule: the source, the signature, the
-- declared imports, the provenance, and which parameter feeds which input.
CREATE OR REPLACE FUNCTION public.action_function_to_run(p_action_type uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'action_type_id', a.id,
           'ontology_id',    a.ontology_id,
           'api_name',       f.api_name,
           'version',        format('%s.%s.%s', v.major, v.minor, v.patch),
           'source',         v.source,
           'signature',      v.signature,
           'object_types',   v.imports->'object_types',
           'edits',          v.edits->'object_types',
           'inputs',         coalesce(
             (SELECT jsonb_object_agg(i.input_name, p.api_name)
                FROM public.action_type_rule_inputs i
                JOIN public.action_type_parameters p ON p.id = i.parameter_id
               WHERE i.rule_id = r.id), '{}'::jsonb))
    FROM public.action_types a
    JOIN public.action_type_rules r ON r.action_type_id = a.id AND r.kind = 'function'
    JOIN public.function_versions v ON v.id = r.function_version_id
    JOIN public.functions f ON f.id = v.function_id
   WHERE a.id = p_action_type
$$;
REVOKE ALL ON FUNCTION public.action_function_to_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.action_function_to_run(uuid) TO authenticated;

-- ── assertions ──────────────────────────────────────────────────────────────
-- Light on purpose. The end-to-end — a declared edit written, an undeclared one
-- refused, a link edit refused, apply_action sending the rule elsewhere — needs
-- an ontology, a function version, an action and its parameters, and that
-- fixture belongs in editFunctions.test.ts where it runs on every CI pass.
-- A migration assertion proves the change at the moment it lands; applied
-- migrations run once, so it cannot prove anything afterwards.
DO $$
DECLARE msg text;
BEGIN
  IF public.action_edit_limit() <> 10000 THEN
    RAISE EXCEPTION 'the published cap is 10,000 objects per action';
  END IF;

  -- A non-array output is refused before anything is looked up.
  BEGIN
    PERFORM public.apply_function_edits(gen_random_uuid(), '{"addObject":{}}'::jsonb);
    RAISE EXCEPTION 'an object was accepted where an array of edits belongs';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE '%InvalidOutput%' THEN RAISE; END IF;
  END;

  -- An action with no function rule cannot receive a batch.
  BEGIN
    PERFORM public.apply_function_edits(gen_random_uuid(), '[]'::jsonb);
    RAISE EXCEPTION 'a batch was applied to an action with no function rule';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE '%NotFunctionBacked%' THEN RAISE; END IF;
  END;

  -- Neither door is open to anon.
  IF has_function_privilege('anon', 'public.apply_function_edits(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.action_function_to_run(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'the edit path is reachable without signing in';
  END IF;

  RAISE NOTICE '510: an action applies the edit batch a function returns';
END $$;
