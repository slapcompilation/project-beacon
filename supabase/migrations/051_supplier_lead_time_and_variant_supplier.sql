-- Migration 051: Supplier lead time + variant default supplier
-- Purpose: Enables cross-domain synthesis in RowIntelStrip and action queue.
-- With lead_time_days on suppliers and default_supplier_id on variants, the UI
-- can compute "days left vs lead time = gap" and surface "order now" decisions.

-- Add lead time to suppliers (nullable — not all suppliers have SLAs)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT NULL;

-- Link variants to their default supplier for automated synthesis
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid
    REFERENCES suppliers(id) ON DELETE SET NULL DEFAULT NULL;

-- Index for fast variant→supplier lookup
CREATE INDEX IF NOT EXISTS idx_variants_default_supplier
  ON product_variants(default_supplier_id)
  WHERE default_supplier_id IS NOT NULL;

-- Add dismissed_reason to notifications (Move 3: feedback signal)
-- Stores the operator's reason for dismissing an alert, forming the
-- training dataset that makes the intelligence layer learn over time.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dismissed_reason text DEFAULT NULL;

COMMENT ON COLUMN suppliers.lead_time_days IS
  'Average delivery lead time in calendar days. Used for gap analysis: if days_until_zero < lead_time_days, operator must order today.';

COMMENT ON COLUMN product_variants.default_supplier_id IS
  'Primary supplier for restocking this variant. Enables cross-domain synthesis: stock + supplier lead time = actionable restock decision.';

COMMENT ON COLUMN notifications.dismissed_reason IS
  'Operator feedback on why this alert was dismissed. Values: resolved, already_knew, incorrect_data, will_handle_later. Null = dismissed without reason.';
