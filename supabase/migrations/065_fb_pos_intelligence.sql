-- Migration 065: F&B + POS Intelligence
-- Layer: Floor (ingestion) · Flow (immutable logs) · Eye (COGS + variance) · Mind (menu setup)
-- Extends the Reality Graph: menu_item → "contains" → variant
-- Every POS sale auto-decrements stock via the existing immutable log pipeline.

SET search_path = public;

-- ─── 1. source column on stock_logs ──────────────────────────────────────────
-- Null for pre-existing rows (manual / scan). 'pos' for POS-auto-generated rows.
-- Used by get_pos_variance() to separate POS-implied from total consumption.

ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_stock_logs_source
  ON stock_logs (hotel_id, source)
  WHERE source IS NOT NULL;

-- ─── 2. menu_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS menu_items (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name        text         NOT NULL,
  category    text,
  sell_price  numeric(10,2),     -- optional; enables margin calculation
  is_active   boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mi_all" ON menu_items FOR ALL USING (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_menu_items_hotel
  ON menu_items (hotel_id, is_active);

COMMENT ON TABLE menu_items IS
  'F&B menu items. Each item is a Reality Graph node. '
  'Linked to stock variants via menu_item_ingredients ("contains" edges).';

-- ─── 3. menu_item_ingredients ─────────────────────────────────────────────────
-- The Reality Graph "contains" edge made explicit.
-- Defines how much of each variant is consumed per unit sold.

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid         NOT NULL REFERENCES menu_items(id)       ON DELETE CASCADE,
  variant_id    uuid         NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  qty_per_serve numeric(10,4) NOT NULL CHECK (qty_per_serve > 0),
  unit          text,              -- display unit label e.g. 'ml', 'g', 'piece'
  created_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, variant_id)
);

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

-- Access via parent menu_item's hotel_id
CREATE POLICY "mii_all" ON menu_item_ingredients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.id = menu_item_id AND mi.hotel_id = auth_hotel_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.id = menu_item_id AND mi.hotel_id = auth_hotel_id()
  ));

CREATE INDEX IF NOT EXISTS idx_mii_menu_item
  ON menu_item_ingredients (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mii_variant
  ON menu_item_ingredients (variant_id);

-- ─── 4. pos_connections ───────────────────────────────────────────────────────
-- Identical pattern to pms_connections. Drives the POS health badge in the UI.

CREATE TABLE IF NOT EXISTS pos_connections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source_system    text        NOT NULL,
  last_received_at timestamptz,
  total_events     bigint      NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, source_system)
);

ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_conn_select" ON pos_connections
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_pos_conn_hotel ON pos_connections (hotel_id);

-- ─── 5. pos_sales ─────────────────────────────────────────────────────────────
-- Immutable log of POS events. Analogous to stock_logs.

CREATE TABLE IF NOT EXISTS pos_sales (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              uuid         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  menu_item_id          uuid         NOT NULL REFERENCES menu_items(id),
  quantity_sold         numeric(10,4) NOT NULL CHECK (quantity_sold > 0),
  sale_time             timestamptz  NOT NULL,
  source_system         text         NOT NULL DEFAULT 'manual',
  external_reference_id text,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON pos_sales FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_pos_sales_hotel_time
  ON pos_sales (hotel_id, sale_time DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_menu_item
  ON pos_sales (hotel_id, menu_item_id, sale_time DESC);

-- ─── 6. pos_variance notification type ────────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'low_stock', 'expiry', 'approval', 'system',
    'predicted_outage', 'waste_alert',
    'consumption_spike', 'price_drift', 'pos_variance'
  ));

