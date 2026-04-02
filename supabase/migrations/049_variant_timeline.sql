-- Layer: Flow — per-variant stock narrative RPC
-- Returns every stock log for a variant enriched with user, product, and cost data.
-- SECURITY DEFINER to access auth.users; hotel isolation enforced via app_metadata.

CREATE OR REPLACE FUNCTION get_variant_timeline(
  p_variant_id UUID,
  p_days       INT DEFAULT 90
)
RETURNS TABLE (
  log_id           UUID,
  happened_at      TIMESTAMPTZ,
  actor_email      TEXT,
  actor_id         UUID,
  variant_name     TEXT,
  product_name     TEXT,
  sku              TEXT,
  unit_cost        NUMERIC,
  par_level        INT,
  quantity_change  INT,
  balance_after    INT,
  reason           TEXT,
  removal_category TEXT,
  is_revert        BOOLEAN,
  revert_of        UUID,
  was_offline      BOOLEAN,
  photo_url        TEXT,
  cost_impact      NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.id,
    sl.timestamp,
    u.email::TEXT,
    sl.user_id,
    pv.name,
    p.name,
    pv.sku,
    COALESCE(pv.cost, 0)::NUMERIC,
    COALESCE(pv.low_stock_threshold, 0)::INT,
    sl.quantity_change,
    sl.balance_after,
    sl.reason,
    sl.removal_category::TEXT,
    sl.is_revert,
    sl.revert_of,
    sl.was_offline,
    sl.photo_url,
    (sl.quantity_change * COALESCE(pv.cost, 0))::NUMERIC
  FROM   stock_logs        sl
  JOIN   product_variants  pv ON pv.id = sl.variant_id
  JOIN   products          p  ON p.id  = pv.product_id
  LEFT JOIN auth.users     u  ON u.id  = sl.user_id
  WHERE  sl.variant_id = p_variant_id
    AND  p.hotel_id = (
           SELECT (raw_app_meta_data->>'hotel_id')::UUID
           FROM   auth.users
           WHERE  id = auth.uid()
         )
    AND  sl.timestamp >= NOW() - (p_days || ' days')::INTERVAL
  ORDER  BY sl.timestamp ASC;
$$;

GRANT EXECUTE ON FUNCTION get_variant_timeline(UUID, INT) TO authenticated;
