-- Automation history gets the retention its page publishes, on the pattern 641
-- established the day before.
--
--   "Automation history is retained for six months, then permanently deleted."
--   — automate/history.md
--
-- The map carried this as blocked on a destructive cron this repository had
-- never run. 641 ran the first, with the
-- operator's approval of that Decisions block; this is the second application
-- of an approved pattern, not a second decision. The page even provides the
-- escape hatch that makes unconditional deletion the right reading:
--
--   "To store history beyond six months, use an action to save data in a
--   long-lived object that is managed and controlled like any other object
--   type in the Ontology."
--   — automate/history.md
--
-- ── WHAT EXPIRES, AND HOW THE RUNS FOLLOW ───────────────────────────────────
-- Events past six months are deleted; their effect runs follow through the
-- `event_id ... ON DELETE CASCADE` that 622 built. Run rows with a NULL
-- event_id — history from before the event log existed — are deleted by their
-- own `ran_at`, or they would sit forever as history the page says is gone.
-- Six months is the page's own number, not an inference, so unlike 641 there
-- is no month-length choice to mark.
--
-- A six-month-old `awaiting_retry` row cannot be a live retry — the ladder's
-- interval is bounded under 24 hours and its count at five (543) — so age
-- alone is the right predicate and no outcome is exempted.

CREATE OR REPLACE FUNCTION public.expire_automation_history()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer; m integer;
BEGIN
  DELETE FROM public.automation_events
   WHERE occurred_at < now() - interval '6 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Runs from before the event log existed carry no event to cascade from.
  DELETE FROM public.automation_runs
   WHERE event_id IS NULL AND ran_at < now() - interval '6 months';
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;

COMMENT ON FUNCTION public.expire_automation_history() IS
  '"Automation history is retained for six months, then permanently deleted" (automate/history). Events past six months go and their runs cascade; pre-event-log runs go by their own ran_at. SECURITY DEFINER on 553''s ledger-helper shape: the runner holds EXECUTE and no table grant.';

REVOKE ALL ON FUNCTION public.expire_automation_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_automation_history() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_automation_history() TO beacon_runner;

SELECT cron.schedule('beacon-automation-retention', '29 3 * * *',
  'SET ROLE beacon_runner; SELECT public.expire_automation_history();');

-- Planted in both generations, with the cascade and the orphan path each
-- proved: an old event whose run must follow it out, a young pair that must
-- survive, and an orphaned old run with no event at all.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid; v_a uuid; v_e uuid;
  v_old_ev uuid; v_young_ev uuid; v_run uuid; v_n int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project, ontology or user: 642 cannot prove its own retention';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-642', 'Probe 642') RETURNING id INTO v_at;
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 642', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at) RETURNING id INTO v_e;
    PERFORM set_config('request.jwt.claims', '', true);

    -- an old event with a run attached; a young event with a run attached;
    -- and an orphaned old run from before the event log
    INSERT INTO public.automation_events (automation_id, event_type, occurred_at, executed_at)
    VALUES (v_a, 'automation_triggered', now() - interval '7 months', now() - interval '7 months')
    RETURNING id INTO v_old_ev;
    INSERT INTO public.automation_runs (automation_id, effect_id, outcome, event_id, ran_at)
    VALUES (v_a, v_e, 'succeeded', v_old_ev, now() - interval '7 months');
    INSERT INTO public.automation_events (automation_id, event_type, occurred_at, executed_at)
    VALUES (v_a, 'automation_triggered', now() - interval '7 days', now() - interval '7 days')
    RETURNING id INTO v_young_ev;
    INSERT INTO public.automation_runs (automation_id, effect_id, outcome, event_id, ran_at)
    VALUES (v_a, v_e, 'succeeded', v_young_ev, now() - interval '7 days');
    INSERT INTO public.automation_runs (automation_id, effect_id, outcome, ran_at)
    VALUES (v_a, v_e, 'failed', now() - interval '8 months') RETURNING id INTO v_run;

    SET LOCAL ROLE beacon_runner;
    v_n := public.expire_automation_history();
    RESET ROLE;

    -- the old event went and took its run with it; the orphan went by its own
    -- age; the young pair survived whole
    IF EXISTS (SELECT 1 FROM public.automation_events WHERE id = v_old_ev) THEN
      RAISE EXCEPTION 'a seven-month-old event survived the six-month retention';
    END IF;
    IF EXISTS (SELECT 1 FROM public.automation_runs WHERE event_id = v_old_ev) THEN
      RAISE EXCEPTION 'the old event''s run did not cascade';
    END IF;
    IF EXISTS (SELECT 1 FROM public.automation_runs WHERE id = v_run) THEN
      RAISE EXCEPTION 'an orphaned eight-month-old run survived';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.automation_events WHERE id = v_young_ev)
       OR NOT EXISTS (SELECT 1 FROM public.automation_runs WHERE event_id = v_young_ev) THEN
      RAISE EXCEPTION 'the young pair did not survive';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job
                    WHERE command ~ 'expire_automation_history' AND active) THEN
      RAISE EXCEPTION 'the retention job is not on the scheduler';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '642 proved: the old event and its run went, the orphan went by its own age, the young pair survived, and the job is scheduled';
  END;
END $$;
