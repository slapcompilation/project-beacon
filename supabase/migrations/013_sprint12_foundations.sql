-- Sprint 12: Data foundations
-- 1. Barcode field on product_variants
-- 2. variant_cost_history for point-in-time valuation
-- 3. Auto-restock trigger when stock hits par level

-- ─── 1. Barcode ────────────────────────────────────────────────────────────────

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS barcode text;

-- Barcodes (EAN-13, UPC-A etc.) are globally unique by design; unique index enforces this.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pv_barcode
  ON product_variants (barcode)
  WHERE barcode IS NOT NULL;

-- ─── 2. Cost history ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variant_cost_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     uuid        NOT NULL REFERENCES product_variants (id),
  hotel_id       uuid        NOT NULL REFERENCES hotels (id),
  cost           numeric(12,4) NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  changed_by     uuid        REFERENCES auth.users (id)
);

ALTER TABLE variant_cost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON variant_cost_history
  USING (hotel_id = auth_hotel_id());

-- Index used by point-in-time valuation: "latest cost row at or before date X"
CREATE INDEX IF NOT EXISTS idx_cost_history_lookup
  ON variant_cost_history (variant_id, effective_from DESC);

-- Seed the initial cost when a variant is created
CREATE OR REPLACE FUNCTION seed_initial_cost()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id FROM products WHERE id = NEW.product_id;
  INSERT INTO variant_cost_history (variant_id, hotel_id, cost, changed_by, effective_from)
  VALUES (NEW.id, v_hotel_id, NEW.cost, auth.uid(), now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_initial_cost ON product_variants;
CREATE TRIGGER trg_seed_initial_cost
  AFTER INSERT ON product_variants
  FOR EACH ROW EXECUTE FUNCTION seed_initial_cost();

-- Record a new history row whenever cost is updated
CREATE OR REPLACE FUNCTION record_cost_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_hotel_id uuid;
BEGIN
  IF NEW.cost IS NOT DISTINCT FROM OLD.cost THEN RETURN NEW; END IF;
  SELECT hotel_id INTO v_hotel_id FROM products WHERE id = NEW.product_id;
  INSERT INTO variant_cost_history (variant_id, hotel_id, cost, changed_by, effective_from)
  VALUES (NEW.id, v_hotel_id, NEW.cost, auth.uid(), now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_cost_change ON product_variants;
CREATE TRIGGER trg_record_cost_change
  AFTER UPDATE OF cost ON product_variants
  FOR EACH ROW EXECUTE FUNCTION record_cost_change();

-- Helper RPC: cost in effect at a given timestamp (used by Reports valuation tab)
CREATE OR REPLACE FUNCTION get_cost_at(p_variant_id uuid, p_at timestamptz)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cost
  FROM variant_cost_history
  WHERE variant_id = p_variant_id
    AND effective_from <= p_at
  ORDER BY effective_from DESC
  LIMIT 1;
$$;

-- ─── 3. Par-level auto-restock trigger ────────────────────────────────────────
-- Fires when current_stock transitions from ABOVE to AT-OR-BELOW the threshold.
-- Skips if an open (pending/approved) request already exists for that variant.

CREATE OR REPLACE FUNCTION auto_create_restock_request()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_hotel_id     uuid;
  v_requestor_id uuid;
BEGIN
  -- Guard: threshold must be set
  IF NEW.low_stock_threshold = 0 THEN RETURN NEW; END IF;
  -- Guard: stock must have just crossed the threshold (not already below)
  IF NEW.current_stock > NEW.low_stock_threshold THEN RETURN NEW; END IF;
  IF OLD.current_stock <= OLD.low_stock_threshold THEN RETURN NEW; END IF;

  SELECT p.hotel_id INTO v_hotel_id
  FROM products p WHERE p.id = NEW.product_id;

  -- Skip if an open request already exists for this variant
  IF EXISTS (
    SELECT 1 FROM restock_requests
    WHERE variant_id = NEW.id AND status IN ('pending', 'approved')
  ) THEN RETURN NEW; END IF;

  -- Requestor: calling user if available, else the hotel owner
  v_requestor_id := coalesce(
    auth.uid(),
    (SELECT id FROM profiles WHERE hotel_id = v_hotel_id AND role = 'owner' LIMIT 1)
  );

  -- Suggested qty: enough to reach 2× par level
  INSERT INTO restock_requests (hotel_id, variant_id, quantity_needed, requestor_id, status, notes)
  VALUES (
    v_hotel_id,
    NEW.id,
    GREATEST(NEW.low_stock_threshold * 2 - NEW.current_stock, NEW.low_stock_threshold),
    v_requestor_id,
    'pending',
    'Auto-generated: stock reached par level'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_restock ON product_variants;
CREATE TRIGGER trg_auto_restock
  AFTER UPDATE OF current_stock ON product_variants
  FOR EACH ROW EXECUTE FUNCTION auto_create_restock_request();
