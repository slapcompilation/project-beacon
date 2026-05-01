-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 115 — Cron health monitor (self-observability layer)
--
-- Layer: Eye (intelligence on our own infrastructure)
-- Scope: organization (system-wide, no hotel scope)
-- Cadence: every 5 minutes
--
-- Why this exists
-- ───────────────
-- Postmortem of the 2026-04-17 → 2026-04-30 cron incident:
--   • beacon-intelligence-cycle (jobid 4) failed 651 times over 13 days with
--     `return_message = 'job startup timeout', job_pid = null`.
--   • Two latent bugs landed near scheduling time and reinforced each other:
--       (1) restock_requests.updated_at missing — every cycle aborted with
--           42703 (fixed in migration 113).
--       (2) auth helpers without SECURITY DEFINER — RLS recursion on app
--           queries piled up connections; pg_cron workers couldn't start
--           (fixed in migration 114).
--   • The system had zero observability on cron health. Discovery was manual
--     (`SELECT … FROM cron.job_run_details`), 13 days late.
--
-- This migration installs the prevention deliverable required by CLAUDE.md
-- "Self-Apply: Intelligence Everywhere Includes Our Own Code":
--   • A typed event log (`system_health_events`) — append-only, audit-trail
--     parity with every other Beacon mutation.
--   • A deterministic Tier-1 monitor (`monitor_cron_health`) that scans
--     `cron.job_run_details` and emits typed events with confidence_basis +
--     nodes_considered, exactly like the LLM-tool contract requires.
--   • A 5-minute cron that runs the monitor. Its failure is itself observable
--     by the same machinery it produces — meta-coverage.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. system_health_events ─────────────────────────────────────────────────────
--    Append-only log of infrastructure events. NOT scoped to a hotel — these
--    are operator/SRE concerns, not operator-facing notifications.
CREATE TABLE IF NOT EXISTS system_health_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          text        NOT NULL,
  severity            text        NOT NULL CHECK (severity IN ('info','warn','critical')),
  source              text        NOT NULL,
  summary             text        NOT NULL,
  details             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  nodes_considered    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  confidence_basis    text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  acknowledged_at     timestamptz,
  acknowledged_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_note   text
);

COMMENT ON TABLE system_health_events IS
  'Append-only infrastructure event log. Per CLAUDE.md self-apply: every '
  'failure mode must carry derived context (confidence_basis + nodes_considered).';

CREATE INDEX IF NOT EXISTS idx_she_open_critical
  ON system_health_events (created_at DESC)
  WHERE acknowledged_at IS NULL AND severity = 'critical';

CREATE INDEX IF NOT EXISTS idx_she_event_type_recent
  ON system_health_events (event_type, created_at DESC);

-- RLS: service role + postgres only. No operator surface yet — when one is
-- added it will go through a SECURITY DEFINER RPC, not direct table access.
ALTER TABLE system_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS she_no_anon ON system_health_events;
CREATE POLICY she_no_anon ON system_health_events
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 2. monitor_cron_health() ────────────────────────────────────────────────────
-- Tier-1 deterministic agent. Emits events when:
--   • a job has ≥ 2 consecutive failures and we haven't already opened a
--     'cron_failure_streak' event for this run pattern (dedup via 1h window),
--   • a previously-failing job has ≥ 2 consecutive successes and a recent
--     unacknowledged streak event exists (recovery),
--   • a job's failure rate over the last hour is ≥ 50% (degraded).
-- Returns a jsonb summary so cron logs carry the verdict in `return_message`.
CREATE OR REPLACE FUNCTION monitor_cron_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now            timestamptz := now();
  v_window_start   timestamptz := v_now - interval '1 hour';
  v_events_emitted int := 0;
  v_jobs_checked   int := 0;
  v_summary        jsonb := '[]'::jsonb;
  rec              record;
