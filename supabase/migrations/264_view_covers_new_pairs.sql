-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 264 — the view projects the six relationships 263 registered.
--
-- A link type nothing can read is a registration, not a relationship. 263 gave
-- each of the six its own name and backing; this makes them appear in
-- relationship_edges alongside every other backed relationship, so the thirteen
-- readers see them without being touched.
--
-- receipt_sourced_from is deliberately absent: restock_receives.supplier_id has
-- a foreign key but the table has no hotel_id of its own, and inventing one by
-- joining through the request would make the view's tenancy depend on a second
-- table. It is registered as a link type and will project once its scope column
-- is settled — recorded here rather than guessed at.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

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

  -- Not yet backed
  UNION ALL SELECT id, edge_type, source_type, source_id, target_type, target_id,
                   hotel_id, triggered_by, actor_id, metadata, created_at
    FROM public.relationship_edges_store;

COMMIT;
