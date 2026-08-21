-- 609's third path never ran: the database holds no action type, so the probe
-- took its own escape and printed "the muted branch is unproven here". The same
-- hole 603 left and 604 closed, in the same week.
--
-- Nothing in the schema changes. This migration exists to EXECUTE the branch
-- 609 added, on a scratch action type it creates and rolls back, and to prove
-- it by CONTRAST — muted records `skipped` and nothing else; unmuted records
-- something else and no `skipped`. One direction alone would pass against a
-- branch that skips everything, or against one that skips nothing.

DO $$
DECLARE
  v_ont   uuid;
  v_proj  uuid;
  v_owner uuid;
  v_at    uuid;
  v_a     uuid;
  v_n     int;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_ont IS NULL OR v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no ontology, project or user: 610 cannot prove 609''s branch';
    END IF;

    -- An action type with no rules: apply_action writes nothing and SUCCEEDS,
    -- which is exactly the observable difference the contrast needs.
    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-610-muted-branch', 'Probe 610') RETURNING id INTO v_at;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope, muted)
    VALUES (v_proj, 'Probe 610', v_owner,
            '{"type":"time","cron":"* * * * *","timezone":"UTC"}'::jsonb, 'project', true)
    RETURNING id INTO v_a;
    -- guard_automation_effect_ownership compares auth.uid() to the owner, and
    -- a migration has no uid — so the probe speaks as the owner. Found by the
    -- first run being refused with Automate:TakeOwnershipToEdit, which is the
    -- guard working.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_owner::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, kind, action_type_id)
    VALUES (v_a, 'action', v_at);
    PERFORM set_config('request.jwt.claims', '', true);

    -- MUTED: the condition fires, the run is recorded, the effect is not run.
    PERFORM public.run_automations(date_trunc('minute', now()));

    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome = 'skipped';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'muted: expected exactly 1 skipped run, got %', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome <> 'skipped';
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'muted: % effect run(s) were executed anyway', v_n;
    END IF;

    -- UNMUTED, same automation, same minute: the effect runs, and nothing is
    -- skipped. Without this half the assertion above would pass against a
    -- branch that skipped every automation, muted or not.
    DELETE FROM public.automation_runs WHERE automation_id = v_a;
    UPDATE public.automations SET muted = false, last_run_at = NULL WHERE id = v_a;
    PERFORM public.run_automations(date_trunc('minute', now()));

    SELECT count(*) INTO v_n FROM public.automation_runs r
     WHERE r.automation_id = v_a AND r.outcome = 'skipped';
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'unmuted: % run(s) were skipped; the branch reads more than muted', v_n;
    END IF;
    SELECT count(*) INTO v_n FROM public.automation_runs r WHERE r.automation_id = v_a;
    IF v_n < 1 THEN
      RAISE EXCEPTION 'unmuted: nothing ran at all, so the muted half proves nothing';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'muted skipped its only effect and executed none; unmuted executed it and skipped none';
  END;
END $$;