BEGIN
  FOR rec IN
    SELECT
      j.jobid,
      j.jobname,
      j.schedule,
      (
        SELECT count(*) FROM cron.job_run_details d
        WHERE d.jobid = j.jobid AND d.start_time >= v_window_start
      ) AS runs_1h,
      (
        SELECT count(*) FROM cron.job_run_details d
        WHERE d.jobid = j.jobid AND d.start_time >= v_window_start
          AND d.status = 'failed'
      ) AS failures_1h,
      (
        SELECT array_agg(d.status ORDER BY d.start_time DESC)
        FROM (
          SELECT status, start_time FROM cron.job_run_details
          WHERE jobid = j.jobid
          ORDER BY start_time DESC
          LIMIT 4
        ) d
      ) AS last_4_statuses,
      (
        SELECT array_agg(d.return_message ORDER BY d.start_time DESC)
        FROM (
          SELECT return_message, start_time FROM cron.job_run_details
          WHERE jobid = j.jobid AND status = 'failed'
          ORDER BY start_time DESC
          LIMIT 3
        ) d
      ) AS recent_failure_messages
    FROM cron.job j
    WHERE j.active
  LOOP
    v_jobs_checked := v_jobs_checked + 1;

    DECLARE
      v_consec_fail    int := 0;
      v_consec_success int := 0;
      v_failure_rate   numeric := 0;
      v_open_streak    uuid;
      v_nodes          jsonb;
    BEGIN
      -- consecutive failure / success streak from the tail
      IF rec.last_4_statuses IS NOT NULL THEN
        FOR i IN 1..array_length(rec.last_4_statuses, 1) LOOP
          EXIT WHEN rec.last_4_statuses[i] <> 'failed';
          v_consec_fail := v_consec_fail + 1;
        END LOOP;
        FOR i IN 1..array_length(rec.last_4_statuses, 1) LOOP
          EXIT WHEN rec.last_4_statuses[i] <> 'succeeded';
          v_consec_success := v_consec_success + 1;
        END LOOP;
      END IF;

      IF rec.runs_1h > 0 THEN
        v_failure_rate := rec.failures_1h::numeric / rec.runs_1h;
      END IF;

      v_nodes := jsonb_build_array(jsonb_build_object(
        'type',     'cron_job',
        'jobid',    rec.jobid,
        'jobname',  rec.jobname,
        'schedule', rec.schedule
      ));

      -- (a) failure streak ≥ 2 → open a critical event if none open in last 1h
      IF v_consec_fail >= 2 THEN
        SELECT id INTO v_open_streak
        FROM system_health_events
        WHERE event_type = 'cron_failure_streak'
          AND details->>'jobid' = rec.jobid::text
          AND acknowledged_at IS NULL
          AND created_at >= v_window_start
        LIMIT 1;

        IF v_open_streak IS NULL THEN
          INSERT INTO system_health_events (
            event_type, severity, source, summary, details,
            nodes_considered, confidence_basis
          ) VALUES (
            'cron_failure_streak',
            'critical',
            'monitor_cron_health',
            format('Cron job %s has %s consecutive failures',
                   rec.jobname, v_consec_fail),
            jsonb_build_object(
              'jobid',                    rec.jobid,
              'jobname',                  rec.jobname,
              'schedule',                 rec.schedule,
              'consecutive_failures',     v_consec_fail,
              'failure_rate_1h',          round(v_failure_rate, 3),
              'runs_1h',                  rec.runs_1h,
              'failures_1h',              rec.failures_1h,
              'recent_failure_messages',  rec.recent_failure_messages
            ),
            v_nodes,
            format('last %s consecutive runs failed; %s/%s failures in last 1h',
                   v_consec_fail, rec.failures_1h, rec.runs_1h)
          );
          v_events_emitted := v_events_emitted + 1;
        END IF;
      END IF;

      -- (b) recovery: ≥ 2 successes after a recent open streak
      IF v_consec_success >= 2 THEN
        SELECT id INTO v_open_streak
        FROM system_health_events
        WHERE event_type = 'cron_failure_streak'
          AND details->>'jobid' = rec.jobid::text
          AND acknowledged_at IS NULL
          AND created_at >= v_now - interval '24 hours'
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_open_streak IS NOT NULL THEN
          UPDATE system_health_events
          SET acknowledged_at  = v_now,
              acknowledged_note = format(
                'Auto-resolved: %s consecutive successes since recovery',
                v_consec_success
              )
          WHERE id = v_open_streak;

          INSERT INTO system_health_events (
            event_type, severity, source, summary, details,
            nodes_considered, confidence_basis
          ) VALUES (
            'cron_recovery',
            'info',
            'monitor_cron_health',
            format('Cron job %s recovered after streak %s',
                   rec.jobname, v_open_streak),
            jsonb_build_object(
              'jobid',                rec.jobid,
              'jobname',              rec.jobname,
              'consecutive_successes', v_consec_success,
              'resolved_event_id',    v_open_streak
            ),
            v_nodes,
            format('last %s consecutive runs succeeded after open streak event',
                   v_consec_success)
          );
          v_events_emitted := v_events_emitted + 1;
        END IF;
      END IF;

      -- (c) degraded: failure rate ≥ 50% over 1h with at least 4 runs
      IF rec.runs_1h >= 4 AND v_failure_rate >= 0.5 AND v_consec_fail < 2 THEN
        IF NOT EXISTS (
          SELECT 1 FROM system_health_events
          WHERE event_type = 'cron_high_failure_rate'
            AND details->>'jobid' = rec.jobid::text
            AND acknowledged_at IS NULL
            AND created_at >= v_window_start
        ) THEN
          INSERT INTO system_health_events (
            event_type, severity, source, summary, details,
            nodes_considered, confidence_basis
          ) VALUES (
            'cron_high_failure_rate',
            'warn',
            'monitor_cron_health',
            format('Cron job %s degraded: %s%% failure rate over 1h',
                   rec.jobname, round(v_failure_rate * 100)),
            jsonb_build_object(
              'jobid',           rec.jobid,
              'jobname',         rec.jobname,
              'failure_rate_1h', round(v_failure_rate, 3),
              'runs_1h',         rec.runs_1h,
              'failures_1h',     rec.failures_1h
            ),
            v_nodes,
            format('%s/%s runs failed over last 1h (≥ 50%% threshold)',
                   rec.failures_1h, rec.runs_1h)
          );
          v_events_emitted := v_events_emitted + 1;
        END IF;
      END IF;

      v_summary := v_summary || jsonb_build_object(
        'jobid',                rec.jobid,
        'jobname',              rec.jobname,
        'consecutive_failures', v_consec_fail,
        'consecutive_successes', v_consec_success,
        'failure_rate_1h',      round(v_failure_rate, 3),
        'runs_1h',              rec.runs_1h
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'jobs_checked',    v_jobs_checked,
    'events_emitted',  v_events_emitted,
    'window',          '1 hour',
    'evaluated_at',    v_now,
    'per_job',         v_summary
  );
