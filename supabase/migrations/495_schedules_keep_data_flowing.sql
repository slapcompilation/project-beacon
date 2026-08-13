-- The pipeline layer, slice B2: schedules.
--
-- "**Schedules** are used to run builds on a recurring basis to keep data
-- flowing through Foundry consistently. In a schedule, the **trigger**
-- defines the condition that must be satisfied for the associated build to
-- be run." (data-integration/schedules.md)
--
-- The trigger grammar is the documented one: five-field Unix cron time
-- triggers with a time zone, the four event types by their verbatim names,
-- and arbitrary AND/OR nesting (building-pipelines/triggers-reference.md).
-- Cron tokens L and # are recorded in the reading, refused here by name.
-- Scope: user mode ships — "the schedule runs as if the user were running
-- the build" — via 486's claims swap; project mode is stored and recorded,
-- waiting on a service execution identity.

-- ── the schedule ────────────────────────────────────────────────────────────
CREATE TABLE public.schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  target_dataset_ids uuid[] NOT NULL,
  build_type      text NOT NULL DEFAULT 'single' CHECK (build_type IN ('single', 'full')),
  trigger         jsonb NOT NULL,
  -- Observed events, sticky until the schedule runs: "An event trigger
  -- remains satisfied after the event has occurred until the entire trigger
  -- is satisfied and the schedule is run."
  trigger_state   jsonb NOT NULL DEFAULT '{}'::jsonb,
  paused          boolean NOT NULL DEFAULT false,
  -- "With user scoping, the schedule build will be triggered on behalf of
  -- the user who last edited (or created) the schedule."
  scope           text NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'project')),
  updated_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_run_at     timestamptz
);
COMMENT ON TABLE public.schedules IS
  'Runs builds on a recurring basis: a trigger (time, event, or AND/OR compound) over target datasets, observed events sticky until the run, pause forgetting everything observed.';
CREATE INDEX schedules_org_idx ON public.schedules (organization_id);
CREATE INDEX schedules_updated_by_idx ON public.schedules (updated_by);

-- "The run history provides a record of when a schedule was run" — with the
-- three verbatim outcomes. Ignored is precise: "The run was attempted, but a
-- build was not created."
CREATE TABLE public.schedule_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  -- clock_timestamp, not now(): consecutive runs inside one transaction
  -- (the assertions, and any future batched caller) must still order.
  ran_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  outcome     text NOT NULL CHECK (outcome IN ('Succeeded', 'Ignored', 'Failed')),
  build_id    uuid REFERENCES public.builds(id) ON DELETE SET NULL,
  error       text
);
CREATE INDEX schedule_runs_schedule_idx ON public.schedule_runs (schedule_id);
CREATE INDEX schedule_runs_build_idx ON public.schedule_runs (build_id);

-- ── the cron matcher ────────────────────────────────────────────────────────
-- Five-field Unix cron against wall-clock time in the given zone. The four
-- core tokens (* - / ,); L and # refuse by name until built. The one odd
-- documented rule: "If both the Day of Month and Day of Week fields are not
-- *, the trigger will be satisfied if either matches."
CREATE OR REPLACE FUNCTION public.cron_field_matches(p_field text, p_value int, p_min int, p_max int)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE tok text; base text; step int; lo int; hi int;
BEGIN
  IF p_field ~ '[L#]' THEN
    RAISE EXCEPTION 'Builds:CronTokenNotBuilt — L and # are recorded in the reading, not built';
  END IF;
  FOREACH tok IN ARRAY string_to_array(p_field, ',') LOOP
    IF tok ~ '/' THEN
      base := split_part(tok, '/', 1);
      step := split_part(tok, '/', 2)::int;
    ELSE
      base := tok; step := NULL;
    END IF;
    IF base = '*' THEN lo := p_min; hi := p_max;
    ELSIF base ~ '^\d+-\d+$' THEN
      lo := split_part(base, '-', 1)::int; hi := split_part(base, '-', 2)::int;
    ELSIF base ~ '^\d+$' THEN
      lo := base::int;
      -- "When used with a value, the range is from the specified value to
      -- the maximum value for that field"
      hi := CASE WHEN step IS NULL THEN base::int ELSE p_max END;
    ELSE
      RAISE EXCEPTION 'Builds:CronDoesNotParse — % is not a field this matcher reads', tok;
    END IF;
    IF p_value BETWEEN lo AND hi
       AND (step IS NULL OR (p_value - lo) % step = 0) THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.cron_matches(p_cron text, p_tz text, p_at timestamptz)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  f text[]; lt timestamp; dow int;
  m boolean; h boolean; dom boolean; mon boolean; wd boolean;
