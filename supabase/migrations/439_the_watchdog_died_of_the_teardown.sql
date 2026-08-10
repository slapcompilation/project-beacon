-- Two cron jobs have been calling functions that do not exist, and one of them
-- was the watchdog.
--
-- Found by the nightly foundry-gap run — its first, and this is outside the
-- ontology scope it was pointed at, which is rather the point of the sweep.
-- Verified before acting: `cron.job_run_details` shows both failing on
-- `function ... does not exist`, over a thousand consecutive failures on the
-- monitor since 2026-08-05.
--
-- Migration 360 tore down the hospitality schedule and spared exactly two jobs:
--
--   "Two survive, and neither is hospitality:
--      beacon-cron-health-monitor      watches cron itself
--      beacon-proposal-outcomes-daily  proposals are AIP-native (CLAUDE.md)"
--
-- Both sparings were wrong, each in its own way:
--
--   · `compute_proposal_outcomes()` scored HOSPITALITY restock proposals — it
--     read `restock_requests` and `proposal_dismissals`, both dropped in 364.
--     The name collided with the AIP proposal machinery and the collision is
--     what got it spared. The function died with its tables; the job kept
--     firing at a ghost.
--
--   · `monitor_cron_health()` watched for silent cron failure. Its function
--     was dropped by the teardown and the job has been failing every five
--     minutes since — the failure-detector was the failure it existed to
--     detect, and nothing noticed for four days. A watchdog that reports
--     through a surface that no longer exists ("Settings → Autonomous") is
--     hospitality infrastructure whatever its name says.
--
-- Neither is restored. The durable guard is not another cron job watching cron
-- — it is the audit suite CI runs against the live database, which now asserts
-- that every scheduled job calls only functions that exist. Same tripwire that
-- would have caught the auth trigger, applied to the scheduler.

DO $$
DECLARE r record; fn text; missing text := NULL;
BEGIN
  -- Unschedule the two dead jobs, by name, only if present.
  FOR r IN SELECT jobid, jobname FROM cron.job
            WHERE jobname IN ('beacon-cron-health-monitor', 'beacon-proposal-outcomes-daily')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE '439: unscheduled % (job %)', r.jobname, r.jobid;
  END LOOP;

  -- And the sweep the watchdog should have been: every job still scheduled
  -- must call only functions that exist, in any schema.
  FOR r IN SELECT jobname, command FROM cron.job WHERE active LOOP
    FOR fn IN SELECT (regexp_matches(r.command, '([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', 'g'))[1] LOOP
      IF fn NOT IN ('select') AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = fn) THEN
        missing := coalesce(missing || '; ', '') || format('%s calls %s()', r.jobname, fn);
      END IF;
    END LOOP;
  END LOOP;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'a scheduled job still calls a function that does not exist: %', missing;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job
              WHERE jobname IN ('beacon-cron-health-monitor', 'beacon-proposal-outcomes-daily')) THEN
    RAISE EXCEPTION 'a dead job survived its own unscheduling';
  END IF;

  RAISE NOTICE '439: every remaining scheduled job calls only functions that exist';
END $$;
