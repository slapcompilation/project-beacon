-- The objects that fired an automation reach its effects.
--
-- `automation_fires` has returned the triggering object keys since 517 and
-- `run_automations` has thrown them away ever since — it reads `fired IS NOT
-- NULL` and discards the array. The engine computes the answer and drops it,
-- which is this repository's dominant defect in its purest form.
--
--   "Some object set conditions expose effect inputs. These can be used in the
--   action effect. To use condition effect inputs, the type of the action
--   parameter needs to align with the type of the exposed condition effect
--   input."
--   — automate/effect-actions.md
--
-- ── WHICH CONDITIONS, AND AN OPEN QUESTION THIS CLOSES ──────────────────────
-- The page ENUMERATES them, so the enumeration is the rule: Objects added to
-- set, Objects removed from set, Objects modified in set. `Run on all objects`
-- is NOT among them.
--
-- That answers a question the automate reading has carried open since #756:
-- whether `Run on all objects` really exposes an effect input, given that the
-- condition picker labels it with an Objects-from-set chip. The chip and this
-- enumeration disagree, and an enumeration beats a chip for the same reason it
-- beats a description. So run_on_all is refused here BY NAME, and the reading's
-- question is answered rather than still open.
--
-- `objects_modified` is on the page's list and is unreachable here for a
-- separate reason: it is live-monitoring only, which Decision 4 refused. The
-- guard admits it anyway, because the rule is about which conditions expose
-- inputs, not about which conditions we run.
--
-- ── WHICH INPUT KIND, AND WHY ONLY ONE ──────────────────────────────────────
-- Four are published: Object set, Object list, Single object, Property
-- reference. Only **Single object** is expressible here, and that is a fact
-- about our action parameters rather than a decision: `data_kind` admits
-- `base_type`, `object`, `interfaceObject` and `objectType`, and none of those
-- is a set or a list. An action here cannot declare a parameter that takes many
-- objects, so there is nothing for an object-set input to bind to.
--
-- That also settles the execution modes without choosing between them:
--
--   "The use of single object and property reference inputs means that each
--   action is executed once for each object from the condition."
--   — automate/effect-actions.md
--
-- so a single-object input IS per-object execution. The three grouping modes —
-- once for all, per batch, per group — are the multi-object branch, and they
-- are unbuildable until a parameter can hold a set. Not a decision, an
-- arithmetic consequence, and it is why this file does not add a mode column.
--
-- ── THE PUBLISHED CAP, WITH ITS PUBLISHED BEHAVIOUR ─────────────────────────
--   "Max number of objects per automation evaluation for scheduled automations
--   when per-object execution is enabled | 10,000 | Runtime error during
--   evaluation before any effects are executed; no objects are processed"
--   — automate/limits.md
--
-- Both halves are built: the number, and the "before any effects are executed"
-- — the check runs ahead of the loop, so a set of 10,001 executes nothing at
-- all rather than 10,000 things and then a failure.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- Property reference inputs (the fourth kind) need a parameter bound to a
-- property of the triggering object, and `action_type_parameters` has no
-- property reference. Object set and object list, as above. Parallelisation,
-- which the page offers beside per-object execution, is a scheduling knob on a
-- runner that processes one automation at a time in one transaction.

