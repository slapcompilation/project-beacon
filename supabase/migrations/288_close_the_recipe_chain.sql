-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 288 — close the recipe chain. Phase C of the shape audit.
--
-- The BOM was typed at both ends and broken in the middle:
--
--   pos_sale ──?──> [ menu_item ] ──?──> menu_item_ingredient ──recipe_consumes──> variant
--     type          NOT A TYPE            type                    FK-backed         type
--
-- recipe_consumes has existed since 263 and menu_item_ingredient is a
-- registered object type, but the DISH was never registered — so a POS sale
-- could not traverse to the stock it consumed, and "which dish is driving my
-- tomato burn" needed bespoke SQL instead of the ontology.
--
-- Nothing is created here but registrations. Both foreign keys already exist:
-- pos_sales.menu_item_id and menu_item_ingredients.menu_item_id have held this
-- relationship all along; the ontology just could not see it.
--
-- After this, pos_sale -> menu_item -> menu_item_ingredient -> variant is three
-- hops, which is exactly Foundry's searchAround depth cap. That is not a
-- coincidence — the cap exists because a chain this long is the useful limit.
--
-- NAMES. `sold` and `ingredient_of`, not two more `consumes`. 263 split the
-- overloaded names for the reason Foundry requires it: one name cannot mean two
-- relationships, and a sale selling a dish is not a recipe listing an
-- ingredient.
--
-- KNOWN COST: this is the third full copy of the view body (262, 264, here).
-- Generating the FK-backed branches from link_types would remove the
-- duplication and belongs with Phase E, where the registry becomes the single
-- source the guards read. Recorded rather than quietly repeated.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The dish becomes an object type ───────────────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, 'menu_item', 'Menu Item', 'clipboard',
       'A dish sold to a guest. Consumes variants through its recipe.',
       '[]'::jsonb, 'builtin', 'menu_items',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- Derive with UPDATE: the function RETURNS the properties, it does not write
-- them (the mistake 253 made and 254 fixed).
UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── 2. Two names in the vocabulary ───────────────────────────────────────────

ALTER TABLE public.relationship_edges_store DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;
ALTER TABLE public.relationship_edges_store
  ADD CONSTRAINT relationship_edges_edge_type_check CHECK (edge_type IN (
    'causes','consumes','restocks','reverts','belongs_to_session','triggered_alert',
    'approved_by','rejected_by','modified_by','fulfills','log_fulfills_request',
    'sourced_from','batch_of','discarded_via','linked_to_po','invoiced_by',
    'influenced_by_occupancy','influenced_by_principle','similar_to','transfers',
    'proposed_by','benchmarks','harmonized_to','describes_entity','cited_in',
    'applies_to','derived_from','mentions','resolved_to',
    'delivery_sourced_from','receipt_sourced_from','po_sourced_from',
    'recipe_consumes','pick_consumes','transfer_approved_by',
    -- 288: the recipe chain
    'sold','ingredient_of'
  ));

-- ── 3. Register both over the foreign key that already holds them ────────────

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
  ('sold',          'Sold',          'pos_sale',             'menu_item', 'menuItem', 'Menu Item', 'sales',       'Sales',       'pos_sales',             'menu_item_id'),
  ('ingredient_of', 'Ingredient Of', 'menu_item_ingredient', 'menu_item', 'menuItem', 'Menu Item', 'ingredients', 'Ingredients', 'menu_item_ingredients', 'menu_item_id')
) AS v(edge_type, label, src_type, tgt_type, tgt_api, tgt_label, src_api, src_label, backing_table, backing_column)
JOIN public.object_types s ON s.api_name = v.src_type AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = v.tgt_type AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

-- ── 4. The view projects them, or they are registrations rather than links ───

