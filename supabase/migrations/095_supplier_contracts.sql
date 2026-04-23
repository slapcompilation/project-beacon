-- Migration 095: Supplier Contract Intelligence
-- Layer: Mind
-- Purpose: Stores contracted prices per variant per supplier so the system has a
-- ground-truth "agreed price" to compare against received invoices and stock_logs.
-- This upgrades price-drift from "vs. historical average" to "vs. contracted rate".

CREATE TABLE IF NOT EXISTS supplier_contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  supplier_id      uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name    text        NOT NULL,
  variant_id       uuid        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  contracted_price numeric(10,4) NOT NULL CHECK (contracted_price > 0),
  min_order_qty    integer     CHECK (min_order_qty IS NULL OR min_order_qty > 0),
  contract_start   date        NOT NULL DEFAULT CURRENT_DATE,
  contract_end     date,
  notes            text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Only one active contract per variant per supplier per hotel
  CONSTRAINT uq_active_contract UNIQUE NULLS NOT DISTINCT (hotel_id, variant_id, supplier_id, is_active)
);

ALTER TABLE supplier_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_members_read_contracts"
  ON supplier_contracts FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "admins_write_contracts"
  ON supplier_contracts FOR ALL
  USING  (hotel_id = auth_hotel_id() AND auth_role() IN ('admin','owner'))
  WITH CHECK (hotel_id = auth_hotel_id() AND auth_role() IN ('admin','owner'));

GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_contracts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_supplier_contracts_hotel_variant
  ON supplier_contracts (hotel_id, variant_id)
  WHERE is_active;

-- ─── get_supplier_contracts() ─────────────────────────────────────────────────
-- Returns all active contracts for the calling user's hotel,
-- enriched with the last received price and computed deviation %.
CREATE OR REPLACE FUNCTION get_supplier_contracts()
RETURNS TABLE (
  id                  uuid,
  supplier_id         uuid,
  supplier_name       text,
  variant_id          uuid,
  variant_name        text,
  product_name        text,
  sku                 text,
  contracted_price    numeric,
  min_order_qty       integer,
  contract_start      date,
  contract_end        date,
  notes               text,
  is_active           boolean,
  created_at          timestamptz,
  last_received_price numeric,
  price_deviation_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_receive AS (
    -- Most recent unit_cost from restock_receives (actual invoice price at receiving)
    -- joined via restock_requests to get variant_id
    SELECT DISTINCT ON (rr.variant_id)
      rr.variant_id,
      rcv.unit_cost AS last_received_price
    FROM  restock_receives rcv
    JOIN  restock_requests rr ON rr.id = rcv.request_id
    WHERE rcv.hotel_id   = auth_hotel_id()
      AND rcv.unit_cost IS NOT NULL
    ORDER BY rr.variant_id, rcv.received_at DESC
  )
  SELECT
    sc.id,
    sc.supplier_id,
    sc.supplier_name,
    sc.variant_id,
    pv.name                             AS variant_name,
    p.name                              AS product_name,
    pv.sku,
    sc.contracted_price,
    sc.min_order_qty,
    sc.contract_start,
    sc.contract_end,
    sc.notes,
    sc.is_active,
    sc.created_at,
    lr.last_received_price,
    CASE
      WHEN lr.last_received_price IS NULL THEN NULL
      ELSE ROUND(
        (lr.last_received_price - sc.contracted_price) / sc.contracted_price * 100,
        1
      )
    END                                 AS price_deviation_pct
  FROM  supplier_contracts sc
  JOIN  product_variants pv ON pv.id = sc.variant_id
  JOIN  products p           ON p.id  = pv.product_id
  LEFT  JOIN last_receive lr ON lr.variant_id = sc.variant_id
  WHERE sc.hotel_id  = auth_hotel_id()
    AND sc.is_active = true
  ORDER BY
    -- Largest positive deviation (overpaying) first
    price_deviation_pct DESC NULLS LAST,
    product_name,
    variant_name
$$;

-- ─── upsert_supplier_contract() ──────────────────────────────────────────────
-- Creates or updates a contract. Pass p_id to update an existing row.
CREATE OR REPLACE FUNCTION upsert_supplier_contract(
  p_supplier_name    text,
  p_variant_id       uuid,
  p_contracted_price numeric,
  p_contract_start   date    DEFAULT CURRENT_DATE,
  p_id               uuid    DEFAULT NULL,
  p_supplier_id      uuid    DEFAULT NULL,
  p_min_order_qty    integer DEFAULT NULL,
  p_contract_end     date    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel uuid := auth_hotel_id();
  v_id    uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE supplier_contracts SET
      supplier_id      = p_supplier_id,
      supplier_name    = p_supplier_name,
      variant_id       = p_variant_id,
      contracted_price = p_contracted_price,
      min_order_qty    = p_min_order_qty,
      contract_start   = p_contract_start,
      contract_end     = p_contract_end,
      notes            = p_notes,
      updated_at       = now()
    WHERE id = p_id AND hotel_id = v_hotel
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO supplier_contracts (
      hotel_id, supplier_id, supplier_name, variant_id,
      contracted_price, min_order_qty,
      contract_start, contract_end, notes
    ) VALUES (
      v_hotel, p_supplier_id, p_supplier_name, p_variant_id,
      p_contracted_price, p_min_order_qty,
      p_contract_start, p_contract_end, p_notes
    )
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- ─── deactivate_supplier_contract() ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION deactivate_supplier_contract(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE supplier_contracts
  SET  is_active  = false,
       updated_at = now()
  WHERE id = p_id AND hotel_id = auth_hotel_id();
END;
$$;
