-- Automate's time condition is stricter than a pipeline schedule's, and the
-- two pages say so in opposite directions. This is the two-vocabularies trap
-- with one syntax instead of two.
--
--   "A minimum frequency of once per hour"
--   "The minutes field must be a number between 0 and 59, with no special
--   characters"
--   — automate/condition-time.md
--
-- Those are one rule seen twice: a single minute value can match at most once
-- an hour. Enforcing the minute field IS enforcing the floor.
--
-- AND THE PIPELINE PAGE ALLOWS EXACTLY WHAT THIS FORBIDS. Its own table of
-- minute-field examples includes "Every minute" for `*`, "Every tenth minute
-- beginning from 25" for `25/10`, and `10,20-30`. So `cron_field_matches` must
-- NOT change: it is shared, and tightening it would refuse schedules that
-- building-pipelines documents as legal.
--
-- The rule therefore lands on automation_condition_valid(), which is Automate's
-- own validator and already backs a CHECK — a fact about one row, so the
-- ladder's first rung holds it. This is the scoping 573 established when it
-- added multiple crons — that one is Automate's time condition and
-- schedules.trigger stays untouched, with a test asserting a `crons` array is
-- still refused there.
--
-- WHAT STAYS LEGAL: every other field keeps the specials both pages allow. The
-- hour field may be `*`, `8,20`, `9-17`, `*/2`; only the minute is pinned.
--
-- NOT ENFORCED, and 573 already reasoned it: the pages ask for non-overlapping
-- expressions and never say the platform refuses an overlapping pair. Firing is
-- once per tick on any match, so an overlap is a non-event here.
--
-- A CONSEQUENCE FOR PROBES, said plainly because the next migration will hit
-- it: `* * * * *` is no longer a valid Automate condition, so a probe that
-- needs a firing uses `0 * * * *` and passes date_trunc('hour', now()) to
-- run_automations, which takes the instant as an argument for exactly this.

CREATE OR REPLACE FUNCTION public.automation_condition_valid(p jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
      RETURN (p->>'object_set_id') IS NOT NULL;
    ELSE
      RETURN false;
  END CASE;
END $function$;

-- Five fields, and a minute that is a plain number. Separate from
-- cron_field_matches on purpose: that one is shared with pipeline schedules,
-- where the same syntax is documented with looser rules.
CREATE OR REPLACE FUNCTION public.automate_cron_valid(p_cron text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_cron IS NOT NULL
     AND btrim(p_cron) <> ''
     AND array_length(regexp_split_to_array(btrim(p_cron), '\s+'), 1) = 5
     AND (regexp_split_to_array(btrim(p_cron), '\s+'))[1] ~ '^\d{1,2}$'
     AND (regexp_split_to_array(btrim(p_cron), '\s+'))[1]::int BETWEEN 0 AND 59
$$;

COMMENT ON FUNCTION public.automate_cron_valid(text) IS
  'Automate''s cron rule, not the pipeline scheduler''s: five fields and a minute that is a plain 0-59, which is how "a minimum frequency of once per hour" is enforced (automate/condition-time).';

-- The rule refuses what the page forbids, accepts what it allows, and — the
-- half that matters — leaves the PIPELINE scheduler alone, where the same
-- expressions are documented as legal.
DO $$
DECLARE
  v_proj uuid; v_owner uuid; v_a uuid;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project or user: 613 cannot prove its own rule';
    END IF;

    -- (1) the minute field's specials are refused, one form at a time
    IF public.automate_cron_valid('* * * * *') THEN
      RAISE EXCEPTION 'a per-minute cron was accepted as an Automate condition';
    END IF;
    IF public.automate_cron_valid('*/5 * * * *') THEN
      RAISE EXCEPTION 'a five-minute step was accepted; the hourly floor is not enforced';
    END IF;
    IF public.automate_cron_valid('0,30 * * * *') THEN
      RAISE EXCEPTION 'a minute list was accepted; the page says no special characters';
    END IF;
    IF public.automate_cron_valid('10-20 * * * *') THEN
      RAISE EXCEPTION 'a minute range was accepted; the page says no special characters';
    END IF;

    -- (2) the page's own examples still pass, including the specials it allows
    --     in every OTHER field
    IF NOT public.automate_cron_valid('0 * * * *') THEN
      RAISE EXCEPTION 'the page example "every hour on the hour" was refused';
    END IF;
    IF NOT public.automate_cron_valid('15 8,20 * * *') THEN
      RAISE EXCEPTION 'the page example with an hour list was refused';
    END IF;
    IF NOT public.automate_cron_valid('15 8,14 * * 1-5') THEN
      RAISE EXCEPTION 'the page example with a weekday range was refused';
    END IF;

    -- (3) the CHECK actually bites on a real row, by refusing the insert
    BEGIN
      INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
      VALUES (v_proj, 'Probe 613', v_owner,
              '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, 'project');
      RAISE EXCEPTION 'a per-minute automation was created';
    EXCEPTION WHEN check_violation THEN
      NULL;  -- the CHECK on automations.condition
    END;

    -- and the hourly form lands
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 613', v_owner,
            '{"type":"time","cron":"0 * * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    -- (4) THE PIPELINE SCHEDULER IS UNTOUCHED: the same expression Automate
    --     just refused is still a legal schedule trigger, because
    --     building-pipelines documents it as one.
    IF NOT public.schedule_trigger_valid(
         '{"type":"time","cron":"*/5 * * * *","timezone":"UTC"}'::jsonb) THEN
      RAISE EXCEPTION 'the Automate rule leaked into schedules, which document */5 as legal';
    END IF;
    IF NOT public.cron_matches('*/5 * * * *', 'UTC',
         timestamptz '2026-01-01 00:05:00+00') THEN
      RAISE EXCEPTION 'cron_field_matches was tightened; the shared matcher must not change';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'minute specials refused, the page examples accepted, the CHECK bit on a real row, and the pipeline scheduler still takes */5';
  END;
END $$;