CREATE OR REPLACE VIEW public.relationship_edges
WITH (security_invoker = true) AS
  -- Join-table backed (258)
  SELECT md5('causes'||source_id::text||target_id::text)::uuid id, 'causes' edge_type,
         'pos_sale' source_type, source_id, 'stock_log' target_type, target_id,
         hotel_id, 'system'::text triggered_by, NULL::uuid actor_id, '{}'::jsonb metadata, created_at
    FROM public.link_causes
  UNION ALL SELECT md5('influenced_by_occupancy'||source_id::text||target_id::text)::uuid,'influenced_by_occupancy','stock_log',source_id,'occupancy_log',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_influenced_by_occupancy
  UNION ALL SELECT md5('influenced_by_principle'||source_id::text||target_id::text)::uuid,'influenced_by_principle','proposal',source_id,'principle',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_influenced_by_principle
  UNION ALL SELECT md5('mentions'||source_id::text||target_id::text)::uuid,'mentions','chunk',source_id,'entity',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_mentions
  UNION ALL SELECT md5('linked_to_po'||source_id::text||target_id::text)::uuid,'linked_to_po','restock_request',source_id,'purchase_order',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_linked_to_po
  UNION ALL SELECT md5('triggered_alert'||source_id::text||target_id::text)::uuid,'triggered_alert','stock_log',source_id,'alert',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_triggered_alert
  UNION ALL SELECT md5('log_fulfills_request'||source_id::text||target_id::text)::uuid,'log_fulfills_request','stock_log',source_id,'restock_request',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_log_fulfills_request

  -- Foreign-key backed (256/261) — the column IS the relationship
  UNION ALL SELECT md5('consumes'||l.id::text||l.variant_id::text)::uuid,'consumes','stock_log',l.id,'variant',l.variant_id,l.hotel_id,'system',NULL,'{}'::jsonb,l.timestamp
    FROM public.stock_logs l WHERE l.variant_id IS NOT NULL
  UNION ALL SELECT md5('reverts'||l.id::text||l.revert_of::text)::uuid,'reverts','stock_log',l.id,'stock_log',l.revert_of,l.hotel_id,'system',NULL,'{}'::jsonb,l.timestamp
    FROM public.stock_logs l WHERE l.revert_of IS NOT NULL
  UNION ALL SELECT md5('sourced_from'||v.id::text||v.default_supplier_id::text)::uuid,'sourced_from','variant',v.id,'supplier',v.default_supplier_id,p.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.default_supplier_id IS NOT NULL
  UNION ALL SELECT md5('restocks'||r.variant_id::text||r.id::text)::uuid,'restocks','variant',r.variant_id,'restock_request',r.id,r.hotel_id,'system',NULL,'{}'::jsonb,r.created_at
    FROM public.restock_requests r WHERE r.variant_id IS NOT NULL
  UNION ALL SELECT md5('approved_by'||r.id::text||r.approved_by::text)::uuid,'approved_by','restock_request',r.id,'user',r.approved_by,r.hotel_id,'system',NULL,'{}'::jsonb,r.created_at
    FROM public.restock_requests r WHERE r.approved_by IS NOT NULL
  UNION ALL SELECT md5('fulfills'||rc.id::text||rc.request_id::text)::uuid,'fulfills','restock_receive',rc.id,'restock_request',rc.request_id,r.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.restock_receives rc JOIN public.restock_requests r ON r.id = rc.request_id
  UNION ALL SELECT md5('invoiced_by'||i.po_id::text||i.id::text)::uuid,'invoiced_by','purchase_order',i.po_id,'po_invoice',i.id,i.hotel_id,'system',NULL,'{}'::jsonb,i.created_at
    FROM public.po_invoices i WHERE i.po_id IS NOT NULL
  UNION ALL SELECT md5('batch_of'||b.id::text||b.variant_id::text)::uuid,'batch_of','product_batch',b.id,'variant',b.variant_id,b.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.product_batches b WHERE b.variant_id IS NOT NULL
  UNION ALL SELECT md5('derived_from'||f.proposal_id::text||f.id::text)::uuid,'derived_from','proposal',f.proposal_id,'forecast_observation',f.id,f.hotel_id,'system',NULL,'{}'::jsonb,f.created_at
    FROM public.forecast_observations f WHERE f.proposal_id IS NOT NULL
  UNION ALL SELECT md5('cited_in'||ch.document_id::text||ch.id::text)::uuid,'cited_in','document',ch.document_id,'chunk',ch.id,ch.hotel_id,'system',NULL,'{}'::jsonb,ch.created_at
    FROM public.document_chunks ch WHERE ch.document_id IS NOT NULL

  -- 263: relationships that had been sharing a name
  UNION ALL SELECT md5('delivery_sourced_from'||d.id::text||d.supplier_id::text)::uuid,'delivery_sourced_from','delivery_event',d.id,'supplier',d.supplier_id,d.hotel_id,'system',NULL,'{}'::jsonb,d.created_at
    FROM public.delivery_events d WHERE d.supplier_id IS NOT NULL
  UNION ALL SELECT md5('po_sourced_from'||po.id::text||po.supplier_id::text)::uuid,'po_sourced_from','purchase_order',po.id,'supplier',po.supplier_id,po.hotel_id,'system',NULL,'{}'::jsonb,po.created_at
    FROM public.purchase_orders po WHERE po.supplier_id IS NOT NULL
  UNION ALL SELECT md5('recipe_consumes'||mi.id::text||mi.variant_id::text)::uuid,'recipe_consumes','menu_item_ingredient',mi.id,'variant',mi.variant_id,NULL::uuid,'system',NULL,'{}'::jsonb,now()
    FROM public.menu_item_ingredients mi WHERE mi.variant_id IS NOT NULL
  UNION ALL SELECT md5('pick_consumes'||pi.id::text||pi.variant_id::text)::uuid,'pick_consumes','pick_list_item',pi.id,'variant',pi.variant_id,NULL::uuid,'system',NULL,'{}'::jsonb,now()
    FROM public.pick_list_items pi WHERE pi.variant_id IS NOT NULL
  UNION ALL SELECT md5('transfer_approved_by'||st.id::text||st.approved_by_user_id::text)::uuid,'transfer_approved_by','stock_transfer',st.id,'user',st.approved_by_user_id,st.to_hotel_id,'system',NULL,'{}'::jsonb,st.created_at
    FROM public.stock_transfers st WHERE st.approved_by_user_id IS NOT NULL

  -- 288: the two hops that close the recipe chain
  UNION ALL SELECT md5('sold'||ps.id::text||ps.menu_item_id::text)::uuid,'sold','pos_sale',ps.id,'menu_item',ps.menu_item_id,ps.hotel_id,'system',NULL,'{}'::jsonb,ps.created_at
    FROM public.pos_sales ps WHERE ps.menu_item_id IS NOT NULL
  UNION ALL SELECT md5('ingredient_of'||mi.id::text||mi.menu_item_id::text)::uuid,'ingredient_of','menu_item_ingredient',mi.id,'menu_item',mi.menu_item_id,NULL::uuid,'system',NULL,'{}'::jsonb,now()
    FROM public.menu_item_ingredients mi WHERE mi.menu_item_id IS NOT NULL

  -- Not yet backed
  UNION ALL SELECT id, edge_type, source_type, source_id, target_type, target_id,
                   hotel_id, triggered_by, actor_id, metadata, created_at
    FROM public.relationship_edges_store;

