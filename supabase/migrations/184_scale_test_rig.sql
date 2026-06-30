-- Migration 184 — portfolio-scale test rig (P0.3).
--
-- Repeatable, reversible seeding for the scale test: seed_scale_test builds a
-- "Scale Test Org" with N hotels × M variants × D days of consumption logs;
-- teardown_scale_test removes it. Service-role only (no tenant arg, not granted
-- authenticated/anon) — test tooling, same precedent as seed_demo_world. Used to
-- run runIntelligenceCycle across many hotels and measure the cron sweep.

CREATE OR REPLACE FUNCTION public.seed_scale_test(p_hotels int DEFAULT 12, p_variants int DEFAULT 12, p_days int DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_org uuid; v_hotel uuid; v_prod uuid; v_var uuid; v_sup uuid;
  v_sentinel uuid := '00000000-0000-0000-0000-000000000000';
  i int; j int; d int; v_base int; v_balance int; v_ts timestamptz;
  v_hotels int := 0; v_vars int := 0; v_logs int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE name = 'Scale Test Org') THEN
    RAISE EXCEPTION 'Scale Test Org already exists — run teardown_scale_test() first';
  END IF;
  INSERT INTO organizations (name, slug)
    VALUES ('Scale Test Org', 'scale-test-' || substr(gen_random_uuid()::text, 1, 8))
    RETURNING id INTO v_org;

  FOR i IN 1..p_hotels LOOP
    INSERT INTO hotels (organization_id, name) VALUES (v_org, 'Scale Hotel ' || i) RETURNING id INTO v_hotel;
    v_hotels := v_hotels + 1;
    INSERT INTO suppliers (hotel_id, name, lead_time_days, lead_time_source)
      VALUES (v_hotel, 'Scale Supplier ' || i, 5, 'manual') RETURNING id INTO v_sup;

    FOR j IN 1..p_variants LOOP
      v_base := 2 + (j % 8);   -- daily rate 2..9
      INSERT INTO products (hotel_id, name, sku, cost, enabled, shelf_life_days)
        VALUES (v_hotel, 'P' || i || '-' || j, 'SKU-' || i || '-' || j, 1.0, true,
                CASE WHEN j % 3 = 0 THEN 14 ELSE NULL END)   -- 1/3 perishable for waste_triage
        RETURNING id INTO v_prod;
      INSERT INTO product_variants
        (product_id, name, sku, current_stock, cost, low_stock_threshold, enabled, par_source, default_supplier_id, unit_of_measure)
        VALUES (v_prod, 'Std', 'SKU-' || i || '-' || j || '-S', v_base * 10, 1.0, v_base * 3, true, 'auto', v_sup, 'unit')
        RETURNING id INTO v_var;
      v_vars := v_vars + 1;

      v_balance := v_base * 10;
      FOR d IN REVERSE p_days..1 LOOP
        v_ts := now() - (d || ' days')::interval;
        v_balance := greatest(0, v_balance - v_base);
        INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason, source, timestamp)
          VALUES (v_hotel, v_var, v_sentinel, -v_base, v_balance, 'scale seed: consumption', 'pos', v_ts);
        v_logs := v_logs + 1;
        IF v_balance <= v_base * 2 THEN     -- periodic restock so it isn't permanently zero
          v_balance := v_base * 10;
          INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason, source, timestamp)
            VALUES (v_hotel, v_var, v_sentinel, v_base * 8, v_balance, 'scale seed: restock', 'restock', v_ts + interval '1 hour');
          v_logs := v_logs + 1;
        END IF;
      END LOOP;
      UPDATE product_variants SET current_stock = v_balance WHERE id = v_var;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('org_id', v_org, 'hotels', v_hotels, 'variants', v_vars, 'stock_logs', v_logs);
END $fn$;

CREATE OR REPLACE FUNCTION public.teardown_scale_test()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_org uuid; v_hotels uuid[]; v_vars uuid[]; r record;
BEGIN
  SELECT id INTO v_org FROM organizations WHERE name = 'Scale Test Org' LIMIT 1;
  IF v_org IS NULL THEN RETURN jsonb_build_object('note', 'no Scale Test Org to remove'); END IF;
  SELECT array_agg(id) INTO v_hotels FROM hotels WHERE organization_id = v_org;
  SELECT array_agg(pv.id) INTO v_vars
  FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.hotel_id = ANY(v_hotels);

  -- Clear every table that FK-references product_variants (proposals, stock_logs,
  -- relationship_edges, forecast_observations, variant_cost_history, …) by its
  -- referencing column — done dynamically so a new variant-FK can't break teardown.
  FOR r IN
    SELECT DISTINCT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'product_variants' AND tc.table_schema = 'public'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', r.table_name, r.column_name) USING v_vars;
  END LOOP;

  DELETE FROM product_variants WHERE id = ANY(v_vars);
  DELETE FROM products  WHERE hotel_id = ANY(v_hotels);
  DELETE FROM suppliers WHERE hotel_id = ANY(v_hotels);
  DELETE FROM hotels WHERE organization_id = v_org;   -- remaining hotel-scoped rows cascade
  DELETE FROM organizations WHERE id = v_org;

  RETURN jsonb_build_object('org', v_org, 'hotels_removed', coalesce(array_length(v_hotels, 1), 0));
END $fn$;

REVOKE EXECUTE ON FUNCTION public.seed_scale_test(int, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teardown_scale_test()          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_scale_test(int, int, int) TO service_role;
GRANT  EXECUTE ON FUNCTION public.teardown_scale_test()          TO service_role;
