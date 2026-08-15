-- automation_runs had no comment, which catalog.test.ts asks of every table.
--
-- 487 asserted the floor once; the standing test re-asks it, and answered on
-- the first run after 517. Cheap to fix, and the point of having the guard.

COMMENT ON TABLE public.automation_runs IS
  'One attempted effect. Written BEFORE the attempt, so a crash re-runs rather than skips: "Effects follow at-least-once execution semantics rather than exactly-once guarantees." Visible to the owner, and to the project when the automation is project-scoped.';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND obj_description(c.oid, 'pg_class') IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% table(s) still say nothing', n; END IF;
  RAISE NOTICE '519: every table says what it holds';
END $$;
