-- Sprint 13: Location hierarchy
-- Floor → Room/Area → Storage unit (self-referencing parent_id)
-- location_id FK on product_variants
-- get_low_stock_by_location() RPC for the location report

-- ─── Locations table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   uuid        NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  parent_id  uuid        REFERENCES locations (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON locations
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON locations
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_locations_hotel ON locations (hotel_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations (parent_id);

-- ─── Add location_id to product_variants ──────────────────────────────────────

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pv_location ON product_variants (location_id);

-- ─── RPC: low-stock variants grouped by location ──────────────────────────────
-- Returns variants at or below par level, with their full location path.

CREATE OR REPLACE FUNCTION get_low_stock_by_location()
RETURNS TABLE (
  variant_id        uuid,
  product_name      text,
  variant_name      text,
  sku               text,
  current_stock     integer,
  low_stock_threshold integer,
  location_id       uuid,
  location_name     text,
  location_path     text   -- e.g. "Floor 3 > Linen Closet"
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE loc_tree AS (
    -- Base: all locations for this hotel
    SELECT
      l.id,
      l.name,
      l.parent_id,
      l.name AS path
    FROM locations l
    WHERE l.hotel_id = auth_hotel_id()

    UNION ALL

    SELECT
      l.id,
      l.name,
      l.parent_id,
      (lt.path || ' > ' || l.name)
    FROM locations l
    JOIN loc_tree lt ON lt.id = l.parent_id
    WHERE l.hotel_id = auth_hotel_id()
  ),
  -- Pick the deepest path for each location id (recursive CTE may produce duplicates)
  loc_paths AS (
    SELECT DISTINCT ON (id) id, name, path
    FROM loc_tree
    ORDER BY id, length(path) DESC
  )
  SELECT
    pv.id            AS variant_id,
    p.name           AS product_name,
    pv.name          AS variant_name,
    pv.sku,
    pv.current_stock,
    pv.low_stock_threshold,
    pv.location_id,
    lp.name          AS location_name,
    lp.path          AS location_path
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  LEFT JOIN loc_paths lp ON lp.id = pv.location_id
  WHERE p.hotel_id   = auth_hotel_id()
    AND p.enabled    = true
    AND pv.enabled   = true
    AND pv.low_stock_threshold > 0
    AND pv.current_stock <= pv.low_stock_threshold
  ORDER BY lp.path NULLS LAST, p.name;
$$;
