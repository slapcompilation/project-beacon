-- An object set condition gets the cadence Foundry gives it, and the runner
-- honours it. Until now every object set condition here was evaluated on the
-- minute hand, every minute, with no way to cap it.
--
--   "Scheduled monitoring evaluates the condition on a user-defined schedule."
--   — automate/evaluation-frequency.md
--
--   "A schedule allows you to check an object set condition at a specific point
--   in time or on a regular cadence."
--   — automate/evaluation-frequency.md
--
-- and both worked examples configure one:
--
--   "We keep the default of daily evaluation."
--   — automate/example-relative-time-condition.md
--
--   "Since we only want to send the report once a week, we add a schedule to
--   the condition and specify that the automation should trigger every Monday
--   morning at 8am."
--   — automate/example-weekly-report.md
--
-- I CORRECTED MY OWN READING TO GET HERE, and the correction is the reason this
-- migration is shaped the way it is. `automate.md` called the five-minute
-- cadence on `performance-best-practices` scheduled monitoring of an object set
-- condition. It is not. That page says "combine a time-based evaluation with
-- your object set condition" and then "Adding a time condition of 5 minutes",
-- against a scenario whose condition is "on object update" — which is Objects
-- modified in set, live monitoring only, and refused here by Decision 4. So
-- Lever 1 is a TIME CONDITION combined with a live-monitored object condition,
-- it is out of reach for us, and its five minutes contradicts condition-time's
-- own "A minimum frequency of once per hour" anyway. Two mechanisms, and I had
-- merged them into one.
--
-- WHICH CRON GRAMMAR, decided by that same split. The schedule is Automate's,
-- so it takes Automate's published cron requirements — the list on
-- condition-time, which 613 already built as automate_cron_valid — and not the
-- pipeline grammar cron_field_matches reads. Nothing is lost: the builder's
-- frequencies bottom out at hourly, which is exactly what that list allows.
--
-- THE SHAPE CAME OFF TWO SCREENSHOTS I had listed as unparsed one commit ago,
-- and neither the prose nor the API could have given it — there is no
-- automations endpoint under api/. `Define schedule` is a second card below the
-- condition, carrying Frequency, an interval, an optional time, a timezone, and
-- a `Use Cron expression (advanced)` toggle. That is our TimeStep component
-- exactly, which is why the surface half of this change reuses it rather than
-- building a second one. The images also confirm a causal claim the prose only
-- asserts: on the relative-time example `Use live monitoring` is greyed out,
-- and on the weekly-report example it is live. The filter really does force the
-- mode.
--
-- ABSENT MEANS DAILY, which is cited; MIDNIGHT IS INFERENCE. The example keeps
-- "the default of daily evaluation" and its capture shows `Set time` toggled
-- OFF, so a daily schedule with no time is a real state — but no page says what
-- hour it then runs. Midnight in the schedule's timezone is our choice, named
-- here so it is not read back as documented.
--
-- WHAT MAKES THIS CORRECT RATHER THAN DECORATIVE: the cadence must gate the
-- EVALUATION, not the firing. automation_fires compares the set against
-- condition_state->'members', and run_automations rewrites that snapshot on
-- every tick whether or not it fired. Gate only the firing and a daily
-- automation would fire once a day having seen one minute of additions — the
-- objects added over the other 1,439 would be silently absorbed into the
-- snapshot and never reported. So the skip goes ABOVE both, and one CONTINUE
-- covers the fire and the snapshot together.

