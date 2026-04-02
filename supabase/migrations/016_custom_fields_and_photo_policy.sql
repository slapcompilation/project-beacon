-- Sprint 15: Custom fields + per-category photo policy
-- 1. product_custom_field_defs — hotel-scoped typed field definitions
-- 2. custom_values JSONB on product_variants — stores values keyed by field_def id
-- 3. require_photo_for_removal_over on categories — photo policy threshold

-- ─── 1. Custom field definitions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_custom_field_defs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   uuid        NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  field_type text        NOT NULL DEFAULT 'text'
             CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_custom_field_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON product_custom_field_defs
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON product_custom_field_defs
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_hotel
  ON product_custom_field_defs (hotel_id, sort_order);

-- ─── 2. Custom values on product_variants ────────────────────────────────────
-- Stored as JSONB keyed by field_def id: { "<uuid>": "value", ... }

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS custom_values jsonb NOT NULL DEFAULT '{}';

-- ─── 3. Photo policy on categories ───────────────────────────────────────────
-- NULL = no requirement. N = require a photo when removal quantity > N.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS require_photo_for_removal_over integer;
