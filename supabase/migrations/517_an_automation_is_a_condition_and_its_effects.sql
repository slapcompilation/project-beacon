-- An automation: a condition, and the effects it fires.
--
--   "Automate is an application for business automation. With Automate, you
--    can define conditions that are checked continuously or on a schedule,
--    along with effects that execute automatically when the specified
--    conditions are met."                              (automate/overview)
--
-- ── EXECUTION IDENTITY, WHICH IS THE LOAD-BEARING PART ──────────────────────
--   "Condition evaluation: Uses automation owner's permissions"
--   "Action and Logic effects: Execute as the automation owner"
--   "Regardless of scoping mode, automations execute as the owner."
--                                    (automate/permissions, automate/security)
--
-- The OWNER, not the last editor. An owner is an explicit transferable role,
-- and editing is gated on holding it:
--
--   "You must take ownership of the automation to make edits to the condition
--    or effects."
--   "Future actions effects will execute on behalf of the new owner."
--
-- ── SCOPE IS NOT AN IDENTITY ────────────────────────────────────────────────
-- "Project scope enables team collaboration by making run history (including
-- effect executions) visible to all users who satisfy the markings on a run" —
-- who SEES history, never whose rights run. The page says "automations execute
-- as the owner" three times for exactly this reason, so the column is stored
-- and the runner never reads it.
--
-- ── AT-LEAST-ONCE, PROMISED OUT LOUD ────────────────────────────────────────
--   "Effects follow at-least-once execution semantics rather than exactly-once
--    guarantees. In rare cases, the same effect may execute multiple times for
--    the same trigger event."                      (automate/effect-settings)
--
-- So the run is recorded BEFORE the effect is attempted: a crash re-runs
-- rather than skips, which is the direction the page chooses. Authors are told
-- to be idempotent and so are we.
--
-- ── THE CONDITION GRAMMAR ───────────────────────────────────────────────────
-- Time is 495's cron, shared rather than restated: "Exactly five fields (space
-- separated): minutes, hours, day of month, month, day of week", "seconds and
-- years fields are not supported".
--
-- Object set conditions ship as the three the evaluation-frequency matrix says
-- can be scheduled. "Objects modified in set" is LIVE ONLY in that table, so it
-- is refused by name rather than approximated on a timer, and "Threshold
-- crossed" needs a metric history we do not have.

-- ── §1 the effect kinds, said by the database ───────────────────────────────
-- 446's shape: the registry carries what executes and which runtime does it,
-- so the surface disables rather than hides, and nothing restates the list.
CREATE OR REPLACE FUNCTION public.automation_effect_kinds()
RETURNS TABLE (kind text, runtime text, executable boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  VALUES
    ('action',       'sql',      true,
     'Execute actions on objects, such as creating, modifying, or deleting object instances.'),
    ('function',     'function', true,
     'Execute a function when the automation condition is met. Needs the action runtime, which owns the isolate — not this heartbeat, which is SQL.'),
    ('notification', 'none',     false,
     'Send notifications to users or groups. No notification system exists here; recorded so the surface can name it.'),
    ('logic',        'none',     false,
     'Execute AIP Logic functions. AIP Logic is a product we do not have.')
$$;
REVOKE ALL ON FUNCTION public.automation_effect_kinds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.automation_effect_kinds() TO authenticated;

-- ── §2 the condition grammar ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.automation_condition_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  CASE p->>'type'
    WHEN 'time' THEN
      -- The five fields, and the two refusals, are cron_matches' business.
      RETURN (p->>'cron') IS NOT NULL AND btrim(p->>'cron') <> '';
    WHEN 'objects_added', 'objects_removed', 'run_on_all' THEN
      RETURN (p->>'object_set_id') IS NOT NULL;
    ELSE
      RETURN false;
  END CASE;
END $$;

CREATE TABLE public.automations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  display_name    text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description     text NOT NULL DEFAULT '',
  -- "Execute as the automation owner", every time.
  owner_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  condition       jsonb NOT NULL CHECK (public.automation_condition_valid(condition)),
  -- Who sees run history. NEVER an execution identity.
  scope           text NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'project')),
  paused          boolean NOT NULL DEFAULT false,
  -- The previous membership an object-set condition compares against, kept
  -- the way schedules.trigger_state keeps observed events.
  condition_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automations_project_idx ON public.automations (project_id);
