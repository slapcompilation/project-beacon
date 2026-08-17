-- The scheduled path runs as a caller, so RLS finally applies to it.
--
-- The defect (found by the weekly adversary, executable since #643): the cron
-- entries are SECURITY DEFINER owned by postgres, which owns every guarded
-- table and none of them FORCE RLS — so swapping `request.jwt.claims` changed
-- who the policies would think you are while the role guaranteed the policies
-- were never consulted. On the path that runs most builds, RLS was off.
--
-- The recorded fix — "elevate around the nested user logic" inside those
-- functions — is IMPOSSIBLE, and that was learned by probe, not by reading:
-- Postgres refuses `cannot set parameter "role" within security-definer
-- function`, and the refusal propagates down the whole SECDEF call stack,
-- including set_config('role', …) and even an invoker wrapper carrying a
-- `SET role` clause. So the design inverts instead:
--
--   * the four entries become SECURITY INVOKER and run as `beacon_runner`,
--     a NOLOGIN member of `authenticated` — it inherits authenticated's
--     grants AND its policies (probed: a TO-authenticated policy filters it),
--     while keeping the heartbeat off the authenticated API surface;
--   * pg_cron drops role at the top level, where SET ROLE is legal;
--   * the genuinely-owner operations — cross-org scans and ledger writes —
--     become small SECURITY DEFINER helpers, because elevation is the
--     direction Postgres sanctions. The ledgers already refuse callers (549);
--     these helpers are their one writer, the shape 549 named.
--
-- The engine beneath needs nothing: run_build, run_build_job, settle_build,
-- apply_action, automation_fires are already SECURITY INVOKER and run daily
-- as `authenticated` from the web — `builds` and `build_jobs` carry
-- "requesters write their builds/jobs" policies. Only the cron wrappers ever
-- put that engine into owner mode.
--
-- Whose permissions is not a choice here, it is published: "Condition
-- evaluation: Uses automation owner's permissions" and "Action and Logic
-- effects: Execute as the automation owner" (`automate/permissions`), and a
-- schedule "depend[s] on the permissions of a single user (the schedule
-- owner)" (`building-pipelines/scheduling-best-practices`). The claims swaps
-- already named the right identities; this makes them real.
--
-- Also fixed, found while reading the bodies: run_automation_retries applied
-- retried effects with NO claims swap at all — as nobody, RLS off. It now
-- impersonates the automation owner like first attempts always did.
--
-- Two behavior notes, both deliberate. schedule_observe now runs under the
-- owner's claims, so a trigger watching a dataset its owner cannot see stops
-- observing it — which is the doctrine, not a regression. And an ownerless
-- schedule is skipped before observation rather than after, since there is
-- nobody to observe as.
--
-- The enqueuers (run_stale_indexes, run_due_object_datasets) stay SECURITY
-- DEFINER machinery: they only create builds; the jobs they enqueue are
-- executed by drain_waiting_jobs under the requester — which this migration
-- fixes. Their enqueue-time reads still run as owner, recorded as residue.

BEGIN;

-- ── the runner ──────────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beacon_runner') THEN
    CREATE ROLE beacon_runner NOLOGIN IN ROLE authenticated;
  END IF;
END $do$;
GRANT beacon_runner TO postgres;

-- ── the owner's half: scans and ledgers, one SECURITY DEFINER helper each ───
-- Every helper revokes the default-ACL stamp (551) and is executable by the
-- runner alone: a ledger writer reachable by authenticated would be the forge
-- 549 closed, reopened one level up.