-- ── 5. Assert the chain actually traverses ───────────────────────────────────

DO $$
DECLARE n_sold int; n_ing int; n_chain int;
BEGIN
  SELECT count(*) INTO n_sold FROM relationship_edges WHERE edge_type = 'sold';
  SELECT count(*) INTO n_ing  FROM relationship_edges WHERE edge_type = 'ingredient_of';
  IF n_sold = 0 OR n_ing = 0 THEN
    RAISE EXCEPTION 'Migration 288: view projects sold=% ingredient_of=% — a link nothing can read is a registration, not a relationship', n_sold, n_ing;
  END IF;

  -- The whole point: a sale reaching the stock it consumed, in three hops.
  SELECT count(*) INTO n_chain
  FROM relationship_edges s
  JOIN relationship_edges i ON i.target_id = s.target_id AND i.edge_type = 'ingredient_of'
  JOIN relationship_edges r ON r.source_id = i.source_id AND r.edge_type = 'recipe_consumes'
  WHERE s.edge_type = 'sold';
  IF n_chain = 0 THEN
    RAISE EXCEPTION 'Migration 288: pos_sale -> menu_item -> ingredient -> variant returns nothing';
  END IF;
  RAISE NOTICE 'Migration 288: recipe chain traverses — % sale->variant paths', n_chain;
END $$;

COMMIT;
