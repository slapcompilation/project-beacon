-- Frontend consumers: the second card on the Security & Submission Criteria
-- tab, found while crawling for the authoring wizard.
--
-- 607 built the first card on that tab. `effect-actions-submittable-by-automate.png`
-- shows all three — Submission criteria, Frontend consumers, and Notification
-- failure settings — so the tab I built one section of has two more.
--
--   "Not all actions are appropriate to use with Automate. You can disable an
--   action from being usable in Automate once you configure the action type in
--   Ontology Manager."
--   — automate/effect-actions.md
--
-- and the control the image draws is a single labelled switch:
--
--   "Allow Foundry Automate to submit this action"
--   — automate/images/effect-actions-submittable-by-automate.png
--
-- DEFAULT TRUE, because the prose is about DISABLING ("you can disable an
-- action from being usable") and the image's toggle is on. An action is
-- submittable by Automate until someone says otherwise.
--
-- WHY A BOOLEAN AND NOT A TABLE. Foundry's section is a SET of consumers —
-- object-monitors/actions describes the same card with a second switch, "Allow
-- An Object Monitor To Submit This Action". We have exactly one frontend
-- consumer, Automate, and no object monitors at all. A join table with one
-- possible row would be the generic-table mistake in miniature; the column is
-- named for the consumer it gates so a second one is a second column and an
-- obvious rename, not a silent widening.
--
-- WHERE IT IS ENFORCED. Both ends, because they fail differently:
--   · authoring — a trigger refuses an effect that names a refused action, so
--     the wizard cannot build something that will never run;
--   · running   — run_automations already refuses a non-executable KIND by
--     name; this is the same shape for a refused ACTION, and it matters because
--     the toggle can be turned off after the effect exists.

ALTER TABLE public.action_types
  ADD COLUMN automate_can_submit boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.action_types.automate_can_submit IS
  'The Frontend consumers switch on the Security & Submission Criteria tab: "Allow Foundry Automate to submit this action" (automate/effect-actions). True until someone disables it.';

CREATE OR REPLACE FUNCTION public.guard_effect_action_consumer()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.action_type_id IS NOT NULL
     AND NOT (SELECT a.automate_can_submit FROM public.action_types a
               WHERE a.id = NEW.action_type_id) THEN
    RAISE EXCEPTION 'Automate:ActionNotSubmittableByAutomate — this action type does not allow Foundry Automate to submit it'
      USING HINT = 'Turn on "Allow Foundry Automate to submit this action" under Frontend consumers on the action type''s Security & Submission Criteria tab.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_effect_action_consumer
  BEFORE INSERT OR UPDATE OF action_type_id ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_effect_action_consumer();

-- The runner, patched from pg_get_functiondef: one refusal added beside the
-- not-executable one it copies. Nothing else in the body moved.
CREATE OR REPLACE FUNCTION public.run_automations(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a record; e record; before text; fired text[]; members jsonb;
        ran int := 0; run_id uuid;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-automations')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR a IN SELECT * FROM public.automation_candidates() LOOP
    -- "Condition evaluation: Uses automation owner's permissions" — and now
    -- the role makes that true rather than merely claimed.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', a.runner_id::text,
        'app_metadata', json_build_object('role', a.runner_role, 'org_id', a.runner_org))::text, true);

    BEGIN
      fired := public.automation_fires(a.id, p_at);
    EXCEPTION WHEN OTHERS THEN
      fired := NULL;
    END;

    IF fired IS NOT NULL THEN
      -- "the condition continues to be evaluated and activity is still
      -- recorded. However, no effects will be triggered." The run row is
      -- still written; `skipped` is the outcome 517 allowed and nothing
      -- had ever produced (609).
      IF (SELECT m.muted FROM public.automations m WHERE m.id = a.id) THEN
        FOR e IN SELECT * FROM public.automation_effect_rows(a.id, NULL) LOOP
          PERFORM public.settle_automation_run(
            public.record_automation_run(a.id, e.id), 'skipped', NULL, NULL);
        END LOOP;
        ran := ran + 1;
        CONTINUE;
      END IF;

      <<effects>>
      FOR e IN SELECT * FROM public.automation_effect_rows(a.id, NULL) LOOP
        -- Recorded BEFORE the attempt. At-least-once is the promise.
        run_id := public.record_automation_run(a.id, e.id);
        BEGIN
          IF NOT coalesce((SELECT k.executable FROM public.automation_effect_kinds() k
                            WHERE k.kind = e.kind), false) THEN
            RAISE EXCEPTION 'Automate:EffectNotExecutable — % effects are not built', e.kind;
          END IF;
          -- The toggle can be turned off after the effect exists, so the
          -- authoring guard is not enough on its own (612).
          IF e.action_type_id IS NOT NULL
             AND NOT (SELECT t.automate_can_submit FROM public.action_types t
                       WHERE t.id = e.action_type_id) THEN
            RAISE EXCEPTION 'Automate:ActionNotSubmittableByAutomate — this action type does not allow Foundry Automate to submit it';
          END IF;
          IF (SELECT k.runtime FROM public.automation_effect_kinds() k WHERE k.kind = e.kind) <> 'sql' THEN
            RAISE EXCEPTION 'Automate:WrongRuntime — a % effect is executed by the action runtime, which owns the isolate', e.kind;
          END IF;
          PERFORM public.apply_action(e.action_type_id, e.parameters);
          PERFORM public.settle_automation_run(run_id, 'succeeded', NULL, NULL);
        EXCEPTION WHEN OTHERS THEN
          -- Only a RETRYABLE failure on an effect that configured retries
          -- withholds the fallback; an unconfigured effect falls back at once.
          PERFORM public.settle_automation_run(run_id,
            CASE WHEN e.retry_count IS NOT NULL AND public.automation_error_retryable(sqlerrm)
                 THEN 'awaiting_retry' ELSE 'failed' END,
            sqlerrm,
            CASE WHEN e.retry_count IS NOT NULL AND public.automation_error_retryable(sqlerrm)
                 THEN public.automation_retry_due(e.id, 1) END);

          DECLARE f record; fid uuid; held boolean;
          BEGIN
            held := e.retry_count IS NOT NULL AND public.automation_error_retryable(sqlerrm);
            IF NOT held THEN
              FOR f IN SELECT * FROM public.automation_effect_rows(a.id, e.id) LOOP
                fid := public.record_automation_run(a.id, f.id);
                BEGIN
                  PERFORM public.apply_action(f.action_type_id, f.parameters);
                  PERFORM public.settle_automation_run(fid, 'succeeded', NULL, NULL);
                EXCEPTION WHEN OTHERS THEN
                  PERFORM public.settle_automation_run(fid, 'failed', sqlerrm, NULL);
                END;
              END LOOP;
            END IF;
          END;
        END;
        -- Sequential stops here. Parallel does not, and is the default
        -- whenever sequential is not configurable (611).
        IF (SELECT m.execution FROM public.automations m WHERE m.id = a.id) = 'sequential' THEN
          EXIT effects;
        END IF;
      END LOOP;
      ran := ran + 1;
    END IF;

    -- Membership is remembered whether or not it fired — computed HERE, as
    -- the owner, so the snapshot is what the owner could actually see.
    IF a.condition->>'type' <> 'time' THEN
      members := to_jsonb(public.object_set_keys((a.condition->>'object_set_id')::uuid,
                   public.automation_input_limit(a.condition->>'type')));
      PERFORM public.record_automation_state(a.id, members, fired IS NOT NULL, p_at);
    ELSE
      PERFORM public.record_automation_state(a.id, NULL, fired IS NOT NULL, p_at);
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RETURN ran;
END $function$;

