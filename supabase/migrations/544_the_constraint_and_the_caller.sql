-- 543 shipped two omissions. Both are corrected here, and both were the
-- mistakes this repository has already paid for once.
--
-- ── ONE: A CONSTRAINT THAT NOTHING COULD SATISFY ────────────────────────────
-- 543 added CHECK ((outcome = 'awaiting_retry') = (next_attempt_at IS NOT NULL))
-- and a comment claiming run_automations "now also says when". It does not —
-- the patch was described and never applied. So the moment a retryable failure
-- occurred, the UPDATE setting 'awaiting_retry' would violate the CHECK and
-- take the whole automation pass down with it.
--
-- Its assertions passed because they asked about the SHAPE — is the constraint
-- there, is any row stranded — and not about the behaviour. That is the same
-- error as 514's grep-only assertion, which was green while the heartbeat was
-- dead. An assertion has to execute the path.
--
-- ── TWO: A RUNNER WITH NO CALLER ────────────────────────────────────────────
-- 543's own header quotes the rule — "517 shipped a runner with no caller and
-- 518 had to wire it in. A runner and its caller belong together" — and then
-- shipped run_automation_retries with no caller. Writing the lesson down is not
-- the same as following it. run_schedules now calls it, beside the three hands
-- already there.
--
-- Both bodies below are restated from the LIVE definitions and patched in one
-- place each.

CREATE OR REPLACE FUNCTION public.run_automations(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a record; e record; u record; before text; fired text[]; ran int := 0; run_id uuid;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-automations')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR a IN SELECT * FROM public.automations WHERE NOT paused ORDER BY created_at LIMIT 50 LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2 WHERE u2.id = a.owner_id;
    CONTINUE WHEN u IS NULL;   -- an ownerless automation runs as nobody

    -- Everything below is the OWNER's: "Condition evaluation: Uses automation
    -- owner's permissions", so a condition cannot see what its owner cannot.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u.id::text,
        'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);

    BEGIN
      fired := public.automation_fires(a.id, p_at);
    EXCEPTION WHEN OTHERS THEN
      fired := NULL;
    END;

    IF fired IS NOT NULL THEN
      FOR e IN SELECT * FROM public.automation_effects
                WHERE automation_id = a.id AND fallback_for IS NULL ORDER BY position LOOP
        -- Recorded BEFORE the attempt. At-least-once is the promise.
        INSERT INTO public.automation_runs (automation_id, effect_id, outcome)
        VALUES (a.id, e.id, 'started') RETURNING id INTO run_id;
        BEGIN
          IF NOT coalesce((SELECT k.executable FROM public.automation_effect_kinds() k
                            WHERE k.kind = e.kind), false) THEN
            RAISE EXCEPTION 'Automate:EffectNotExecutable — % effects are not built', e.kind;
          END IF;
          IF (SELECT k.runtime FROM public.automation_effect_kinds() k WHERE k.kind = e.kind) <> 'sql' THEN
            RAISE EXCEPTION 'Automate:WrongRuntime — a % effect is executed by the action runtime, which owns the isolate', e.kind;
          END IF;
          PERFORM public.apply_action(e.action_type_id, e.parameters);
          UPDATE public.automation_runs SET outcome = 'succeeded' WHERE id = run_id;
        EXCEPTION WHEN OTHERS THEN
          -- "Fallback effects are not eligible for retries, and will only
          -- execute if an object failed non-retryably, OR the maximum number
          -- of retries has been reached." A disjunction, and the second arm
          -- matters: with no retry strategy the maximum is zero and trivially
          -- reached, so an unconfigured effect falls back at once — which is
          -- what 517 did and was right to do. Only a RETRYABLE failure on an
          -- effect that configured retries withholds it.
          UPDATE public.automation_runs
             SET outcome = CASE
                   WHEN e.retry_count IS NOT NULL
                        AND public.automation_error_retryable(sqlerrm)
                   THEN 'awaiting_retry' ELSE 'failed' END,
                 -- 543 tied the outcome to a due time. Without this the CHECK
                 -- refuses the row and the whole automation pass fails.
                 next_attempt_at = CASE
                   WHEN e.retry_count IS NOT NULL
                        AND public.automation_error_retryable(sqlerrm)
                   THEN public.automation_retry_due(e.id, 1) END,
                 error = sqlerrm
           WHERE id = run_id;

          DECLARE f record; fid uuid; held boolean;
          BEGIN
            held := e.retry_count IS NOT NULL AND public.automation_error_retryable(sqlerrm);
            FOR f IN SELECT * FROM public.automation_effects
                      WHERE fallback_for = e.id AND NOT held ORDER BY position LOOP
              INSERT INTO public.automation_runs (automation_id, effect_id, outcome)
              VALUES (a.id, f.id, 'started') RETURNING id INTO fid;
              BEGIN
                PERFORM public.apply_action(f.action_type_id, f.parameters);
                UPDATE public.automation_runs SET outcome = 'succeeded' WHERE id = fid;
              EXCEPTION WHEN OTHERS THEN
                UPDATE public.automation_runs SET outcome = 'failed', error = sqlerrm WHERE id = fid;
              END;
            END LOOP;
          END;
        END;
      END LOOP;
      ran := ran + 1;
    END IF;

    -- Membership is remembered whether or not it fired, so the next diff is
    -- against what was actually there.
    IF a.condition->>'type' <> 'time' THEN
      UPDATE public.automations
         SET condition_state = jsonb_build_object('members',
               to_jsonb(public.object_set_keys((a.condition->>'object_set_id')::uuid,
                          public.automation_input_limit(a.condition->>'type')))),
             last_run_at = CASE WHEN fired IS NOT NULL THEN p_at ELSE last_run_at END
       WHERE id = a.id;
    ELSIF fired IS NOT NULL THEN
      UPDATE public.automations SET last_run_at = p_at WHERE id = a.id;
    END IF;

    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  END LOOP;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RETURN ran;
END $function$
;

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
  PERFORM public.run_automation_retries(p_at);
  RETURN ran;
END $function$
;

-- ── assertions, which EXECUTE the path 543 only described ───────────────────
DO $do$
DECLARE n int; d text;
BEGIN
  -- The minute hand calls it. This is the check 543 needed and did not have.
  d := pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure);
  IF d NOT LIKE '%run_automation_retries%' THEN
    RAISE EXCEPTION 'the minute hand still does not call the retry pass';
  END IF;

  -- And a withheld retry can actually be recorded. A row is inserted through
  -- the same shape run_automations uses, and rolled back.
  BEGIN
    INSERT INTO public.automation_runs (automation_id, effect_id, outcome, next_attempt_at)
    SELECT a.id, e.id, 'awaiting_retry', clock_timestamp()
      FROM public.automations a JOIN public.automation_effects e ON e.automation_id = a.id
     LIMIT 1;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 1 THEN
      -- and refused without the time, which is the constraint's whole point
      BEGIN
        INSERT INTO public.automation_runs (automation_id, effect_id, outcome)
        SELECT a.id, e.id, 'awaiting_retry'
          FROM public.automations a JOIN public.automation_effects e ON e.automation_id = a.id
         LIMIT 1;
        RAISE EXCEPTION 'a run awaited a retry with no due time';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END IF;
    RAISE EXCEPTION 'probe-544-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '544: the constraint has a writer, and the runner has a caller';
END $do$;
