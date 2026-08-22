-- Manual execution, which has been a disabled button on our own screen since
-- #745 and a named blocker in three places since 620.
--
--   "You can manually run automations on existing object sets. This is useful
--   for backfilling data or testing automations before a wider release."
--   — automate/manual-execution.md
--
-- ── WHY THIS SHAPE, AND WHY THE OBVIOUS ONE WAS REFUSED ─────────────────────
-- 620 tried to build this as a function that runs the effects inline, and it
-- failed on `permission denied for function automation_effect_rows`. The reason
-- is structural: the run ledger has ONE writer. `automation_runs` carries a
-- SELECT policy and no INSERT or UPDATE policy at all, and the ledger helpers
-- are SECURITY DEFINER granted to `beacon_runner` alone — 553's fix, which
-- inverted the scheduled path rather than elevating around it.
--
-- Both ways out of that undo 553: widen those grants to `authenticated`, which
-- is a forgery surface on the ledger; or make the entry point SECURITY DEFINER,
-- which would also elevate `apply_action` and let an editor cause writes they
-- could never make themselves.
--
-- THE PAGES DESCRIBE A THIRD WAY, and it dissolves the problem. A manual run is
-- an EVENT that a queue drains:
--
--   "Max time an automation event can wait in execution queue"
--   — automate/limits.md
--
--   "When many events are triggered in quick succession, they enter the queue
--   in trigger order and begin executing in trigger order, but may not complete
--   in trigger order depending on each event's runtime."
--   — automate/limits.md
--
-- So `execute_automation_now` ENQUEUES and `beacon_runner` executes. The entry
-- point may now be SECURITY DEFINER safely, because it contains no
-- `apply_action` to elevate — it writes one row and returns. The ledger keeps
-- its single writer and 553 stands.
--
-- ── WHAT A QUEUED EVENT IS ──────────────────────────────────────────────────
-- 622's `automation_events` already holds one row per firing. A queued event is
-- one whose effects have not run yet, so `executed_at IS NULL` says it, and
-- `requested_by` says a person asked rather than the clock. Existing rows are
-- backfilled as executed, because they were.
--
--   "Max time an automation event can wait in execution queue | 45 mins | The
--   event is terminated and none of the effects execute"
--   — automate/limits.md
--
-- is built here. The neighbouring 4-hour run ceiling is NOT: our effects run
-- inside one transaction on one tick, so there is no long-running execution to
-- time out, and building a timer for a thing that cannot happen would be
-- decoration.
--
-- ── WHO IT RUNS AS, AND I CHANGED MY MIND ───────────────────────────────────
-- 620's header argued a manual run should execute as the CALLER, on the
-- strength of "Manual executions are considered run by the user who selects
-- Execute" and the sentence about the object set being read with the
-- initiator's token. With the queue that reading gets worse, not better: the
-- drain happens on a later tick, in the runner, and there is no caller present
-- to be. The general rule applies —
--
--   "Regardless of scoping mode, automations execute as the owner."
--   — automate/history-visibility-and-scope.md
--
-- — the effects execute as the owner, and `requested_by` records the person, so
-- the attribution the manual-execution page asks for survives without an
-- identity swap. The object-set half does not bite because we have no effect
-- inputs at all; when they exist, this is the decision to revisit.
--
-- ── "IMMEDIATELY", WHICH WE ARE NOT ─────────────────────────────────────────
-- "configured effects for that automation will be triggered immediately". Ours
-- waits for the next minute-hand tick, so up to sixty seconds. Named rather
-- than glossed: it is well inside the 45-minute ceiling the same section
-- publishes, and closing it would mean a second execution path beside the
-- runner, which is the thing this design exists to avoid.

ALTER TABLE public.automation_events
  ADD COLUMN executed_at timestamptz,
  ADD COLUMN requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.automation_events.executed_at IS
  'When the effects of this event ran. NULL means it is still waiting in the execution queue (automate/limits).';
COMMENT ON COLUMN public.automation_events.requested_by IS
  'The person who pressed Execute. NULL means the scheduler. "Manual executions are considered run by the user who selects Execute in the Automate interface" (automate/manual-execution) — recorded as attribution, since the effects execute as the owner.';

-- Everything that already exists ran on the tick that recorded it.
UPDATE public.automation_events SET executed_at = occurred_at WHERE executed_at IS NULL;

