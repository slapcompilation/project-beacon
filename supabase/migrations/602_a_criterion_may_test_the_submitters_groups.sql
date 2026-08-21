-- 602 — a criterion may test the submitter's groups
--
-- eval_criterion has evaluated the criteria tree, all ten operators and the
-- `parameter` template since 421, and apply_action has called it through
-- submission_criteria_verdict all along. Two user fields raised instead:
--
--     RAISE EXCEPTION 'Actions:CriterionNotEvaluable — current_user.% is not
--       modeled yet' USING HINT = 'Groups and user attributes do not exist
--       here; only user_id evaluates.'
--
-- THE HINT STOPPED BEING TRUE WHEN THE SECURITY PHASE SHIPPED GROUPS. 481-486
-- built them and auth_group_ids() is a live helper; the branch predates them and
-- nobody revisited it. That is the "verify we do not have X" failure CLAUDE.md
-- names, sitting inside our own evaluator.
--
-- It is also the field the page's worked example turns on, twice:
--
--   "The group IDs option allows you to create conditions using the groups for
--    which the action's user is a member (whether direct or inherited
--    membership)."
--   "Since a user in our example is a member of many groups but the comparison
--    is to a single group, we need to select the `includes` operator to check
--    for an overlap."
--   — action-types/submission-criteria.md
--
-- So a criterion of exactly the kind the page teaches raised rather than
-- evaluated. Both list-valued fields now evaluate, and the page's multi-value
-- operators apply to them unchanged.
--
-- ATTRIBUTES FAIL CLOSED RATHER THAN RAISE. We carry two of Foundry's multipass
-- attributes — organization and markings. The page says "If a user does not have
-- access to an attribute, they will fail the condition", so an attribute we do
-- not model yields an EMPTY LIST, which fails every operator the page defines,
-- rather than an error that would block the action for a different reason.
--
-- Patched from pg_get_functiondef: only the left-side branch changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.eval_criterion(p_node uuid, p_action uuid, p_params jsonb, OUT passed boolean, OUT msg text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
  ELSIF c.template = 'current_user' AND c.user_field = 'group_ids' THEN
    -- "The group IDs option allows you to create conditions using the groups for
    -- which the action's user is a member (whether direct or inherited
    -- membership)." A list, so the page's multi-value operators apply.
    l := to_jsonb(ARRAY(SELECT g::text FROM unnest(public.auth_group_ids()) g));
  ELSIF c.template = 'current_user' AND c.user_field = 'attribute' THEN
    -- "Multipass attributes are treated as string lists and can only be compared
    -- against other strings or string lists." We hold two of them. An attribute
    -- we do not carry yields an empty list rather than an error, because the page
    -- says a user without access to an attribute FAILS the condition — and an
    -- empty left side fails every operator the page defines.
    l := CASE c.attribute_name
           WHEN 'organization' THEN to_jsonb(ARRAY(SELECT o::text FROM unnest(public.auth_org_ids()) o))
           WHEN 'markings'     THEN to_jsonb(public.auth_marking_ids())
           ELSE '[]'::jsonb
         END;
  ELSE
    RAISE EXCEPTION 'Actions:CriterionNotEvaluable — current_user.% is not modeled yet', c.user_field
      USING HINT = 'user_id, group_ids and attribute evaluate; this is none of them.';
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
END $function$;


-- The assertions CALL the evaluator. A catalogue check would pass against a body
-- that still raised.
DO $$
DECLARE at uuid; root uuid; v text; ont uuid;
BEGIN
  SELECT id INTO ont FROM public.ontologies LIMIT 1;
  IF ont IS NULL THEN RAISE NOTICE 'no ontology; skipped'; RETURN; END IF;

  INSERT INTO public.action_types (ontology_id, api_name, label, description)
  VALUES (ont, 'probe-602', 'Probe 602', '') RETURNING id INTO at;

  -- A groups-includes condition naming a group the caller is not in must FAIL,
  -- and must fail with the criterion's own message rather than by raising.
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, parent_id, position, node_type, template, user_field,
     operator, value_source, static_value, failure_message)
  VALUES (at, NULL, 0, 'condition', 'current_user', 'group_ids',
          'includes', 'static', to_jsonb('00000000-0000-0000-0000-000000000000'::text),
          'You are not in the required group.')
  RETURNING id INTO root;

  v := public.submission_criteria_verdict(at, '{}'::jsonb);
  IF v IS DISTINCT FROM 'You are not in the required group.' THEN
    RAISE EXCEPTION 'group_ids did not evaluate to the criterion message (got %)', coalesce(v, '<null>');
  END IF;

  -- An attribute we do not model is an empty list, so it FAILS rather than raises.
  UPDATE public.action_type_submission_criteria
     SET user_field = 'attribute', attribute_name = 'no-such-attribute'
   WHERE id = root;
  v := public.submission_criteria_verdict(at, '{}'::jsonb);
  IF v IS NULL THEN
    RAISE EXCEPTION 'an unmodelled attribute passed the condition; it must fail closed';
  END IF;

  DELETE FROM public.action_type_submission_criteria WHERE action_type_id = at;
  DELETE FROM public.action_types WHERE id = at;
END $$;

COMMIT;
