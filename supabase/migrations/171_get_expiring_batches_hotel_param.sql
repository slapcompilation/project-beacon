-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 171 — get_expiring_batches() gains an optional p_hotel_id
--
-- The unattended intelligence-cycle edge fn runs under the service role, where
-- auth_hotel_id() is NULL — so the expiry monitor sweep can't scope itself the
-- way the web (authenticated) does. Add an explicit p_hotel_id that, when
-- supplied, overrides auth_hotel_id(). Web callers pass nothing and are
-- unchanged.
--
-- A second arg with a default would create an overload (and PostgREST
-- "could not choose best candidate" ambiguity — see migration 167). So DROP the
-- 1-arg signature first, then CREATE the single 2-arg version.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_expiring_batches(integer);

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
  WHERE pb.hotel_id    = coalesce(p_hotel_id, auth_hotel_id())
    AND pb.status      = 'active'
    AND pb.quantity    > 0
    AND pb.expiry_date IS NOT NULL
    AND pb.expiry_date <= CURRENT_DATE + p_days_ahead
  ORDER BY pb.expiry_date ASC, pb.quantity DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_expiring_batches(integer, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_expiring_batches(integer, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_expiring_batches(integer, uuid) TO service_role;
