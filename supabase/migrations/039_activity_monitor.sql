-- Layer: Eye — Live Operations Monitor
-- get_recent_activity() returns the last N stock events with full product + user context.
-- SECURITY DEFINER is required to join auth.users (restricted schema) for actor email.
-- The realtime subscription on stock_logs drives live updates on the client side.

SET search_path = public;

CREATE OR REPLACE FUNCTION get_recent_activity(p_limit int DEFAULT 100)
RETURNS TABLE (
  log_id           uuid,
  happened_at      timestamptz,
  actor_email      text,
  variant_id       uuid,
  variant_name     text,
  product_name     text,
  sku              text,
  quantity_change  int,
  balance_after    int,
  reason           text,
  removal_category text,
  is_revert        boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.id                                    AS log_id,
    sl.timestamp                             AS happened_at,
    COALESCE(u.email, 'system')              AS actor_email,
    sl.variant_id,
    pv.name                                  AS variant_name,
    p.name                                   AS product_name,
    pv.sku,
    sl.quantity_change,
    sl.balance_after,
    sl.reason,
    sl.removal_category::text,
    sl.is_revert
  FROM  stock_logs       sl
  JOIN  product_variants pv ON pv.id = sl.variant_id
  JOIN  products         p  ON p.id  = pv.product_id
  LEFT JOIN auth.users   u  ON u.id  = sl.user_id
  WHERE sl.hotel_id = auth_hotel_id()
  ORDER BY sl.timestamp DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_recent_activity(int) TO authenticated;
