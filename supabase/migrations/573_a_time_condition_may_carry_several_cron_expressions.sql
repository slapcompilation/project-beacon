-- A time condition takes one cron expression. Foundry's now takes several.
--
-- ── WHAT THE PAGE SAYS ─────────────────────────────────────────────────────
-- `automate/condition-time`, in a section that did not exist when 517 was
-- built and arrived in the 2026-08-18 drift sweep:
--
--   "You can add multiple cron expressions to a single time condition to define
--    more complex scheduling patterns. When using advanced cron mode, select the
--    option to add additional cron expressions."
--
--   "Requirements for multiple cron schedules:
--      * Each cron expression must be non-overlapping with the others
--      * All expressions must individually meet the cron expression requirements
--        listed above"
--
-- with the worked example: `0 9 1,15 * *` at 9:00 AM on the first and fifteenth,
-- plus `0 10 * * 5` at 10:00 AM every Friday, where "Using different times
-- prevents the schedules from overlapping when the first or fifteenth falls on a
-- Friday."
--
-- ── THIS IS AUTOMATE'S CONDITION, NOT THE SCHEDULE'S TRIGGER ───────────────
-- The two grammars are separate and only one moved. `building-pipelines/
-- triggers-reference` still says "A time trigger is defined using a cron
-- expression and a time zone" — singular — so `schedules.trigger` is left
-- exactly as it is. Adding it to both because they look alike is how one page's
-- sentence becomes two features.
--
-- ── NON-OVERLAP IS NOT ENFORCED, AND THAT IS A DECISION ────────────────────
-- Two reasons, and the second is the one that settles it.
--
-- Foundry states non-overlap as a requirement on the author and never says the
-- platform refuses an overlapping pair; the rationale it gives is advice about
-- choosing times. A CHECK would be inventing enforcement.
--
-- And here it would refuse configurations that behave correctly. **We fire when
-- ANY expression matches**, evaluated once per tick, so two expressions that
-- both match the same minute produce exactly one firing. An overlap is a
-- non-event in this engine. Foundry presumably needs the rule because theirs
-- would fire twice; ours cannot.
--
-- (Enforcing it exactly is also intractable at the constraint level: two
-- expressions overlap only if some instant satisfies both, and the documented
-- dom/dow OR rule — "If both the Day of Month and Day of Week fields are not *,
-- the trigger will be satisfied if either matches" — makes field-wise
-- disjointness unsound. That is a reason not to fake it, not the reason not to
-- do it.)
--
-- ── THE TIMEZONE STAYS ON THE CONDITION ────────────────────────────────────
-- `condition-time-cron-configuration.png` pairs one cron field with one
-- timezone dropdown (New York (EDT) -04:00), which is our shape already. That
-- screenshot predates multiple expressions and **no image shows the multi-cron
-- control at all**, so whether each expression carries its own zone is
-- unattested. One zone per condition is what we have and what is drawn; a zone
-- per expression would be invented structure. Recorded as a question.

BEGIN;

