-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 143 — schedule the typed agent intelligence cycle on cron.
--
-- This is the unattended twin of the operator's "Run cycle" button. pg_cron
-- invokes the `intelligence-cycle` edge function (via pg_net), which runs the
-- restock_advisor agent per at-risk variant across every hotel and routes each
-- proposal through decideAutoExecution — confident, uncontested REQUEST_RESTOCKs
-- auto-execute as ai_auto_approved; everything else queues.
--
-- This replaces the dead SQL proposer steps conceptually (see migration 142 +
-- the project finding that auto_propose_restocks is a no-op under cron). Those
-- SQL steps are left in place for now; retire them once the agent cron is
-- proven in prod.
--
-- DEPLOY PREREQUISITES (the job is a no-op until these exist):
--   1. Deploy the `intelligence-cycle` edge function.
--   2. Set the edge function secret WEBHOOK_SIGNING_SECRET (the value the
--      function checks via verifySharedSecret).
--   3. Create two Vault secrets so the secret never lives in SQL/repo:
--        - project_url            = https://<project-ref>.supabase.co
--        - beacon_webhook_secret  = <same value as WEBHOOK_SIGNING_SECRET>
--      e.g. select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--
-- Depends on: 102 (pg_cron), 127 (proposals), 130 (approve_stock_transfer)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. System-authored rows have no human actor ──────────────────────────────
-- The cron has no user. Attribution lives in triggered_by / proposals.agent_name,
-- so the actor columns become nullable. Authenticated inserts are unaffected
-- (their RLS INSERT policies still require the column = auth.uid(), so only the
-- service role can write a null-actor row). Also fixes the latent NULL-requestor
-- insert in trg_critical_stockout (migration 102).
ALTER TABLE proposals        ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE restock_requests ALTER COLUMN requestor_id       DROP NOT NULL;

-- ── 2. Hardening: approve_stock_transfer must not be anon-callable ────────────
-- (get_advisors flagged anon_security_definer_function_executable; the function
-- self-guards on auth.uid(), but tighten the grant anyway.)
REVOKE EXECUTE ON FUNCTION approve_stock_transfer(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION approve_stock_transfer(uuid) TO authenticated;

-- ── 3. Schedule the agent cycle ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not available — agent cycle not scheduled.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'beacon-agent-intelligence-cycle';

  -- Daily at 07:00 UTC (after the overnight SQL cycle settles). URL + secret are
  -- read from Vault at run time so neither lives in this migration.
  PERFORM cron.schedule(
    'beacon-agent-intelligence-cycle',
    '0 7 * * *',
    $cron$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
                 || '/functions/v1/intelligence-cycle',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-beacon-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'beacon_webhook_secret')
                 ),
      body    := '{}'::jsonb
    );
    $cron$
  );

  RAISE NOTICE 'Scheduled beacon-agent-intelligence-cycle daily at 07:00 UTC.';
END;
$$;
