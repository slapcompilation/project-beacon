-- The event log. Approved by the operator against #748's Decisions block,
-- which is the gate this repository puts in front of building from a reading.
--
-- WHAT AN EVENT IS. One row per FIRING, with the run rows as its effect half.
-- `history` is the page that enumerates the vocabulary and it is a table, so it
-- wins over any page that describes a member:
--
--   "Automation history tracks events related to condition evaluation and
--   automation metadata changes for individual automations."
--   — automate/history.md
--
-- and the detail view is per event, not per effect:
--
--   "Select an event to view the full execution timeline, including condition
--   evaluation details, effect execution status, timestamps, and any errors."
--   — automate/history.md
--
-- THE VOCABULARY IS PROSE, and that is a decision rather than a default. The
-- two-vocabulary trap says orchestration ledgers take the API's tokens — but
-- there is NO automations endpoint under `api/` (checked: nothing under
-- `api/` names an automation resource), so the Ontology-Manager-facing table on
-- `history` is the only enumeration that exists. Snake-cased 1:1 from that
-- table's Event column, which is how this repository states a vocabulary.
--
-- SEVEN OF TEN, and each exclusion has a producer-shaped reason:
--
--   `Automation recovered`  "Only threshold conditions on object sets generate
--                            this event" — threshold_crossed is one of the six
--                            condition cards we do not offer.
--   `Subscribed`            no subscriber exists in this schema at all.
--   `Unsubscribed`          same.
--
-- Recording a token nothing writes is the `skipped` situation in reverse — a
-- value with no producer — so the CHECK admits only what a writer exists for,
-- and every one of the seven gets a writer IN THIS FILE.
--
-- #748'S DECISIONS BLOCK SAID ELEVEN. The table lists TEN. I counted them off
-- the page while writing this and the earlier number was mine, not Foundry's —
-- the same class of error rule 7 exists for, one step earlier than usual.
--
-- WHAT IS NOT BUILT, named rather than implied:
--   * Retention. "retained for six months, then permanently deleted" — nothing
--     here expires anything, and a cron that deletes history is its own
--     decision with its own probe.
--   * An event for an evaluation that ran and matched nothing. `history` does
--     not say one exists; recording one would be 1,440 rows a day per
--     automation. Only firings and failures are recorded, which is an inference
--     and is marked as one.
--   * Shared history for user-scoped automations ("Generate shared history
--     events"). The visibility policy below is the scope rule that already
--     governs runs; the shared-history toggle is a third state we do not have.

CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- "View failure details in the automation's History tab."
  detail text,
  CONSTRAINT automation_events_type_check CHECK (event_type = ANY (ARRAY[
    'automation_triggered', 'evaluation_failed', 'condition_edited',
    'paused', 'resumed', 'muted', 'unmuted'
  ]))
);

COMMENT ON CONSTRAINT automation_events_type_check ON public.automation_events IS
  'Values from automate/history, snake-cased 1:1 from its Event table. Three of its ten are omitted because nothing here can produce them: Automation recovered needs a threshold condition, and Subscribed/Unsubscribed need a subscriber.';

CREATE INDEX automation_events_by_automation
  ON public.automation_events (automation_id, occurred_at DESC);

-- The effect half points at its event. Nullable, because `condition_edited` is
-- "Recorded when any user updates the automation condition" — a metadata change
-- with no firing and therefore no runs — and because every run that already
-- exists predates this table.
ALTER TABLE public.automation_runs
  ADD COLUMN event_id uuid REFERENCES public.automation_events(id) ON DELETE CASCADE;

CREATE INDEX automation_runs_by_event ON public.automation_runs (event_id);

-- ── visibility ──────────────────────────────────────────────────────────────
-- "History is viewable to all users who satisfy the markings on a run" for
-- project-scoped automations, and "visible only to the owner" for user-scoped.
-- That is exactly the predicate `run history follows the scope` already
-- carries, so it is LIFTED into a function and both policies call it rather
-- than stating it twice. Composing beats restating: a second copy is a second
-- thing to drift.
CREATE OR REPLACE FUNCTION public.can_read_automation_history(p_automation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automations a
     WHERE a.id = p_automation
       AND (a.owner_id = (SELECT auth.uid())
            OR (a.scope = 'project'
                AND public.role_rank(public.project_role(a.project_id))
                    >= public.role_rank('viewer'))))
$$;

COMMENT ON FUNCTION public.can_read_automation_history(uuid) IS
  'The scope rule from automate/history-visibility-and-scope: the owner always, and any project viewer when the automation is project-scoped. Called by both the runs policy and the events policy so the rule has one statement.';

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event history follows the scope" ON public.automation_events
  FOR SELECT USING (public.can_read_automation_history(automation_id));

ALTER POLICY "run history follows the scope" ON public.automation_runs
  USING (public.can_read_automation_history(automation_id));

GRANT SELECT ON public.automation_events TO authenticated;

