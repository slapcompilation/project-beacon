-- 625 put every unexecuted event in the execution queue, and that is wrong in
-- the worst available direction: **pausing an automation executed its effects.**
--
-- Measured, not reasoned. A fresh automation, one action effect, and a single
-- `UPDATE automations SET paused = true`, then one runner tick at
-- clock_timestamp():
--
--   event type                        paused
--   effect runs from merely PAUSING   1
--
-- The chain: 622's AFTER UPDATE trigger records `paused` through
-- `record_automation_event`, which does not set `executed_at`. 625 then defined
-- the queue as any event whose executed_at was still null, and had the runner
-- execute whatever it found. So every metadata event — `paused`, `resumed`, `muted`,
-- `unmuted`, `condition_edited` — became a work item that fires the automation.
-- Muting an automation would have run it. Editing its condition would have run
-- it.
--
-- WHY THE PROBES MISSED IT. 625's three probes each built a fresh automation
-- and asserted about the event they had just queued, so they never asked what
-- ELSE was in the queue. The platform suite found it within the hour, because
-- its tests share one transaction and the auto-mute suite had left a hundred
-- unexecuted events lying in front of the manual one. The failure presented as
-- the manual run not being drained and was actually the queue being full of
-- things that are not runs. A shared-fixture suite asks a question a
-- purpose-built probe cannot.
--
-- THE FIX IS A DEFINITION, not a filter bolted on. The queue holds MANUAL RUNS:
--
--   "Manual executions are considered run by the user who selects Execute in
--   the Automate interface."
--   — automate/manual-execution.md
--
-- so `requested_by IS NOT NULL` is what a queued run IS, and the event type
-- must be the one that means "run this". Everything else has already happened
-- by the time it is recorded — a pause is not pending work — and is backfilled
-- as executed at the moment it occurred.

-- Nothing that is not a manual run belongs in the queue, past or future.
UPDATE public.automation_events
   SET executed_at = occurred_at
 WHERE executed_at IS NULL
   AND (requested_by IS NULL OR event_type <> 'automation_triggered');

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
     -- A queued event is a MANUAL RUN. A metadata event has already happened by
     -- the time it is recorded; treating it as pending work fired the
     -- automation, which is the defect this file exists for.
     AND e.requested_by IS NOT NULL
     AND e.event_type = 'automation_triggered'
     -- "Expired, trashed, and otherwise disabled automations continue to block
     -- all execution, including manual runs." Paused is deliberately absent.
     AND (a.expires_at IS NULL OR a.expires_at > p_at)
   ORDER BY e.occurred_at
   LIMIT 25
$$;

COMMENT ON FUNCTION public.queued_automation_events(timestamptz) IS
  'Manual runs awaiting execution, oldest first. Only events with a requester: a metadata event has already happened when it is recorded, and 625 executed them as work (627).';

-- AND THE SPLIT IS MADE AT THE WRITER, not just at the reader. Filtering the
-- queue stops the damage; it still leaves every metadata event sitting with a
-- null `executed_at` forever, which reads as "queued" to the next person who
-- opens this table. The two writers mean different things and now say so:
--
--   `record_automation_event`   records something that HAS happened
--   `execute_automation_now`    records something to DO
--
-- so the first stamps `executed_at` and the second leaves it null. That is what
-- makes "null means waiting" true rather than merely filtered around.
CREATE OR REPLACE FUNCTION public.record_automation_event(
  p_automation uuid, p_type text, p_detail text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.automation_events
    (automation_id, event_type, detail, executed_at)
  VALUES (p_automation, p_type, p_detail, clock_timestamp()) RETURNING id
$$;

-- The partial index has to agree with the predicate, or it indexes a set the
-- query no longer asks for.
DROP INDEX IF EXISTS public.automation_events_queued;
CREATE INDEX automation_events_queued ON public.automation_events (occurred_at)
  WHERE executed_at IS NULL AND requested_by IS NOT NULL;

-- BY CONTRAST, and the contrast is the whole point: the same tick must run the
-- manual event and must not run the pause.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid;
  v_quiet uuid; v_asked uuid; v_ev uuid; v_runs int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project, ontology or user: 627 cannot prove its own fix';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-627', 'Probe 627') RETURNING id INTO v_at;

    -- (A) an automation that is only PAUSED, and must stay untouched
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 627 quiet', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_quiet;

    -- (B) one that a person asked to run, and must execute
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 627 asked', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_asked;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_quiet, 0, 'action', v_at), (v_asked, 0, 'action', v_at);

    -- the metadata events, through the trigger that records them
    UPDATE public.automations SET paused = true WHERE id = v_quiet;
    UPDATE public.automations SET muted  = true WHERE id = v_quiet;
    UPDATE public.automations SET condition =
      '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb WHERE id = v_quiet;
    PERFORM set_config('request.jwt.claims', '', true);

    -- the manual run, through the entry point
    INSERT INTO public.automation_events (automation_id, event_type, requested_by)
    VALUES (v_asked, 'automation_triggered', v_owner) RETURNING id INTO v_ev;

    -- one tick, near enough to now that nothing is terminated for waiting
    PERFORM public.run_automations(clock_timestamp());

    SELECT count(*) INTO v_runs FROM public.automation_runs WHERE automation_id = v_quiet;
    IF v_runs <> 0 THEN
      RAISE EXCEPTION 'pausing, muting or editing a condition executed % effect(s)', v_runs;
    END IF;

    SELECT count(*) INTO v_runs FROM public.automation_runs WHERE event_id = v_ev;
    IF v_runs < 1 THEN
      RAISE EXCEPTION 'the manual run was not drained, so the fix refuses everything';
    END IF;

    -- and nothing is left waiting that never should have waited
    IF EXISTS (SELECT 1 FROM public.automation_events e
                WHERE e.automation_id = v_quiet AND e.executed_at IS NULL) THEN
      RAISE EXCEPTION 'a metadata event is still sitting in the queue';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'pausing, muting and editing ran nothing; the manual run still ran';
  END;
END $$;

-- And the state this leaves behind: no metadata event anywhere is queued.
DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM public.automation_events
   WHERE executed_at IS NULL
     AND (requested_by IS NULL OR event_type <> 'automation_triggered');
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '% event(s) that are not manual runs are still queued', v_bad;
  END IF;
  RAISE NOTICE 'the queue holds manual runs and nothing else';
END $$;
