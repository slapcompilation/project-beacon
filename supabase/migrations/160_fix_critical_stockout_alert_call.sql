-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 160 — fix trg_critical_stockout()'s fan_out_alert call
--
-- trg_critical_stockout (migration 102) calls fan_out_alert with arguments in
-- the wrong order — it was written against an older signature and never
-- updated. Current signature (migration 061):
--   fan_out_alert(p_hotel_id uuid, p_message text, p_type text,
--                 p_min_role text DEFAULT 'team_member', p_variant_id uuid)
-- The trigger called it as (hotel_id, 'low_stock', variant_id, message, 1.0)
-- → 'low_stock' lands in p_message, a uuid in p_type, a numeric in p_variant_id
-- → "function fan_out_alert(uuid, unknown, uuid, text, numeric) does not exist".
--
-- Effect in production: ANY stock_log whose balance hits 0 raises inside the
-- AFTER INSERT trigger, so the stockout write fails. Surfaced by the J1 demo
-- seed driving real consumption to zero.
--
-- Fix: call fan_out_alert with the correct argument order. No behavior change
-- beyond the alert now actually firing.
--
-- Depends on: 061 (fan_out_alert), 102 (trg_critical_stockout)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_critical_stockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variant record;
  v_hotel_id uuid;
BEGIN
  IF NEW.balance_after > 0 THEN
    RETURN NEW;
  END IF;

  SELECT pv.id AS variant_id, pv.sku, p.name AS product_name, p.hotel_id
    INTO v_variant
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE pv.id = NEW.variant_id;

  IF v_variant IS NULL THEN
    RETURN NEW;
  END IF;

  v_hotel_id := v_variant.hotel_id;

  IF NOT EXISTS (
    SELECT 1 FROM notifications
     WHERE hotel_id = v_hotel_id
       AND variant_id = v_variant.variant_id
       AND type = 'low_stock'
       AND read = false
  ) THEN
    -- Correct argument order: (hotel, message, type, min_role, variant).
    PERFORM fan_out_alert(
      v_hotel_id,
      v_variant.product_name || ' (' || v_variant.sku || ') is now OUT OF STOCK — immediate restock required',
      'low_stock',
      'team_member',
      v_variant.variant_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM restock_requests
     WHERE variant_id = v_variant.variant_id
       AND hotel_id = v_hotel_id
       AND status IN ('pending', 'pending_manager', 'pending_director', 'approved')
  ) THEN
    INSERT INTO restock_requests (hotel_id, variant_id, quantity_needed, notes, is_auto_proposed, requestor_id)
    VALUES (
      v_hotel_id,
      v_variant.variant_id,
      10,
      'Emergency auto-proposal: stock hit zero',
      true,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;
