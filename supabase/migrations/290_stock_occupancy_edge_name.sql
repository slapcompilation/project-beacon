-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 290 — a stock movement on a day with occupancy data aborts.
--
-- trg_stock_log_occupancy_edge still writes the PRE-SPLIT edge name:
--
--   PERFORM create_relationship_edge(..., 'influenced_by', ...)
--
-- 252/263 split that name into influenced_by_occupancy and
-- influenced_by_principle — one name cannot mean two relationships — and this
-- writer was missed. The vocabulary CHECK rejects 'influenced_by', so the
-- trigger raises and takes the whole transaction with it:
--
--   new row for relation "relationship_edges_store" violates check constraint
--   "relationship_edges_edge_type_check"
--   Failing row contains (..., influenced_by, stock_log, ..., occupancy_log, ...)
--
-- Blast radius is every write to stock_logs — POS sales, manual adjustments,
-- restock receipts — on any day that HAS an occupancy row for that hotel. The
-- trigger only fires when it finds one, which is why nobody hit it: occupancy
-- data was fifteen days stale, so the lookup returned nothing every time.
--
-- It became reachable the moment a real occupancy event was ingested for today
-- (289/registry verification), and the POS probe in 291 hit it immediately.
-- A latent bug is not a harmless one; it is one waiting for its data.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_stock_log_occupancy_edge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_occ_id   uuid;
  v_hotel_id uuid;
  v_log_date date;
BEGIN
  SELECT p.hotel_id INTO v_hotel_id
  FROM   product_variants pv
  JOIN   products p ON p.id = pv.product_id
  WHERE  pv.id = NEW.variant_id;

  IF v_hotel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- stock_logs uses "timestamp", not "created_at".
  v_log_date := NEW.timestamp::date;

  SELECT id INTO v_occ_id
  FROM   occupancy_logs
  WHERE  hotel_id = v_hotel_id AND date = v_log_date
  LIMIT  1;

  IF v_occ_id IS NOT NULL THEN
    PERFORM create_relationship_edge(
      v_hotel_id,
      'stock_log', NEW.id,
      'influenced_by_occupancy',   -- 252/263 split; this writer was left behind
      'occupancy_log', v_occ_id,
      jsonb_build_object('date', v_log_date, 'delta', NEW.quantity_change)
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- No writer may name an edge type the vocabulary does not allow. The CHECK
-- catches it at runtime, which is too late — it aborts an operator's sale.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT p.proname, ', ') INTO bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~ '''influenced_by''[^_]';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 290: still writing the pre-split name: %', bad;
  END IF;
END $$;

-- The failure that started this: a stock movement on a day WITH occupancy data.
DO $$
DECLARE v_hotel uuid; v_menu uuid; v_sale uuid;
BEGIN
  SELECT h.id INTO v_hotel FROM hotels h
   WHERE EXISTS (SELECT 1 FROM occupancy_logs o WHERE o.hotel_id = h.id AND o.date = current_date)
   LIMIT 1;
  IF v_hotel IS NULL THEN
    RAISE NOTICE 'Migration 290: no hotel with occupancy today; probe skipped';
    RETURN;
  END IF;
  SELECT mi.id INTO v_menu FROM menu_items mi
   WHERE mi.hotel_id = v_hotel AND EXISTS (SELECT 1 FROM menu_item_ingredients g WHERE g.menu_item_id = mi.id)
   LIMIT 1;
  IF v_menu IS NULL THEN RETURN; END IF;

  BEGIN
    v_sale := ingest_pos_sale(v_hotel, v_menu, 1, now(), 'probe', 'probe-290');
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN
      RAISE EXCEPTION 'Migration 290: a sale on a day with occupancy still fails: %', SQLERRM;
    END IF;
  END;
END $$;

COMMIT;