CREATE OR REPLACE FUNCTION public.automation_condition_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE e jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  CASE p->>'type'
    WHEN 'time' THEN
      -- Exactly one of the two spellings, so there is never a question of
      -- which one the runner reads.
      IF (p ? 'cron') = (p ? 'crons') THEN RETURN false; END IF;

      IF p ? 'cron' THEN
        -- The five fields, and the two refusals, are cron_matches' business.
        RETURN (p->>'cron') IS NOT NULL AND btrim(p->>'cron') <> '';
      END IF;

      IF jsonb_typeof(p->'crons') <> 'array'
         OR jsonb_array_length(p->'crons') = 0 THEN
        RETURN false;
      END IF;
      FOR e IN SELECT * FROM jsonb_array_elements(p->'crons') LOOP
        IF jsonb_typeof(e) <> 'string' OR btrim(e #>> '{}') = '' THEN
          RETURN false;
        END IF;
      END LOOP;
      RETURN true;
    WHEN 'objects_added', 'objects_removed', 'run_on_all' THEN
      RETURN (p->>'object_set_id') IS NOT NULL;
    ELSE
      RETURN false;
  END CASE;
END $fn$;

COMMENT ON FUNCTION public.automation_condition_valid(jsonb) IS
  'The condition grammar. A time condition names either one `cron` or a non-empty `crons` array — never both — sharing one `timezone`. Non-overlap between expressions is Foundry''s requirement on the author, not refused here: firing is once per tick on ANY match, so an overlap changes nothing.';

CREATE OR REPLACE FUNCTION public.automation_fires(p_automation uuid, p_at timestamptz)
RETURNS text[] LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE a record; now_keys text[]; was_keys text[]; fired text[]; zone text; expr text;
BEGIN
  SELECT * INTO a FROM public.automations WHERE id = p_automation;
  IF a.id IS NULL OR a.paused THEN RETURN NULL; END IF;

  IF a.condition->>'type' = 'time' THEN
    zone := coalesce(a.condition->>'timezone', 'UTC');
    -- "You can add multiple cron expressions to a single time condition."
    -- Any of them satisfies it, and once — which is why overlap is harmless.
    FOR expr IN
      SELECT * FROM jsonb_array_elements_text(
        CASE WHEN a.condition ? 'crons' THEN a.condition->'crons'
             ELSE jsonb_build_array(a.condition->>'cron') END)
    LOOP
      IF public.cron_matches(expr, zone, p_at) THEN
        RETURN '{}';   -- fired, with no objects to name
      END IF;
    END LOOP;
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
END $fn$;

-- ── assertions, which fire the automation on each arm of a real pair ───────
DO $do$
DECLARE
  org uuid; sp uuid; proj uuid; usr uuid; auto uuid; overlapping uuid; single uuid; n int;
  -- The page's own example, kept verbatim so the test is the documentation.
  first_and_fifteenth text := '0 9 1,15 * *';
  every_friday        text := '0 10 * * 5';
BEGIN
  BEGIN
    -- 2026-01-01 is a Thursday; 2026-01-02 is a Friday; 2026-01-15 a Thursday.
    IF to_char(timestamptz '2026-01-02 10:00:00+00', 'Dy') <> 'Fri' THEN
      RAISE EXCEPTION 'the calendar moved, which would be news';
    END IF;

    INSERT INTO public.organizations (name) VALUES ('probe573') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe573') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe573', 'Probe573') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe573@beacon.test') RETURNING id INTO usr;

    -- ── the grammar ────────────────────────────────────────────────────────
    IF NOT public.automation_condition_valid(
         jsonb_build_object('type','time','cron',first_and_fifteenth,'timezone','UTC')) THEN
      RAISE EXCEPTION 'the single-cron shape stopped validating';
    END IF;
    IF NOT public.automation_condition_valid(
         jsonb_build_object('type','time','timezone','UTC',
           'crons', jsonb_build_array(first_and_fifteenth, every_friday))) THEN
      RAISE EXCEPTION 'a two-expression condition did not validate';
    END IF;
    -- Both, neither, empty, and a non-string member are each refused.
    IF public.automation_condition_valid(
         jsonb_build_object('type','time','cron',first_and_fifteenth,
           'crons', jsonb_build_array(every_friday))) THEN
      RAISE EXCEPTION 'a condition naming both cron and crons validated';
    END IF;
    IF public.automation_condition_valid(jsonb_build_object('type','time','timezone','UTC')) THEN
      RAISE EXCEPTION 'a time condition with no expression at all validated';
    END IF;
    IF public.automation_condition_valid(
         jsonb_build_object('type','time','crons', '[]'::jsonb)) THEN
      RAISE EXCEPTION 'an empty crons array validated';
    END IF;
    IF public.automation_condition_valid(
         jsonb_build_object('type','time','crons', jsonb_build_array(42))) THEN
      RAISE EXCEPTION 'a non-string cron expression validated';
    END IF;

    -- ── and the firing, which is the half 569 taught me not to skip ────────
    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
      VALUES (proj, 'probe573', usr,
              jsonb_build_object('type','time','timezone','UTC',
                'crons', jsonb_build_array(first_and_fifteenth, every_friday)))
      RETURNING id INTO auto;

    -- The first arm: 09:00 on the 15th, a Thursday, so only expression one.
    IF public.automation_fires(auto, timestamptz '2026-01-15 09:00:00+00') IS NULL THEN
      RAISE EXCEPTION 'the first expression did not fire the condition';
    END IF;
    -- The second arm: 10:00 on a Friday that is neither the 1st nor the 15th.
    IF public.automation_fires(auto, timestamptz '2026-01-09 10:00:00+00') IS NULL THEN
      RAISE EXCEPTION 'the second expression did not fire the condition';
    END IF;
    -- And an instant neither matches.
    IF public.automation_fires(auto, timestamptz '2026-01-09 11:00:00+00') IS NOT NULL THEN
      RAISE EXCEPTION 'the condition fired at an instant no expression names';
    END IF;

    -- The overlap the page warns about — the 1st falling on a Friday — reaches
    -- both expressions at their own times, and each fires once. 2026-05-01 is a
    -- Friday: 09:00 matches the first, 10:00 the second.
    IF to_char(timestamptz '2026-05-01 09:00:00+00', 'Dy') <> 'Fri' THEN
      RAISE EXCEPTION 'the worked example needs a Friday the first';
    END IF;
    IF public.automation_fires(auto, timestamptz '2026-05-01 09:00:00+00') IS NULL
       OR public.automation_fires(auto, timestamptz '2026-05-01 10:00:00+00') IS NULL THEN
      RAISE EXCEPTION 'the page''s worked example did not fire on both arms';
    END IF;

    -- A genuinely overlapping pair is accepted and fires ONCE, which is the
    -- whole argument for not refusing it. A second automation rather than an
    -- edit, because editing a condition takes ownership (517) and the probe
    -- holds no claims — a rule worth obeying rather than setting claims around.
    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
      VALUES (proj, 'probe573-overlap', usr,
              jsonb_build_object('type','time','timezone','UTC',
                'crons', jsonb_build_array('0 9 * * *', '0 9 1 * *')))
      RETURNING id INTO overlapping;
    IF public.automation_fires(overlapping, timestamptz '2026-01-01 09:00:00+00') <> '{}'::text[] THEN
      RAISE EXCEPTION 'two overlapping expressions did not fire exactly once';
    END IF;

    -- The old single-cron shape still fires, because existing rows carry it.
    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
      VALUES (proj, 'probe573-single', usr,
              jsonb_build_object('type','time','timezone','UTC','cron','0 9 * * *'))
      RETURNING id INTO single;
    IF public.automation_fires(single, timestamptz '2026-01-01 09:00:00+00') IS NULL THEN
      RAISE EXCEPTION 'the single-cron shape stopped firing';
    END IF;

    RAISE EXCEPTION 'probe573:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe573:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe573';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '573: a time condition may carry several cron expressions';
END $do$;

COMMIT;