END;
$$;

COMMENT ON FUNCTION monitor_cron_health IS
  'Tier-1 deterministic monitor. Cadence: */5 * * * *. Scope: organization. '
  'Reads cron.job_run_details, emits typed system_health_events with '
  'confidence_basis. No mutations beyond the event log + acknowledgement.';

-- 2b. Lock down REST exposure ─────────────────────────────────────────────────
-- get_advisors flagged this WARN: SECURITY DEFINER + public EXECUTE means
-- anon/authenticated could call /rest/v1/rpc/monitor_cron_health and read
-- cron.job_run_details indirectly. The function is an SRE/infra tool, not an
-- operator surface. pg_cron runs jobs as `postgres` (BYPASSRLS, owns the fn),
-- so the schedule below still works.
REVOKE EXECUTE ON FUNCTION public.monitor_cron_health() FROM PUBLIC, anon, authenticated;

-- 3. Schedule the monitor every 5 minutes ────────────────────────────────────
DO $$
DECLARE
  v_existing int;
BEGIN
  SELECT count(*) INTO v_existing
  FROM cron.job WHERE jobname = 'beacon-cron-health-monitor';

  IF v_existing = 0 THEN
    PERFORM cron.schedule(
      'beacon-cron-health-monitor',
      '*/5 * * * *',
      $cmd$ SELECT monitor_cron_health() $cmd$
    );
  END IF;
END $$;

COMMIT;

-- ─── Verification ────────────────────────────────────────────────────────────
-- Run after applying:
--
--   SELECT monitor_cron_health();
--   -- → jsonb with one entry per active job, events_emitted should be 0 today
--
--   SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'beacon-cron-health-monitor';
--   -- → schedule = '*/5 * * * *'
--
--   -- Open critical events the operator/SRE should action
--   SELECT created_at, summary, confidence_basis, details
--   FROM system_health_events
--   WHERE acknowledged_at IS NULL AND severity = 'critical'
--   ORDER BY created_at DESC;
--
-- A future cron failure streak (≥ 2 consecutive failures in any active job)
-- will land here within 5 minutes — not 13 days.
