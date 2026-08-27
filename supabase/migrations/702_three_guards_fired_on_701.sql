-- 702: three guards fired on the 699-701 arc; each fix is one line of intent.
--
-- catalog.test: model_direct_deployments.created_by is a foreign key with no
-- index on its leading column — the only table of the arc where I skipped it.
CREATE INDEX model_direct_deployments_created_by_idx
  ON public.model_direct_deployments (created_by);

-- rlsInitPlan.test: the two INSERT policies called auth.uid() per row. The
-- recorded lesson (619): wrap it so it is an InitPlan, evaluated once.
DROP POLICY "members write reviews" ON public.submission_reviews;
CREATE POLICY "members write reviews" ON public.submission_reviews
  FOR INSERT WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.objective_submissions s
                 WHERE s.id = submission_id
                   AND public.can_read_objective(s.objective_id)));
DROP POLICY "members write check responses" ON public.submission_check_responses;
CREATE POLICY "members write check responses" ON public.submission_check_responses
  FOR INSERT WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.objective_checks c
                 WHERE c.id = check_id
                   AND public.can_read_objective(c.objective_id)));

-- vocabularyPages.test, twice: 701 declared the batch run's status set from
-- an api slug that does not exist on disk in that spelling, and two of the
-- four values are not on any api page anyway — COMPLETED and ABORTED are the
-- OMA prose vocabulary. The set was right and the declaration was wrong. The
-- page that carries all four, value by value, is the one 493's ledger reads:
--
--   "`RUNNING`: The job has been invoked and is currently being computed."
--   — data-integration/builds.md
COMMENT ON CONSTRAINT batch_runs_status_check ON public.batch_deployment_runs IS
  'Values from data-integration/builds, which defines RUNNING, ABORTED, FAILED and COMPLETED each in its own bullet. A batch run is a build here, so it takes the build ledger''s prose vocabulary (493), not the api''s SUCCEEDED/CANCELED — the two-vocabularies rule, decided the same way builds.status was.';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('submission_reviews', 'submission_check_responses')
     AND with_check LIKE '%auth.uid()%'
     AND with_check NOT LIKE '%( SELECT auth.uid()%';
  IF n <> 0 THEN RAISE EXCEPTION '% policy(ies) still call auth.uid() per row', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE tablename = 'model_direct_deployments'
                    AND indexname = 'model_direct_deployments_created_by_idx') THEN
    RAISE EXCEPTION 'the created_by index did not land';
  END IF;
  RAISE NOTICE '702 proved: both INSERT policies now evaluate auth.uid() once, and the direct deployments ledger indexes its author';
END $$;
