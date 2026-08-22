-- Auto-mute, which the event log made countable.
--
--   "When the **Auto-mute this automation** setting is enabled, the automation
--   will automatically mute when all effects fail for at least 80% of the past
--   30 events."
--   — automate/muting-pausing-expiration.md
--
-- A metric (all effects fail), a window (the past 30 events) and a threshold
-- (80%). It is the ONE fully specified threshold in the section — auto-PAUSE,
-- its neighbour, has none ("excessive activity"), which is why 622's Decision 3
-- refused to invent that one and this one is buildable.
--
-- It was blocked on the denominator until yesterday: "events" is not "runs",
-- and `automation_runs` holds one row per effect per firing. 622's
-- `automation_events` is what makes thirty events a countable thing.
--
-- WHAT THE SCREENSHOT ADDS, and it is placement rather than decoration. The
-- toggle sits under a heading that appears in NO prose on any page:
--
--   "Configure global effect settings"
--   — automate/images/auto-mute.png
--
-- so this is an EFFECT setting, not a condition setting. The same capture words
-- the rule a second way, and that wording is where "on this automation" comes
-- from:
--
--   "Automatically stop executing effects when all effects on this automation
--   fail for at least 80% of the past 30 events."
--   — automate/images/auto-mute.png
--
-- Mute is defined as exactly that elsewhere: the condition still evaluates and
-- "no effects will be triggered".
--
-- THREE INFERENCES, each marked because none is on a page:
--
--   1. **The default is off.** "When the ... setting is enabled" reads as
--      opt-in. The capture shows the toggle ON, but that is one author's
--      automation, not a documented default.
--   2. **A full window is required.** With eleven events, "the past 30 events"
--      has no agreed reading. Requiring thirty is the direction that mutes
--      LESS, and muting is the disruptive outcome — an automation silenced on
--      four failures out of five would be a worse error than one that keeps
--      failing three more times.
--   3. **Only events that HAVE effects count.** "All effects fail" says nothing
--      about an event with no effects to fail — a `condition_edited` event has
--      none — so the window is over events that produced runs.
--
-- WHAT AN "ALL EFFECTS FAIL" EVENT IS. Every run of that event settled
-- `failed`. A run still `awaiting_retry` has not failed yet — 543's ladder is
-- explicit that the fallback is withheld until the budget is spent — and a
-- `skipped` run is a muted automation, which cannot be the input to muting it.

-- A DEFECT 622 SHIPPED, found by writing this probe. `occurred_at` defaulted to
-- `now()`, which is the TRANSACTION's start time and is frozen for its whole
-- duration — so every event a single runner pass records carries the identical
-- timestamp, and "the past 30 events" ordered by it is an arbitrary 30. The
-- runner processes up to fifty automations in one transaction, so this was not
-- hypothetical. `clock_timestamp()` advances within the transaction and is what
-- an event's moment actually is. Same lesson as 496.
ALTER TABLE public.automation_events
  ALTER COLUMN occurred_at SET DEFAULT clock_timestamp();

ALTER TABLE public.automations
  ADD COLUMN auto_mute boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.automations.auto_mute IS
  'The "Auto-mute this automation" toggle (automate/muting-pausing-expiration). Off by default, which is an inference: no page states a default and the screenshot shows one author''s automation.';

