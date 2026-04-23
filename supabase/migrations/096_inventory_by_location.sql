-- Migration 096: Full inventory-by-location view + location reassignment
-- Layer: Floor
-- Purpose: Adds two capabilities on top of the existing locations system:
--   1. get_inventory_by_location() — returns ALL variants grouped by their
--      location (not just low-stock ones), enabling the Floor map view.
--   2. reassign_variant_location() — moves a variant to a new location with
--      hotel-isolation enforcement.

SET search_path = public;

-- ─── get_inventory_by_location() ─────────────────────────────────────────────
-- Returns every active (non-deleted) variant for the hotel, enriched with
-- its location path and PAR status. Null location_id → 'Unassigned' bucket.

CREATE OR REPLACE FUNCTION get_inventory_by_location()
RETURNS TABLE (
  variant_id          uuid,
  product_name        text,
  variant_name        text,
  sku                 text,
  current_stock       integer,
  low_stock_threshold integer,
  cost                numeric,
  total_value         numeric,   -- current_stock × cost
  location_id         uuid,
  location_name       text,
  location_path       text,      -- e.g. "Cellar > Wine Rack A"
  par_status          text       -- 'ok' | 'low' | 'critical' | 'out'
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE loc_tree AS (
    SELECT
      l.id,
      l.name,
      l.parent_id,
      l.name AS path
    FROM   locations l
    WHERE  l.hotel_id = auth_hotel_id()

    UNION ALL

    SELECT
      l.id,
      l.name,
      l.parent_id,
      lt.path || ' > ' || l.name
    FROM   locations l
    JOIN   loc_tree lt ON lt.id = l.parent_id
  )
  SELECT
    pv.id                                    AS variant_id,
    p.name                                   AS product_name,
    pv.name                                  AS variant_name,
    pv.sku,
    COALESCE(pv.current_stock, 0)            AS current_stock,
    COALESCE(pv.low_stock_threshold, 0)      AS low_stock_threshold,
    COALESCE(pv.cost, 0)                     AS cost,
    COALESCE(pv.current_stock, 0) * COALESCE(pv.cost, 0)  AS total_value,
    pv.location_id,
    lt.name                                  AS location_name,
    lt.path                                  AS location_path,
    CASE
      WHEN COALESCE(pv.current_stock, 0) = 0                                         THEN 'out'
      WHEN COALESCE(pv.low_stock_threshold, 0) > 0
           AND pv.current_stock <= pv.low_stock_threshold / 2                        THEN 'critical'
      WHEN COALESCE(pv.low_stock_threshold, 0) > 0
           AND pv.current_stock <= pv.low_stock_threshold                            THEN 'low'
      ELSE 'ok'
    END                                      AS par_status
  FROM   product_variants pv
  JOIN   products p  ON p.id = pv.product_id
  LEFT   JOIN loc_tree lt ON lt.id = pv.location_id
  WHERE  p.hotel_id  = auth_hotel_id()
    AND  COALESCE(pv.enabled, true) = true
  ORDER  BY
    COALESCE(lt.path, 'Unassigned'),
    product_name,
    variant_name
$$;

GRANT EXECUTE ON FUNCTION get_inventory_by_location() TO authenticated;

-- ─── reassign_variant_location() ─────────────────────────────────────────────
-- Updates the location_id on a product_variant, enforcing hotel isolation.
-- Pass NULL as p_location_id to clear the location (mark as Unassigned).

CREATE OR REPLACE FUNCTION reassign_variant_location(
  p_variant_id  uuid,
  p_location_id uuid    -- NULL to unassign
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_variants pv
  SET    location_id = p_location_id
  FROM   products p
  WHERE  pv.id          = p_variant_id
    AND  p.id           = pv.product_id
    AND  p.hotel_id     = auth_hotel_id();
END;
$$;

GRANT EXECUTE ON FUNCTION reassign_variant_location(uuid, uuid) TO authenticated;