-- Both ends proved by doing them, and by contrast: an allowed action is
-- accepted and runs; a refused one is refused at authoring; and one refused
-- AFTER the effect exists is refused at run time, which is the case the
-- authoring guard cannot cover.
DO $$
DECLARE
  v_ont uuid; v_proj uuid; v_owner uuid; v_at uuid; v_a uuid; v_n int;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_ont IS NULL OR v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no ontology, project or user: 612 cannot prove its own guards';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-612-consumer', 'Probe 612') RETURNING id INTO v_at;
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 612', v_owner,
            '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);

    -- (1) default true: the effect is accepted
    INSERT INTO public.automation_effects (automation_id, kind, action_type_id)
    VALUES (v_a, 'action', v_at);

    -- (2) turn the toggle off and a NEW effect is refused at authoring, by name
    UPDATE public.action_types SET automate_can_submit = false WHERE id = v_at;
    BEGIN
      INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
      VALUES (v_a, 1, 'action', v_at);
      RAISE EXCEPTION 'an effect was authored against an action Automate may not submit';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Automate:ActionNotSubmittableByAutomate%' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claims', '', true);

    -- (3) the effect authored in (1) still exists, and the RUNNER refuses it —
    -- the case the authoring guard cannot reach, because the toggle moved after
    PERFORM public.run_automations(date_trunc('minute', now()));
    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome = 'failed'
       AND r.error LIKE 'Automate:ActionNotSubmittableByAutomate%';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the runner did not refuse a now-forbidden action: % matching run(s)', v_n;
    END IF;

    -- (4) and with the toggle back on it runs, so the refusal is not blanket
    DELETE FROM public.automation_runs WHERE automation_id = v_a;
    UPDATE public.action_types SET automate_can_submit = true WHERE id = v_at;
    UPDATE public.automations SET last_run_at = NULL WHERE id = v_a;
    PERFORM public.run_automations(date_trunc('minute', now()));
    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome = 'succeeded';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'with the toggle on the effect did not run: % succeeded', v_n;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'allowed by default; refused at authoring once off; refused at run time when turned off later; ran again when turned back on';
  END;
END $$;
