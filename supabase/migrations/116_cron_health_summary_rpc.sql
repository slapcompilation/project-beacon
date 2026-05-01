-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 116 — get_cron_health_summary() RPC
--
-- Layer: Eye (intelligence on our own infrastructure) + operator surface
-- Scope: organization (system-wide)
--
-- Why: migration 115 introduced `system_health_events` + `monitor_cron_health`,
-- but the table is RLS-locked (no anon, no auth) and the monitor function
-- has EXECUTE revoked from anon/authenticated. That leaves the data invisible
-- to operators. This migration adds a single READ-ONLY surface RPC that the
-- Settings → Autonomous Operations panel can call.
--
-- Access: admin or owner only (enforced inside the function via auth_role()).
-- Anyone else gets an error — we don't want to leak infrastructure status to
-- limited_access or team_member roles.
--
-- Returned shape:
--   {
--     "evaluated_at":  timestamptz,
--     "open_critical": int,           -- unacknowledged critical events
--     "jobs": [
--       { "jobname": "beacon-intelligence-cycle",
--         "schedule": "*/15 * * * *",
--         "last_status": "succeeded" | "failed" | null,
--         "last_run_at": timestamptz | null,
--         "consecutive_failures": int,
--         "consecutive_successes": int,
--         "failure_rate_24h": numeric,
--         "runs_24h": int }
--     ]
--   }
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_cron_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role    text := auth_role();
  v_now     timestamptz := now();
  v_window  timestamptz := v_now - interval '24 hours';
  v_jobs    jsonb := '[]'::jsonb;
  v_open    int := 0;
  rec       record;
BEGIN
  -- Role gate. Only admin / owner can read infra health.
  IF v_role IS NULL OR v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role'
      USING ERRCODE = '42501';
  END IF;

  -- Open critical events (unacknowledged)
  SELECT count(*) INTO v_open
  FROM system_health_events
  WHERE acknowledged_at IS NULL AND severity = 'critical';

  -- Per-job rollup
  FOR rec IN
    SELECT
      j.jobid,
      j.jobname,
      j.schedule,
      (
        SELECT count(*) FROM cron.job_run_details d
        WHERE d.jobid = j.jobid AND d.start_time >= v_window
      ) AS runs_24h,
      (
        SELECT count(*) FROM cron.job_run_details d
        WHERE d.jobid = j.jobid AND d.start_time >= v_window
          AND d.status = 'failed'
      ) AS failures_24h,
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
        SELECT row_to_json(t) FROM (
          SELECT status, start_time
          FROM cron.job_run_details
          WHERE jobid = j.jobid
          ORDER BY start_time DESC
          LIMIT 1
        ) t
      ) AS last_run
    FROM cron.job j
    WHERE j.active
    ORDER BY j.jobid
  LOOP
    DECLARE
      v_consec_fail    int := 0;
      v_consec_success int := 0;
      v_failure_rate   numeric := 0;
    BEGIN
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

      IF rec.runs_24h > 0 THEN
        v_failure_rate := rec.failures_24h::numeric / rec.runs_24h;
      END IF;

      v_jobs := v_jobs || jsonb_build_object(
        'jobname',                rec.jobname,
        'schedule',               rec.schedule,
        'last_status',            rec.last_run->>'status',
        'last_run_at',            rec.last_run->>'start_time',
        'consecutive_failures',   v_consec_fail,
        'consecutive_successes',  v_consec_success,
        'failure_rate_24h',       round(v_failure_rate, 3),
        'runs_24h',               rec.runs_24h
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'evaluated_at',  v_now,
    'open_critical', v_open,
    'jobs',          v_jobs
  );
END;
$$;

COMMENT ON FUNCTION get_cron_health_summary IS
  'Read-only summary of pg_cron job health for the operator-facing Settings '
  'panel. Admin/owner only (enforced via auth_role()). Per CLAUDE.md '
  'self-apply: surfaces system observability data to the operator.';

-- Tighten EXECUTE — only authenticated users (the function role-gates internally)
REVOKE EXECUTE ON FUNCTION public.get_cron_health_summary() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_cron_health_summary() TO authenticated;

-- ─── Verification ────────────────────────────────────────────────────────────
-- As an admin/owner JWT:
--   SELECT get_cron_health_summary();
-- As a team_member or limited_access JWT:
--   SELECT get_cron_health_summary();   -- should raise 42501