CREATE INDEX automation_events_queued
  ON public.automation_events (occurred_at) WHERE executed_at IS NULL;

-- The runner marks an event done. SECURITY DEFINER, granted to the runner
-- alone, and explicitly revoked from `authenticated` — 623's lesson, that
-- Supabase's default privileges grant EXECUTE to that role by name so a
-- REVOKE FROM PUBLIC does not reach it.
CREATE OR REPLACE FUNCTION public.mark_automation_event_executed(
  p_event uuid, p_at timestamptz, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.automation_events
     SET executed_at = p_at, detail = coalesce(p_detail, detail)
   WHERE id = p_event
$$;

REVOKE ALL ON FUNCTION public.mark_automation_event_executed(uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_automation_event_executed(uuid, timestamptz, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_automation_event_executed(uuid, timestamptz, text) TO beacon_runner;

-- What the runner drains, and in the order the page states: "they enter the
-- queue in trigger order and begin executing in trigger order".
CREATE OR REPLACE FUNCTION public.queued_automation_events(p_at timestamptz)
RETURNS TABLE(event_id uuid, automation_id uuid, waited interval,
              runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT e.id, e.automation_id, p_at - e.occurred_at, u.id, u.role, u.organization_id
    FROM public.automation_events e
    JOIN public.automations a ON a.id = e.automation_id
    JOIN public.users u ON u.id = a.owner_id
   WHERE e.executed_at IS NULL
     -- "Expired, trashed, and otherwise disabled automations continue to block
     -- all execution, including manual runs." Paused is deliberately absent.
     AND (a.expires_at IS NULL OR a.expires_at > p_at)
   ORDER BY e.occurred_at
   LIMIT 25
$$;

REVOKE ALL ON FUNCTION public.queued_automation_events(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queued_automation_events(timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.queued_automation_events(timestamptz) TO beacon_runner;

-- The entry point. SECURITY DEFINER is safe HERE and nowhere near the effects:
-- it writes one row. Because it is DEFINER, RLS does not decide for it, so it
-- authorizes explicitly — which is the one place restating a policy predicate
-- is correct rather than lazy. `project_role()` reads `auth.uid()` from the
-- claims GUC, so it still answers for the CALLER inside this frame.
CREATE OR REPLACE FUNCTION public.execute_automation_now(p_automation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE a record; v_event uuid;
BEGIN
  SELECT * INTO a FROM public.automations WHERE id = p_automation;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Automate:AutomationNotFound — % is not an automation', p_automation;
  END IF;

  -- "Users must have Compass edit permissions on the Automate resource to
  -- manually execute an automation."
  IF public.role_rank(public.project_role(a.project_id)) < public.role_rank('editor') THEN
    RAISE EXCEPTION 'Automate:NotAnEditor — manual execution needs edit permission on the automation'
      USING HINT = 'Compass edit permissions on the Automate resource.';
  END IF;

  -- "Expired, trashed, and otherwise disabled automations continue to block all
  -- execution, including manual runs." Paused is NOT on that list:
  -- "You can manually execute paused automations."
  IF a.expires_at IS NOT NULL AND a.expires_at <= now() THEN
    RAISE EXCEPTION 'Automate:AutomationExpired — an expired automation blocks all execution, manual runs included'
      USING HINT = 'Extend or clear the expiration date first.';
  END IF;

  INSERT INTO public.automation_events (automation_id, event_type, requested_by)
  VALUES (p_automation, 'automation_triggered', auth.uid())
  RETURNING id INTO v_event;
  RETURN v_event;
END $function$;

COMMENT ON FUNCTION public.execute_automation_now(uuid) IS
  'Queues a manual run. The effects are executed by beacon_runner on the next tick, as the owner; requested_by records who asked. Allowed while paused, refused when expired (automate/manual-execution).';

REVOKE ALL ON FUNCTION public.execute_automation_now(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_automation_now(uuid) TO authenticated;

-- The drain, added to the runner ahead of its own loop so a queued event is not
-- held behind a minute of scheduled work. Patched from the live definition.
DO $$
DECLARE d text; p text;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF position('queued_automation_events' in d) > 0 THEN
    RAISE NOTICE 'run_automations already drains the queue';
    RETURN;
  END IF;

  p := replace(d,
    '  FOR a IN SELECT * FROM public.automation_candidates() LOOP',
    '  -- The execution queue, drained first. "they enter the queue in trigger' || chr(10) ||
    '  -- order and begin executing in trigger order".' || chr(10) ||
    '  FOR q IN SELECT * FROM public.queued_automation_events(p_at) LOOP' || chr(10) ||
    '    IF q.waited > interval ''45 minutes'' THEN' || chr(10) ||
    '      -- "The event is terminated and none of the effects execute."' || chr(10) ||
    '      PERFORM public.mark_automation_event_executed(q.event_id, p_at,' || chr(10) ||
    '        ''Terminated: waited longer than 45 minutes in the execution queue'');' || chr(10) ||
    '      CONTINUE;' || chr(10) ||
    '    END IF;' || chr(10) ||
    '' || chr(10) ||
    '    -- "Regardless of scoping mode, automations execute as the owner."' || chr(10) ||
    '    PERFORM set_config(''request.jwt.claims'',' || chr(10) ||
    '      json_build_object(''sub'', q.runner_id::text,' || chr(10) ||
    '        ''app_metadata'', json_build_object(''role'', q.runner_role, ''org_id'', q.runner_org))::text, true);' || chr(10) ||
    '' || chr(10) ||
    '    FOR e IN SELECT * FROM public.automation_effect_rows(q.automation_id, NULL) LOOP' || chr(10) ||
    '      run_id := public.record_automation_run(q.automation_id, e.id, q.event_id);' || chr(10) ||
    '      BEGIN' || chr(10) ||
    '        PERFORM public.apply_action(e.action_type_id, e.parameters);' || chr(10) ||
    '        PERFORM public.settle_automation_run(run_id, ''succeeded'', NULL, NULL);' || chr(10) ||
    '      EXCEPTION WHEN OTHERS THEN' || chr(10) ||
    '        PERFORM public.settle_automation_run(run_id, ''failed'', sqlerrm, NULL);' || chr(10) ||
    '      END;' || chr(10) ||
    '    END LOOP;' || chr(10) ||
    '    PERFORM public.mark_automation_event_executed(q.event_id, p_at);' || chr(10) ||
    '    ran := ran + 1;' || chr(10) ||
    '  END LOOP;' || chr(10) ||
    '' || chr(10) ||
    '  FOR a IN SELECT * FROM public.automation_candidates() LOOP');
  IF p = d THEN RAISE EXCEPTION '625: the candidate loop is not where it was'; END IF;

  -- the drain needs its own record variable
  p := replace(p, 'DECLARE a record; e record;', 'DECLARE a record; e record; q record;');
  IF position('q record;' in p) = 0 THEN
    RAISE EXCEPTION '625: could not declare the queue variable';
  END IF;

  -- and every event the SCHEDULED path opens is executed on the same tick, so
  -- it must not linger in the queue it just joined.
  p := replace(p,
    '      PERFORM public.auto_mute_if_due(a.id);',
    '      PERFORM public.mark_automation_event_executed(ev, p_at);' || chr(10) ||
    '      PERFORM public.auto_mute_if_due(a.id);');
  IF position('mark_automation_event_executed(ev' in p) = 0 THEN
    RAISE EXCEPTION '625: the scheduled path would leave its own events queued';
  END IF;

  EXECUTE p;
  RAISE NOTICE 'run_automations now drains the execution queue before its own pass';
END $$;

-- Both directions on every rule, as `authenticated`, because as the owner RLS
-- does not apply and the refusals would be theatre.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_ont uuid; v_editor uuid; v_viewer uuid;
  v_at uuid; v_a uuid; v_ev uuid; v_err text; v_runs int; v_done timestamptz;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p
     WHERE p.organization_id = v_org
       AND (p.default_role IS NULL
            OR public.role_rank(p.default_role) < public.role_rank('editor'))
     ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    IF v_org IS NULL OR v_proj IS NULL OR v_ont IS NULL THEN
      RAISE EXCEPTION 'no org, ontology, or project without a permissive default_role: 625 cannot prove its own rules';
    END IF;

    v_editor := gen_random_uuid(); v_viewer := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (v_editor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe625e@beacon.test'),
      (v_viewer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','probe625v@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (v_editor,'probe625e@beacon.test','admin',v_org),
      (v_viewer,'probe625v@beacon.test','admin',v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id) VALUES
      (v_proj, v_editor, 'editor', v_org), (v_proj, v_viewer, 'viewer', v_org);

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-625', 'Probe 625') RETURNING id INTO v_at;

    -- PAUSED on purpose: the state the page says must still run manually.
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope, paused)
    VALUES (v_proj, 'Probe 625', v_editor,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project', true)
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_editor::text,
      'app_metadata', json_build_object('role','admin','org_id',v_org))::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at);

    -- (1) a VIEWER may not queue a run
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_viewer::text,
      'app_metadata', json_build_object('role','admin','org_id',v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_err := NULL;
    BEGIN PERFORM public.execute_automation_now(v_a);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
    IF v_err IS NULL THEN RAISE EXCEPTION 'a viewer queued a manual run'; END IF;
    IF v_err NOT LIKE 'Automate:NotAnEditor%' THEN
      RAISE EXCEPTION 'the viewer was refused for the wrong reason: %', v_err;
    END IF;

    -- (2) the EDITOR may, and the automation being paused does not stop it
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_editor::text,
      'app_metadata', json_build_object('role','admin','org_id',v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_ev := public.execute_automation_now(v_a);
    RESET ROLE;
    IF v_ev IS NULL THEN RAISE EXCEPTION 'the editor queued nothing'; END IF;

    SELECT executed_at INTO v_done FROM public.automation_events WHERE id = v_ev;
    IF v_done IS NOT NULL THEN
      RAISE EXCEPTION 'the queued event was already marked executed before any runner ran';
    END IF;

    -- (3) the RUNNER drains it, and the effects are recorded against the event
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM public.run_automations(timestamptz '2026-08-22 10:00+00');

    SELECT executed_at INTO v_done FROM public.automation_events WHERE id = v_ev;
    IF v_done IS NULL THEN
      RAISE EXCEPTION 'the runner did not drain the queued event';
    END IF;
    SELECT count(*) INTO v_runs FROM public.automation_runs WHERE event_id = v_ev;
    IF v_runs < 1 THEN
      RAISE EXCEPTION 'the drained event executed no effects';
    END IF;

    -- (4) EXPIRED blocks it, which is the other half of the enumeration that
    -- lets paused through
    UPDATE public.automations SET expires_at = now() - interval '1 day' WHERE id = v_a;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_editor::text,
      'app_metadata', json_build_object('role','admin','org_id',v_org))::text, true);
    SET LOCAL ROLE authenticated;
    v_err := NULL;
    BEGIN PERFORM public.execute_automation_now(v_a);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
    IF v_err IS NULL THEN RAISE EXCEPTION 'an expired automation queued a manual run'; END IF;
    IF v_err NOT LIKE 'Automate:AutomationExpired%' THEN
      RAISE EXCEPTION 'the expired automation was refused for the wrong reason: %', v_err;
    END IF;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '625 proved: viewer refused, editor queued while paused, runner drained it, expired refused';
  END;
END $$;

-- The 45-minute ceiling, on its own because it needs an event that is already
-- stale, and a guard nobody has seen fire is not a guard.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid; v_a uuid; v_ev uuid;
  v_runs int; v_detail text;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-625b', 'Probe 625b') RETURNING id INTO v_at;
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 625b', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at);
    PERFORM set_config('request.jwt.claims', '', true);

    INSERT INTO public.automation_events (automation_id, event_type, requested_by, occurred_at)
    VALUES (v_a, 'automation_triggered', v_owner, timestamptz '2026-08-22 09:00+00')
    RETURNING id INTO v_ev;

    -- 46 minutes later: over the line.
    PERFORM public.run_automations(timestamptz '2026-08-22 09:46+00');

    SELECT count(*) INTO v_runs FROM public.automation_runs WHERE event_id = v_ev;
    IF v_runs <> 0 THEN
      RAISE EXCEPTION 'a stale event executed % effect(s); the page says none execute', v_runs;
    END IF;
    SELECT detail INTO v_detail FROM public.automation_events WHERE id = v_ev;
    IF v_detail IS NULL OR v_detail NOT LIKE 'Terminated:%' THEN
      RAISE EXCEPTION 'a stale event was not marked terminated (detail: %)', coalesce(v_detail, 'null');
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'an event waiting past 45 minutes was terminated and executed nothing';
  END;
END $$;
