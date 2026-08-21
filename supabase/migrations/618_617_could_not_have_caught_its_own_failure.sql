-- 617's fourth assertion is inert, and this file is here so the next reader is
-- not told it proved something.
--
-- It read condition_state and asserted IS NULL off-cadence and IS NOT NULL on.
-- condition_state is NOT NULL with DEFAULT '{}'::jsonb, so it is never NULL and
-- both halves are decided by the column default rather than by the runner. The
-- first half would have failed against any database where an object set exists;
-- the second could never fail at all.
--
-- It did not fail on the way in because it did not RUN — prod has no object
-- sets, so 617 printed that the contrast could not run and applied anyway. Two
-- separate defects, and the second hid the first: an assertion nobody has seen
-- FAIL is not a guard, and one that is skipped is not even a claim.
--
-- THE BEHAVIOUR IS CORRECT. Probed against the live function, with the runner
-- called twice on one automation scheduled `0 8 * * *`:
--
--   03:17  condition_state = {}              members key absent   ran 0
--   08:00  condition_state = {"members": []} members key present  ran 0
--
-- So off-cadence the automation is skipped whole and the snapshot holds, which
-- is the property that makes 617 correct rather than decorative. The right
-- assertion is on the `members` KEY, not on the column being null, and this
-- file makes it — creating its own object set so it cannot silently skip.

DO $$
DECLARE
  v_proj uuid; v_owner uuid; v_ot uuid; v_ont uuid; v_set uuid; v_a uuid;
  v_off jsonb; v_on jsonb;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    SELECT t.id, t.ontology_id INTO v_ot, v_ont FROM public.object_types t LIMIT 1;
    IF v_proj IS NULL OR v_owner IS NULL OR v_ot IS NULL THEN
      RAISE EXCEPTION 'no project, user or object type: 618 cannot prove the contrast';
    END IF;

    -- Its own set, so this cannot degrade into 617's skipped branch. ontology_id
    -- is passed explicitly because default_ontology() needs a caller's org and
    -- a migration has none.
    INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id)
    VALUES ('Probe 618 set', 'probe618set', v_ot, v_proj, v_ont) RETURNING id INTO v_set;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 618', v_owner,
            jsonb_build_object('type', 'objects_added', 'object_set_id', v_set,
              'schedule', jsonb_build_object('cron', '0 8 * * *', 'timezone', 'UTC')),
            'project')
    RETURNING id INTO v_a;

    PERFORM public.run_automations(timestamptz '2026-08-21 03:17+00');
    SELECT condition_state INTO v_off FROM public.automations WHERE id = v_a;

    PERFORM public.run_automations(timestamptz '2026-08-21 08:00+00');
    SELECT condition_state INTO v_on FROM public.automations WHERE id = v_a;

    -- The KEY, not the column. `{}` and `{"members": []}` are both non-null and
    -- that is exactly what 617 could not tell apart.
    IF v_off ? 'members' THEN
      RAISE EXCEPTION 'the snapshot advanced off-cadence — a daily automation would report one minute of additions';
    END IF;
    IF NOT (v_on ? 'members') THEN
      RAISE EXCEPTION 'the snapshot did not advance on a matching tick — the guard refuses everything';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'the snapshot held off-cadence and advanced on cadence, asserted on the members key';
  END;
END $$;

COMMENT ON FUNCTION public.automation_due(jsonb, timestamptz) IS
  'Whether an object set condition is due for evaluation at this instant. A time condition is always due — automation_fires matches its own cron. Gates the whole evaluation, snapshot included: see 618 for the contrast that proves it, and why 617''s own version of that assertion was inert.';
