-- Migration 034: custom removal reasons + variant active flag
-- Flow Layer: operator-configurable move reasons with enforcement
-- Floor Layer: active/inactive toggle (separate from soft-delete)

-- ─── 1. custom_removal_reasons table ─────────────────────────────────────────
-- Hotel-scoped list of move reason categories shown in StockAdjustModal.
-- These appear alongside the built-in REMOVAL_CATEGORIES from the types package.

CREATE TABLE IF NOT EXISTS custom_removal_reasons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_removal_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON custom_removal_reasons
  USING (hotel_id = (SELECT hotel_id FROM users WHERE id = auth.uid()))
  WITH CHECK (hotel_id = (SELECT hotel_id FROM users WHERE id = auth.uid()));

-- ─── 2. variant active flag ───────────────────────────────────────────────────
-- Separate from `enabled` (soft-delete). `active = false` means the variant is
-- still visible and tracked but marked as temporarily out of service / inactive.
-- Does NOT remove it from stock counts — just surfaces as grayed-out in the UI.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- ─── 3. hotel config helpers ──────────────────────────────────────────────────
-- The hotels.config JSONB column already exists. We add a convenience RPC so
-- the client can patch individual config keys without a full overwrite.

CREATE OR REPLACE FUNCTION update_hotel_config(
  p_key   text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id FROM users WHERE id = auth.uid();
  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Hotel not found for current user';
  END IF;

  UPDATE hotels
  SET config = config || jsonb_build_object(p_key, p_value)
  WHERE id = v_hotel_id;
END;
$$;
