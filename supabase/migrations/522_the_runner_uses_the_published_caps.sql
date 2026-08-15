-- The runner uses the published caps, and a fallback waits when a retry is due.
--
-- 521 added the numbers and the classifier; this is the two call sites and the
-- one branch that consume them.
--
-- The cap is now per condition type — 1,000,000 for run_on_all, 100,000 for
-- the others — and object_set_keys raises past it rather than truncating,
-- because "Error message when saving the automation OR runtime error when
-- evaluating the automation if the input set grows beyond the limit"
-- (automate/limits) describes an error, not a smaller answer.
--
-- The fallback branch reads the rule as the disjunction it is. Behaviour is
-- UNCHANGED for every automation that has no retry configuration, which is all
-- of them today.
--
-- Both functions are the live definitions with those edits, from
-- pg_get_functiondef.

CREATE OR REPLACE FUNCTION public.automation_fires(p_automation uuid, p_at timestamp with time zone)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE a record; now_keys text[]; was_keys text[]; fired text[];
BEGIN
  SELECT * INTO a FROM public.automations WHERE id = p_automation;
  IF a.id IS NULL OR a.paused THEN RETURN NULL; END IF;

  IF a.condition->>'type' = 'time' THEN
    IF public.cron_matches(a.condition->>'cron',
                           coalesce(a.condition->>'timezone', 'UTC'), p_at) THEN
      RETURN '{}';   -- fired, with no objects to name
    END IF;
    RETURN NULL;
  END IF;

  -- The published cap for THIS condition type, and it raises past it: the
  -- page says exceeding the limit is an error, not a smaller answer.
  now_keys := public.object_set_keys((a.condition->>'object_set_id')::uuid,
                                     public.automation_input_limit(a.condition->>'type'));
  was_keys := coalesce(
    (SELECT array_agg(x) FROM jsonb_array_elements_text(
       coalesce(a.condition_state->'members', '[]'::jsonb)) x), '{}');

  CASE a.condition->>'type'
    WHEN 'objects_added' THEN
      SELECT coalesce(array_agg(k), '{}') INTO fired
        FROM unnest(now_keys) k WHERE NOT (k = ANY (was_keys));
    WHEN 'objects_removed' THEN
      SELECT coalesce(array_agg(k), '{}') INTO fired
        FROM unnest(was_keys) k WHERE NOT (k = ANY (now_keys));
    WHEN 'run_on_all' THEN
      -- "Periodically runs effects on all objects in a given object set."
      fired := now_keys;
    ELSE
      RETURN NULL;
  END CASE;

  IF fired IS NULL OR cardinality(fired) = 0 THEN RETURN NULL; END IF;
  RETURN fired;
END $function$;

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
END $function$;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF d NOT LIKE '%automation_error_retryable%' OR d NOT LIKE '%automation_input_limit%' THEN
    RAISE EXCEPTION 'the runner does not use the published limits or the classifier';
  END IF;
  d := pg_get_functiondef('public.automation_fires(uuid,timestamptz)'::regprocedure);
  IF d NOT LIKE '%automation_input_limit%' THEN
    RAISE EXCEPTION 'evaluation does not use the published limit';
  END IF;

  -- Executed, not matched.
  PERFORM public.run_automations(now());
  PERFORM public.run_schedules(now());

  RAISE NOTICE '522: the published caps, and a fallback that waits for the ladder';
END $$;
