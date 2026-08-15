-- The minute hand checks automations too.
--
-- 517 built the runner and left it uncalled, which is the exact mistake 442
-- made with the indexer and 513 had to repair. Wiring it in the same migration
-- would have been better; wiring it in the next one is at least immediate.
--
--   "define conditions that are checked continuously or on a schedule"
--                                                     (automate/overview)
--
-- The scheduled half is this. Continuous checking is live monitoring, which
-- needs streaming and is recorded, not built.

CREATE OR REPLACE FUNCTION public.run_schedules(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s record; u record; state jsonb; before text; built uuid; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-schedules')) THEN
    RETURN 0;
  END IF;

  before := current_setting('request.jwt.claims', true);
  FOR s IN SELECT * FROM public.schedules WHERE NOT paused LOOP
    state := public.schedule_observe(s.trigger, s.trigger_state);
    IF state IS DISTINCT FROM s.trigger_state THEN
      UPDATE public.schedules SET trigger_state = state WHERE id = s.id;
    END IF;
    CONTINUE WHEN NOT public.schedule_satisfied(s.trigger, state, p_at);

    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2 WHERE u2.id = s.updated_by;
    CONTINUE WHEN u IS NULL;

    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      built := public.run_build(s.target_dataset_ids, false, s.build_type, s.id);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, build_id)
      VALUES (s.id, CASE WHEN built IS NULL THEN 'Ignored' ELSE 'Succeeded' END, built);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, error)
      VALUES (s.id, 'Failed', sqlerrm);
    END;

    UPDATE public.schedules SET trigger_state = '{}'::jsonb, last_run_at = p_at WHERE id = s.id;
    ran := ran + 1;
  END LOOP;

  -- "Live pipelines run whenever their respective datasources are updated.
  -- Additionally, if user edits on objects are detected, live pipelines will
  -- run every six hours" — both arms live in run_stale_indexes, which this
  -- minute hand calls the way it already calls schedules.
  PERFORM public.run_stale_indexes(p_at);
  PERFORM public.run_due_object_datasets(p_at);
  -- "conditions that are checked continuously or on a schedule" — the
  -- scheduled half, on the hand that already turns.
  PERFORM public.run_automations(p_at);
  RETURN ran;
END $function$;

-- ── assertions, which RUN the whole hand ────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  IF pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure)
     NOT LIKE '%run_automations%' THEN
    RAISE EXCEPTION 'the heartbeat does not check automations';
  END IF;
  -- All four calls, executed rather than matched.
  PERFORM public.run_schedules(now());

  SELECT count(*) INTO n FROM cron.job WHERE jobname = 'beacon-run-schedules';
  IF n <> 1 THEN RAISE EXCEPTION 'the minute hand is missing'; END IF;

  RAISE NOTICE '518: the minute hand checks automations';
END $$;
