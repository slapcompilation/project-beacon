-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 142 — Intelligence cycle: surface "green but zero-work" runs
--
-- Layer: Eye (self-observability) — extends migration 115's health machinery.
-- Scope: system (no hotel scope).
--
-- Why this exists
-- ───────────────
-- run_intelligence_cycle() runs every 15 min under pg_cron and has reported
-- "succeeded" on every run — yet the database has produced zero auto-proposed
-- restock_requests, ever (verified: 192 green runs / 2 days, 0 proposals).
--
-- Root cause: steps 1–3 (auto_create_alerts, auto_propose_restocks,
-- generate_preemptive_restocks) all derive their hotel from auth_hotel_id(),
-- which reads the request JWT. pg_cron has no JWT, so auth_hotel_id() is NULL
-- and those steps match no rows. The cycle is structurally incapable of
-- proposing anything under cron, but nothing made that visible:
-- monitor_cron_health (115) watches job success/failure, not the *content* of a
-- successful run. A green job hid a dead feature.
--
-- This is the prevention deliverable CLAUDE.md self-apply asks for ("what
-- observability would have made this a one-minute fix?"). It is purely additive:
-- the seven steps are untouched. It records the per-step counts each run, and
-- when the cycle runs without a hotel context — so the hotel-scoped detection
-- steps are dead — it emits a deduped warn event explaining exactly that.
--
-- Unattended proposing is moving to the typed restock_advisor agent
-- (reality-graph runIntelligenceCycle); retiring steps 1–3 from the cron path
-- rides with that change, not this one.
--
-- Depends on: 102 (run_intelligence_cycle), 115 (system_health_events)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION run_intelligence_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created     int := 0;
  v_proposals_created  int := 0;
  v_preemptive_created int := 0;
  v_discrepancies      int := 0;
  v_start              timestamptz := clock_timestamp();
  v_hotel_ctx          uuid := auth_hotel_id();
  v_recent_warn        uuid;
BEGIN
  -- Steps 1–3 are hotel-scoped via auth_hotel_id(); see header for why they are
  -- no-ops under cron. Kept intact for authenticated in-app / manual calls.
  SELECT auto_create_alerts()           INTO v_alerts_created;
  SELECT auto_propose_restocks()        INTO v_proposals_created;
  SELECT generate_preemptive_restocks() INTO v_preemptive_created;

  PERFORM escalate_stale_approvals();
  SELECT detect_po_discrepancies(2)     INTO v_discrepancies;
  PERFORM auto_approve_eligible_restocks();
  PERFORM auto_approve_matched_invoices();

  -- Observability: when there is no hotel context (the pg_cron case), the
  -- detection/proposal steps above produced nothing by construction. Record it
  -- in system_health_events so the dead-step condition is queryable instead of
  -- hidden behind a green job status. Deduped to ≤ 1 per 6h, severity 'warn'
  -- (a known structural condition, not an incident — the critical-only summary
  -- widget stays quiet, but the audit trail carries the explanation).
  IF v_hotel_ctx IS NULL THEN
    SELECT id INTO v_recent_warn
      FROM system_health_events
     WHERE event_type = 'intelligence_cycle_no_hotel_context'
       AND acknowledged_at IS NULL
       AND created_at >= now() - interval '6 hours'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_recent_warn IS NULL THEN
      INSERT INTO system_health_events (
        event_type, severity, source, summary, details,
        nodes_considered, confidence_basis
      ) VALUES (
        'intelligence_cycle_no_hotel_context',
        'warn',
        'run_intelligence_cycle',
        'Intelligence cycle ran without a hotel context — its hotel-scoped detection steps (alerts, restock proposals, preemptive restocks) produced nothing',
        jsonb_build_object(
          'alerts_created',     v_alerts_created,
          'proposals_created',  v_proposals_created,
          'preemptive_created', v_preemptive_created,
          'discrepancies',      v_discrepancies,
          'note',               'auth_hotel_id() is NULL under pg_cron; steps 1-3 depend on it. Unattended proposing is moving to the typed restock_advisor agent.'
        ),
        '[]'::jsonb,
        'auth_hotel_id() IS NULL in the pg_cron context; the hotel-scoped steps match no rows'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'alerts_created',     v_alerts_created,
    'proposals_created',  v_proposals_created,
    'preemptive_created', v_preemptive_created,
    'discrepancies',      v_discrepancies,
    'hotel_context',      v_hotel_ctx,
    'duration_ms',        EXTRACT(milliseconds FROM clock_timestamp() - v_start)::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION run_intelligence_cycle() TO service_role;