CREATE OR REPLACE FUNCTION public.automation_schedule_cron(p jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  -- A time condition carries its own cron(s); this is only for object sets.
  SELECT CASE WHEN p->>'type' = 'time' THEN NULL
              ELSE coalesce(p->'schedule'->>'cron', '0 0 * * *') END
$$;

COMMENT ON FUNCTION public.automation_schedule_cron(jsonb) IS
  'The cadence an object set condition is evaluated on. Absent means daily ("We keep the default of daily evaluation", automate/example-relative-time-condition); midnight is our inference, no page names the hour.';

CREATE OR REPLACE FUNCTION public.automation_due(p jsonb, p_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p->>'type' = 'time' THEN true
              ELSE public.cron_matches(public.automation_schedule_cron(p),
                     coalesce(p->'schedule'->>'timezone', 'UTC'), p_at) END
$$;

COMMENT ON FUNCTION public.automation_due(jsonb, timestamptz) IS
  'Whether an object set condition is due for evaluation at this instant. A time condition is always due — automation_fires matches its own cron.';

-- Patched, not retyped: the object set arm is the only one that changed.
CREATE OR REPLACE FUNCTION public.automation_condition_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE e jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  CASE p->>'type'
    WHEN 'time' THEN
      -- Exactly one of the two spellings, so there is never a question of
      -- which one the runner reads.
      IF (p ? 'cron') = (p ? 'crons') THEN RETURN false; END IF;

      IF p ? 'cron' THEN
        RETURN public.automate_cron_valid(p->>'cron');
      END IF;

      IF jsonb_typeof(p->'crons') <> 'array'
         OR jsonb_array_length(p->'crons') = 0 THEN
        RETURN false;
      END IF;
      FOR e IN SELECT * FROM jsonb_array_elements(p->'crons') LOOP
        IF jsonb_typeof(e) <> 'string'
           OR NOT public.automate_cron_valid(e #>> '{}') THEN
          RETURN false;
        END IF;
      END LOOP;
      RETURN true;
    WHEN 'objects_added', 'objects_removed', 'run_on_all' THEN
      IF (p->>'object_set_id') IS NULL THEN RETURN false; END IF;
      -- Optional, because absent is a legal state with a documented default.
      -- Present and malformed is not.
      IF p ? 'schedule' THEN
        IF jsonb_typeof(p->'schedule') <> 'object'
           OR NOT public.automate_cron_valid(p->'schedule'->>'cron') THEN
          RETURN false;
        END IF;
      END IF;
      RETURN true;
    ELSE
      RETURN false;
  END CASE;
END $function$;

-- run_automations is patched from its own live definition rather than retyped.
-- Retyping apply_object_type from memory once invented two helpers that do not
-- exist; this inserts one guard at a named anchor and RAISES if the anchor has
-- moved, so it cannot half-apply against a body it does not recognise.
DO $$
DECLARE d text; anchor text; ins text; patched text;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF position('automation_due' in d) > 0 THEN
    RAISE NOTICE 'run_automations already honours the schedule';
    RETURN;
  END IF;

  anchor := $a$    -- "Condition evaluation: Uses automation owner's permissions" — and now$a$;
  ins := $b$    -- Off-cadence: skip the whole evaluation. Not just the firing —$b$ || chr(10) ||
         $c$    -- the membership snapshot below must not advance either.$c$ || chr(10) ||
         $d$    IF NOT public.automation_due(a.condition, p_at) THEN CONTINUE; END IF;$d$ || chr(10) || chr(10);

  patched := replace(d, anchor, ins || anchor);
  IF patched = d THEN
    RAISE EXCEPTION 'the anchor comment moved; 617 will not guess where to insert the guard';
  END IF;
  EXECUTE patched;
  RAISE NOTICE 'run_automations now skips an object set condition that is not due';
END $$;

-- Proved BY CONTRAST, because a guard that refuses everything would pass a
-- one-sided probe. The same automation, the same runner, two instants: one the
-- schedule matches and one it does not. The assertion that matters is the
-- SNAPSHOT — if condition_state advanced on the off-cadence tick, the fix is
-- decorative and a daily automation would report one minute of additions.
DO $$
DECLARE
  v_proj uuid; v_owner uuid; v_a uuid; v_set uuid;
  v_state_off jsonb; v_state_on jsonb; v_ok boolean;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    SELECT s.id INTO v_set FROM public.object_sets s LIMIT 1;
    IF v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project or user: 617 cannot prove its own rule';
    END IF;

    -- (1) the grammar: a schedule is optional, and a malformed one is refused
    IF NOT public.automation_condition_valid(
         jsonb_build_object('type', 'objects_added', 'object_set_id', gen_random_uuid())) THEN
      RAISE EXCEPTION 'a condition with no schedule was refused; absent is legal';
    END IF;
    IF NOT public.automation_condition_valid(
         jsonb_build_object('type', 'objects_added', 'object_set_id', gen_random_uuid(),
           'schedule', jsonb_build_object('cron', '0 8 * * 1', 'timezone', 'UTC'))) THEN
      RAISE EXCEPTION 'a weekly schedule was refused';
    END IF;
    -- "*/5" is the pipeline grammar, not Automate's: the minutes field must be
    -- "a number between 0 and 59, with no special characters".
    IF public.automation_condition_valid(
         jsonb_build_object('type', 'objects_added', 'object_set_id', gen_random_uuid(),
           'schedule', jsonb_build_object('cron', '*/5 * * * *'))) THEN
      RAISE EXCEPTION 'a sub-hourly cron was accepted; Automate caps at once per hour';
    END IF;

    -- (2) the default is daily, and it is daily at midnight
    IF public.automation_schedule_cron(
         jsonb_build_object('type', 'run_on_all', 'object_set_id', gen_random_uuid()))
       <> '0 0 * * *' THEN
      RAISE EXCEPTION 'the documented daily default is not what the runner reads';
    END IF;

    -- (3) due at midnight, not due at 09:00 — the contrast the guard turns on
    v_ok := public.automation_due(
      jsonb_build_object('type', 'objects_added', 'object_set_id', gen_random_uuid()),
      timestamptz '2026-08-21 00:00+00');
    IF NOT v_ok THEN RAISE EXCEPTION 'a daily condition was not due at midnight'; END IF;
    v_ok := public.automation_due(
      jsonb_build_object('type', 'objects_added', 'object_set_id', gen_random_uuid()),
      timestamptz '2026-08-21 09:00+00');
    IF v_ok THEN RAISE EXCEPTION 'a daily condition was due at 09:00 as well as midnight'; END IF;
    -- and a time condition is always due, because it matches its own cron
    IF NOT public.automation_due(
         jsonb_build_object('type', 'time', 'cron', '0 9 * * *'),
         timestamptz '2026-08-21 03:17+00') THEN
      RAISE EXCEPTION 'a time condition was gated by the object set cadence';
    END IF;

    -- (4) the snapshot, which is the half that makes this correct. Run the
    -- runner twice against one automation: off-cadence, then on.
    IF v_set IS NOT NULL THEN
      INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
      VALUES (v_proj, 'Probe 617', v_owner,
              jsonb_build_object('type', 'objects_added', 'object_set_id', v_set,
                'schedule', jsonb_build_object('cron', '0 8 * * *', 'timezone', 'UTC')),
              'project')
      RETURNING id INTO v_a;

      PERFORM public.run_automations(timestamptz '2026-08-21 03:17+00');
      SELECT condition_state INTO v_state_off FROM public.automations WHERE id = v_a;
      IF v_state_off IS NOT NULL THEN
        RAISE EXCEPTION 'the snapshot advanced on an off-cadence tick — a daily automation would see one minute of additions';
      END IF;

      PERFORM public.run_automations(timestamptz '2026-08-21 08:00+00');
      SELECT condition_state INTO v_state_on FROM public.automations WHERE id = v_a;
      IF v_state_on IS NULL THEN
        RAISE EXCEPTION 'the snapshot did not advance on a matching tick — the guard refuses everything';
      END IF;
      RAISE NOTICE 'snapshot held off-cadence and advanced on cadence';
    ELSE
      RAISE NOTICE 'no object set exists, so the snapshot contrast could not run here';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '617 proved: schedule optional, sub-hourly refused, daily default, due-by-contrast';
  END;
END $$;
