-- Studio P2.4 — computed properties on object types: derived values (sum,
-- difference, product, days-since/until) computed from stored properties at read
-- time. Bounded function grammar, not a formula parser. Stored alongside the
-- schema; maps to ComputedPropertyDef[] in @beacon/reality-graph.

ALTER TABLE object_types
  ADD COLUMN IF NOT EXISTS computed_properties jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN object_types.computed_properties IS
  '[{ key, label, fn: sum|difference|product|days_since|days_until, inputs: [property_key] }] — derived, display-only.';
