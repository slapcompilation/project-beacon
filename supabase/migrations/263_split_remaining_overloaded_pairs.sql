-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 263 — the six relationships the row-counting audit could not see.
--
-- 252 split the overloaded edge-type names it could SEE. The link-type audit
-- measured 22 (edge_type, source_type, target_type) triples from DATA, and these
-- six pairs have no rows, so they were invisible to it. The code emits them; the
-- database has simply never been asked to store one.
--
-- They surfaced when removing "redundant" edge writes nearly deleted them:
--
--   sourced_from  delivery_event   -> supplier    (registered pair: variant -> supplier)
--   sourced_from  restock_receive  -> supplier
--   sourced_from  purchase_order   -> supplier
--   consumes      menu_item_ingredient -> variant (registered pair: stock_log -> variant)
--   consumes      pick_list_item   -> variant
--   approved_by   stock_transfer   -> user        (registered pair: restock_request -> user)
--
-- Each is a distinct real-world relationship — a recipe consuming a variant is
-- not a stock movement consuming one — so each gets its own name, its own link
-- type and its own backing, exactly as Foundry requires. Every backing already
-- exists as a foreign key; nothing is created but registrations.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The three endpoint object types these need ────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, t.api_name, t.label, t.icon, t.description, '[]'::jsonb, 'builtin', t.source_table,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('delivery_event',       'Delivery',          'import',   'Stock arriving from a supplier.',            'delivery_events'),
  ('menu_item_ingredient', 'Recipe Ingredient', 'clipboard','A variant a menu item is made from.',        'menu_item_ingredients'),
  ('pick_list_item',       'Pick List Item',    'list',     'A line on a pick list.',                     'pick_list_items')
) AS t(api_name, label, icon, description, source_table)
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- Derive with UPDATE: the function RETURNS the properties, it does not write them
-- (the mistake 253 made and 254 fixed).
UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── 2. Distinct names, because one name cannot mean two relationships ────────

ALTER TABLE public.relationship_edges_store DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;
ALTER TABLE public.relationship_edges_store
  ADD CONSTRAINT relationship_edges_edge_type_check CHECK (edge_type IN (
    'causes','consumes','restocks','reverts','belongs_to_session','triggered_alert',
    'approved_by','rejected_by','modified_by','fulfills','log_fulfills_request',
    'sourced_from','batch_of','discarded_via','linked_to_po','invoiced_by',
    'influenced_by_occupancy','influenced_by_principle','similar_to','transfers',
    'proposed_by','benchmarks','harmonized_to','describes_entity','cited_in',
    'applies_to','derived_from','mentions','resolved_to',
    -- 263: the pairs that had been sharing a name
    'delivery_sourced_from','receipt_sourced_from','po_sourced_from',
    'recipe_consumes','pick_consumes','transfer_approved_by'
  ));

-- ── 3. Register the six, each over the foreign key that already holds it ─────

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type, created_by_user_id)
SELECT o.id, s.id, t.id, v.edge_type, v.label, v.tgt_api, v.tgt_label, v.src_api, v.src_label,
       'many_to_one', 'foreign_key', v.backing_table, v.backing_column, 'builtin', v.edge_type,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('delivery_sourced_from','Delivery Sourced From','delivery_event','supplier','supplier','Supplier','deliveries','Deliveries','delivery_events','supplier_id'),
  ('receipt_sourced_from', 'Receipt Sourced From', 'restock_receive','supplier','supplier','Supplier','receipts','Receipts','restock_receives','supplier_id'),
  ('po_sourced_from',      'PO Sourced From',      'purchase_order','supplier','supplier','Supplier','purchaseOrders','Purchase Orders','purchase_orders','supplier_id'),
  ('recipe_consumes',      'Recipe Consumes',      'menu_item_ingredient','variant','variant','Variant','recipeIngredients','Recipe Ingredients','menu_item_ingredients','variant_id'),
  ('pick_consumes',        'Pick Consumes',        'pick_list_item','variant','variant','Variant','pickListItems','Pick List Items','pick_list_items','variant_id'),
  ('transfer_approved_by', 'Transfer Approved By', 'stock_transfer','user','approvedBy','Approved By','approvedTransfers','Approved Transfers','stock_transfers','approved_by_user_id')
) AS v(edge_type, label, src_type, tgt_type, tgt_api, tgt_label, src_api, src_label, backing_table, backing_column)
JOIN public.object_types s ON s.organization_id = o.id AND s.api_name = v.src_type AND s.kind = 'builtin'
JOIN public.object_types t ON t.organization_id = o.id AND t.api_name = v.tgt_type AND t.kind = 'builtin'
ON CONFLICT DO NOTHING;

-- Every one of the six must have landed. ON CONFLICT DO NOTHING hid a dropped
-- link type once already (256); it does not get to do that twice.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM link_types WHERE edge_type IN
    ('delivery_sourced_from','receipt_sourced_from','po_sourced_from','recipe_consumes','pick_consumes','transfer_approved_by');
  IF n <> 6 THEN RAISE EXCEPTION 'Migration 263: expected 6 new link types, registered %', n; END IF;
END $$;

COMMIT;
