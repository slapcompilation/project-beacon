-- Restore the submission-criteria gate 509 clobbered.
--
-- 449 wired the gate into apply_action by patching the LIVE definition in
-- place — "Patched in place with the needle asserted … the alternative is
-- restating apply_action a third time in full." 509 then restated it a third
-- time in full, from 446's body, which predates the patch. The gate vanished
-- and every submission criterion stopped being asked.
--
-- Nothing static caught it. actions.test.ts did, on the next run, because it
-- asks the behaviour rather than the text: "refuses a failing criterion with
-- its own words". That is the whole argument for the standing suite.
--
-- The lesson is the one this repo already wrote down after object_set_where
-- grew a column that never existed: RESTATE FROM pg_get_functiondef, NOT FROM
-- THE MIGRATION THAT FIRST CREATED IT. A function accumulates patches, and the
-- oldest source is the least true.
--
-- So this re-applies 449's patch to whatever is live now, with the same needle
-- assertion, rather than restating a fourth time.

DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure);

  IF def LIKE '%SubmissionCriteriaFailed%' THEN
    RAISE NOTICE '512: the gate is already in place';
    RETURN;
  END IF;
  IF def NOT LIKE '%FOR r IN SELECT * FROM public.action_type_rules%' THEN
    RAISE EXCEPTION 'apply_action has drifted — wire the criteria gate by hand';
  END IF;

  def := replace(def,
    'FOR r IN SELECT * FROM public.action_type_rules',
    'pk_val := public.submission_criteria_verdict(p_action_type, p_parameters);
  IF pk_val IS NOT NULL THEN
    RAISE EXCEPTION ''Actions:SubmissionCriteriaFailed — %'', pk_val;
  END IF;

  FOR r IN SELECT * FROM public.action_type_rules');
  EXECUTE def;

  IF pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure)
     NOT LIKE '%SubmissionCriteriaFailed%' THEN
    RAISE EXCEPTION 'the gate did not land in apply_action';
  END IF;
  RAISE NOTICE '512: the criteria gate is back in apply_action';
END $$;

-- Both things 509 added are still there, so the restore did not undo it.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure);
  IF def NOT LIKE '%SubmissionCriteriaFailed%' THEN
    RAISE EXCEPTION 'the criteria gate is missing';
  END IF;
  IF def NOT LIKE '%WrongRuntime%' THEN
    RAISE EXCEPTION 'the runtime branch is missing';
  END IF;
  IF def NOT LIKE '%ValueSourceNotExecutable%' THEN
    RAISE EXCEPTION 'the object_parameter_property refusal is missing';
  END IF;
END $$;