CREATE INDEX automations_owner_idx   ON public.automations (owner_id);
COMMENT ON TABLE public.automations IS
  'A condition and the effects it fires. Everything executes as the OWNER — condition evaluation included — and scope governs only who sees run history.';

CREATE TABLE public.automation_effects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  kind          text NOT NULL CHECK (kind IN ('action', 'function', 'notification', 'logic')),
  action_type_id uuid REFERENCES public.action_types(id) ON DELETE CASCADE,
  function_id    uuid REFERENCES public.functions(id) ON DELETE CASCADE,
  parameters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- "Fallback effects execute when the primary effect fails" — a fallback
  -- names the effect it covers.
  fallback_for  uuid REFERENCES public.automation_effects(id) ON DELETE CASCADE,
  CHECK ((kind = 'action')   = (action_type_id IS NOT NULL)),
  CHECK ((kind = 'function') = (function_id IS NOT NULL))
);
CREATE INDEX automation_effects_automation_idx ON public.automation_effects (automation_id, position);
CREATE INDEX automation_effects_action_idx     ON public.automation_effects (action_type_id);
CREATE INDEX automation_effects_function_idx   ON public.automation_effects (function_id);
CREATE INDEX automation_effects_fallback_idx   ON public.automation_effects (fallback_for);
COMMENT ON TABLE public.automation_effects IS
  'What an automation does when its condition holds. A fallback effect names the effect it covers and runs when that one fails.';

CREATE TABLE public.automation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  effect_id     uuid REFERENCES public.automation_effects(id) ON DELETE SET NULL,
  -- Written BEFORE the effect is attempted, so a crash re-runs rather than
  -- skips: "at-least-once execution semantics rather than exactly-once".
  outcome       text NOT NULL DEFAULT 'started'
                CHECK (outcome IN ('started', 'succeeded', 'failed', 'skipped')),
  error         text,
  ran_at        timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX automation_runs_automation_idx ON public.automation_runs (automation_id, ran_at DESC);
CREATE INDEX automation_runs_effect_idx     ON public.automation_runs (effect_id);

-- ── §3 ownership gates editing ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_automation_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- "You must take ownership of the automation to make edits to the condition
  -- or effects."
  IF (NEW.condition IS DISTINCT FROM OLD.condition)
     AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Automate:TakeOwnershipToEdit — editing the condition takes ownership of the automation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER guard_automation_ownership
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_automation_ownership();

CREATE OR REPLACE FUNCTION public.guard_automation_effect_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT a.owner_id INTO owner FROM public.automations a
   WHERE a.id = coalesce(NEW.automation_id, OLD.automation_id);
  IF owner IS NOT NULL AND owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Automate:TakeOwnershipToEdit — editing the effects takes ownership of the automation';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER guard_automation_effect_ownership
  BEFORE INSERT OR UPDATE OR DELETE ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_automation_effect_ownership();

-- ── §4 visibility ───────────────────────────────────────────────────────────
ALTER TABLE public.automations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members see automations" ON public.automations
  FOR SELECT USING (public.role_rank(public.project_role(project_id)) >= public.role_rank('viewer'));
CREATE POLICY "editors write automations" ON public.automations
  FOR ALL USING (public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "effects follow their automation" ON public.automation_effects
  FOR ALL USING (EXISTS (SELECT 1 FROM public.automations a
                          WHERE a.id = automation_id
                            AND public.role_rank(public.project_role(a.project_id)) >= public.role_rank('editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.automations a
                       WHERE a.id = automation_id
                         AND public.role_rank(public.project_role(a.project_id)) >= public.role_rank('editor')));
CREATE POLICY "readers see effects" ON public.automation_effects
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.automations a
                             WHERE a.id = automation_id
                               AND public.role_rank(public.project_role(a.project_id)) >= public.role_rank('viewer')));

