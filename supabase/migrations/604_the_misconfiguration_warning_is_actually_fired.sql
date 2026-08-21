-- 603's probe never ran: the database has no action type, so it took its own
-- early exit and printed "arm unproven here". A guard never seen to fire is not
-- a guard — CLAUDE.md says it twice, and 543 shipped a runner with no caller
-- while quoting the rule.
--
-- Nothing in the schema changes here. This migration exists to EXECUTE the arm
-- 603 added, on a scratch action type it creates and rolls back, so the arm is
-- measured firing rather than asserted to exist.
--
-- The three cases: the nested membership fires, an `all` over the same
-- condition does not, and a `none` over a NON-membership condition does not —
-- the last is the one that would have caught an arm written to the operator
-- alone, which is the shape 586's third arm got wrong.

DO $$
DECLARE
  v_ont    uuid;
  v_action uuid;
  v_none   uuid;
  v_inner  uuid;
  v_hits   int;
  v_base   int;
BEGIN
  BEGIN
    SELECT id INTO v_ont FROM public.ontologies ORDER BY created_at LIMIT 1;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'no ontology: 604 cannot prove 603''s arm, and pretending otherwise is the defect';
    END IF;

    SELECT count(*) INTO v_base FROM public.ontology_warnings() WHERE scope = 'submission_criteria';

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-604-not-over-membership', 'Probe 604')
    RETURNING id INTO v_action;

    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator)
    VALUES (v_action, NULL, 0, 'logical', 'none') RETURNING id INTO v_none;

    -- one level down, so the recursion is what finds it
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator)
    VALUES (v_action, v_none, 0, 'logical', 'all') RETURNING id INTO v_inner;

    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, template, user_field,
       operator, value_source, static_value)
    VALUES (v_action, v_inner, 0, 'condition', 'current_user', 'group_ids',
            'includes', 'static', '"x"'::jsonb);

    SELECT count(*) INTO v_hits FROM public.ontology_warnings() WHERE scope = 'submission_criteria';
    IF v_hits <> v_base + 1 THEN
      RAISE EXCEPTION 'a nested None over a group membership was not warned about: expected %, got %',
        v_base + 1, v_hits;
    END IF;

    -- an All over the same condition is not a misconfiguration
    UPDATE public.action_type_submission_criteria SET logical_operator = 'all' WHERE id = v_none;
    SELECT count(*) INTO v_hits FROM public.ontology_warnings() WHERE scope = 'submission_criteria';
    IF v_hits <> v_base THEN
      RAISE EXCEPTION 'an All over a group membership was warned about; the arm reads the operator only';
    END IF;

    -- and a None over a condition that is NOT a membership is not either
    UPDATE public.action_type_submission_criteria SET logical_operator = 'none' WHERE id = v_none;
    -- the operator moves with the field: a trigger refuses `includes` on a
    -- single value, which is the arity split submission_operators() publishes.
    UPDATE public.action_type_submission_criteria
       SET user_field = 'user_id', operator = 'is'
     WHERE node_type = 'condition' AND action_type_id = v_action;
    SELECT count(*) INTO v_hits FROM public.ontology_warnings() WHERE scope = 'submission_criteria';
    IF v_hits <> v_base THEN
      RAISE EXCEPTION 'a None over current_user.user_id was warned about; the page names groups, markings and organizations only';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '603''s arm fired on the nested membership and stayed silent on the other two';
  END;
END $$;