CREATE OR REPLACE FUNCTION public.schedule_candidates()
RETURNS TABLE (id uuid, trigger_def jsonb, trigger_state jsonb,
               target_dataset_ids uuid[], build_type text,
               runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT s.id, s.trigger, s.trigger_state, s.target_dataset_ids, s.build_type,
         u.id, u.role, u.organization_id
    FROM public.schedules s
    JOIN public.users u ON u.id = s.updated_by
   WHERE NOT s.paused
$$;

CREATE OR REPLACE FUNCTION public.record_schedule_state(p_schedule uuid, p_state jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.schedules SET trigger_state = p_state WHERE id = p_schedule
$$;

CREATE OR REPLACE FUNCTION public.record_schedule_run(
  p_schedule uuid, p_outcome text, p_build uuid, p_error text, p_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.schedule_runs (schedule_id, outcome, build_id, error)
  VALUES (p_schedule, p_outcome, p_build, p_error);
  UPDATE public.schedules SET trigger_state = '{}'::jsonb, last_run_at = p_at
   WHERE id = p_schedule
$$;

CREATE OR REPLACE FUNCTION public.waiting_job_candidates()
RETURNS TABLE (job_id uuid, build_id uuid,
               runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT bj.id, bj.build_id, u.id, u.role, u.organization_id
    FROM public.build_jobs bj
    JOIN public.builds b ON b.id = bj.build_id
    JOIN public.users u ON u.id = b.requested_by
   WHERE bj.state = 'WAITING' AND b.status = 'RUNNING'
     AND public.job_blocked_by(bj.id) IS NULL
   ORDER BY b.started_at, bj.id
$$;

CREATE OR REPLACE FUNCTION public.fail_build_job(p_job uuid, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.build_jobs SET state = 'FAILED', error = p_error,
         finished_at = clock_timestamp() WHERE id = p_job
$$;

CREATE OR REPLACE FUNCTION public.automation_candidates()
RETURNS TABLE (id uuid, condition jsonb,
               runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT a.id, a.condition, u.id, u.role, u.organization_id
    FROM public.automations a
    JOIN public.users u ON u.id = a.owner_id
   WHERE NOT a.paused
   ORDER BY a.created_at
   LIMIT 50
$$;

-- An automation's effects are its definition — platform rows like the
-- schedule row itself — so the scan is machinery, not a caller read.
CREATE OR REPLACE FUNCTION public.automation_effect_rows(p_automation uuid, p_fallback_for uuid)
RETURNS SETOF public.automation_effects
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT * FROM public.automation_effects
   WHERE automation_id = p_automation
     AND fallback_for IS NOT DISTINCT FROM p_fallback_for
   ORDER BY position
$$;

CREATE OR REPLACE FUNCTION public.record_automation_run(p_automation uuid, p_effect uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.automation_runs (automation_id, effect_id, outcome)
  VALUES (p_automation, p_effect, 'started') RETURNING id
$$;

CREATE OR REPLACE FUNCTION public.settle_automation_run(
  p_run uuid, p_outcome text, p_error text, p_next timestamptz,
  p_attempt int DEFAULT NULL, p_ran_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.automation_runs
     SET outcome = p_outcome, error = p_error, next_attempt_at = p_next,
         attempt = coalesce(p_attempt, attempt), ran_at = coalesce(p_ran_at, ran_at)
   WHERE id = p_run
$$;

CREATE OR REPLACE FUNCTION public.record_automation_state(
  p_automation uuid, p_members jsonb, p_fired boolean, p_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.automations
     SET condition_state = CASE WHEN p_members IS NOT NULL
           THEN jsonb_build_object('members', p_members) ELSE condition_state END,
         last_run_at = CASE WHEN p_fired THEN p_at ELSE last_run_at END
   WHERE id = p_automation
     AND (p_members IS NOT NULL OR p_fired)
$$;

CREATE OR REPLACE FUNCTION public.retry_candidates(p_at timestamptz)
RETURNS TABLE (run_id uuid, automation_id uuid, attempt int,
               effect_id uuid, action_type_id uuid, parameters jsonb, retry_count int,
               runner_id uuid, runner_role text, runner_org uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT ar.id, ar.automation_id, ar.attempt,
         e.id, e.action_type_id, e.parameters, e.retry_count,
         u.id, u.role, u.organization_id
    FROM public.automation_runs ar
    JOIN public.automation_effects e ON e.id = ar.effect_id
    JOIN public.automations a ON a.id = ar.automation_id
    JOIN public.users u ON u.id = a.owner_id
   WHERE ar.outcome = 'awaiting_retry' AND ar.next_attempt_at <= p_at
   ORDER BY ar.next_attempt_at
   LIMIT 25
$$;

DO $do$
DECLARE h text;
BEGIN
  FOREACH h IN ARRAY ARRAY[
    'schedule_candidates()', 'record_schedule_state(uuid, jsonb)',
    'record_schedule_run(uuid, text, uuid, text, timestamptz)',
    'waiting_job_candidates()', 'fail_build_job(uuid, text)',
    'automation_candidates()', 'automation_effect_rows(uuid, uuid)',
    'record_automation_run(uuid, uuid)',
    'settle_automation_run(uuid, text, text, timestamptz, int, timestamptz)',
    'record_automation_state(uuid, jsonb, boolean, timestamptz)',
    'retry_candidates(timestamptz)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated, service_role', h);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO beacon_runner', h);
  END LOOP;
END $do$;

-- ── the caller's half: the four entries, SECURITY INVOKER ───────────────────

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

CREATE OR REPLACE FUNCTION public.drain_waiting_jobs()
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE j record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-drain-builds')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR j IN SELECT * FROM public.waiting_job_candidates() LOOP
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', j.runner_id::text,
        'app_metadata', json_build_object('role', j.runner_role, 'org_id', j.runner_org))::text, true);
    BEGIN
      PERFORM public.run_build_job(j.job_id);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.fail_build_job(j.job_id, sqlerrm);
    END;
    -- Settled while the claims are still the requester's: "requesters write
    -- their builds" is the policy that admits it.
    PERFORM public.settle_build(j.build_id);
  END LOOP;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RETURN ran;
END $function$;

CREATE OR REPLACE FUNCTION public.run_automations(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
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
      FOR e IN SELECT * FROM public.automation_effect_rows(a.id, NULL) LOOP
        -- Recorded BEFORE the attempt. At-least-once is the promise.
        run_id := public.record_automation_run(a.id, e.id);
        BEGIN
          IF NOT coalesce((SELECT k.executable FROM public.automation_effect_kinds() k
                            WHERE k.kind = e.kind), false) THEN
            RAISE EXCEPTION 'Automate:EffectNotExecutable — % effects are not built', e.kind;
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

CREATE OR REPLACE FUNCTION public.run_automation_retries(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE r record; f record; fid uuid; before text; ran int := 0; budget int;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-automation-retries')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR r IN SELECT * FROM public.retry_candidates(p_at) LOOP
    -- The swap the first attempt always had and the retry never did: "Action
    -- and Logic effects: Execute as the automation owner."
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', r.runner_id::text,
        'app_metadata', json_build_object('role', r.runner_role, 'org_id', r.runner_org))::text, true);

    -- "does not include the initial attempt": the initial one is attempt 1.
    budget := 1 + coalesce(r.retry_count, 0);

    BEGIN
      PERFORM public.apply_action(r.action_type_id, r.parameters);
      PERFORM public.settle_automation_run(r.run_id, 'succeeded', NULL, NULL,
        r.attempt + 1, clock_timestamp());
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      IF r.attempt + 1 < budget AND public.automation_error_retryable(sqlerrm) THEN
        -- Still on the ladder: another rung, and the fallback stays withheld.
        PERFORM public.settle_automation_run(r.run_id, 'awaiting_retry', sqlerrm,
          public.automation_retry_due(r.effect_id, r.attempt + 1), r.attempt + 1);
      ELSE
        -- The budget is spent: the run fails and the fallback is released.
        PERFORM public.settle_automation_run(r.run_id, 'failed', sqlerrm, NULL, r.attempt + 1);
        FOR f IN SELECT * FROM public.automation_effect_rows(r.automation_id, r.effect_id) LOOP
          fid := public.record_automation_run(r.automation_id, f.id);
          BEGIN
            PERFORM public.apply_action(f.action_type_id, f.parameters);
            PERFORM public.settle_automation_run(fid, 'succeeded', NULL, NULL);
          EXCEPTION WHEN OTHERS THEN
            PERFORM public.settle_automation_run(fid, 'failed', sqlerrm, NULL);
          END;
        END LOOP;
      END IF;
      ran := ran + 1;
    END;
  END LOOP;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RETURN ran;
END $function$;

-- CREATE OR REPLACE keeps each entry's grants; the runner joins them. The two
-- enqueuers are granted too: they hold {postgres, service_role} only, and the
-- inverted run_schedules calls them as the runner.
GRANT EXECUTE ON FUNCTION public.run_schedules(timestamptz) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.drain_waiting_jobs() TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.run_automations(timestamptz) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.run_automation_retries(timestamptz) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.run_stale_indexes(timestamptz) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.run_due_object_datasets(timestamptz) TO beacon_runner;

-- ── the minute hand drops role before it calls anything ─────────────────────
DO $do$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'beacon-run-schedules';
  IF jid IS NULL THEN
    RAISE EXCEPTION 'the heartbeat job is missing, which is its own emergency';
  END IF;
  PERFORM cron.alter_job(jid, command :=
    'SET ROLE beacon_runner; SELECT public.run_schedules(); SELECT public.drain_waiting_jobs();');
END $do$;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; got int;
BEGIN
  -- The entries no longer elevate; the helpers do.
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.prosecdef
     AND p.proname IN ('run_schedules','drain_waiting_jobs','run_automations','run_automation_retries');
  IF n <> 0 THEN
    RAISE EXCEPTION '% scheduled entry point(s) still SECURITY DEFINER', n;
  END IF;
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND NOT p.prosecdef
     AND p.proname IN ('schedule_candidates','record_schedule_run','waiting_job_candidates',
                       'fail_build_job','automation_candidates','record_automation_run',
                       'settle_automation_run','record_automation_state','retry_candidates');
  IF n <> 0 THEN
    RAISE EXCEPTION '% ledger helper(s) are not SECURITY DEFINER', n;
  END IF;

  -- A ledger writer reachable by authenticated is the forge 549 closed.
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname IN ('schedule_candidates','record_schedule_state','record_schedule_run',
                       'waiting_job_candidates','fail_build_job','automation_candidates',
                       'automation_effect_rows','record_automation_run','settle_automation_run',
                       'record_automation_state','retry_candidates')
     AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('anon', p.oid, 'EXECUTE'));
  IF n <> 0 THEN
    RAISE EXCEPTION '% helper(s) executable by authenticated or anon', n;
  END IF;

  -- The runner is subject to RLS: a TO-authenticated policy filters it.
  -- Executed on a probe table, because this premise is the whole design.
  CREATE TABLE public.t_probe_553 (org text);
  ALTER TABLE public.t_probe_553 ENABLE ROW LEVEL SECURITY;
  INSERT INTO public.t_probe_553 VALUES ('a'), ('b');
  GRANT SELECT ON public.t_probe_553 TO authenticated;
  CREATE POLICY probe_pol ON public.t_probe_553 FOR SELECT TO authenticated USING (org = 'a');
  SET LOCAL ROLE beacon_runner;
  SELECT count(*) INTO got FROM public.t_probe_553;
  RESET ROLE;
  IF got <> 1 THEN
    RAISE EXCEPTION 'beacon_runner saw % row(s) of the probe, want 1 — policies are not engaging', got;
  END IF;
  DROP TABLE public.t_probe_553;

  -- And the heartbeat RUNS as the runner, end to end, against real state —
  -- 513 broke production because its assertions checked wiring and never ran
  -- the query. Whatever is due right now runs exactly as the next minute
  -- would have run it.
  SET LOCAL ROLE beacon_runner;
  PERFORM public.run_schedules(clock_timestamp());
  PERFORM public.drain_waiting_jobs();
  RESET ROLE;

  RAISE NOTICE '553: the scheduled path runs as a caller';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
