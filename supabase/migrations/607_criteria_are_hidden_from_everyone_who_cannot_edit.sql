-- Submission criteria stop being visible to everyone who can see the ontology.
--
--   "action submission criteria are hidden from users who cannot edit action
--   types."
--   — action-types/dropdown-security.md
--
-- Ours were readable by any member: the policy tested can_read_action_type,
-- which is auth_in_ontology. Until 602-604 nothing rendered them, so the
-- divergence was latent; the criteria editor is the first thing that draws it.
--
-- NARROWING THE POLICY ALONE WOULD HAVE REMOVED THE GATE. Both evaluator
-- functions are INVOKER, so a user who can apply an action but not edit it
-- would read ZERO criterion rows, the verdict would come back NULL, and the
-- submission would pass — the constraint disappearing for exactly the people it
-- exists to constrain. That is why the two halves are one migration:
--
--   1. eval_criterion and submission_criteria_verdict become SECURITY DEFINER,
--      so evaluation no longer depends on the caller reading the tree. The
--      auth_* helpers read request.jwt.claims, which is a GUC and survives the
--      switch, so a criterion still evaluates for the CALLER.
--   2. the SELECT policy narrows to can_write_action_type.
--
-- AND A SECDEF FUNCTION NEEDS THE DOOR THE POLICY WAS. submission_criteria_verdict
-- is callable directly — it is the form's pre-check — so as owner it would have
-- answered for an action type in an ontology the caller cannot see, leaking the
-- failure messages it exists to show. It now asks can_read_action_type first
-- and refuses by the name apply_action already uses.
--
-- eval_criterion needs no such guard: it is reached only through the verdict,
-- and pg_proc says so — those two are the only functions whose source names it.
--
-- Both patched from pg_get_functiondef. SECURITY DEFINER added to each header,
-- the guard added after the verdict's BEGIN, and nothing else moved.

CREATE OR REPLACE FUNCTION public.eval_criterion(p_node uuid, p_action uuid, p_params jsonb, OUT passed boolean, OUT msg text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.submission_criteria_verdict(p_action_type uuid, p_parameters jsonb DEFAULT '{}'::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE root record; sub record;
BEGIN
  -- SECURITY DEFINER reads the tree regardless of the caller, so the entry
  -- has to ask the question the table's policy used to: this is the ONE door,
  -- and it stays shut for an action type the caller cannot see (607).
  IF NOT public.can_read_action_type(p_action_type) THEN
    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;

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
END $function$;

DROP POLICY "read criteria" ON public.action_type_submission_criteria;
CREATE POLICY "read criteria" ON public.action_type_submission_criteria
  FOR SELECT USING ((SELECT public.can_write_action_type(action_type_id)));

COMMENT ON POLICY "read criteria" ON public.action_type_submission_criteria IS
  'Editors only: "action submission criteria are hidden from users who cannot edit action types" (action-types/dropdown-security). Evaluation does not go through this policy — submission_criteria_verdict is SECURITY DEFINER.';

-- The gate has to still REFUSE when the caller cannot read a single row of it.
-- Probed as a member who is not an editor — claims, not rows, because a
-- migration's INSERTs commit and auth_role/auth_org_ids read the JWT anyway.
-- The owner bypasses RLS, so this SETs ROLE and the rollback restores both.
DO $$
DECLARE
  v_ont uuid;
  v_org uuid;
  v_at  uuid;
  v_uid uuid := gen_random_uuid();
  v_seen int;
  v_msg text;
BEGIN
  BEGIN
    SELECT o.id, so.organization_id INTO v_ont, v_org
      FROM public.ontologies o
      JOIN public.space_organizations so ON so.space_id = o.space_id
     ORDER BY o.created_at LIMIT 1;
    IF v_ont IS NULL THEN RAISE EXCEPTION 'no ontology in an org: 607 cannot prove its own gate'; END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-607-hidden-criteria', 'Probe 607') RETURNING id INTO v_at;

    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, template, user_field,
       operator, value_source, static_value, failure_message)
    VALUES (v_at, NULL, 0, 'condition', 'current_user', 'user_id', 'is',
            'static', to_jsonb(v_uid::text), 'Only the probe user may submit this.');

    SELECT count(*) INTO v_seen FROM public.action_type_submission_criteria
     WHERE action_type_id = v_at;
    IF v_seen <> 1 THEN RAISE EXCEPTION 'the probe criterion did not land'; END IF;

    -- a member of the org whose role is not owner or admin: can SEE the action
    -- type, cannot EDIT it, which is the exact user the page is about
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid(),
      'app_metadata', json_build_object('role', 'user', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;

    IF NOT public.can_read_action_type(v_at) THEN
      RAISE EXCEPTION 'the probe user cannot see the action type; this proves nothing about editing';
    END IF;
    IF public.can_write_action_type(v_at) THEN
      RAISE EXCEPTION 'the probe user can edit the action type; this proves nothing about hiding';
    END IF;

    SELECT count(*) INTO v_seen FROM public.action_type_submission_criteria
     WHERE action_type_id = v_at;
    IF v_seen <> 0 THEN
      RAISE EXCEPTION 'a non-editor read % criterion row(s); the policy did not narrow', v_seen;
    END IF;

    -- and the gate STILL fires, which is the half a policy change alone loses
    v_msg := public.submission_criteria_verdict(v_at, '{}'::jsonb);
    IF v_msg IS DISTINCT FROM 'Only the probe user may submit this.' THEN
      RAISE EXCEPTION 'the gate went quiet for a caller who cannot read it: verdict was %',
        coalesce(v_msg, 'NULL');
    END IF;

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'hidden from a non-editor who can see the action type, and still refusing them by the criterion''s own message';
  END;
END $$;
