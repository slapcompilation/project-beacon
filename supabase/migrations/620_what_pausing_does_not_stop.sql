-- What pausing does NOT stop — asserted, because ours is right by accident.
--
--   "The system may automatically pause an automation when it detects excessive
--   activity. While paused, scheduled and live triggers do not run, but manual
--   runs and event retries remain available."
--   — automate/limits.md
--
-- `automation_candidates()` filters `NOT a.paused`, which is the first half.
-- `retry_candidates()` joins `automations` and does not — which is the second
-- half, and nothing in the schema says so. One `AND NOT a.paused` added for
-- symmetry with its neighbour would silently break a documented rule, and no
-- guard would notice. This migration makes the omission deliberate and the
-- platform suite re-asks it.
--
-- MEASURED BY RUNNING IT, not by reading the SQL: the probe pauses an
-- automation with a retry already due and checks the retry still executes.
--
-- MANUAL EXECUTION IS NOT BUILT, and the reason is now specific rather than a
-- shrug. It is not a missing function; it is that the run ledger has ONE
-- writer by construction:
--
--   * `automation_runs` carries a SELECT policy and no INSERT or UPDATE policy
--     at all, so no caller writes it under RLS.
--   * `record_automation_run`, `settle_automation_run` and
--     `automation_effect_rows` are SECURITY DEFINER granted to `beacon_runner`
--     alone — 553's fix, which INVERTED the scheduled path rather than
--     elevating around it.
--
-- An inline manual run would need one of: those grants widened to
-- `authenticated` (a forgery surface on the ledger), or the whole entry point
-- made SECURITY DEFINER (which would also elevate `apply_action`, letting an
-- editor cause writes they could never make themselves). Both undo 553.
--
-- The third option is what Foundry appears to do anyway — a manual run is an
-- EVENT that the execution queue drains:
--
--   "Max time an automation event can wait in execution queue"
--   — automate/limits.md
--
--   "When many events are triggered in quick succession, they enter the queue
--   in trigger order and begin executing in trigger order, but may not complete
--   in trigger order depending on each event's runtime."
--   — automate/limits.md
--
-- so `execute_automation_now` should enqueue and `beacon_runner` should
-- execute. That needs the event log, and this is now a structural reason to
-- build it rather than a preference. Recorded, not built.

COMMENT ON FUNCTION public.retry_candidates(timestamptz) IS
  'Deliberately does NOT filter paused automations: "While paused, scheduled and live triggers do not run, but manual runs and event retries remain available" (automate/limits). automation_candidates filters paused; this one must not, and adding it for symmetry would break a documented rule silently.';

-- Both directions, run rather than inspected: a due retry fires while the
-- automation is paused, and the same automation is skipped by the scheduled
-- path in the same transaction. One without the other proves nothing — a
-- runner that ignored `paused` everywhere would pass the first alone.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid;
  v_a uuid; v_e uuid; v_run uuid; v_outcome text; v_scheduled int;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org
      ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_org IS NULL OR v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no organization, project, ontology or user: 620 cannot prove its own rule';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-620', 'Probe 620') RETURNING id INTO v_at;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope, paused)
    VALUES (v_proj, 'Probe 620', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project', true)
    RETURNING id INTO v_a;

    -- guard_automation_effect_ownership: editing effects takes ownership, so
    -- the claims have to be the owner's before the effect exists.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id, retry_count)
    VALUES (v_a, 0, 'action', v_at, 2) RETURNING id INTO v_e;
    PERFORM set_config('request.jwt.claims', '', true);

    -- A run already waiting on a retry, due in the past.
    v_run := public.record_automation_run(v_a, v_e);
    PERFORM public.settle_automation_run(v_run, 'awaiting_retry', 'probe',
      timestamptz '2026-08-21 00:00+00', 1);

    -- (1) the scheduled path skips it, because it IS paused
    v_scheduled := public.run_automations(timestamptz '2026-08-21 03:00+00');

    -- (2) and the retry runs anyway, which is the documented half
    PERFORM public.run_automation_retries(timestamptz '2026-08-21 03:00+00');
    SELECT outcome INTO v_outcome FROM public.automation_runs WHERE id = v_run;

    IF v_outcome = 'awaiting_retry' THEN
      RAISE EXCEPTION 'the retry did not run while the automation was paused — pausing stopped more than the page says it stops';
    END IF;

    -- and the contrast: the scheduled path produced no run for this automation
    IF EXISTS (SELECT 1 FROM public.automation_runs r
                WHERE r.automation_id = v_a AND r.id <> v_run) THEN
      RAISE EXCEPTION 'the scheduled path ran a paused automation';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'retries ran while paused (outcome moved off awaiting_retry) and the scheduled path did not';
  END;
END $$;
