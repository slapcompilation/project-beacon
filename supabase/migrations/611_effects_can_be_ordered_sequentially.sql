-- Sequential execution: the four steps readings/automate.md wrote down in
-- August and deliberately did not build.
--
-- The reading's reason for waiting was exact — restating run_automations from a
-- partial read of its live definition is how 543 shipped a described-but-
-- unapplied patch. That reason has expired: the runner's live definition has
-- been read and patched twice since (609, and #745's read of it), and this
-- patch is again taken from pg_get_functiondef rather than memory.
--
-- THE RULE, from the page that configures it:
--
--   "Action, logic, and function effects can be ordered sequentially. You must
--   have at least two of these types of effects to enable sequential execution.
--   Otherwise, effects execute in parallel."
--   — automate/effect-settings.md
--
--   "In sequential execution, if an effect fails, subsequent effects in the
--   sequence will not execute. This applies even if a fallback effect is
--   configured and executes successfully. A successful fallback action handles
--   the failure of that specific effect but does not allow the sequence to
--   continue."
--   — automate/effect-settings.md
--
-- and confirmed independently by a second page, which is why this is worth
-- building rather than inferring:
--
--   "Sequential execution: If an effect fails, subsequent effects in the
--   sequence do not execute."
--   — automate/errors.md
--
-- PARALLEL IS THE DEFAULT, because the page makes it the fallback whenever
-- sequential is not configurable. Our runner has always continued past a failed
-- effect, which the weekly adversary once reported as contradicting a published
-- stop rule; it was implementing the documented default. What was missing is
-- the OTHER mode, so an automation Foundry would let you order could not be.
--
-- ORDERABLE IS A REGISTRY COLUMN, not a list here. The page names exactly three
-- — action, logic, function — and automation_effect_kinds() already holds those
-- plus notification, so the flag restates nothing.
--
-- THE TWO-EFFECT RULE IS A TRIGGER: it counts rows in another table, which a
-- CHECK cannot do. It fires on the automation and on its effects, because
-- deleting an effect can invalidate a mode set when there were two.
--
-- WHAT THIS DOES NOT BUILD: partitioning. The page's worked example is about
-- 40 objects at partition size 20, and we have no partition — so "Sequential
-- execution settings apply regardless of partitioning configuration" is a
-- sentence with nothing to apply to here. Recorded, not approximated.

ALTER TABLE public.automations
  ADD COLUMN execution text NOT NULL DEFAULT 'parallel'
    CHECK (execution IN ('sequential', 'parallel'));

COMMENT ON COLUMN public.automations.execution IS
  'Values from automate/effect-settings: sequential stops the sequence at a failed effect; parallel lets effects fail independently and is the default whenever sequential is not configurable.';

-- Patched from pg_get_functiondef, after a first draft RETYPED this function
-- and got two things wrong: it invented a `SELECT * FROM (VALUES ...) AS t(...)`
-- wrapper the body does not have, and it changed the function kind's runtime
-- from 'function' to 'action-runtime'. The rule earns its keep again.
-- A RETURNS TABLE signature cannot be widened in place (Postgres refuses with
-- a cannot-change-return-type error), so it is dropped and recreated. Nothing depends
-- on it in the catalogue sense: the callers name it from inside function
-- bodies, which Postgres does not track.
DROP FUNCTION public.automation_effect_kinds();
CREATE FUNCTION public.automation_effect_kinds()
 RETURNS TABLE(kind text, runtime text, executable boolean, orderable boolean, note text)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  VALUES
    ('action',       'sql',      true, true,
     'Execute actions on objects, such as creating, modifying, or deleting object instances.'),
    ('function',     'function', true, true,
     'Execute a function when the automation condition is met. Needs the action runtime, which owns the isolate — not this heartbeat, which is SQL.'),
    ('notification', 'none',     false, false,
     'Send notifications to users or groups. No notification system exists here; recorded so the surface can name it.'),
    ('logic',        'none',     false, true,
     'Execute AIP Logic functions. AIP Logic is a product we do not have.')
$function$;

CREATE OR REPLACE FUNCTION public.guard_sequential_needs_two()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_automation uuid; v_n int;
BEGIN
  -- IF, not a CASE expression: plpgsql evaluates every arm of a CASE, and
  -- NEW.automation_id does not exist on a row of `automations`. The first
  -- draft used one and failed on exactly that missing field at runtime.
  IF TG_TABLE_NAME = 'automations' THEN
    v_automation := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_automation := OLD.automation_id;
  ELSE
    v_automation := NEW.automation_id;
  END IF;

  IF (SELECT a.execution FROM public.automations a WHERE a.id = v_automation) <> 'sequential' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
  END IF;

  -- A fallback is not part of the sequence: it covers one effect rather than
  -- taking a place in the order.
  SELECT count(*) INTO v_n
    FROM public.automation_effects e
    JOIN public.automation_effect_kinds() k ON k.kind = e.kind
   WHERE e.automation_id = v_automation AND e.fallback_for IS NULL AND k.orderable;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'Automate:SequentialNeedsTwo — you must have at least two orderable effects to enable sequential execution'
      USING HINT = 'Action, logic and function effects can be ordered; effects otherwise execute in parallel.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_sequential_needs_two
  AFTER INSERT OR UPDATE OF execution ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_sequential_needs_two();

-- Deleting an effect can invalidate a mode that was legal when it was set.
CREATE CONSTRAINT TRIGGER guard_sequential_still_has_two
  AFTER INSERT OR UPDATE OR DELETE ON public.automation_effects
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.guard_sequential_needs_two();

-- The runner, patched from pg_get_functiondef: the effect loop gains a label
-- and one EXIT after the fallback block closes. Nothing else in the body moved.
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

      <<effects>>
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
        -- Sequential stops here. Parallel does not, and is the default
        -- whenever sequential is not configurable (611).
        IF (SELECT m.execution FROM public.automations m WHERE m.id = a.id) = 'sequential' THEN
          EXIT effects;
        END IF;
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

-- Proved by DOING it, and by contrast: the same two effects, the same failing
-- first one, run under each mode. Sequential must leave the second untouched;
-- parallel must run it. Either assertion alone would pass against a runner
-- stuck in one mode.
DO $$
DECLARE
  v_ont uuid; v_proj uuid; v_owner uuid; v_bad uuid; v_ok uuid;
  v_a uuid; v_n int; v_err text;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_ont IS NULL OR v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no ontology, project or user: 611 cannot prove its own rule';
    END IF;

    -- One action type that FAILS on apply (a required parameter nobody passes)
    -- and one that succeeds, so the first effect's failure is observable.
    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-611-fails', 'Probe 611 fails') RETURNING id INTO v_bad;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, required, position)
    VALUES (v_bad, 'needed', 'Needed', 'string', true, 0);
    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-611-works', 'Probe 611 works') RETURNING id INTO v_ok;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 611', v_owner,
            '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_bad), (v_a, 1, 'action', v_ok);
    PERFORM set_config('request.jwt.claims', '', true);

    -- (1) PARALLEL, the default: both effects run, the first fails.
    PERFORM public.run_automations(date_trunc('minute', now()));
    SELECT count(*) INTO v_n FROM public.automation_runs r WHERE r.automation_id = v_a;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'parallel: expected both effects to run, got % run(s)', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome = 'failed';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'parallel: expected exactly 1 failure, got %; the probe is not testing what it thinks', v_n;
    END IF;

    -- (2) SEQUENTIAL, same effects, same minute: the second never runs.
    DELETE FROM public.automation_runs WHERE automation_id = v_a;
    UPDATE public.automations SET execution = 'sequential', last_run_at = NULL WHERE id = v_a;
    PERFORM public.run_automations(date_trunc('minute', now()));
    SELECT count(*) INTO v_n FROM public.automation_runs r WHERE r.automation_id = v_a;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'sequential: the sequence did not stop at the failed effect — % run(s)', v_n;
    END IF;

    -- (3) the two-effect rule refuses, BY NAME, and only when it should
    UPDATE public.automations SET execution = 'parallel' WHERE id = v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    DELETE FROM public.automation_effects WHERE automation_id = v_a AND position = 1;
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
      UPDATE public.automations SET execution = 'sequential' WHERE id = v_a;
      RAISE EXCEPTION 'sequential was enabled with one orderable effect';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      IF v_err NOT LIKE 'Automate:SequentialNeedsTwo%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'parallel ran both and failed one; sequential stopped at the failure; one orderable effect refused sequential by name';
  END;
END $$;
