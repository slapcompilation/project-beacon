-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 150 — Phase D step 3: get_portfolio_signals() RPC
--
-- The per-hotel CommandHome already has aip_signal_counts (migration 141)
-- for one hotel. The org-director / owner persona needs the same view across
-- every hotel they oversee. This is that org-scoped rollup: one row per
-- hotel in the caller's org with the AIP queues + the latest agent-cycle
-- summary for that hotel.
--
-- Access: admin or owner only (the multi-hotel roles in this codebase).
-- Scoping: hotels where organization_id = auth_org_id().
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_portfolio_signals()
RETURNS TABLE (
  hotel_id              uuid,
  hotel_name            text,
  queue_pending         int,
  approvals_pending     int,
  entity_links_pending  int,
  cases_open            int,
  last_cycle_at         timestamptz,
  last_cycle_auto       int,
  last_cycle_queued     int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH latest_cycle AS (
    -- Most recent agent-cycle health event, exploded per hotel from its details->hotels array.
    SELECT
      (h ->> 'hotelId')::uuid AS hotel_id,
      coalesce((h ->> 'autoExecuted')::int, 0) AS auto,
      coalesce((h ->> 'queued')::int, 0)       AS queued,
      e.created_at                              AS ran_at,
      row_number() OVER (PARTITION BY (h ->> 'hotelId')::uuid ORDER BY e.created_at DESC) AS rn
    FROM system_health_events e
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.details -> 'hotels', '[]'::jsonb)) AS h
    WHERE e.event_type = 'intelligence_cycle_agent_run'
  )
  SELECT
    ht.id   AS hotel_id,
    ht.name AS hotel_name,
    coalesce((SELECT count(*)::int FROM proposals p
              WHERE p.hotel_id = ht.id AND p.status = 'pending'), 0)                 AS queue_pending,
    coalesce((SELECT count(*)::int FROM pending_action_approvals pa
              WHERE pa.hotel_id = ht.id AND pa.status = 'pending'), 0)               AS approvals_pending,
    coalesce((SELECT count(*)::int FROM entity_link_suggestions els
              WHERE els.hotel_id = ht.id AND els.status = 'pending'), 0)             AS entity_links_pending,
    coalesce((SELECT count(*)::int FROM cases c
              WHERE c.hotel_id = ht.id AND c.status IN ('open','in_review')), 0)     AS cases_open,
    lc.ran_at  AS last_cycle_at,
    coalesce(lc.auto, 0)    AS last_cycle_auto,
    coalesce(lc.queued, 0)  AS last_cycle_queued
  FROM hotels ht
  LEFT JOIN latest_cycle lc ON lc.hotel_id = ht.id AND lc.rn = 1
  WHERE ht.organization_id IS NOT DISTINCT FROM auth_org_id()
  ORDER BY ht.name;
END;
$$;

REVOKE ALL ON FUNCTION get_portfolio_signals() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_portfolio_signals() TO authenticated;

COMMENT ON FUNCTION get_portfolio_signals() IS
  'Per-hotel AIP rollup for the org-director / owner Portfolio Command surface. Admin/owner only. Scoped to hotels in caller''s org (or NULL-org default).';