ALTER TABLE public.automation_effects
  ADD COLUMN object_input_parameter_id uuid
    REFERENCES public.action_type_parameters(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.automation_effects.object_input_parameter_id IS
  'The action parameter that receives each object the condition fired on — Foundry''s "Single object" effect input. Non-null means per-object execution: "each action is executed once for each object from the condition" (automate/effect-actions).';

-- One run row per object, because that is what the history view shows: "you can
-- also choose the object that triggered the effect to view it in Object
-- Explorer" (automate/history). A single row per effect would make a partial
-- failure unreadable.
ALTER TABLE public.automation_runs ADD COLUMN object_key text;

COMMENT ON COLUMN public.automation_runs.object_key IS
  'Which object this execution was for, under per-object execution. NULL when the effect ran once for the whole event.';

CREATE OR REPLACE FUNCTION public.automation_per_object_limit()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 10000 $$;

COMMENT ON FUNCTION public.automation_per_object_limit() IS
  'Max objects per evaluation when per-object execution is enabled (automate/limits). Exceeding it is an error BEFORE any effects execute; no objects are processed.';

-- record_automation_run gains the object. Dropped and recreated rather than
-- overloaded: two functions differing by a defaulted argument make every
-- shorter call ambiguous at runtime. 623's grant lesson applies on the way out.
DROP FUNCTION public.record_automation_run(uuid, uuid, uuid);

CREATE FUNCTION public.record_automation_run(
  p_automation uuid, p_effect uuid, p_event uuid DEFAULT NULL,
  p_object_key text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.automation_runs
    (automation_id, effect_id, outcome, event_id, object_key)
  VALUES (p_automation, p_effect, 'started', p_event, p_object_key) RETURNING id
$$;

REVOKE ALL ON FUNCTION public.record_automation_run(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_automation_run(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_automation_run(uuid, uuid, uuid, text) TO beacon_runner;

-- The binding's rules, in both directions: an effect cannot acquire a binding
-- its automation's condition does not support, and an automation cannot change
-- its condition out from under an existing binding.
CREATE OR REPLACE FUNCTION public.guard_effect_input()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_cond jsonb; v_set uuid; v_subject uuid; par record; v_bad int;
BEGIN
  IF TG_TABLE_NAME = 'automations' THEN
    SELECT count(*) INTO v_bad
      FROM public.automation_effects e
     WHERE e.automation_id = NEW.id AND e.object_input_parameter_id IS NOT NULL;
    IF v_bad > 0 AND (NEW.condition->>'type') NOT IN
       ('objects_added', 'objects_removed', 'objects_modified') THEN
      RAISE EXCEPTION 'Automate:ConditionExposesNoInput — % effect(s) bind an object input, and a % condition exposes none',
        v_bad, NEW.condition->>'type';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.object_input_parameter_id IS NULL THEN RETURN NEW; END IF;

  SELECT a.condition INTO v_cond FROM public.automations a WHERE a.id = NEW.automation_id;

  -- "The following conditions expose effect inputs" — three of them, and
  -- `Run on all objects` is deliberately not one.
  IF (v_cond->>'type') NOT IN ('objects_added', 'objects_removed', 'objects_modified') THEN
    RAISE EXCEPTION 'Automate:ConditionExposesNoInput — a % condition exposes no effect input', v_cond->>'type'
      USING HINT = 'Objects added, Objects removed and Objects modified expose one; Run on all objects and Time do not.';
  END IF;

  SELECT * INTO par FROM public.action_type_parameters WHERE id = NEW.object_input_parameter_id;
  IF par.id IS NULL OR par.action_type_id IS DISTINCT FROM NEW.action_type_id THEN
    RAISE EXCEPTION 'Automate:ParameterNotOnThisAction — the bound parameter does not belong to this effect''s action type';
  END IF;

  -- "the type of the action parameter needs to align with the type of the
  -- exposed condition effect input" — first that it takes an object at all,
  IF par.data_kind <> 'object' THEN
    RAISE EXCEPTION 'Automate:InputTypeMismatch — parameter % takes a %, and a Single object input needs an object parameter',
      par.api_name, par.data_kind;
  END IF;

  -- and then that it takes the SAME object type the condition watches.
  v_set := (v_cond->>'object_set_id')::uuid;
  SELECT s.subject_type_id INTO v_subject FROM public.object_sets s WHERE s.id = v_set;
  IF v_subject IS NOT NULL AND par.object_type_id IS DISTINCT FROM v_subject THEN
    RAISE EXCEPTION 'Automate:InputTypeMismatch — parameter % takes a different object type than the condition watches',
      par.api_name;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_effect_input
  BEFORE INSERT OR UPDATE OF object_input_parameter_id, action_type_id
  ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_effect_input();

CREATE TRIGGER guard_effect_input_survives_condition_change
  BEFORE UPDATE OF condition ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_effect_input();

-- Per-object execution, in its own function because the failure semantics
-- differ: each object is its own execution, so one object failing settles that
-- object's run and the next object still runs. The outer loop's handler treats
-- a failed effect as one thing; that is right for a single execution and wrong
-- for a hundred.
CREATE OR REPLACE FUNCTION public.run_effect_per_object(
  p_automation uuid, p_effect uuid, p_event uuid, p_keys text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE e record; par text; k text; rid uuid; n int := 0;
BEGIN
  SELECT * INTO e FROM public.automation_effects WHERE id = p_effect;
  SELECT api_name INTO par FROM public.action_type_parameters
   WHERE id = e.object_input_parameter_id;
  IF par IS NULL THEN
    RAISE EXCEPTION 'Automate:InputUnbound — the effect names no object input parameter';
  END IF;

  FOREACH k IN ARRAY coalesce(p_keys, '{}') LOOP
    rid := public.record_automation_run(p_automation, p_effect, p_event, k);
    BEGIN
      PERFORM public.apply_action(e.action_type_id,
        coalesce(e.parameters, '{}'::jsonb) || jsonb_build_object(par, k));
      PERFORM public.settle_automation_run(rid, 'succeeded', NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.settle_automation_run(rid, 'failed', sqlerrm, NULL);
    END;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.run_effect_per_object(uuid, uuid, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_effect_per_object(uuid, uuid, uuid, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_effect_per_object(uuid, uuid, uuid, text[]) TO beacon_runner;

-- Patched from the live definition at three anchors, each asserted.
DO $$
DECLARE d text; p text; n int;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF position('run_effect_per_object' in d) > 0 THEN
    RAISE NOTICE 'run_automations already passes the fired objects to its effects';
    RETURN;
  END IF;
  p := d;

  -- (1) The cap, where the page puts it: at EVALUATION, before any effect runs.
  -- "Runtime error during evaluation before any effects are executed; no
  -- objects are processed" — so this aborts the firing rather than truncating.
  n := length(p);
  p := replace(p,
    '      ev := public.record_automation_event(a.id, ''automation_triggered'');',
    '      ev := public.record_automation_event(a.id, ''automation_triggered'');' || chr(10) ||
    '      IF cardinality(fired) > public.automation_per_object_limit()' || chr(10) ||
    '         AND EXISTS (SELECT 1 FROM public.automation_effect_rows(a.id, NULL) x' || chr(10) ||
    '                      WHERE x.object_input_parameter_id IS NOT NULL) THEN' || chr(10) ||
    '        PERFORM public.record_automation_event(a.id, ''evaluation_failed'',' || chr(10) ||
    '          format(''Automate:PerObjectInputTooLarge — %s objects exceeds the %s permitted with per-object execution; no objects were processed'',' || chr(10) ||
    '                 cardinality(fired), public.automation_per_object_limit()));' || chr(10) ||
    '        PERFORM public.mark_automation_event_executed(ev, p_at);' || chr(10) ||
    '        ran := ran + 1;' || chr(10) ||
    '        CONTINUE;' || chr(10) ||
    '      END IF;');
  IF length(p) = n THEN RAISE EXCEPTION '630: the firing branch is not where it was'; END IF;

  -- (2) A per-object effect opens its run rows itself, one per object.
  n := length(p);
  p := replace(p,
    '        run_id := public.record_automation_run(a.id, e.id, ev);',
    '        run_id := NULL;' || chr(10) ||
    '        IF e.object_input_parameter_id IS NULL THEN' || chr(10) ||
    '          run_id := public.record_automation_run(a.id, e.id, ev);' || chr(10) ||
    '        END IF;');
  IF length(p) = n THEN RAISE EXCEPTION '630: the run-recording call is not where it was'; END IF;

  -- (3) and the apply itself forks.
  n := length(p);
  p := replace(p,
    '          PERFORM public.apply_action(e.action_type_id, e.parameters);' || chr(10) ||
    '          PERFORM public.settle_automation_run(run_id, ''succeeded'', NULL, NULL);',
    '          IF e.object_input_parameter_id IS NULL THEN' || chr(10) ||
    '            PERFORM public.apply_action(e.action_type_id, e.parameters);' || chr(10) ||
    '            PERFORM public.settle_automation_run(run_id, ''succeeded'', NULL, NULL);' || chr(10) ||
    '          ELSE' || chr(10) ||
    '            PERFORM public.run_effect_per_object(a.id, e.id, ev, fired);' || chr(10) ||
    '          END IF;');
  IF length(p) = n THEN RAISE EXCEPTION '630: the apply_action call is not where it was'; END IF;

  EXECUTE p;
  RAISE NOTICE 'run_automations now hands each fired object to the effects that bind one';
END $$;

-- WHAT THIS PROBE PROVES AND WHAT IT DOES NOT, said plainly rather than
-- implied. The binding rules are proved by doing them, in both directions. The
-- per-object EXECUTION is proved by calling `run_effect_per_object` with real
-- keys — the same function the runner calls — so the loop, the parameter
-- injection, the one-run-row-per-object and the per-object failure isolation
-- are all executed. What is NOT executed here is the runner's dispatch to it,
-- which needs an object set with indexed objects behind it; that is asserted
-- textually and belongs to the platform suite.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_ot uuid; v_other uuid; v_set uuid;
  v_at uuid; v_pobj uuid; v_pstr uuid; v_pwrong uuid; v_a uuid; v_e uuid;
  v_err text; v_rows int; v_def text;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project, ontology or user: 630 cannot prove its own rules';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Fired630', 'Fired 630') RETURNING id INTO v_ot;
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Other630', 'Other 630') RETURNING id INTO v_other;
    INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id)
    VALUES ('Fired 630 set', 'fired630set', v_ot, v_proj, v_ont) RETURNING id INTO v_set;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-630', 'Probe 630') RETURNING id INTO v_at;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, object_type_id)
    VALUES (v_at, 'theObject', 'The object', 'object', v_ot) RETURNING id INTO v_pobj;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, base_type)
    VALUES (v_at, 'aString', 'A string', 'base_type', 'string') RETURNING id INTO v_pstr;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, object_type_id)
    VALUES (v_at, 'wrongType', 'Wrong type', 'object', v_other) RETURNING id INTO v_pwrong;

    -- A TIME condition first: it exposes nothing, and must refuse BY NAME.
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 630', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);

    v_err := NULL;
    BEGIN
      INSERT INTO public.automation_effects
        (automation_id, position, kind, action_type_id, object_input_parameter_id)
      VALUES (v_a, 0, 'action', v_at, v_pobj);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Automate:ConditionExposesNoInput%' THEN
      RAISE EXCEPTION 'a time condition accepted an effect input (%)', coalesce(v_err, 'no error');
    END IF;

    -- RUN ON ALL OBJECTS is the one the picker's chip disagrees about.
    UPDATE public.automations SET condition = jsonb_build_object(
      'type', 'run_on_all', 'object_set_id', v_set,
      'schedule', jsonb_build_object('cron', '0 3 * * *', 'timezone', 'UTC'))
     WHERE id = v_a;
    v_err := NULL;
    BEGIN
      INSERT INTO public.automation_effects
        (automation_id, position, kind, action_type_id, object_input_parameter_id)
      VALUES (v_a, 0, 'action', v_at, v_pobj);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Automate:ConditionExposesNoInput%' THEN
      RAISE EXCEPTION 'run_on_all accepted an effect input; the page enumerates three and it is not one';
    END IF;

    -- OBJECTS ADDED does expose one. Now the type rules, both wrong shapes.
    UPDATE public.automations SET condition = jsonb_build_object(
      'type', 'objects_added', 'object_set_id', v_set,
      'schedule', jsonb_build_object('cron', '0 3 * * *', 'timezone', 'UTC'))
     WHERE id = v_a;

    v_err := NULL;
    BEGIN
      INSERT INTO public.automation_effects
        (automation_id, position, kind, action_type_id, object_input_parameter_id)
      VALUES (v_a, 0, 'action', v_at, v_pstr);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Automate:InputTypeMismatch%' THEN
      RAISE EXCEPTION 'a base_type parameter accepted a Single object input';
    END IF;

    v_err := NULL;
    BEGIN
      INSERT INTO public.automation_effects
        (automation_id, position, kind, action_type_id, object_input_parameter_id)
      VALUES (v_a, 0, 'action', v_at, v_pwrong);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Automate:InputTypeMismatch%' THEN
      RAISE EXCEPTION 'a parameter of the wrong object type was accepted';
    END IF;

    -- and the aligned one is ACCEPTED, so the guard is not blanket
    INSERT INTO public.automation_effects
      (automation_id, position, kind, action_type_id, object_input_parameter_id)
    VALUES (v_a, 0, 'action', v_at, v_pobj) RETURNING id INTO v_e;

    -- the condition cannot be moved out from under it
    v_err := NULL;
    BEGIN
      UPDATE public.automations SET condition =
        '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb WHERE id = v_a;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Automate:ConditionExposesNoInput%' THEN
      RAISE EXCEPTION 'the condition was switched to time while an effect bound an input';
    END IF;
    PERFORM set_config('request.jwt.claims', '', true);

    -- EXECUTION: two objects in, two run rows out, each naming its object.
    PERFORM public.run_effect_per_object(v_a, v_e, NULL, ARRAY['key-a', 'key-b']);
    SELECT count(*) INTO v_rows FROM public.automation_runs r
     WHERE r.effect_id = v_e AND r.object_key IN ('key-a', 'key-b');
    IF v_rows <> 2 THEN
      RAISE EXCEPTION 'per-object execution produced % run row(s) for two objects', v_rows;
    END IF;

    -- Both failed, because probe-630 has no rules to apply — which is the point:
    -- the SECOND object still ran after the first failed. One shared handler
    -- would have stopped at the first.
    SELECT count(*) INTO v_rows FROM public.automation_runs r
     WHERE r.effect_id = v_e AND r.object_key IS NOT NULL AND r.outcome = 'failed';
    IF v_rows <> 2 THEN
      RAISE EXCEPTION 'a failure on the first object stopped the second (% failed rows)', v_rows;
    END IF;

    -- and the runner dispatches to it, asserted textually because the end-to-end
    -- path needs an indexed object set.
    v_def := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
    IF position('run_effect_per_object' in v_def) = 0
       OR position('automation_per_object_limit' in v_def) = 0 THEN
      RAISE EXCEPTION 'the runner does not reach per-object execution or its cap';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '630 proved: time and run_on_all refused, both type mismatches refused, aligned accepted, condition locked, and two objects produced two isolated runs';
  END;
END $$;
