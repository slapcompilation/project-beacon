-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 174 — get_portfolio_signals() also returns hotel coordinates
--
-- The scope-aware Home (org scope) wants a portfolio map: a pin per property.
-- Sister-hotel rows aren't readable via the hotels table (RLS = own hotel only),
-- so coords must come through this SECURITY DEFINER rollup like the rest of the
-- portfolio signal. Coordinates live in hotels.config jsonb ({lat,lng}) — no new
-- columns. Adding RETURNS TABLE columns changes the return type, so DROP+CREATE.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_portfolio_signals();

CREATE OR REPLACE FUNCTION public.get_portfolio_signals()
RETURNS TABLE(
  hotel_id uuid, hotel_name text,
  queue_pending integer, approvals_pending integer, entity_links_pending integer, cases_open integer,
  last_cycle_at timestamp with time zone, last_cycle_auto integer, last_cycle_queued integer,
  lat numeric, lng numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := auth_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH latest_cycle AS (
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
    coalesce(lc.queued, 0)  AS last_cycle_queued,
    (ht.config ->> 'lat')::numeric AS lat,
    (ht.config ->> 'lng')::numeric AS lng
  FROM hotels ht
  LEFT JOIN latest_cycle lc ON lc.hotel_id = ht.id AND lc.rn = 1
  WHERE ht.organization_id IS NOT DISTINCT FROM auth_org_id()
  ORDER BY ht.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_portfolio_signals() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_portfolio_signals() TO authenticated;