-- ─── 7. get_pos_health() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pos_health()
RETURNS TABLE (
  source_system    text,
  last_received_at timestamptz,
  hours_since_last numeric,
  status           text,
  total_events     bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    source_system,
    last_received_at,
    CASE
      WHEN last_received_at IS NULL THEN NULL
      ELSE ROUND(EXTRACT(EPOCH FROM (now() - last_received_at)) / 3600.0, 1)
    END                                                              AS hours_since_last,
    CASE
      WHEN last_received_at IS NULL                        THEN 'never_connected'
      WHEN now() - last_received_at < interval '2 hours'  THEN 'connected'
      WHEN now() - last_received_at < interval '24 hours' THEN 'warning'
      ELSE                                                      'disconnected'
    END                                                              AS status,
    total_events
  FROM  pos_connections
  WHERE hotel_id = auth_hotel_id()
  ORDER BY source_system;
$$;

GRANT EXECUTE ON FUNCTION get_pos_health() TO authenticated;

-- ─── 8. ingest_pos_sale() ─────────────────────────────────────────────────────
-- SECURITY DEFINER — called by service role from the ingest-pos Edge Function.
-- For each sale event:
--   1. Inserts pos_sales row
--   2. For each ingredient: decrements variant stock + appends stock_log
--   3. Creates Reality Graph edges: pos_sale --causes--> stock_log
--   4. Bumps pos_connections health row

CREATE OR REPLACE FUNCTION ingest_pos_sale(
  p_hotel_id              uuid,
  p_menu_item_id          uuid,
  p_quantity_sold         numeric,
  p_sale_time             timestamptz,
  p_source_system         text    DEFAULT 'manual',
  p_external_reference_id text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_sale_id       uuid;
  v_menu_name     text;
  v_log_id        uuid;
  rec             RECORD;
  v_qty_remove    integer;
  v_new_stock     integer;
BEGIN
  -- Fetch menu item name once
  SELECT name INTO v_menu_name FROM menu_items
  WHERE id = p_menu_item_id AND hotel_id = p_hotel_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_item % not found for hotel %', p_menu_item_id, p_hotel_id;
  END IF;

  -- Insert pos_sale (immutable)
  INSERT INTO pos_sales (hotel_id, menu_item_id, quantity_sold, sale_time, source_system, external_reference_id)
  VALUES (p_hotel_id, p_menu_item_id, p_quantity_sold, p_sale_time, p_source_system, p_external_reference_id)
  RETURNING id INTO v_sale_id;

  -- For each ingredient, decrement stock and append an immutable stock_log
  FOR rec IN
    SELECT mii.variant_id, mii.qty_per_serve
    FROM   menu_item_ingredients mii
    WHERE  mii.menu_item_id = p_menu_item_id
  LOOP
    v_qty_remove := -GREATEST(ROUND(p_quantity_sold * rec.qty_per_serve), 1);

    -- Lock and update variant stock
    UPDATE product_variants
    SET    current_stock = current_stock + v_qty_remove   -- v_qty_remove is negative
    WHERE  id = rec.variant_id
    RETURNING current_stock INTO v_new_stock;

    -- Append immutable stock log (sentinel user = all-zeros UUID for POS system)
    INSERT INTO stock_logs (
      hotel_id, variant_id, user_id,
      quantity_change, balance_after,
      reason, source
    ) VALUES (
      p_hotel_id, rec.variant_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_qty_remove, v_new_stock,
      'POS: ' || v_menu_name,
      'pos'
    )
    RETURNING id INTO v_log_id;

    -- Reality Graph edge: pos_sale --causes--> stock_log
    INSERT INTO relationship_edges (hotel_id, source_type, source_id, edge_type, target_type, target_id, metadata)
    VALUES (
      p_hotel_id,
      'pos_sale',  v_sale_id,
      'causes',
      'stock_log', v_log_id,
      jsonb_build_object('menu_item', v_menu_name, 'qty_sold', p_quantity_sold, 'source_system', p_source_system)
    )
    ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
  END LOOP;

  -- Bump POS connection health
  INSERT INTO pos_connections (hotel_id, source_system, last_received_at, total_events)
  VALUES (p_hotel_id, p_source_system, now(), 1)
  ON CONFLICT (hotel_id, source_system) DO UPDATE
    SET last_received_at = now(),
        total_events     = pos_connections.total_events + 1;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ingest_pos_sale(uuid, uuid, numeric, timestamptz, text, text)
  TO service_role;

-- ─── 9. get_cogs_by_item(p_days int) ─────────────────────────────────────────
-- For each menu item sold in the window: total qty sold, cost per serve
-- (using variant_cost_history at sale time), total COGS, and margin if sell_price set.

CREATE OR REPLACE FUNCTION get_cogs_by_item(p_days int DEFAULT 30)
RETURNS TABLE (
  menu_item_id        uuid,
  name                text,
  category            text,
  sell_price          numeric,
  qty_sold            numeric,
  avg_cost_per_serve  numeric,
  total_ingredient_cost numeric,
  margin_pct          numeric   -- null when sell_price not set
)
LANGUAGE sql STABLE AS $$
  WITH window_sales AS (
    SELECT ps.id AS sale_id, ps.menu_item_id, ps.quantity_sold, ps.sale_time
    FROM   pos_sales ps
    WHERE  ps.hotel_id     = auth_hotel_id()
      AND  ps.sale_time   >= now() - (p_days * interval '1 day')
  ),
  -- Cost at sale time: latest variant_cost_history record at or before sale_time.
  -- Falls back to product_variants.cost if no history exists.
  ingredient_costs AS (
    SELECT DISTINCT ON (ws.sale_id, mii.variant_id)
      ws.sale_id,
      ws.menu_item_id,
      ws.quantity_sold,
      mii.qty_per_serve,
      COALESCE(vch.cost, pv.cost, 0)  AS unit_cost
    FROM   window_sales ws
    JOIN   menu_item_ingredients mii ON mii.menu_item_id = ws.menu_item_id
    JOIN   product_variants pv       ON pv.id = mii.variant_id
    LEFT JOIN variant_cost_history vch
      ON  vch.variant_id   = mii.variant_id
      AND vch.hotel_id     = auth_hotel_id()
      AND vch.effective_from <= ws.sale_time
    ORDER  BY ws.sale_id, mii.variant_id, vch.effective_from DESC NULLS LAST
  ),
  -- Cost per sale: sum ingredient cost across all ingredients for one serve
  cost_per_sale AS (
    SELECT
      sale_id,
      menu_item_id,
      quantity_sold,
      SUM(unit_cost * qty_per_serve) AS cost_per_serve
    FROM   ingredient_costs
    GROUP  BY sale_id, menu_item_id, quantity_sold
  ),
  aggregated AS (
    SELECT
      menu_item_id,
      SUM(quantity_sold)                                   AS qty_sold,
      AVG(cost_per_serve)                                  AS avg_cost_per_serve,
      SUM(cost_per_serve * quantity_sold)                  AS total_ingredient_cost
    FROM   cost_per_sale
    GROUP  BY menu_item_id
  )
  SELECT
    mi.id                                                  AS menu_item_id,
    mi.name,
    mi.category,
    mi.sell_price,
    COALESCE(a.qty_sold, 0)                                AS qty_sold,
    ROUND(COALESCE(a.avg_cost_per_serve, 0), 4)           AS avg_cost_per_serve,
    ROUND(COALESCE(a.total_ingredient_cost, 0), 2)        AS total_ingredient_cost,
    CASE
      WHEN mi.sell_price IS NOT NULL AND mi.sell_price > 0 AND a.avg_cost_per_serve IS NOT NULL
      THEN ROUND((1 - a.avg_cost_per_serve / mi.sell_price) * 100, 1)
    END                                                    AS margin_pct
  FROM   menu_items mi
  LEFT JOIN aggregated a ON a.menu_item_id = mi.id
  WHERE  mi.hotel_id = auth_hotel_id()
    AND  mi.is_active
  ORDER  BY total_ingredient_cost DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_cogs_by_item(int) TO authenticated;

-- ─── 10. get_pos_variance(p_days, p_threshold_pct) ───────────────────────────
-- Compares POS-implied consumption (stock_logs.source = 'pos') to total actual
-- removals for variants used in menu items.
-- variance_qty = actual - pos_implied = unexplained consumption (theft/waste/miscounting).

CREATE OR REPLACE FUNCTION get_pos_variance(
  p_days          int     DEFAULT 30,
  p_threshold_pct numeric DEFAULT 15
)
RETURNS TABLE (
  variant_id      uuid,
  product_name    text,
  variant_name    text,
  sku             text,
  pos_implied_qty numeric,
  actual_qty      numeric,
  variance_qty    numeric,
  variance_pct    numeric   -- (variance / pos_implied) * 100; NULL if pos_implied = 0
)
LANGUAGE sql STABLE AS $$
  WITH fb_variants AS (
    -- Only variants wired into at least one active menu item
    SELECT DISTINCT mii.variant_id
    FROM   menu_item_ingredients mii
    JOIN   menu_items mi ON mi.id = mii.menu_item_id
    WHERE  mi.hotel_id = auth_hotel_id()
      AND  mi.is_active
  ),
  log_window AS (
    SELECT
      sl.variant_id,
      ABS(SUM(CASE WHEN sl.source = 'pos' AND sl.quantity_change < 0 THEN sl.quantity_change ELSE 0 END)) AS pos_implied_qty,
      ABS(SUM(CASE WHEN sl.quantity_change < 0 THEN sl.quantity_change ELSE 0 END))                       AS actual_qty
    FROM   stock_logs sl
    JOIN   fb_variants fv ON fv.variant_id = sl.variant_id
    WHERE  sl.hotel_id  = auth_hotel_id()
      AND  sl.timestamp >= now() - (p_days * interval '1 day')
    GROUP  BY sl.variant_id
  )
  SELECT
    pv.id                                                            AS variant_id,
    p.name                                                           AS product_name,
    pv.name                                                          AS variant_name,
    pv.sku,
    COALESCE(lw.pos_implied_qty, 0)                                  AS pos_implied_qty,
    COALESCE(lw.actual_qty, 0)                                       AS actual_qty,
    COALESCE(lw.actual_qty, 0) - COALESCE(lw.pos_implied_qty, 0)    AS variance_qty,
    CASE
      WHEN COALESCE(lw.pos_implied_qty, 0) > 0
      THEN ROUND(
        (COALESCE(lw.actual_qty, 0) - COALESCE(lw.pos_implied_qty, 0))
        / lw.pos_implied_qty * 100, 1
      )
    END                                                              AS variance_pct
  FROM   fb_variants fv
  JOIN   product_variants pv ON pv.id = fv.variant_id
  JOIN   products p          ON p.id  = pv.product_id
  LEFT JOIN log_window lw    ON lw.variant_id = fv.variant_id
  WHERE  p.hotel_id = auth_hotel_id()
    AND  COALESCE(
           (COALESCE(lw.actual_qty, 0) - COALESCE(lw.pos_implied_qty, 0))
           / NULLIF(lw.pos_implied_qty, 0) * 100,
           0
         ) >= p_threshold_pct
  ORDER  BY variance_pct DESC NULLS LAST, variance_qty DESC;
$$;

GRANT EXECUTE ON FUNCTION get_pos_variance(int, numeric) TO authenticated;

-- ─── 11. detect_and_alert_pos_variance() ─────────────────────────────────────
-- Iterates all hotels, fires pos_variance alerts for high-variance ingredients.
-- Deduplicates: skips if an unread pos_variance alert for the same variant exists.

CREATE OR REPLACE FUNCTION detect_and_alert_pos_variance(
  p_days          int     DEFAULT 7,
  p_threshold_pct numeric DEFAULT 20
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r_hotel  RECORD;
  r_item   RECORD;
BEGIN
  FOR r_hotel IN SELECT id FROM hotels LOOP
    -- Temporarily spoof auth context for this hotel
    PERFORM set_config('app.current_hotel_id', r_hotel.id::text, true);

    FOR r_item IN
      SELECT * FROM get_pos_variance(p_days, p_threshold_pct)
    LOOP
      -- Dedup: skip if an unread pos_variance alert for this variant already exists
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM notifications n
        WHERE  n.hotel_id  = r_hotel.id
          AND  n.type      = 'pos_variance'
          AND  n.is_read   = false
          AND  n.metadata->>'variant_id' = r_item.variant_id::text
      );

      PERFORM fan_out_alert(
        r_hotel.id,
        r_item.product_name || ' — ' || r_item.variant_name
          || ': ' || r_item.variance_qty::text || ' units unexplained'
          || ' (' || r_item.variance_pct::text || '% over POS-implied)',
        'pos_variance',
        'admin',
        r_item.variant_id
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─── 12. pg_cron: daily variance check ───────────────────────────────────────

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-pos-variance-check',
      '0 7 * * *',
      $cmd$SELECT detect_and_alert_pos_variance(7, 20)$cmd$
    );
  END IF;
END;
$outer$;
