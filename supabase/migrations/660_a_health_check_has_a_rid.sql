-- The Health tab's right rail prints the check's resource identifier in the
-- ri.data-health.main.check grammar (data-health/images/health-checks-overview.png
-- shows one under a "Check RID" label; paraphrased — capture text is not
-- quotable in a migration header). 659 shipped the engine without it; the
-- surface displays it, so it arrives with the surface, the same generated
-- form every other resource kind got in 391/488.

ALTER TABLE public.health_checks
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('data-health', 'check', id)) STORED;

COMMENT ON COLUMN public.health_checks.rid IS
  'The check''s resource identifier, ri.data-health.main.check.<uuid> — the grammar the Health-tab capture prints in its right rail (data-health/images/health-checks-overview.png).';

CREATE UNIQUE INDEX health_checks_rid_key ON public.health_checks (rid);

DO $$
DECLARE v_rid text;
BEGIN
  SELECT public.rid_of('data-health', 'check', '00000000-0000-0000-0000-000000000001') INTO v_rid;
  IF v_rid <> 'ri.data-health.main.check.00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'the check RID does not read as the capture prints it: %', v_rid;
  END IF;
  RAISE NOTICE '660 proved: a health check''s rid joins the ri.data-health.main.check grammar';
END $$;