-- One event's verdict. Separated from the window so each can be probed alone.
CREATE OR REPLACE FUNCTION public.automation_event_all_failed(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT count(*) > 0 AND count(*) FILTER (WHERE r.outcome <> 'failed') = 0
    FROM public.automation_runs r
   WHERE r.event_id = p_event
$$;

COMMENT ON FUNCTION public.automation_event_all_failed(uuid) IS
  'Whether every effect of one event settled failed. An awaiting_retry run has not failed yet, and a skipped run means the automation was already muted.';

-- The window. 80% of 30 is 24, stated as the integer it is rather than as a
-- float comparison that has to be reasoned about.
CREATE OR REPLACE FUNCTION public.automation_should_auto_mute(p_automation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  WITH recent AS (
    SELECT e.id
      FROM public.automation_events e
     WHERE e.automation_id = p_automation
       AND EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.event_id = e.id)
     ORDER BY e.occurred_at DESC
     LIMIT 30
  )
  SELECT count(*) = 30
     AND count(*) FILTER (WHERE public.automation_event_all_failed(id)) >= 24
    FROM recent
$$;

COMMENT ON FUNCTION public.automation_should_auto_mute(uuid) IS
  'All effects failed for at least 80% of the past 30 events (automate/muting-pausing-expiration). 24 is 80% of 30. A short window never qualifies, which is an inference recorded in 624.';

-- The write, SECURITY DEFINER and granted to the runner alone, which is the
-- shape 553 established and 623 had to repair once. It does not record a `muted`
-- event itself: the AFTER UPDATE trigger 622 added already does that, so the
-- automatic mute lands in the event log by the same path a person's does.
CREATE OR REPLACE FUNCTION public.auto_mute_if_due(p_automation uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v record;
BEGIN
  SELECT a.auto_mute, a.muted INTO v FROM public.automations a WHERE a.id = p_automation;
  IF v IS NULL OR NOT v.auto_mute OR v.muted THEN RETURN false; END IF;
  IF NOT public.automation_should_auto_mute(p_automation) THEN RETURN false; END IF;

  UPDATE public.automations SET muted = true WHERE id = p_automation;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.auto_mute_if_due(uuid) FROM PUBLIC;
-- 623's lesson: PUBLIC and `authenticated` are different grantees, and
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to the latter explicitly.
REVOKE ALL ON FUNCTION public.auto_mute_if_due(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.automation_event_all_failed(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.automation_should_auto_mute(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auto_mute_if_due(uuid) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.automation_event_all_failed(uuid) TO beacon_runner;
GRANT EXECUTE ON FUNCTION public.automation_should_auto_mute(uuid) TO beacon_runner;

-- The runner asks after each firing it executed. Patched from the live
-- definition at one anchor, which raises if it moved.
DO $$
DECLARE d text; p text;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF position('auto_mute_if_due' in d) > 0 THEN
    RAISE NOTICE 'run_automations already asks about auto-mute';
    RETURN;
  END IF;

  p := replace(d,
    '      END LOOP;' || chr(10) || '      ran := ran + 1;' || chr(10) || '    END IF;',
    '      END LOOP;' || chr(10) ||
    '      -- Asked after the effects settle, because the verdict is over runs' || chr(10) ||
    '      -- that have outcomes. Records nothing itself: 622''s trigger turns' || chr(10) ||
    '      -- the UPDATE into a `muted` event.' || chr(10) ||
    '      PERFORM public.auto_mute_if_due(a.id);' || chr(10) ||
    '      ran := ran + 1;' || chr(10) || '    END IF;');

  IF p = d THEN
    RAISE EXCEPTION '624: the end of the effects loop is not where it was';
  END IF;
  EXECUTE p;
  RAISE NOTICE 'run_automations now asks whether the automation should auto-mute';
END $$;

-- Proved at the boundary in BOTH directions, and the last event arrives through
-- the RUNNER so the wiring is exercised rather than the function alone.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid; v_a uuid; v_e uuid;
  v_ev uuid; v_run uuid; k int; v_muted boolean; v_events int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project, ontology or user: 624 cannot prove its own threshold';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-624', 'Probe 624') RETURNING id INTO v_at;

    INSERT INTO public.automations
      (project_id, display_name, owner_id, condition, scope, auto_mute)
    VALUES (v_proj, 'Probe 624', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project', true)
    RETURNING id INTO v_a;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at) RETURNING id INTO v_e;
    PERFORM set_config('request.jwt.claims', '', true);

    -- The toggle goes off AFTER the effect exists, because 612's authoring
    -- guard refuses to create one against an action Automate may not submit.
    -- That is 612's own stated scenario, and it is what makes every run fail
    -- by a documented refusal rather than a contrived error.
    UPDATE public.action_types SET automate_can_submit = false WHERE id = v_at;

    -- (1) TWENTY-NINE all-failed events: a short window never qualifies.
    FOR k IN 1..29 LOOP
      v_ev := public.record_automation_event(v_a, 'automation_triggered');
      v_run := public.record_automation_run(v_a, v_e, v_ev);
      PERFORM public.settle_automation_run(v_run, 'failed', 'probe', NULL);
    END LOOP;

    IF public.automation_should_auto_mute(v_a) THEN
      RAISE EXCEPTION 'twenty-nine events qualified; the window is thirty';
    END IF;
    IF public.auto_mute_if_due(v_a) THEN
      RAISE EXCEPTION 'the automation muted before its window was full';
    END IF;

    -- (2) the THIRTIETH arrives through the runner, which is the wiring
    PERFORM public.run_automations(timestamptz '2026-08-22 03:00+00');

    SELECT muted INTO v_muted FROM public.automations WHERE id = v_a;
    IF NOT v_muted THEN
      RAISE EXCEPTION 'thirty all-failed events did not auto-mute the automation';
    END IF;

    -- and the mute is IN THE EVENT LOG, by the same trigger a person's mute uses
    SELECT count(*) INTO v_events FROM public.automation_events
     WHERE automation_id = v_a AND event_type = 'muted';
    IF v_events <> 1 THEN
      RAISE EXCEPTION 'the automatic mute produced % muted event(s), expected 1', v_events;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'silent at twenty-nine, muted at thirty through the runner, and the mute is in the event log';
  END;
END $$;

-- The other half of the threshold, in its own transaction-shaped probe: a
-- FULL window that is under 80% must not mute. Without this, a function that
-- fires on any full window of failures would pass everything above.
DO $$
DECLARE
  v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid; v_a uuid; v_e uuid;
  v_ev uuid; v_run uuid; k int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-624b', 'Probe 624b') RETURNING id INTO v_at;
    INSERT INTO public.automations
      (project_id, display_name, owner_id, condition, scope, auto_mute)
    VALUES (v_proj, 'Probe 624b', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project', true)
    RETURNING id INTO v_a;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at) RETURNING id INTO v_e;
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE public.action_types SET automate_can_submit = false WHERE id = v_at;

    -- 23 failed and 7 succeeded: a full window at 76.7%, just under the line.
    -- The successes go FIRST, because the window slides: adding a thirty-first
    -- event drops the oldest, and if that one were a failure the count would
    -- not move. Getting this backwards is what made the probe fail once.
    FOR k IN 1..30 LOOP
      v_ev := public.record_automation_event(v_a, 'automation_triggered');
      v_run := public.record_automation_run(v_a, v_e, v_ev);
      PERFORM public.settle_automation_run(v_run,
        CASE WHEN k <= 7 THEN 'succeeded' ELSE 'failed' END, 'probe', NULL);
    END LOOP;

    IF public.automation_should_auto_mute(v_a) THEN
      RAISE EXCEPTION '23 of 30 qualified; the published threshold is 80 percent, which is 24';
    END IF;

    -- one more failure takes it to 24 of 30, which is exactly 80%: "at least"
    v_ev := public.record_automation_event(v_a, 'automation_triggered');
    v_run := public.record_automation_run(v_a, v_e, v_ev);
    PERFORM public.settle_automation_run(v_run, 'failed', 'probe', NULL);
    IF NOT public.automation_should_auto_mute(v_a) THEN
      RAISE EXCEPTION 'exactly 80 percent did not qualify, but the page says AT LEAST 80';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'silent at 23 of 30, qualifying at exactly 24 of 30';
  END;
END $$;
