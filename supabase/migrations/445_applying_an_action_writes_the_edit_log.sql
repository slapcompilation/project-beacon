-- Applying an action writes the edit log. Nothing else does.
--
--   "By using actions, it is possible for users to create additional objects
--    that do not exist in the backing datasource"        (create-object-type)
--
--   "because we've only defined one action that touches only the Root Cause
--    property, this is the only property that users can edit"
--                                       (deep-dive, Create an action type; 418)
--
-- E1 built the edit log and E2 indexes it; until now the only writer was a
-- hand INSERT. apply_action() is the documented path: validate the form's
-- parameters, run the rules in order, and append instructions — which the next
-- index build merges, which Quicksearch then finds. The loop closes:
-- action → edit → index → searchable object.
--
-- ── WHAT EXECUTES, AND WHAT REFUSES BY NAME ────────────────────────────────
-- create_object, modify_object and delete_object execute. The other four kinds
-- refuse with Actions:RuleKindNotExecutable rather than half-working:
--   create_or_modify_object — needs an existence check against the merged
--     object, which is an index query with staleness questions; its own piece.
--   create_link / delete_link — a link INSTANCE store does not exist yet.
--   function — "Modifications to the function can only be made within the
--     Functions Code Repository", which we have no counterpart for (G2).
--
-- SUBMISSION CRITERIA ARE NOT EVALUATED HERE, by name. 421 stores the tree and
-- renders its failure messages; an evaluation engine over ten operators and
-- three value sources is its own migration, and a half-evaluated gate that
-- silently passes what it cannot parse would be worse than an honest absence.
--
-- SECURITY INVOKER: the edit lands through object_edits' own INSERT policy
-- (member of the ontology, edits enabled) — composed, not restated. The
-- pre-check below exists only to give the refusal a readable name.

CREATE OR REPLACE FUNCTION public.apply_action(
  p_action_type uuid,
  p_parameters  jsonb DEFAULT '{}'::jsonb,
  p_primary_key text  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  act      record;
  par      record;
  r        record;
  rp       record;
  props    jsonb;
  pk_prop  text;
  pk_val   text;
  written  integer := 0;
BEGIN
  SELECT * INTO act FROM public.action_types WHERE id = p_action_type;
  IF act.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;

  -- "required" is the form's word, and the form is not here to enforce it.
  FOR par IN SELECT api_name FROM public.action_type_parameters
              WHERE action_type_id = p_action_type AND required
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = 'null'::jsonb
       OR btrim(p_parameters->>par.api_name) = '' THEN
      RAISE EXCEPTION 'Actions:MissingParameter — "%" is required', par.api_name;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type ORDER BY position
  LOOP
    IF r.kind NOT IN ('create_object', 'modify_object', 'delete_object') THEN
      RAISE EXCEPTION 'Actions:RuleKindNotExecutable — % rules cannot be applied yet', r.kind
        USING HINT = 'create_or_modify needs an existence check; links need a link instance store; functions need a function runtime.';
    END IF;

    IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = r.object_type_id) THEN
      RAISE EXCEPTION 'Actions:EditsDisabled — the object type this rule edits has edits disabled'
        USING HINT = 'Enable edits on the object type. "Disabling edits will not remove existing edits."';
    END IF;

    -- The rule's declared property set, resolved per source. This is the
    -- sentence about Root Cause made mechanical: only what the rule names.
    props := '{}'::jsonb;
    FOR rp IN SELECT p.*, pa.api_name AS param_name, prop.property_id AS prop_key
                FROM public.action_type_rule_properties p
                JOIN public.object_type_properties prop ON prop.id = p.property_id
                LEFT JOIN public.action_type_parameters pa ON pa.id = p.parameter_id
               WHERE p.rule_id = r.id
    LOOP
      props := props || jsonb_build_object(rp.prop_key,
        CASE rp.value_source
          WHEN 'parameter'    THEN p_parameters -> rp.param_name
          WHEN 'static'       THEN rp.static_value
          WHEN 'current_user' THEN to_jsonb(auth.uid()::text)
          WHEN 'current_time' THEN to_jsonb(now())
          ELSE NULL
        END);
    END LOOP;

    IF r.kind = 'create_object' THEN
      -- Identity is the primary key VALUE; a create must produce one.
      SELECT property_id INTO pk_prop FROM public.object_type_properties
       WHERE object_type_id = r.object_type_id AND is_primary_key;
      pk_val := props ->> pk_prop;
      IF pk_val IS NULL OR btrim(pk_val) = '' THEN
        RAISE EXCEPTION 'Actions:CreateNeedsPrimaryKey — the rule''s properties produce no value for the primary key "%"', pk_prop;
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, pk_val, 'create', props, p_action_type);

    ELSIF r.kind = 'modify_object' THEN
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:ModifyNeedsTarget — a modify rule edits an existing object; pass its primary key';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'modify', props, p_action_type);

    ELSE  -- delete_object
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:DeleteNeedsTarget — a delete rule removes an existing object; pass its primary key';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'delete', '{}'::jsonb, p_action_type);
    END IF;

    written := written + 1;
  END LOOP;

  IF written = 0 THEN
    RAISE EXCEPTION 'Actions:NoRules — this action type has no rules, so applying it would do nothing';
  END IF;

  RETURN written;
