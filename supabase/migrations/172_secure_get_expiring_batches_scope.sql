-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 172 — secure get_expiring_batches() scoping (fixes 171)
--
-- get_advisors flagged the recreated function as anon-executable, and review
-- found a worse problem: 171's `coalesce(p_hotel_id, auth_hotel_id())` let an
-- AUTHENTICATED caller pass another hotel's id and read its batches — the
-- function is SECURITY DEFINER, so that bypasses RLS (cross-hotel leak).
--
-- Fix both:
--   • auth_hotel_id() WINS when present — p_hotel_id only applies on the
--     NULL-auth service-role (cron) path. Authenticated callers can never
--     override their own hotel. Web behaviour is identical.
--   • REVOKE from anon + PUBLIC — this is an authenticated/service data fn.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_expiring_batches(
  p_days_ahead integer DEFAULT 90,
  p_hotel_id   uuid    DEFAULT NULL
)
RETURNS TABLE(
  batch_id uuid, variant_id uuid, variant_name text, sku text, product_name text,
  category_name text, lot_number text, expiry_date date, quantity integer,
  unit_cost numeric, cost_at_risk numeric, received_at timestamp with time zone,
  days_until_expiry integer, status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    pb.id                                        AS batch_id,
    pb.variant_id,
    pv.name                                      AS variant_name,
    pv.sku,
    p.name                                       AS product_name,
    c.name                                       AS category_name,
    pb.lot_number,
    pb.expiry_date,
    pb.quantity,
    pv.cost                                      AS unit_cost,
    ROUND((pb.quantity * pv.cost)::numeric, 2)   AS cost_at_risk,
    pb.received_at,
    (pb.expiry_date - CURRENT_DATE)::integer     AS days_until_expiry,
    pb.status
  FROM product_batches pb
  JOIN product_variants pv ON pv.id = pb.variant_id
  JOIN products p          ON p.id  = pv.product_id
  LEFT JOIN categories c   ON c.id  = p.category_id
  -- auth_hotel_id() wins; p_hotel_id only used when auth is absent (service role).
  WHERE pb.hotel_id    = coalesce(auth_hotel_id(), p_hotel_id)
    AND pb.status      = 'active'
    AND pb.quantity    > 0
    AND pb.expiry_date IS NOT NULL
    AND pb.expiry_date <= CURRENT_DATE + p_days_ahead
  ORDER BY pb.expiry_date ASC, pb.quantity DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_expiring_batches(integer, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_expiring_batches(integer, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_expiring_batches(integer, uuid) TO service_role;
