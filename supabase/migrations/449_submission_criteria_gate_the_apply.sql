-- Submission criteria are evaluated, and they gate the apply.
--
-- 421 stored the tree and 445 refused to fake an evaluator — "a half-evaluated
-- gate that silently passes what it cannot parse would be worse than an honest
-- absence." This is the evaluator, and its rule is the inverse: anything it
-- cannot evaluate REFUSES the apply by name rather than passing.
--
--   "While errors need to be handled in order to save, warnings will not
--    prevent you from saving."            (the save side; ontology-manager)
--
-- The criteria side is the action form's submit gate: the deep dive's Root
-- Cause lesson requires the criterion hold before the action may run. The ten
-- operators and their meanings are 421's, quoted verbatim from the docs into
-- submission_operators() — this migration implements exactly those notes:
--
--   is                          "The left value exactly matches the right value"
--   is not                      "The left value and right value do not match"
--   matches                     "The left value matches the Regular Expression"
--   is less than                "The left value is smaller than the right value"
--   is greater than or equals   "The left value is greater than the right value"
--   includes / includes any / is included in / each is / each is not (multi)
--
-- ── DECISIONS, and which are inference ─────────────────────────────────────
-- · Multiple roots evaluate as ALL of them — the tree's implicit conjunction.
--   INFERENCE; nothing states it, and a single logical root is the normal case.
-- · An empty logical node: all→true, any→false, none→true — the vacuous
--   truth conventions. INFERENCE, marked.
-- · Numeric comparison is attempted first for the two ordering operators, text
--   ordering as the fallback — "smaller" is numeric when both sides are.
-- · NOT EVALUABLE, refusing by name: template=current_user with
--   user_field group_ids or attribute (no groups or user attributes are
--   modeled), and value_source=none (no operator here is unary). Each raises
--   Actions:CriterionNotEvaluable naming the reason.
-- · The failure message is the failing condition's own when it has one, else
--   the root's via criterion_failure_message() — 421's renderer walks UP, so
--   the root's message is the documented display of last resort.