BEGIN
  f := regexp_split_to_array(btrim(p_cron), '\s+');
  IF array_length(f, 1) <> 5 THEN
    RAISE EXCEPTION 'Builds:CronDoesNotParse — a time trigger is five fields (minute hour day-of-month month day-of-week)';
  END IF;
  lt := p_at AT TIME ZONE p_tz;
  dow := extract(dow FROM lt)::int; -- 0=Sunday; "7 is also Sunday" handled below
  m   := public.cron_field_matches(f[1], extract(minute FROM lt)::int, 0, 59);
  h   := public.cron_field_matches(f[2], extract(hour FROM lt)::int, 0, 23);
  dom := public.cron_field_matches(f[3], extract(day FROM lt)::int, 1, 31);
  mon := public.cron_field_matches(f[4], extract(month FROM lt)::int, 1, 12);
  wd  := public.cron_field_matches(replace(f[5], '7', '0'), dow, 0, 6);
  IF f[3] <> '*' AND f[5] <> '*' THEN
    RETURN m AND h AND mon AND (dom OR wd);
  END IF;
  RETURN m AND h AND mon AND dom AND wd;
END $$;

-- ── the trigger grammar ─────────────────────────────────────────────────────
-- time:  {"type":"time","cron":"m h dom mon dow","timezone":"Europe/Athens"}
-- event: {"type":"event","event":"data_updated"|"new_logic"|"job_succeeded"|
--         "schedule_ran","dataset_id"|"schedule_id":…}
-- and/or: {"type":"and"|"or","triggers":[…]} — "arbitrary nesting".
-- Key names are ours; no page prints the JSON.
CREATE OR REPLACE FUNCTION public.schedule_trigger_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  CASE p->>'type'
    WHEN 'time' THEN
      RETURN p ? 'cron' AND p ? 'timezone';
    WHEN 'event' THEN
      RETURN (p->>'event' IN ('data_updated', 'new_logic', 'job_succeeded')
              AND p ? 'dataset_id')
          OR (p->>'event' = 'schedule_ran' AND p ? 'schedule_id');
    WHEN 'and', 'or' THEN
      IF jsonb_typeof(p->'triggers') <> 'array' OR jsonb_array_length(p->'triggers') = 0 THEN
        RETURN false;
      END IF;
      FOR t IN SELECT * FROM jsonb_array_elements(p->'triggers') LOOP
        IF NOT public.schedule_trigger_valid(t) THEN RETURN false; END IF;
      END LOOP;
      RETURN true;
    ELSE
      RETURN false;
  END CASE;
END $$;

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_trigger_valid CHECK (public.schedule_trigger_valid(trigger));

-- Creating a schedule takes the ability to build its targets.
CREATE OR REPLACE FUNCTION public.guard_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ds uuid;
BEGIN
  IF NEW.paused AND NOT COALESCE(OLD.paused, false) THEN
    -- "When a schedule is paused, its trigger state is reset and all
    -- observed events are forgotten."
    NEW.trigger_state := '{}'::jsonb;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    FOREACH ds IN ARRAY NEW.target_dataset_ids LOOP
      IF NOT public.can_write_dataset(ds) THEN
        RAISE EXCEPTION 'Builds:NotAuthorized — scheduling a build of % takes the editor role on its project', ds;
      END IF;
    END LOOP;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_schedule BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.guard_schedule();

