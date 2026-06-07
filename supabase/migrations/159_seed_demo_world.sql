-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 159 — seed_demo_world(): a coherent F&B world for AIP to reason over
--
-- The platform is AIP-driven: forecasts, the restock_advisor agent, scenarios,
-- and evals all reason over typed nodes. But the data underneath is empty —
-- 0 pos_sales, 0 recipes, 0 occupancy, and a handful of junk-named variants.
-- Every AIP surface renders an empty state.
--
-- This builds a believable bar inventory and drives 90 days of POS-derived
-- consumption through the same shape the real ingest_pos_sale pipeline produces:
--   • A product catalogue (spirits / mixers / garnish) + suppliers + par levels
--   • The recipe ontology (menu_items + menu_item_ingredients) — the typed BOM
--     bridge that turns a sale into ingredient consumption
--   • Daily POS sales (pos_sales) with weekday/weekend seasonality
--   • Coherently-balanced, historically-stamped stock_logs (source='pos') with
--     periodic restock receipts so balances decline + recover realistically
--   • pos_sale --causes--> stock_log edges (the Reality Graph causal path)
--   • A few closed POs + invoices so supplier reliability has signal
--
-- vs migration 149 (seed_demo_hotel_data): that seeds coarse WEEKLY consumption
-- with flat balance snapshots and no recipe/POS ontology. This is the AIP-shaped
-- successor for the F&B path. It leaves 149 in place (still callable) but is the
-- one to run for a realistic demo.
--
-- Admin/owner only. Refuses if the hotel already has recipes unless p_force.
--
-- Depends on: 065 (menu/POS pipeline), 149 (demo seed pattern), 146 (suppliers)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_demo_world(
  p_hotel_id uuid,
  p_days     int     DEFAULT 90,
  p_force    boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text := auth_role();
  v_org_id      uuid;
  v_actor       uuid;   -- real user for FK-bound authorship (POs/invoices)
  v_sentinel    uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_supplier_a  uuid;
  v_supplier_b  uuid;
  v_existing    int;
  rec           record;
  v_variants_made int := 0;
  v_logs_made     int := 0;
  v_sales_made    int := 0;
  v_pos_made      int := 0;
  v_edges_made    int := 0;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org_id FROM hotels WHERE id = p_hotel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hotel % not found', p_hotel_id USING ERRCODE = '23503';
  END IF;

  -- A real user for FK-bound authorship (purchase_orders.created_by,
  -- po_invoices.submitted_by). stock_logs accept the sentinel; POs don't.
  SELECT id INTO v_actor FROM users WHERE hotel_id = p_hotel_id
   ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1;

  SELECT count(*) INTO v_existing FROM menu_items WHERE hotel_id = p_hotel_id;
  IF v_existing > 0 AND NOT p_force THEN
    RAISE EXCEPTION 'hotel % already has % menu_items. Pass p_force => true to seed anyway.', p_hotel_id, v_existing
      USING ERRCODE = '23505';
  END IF;

  -- ── 1. Suppliers ───────────────────────────────────────────────────────────
  INSERT INTO suppliers (hotel_id, name, lead_time_days, lead_time_source)
  VALUES (p_hotel_id, 'Premium Spirits Co', 3, 'manual')
  RETURNING id INTO v_supplier_a;
  INSERT INTO suppliers (hotel_id, name, lead_time_days, lead_time_source)
  VALUES (p_hotel_id, 'Bar Essentials Ltd', 7, 'manual')
  RETURNING id INTO v_supplier_b;

  -- ── 2. Catalogue: product + single 'Standard' variant per item ─────────────
  -- (name, sku, unit, cost, par, base_daily_demand, supplier 'A'|'B')
  CREATE TEMP TABLE _cat (
    name text, sku text, unit text, cost numeric, par int, base int, sup text,
    product_id uuid, variant_id uuid
  ) ON COMMIT DROP;
  INSERT INTO _cat (name, sku, unit, cost, par, base, sup) VALUES
    ('Vodka 700ml',     'SPR-VOD', 'serving', 1.20, 30,  5, 'A'),
    ('Gin 700ml',       'SPR-GIN', 'serving', 1.30, 24,  4, 'A'),
    ('White Rum 700ml', 'SPR-RUM', 'serving', 1.10, 20,  3, 'A'),
    ('Tequila Blanco',  'SPR-TEQ', 'serving', 1.50, 16,  2, 'A'),
    ('Bourbon 700ml',   'SPR-BRB', 'serving', 1.40, 16,  2, 'A'),
    ('Tonic Water',     'MIX-TON', 'can',     0.40, 28,  4, 'B'),
    ('Cola',            'MIX-COL', 'can',     0.35, 36,  5, 'B'),
    ('Soda Water',      'MIX-SOD', 'can',     0.30, 22,  3, 'B'),
    ('Orange Juice',    'MIX-OJ',  'carton',  0.50, 16,  2, 'B'),
    ('Lime',            'GAR-LIM', 'piece',   0.15, 60, 11, 'B');

  FOR rec IN SELECT * FROM _cat LOOP
    INSERT INTO products (hotel_id, name, sku, cost, enabled)
    VALUES (p_hotel_id, rec.name, rec.sku, rec.cost, true)
    RETURNING id INTO rec.product_id;

    INSERT INTO product_variants (
      product_id, name, sku, current_stock, cost, low_stock_threshold,
      enabled, unit_of_measure, par_source, default_supplier_id
    ) VALUES (
      rec.product_id, 'Standard', rec.sku || '-STD',
      rec.par * 2, rec.cost, rec.par,
      true, rec.unit, 'auto',
      CASE WHEN rec.sup = 'A' THEN v_supplier_a ELSE v_supplier_b END
    )
    RETURNING id INTO rec.variant_id;

    UPDATE _cat SET product_id = rec.product_id, variant_id = rec.variant_id WHERE sku = rec.sku;
    v_variants_made := v_variants_made + 1;
  END LOOP;

  -- ── 3. Recipe ontology: menu_items + menu_item_ingredients ─────────────────
  CREATE TEMP TABLE _menu (
    name text, category text, price numeric, base int, menu_id uuid
  ) ON COMMIT DROP;
  INSERT INTO _menu (name, category, price, base) VALUES
    ('Gin & Tonic',  'cocktail', 11.00, 4),
    ('Vodka Soda',   'cocktail', 10.00, 3),
    ('Rum & Coke',   'cocktail', 10.00, 3),
    ('Margarita',    'cocktail', 13.00, 2),
    ('Screwdriver',  'cocktail', 10.00, 2),
    ('Whiskey Cola', 'cocktail', 11.00, 2);

  FOR rec IN SELECT * FROM _menu LOOP
    INSERT INTO menu_items (hotel_id, name, category, sell_price, is_active)
    VALUES (p_hotel_id, rec.name, rec.category, rec.price, true)
    RETURNING id INTO rec.menu_id;
    UPDATE _menu SET menu_id = rec.menu_id WHERE name = rec.name;
  END LOOP;

  -- recipe edges: (menu, ingredient sku, qty_per_serve)
  INSERT INTO menu_item_ingredients (menu_item_id, variant_id, qty_per_serve, unit)
  SELECT m.menu_id, c.variant_id, r.qty, c.unit
  FROM (VALUES
    ('Gin & Tonic',  'SPR-GIN', 1), ('Gin & Tonic',  'MIX-TON', 1), ('Gin & Tonic',  'GAR-LIM', 1),
    ('Vodka Soda',   'SPR-VOD', 1), ('Vodka Soda',   'MIX-SOD', 1), ('Vodka Soda',   'GAR-LIM', 1),
    ('Rum & Coke',   'SPR-RUM', 1), ('Rum & Coke',   'MIX-COL', 1),
    ('Margarita',    'SPR-TEQ', 1), ('Margarita',    'GAR-LIM', 2),
    ('Screwdriver',  'SPR-VOD', 1), ('Screwdriver',  'MIX-OJ',  1),
    ('Whiskey Cola', 'SPR-BRB', 1), ('Whiskey Cola', 'MIX-COL', 1)
  ) AS r(menu, sku, qty)
  JOIN _menu m ON m.name = r.menu
  JOIN _cat  c ON c.sku  = r.sku;

  -- ── 4. Per-variant daily consumption history (coherent running balance) ────
  -- base_daily_demand per variant is summed from the recipes; we simulate a
  -- day loop with weekend lift + noise, restocking to ~2× par when below par.
  FOR rec IN SELECT * FROM _cat LOOP
    DECLARE
      v_balance   int := rec.par * 2;
      v_day       date;
      v_dow       int;
      v_demand    int;
      v_lift      numeric;
      v_ts        timestamptz;
      v_pending_qty int := 0;
      v_pending_day date := NULL;
    BEGIN
      FOR v_day IN
        SELECT d::date FROM generate_series(
          (now() - (p_days || ' days')::interval)::date,
          now()::date,
          interval '1 day'
        ) AS d
      LOOP
        -- A pending restock arrives.
        IF v_pending_day IS NOT NULL AND v_day >= v_pending_day THEN
          v_balance := v_balance + v_pending_qty;
          v_ts := v_day::timestamptz + interval '9 hours';
          INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason, source, timestamp)
          VALUES (p_hotel_id, rec.variant_id, v_sentinel, v_pending_qty, v_balance, 'Restock received', 'restock', v_ts);
          v_logs_made := v_logs_made + 1;
          v_pending_qty := 0; v_pending_day := NULL;
        END IF;

        v_dow  := extract(dow from v_day);              -- 0 Sun … 6 Sat
        v_lift := CASE WHEN v_dow IN (5,6) THEN 1.5 WHEN v_dow = 0 THEN 1.2 ELSE 1.0 END;
        -- demand = base × weekend lift × noise(0.6–1.4), min 0
        v_demand := greatest(0, round(rec.base * v_lift * (0.6 + random() * 0.8))::int);

        IF v_demand > 0 THEN
          v_balance := greatest(0, v_balance - v_demand);
          v_ts := v_day::timestamptz + interval '20 hours';
          INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason, source, timestamp)
          VALUES (p_hotel_id, rec.variant_id, v_sentinel, -v_demand, v_balance, 'POS: daily consumption', 'pos', v_ts);
          v_logs_made := v_logs_made + 1;
        END IF;

        -- Order more when at/below par and nothing already inbound.
        IF v_balance <= rec.par AND v_pending_day IS NULL THEN
          v_pending_qty := rec.par * 2 - v_balance;
          v_pending_day := v_day + (CASE WHEN rec.sup = 'A' THEN 3 ELSE 7 END);
        END IF;
      END LOOP;

      -- Land the final balance on the variant (the last log's balance_after).
      UPDATE product_variants SET current_stock = v_balance WHERE id = rec.variant_id;
    END;
  END LOOP;

  -- ── 5. Daily POS sales at the menu-item level (realistic feed) ─────────────
  FOR rec IN SELECT * FROM _menu LOOP
    INSERT INTO pos_sales (hotel_id, menu_item_id, quantity_sold, sale_time, source_system)
    SELECT
      p_hotel_id, rec.menu_id,
      greatest(1, round(rec.base
        * (CASE WHEN extract(dow from d) IN (5,6) THEN 1.5 WHEN extract(dow from d) = 0 THEN 1.2 ELSE 1.0 END)
        * (0.6 + random() * 0.8))::int),
      d::timestamptz + interval '20 hours', 'demo_seed'
    FROM generate_series(
      (now() - (p_days || ' days')::interval)::date, now()::date, interval '1 day'
    ) AS d;
    GET DIAGNOSTICS v_pos_made = ROW_COUNT;
    v_sales_made := v_sales_made + v_pos_made;
  END LOOP;

  -- ── 6. Causal edges: pos_sale --causes--> same-day ingredient stock_log ────
  INSERT INTO relationship_edges (hotel_id, source_type, source_id, edge_type, target_type, target_id, triggered_by, metadata)
  SELECT p_hotel_id, 'pos_sale', ps.id, 'causes', 'stock_log', sl.id, 'automation_threshold',
         jsonb_build_object('seed', true)
  FROM pos_sales ps
  JOIN menu_item_ingredients mii ON mii.menu_item_id = ps.menu_item_id
  JOIN stock_logs sl
    ON sl.variant_id = mii.variant_id
   AND sl.source = 'pos'
   AND sl.timestamp::date = ps.sale_time::date
   AND sl.hotel_id = p_hotel_id
  WHERE ps.hotel_id = p_hotel_id AND ps.source_system = 'demo_seed'
  ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
  GET DIAGNOSTICS v_edges_made = ROW_COUNT;

  -- ── 7. Closed POs + invoices per supplier (supplier reliability signal) ────
  -- Skipped when the hotel has no real user (created_by/submitted_by are
  -- FK-bound to users); the consumption history above is the main payload.
  FOR rec IN SELECT id, name, coalesce(lead_time_days,7) AS lead FROM suppliers
             WHERE hotel_id = p_hotel_id AND id IN (v_supplier_a, v_supplier_b)
               AND v_actor IS NOT NULL LOOP
    DECLARE
      i int; v_on_time boolean; v_amt numeric; v_disc numeric; v_ts timestamptz; v_po uuid;
    BEGIN
      FOR i IN 1..4 LOOP
        v_on_time := random() > 0.3;
        v_amt  := round((150 + random() * 600)::numeric, 2);
        v_disc := round((random() * v_amt * 0.04)::numeric, 2);
        v_ts   := now() - ((i * 18 + random() * 4) || ' days')::interval;
        INSERT INTO purchase_orders (
          hotel_id, po_number, supplier_id, supplier_name, status, total_amount,
          expected_delivery_date, sent_at, confirmed_at, closed_at, created_by
        ) VALUES (
          p_hotel_id, 'DEMO-' || to_char(v_ts,'YYYYMMDD') || '-' || substr(rec.id::text,1,4) || '-' || i::text,
          rec.id, rec.name, 'closed', v_amt,
          (v_ts + (rec.lead || ' days')::interval)::date, v_ts, v_ts + interval '1 day',
          v_ts + (rec.lead || ' days')::interval + (CASE WHEN v_on_time THEN interval '0 days' ELSE (1 + random()*2 || ' days')::interval END),
          v_actor
        ) RETURNING id INTO v_po;
        -- discrepancy_amount is a generated column (invoice_amount - po_amount); never inserted.
        INSERT INTO po_invoices (hotel_id, po_id, invoice_number, invoice_date, invoice_amount, po_amount, status, submitted_by)
        VALUES (
          p_hotel_id, v_po, 'INV-DEMO-' || to_char(v_ts,'YYYYMMDD') || '-' || substr(rec.id::text,1,4) || '-' || i::text,
          (v_ts + (rec.lead || ' days')::interval)::date,
          v_amt + v_disc * (CASE WHEN random() > 0.5 THEN 1 ELSE -1 END), v_amt, 'approved', v_actor
        );
      END LOOP;
    END;
  END LOOP;

  PERFORM compute_supplier_reliability(90, false);

  RETURN jsonb_build_object(
    'hotel_id',        p_hotel_id,
    'days',            p_days,
    'variants_made',   v_variants_made,
    'stock_logs_made', v_logs_made,
    'pos_sales_made',  v_sales_made,
    'causal_edges',    v_edges_made,
    'note',            'Recipe ontology + 90d POS-derived history seeded. Forecasts, at-risk scan, supplier reliability, and scenario simulation now have real data. Next intelligence-cycle run will propose against real par levels.'
  );
END;
$$;

REVOKE ALL ON FUNCTION seed_demo_world(uuid, int, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION seed_demo_world(uuid, int, boolean) TO authenticated;

COMMENT ON FUNCTION seed_demo_world(uuid, int, boolean) IS
  'Seed a coherent F&B world (catalogue + suppliers + recipe ontology + 90d POS-derived coherent stock history + causal edges + closed POs). AIP-shaped successor to seed_demo_hotel_data for the F&B path. Admin/owner; refuses if menu_items already exist unless p_force.';