CREATE OR REPLACE FUNCTION public.eval_criterion(
  p_node   uuid,
  p_action uuid,
  p_params jsonb,
  OUT passed boolean,
  OUT msg    text
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  c       record;
  child   record;
  sub     record;
  l       jsonb;
  r       jsonb;
  ok      boolean;
  any_hit boolean := false;
  all_ok  boolean := true;
BEGIN
  SELECT * INTO c FROM public.action_type_submission_criteria WHERE id = p_node;

  IF c.node_type = 'logical' THEN
    FOR child IN SELECT id FROM public.action_type_submission_criteria
                  WHERE parent_id = p_node ORDER BY position
    LOOP
      SELECT * INTO sub FROM public.eval_criterion(child.id, p_action, p_params);
      IF sub.passed THEN any_hit := true; ELSE all_ok := false; END IF;
      IF NOT sub.passed AND msg IS NULL THEN msg := sub.msg; END IF;
    END LOOP;

    -- Vacuous truths, marked as inference in the header: all over zero
    -- children is true, any is false, none is true.
    passed := CASE c.logical_operator
                WHEN 'all'  THEN all_ok
                WHEN 'any'  THEN any_hit
                WHEN 'none' THEN NOT any_hit
              END;
    -- A none-group fails BECAUSE a child passed; its own message is the one.
    IF NOT passed AND (c.logical_operator = 'none' OR msg IS NULL) THEN
      msg := nullif(btrim(c.failure_message), '');
    END IF;
    RETURN;
  END IF;

  -- A condition. Left side:
  IF c.template = 'parameter' THEN
    l := nullif(p_params -> (SELECT api_name FROM public.action_type_parameters
                              WHERE id = c.parameter_id), 'null'::jsonb);
  ELSIF c.template = 'current_user' AND c.user_field = 'user_id' THEN
    l := to_jsonb(auth.uid()::text);
  ELSE
    RAISE EXCEPTION 'Actions:CriterionNotEvaluable — current_user.% is not modeled yet', c.user_field
      USING HINT = 'Groups and user attributes do not exist here; only user_id evaluates.';
  END IF;

  -- Right side:
  IF c.value_source = 'parameter' THEN
    r := nullif(p_params -> (SELECT api_name FROM public.action_type_parameters
                              WHERE id = c.value_parameter_id), 'null'::jsonb);
  ELSIF c.value_source = 'static' THEN
    r := c.static_value;
  ELSE
    RAISE EXCEPTION 'Actions:CriterionNotEvaluable — value_source none has no unary operator to serve'
      USING HINT = 'Every documented operator compares two values.';
  END IF;

  ok := CASE c.operator
    WHEN 'is'     THEN l IS NOT DISTINCT FROM r
    WHEN 'is not' THEN l IS DISTINCT FROM r
    WHEN 'matches' THEN coalesce((l #>> '{}') ~ (r #>> '{}'), false)
    WHEN 'is less than' THEN
      CASE WHEN (l #>> '{}') ~ '^-?\d+(\.\d+)?$' AND (r #>> '{}') ~ '^-?\d+(\.\d+)?$'
           THEN (l #>> '{}')::numeric < (r #>> '{}')::numeric
           ELSE (l #>> '{}') < (r #>> '{}') END
    WHEN 'is greater than or equals' THEN
      CASE WHEN (l #>> '{}') ~ '^-?\d+(\.\d+)?$' AND (r #>> '{}') ~ '^-?\d+(\.\d+)?$'
           THEN (l #>> '{}')::numeric >= (r #>> '{}')::numeric
           ELSE (l #>> '{}') >= (r #>> '{}') END
    WHEN 'includes' THEN
      jsonb_typeof(l) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(l) e WHERE e.value IS NOT DISTINCT FROM r)
    WHEN 'includes any' THEN
      jsonb_typeof(l) = 'array' AND jsonb_typeof(r) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(l) a JOIN jsonb_array_elements(r) b
          ON a.value IS NOT DISTINCT FROM b.value)
    WHEN 'is included in' THEN
      jsonb_typeof(r) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r) e WHERE e.value IS NOT DISTINCT FROM l)
    WHEN 'each is' THEN
      jsonb_typeof(l) = 'array' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(l) e WHERE e.value IS DISTINCT FROM r)
    WHEN 'each is not' THEN
      jsonb_typeof(l) = 'array' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(l) e WHERE e.value IS NOT DISTINCT FROM r)
  END;

  passed := coalesce(ok, false);
  IF NOT passed THEN
    msg := coalesce(nullif(btrim(c.failure_message), ''),
                    public.criterion_failure_message(c.id));
  END IF;
END $$;

COMMENT ON FUNCTION public.eval_criterion(uuid, uuid, jsonb) IS
  'One node of the submission criteria tree, depth first. A condition it cannot evaluate raises by name — the gate never silently passes what it cannot parse.';

CREATE OR REPLACE FUNCTION public.submission_criteria_verdict(
  p_action_type uuid,
  p_parameters  jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE root record; sub record;
BEGIN
  -- Several roots conjoin. The first failure's message is the verdict.
  FOR root IN SELECT id FROM public.action_type_submission_criteria
               WHERE action_type_id = p_action_type AND parent_id IS NULL
               ORDER BY position
  LOOP
    SELECT * INTO sub FROM public.eval_criterion(root.id, p_action_type, p_parameters);
    IF NOT sub.passed THEN
      RETURN coalesce(sub.msg, 'Submission criteria not met.');
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.submission_criteria_verdict(uuid, jsonb) IS
  'NULL when the action''s criteria hold for these parameters; otherwise the failure message to show. The form can ask before submitting; apply_action() asks regardless.';

REVOKE ALL ON FUNCTION public.eval_criterion(uuid, uuid, jsonb),
              public.submission_criteria_verdict(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eval_criterion(uuid, uuid, jsonb),
              public.submission_criteria_verdict(uuid, jsonb) TO authenticated;

-- ── apply asks the gate ─────────────────────────────────────────────────────
-- Patched in place with the needle asserted, as 440 did for the violations
-- copy: the alternative is restating apply_action a third time in full.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure);
  IF def NOT LIKE '%FOR r IN SELECT * FROM public.action_type_rules%' THEN
    RAISE EXCEPTION 'apply_action has drifted — wire the criteria gate by hand';
  END IF;
  def := replace(def,
    'FOR r IN SELECT * FROM public.action_type_rules',
    'pk_val := public.submission_criteria_verdict(p_action_type, p_parameters);
  IF pk_val IS NOT NULL THEN
    RAISE EXCEPTION ''Actions:SubmissionCriteriaFailed — %'', pk_val;
  END IF;

  FOR r IN SELECT * FROM public.action_type_rules');
  EXECUTE def;
  IF pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure)
     NOT LIKE '%SubmissionCriteriaFailed%' THEN
    RAISE EXCEPTION 'the gate did not land in apply_action';
  END IF;
END $$;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid; act uuid;
  usr uuid := gen_random_uuid(); before text; pid uuid; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('crit-449') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws449@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws449@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS449');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws449', 'WS 449') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws449', 'WS449') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'c449', 'c449') RETURNING id INTO ds;
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

  -- An action gated by: all( severity is not "low", severity is included in
  -- the allowed list ) — two operators, one logical, real messages.
  act := public.save_action_type(jsonb_build_object(
    'api_name','escalate','label','Escalate','ontology_id', ont::text,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name','ticketId','display_name','Ticket','base_type','string',
        'required',true,'position',0),
      jsonb_build_object('api_name','severity','display_name','Severity','base_type','string',
        'required',true,'position',1)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind','create_object','position',0,'object_type_id', t::text,
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id', pid::text,'value_source','parameter','parameter_api_name','ticketId')))),
    'criteria', jsonb_build_array(
      jsonb_build_object('key','root','node_type','logical','logical_operator','all',
        'position',0,'failure_message','Escalation requirements not met.'),
      jsonb_build_object('key','c1','parent_key','root','node_type','condition','position',0,
        'template','parameter','parameter_api_name','severity',
        'operator','is not','value_source','static','static_value', to_jsonb('low'::text),
        'failure_message','Low severity tickets are not escalated.'),
      jsonb_build_object('key','c2','parent_key','root','node_type','condition','position',1,
        'template','parameter','parameter_api_name','severity',
        'operator','is included in','value_source','static',
        'static_value', '["medium","high","critical"]'::jsonb,
        'failure_message','Severity must be medium, high or critical.'))));
  PERFORM public.save_working_state();

  -- 1. The gate refuses, with the condition's own message.
  BEGIN
    PERFORM public.apply_action(act, jsonb_build_object('ticketId','T-1','severity','low'));
    RAISE EXCEPTION 'a failing criterion did not gate the apply';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%Low severity tickets are not escalated.%' THEN RAISE; END IF;
  END;

  -- 2. A value outside the allowed list fails the second condition.
  IF public.submission_criteria_verdict(act, jsonb_build_object('ticketId','T-1','severity','urgent'))
     NOT LIKE '%medium, high or critical%' THEN
    RAISE EXCEPTION 'is included in did not evaluate';
  END IF;

  -- 3. And a passing form applies.
  n := public.apply_action(act, jsonb_build_object('ticketId','T-1','severity','high'));
  IF n <> 1 THEN RAISE EXCEPTION 'the passing form did not apply'; END IF;

  -- 4. The verdict is NULL when criteria hold — the form''s pre-check.
  IF public.submission_criteria_verdict(act, jsonb_build_object('ticketId','T-2','severity','medium'))
     IS NOT NULL THEN
    RAISE EXCEPTION 'a holding verdict was not NULL';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '449: the criteria tree evaluates and gates the apply, refusing with its own words';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
