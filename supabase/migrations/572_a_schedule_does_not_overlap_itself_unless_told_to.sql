-- A default we inverted without saying so.
--
-- ── WHAT THE PAGE SAYS ─────────────────────────────────────────────────────
-- `building-pipelines/create-schedule`, under Advanced settings:
--
--   "**Allow overlapping runs:** By default, a schedule does not start a new run
--    while another run of the same schedule is in progress. Enable this setting
--    to allow runs to overlap. Use this setting to:
--      * **Reduce latency in a pipeline with a long sequence of jobs:** A new run
--        can begin processing new input data at the start of the pipeline before
--        an earlier run finishes processing data through the entire pipeline.
--      * **Use one schedule to keep multiple datasets up to date:** A single
--        schedule starts builds for each dataset as needed, without requiring a
--        separate schedule for each dataset."
--
-- `advanced-settings.png` confirms the default from the other side: six
-- checkboxes under "Advanced options" — Abort build on failure, Customize the
-- number of attempts for failed jobs, Force build, Re-trigger upon successful
-- build, Allow overlapping runs, Customize behavior on job failure — and every
-- one of them is UNCHECKED. So `DEFAULT false` is attested twice, by the
-- sentence and by the screenshot.
--
-- ── WHAT WE DO ─────────────────────────────────────────────────────────────
-- `schedule_candidates()` selects on `NOT s.paused` and nothing else, so a
-- satisfied trigger always builds. We ship Foundry's opt-in behaviour as our
-- only behaviour, and the pg_cron heartbeat fires every minute. Nothing fails;
-- runs pile up. That is the shape a guard never catches, because there is
-- nothing to catch — only a default nobody wrote down.
--
-- This arrived from the 2026-08-18 drift sweep: the sentence is new upstream, so
-- it was not knowable when 493-496 were built.
--
-- ── THE OUTCOME TOKEN ALREADY EXISTS, AND SAYS EXACTLY THIS ────────────────
-- `schedule_runs.outcome` carries the three the page publishes, and Ignored is
-- defined as: "The run was attempted, but a build was not created." A run
-- suppressed for overlap is precisely that. No new token.
--
-- ── BUT IT MAY NOT GO THROUGH record_schedule_run ──────────────────────────
-- That helper clears `trigger_state` to `{}` and stamps `last_run_at`, because
-- a run consumes what it observed:
--
--   "An event trigger remains satisfied after the event has occurred until the
--    entire trigger is satisfied and the schedule is run."
--
-- A suppressed attempt is not the schedule being run — no build was created —
-- so the observed events must SURVIVE for the next tick. Recording it through
-- the existing helper would silently eat them, which is a worse bug than the
-- one being fixed. Hence a second ledger helper that writes the row and touches
-- nothing else.

BEGIN;

ALTER TABLE public.schedules
  ADD COLUMN allow_overlapping_runs boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.schedules.allow_overlapping_runs IS
  'Off by default, as Foundry has it: a schedule does not start a new run while another run of the same schedule is in progress. On, runs may overlap — for pipelines long enough that a new run should start before the last finishes.';

-- ── the two helpers the runner needs, both beacon_runner's ─────────────────
-- A build this schedule started that has not finished. `builds.status` speaks
-- the API vocabulary since 506, so RUNNING is the live one.
CREATE OR REPLACE FUNCTION public.schedule_run_in_flight(p_schedule uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.schedule_runs r
      JOIN public.builds b ON b.id = r.build_id
     WHERE r.schedule_id = p_schedule AND b.status = 'RUNNING')
$$;
COMMENT ON FUNCTION public.schedule_run_in_flight(uuid) IS
  'Is a build this schedule started still RUNNING? The predicate behind allow_overlapping_runs.';

