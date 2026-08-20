-- The save path cannot make an interface rule, which is why nothing had ever
-- exercised the three kinds 592 made executable.
--
-- `apply_action_type` writes rules with an explicit column list that predates
-- 569: no `interface_id` on the rule and no `interface_property_id` on its
-- properties. Same shape as the derived-property gap 591 closed — an engine
-- reachable only from a hand-written INSERT is not reachable.
--
-- It also generates the parameters, because Foundry does:
--
--   ""Modify" rules on an interface can modify any object of the configured
--    interface. An "interface reference" parameter will be generated,
--    constrained to the selected interface."
--   — action-types/actions-on-interfaces.md
--
-- after the rules rather than beside the parameters above, because it is the
-- rules that say which interfaces are involved.
--
-- The body is the live function with four additions and nothing else rewritten.

CREATE OR REPLACE FUNCTION public.apply_action_type(p_action jsonb, p_parameters jsonb DEFAULT '[]'::jsonb, p_rules jsonb DEFAULT '[]'::jsonb, p_criteria jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
DECLARE
  t        uuid := nullif(p_action->>'id', '')::uuid;
  param_id jsonb := '{}'::jsonb;   -- api_name → uuid
  crit_id  jsonb := '{}'::jsonb;   -- client key → uuid
  e        jsonb;
  rp       jsonb;
  rid      uuid;
  cid      uuid;
BEGIN
  IF t IS NULL OR NOT EXISTS (SELECT 1 FROM public.action_types WHERE id = t) THEN
    INSERT INTO public.action_types (id, ontology_id, project_id, api_name, label, description)
    VALUES (coalesce(t, gen_random_uuid()),
            coalesce(nullif(p_action->>'ontology_id','')::uuid, public.default_ontology()),
            nullif(p_action->>'project_id','')::uuid,
            p_action->>'api_name', p_action->>'label',
            coalesce(p_action->>'description', ''))
    RETURNING id INTO t;
  ELSE
    UPDATE public.action_types
       SET label       = coalesce(p_action->>'label', label),
           description = coalesce(p_action->>'description', description),
           status      = coalesce(p_action->>'status', status)
     WHERE id = t;
  END IF;

  -- Wholesale replace: nothing outside the action references these rows.
  DELETE FROM public.action_type_submission_criteria WHERE action_type_id = t;
  DELETE FROM public.action_type_rules WHERE action_type_id = t;   -- cascades rule properties
  DELETE FROM public.action_type_parameters WHERE action_type_id = t;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, description, base_type, object_type_id,
       required, exposed, editable, position)
    VALUES (t, e->>'api_name', e->>'display_name', coalesce(e->>'description',''),
            nullif(e->>'base_type',''), nullif(e->>'object_type_id','')::uuid,
            coalesce((e->>'required')::boolean, false),
            coalesce((e->>'exposed')::boolean, true),
            coalesce((e->>'editable')::boolean, true),
            coalesce((e->>'position')::integer, 0))
    RETURNING id INTO cid;
    param_id := param_id || jsonb_build_object(e->>'api_name', cid::text);
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_rules
      (action_type_id, kind, position, object_type_id, link_type_id, function_name,
       function_version_id, auto_upgrade, interface_id)
    VALUES (t, e->>'kind', coalesce((e->>'position')::integer, 0),
            nullif(e->>'object_type_id','')::uuid,
            nullif(e->>'link_type_id','')::uuid,
            nullif(e->>'function_name',''),
            nullif(e->>'function_version_id','')::uuid,
            coalesce((e->>'auto_upgrade')::boolean, false),
            nullif(e->>'interface_id','')::uuid)
    RETURNING id INTO rid;

    -- "Configure the inputs to match up to the action parameters" — the
    -- mapping the Run function card shows, travelling with its rule. Written
    -- after the parameters above, so a name resolves to the uuid just made.
    FOR rp IN SELECT * FROM jsonb_array_elements(coalesce(e->'inputs', '[]'::jsonb)) LOOP
      INSERT INTO public.action_type_rule_inputs (rule_id, input_name, parameter_id)
      VALUES (rid, rp->>'input_name',
              coalesce(nullif(rp->>'parameter_id','')::uuid,
                       nullif(param_id->>(rp->>'parameter_api_name'),'')::uuid));
    END LOOP;

    FOR rp IN SELECT * FROM jsonb_array_elements(coalesce(e->'properties', '[]'::jsonb)) LOOP
      INSERT INTO public.action_type_rule_properties
        (rule_id, property_id, interface_property_id, value_source, parameter_id, static_value)
      -- A round-tripped section carries JSON nulls, and jsonb null is not SQL
      -- NULL — the XOR checks read it as a value. Strip both here.
      VALUES (rid, nullif(rp->>'property_id','')::uuid,
              nullif(rp->>'interface_property_id','')::uuid, rp->>'value_source',
              (param_id->>(rp->>'parameter_api_name'))::uuid,
              nullif(rp->'static_value', 'null'::jsonb));
    END LOOP;
  END LOOP;

  -- Parents before children: the payload lists them in that order, and the
  -- map of client keys to landed ids grows as we go.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator, template,
       parameter_id, user_field, attribute_name, operator, value_source,
       value_parameter_id, static_value, failure_message)
    VALUES (t,
            (crit_id->>(e->>'parent_key'))::uuid,
            coalesce((e->>'position')::integer, 0),
            e->>'node_type', nullif(e->>'logical_operator',''), nullif(e->>'template',''),
            (param_id->>(e->>'parameter_api_name'))::uuid,
            nullif(e->>'user_field',''), nullif(e->>'attribute_name',''),
            nullif(e->>'operator',''), nullif(e->>'value_source',''),
            (param_id->>(e->>'value_parameter_api_name'))::uuid,
            nullif(e->'static_value', 'null'::jsonb),
            coalesce(e->>'failure_message', ''))
    RETURNING id INTO cid;
    IF e->>'key' IS NOT NULL THEN
      crit_id := crit_id || jsonb_build_object(e->>'key', cid::text);
    END IF;
  END LOOP;

  -- The generated parameter the header quotes, written after the rules because
  -- it is the rules that say which interfaces are involved. Idempotent, so a
  -- re-save adds nothing.
  PERFORM public.generate_interface_parameters(t);

  RETURN t;
END $fn$;
