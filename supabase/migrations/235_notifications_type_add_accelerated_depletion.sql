-- Recovered from supabase_migrations version 20260430225610.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Hotfix to migration 117: extend notifications.type CHECK to allow the new
-- 'accelerated_depletion' type. The smoke test (per CLAUDE.md self-apply rule
-- #1) caught this — insert was rejected by the existing constraint.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'low_stock'::text,
    'expiry'::text,
    'restock_request'::text,
    'waste_spike'::text,
    'pos_variance'::text,
    'po_discrepancy'::text,
    'contract_expiry'::text,
    'approval'::text,
    'system'::text,
    'predicted_outage'::text,
    'waste_alert'::text,
    'consumption_spike'::text,
    'price_drift'::text,
    'accelerated_depletion'::text
  ]));