-- ── evaluation ──────────────────────────────────────────────────────────────
-- Observe events into the sticky state, then ask if the trigger is
-- satisfied. Watermarks live in trigger_state under the event's own key.
CREATE OR REPLACE FUNCTION public.schedule_observe(p_trigger jsonb, p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t jsonb; key text; mark text; seen text;
BEGIN
  CASE p_trigger->>'type'
    WHEN 'event' THEN
      key := md5(p_trigger::text);
      IF (p_state->key->>'satisfied')::boolean IS TRUE THEN RETURN p_state; END IF;
      CASE p_trigger->>'event'
        WHEN 'data_updated' THEN
          -- "Occurs when a transaction is committed that updates a dataset."
          SELECT max(tx.committed_at)::text INTO mark
            FROM public.dataset_transactions tx
            JOIN public.dataset_branches b ON b.id = tx.branch_id AND b.name = 'master'
           WHERE tx.dataset_id = (p_trigger->>'dataset_id')::uuid AND tx.status = 'COMMITTED';
        WHEN 'new_logic' THEN
          -- "Occurs when the logic to compute a dataset is updated."
          SELECT js.version::text INTO mark FROM public.job_specs js
           WHERE js.output_dataset_id = (p_trigger->>'dataset_id')::uuid;
        WHEN 'job_succeeded' THEN
          SELECT max(bj.finished_at)::text INTO mark FROM public.build_jobs bj
           WHERE bj.output_dataset_id = (p_trigger->>'dataset_id')::uuid AND bj.state = 'COMPLETED';
        WHEN 'schedule_ran' THEN
          SELECT max(sr.ran_at)::text INTO mark FROM public.schedule_runs sr
           WHERE sr.schedule_id = (p_trigger->>'schedule_id')::uuid AND sr.outcome = 'Succeeded';
      END CASE;
      seen := p_state->key->>'watermark';
      IF seen IS NULL THEN
        -- First observation sets the baseline; the event fires on change.
        RETURN jsonb_set(p_state, ARRAY[key],
          jsonb_build_object('watermark', COALESCE(mark, ''), 'satisfied', false), true);
      ELSIF COALESCE(mark, '') IS DISTINCT FROM seen THEN
        RETURN jsonb_set(p_state, ARRAY[key],
          jsonb_build_object('watermark', COALESCE(mark, ''), 'satisfied', true), true);
      END IF;
      RETURN p_state;
    WHEN 'and', 'or' THEN
      FOR t IN SELECT * FROM jsonb_array_elements(p_trigger->'triggers') LOOP
        p_state := public.schedule_observe(t, p_state);
      END LOOP;
      RETURN p_state;
    ELSE
      RETURN p_state;
  END CASE;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_satisfied(p_trigger jsonb, p_state jsonb, p_at timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t jsonb; acc boolean;
BEGIN
  CASE p_trigger->>'type'
    WHEN 'time' THEN
      -- "A time trigger is only satisfied at the specified instants."
      RETURN public.cron_matches(p_trigger->>'cron', p_trigger->>'timezone', p_at);
    WHEN 'event' THEN
      RETURN COALESCE((p_state->md5(p_trigger::text)->>'satisfied')::boolean, false);
    WHEN 'and' THEN
      FOR t IN SELECT * FROM jsonb_array_elements(p_trigger->'triggers') LOOP
        IF NOT public.schedule_satisfied(t, p_state, p_at) THEN RETURN false; END IF;
      END LOOP;
      RETURN true;
    WHEN 'or' THEN
      FOR t IN SELECT * FROM jsonb_array_elements(p_trigger->'triggers') LOOP
        IF public.schedule_satisfied(t, p_state, p_at) THEN RETURN true; END IF;
      END LOOP;
      RETURN false;
  END CASE;
END $$;

-- The heartbeat: evaluate every unpaused schedule, run the due ones as the
-- user who last edited them (the claims swap 486 established), record the
-- three documented outcomes, reset observed events on a run.
CREATE OR REPLACE FUNCTION public.run_schedules(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s record; u record; state jsonb; before text; built uuid; ran int := 0;
BEGIN
  -- "If a schedule is triggered while the previous run is still in action,
  -- then it will remain triggered and run only after the previous schedule
  -- is finished" — one heartbeat at a time; a held lock leaves the sticky
  -- state in place for the next tick.
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
    CONTINUE WHEN u IS NULL; -- "If the user is deactivated … the schedule build will fail to start."

    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      built := public.run_build(s.target_dataset_ids, false, s.build_type);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, build_id)
      VALUES (s.id, CASE WHEN built IS NULL THEN 'Ignored' ELSE 'Succeeded' END, built);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, error)
      VALUES (s.id, 'Failed', sqlerrm);
    END;

    -- Observed events are consumed by the run.
    UPDATE public.schedules SET trigger_state = '{}'::jsonb, last_run_at = p_at WHERE id = s.id;
    ran := ran + 1;
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_schedules(timestamptz) FROM PUBLIC, anon, authenticated;

-- The minute hand. pg_cron only carries the heartbeat; every documented
-- trigger semantics lives in run_schedules where it is testable.
SELECT cron.schedule('beacon-run-schedules', '* * * * *', 'SELECT public.run_schedules()');

-- ── visibility ──────────────────────────────────────────────────────────────
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members see schedules" ON public.schedules FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "builders manage schedules" ON public.schedules FOR ALL
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()))
  WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "org members see runs" ON public.schedule_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.schedules s
                  WHERE s.id = schedule_id
                    AND NOT (s.organization_id IS DISTINCT FROM public.auth_org_id())));

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid; raw uuid; braw uuid; clean uuid;
  txn uuid; fid uuid; ptbl text; u1 uuid := gen_random_uuid(); before text;
  sched uuid; n int; r record; st jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  -- 0. The matcher, against the page's own examples.
  IF NOT public.cron_matches('30 9 * * 1', 'UTC', '2026-08-10 09:30+00') THEN
    RAISE EXCEPTION 'cron: 9:30am on Monday should match a Monday 09:30';
  END IF;
  IF public.cron_matches('30 9 * * 1', 'UTC', '2026-08-11 09:30+00') THEN
    RAISE EXCEPTION 'cron: 9:30am on Monday must not match a Tuesday';
  END IF;
  IF NOT public.cron_matches('0 9-17/2 10 * *', 'UTC', '2026-08-10 11:00+00') THEN
    RAISE EXCEPTION 'cron: every two hours from 9 should include 11:00 on the 10th';
  END IF;
  IF public.cron_matches('0 9-17/2 10 * *', 'UTC', '2026-08-10 10:00+00') THEN
    RAISE EXCEPTION 'cron: every two hours from 9 must not include 10:00';
  END IF;
  IF NOT public.cron_matches('25/10 * * * *', 'UTC', '2026-08-10 03:45+00') THEN
    RAISE EXCEPTION 'cron: 25/10 should include minute 45';
  END IF;
  -- "the trigger will be satisfied if either matches" (dom OR dow rule):
  -- the 20th of the month and Thursday — 2026-08-20 is a Thursday, and
  -- 2026-08-13 is also a Thursday but not the 20th.
  IF NOT public.cron_matches('0 9 20 * 4', 'UTC', '2026-08-13 09:00+00') THEN
    RAISE EXCEPTION 'cron: dom/dow are OR when both set — a Thursday matches';
  END IF;
  BEGIN
    PERFORM public.cron_matches('0 9 L * *', 'UTC', now());
    RAISE EXCEPTION 'the L token parsed';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Builds:CronTokenNotBuilt%' THEN RAISE; END IF;
  END;

  -- Fixture: raw → clean with a JobSpec, one committed build so it is fresh.
  INSERT INTO public.organizations (name) VALUES ('sched-495') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's495@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 's495@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  sp := public.create_space('S495');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 's495', 'S495') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 's495_raw', 'raw') RETURNING id INTO raw;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (raw, 'master') RETURNING id INTO braw;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (raw, braw, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (raw, txn, '[{"name":"city","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (raw, txn, 'r.parquet', 1) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(raw, txn);
  EXECUTE format('INSERT INTO datasets.%I (_file, city) VALUES ($1, ''ATH'')', ptbl) USING fid;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 's495_clean', 'clean') RETURNING id INTO clean;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (clean, 'master');
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean, raw);
  INSERT INTO public.job_specs (output_dataset_id, logic_sql)
  VALUES (clean, 'SELECT city FROM s495_raw');
  PERFORM public.run_build(ARRAY[clean], false, 'single');

  -- 1. An event schedule observes, stays unsatisfied at baseline, fires on
  --    a new commit, and stays sticky until the run consumes it.
  INSERT INTO public.schedules (name, target_dataset_ids, trigger)
  VALUES ('when raw updates', ARRAY[clean], jsonb_build_object(
    'type', 'event', 'event', 'data_updated', 'dataset_id', raw::text))
  RETURNING id INTO sched;
  RESET ROLE;

  PERFORM public.run_schedules('2026-08-13 10:00+00');
  SELECT count(*) INTO n FROM public.schedule_runs WHERE schedule_id = sched;
  IF n <> 0 THEN RAISE EXCEPTION 'the baseline observation must not fire the trigger'; END IF;

  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
  SELECT raw, braw, 'APPEND', b.head_transaction_id FROM public.dataset_branches b WHERE b.id = braw
  RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  PERFORM public.run_schedules('2026-08-13 10:01+00');
  SELECT * INTO r FROM public.schedule_runs WHERE schedule_id = sched ORDER BY ran_at DESC LIMIT 1;
  IF r IS NULL OR r.outcome <> 'Succeeded' THEN
    RAISE EXCEPTION 'a committed transaction should fire the event and build, got %', coalesce(r.outcome, 'nothing');
  END IF;

  -- 2. The next tick: event consumed, output fresh — no run at all.
  PERFORM public.run_schedules('2026-08-13 10:02+00');
  SELECT count(*) INTO n FROM public.schedule_runs WHERE schedule_id = sched;
  IF n <> 1 THEN RAISE EXCEPTION 'a consumed event must not fire again, % runs exist', n; END IF;

  -- 3. A time trigger fires on its instant and records Ignored when
  --    everything is fresh: "a build was not created".
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.schedules SET trigger = '{"type":"time","cron":"30 9 * * *","timezone":"UTC"}'
   WHERE id = sched;
  RESET ROLE;
  PERFORM public.run_schedules('2026-08-13 09:29+00');
  PERFORM public.run_schedules('2026-08-13 09:30+00');
  SELECT * INTO r FROM public.schedule_runs WHERE schedule_id = sched ORDER BY ran_at DESC LIMIT 1;
  IF r.outcome <> 'Ignored' THEN
    RAISE EXCEPTION 'a fresh target at the instant records Ignored, got %', r.outcome;
  END IF;
  SELECT count(*) INTO n FROM public.schedule_runs WHERE schedule_id = sched;
  IF n <> 2 THEN RAISE EXCEPTION '09:29 must not fire a 09:30 trigger'; END IF;

  -- 4. Pause resets the observed state.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.schedules
     SET trigger = jsonb_build_object('type', 'event', 'event', 'data_updated', 'dataset_id', raw::text)
   WHERE id = sched;
  RESET ROLE;
  PERFORM public.run_schedules('2026-08-13 11:00+00'); -- baseline
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
  SELECT raw, braw, 'APPEND', b.head_transaction_id FROM public.dataset_branches b WHERE b.id = braw
  RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  PERFORM public.run_schedules('2026-08-13 11:01+00'); -- observes + runs
  SELECT trigger_state INTO st FROM public.schedules WHERE id = sched;
  IF st <> '{}'::jsonb THEN RAISE EXCEPTION 'a run consumes the observed events'; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.schedules SET paused = true WHERE id = sched;
  SELECT trigger_state INTO st FROM public.schedules WHERE id = sched;
  IF st <> '{}'::jsonb THEN RAISE EXCEPTION 'pausing forgets all observed events'; END IF;
  RESET ROLE;
  PERFORM public.run_schedules('2026-08-13 11:02+00');
  SELECT count(*) INTO n FROM public.schedule_runs WHERE schedule_id = sched;
  IF n <> 3 THEN RAISE EXCEPTION 'a paused schedule cannot be triggered'; END IF;

  -- 5. The grammar refuses shapes it does not speak.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.schedules (name, target_dataset_ids, trigger)
    VALUES ('bad', ARRAY[clean], '{"type":"whenever"}'::jsonb);
    RAISE EXCEPTION 'an unknown trigger type validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%schedules_trigger_valid%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '495: schedules keep data flowing, and a paused one forgets what it saw';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
