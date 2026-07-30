-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 253 — register the nine object types the link graph points at.
--
-- Prerequisite for Tier 2.2. Foundry links relate two OBJECT TYPES, so a
-- relationship whose endpoint is not a registered type cannot become a link type
-- at all. Nine of our seventeen relationships were blocked that way, including
-- the three highest-volume ones we have:
--
--   causes                  pos_sale -> stock_log            2548 edges
--   influenced_by_occupancy stock_log -> occupancy_log       3802 edges
--   mentions / cited_in     chunk -> entity, document -> chunk
--
-- Registering half the link types and leaving the rest as raw edges would
-- recreate the split Tier 2 exists to remove, so the endpoints come first.
--
-- Same shape as migration 223: kind='builtin', source_table names where the
-- records actually live, properties derived from the table's columns by 227.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, t.api_name, t.label, t.icon, t.description, '[]'::jsonb, 'builtin', t.source_table,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('pos_sale',             'POS Sale',             'shopping-cart', 'A point-of-sale transaction that drew down stock.',      'pos_sales'),
  ('occupancy_log',        'Occupancy Log',        'people',        'Recorded occupancy for a property on a date.',           'occupancy_logs'),
  ('chunk',                'Document Chunk',       'paragraph',     'A passage of an ingested document, with its page.',      'document_chunks'),
  ('entity',               'Entity',               'tag',           'A named thing discovered in a document.',                'entities'),
  ('alert',                'Alert',                'warning-sign',  'A raised operational signal.',                           'alerts'),
  ('po_invoice',           'PO Invoice',           'dollar',        'An invoice received against a purchase order.',          'po_invoices'),
  ('restock_receive',      'Restock Receipt',      'import',        'Stock received against a restock request.',              'restock_receives'),
  ('forecast_observation', 'Forecast Observation', 'timeline-line-chart', 'A recorded forecast and what actually happened.', 'forecast_observations'),
  ('user',                 'User',                 'user',          'A person acting in the organization.',                   'user_profiles')
) AS t(api_name, label, icon, description, source_table)
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- Derive each new type's properties from its backing table (migration 227), so
-- a cohort or tool can filter them the moment they exist.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT source_table FROM public.object_types
    WHERE kind = 'builtin' AND source_table IN (
      'pos_sales','occupancy_logs','document_chunks','entities','alerts',
      'po_invoices','restock_receives','forecast_observations','user_profiles')
  LOOP
    PERFORM public.derive_object_type_properties(r.source_table);
  END LOOP;
END $$;

-- Title keys — what an object view shows as the record's name. Only where the
-- table actually has a text column worth showing; the drift guard (228) checks
-- that a declared title_key is a real property, so a wrong guess fails CI.
UPDATE public.object_types t SET title_key = v.title_key
FROM (VALUES
  ('entity', 'name'),
  ('alert',  'title')
) AS v(api_name, title_key)
WHERE t.api_name = v.api_name
  AND t.kind = 'builtin'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.properties) p
    WHERE p->>'key' = v.title_key
  );

COMMIT;
