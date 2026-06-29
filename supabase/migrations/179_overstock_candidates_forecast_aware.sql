-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 179 — get_overstock_candidates: forecast-aware overstock scan
--
-- The cron's overstock pre-filter used `current_stock > low_stock_threshold × factor`,
-- but the overstock_rebalancer agent's real test is consumption-based
-- (`stock ≥ projected_30d × 2`). When par ≠ ~30-day burn the two disagree:
--   - over-select  → the agent runs and silently rejects (invisible no-ops), and
--   - under-select → a high-par item holding 8 months of cover is never scanned.
-- This aligns the pre-filter with the agent: candidates are variants with recent
-- consumption that hold ≥ factor × their trailing-30-day burn. consumed_30d ≤ the
-- agent's span-based projection, so this is a clean SUPERSET (never misses an
-- agent-acceptable item); the agent still makes the precise call.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_overstock_candidates(
  p_hotel_id uuid,
  p_factor   numeric DEFAULT 2
)
RETURNS TABLE (
  variant_id   uuid,
  display_name text,
  current_stock integer,
  consumed_30d  integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    v.id,
    CASE WHEN v.name <> 'Standard' THEN pr.name || ' — ' || v.name ELSE pr.name END,
    v.current_stock,
    coalesce(c.consumed, 0)::int
  FROM product_variants v
  JOIN products pr ON pr.id = v.product_id
  LEFT JOIN LATERAL (
    SELECT -sum(s.quantity_change) AS consumed
    FROM stock_logs s
    WHERE s.variant_id = v.id
      AND s.quantity_change < 0
      AND s.timestamp > now() - interval '30 days'
  ) c ON true
  WHERE pr.hotel_id = p_hotel_id
    AND v.enabled
    AND v.low_stock_threshold > 0
    AND coalesce(c.consumed, 0) > 0
    AND v.current_stock >= coalesce(c.consumed, 0) * p_factor;
$function$;

-- self-apply: definer fn must not be anon-executable (security_invariants.sql).
-- New functions carry a default PUBLIC grant, so REVOKE must target PUBLIC, not
-- just anon (lesson from migrations 176/177).
REVOKE EXECUTE ON FUNCTION public.get_overstock_candidates(uuid, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_overstock_candidates(uuid, numeric) TO authenticated, service_role;
