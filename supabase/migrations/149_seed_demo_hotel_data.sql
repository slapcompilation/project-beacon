-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 149 — seed_demo_hotel_data(): reusable on-demand demo data
--
-- The session that built the AIP loop hit one recurring lesson: every system
-- (agent cron, par engine, supplier reliability) is fully wired but waiting
-- for operational data to actually do work. This RPC populates a hotel with
-- a plausible 60 days of consumption + a handful of closed POs + invoices,
-- so the cron / par engine / supplier ranking / agent proposals all light up
-- on the next firing.
--
-- Reusable: call any time you want to warm up a hotel (demos, staging,
-- testing). Idempotent-ish — refuses by default when the hotel already has
-- substantial stock_logs so you don't accidentally double-seed real data.
--
-- Access: admin or owner only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_demo_hotel_data(
  p_hotel_id  uuid,
  p_days      int     DEFAULT 60,
  p_force     boolean DEFAULT false   -- true overrides the existing-data guard
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role             text  := auth_role();
  v_uid              uuid  := auth.uid();
  v_existing_logs    int;
  v_variant          record;
  v_supplier         record;
  v_weekly_qty       int;
  v_logs_inserted    int := 0;
  v_pars_set         int := 0;
  v_pos_inserted     int := 0;
  v_invoices_inserted int := 0;
  v_ts               timestamptz;
  v_po_id            uuid;
  v_po_amount        numeric;
  v_discrepancy      numeric;
  v_on_time          boolean;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM hotels WHERE id = p_hotel_id) THEN
    RAISE EXCEPTION 'hotel % not found', p_hotel_id USING ERRCODE = '23503';
  END IF;

  SELECT count(*) INTO v_existing_logs
  FROM stock_logs sl
  WHERE sl.hotel_id = p_hotel_id
    AND sl.timestamp >= now() - (p_days || ' days')::interval;

  IF v_existing_logs > 20 AND NOT p_force THEN
    RAISE EXCEPTION 'hotel % already has % stock_logs in the last % days. Pass p_force => true to seed anyway.',
      p_hotel_id, v_existing_logs, p_days USING ERRCODE = '23505';
  END IF;

  -- ── 1. Per-variant consumption + par level ─────────────────────────────────
  FOR v_variant IN
    SELECT pv.id, pv.name, pv.current_stock
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.hotel_id = p_hotel_id
      AND pv.enabled = true
  LOOP
    -- Weekly consumption scaled to current stock so it stays plausible.
    -- Range: 1 to greatest(1, current_stock / 10). Random per variant.
    v_weekly_qty := greatest(1, ceil(random() * greatest(1, v_variant.current_stock::numeric / 10))::int);

    FOR v_ts IN
      SELECT t FROM generate_series(
        now() - (p_days || ' days')::interval,
        now() - interval '1 day',
        '7 days'::interval
      ) AS t
    LOOP
      -- Each week, insert one consumption row with small noise around weekly_qty.
      INSERT INTO stock_logs (hotel_id, variant_id, user_id, quantity_change, balance_after, reason, timestamp)
      VALUES (
        p_hotel_id,
        v_variant.id,
        v_uid,                                             -- attributed to caller
        -greatest(1, v_weekly_qty + ((random() * 2)::int - 1)),
        v_variant.current_stock,                           -- snapshot at insert time; not perfectly accurate but plausible
        'demo_seed: weekly consumption',
        v_ts + (random() * interval '6 days')              -- jitter within the week
      );
      v_logs_inserted := v_logs_inserted + 1;
    END LOOP;

    -- Par level = ~1.5 weeks of consumption, switched to auto so the weekly
    -- engine maintains it. Only if not operator-set.
    IF v_variant.current_stock IS NOT NULL THEN
      UPDATE product_variants
         SET low_stock_threshold = greatest(1, ceil(v_weekly_qty::numeric * 1.5)::int),
             par_source          = 'auto'
       WHERE id = v_variant.id
         AND (low_stock_threshold IS NULL OR low_stock_threshold = 0);
      IF FOUND THEN v_pars_set := v_pars_set + 1; END IF;
    END IF;
  END LOOP;

  -- ── 2. Closed POs + invoices per supplier ──────────────────────────────────
  FOR v_supplier IN
    SELECT s.id, s.name, coalesce(s.lead_time_days, 7) AS lead
    FROM suppliers s
    WHERE s.hotel_id = p_hotel_id
  LOOP
    FOR i IN 1..3 LOOP
      v_on_time := random() > 0.3;                         -- 70% on-time
      v_po_amount := round((100 + random() * 900)::numeric, 2);
      v_discrepancy := round((random() * v_po_amount * 0.05)::numeric, 2);  -- 0-5% variance
      v_ts := now() - ((i * 20 + random() * 5) || ' days')::interval;

      INSERT INTO purchase_orders (
        hotel_id, po_number, supplier_id, supplier_name, status,
        total_amount, expected_delivery_date, sent_at, confirmed_at, closed_at,
        created_by
      ) VALUES (
        p_hotel_id,
        'DEMO-' || to_char(v_ts, 'YYYYMMDD') || '-' || substr(v_supplier.id::text, 1, 4) || '-' || i::text,
        v_supplier.id, v_supplier.name, 'closed',
        v_po_amount,
        (v_ts + (v_supplier.lead || ' days')::interval)::date,
        v_ts,
        v_ts + interval '1 day',
        v_ts + (v_supplier.lead || ' days')::interval + (CASE WHEN v_on_time THEN interval '0 days' ELSE (1 + random() * 2 || ' days')::interval END),
        v_uid
      )
      RETURNING id INTO v_po_id;
      v_pos_inserted := v_pos_inserted + 1;

      INSERT INTO po_invoices (hotel_id, po_id, invoice_number, invoice_date, invoice_amount, po_amount, discrepancy_amount, status, submitted_by)
      VALUES (
        p_hotel_id, v_po_id,
        'INV-DEMO-' || to_char(v_ts, 'YYYYMMDD') || '-' || i::text,
        (v_ts + (v_supplier.lead || ' days')::interval)::date,
        v_po_amount + v_discrepancy * (CASE WHEN random() > 0.5 THEN 1 ELSE -1 END),
        v_po_amount,
        v_discrepancy,
        'approved',
        v_uid
      );
      v_invoices_inserted := v_invoices_inserted + 1;
    END LOOP;
  END LOOP;

  -- ── 3. Recompute supplier reliability so the new POs/invoices flow through
  PERFORM compute_supplier_reliability(90, false);

  RETURN jsonb_build_object(
    'hotel_id',            p_hotel_id,
    'days_seeded',         p_days,
    'stock_logs_inserted', v_logs_inserted,
    'pars_set',            v_pars_set,
    'pos_inserted',        v_pos_inserted,
    'invoices_inserted',   v_invoices_inserted,
    'note',                'Run compute_supplier_reliability(90, false) was triggered. The next intelligence-cycle run will scan with real par levels + the agent ranking has real on_time/cost variance signal.'
  );
END;
$$;

REVOKE ALL ON FUNCTION seed_demo_hotel_data(uuid, int, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION seed_demo_hotel_data(uuid, int, boolean) TO authenticated;

COMMENT ON FUNCTION seed_demo_hotel_data(uuid, int, boolean) IS
  'Warm up a hotel with plausible consumption + closed POs + invoices so the agent / par engine / supplier ranking light up. Admin/owner only. Refuses by default if the hotel already has > 20 recent stock_logs (pass p_force => true to override).';
