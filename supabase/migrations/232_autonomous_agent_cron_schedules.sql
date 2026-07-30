-- Recovered from supabase_migrations version 20260417065737.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Clear any stale jobs from earlier migrations
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN (
  'beacon-intelligence-cycle',
  'beacon-price-drift-weekly',
  'beacon-pos-variance-daily',
  'beacon-embeddings-nightly',
  'escalate-stale-approvals',
  'weekly-price-drift-check',
  'daily-po-discrepancy-scan',
  'daily-pos-variance-scan'
);

-- Primary agent loop: every 15 minutes
SELECT cron.schedule(
  'beacon-intelligence-cycle',
  '*/15 * * * *',
  'SELECT run_intelligence_cycle()'
);

-- Weekly price drift scan: Mondays 06:00 UTC
SELECT cron.schedule(
  'beacon-price-drift-weekly',
  '0 6 * * 1',
  'SELECT detect_and_alert_price_drift(6, 5)'
);

-- Daily POS variance scan: 05:00 UTC
SELECT cron.schedule(
  'beacon-pos-variance-daily',
  '0 5 * * *',
  'SELECT detect_and_alert_pos_variance(7, 20)'
);