END $$;

COMMENT ON FUNCTION public.apply_action(uuid, jsonb, text) IS
  'Apply an action: validate required parameters, run create/modify/delete rules in order, append to the edit log with the action recorded on each edit. The next index build merges the result. Criteria evaluation and the other four rule kinds refuse by name rather than half-working. Invoker — the edit lands through object_edits'' own policy.';

REVOKE ALL ON FUNCTION public.apply_action(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_action(uuid, jsonb, text) TO authenticated;

-- ── assertions: the loop closes, as authenticated ───────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  act uuid; modact uuid; usr uuid := gen_random_uuid(); before text; n int;
  pid uuid; tid uuid; x public.object_type_indexes;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('apply-445') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws445@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws445@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS445');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws445', 'WS 445') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws445', 'WS445') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'tickets445', 'tickets') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;

  t := public.save_object_type(
    jsonb_build_object('api_name','Ticket','label','Ticket','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','ticket_id','display_name','Ticket Id',
      'api_name','ticketId','base_type','string','source','column','backing_column','ticket_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id = t;
  SELECT id INTO pid FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'ticket_id';

  -- A create action whose one parameter feeds the primary key.
  act := public.save_action_type(jsonb_build_object(
    'api_name','open-ticket','label','Open ticket','ontology_id', ont::text,
    'parameters', jsonb_build_array(jsonb_build_object(
      'api_name','ticketId','display_name','Ticket Id','base_type','string',
      'required',true,'position',0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind','create_object','position',0,'object_type_id', t::text,
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id', pid::text,'value_source','parameter','parameter_api_name','ticketId'))))));
  PERFORM public.save_working_state();

  -- 1. A required parameter is required.
  BEGIN
    PERFORM public.apply_action(act, '{}'::jsonb);
    RAISE EXCEPTION 'a missing required parameter was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%MissingParameter%' THEN RAISE; END IF;
  END;

  -- 2. Applying writes the edit, attributed to the action.
  n := public.apply_action(act, jsonb_build_object('ticketId','T-100'));
  IF n <> 1 THEN RAISE EXCEPTION 'expected one edit, wrote %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_edits
                  WHERE object_type_id = t AND primary_key = 'T-100'
                    AND instruction = 'create' AND action_type_id = act) THEN
    RAISE EXCEPTION 'the edit did not land attributed to its action';
  END IF;

  -- 3. The loop closes: the next index build makes it a searchable object.
  x := public.index_object_type(t);
  IF x.status <> 'success' OR x.object_count <> 1 THEN
    RAISE EXCEPTION 'the action-created object did not index (%/%: %)', x.status, x.object_count, x.error;
  END IF;
  SELECT count(*) INTO n FROM public.search_objects('T-100');
  IF n <> 1 THEN RAISE EXCEPTION 'the action-created object is not searchable'; END IF;

  -- 4. Modify targets an existing object and touches only what the rule names.
  modact := public.save_action_type(jsonb_build_object(
    'api_name','retitle-ticket','label','Retitle','ontology_id', ont::text,
    'parameters', jsonb_build_array(jsonb_build_object(
      'api_name','ticketId','display_name','Ticket Id','base_type','string',
      'required',true,'position',0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind','modify_object','position',0,'object_type_id', t::text,
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id', pid::text,'value_source','parameter','parameter_api_name','ticketId'))))));
  PERFORM public.save_working_state();
  BEGIN
    PERFORM public.apply_action(modact, jsonb_build_object('ticketId','T-200'));
    RAISE EXCEPTION 'a modify without a target was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%ModifyNeedsTarget%' THEN RAISE; END IF;
  END;
  PERFORM public.apply_action(modact, jsonb_build_object('ticketId','T-200'), 'T-100');
  x := public.index_object_type(t);
  SELECT count(*) INTO n FROM public.search_objects('T-200');
  IF n <> 1 THEN RAISE EXCEPTION 'the modify did not reach the index'; END IF;

  -- 5. Edits disabled refuses with the readable name.
  UPDATE public.object_types SET edits_enabled = false WHERE id = t;
  BEGIN
    PERFORM public.apply_action(act, jsonb_build_object('ticketId','T-300'));
    RAISE EXCEPTION 'an edit landed with edits disabled';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%EditsDisabled%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '445: action -> edit -> index -> searchable, and the refusals have names';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