-- ── the writers ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER and granted to `beacon_runner` alone, which is the shape 553
-- established for the ledger: one writer, reached by inverting the scheduled
-- path rather than elevating around it. The metadata trigger below is the one
-- exception and it is a trigger, not a callable entry point.
CREATE OR REPLACE FUNCTION public.record_automation_event(
  p_automation uuid, p_type text, p_detail text DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.automation_events (automation_id, event_type, detail)
  VALUES (p_automation, p_type, p_detail) RETURNING id
$$;

REVOKE ALL ON FUNCTION public.record_automation_event(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_automation_event(uuid, text, text) TO beacon_runner;

-- record_automation_run gains the event it belongs to. DROP and recreate rather
-- than adding an overload: two functions differing only by a defaulted third
-- argument make every two-argument call ambiguous, which fails at runtime
-- rather than here.
DROP FUNCTION public.record_automation_run(uuid, uuid);

CREATE FUNCTION public.record_automation_run(
  p_automation uuid, p_effect uuid, p_event uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.automation_runs (automation_id, effect_id, outcome, event_id)
  VALUES (p_automation, p_effect, 'started', p_event) RETURNING id
$$;

REVOKE ALL ON FUNCTION public.record_automation_run(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_automation_run(uuid, uuid, uuid) TO beacon_runner;

-- The four metadata events. A trigger rather than a call site, because
-- `history` records them for "any user" who makes the change and there is more
-- than one path to a paused automation.
CREATE OR REPLACE FUNCTION public.record_automation_metadata_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NEW.paused IS DISTINCT FROM OLD.paused THEN
    PERFORM public.record_automation_event(NEW.id,
      CASE WHEN NEW.paused THEN 'paused' ELSE 'resumed' END);
  END IF;
  IF NEW.muted IS DISTINCT FROM OLD.muted THEN
    PERFORM public.record_automation_event(NEW.id,
      CASE WHEN NEW.muted THEN 'muted' ELSE 'unmuted' END);
  END IF;
  IF NEW.condition IS DISTINCT FROM OLD.condition THEN
    PERFORM public.record_automation_event(NEW.id, 'condition_edited');
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER record_automation_metadata_event
  AFTER UPDATE OF paused, muted, condition ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.record_automation_metadata_event();

-- ── the runner writes the other two ─────────────────────────────────────────
-- Patched from the live definition at four named anchors, each asserted to have
-- changed. Retyping this function from memory once invented two helpers that do
-- not exist.
DO $$
DECLARE d text; p text; n int := 0;
BEGIN
  d := pg_get_functiondef('public.run_automations(timestamptz)'::regprocedure);
  IF position('record_automation_event' in d) > 0 THEN
    RAISE NOTICE 'run_automations already records events';
    RETURN;
  END IF;
  p := d;

  -- (1) a variable to carry the event through the effect loop
  p := replace(p, '        ran int := 0; run_id uuid;',
                  '        ran int := 0; run_id uuid; ev uuid;');
  IF p = d THEN RAISE EXCEPTION '622: the DECLARE block is not where it was'; END IF;

  -- (2) "Recorded when an automation fails to evaluate for any reason."
  n := length(p);
  p := replace(p, '    EXCEPTION WHEN OTHERS THEN' || chr(10) || '      fired := NULL;',
                  '    EXCEPTION WHEN OTHERS THEN' || chr(10) || '      fired := NULL;' || chr(10) ||
                  '      PERFORM public.record_automation_event(a.id, ''evaluation_failed'', sqlerrm);');
  IF length(p) = n THEN RAISE EXCEPTION '622: the evaluation handler is not where it was'; END IF;

  -- (3) one event per firing, created before anything reads it
  n := length(p);
  p := replace(p, '    IF fired IS NOT NULL THEN' || chr(10),
                  '    IF fired IS NOT NULL THEN' || chr(10) ||
                  '      ev := public.record_automation_event(a.id, ''automation_triggered'');' || chr(10));
  IF length(p) = n THEN RAISE EXCEPTION '622: the firing branch is not where it was'; END IF;

  -- (4) every run row names its event — the muted branch, the effects loop and
  -- the fallback release, which is why this is a replace and not an edit
  n := length(p);
  p := replace(p, 'public.record_automation_run(a.id, e.id)',
                  'public.record_automation_run(a.id, e.id, ev)');
  p := replace(p, 'public.record_automation_run(a.id, f.id)',
                  'public.record_automation_run(a.id, f.id, ev)');
  IF length(p) = n THEN RAISE EXCEPTION '622: no run-recording call sites found'; END IF;

  -- (5) A DEFECT THE PROBE FOUND, and it is why this migration touches the
  -- snapshot at all. The handler above catches automation_fires, but the
  -- membership snapshot at the bottom calls object_set_keys AGAIN, unwrapped —
  -- so an object set the owner cannot read raises there and ends the whole
  -- pass. One broken automation took the other forty-nine down with it, and
  -- nothing recorded why. `history` says an evaluation failure is "Recorded
  -- when an automation fails to evaluate for any reason"; being fatal is not
  -- one of the readings of that sentence.
  n := length(p);
  p := replace(p,
    '      members := to_jsonb(public.object_set_keys((a.condition->>''object_set_id'')::uuid,' || chr(10) ||
    '                   public.automation_input_limit(a.condition->>''type'')));' || chr(10) ||
    '      PERFORM public.record_automation_state(a.id, members, fired IS NOT NULL, p_at);',
    '      BEGIN' || chr(10) ||
    '        members := to_jsonb(public.object_set_keys((a.condition->>''object_set_id'')::uuid,' || chr(10) ||
    '                     public.automation_input_limit(a.condition->>''type'')));' || chr(10) ||
    '        PERFORM public.record_automation_state(a.id, members, fired IS NOT NULL, p_at);' || chr(10) ||
    '      EXCEPTION WHEN OTHERS THEN' || chr(10) ||
    '        -- Already recorded above when automation_fires raised for the same' || chr(10) ||
    '        -- reason; only a snapshot that fails on its own is news.' || chr(10) ||
    '        IF fired IS NOT NULL THEN' || chr(10) ||
    '          PERFORM public.record_automation_event(a.id, ''evaluation_failed'', sqlerrm);' || chr(10) ||
    '        END IF;' || chr(10) ||
    '      END;');
  IF length(p) = n THEN RAISE EXCEPTION '622: the membership snapshot is not where it was'; END IF;

  EXECUTE p;
  RAISE NOTICE 'run_automations now opens an event per firing, records evaluation failures, and survives an unreadable object set';
END $$;

-- Every one of the seven tokens is produced HERE, by the path that produces it
-- in production. A CHECK value with no writer is what this file exists to
-- avoid, so the probe is an enumeration: seven types, seven producers.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_ont uuid; v_owner uuid; v_at uuid; v_a uuid;
  v_seen text[]; v_missing text[]; v_runs int; v_ev uuid;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org
      ORDER BY p.created_at LIMIT 1;
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_ont IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project, ontology or user: 622 cannot prove its own writers';
    END IF;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-622', 'Probe 622') RETURNING id INTO v_at;
    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 622', v_owner,
            '{"type":"time","cron":"0 3 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
    VALUES (v_a, 0, 'action', v_at);

    -- The claims stay the owner's: guard_automation_ownership refuses an edit
    -- to the condition or the effects from anyone else, and a migration has no
    -- caller of its own.
    -- the four metadata events, through the trigger rather than by hand
    UPDATE public.automations SET paused = true  WHERE id = v_a;
    UPDATE public.automations SET paused = false WHERE id = v_a;
    UPDATE public.automations SET muted  = true  WHERE id = v_a;
    UPDATE public.automations SET muted  = false WHERE id = v_a;
    UPDATE public.automations SET condition =
      '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb WHERE id = v_a;
    PERFORM set_config('request.jwt.claims', '', true);

    -- a firing, through the runner: 04:00 matches the condition above
    PERFORM public.run_automations(timestamptz '2026-08-22 04:00+00');

    -- an evaluation failure, through the runner: an object set that is not
    -- there makes automation_fires raise, which is the documented "for any
    -- reason".
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    UPDATE public.automations SET condition = jsonb_build_object(
      'type', 'objects_added', 'object_set_id', gen_random_uuid(),
      'schedule', jsonb_build_object('cron', '0 5 * * *', 'timezone', 'UTC'))
     WHERE id = v_a;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM public.run_automations(timestamptz '2026-08-22 05:00+00');

    SELECT array_agg(DISTINCT event_type ORDER BY event_type) INTO v_seen
      FROM public.automation_events WHERE automation_id = v_a;

    SELECT array_agg(t ORDER BY t) INTO v_missing FROM unnest(ARRAY[
      'automation_triggered', 'evaluation_failed', 'condition_edited',
      'paused', 'resumed', 'muted', 'unmuted']) t
     WHERE NOT (t = ANY (coalesce(v_seen, '{}')));

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'these CHECK values have no producer: %', array_to_string(v_missing, ', ');
    END IF;

    -- and the effect half is attached to the firing, not floating
    SELECT e.id INTO v_ev FROM public.automation_events e
     WHERE e.automation_id = v_a AND e.event_type = 'automation_triggered' LIMIT 1;
    SELECT count(*) INTO v_runs FROM public.automation_runs r WHERE r.event_id = v_ev;
    IF v_runs < 1 THEN
      RAISE EXCEPTION 'the firing produced no run rows carrying its event id';
    END IF;

    -- the other direction: a metadata event has no runs, and must be allowed to
    IF EXISTS (SELECT 1 FROM public.automation_runs r
                JOIN public.automation_events e ON e.id = r.event_id
               WHERE e.event_type = 'condition_edited') THEN
      RAISE EXCEPTION 'a condition_edited event acquired run rows';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'all seven event types were produced by the path that produces them, and the firing carries its runs';
  END;
END $$;