-- "User-scoped automations: Only the automation's owner has access to run
-- history. Project-scoped automations ... sharing run history with all users".
CREATE POLICY "run history follows the scope" ON public.automation_runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.automations a
     WHERE a.id = automation_id
       AND (a.owner_id = (SELECT auth.uid())
            OR (a.scope = 'project'
                AND public.role_rank(public.project_role(a.project_id)) >= public.role_rank('viewer')))));

-- ── §5 evaluation ───────────────────────────────────────────────────────────
-- The primary keys currently in a saved object set, capped: an automation that
-- watches an unbounded set is a cost problem, not a correctness one, and the
-- cap is ours rather than the page's.
CREATE OR REPLACE FUNCTION public.object_set_keys(p_set uuid, p_limit int DEFAULT 10000)
RETURNS text[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(array_agg(k ORDER BY k), '{}')
    FROM (
      SELECT r ->> (SELECT p.api_name FROM public.object_type_properties p
                     JOIN public.object_sets os ON os.id = p_set
                    WHERE p.object_type_id = os.subject_type_id AND p.is_primary_key) AS k
        FROM public.object_set_rows(p_set, p_limit, 0) r
    ) rows
   WHERE k IS NOT NULL
$$;

-- Does the condition hold now? Returns the keys that triggered it, so an
-- effect can be told which objects it is about — the page calls these "effect
-- input parameters". NULL means it did not fire.
CREATE OR REPLACE FUNCTION public.automation_fires(p_automation uuid, p_at timestamptz)
RETURNS text[] LANGUAGE plpgsql STABLE SET search_path = public AS $$
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

  now_keys := public.object_set_keys((a.condition->>'object_set_id')::uuid);
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
END $$;

-- ── §6 the runner ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_automations(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
          UPDATE public.automation_runs SET outcome = 'failed', error = sqlerrm WHERE id = run_id;
          -- "Fallback effects execute when the primary effect fails."
          DECLARE f record; fid uuid;
          BEGIN
            FOR f IN SELECT * FROM public.automation_effects
                      WHERE fallback_for = e.id ORDER BY position LOOP
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
               to_jsonb(public.object_set_keys((a.condition->>'object_set_id')::uuid))),
             last_run_at = CASE WHEN fired IS NOT NULL THEN p_at ELSE last_run_at END
       WHERE id = a.id;
    ELSIF fired IS NOT NULL THEN
      UPDATE public.automations SET last_run_at = p_at WHERE id = a.id;
    END IF;

    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  END LOOP;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_automations(timestamptz) FROM PUBLIC, anon, authenticated;

-- ── assertions, which RUN ───────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  IF public.automation_condition_valid('{"type":"time","cron":"*/5 * * * *"}'::jsonb) IS NOT true THEN
    RAISE EXCEPTION 'a time condition was refused';
  END IF;
  IF public.automation_condition_valid('{"type":"objects_modified","object_set_id":"x"}'::jsonb) THEN
    RAISE EXCEPTION 'objects_modified is live-only and must be refused';
  END IF;
  IF public.automation_condition_valid('{"type":"threshold_crossed"}'::jsonb) THEN
    RAISE EXCEPTION 'threshold_crossed needs a metric history we do not have';
  END IF;

  SELECT count(*) INTO n FROM public.automation_effect_kinds() WHERE executable;
  IF n <> 2 THEN RAISE EXCEPTION 'expected action and function to be the executable effects, got %', n; END IF;

  n := public.run_automations(now());
  IF n IS NULL THEN RAISE EXCEPTION 'run_automations returned nothing'; END IF;

  RAISE NOTICE '517: an automation is a condition and its effects';
END $$;
