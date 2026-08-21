-- Mute and expiry: two of the five statuses the Automations filter pane
-- enumerates, and the two #745 had to draw disabled.
--
-- Decision 1 of readings/automate.md § Four pages said no new columns until a
-- surface existed. #745 is that surface, so the condition is met.
--
-- MUTE IS NOT PAUSE. The page states both, and they are orthogonal:
--
--   "When an automation is muted, the condition continues to be evaluated and
--   activity is still recorded. However, no effects will be triggered."
--   — automate/muting-pausing-expiration.md
--
--   "While an automation is paused, scheduled and live triggers do not run."
--   — automate/muting-pausing-expiration.md
--
-- So a muted automation stays a CANDIDATE and its condition is evaluated; only
-- the effect loop changes. A paused one is not a candidate at all, which is
-- what automation_candidates() already does.
--
-- "ACTIVITY IS STILL RECORDED" lands on `skipped`, which 517 put in the outcome
-- vocabulary and nothing has ever written — an allowed value with no producer.
-- This gives it the one the word describes. Our only ledger is per effect per
-- firing, so a muted firing records one skipped row per effect; the eleven
-- event types remain unbuilt and this does not pretend otherwise.
--
-- EXPIRY BLOCKS EVERYTHING:
--
--   "Expired, trashed, and otherwise disabled automations continue to block all
--   execution, including manual runs."
--   — automate/muting-pausing-expiration.md
--
-- so it is excluded from the candidate set rather than handled in the loop.
-- NULL means the other documented choice — "configured to have an expiration
-- date or to run indefinitely".
--
-- THE SIX-MONTH CAP IS A TRIGGER, NOT A CHECK:
--
--   "The longest permitted expiration date is six months from the present
--   time."
--   — automate/muting-pausing-expiration.md
--
-- "from the present time" is a fact about the moment of setting, not an
-- invariant of the row — a row set five months out is still legal next month.
-- A CHECK would re-evaluate on every write and on restore; the ladder's trigger
-- rung is where a rule that reads the clock belongs.
--
-- AUTO-MUTE IS NOT BUILT, and this is the interesting refusal. Its rule is
-- exact — "the automation will automatically mute when all effects fail for at
-- least 80% of the past 30 events" — but it counts EVENTS, and we have runs
-- per effect. Thirty events is not thirty rows, and picking a row-based
-- approximation would invent a threshold Foundry did not state. That is the
-- same mistake the reading's Decision 3 was corrected for, one step further on.

ALTER TABLE public.automations
  ADD COLUMN muted      boolean NOT NULL DEFAULT false,
  ADD COLUMN expires_at timestamptz;

COMMENT ON COLUMN public.automations.muted IS
  'A muted automation still evaluates its condition and records activity; no effects are triggered (automate/muting-pausing-expiration).';
COMMENT ON COLUMN public.automations.expires_at IS
  'NULL runs indefinitely. An expired automation blocks all execution, including manual runs (automate/muting-pausing-expiration).';

CREATE OR REPLACE FUNCTION public.guard_automation_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at > now() + interval '6 months' THEN
    RAISE EXCEPTION 'Automate:ExpiryTooFar — the longest permitted expiration date is six months from the present time'
      USING HINT = 'Leave it empty to run indefinitely.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_automation_expiry
  BEFORE INSERT OR UPDATE OF expires_at ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_automation_expiry();

-- Patched from pg_get_functiondef: one AND added, nothing else moved.
CREATE OR REPLACE FUNCTION public.automation_candidates()
 RETURNS TABLE(id uuid, condition jsonb, runner_id uuid, runner_role text, runner_org uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT a.id, a.condition, u.id, u.role, u.organization_id
    FROM public.automations a
    JOIN public.users u ON u.id = a.owner_id
   WHERE NOT a.paused
     AND (a.expires_at IS NULL OR a.expires_at > now())
   ORDER BY a.created_at
   LIMIT 50
$function$;

-- The runner, patched from pg_get_functiondef with one branch added at the top
-- of the fired block; nothing else in the body moved.
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

-- Three paths, each PROVED BY DOING IT: an expiry past six months is refused,
-- an expired automation is not a candidate, and a muted one fires, records, and
-- executes nothing. Rolled back — a migration's INSERTs commit.
DO $$
DECLARE
  v_proj uuid;
  v_owner uuid;
  v_at uuid;
  v_a  uuid;
  v_e  uuid;
  v_n  int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    SELECT a.id INTO v_at FROM public.action_types a LIMIT 1;
    IF v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project or user: 609 cannot prove its own guards';
    END IF;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 609', v_owner,
            '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    -- (1) the six-month cap refuses, BY NAME
    BEGIN
      UPDATE public.automations SET expires_at = now() + interval '7 months' WHERE id = v_a;
      RAISE EXCEPTION 'an expiry seven months out was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Automate:ExpiryTooFar%' THEN RAISE; END IF;
    END;
    -- and five months is fine, so the guard is not simply refusing everything
    UPDATE public.automations SET expires_at = now() + interval '5 months' WHERE id = v_a;

    -- (2) an expired automation is not a candidate; a live one is
    SELECT count(*) INTO v_n FROM public.automation_candidates() c WHERE c.id = v_a;
    IF v_n <> 1 THEN RAISE EXCEPTION 'a live automation was not a candidate'; END IF;
    UPDATE public.automations SET expires_at = now() - interval '1 day' WHERE id = v_a;
    SELECT count(*) INTO v_n FROM public.automation_candidates() c WHERE c.id = v_a;
    IF v_n <> 0 THEN RAISE EXCEPTION 'an expired automation was still a candidate'; END IF;

    -- (3) muted: the condition still fires, and every effect records `skipped`
    UPDATE public.automations SET expires_at = NULL, muted = true WHERE id = v_a;
    IF v_at IS NULL THEN
      RAISE NOTICE 'no action type to attach an effect to; the muted branch is unproven here';
    ELSE
      INSERT INTO public.automation_effects (automation_id, kind, action_type_id)
      VALUES (v_a, 'action', v_at) RETURNING id INTO v_e;

      PERFORM public.run_automations(date_trunc('minute', now()));

      SELECT count(*) INTO v_n FROM public.automation_runs r
       WHERE r.automation_id = v_a AND r.outcome = 'skipped';
      IF v_n < 1 THEN
        RAISE EXCEPTION 'a muted automation recorded no skipped run; activity was not recorded';
      END IF;
      SELECT count(*) INTO v_n FROM public.automation_runs r
       WHERE r.automation_id = v_a AND r.outcome <> 'skipped';
      IF v_n <> 0 THEN
        RAISE EXCEPTION 'a muted automation executed % effect run(s)', v_n;
      END IF;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'expiry capped at six months, expired is not a candidate, and a muted firing skipped every effect';
  END;
END $$;
