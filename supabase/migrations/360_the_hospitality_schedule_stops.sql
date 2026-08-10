-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 360 — unschedule the cron jobs that run hospitality software.
--
-- Nine of eleven jobs sweep inventory: par levels, supplier lead times, POS
-- variance, price drift, forecast scoring, alert thresholds, and the two
-- intelligence cycles. One of those two calls the `intelligence-cycle` edge
-- function, which no longer exists — reality-graph's runIntelligenceCycle went
-- with the engine teardown, so that job is already firing into nothing.
--
-- Unscheduling comes BEFORE dropping the functions they call. A cron job whose
-- command references a dropped function fails on every tick and buries the
-- failure in cron.job_run_details, which is exactly the class of silent breakage
-- the self-apply rules exist to prevent.
--
-- Two survive, and neither is hospitality:
--   beacon-cron-health-monitor    watches cron itself
--   beacon-proposal-outcomes-daily  proposals are AIP-native (CLAUDE.md)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY[
    'beacon-agent-intelligence-cycle',
    'beacon-alert-thresholds-weekly',
    'beacon-forecast-score',
    'beacon-intelligence-cycle',
    'beacon-pos-variance-daily',
    'beacon-price-drift-weekly',
    'beacon-supplier-reliability-weekly',
    'beacon-weekly-lt-learning',
    'beacon-weekly-par-update'
  ];
  j text;
  n int;
BEGIN
  FOREACH j IN ARRAY doomed LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;

  SELECT count(*) INTO n FROM cron.job WHERE jobname = ANY(doomed);
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 360: % hospitality job(s) still scheduled', n;
  END IF;

  -- The two keepers must still be there; unscheduling by name is easy to
  -- over-reach with a typo'd array.
  SELECT count(*) INTO n FROM cron.job
   WHERE jobname IN ('beacon-cron-health-monitor', 'beacon-proposal-outcomes-daily');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 360: expected the 2 surviving jobs, found %', n;
  END IF;
END $$;

COMMIT;
