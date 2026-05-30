-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 145 — get_agent_cycle_history() RPC
--
-- Surfaces recent agent-cron runs for the Mind Command home. system_health_events
-- is RLS-locked (USING false) so direct SELECT is impossible from any role; this
-- mirrors the gating pattern of get_cron_health_summary() (migration 116).
--
-- Returns the N most recent intelligence_cycle_agent_run events written by the
-- intelligence-cycle edge function each time it fires (manual or cron).
--
-- Access: admin or owner only.
--
-- Returned shape:
--   {
--     "evaluated_at": timestamptz,
--     "runs": [
--       { "ran_at":        timestamptz,
--         "auto_executed": int,
--         "queued":        int,
--         "hotels":        [{ "hotelId", "scanned", "autoExecuted", "queued" }, ...] }
--     ]
--   }
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_agent_cycle_history(p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth_role();
  v_runs jsonb;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_runs
  FROM (
    SELECT jsonb_build_object(
      'ran_at',        created_at,
      'auto_executed', coalesce((details->>'auto_executed')::int, 0),
      'queued',        coalesce((details->>'queued')::int, 0),
      'hotels',        coalesce(details->'hotels', '[]'::jsonb)
    ) AS row
    FROM system_health_events
    WHERE event_type = 'intelligence_cycle_agent_run'
    ORDER BY created_at DESC
    LIMIT greatest(1, least(p_limit, 50))
  ) ordered;

  RETURN jsonb_build_object(
    'evaluated_at', now(),
    'runs',         v_runs
  );
END;
$$;

REVOKE ALL ON FUNCTION get_agent_cycle_history(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_agent_cycle_history(int) TO authenticated;

COMMENT ON FUNCTION get_agent_cycle_history(int) IS
  'Recent intelligence_cycle_agent_run events for the Mind Command home. Admin/owner only.';