-- Ignored, without consuming what the trigger observed: the run was attempted
-- and no build was created, so the events are still owed a build.
CREATE OR REPLACE FUNCTION public.record_schedule_skip(p_schedule uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.schedule_runs (schedule_id, outcome, build_id, error)
  VALUES (p_schedule, 'Ignored', NULL,
          'A run of this schedule is already in progress, and it does not allow overlapping runs.')
$$;
COMMENT ON FUNCTION public.record_schedule_skip(uuid) IS
  'Records an Ignored run WITHOUT clearing trigger_state or last_run_at — a suppressed attempt is not the schedule being run, so its observed events must survive to the next tick.';

-- The candidate row grows a column, so the signature changes.
DROP FUNCTION public.schedule_candidates();
CREATE FUNCTION public.schedule_candidates()
RETURNS TABLE (id uuid, trigger_def jsonb, trigger_state jsonb,
               target_dataset_ids uuid[], build_type text,
               allow_overlapping_runs boolean,
               runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT s.id, s.trigger, s.trigger_state, s.target_dataset_ids, s.build_type,
         s.allow_overlapping_runs, u.id, u.role, u.organization_id
    FROM public.schedules s
    JOIN public.users u ON u.id = s.updated_by
   WHERE NOT s.paused
$$;

DO $do$
DECLARE h text;
BEGIN
  FOREACH h IN ARRAY ARRAY[
    'schedule_candidates()', 'schedule_run_in_flight(uuid)',
    'record_schedule_skip(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated, service_role', h);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO beacon_runner', h);
  END LOOP;
END $do$;

-- ── the runner, with one new arm ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_schedules(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  s record; state jsonb; before text; built uuid; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-schedules')) THEN
    RETURN 0;
  END IF;

  before := current_setting('request.jwt.claims', true);
  FOR s IN SELECT * FROM public.schedule_candidates() LOOP
    -- Everything from here is the owner's: observation, the trigger decision,
    -- and the build itself all see what the owner sees.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', s.runner_id::text,
        'app_metadata', json_build_object('role', s.runner_role, 'org_id', s.runner_org))::text, true);

    state := public.schedule_observe(s.trigger_def, s.trigger_state);
    IF state IS DISTINCT FROM s.trigger_state THEN
      PERFORM public.record_schedule_state(s.id, state);
    END IF;
    CONTINUE WHEN NOT public.schedule_satisfied(s.trigger_def, state, p_at);

    -- The trigger fired. Unless this schedule allows it, a run already in
    -- flight suppresses this one — and the suppression keeps the observed
    -- events, because no build was created to consume them.
    IF NOT s.allow_overlapping_runs AND public.schedule_run_in_flight(s.id) THEN
      PERFORM public.record_schedule_skip(s.id);
      CONTINUE;
    END IF;

    BEGIN
      built := public.run_build(s.target_dataset_ids, false, s.build_type, s.id);
      PERFORM public.record_schedule_run(s.id,
        CASE WHEN built IS NULL THEN 'Ignored' ELSE 'Succeeded' END, built, NULL, p_at);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.record_schedule_run(s.id, 'Failed', NULL, sqlerrm, p_at);
    END;
    ran := ran + 1;
  END LOOP;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  -- The enqueuers elevate themselves; the jobs they create are executed by
  -- drain_waiting_jobs under their requesters, which is where RLS lives now.
  PERFORM public.run_stale_indexes(p_at);
  PERFORM public.run_due_object_datasets(p_at);
  PERFORM public.run_automations(p_at);
  PERFORM public.run_automation_retries(p_at);
  RETURN ran;
END $function$;

GRANT EXECUTE ON FUNCTION public.run_schedules(timestamptz) TO beacon_runner;

-- ── assertions, which drive the suppression and watch the events survive ───
DO $do$
DECLARE
  org uuid; usr uuid; ds uuid; sched uuid; b uuid; n int; st jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe572') RETURNING id INTO org;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe572@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.users (id, organization_id, email, role)
      VALUES (usr, org, 'probe572@beacon.test', 'owner');

    INSERT INTO public.schedules (organization_id, name, target_dataset_ids,
                                  trigger, updated_by)
      VALUES (org, 'probe572', ARRAY[]::uuid[],
              '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, usr)
      RETURNING id INTO sched;

    -- The default is off, and it is the page's default.
    IF (SELECT allow_overlapping_runs FROM public.schedules WHERE id = sched) THEN
      RAISE EXCEPTION 'allow_overlapping_runs defaulted ON, which inverts the page';
    END IF;

    -- Nothing in flight yet.
    IF public.schedule_run_in_flight(sched) THEN
      RAISE EXCEPTION 'a schedule with no runs reported one in flight';
    END IF;

    -- A RUNNING build from an earlier run makes it in flight.
    INSERT INTO public.builds (organization_id, status, requested_by)
      VALUES (org, 'RUNNING', usr) RETURNING id INTO b;
    INSERT INTO public.schedule_runs (schedule_id, outcome, build_id)
      VALUES (sched, 'Succeeded', b);
    IF NOT public.schedule_run_in_flight(sched) THEN
      RAISE EXCEPTION 'a RUNNING build did not count as in flight';
    END IF;

    -- And a finished one does not. All three terminal tokens, because getting
    -- this list wrong is how a schedule would wedge forever.
    UPDATE public.builds SET status = 'SUCCEEDED' WHERE id = b;
    IF public.schedule_run_in_flight(sched) THEN
      RAISE EXCEPTION 'a SUCCEEDED build still counted as in flight';
    END IF;
    UPDATE public.builds SET status = 'FAILED' WHERE id = b;
    IF public.schedule_run_in_flight(sched) THEN
      RAISE EXCEPTION 'a FAILED build still counted as in flight';
    END IF;
    UPDATE public.builds SET status = 'CANCELED' WHERE id = b;
    IF public.schedule_run_in_flight(sched) THEN
      RAISE EXCEPTION 'a CANCELED build still counted as in flight';
    END IF;

    -- The skip writes Ignored and consumes NOTHING. This is the half that
    -- record_schedule_run would have got wrong.
    UPDATE public.builds SET status = 'RUNNING' WHERE id = b;
    UPDATE public.schedules
       SET trigger_state = '{"observed":["d1"]}'::jsonb, last_run_at = NULL
     WHERE id = sched;
    PERFORM public.record_schedule_skip(sched);

    SELECT count(*) INTO n FROM public.schedule_runs
     WHERE schedule_id = sched AND outcome = 'Ignored';
    IF n <> 1 THEN RAISE EXCEPTION 'the skip did not record an Ignored run'; END IF;

    SELECT trigger_state INTO st FROM public.schedules WHERE id = sched;
    IF st <> '{"observed":["d1"]}'::jsonb THEN
      RAISE EXCEPTION 'the skip ate the observed events: %', st;
    END IF;
    IF (SELECT last_run_at FROM public.schedules WHERE id = sched) IS NOT NULL THEN
      RAISE EXCEPTION 'the skip stamped last_run_at, but the schedule did not run';
    END IF;

    -- Where record_schedule_run does exactly the opposite, on purpose.
    PERFORM public.record_schedule_run(sched, 'Succeeded', NULL, NULL, now());
    SELECT trigger_state INTO st FROM public.schedules WHERE id = sched;
    IF st <> '{}'::jsonb THEN
      RAISE EXCEPTION 'a real run failed to consume what it observed: %', st;
    END IF;

    RAISE EXCEPTION 'probe572:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe572:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe572';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '572: a schedule does not overlap itself unless told to';
END $do$;

COMMIT;
