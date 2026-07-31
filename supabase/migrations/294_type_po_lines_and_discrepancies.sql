-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 294 — the ratchet turns: 10 grandfathered tables become 8.
--
-- 293 declared ten domain tables untyped and grandfathered, with the rule that
-- the number may only fall. These two have real data and a settled shape, so
-- they come off the list first:
--
--   purchase_order_lines   8 rows   the PO is typed, its LINES were not
--   po_discrepancies       8 rows   invoice-vs-PO mismatches, unreachable
--
-- Nothing is created but registrations. Every relationship below is already a
-- real foreign key — the ontology simply could not see any of them:
--
--   purchase_order_lines.po_id      -> purchase_orders
--   purchase_order_lines.variant_id -> product_variants
--   purchase_order_lines.request_id -> restock_requests
--   po_discrepancies.po_id          -> purchase_orders
--
-- hotel_id is NOT among them on purpose: tenancy is a column, not an edge. The
-- edge audit removed 35 such pushes and that decision stands.
--
-- reviewed_by (po_discrepancies -> auth.users) is left unregistered. The
-- vocabulary has approved_by/rejected_by/modified_by but no reviewed_by, and
-- inventing a name for one table's column is how vocabularies rot. It gets one
-- when a second reviewer relationship needs it.
--
-- WHAT THIS UNLOCKS. A purchase order can reach the variants it ordered, and a
-- discrepancy can reach the order it disputes:
--
--   purchase_order <- line_of - purchase_order_line - line_orders -> variant
--   purchase_order <- discrepancy_of - po_discrepancy
--
-- and through line_fulfills_request a PO line reaches the restock request it
-- answers, closing request -> order as a traversal rather than two queries.
--
-- The view body is regenerated from the LIVE definition with four branches
-- appended, not retyped. 288 recorded that hand-copying it accumulates debt;
-- generating the FK branches from link_types remains the real fix.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Two object types ──────────────────────────────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, t.api_name, t.label, t.icon, t.description, '[]'::jsonb, 'builtin', t.source_table,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('purchase_order_line', 'PO Line',        'list-detail', 'One line on a purchase order: a variant, a quantity, a cost.', 'purchase_order_lines'),
  ('po_discrepancy',      'PO Discrepancy', 'issue',       'A mismatch between what was ordered, received and invoiced.',  'po_discrepancies')
) AS t(api_name, label, icon, description, source_table)
ON CONFLICT (organization_id, api_name) DO NOTHING;

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── 2. Four names in the vocabulary ──────────────────────────────────────────

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
    'sold','ingredient_of',
    -- 294: purchase-order lines and discrepancies
    'line_of','line_orders','line_fulfills_request','discrepancy_of'
  ));

-- ── 3. Register each over the foreign key that already holds it ──────────────

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
  ('line_of',               'Line Of',               'purchase_order_line', 'purchase_order',  'purchaseOrder',  'Purchase Order',  'lines',          'Lines',           'purchase_order_lines', 'po_id'),
  ('line_orders',           'Line Orders',           'purchase_order_line', 'variant',         'variant',        'Variant',         'orderedOnLines', 'Ordered On Lines','purchase_order_lines', 'variant_id'),
  ('line_fulfills_request', 'Line Fulfills Request', 'purchase_order_line', 'restock_request', 'restockRequest', 'Restock Request', 'orderLines',     'Order Lines',     'purchase_order_lines', 'request_id'),
  ('discrepancy_of',        'Discrepancy Of',        'po_discrepancy',      'purchase_order',  'purchaseOrder',  'Purchase Order',  'discrepancies',  'Discrepancies',   'po_discrepancies',     'po_id')
) AS v(edge_type, label, src_type, tgt_type, tgt_api, tgt_label, src_api, src_label, backing_table, backing_column)
JOIN public.object_types s ON s.api_name = v.src_type AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = v.tgt_type AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

-- ── 4. The view projects them ────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.relationship_edges
WITH (security_invoker = true) AS
 SELECT md5(('causes'::text || link_causes.source_id::text) || link_causes.target_id::text)::uuid AS id,
    'causes'::text AS edge_type,
    'pos_sale'::text AS source_type,
    link_causes.source_id,
    'stock_log'::text AS target_type,
    link_causes.target_id,
    link_causes.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_causes.created_at
   FROM link_causes
UNION ALL
 SELECT md5(('influenced_by_occupancy'::text || link_influenced_by_occupancy.source_id::text) || link_influenced_by_occupancy.target_id::text)::uuid AS id,
    'influenced_by_occupancy'::text AS edge_type,
    'stock_log'::text AS source_type,
    link_influenced_by_occupancy.source_id,
    'occupancy_log'::text AS target_type,
    link_influenced_by_occupancy.target_id,
    link_influenced_by_occupancy.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_influenced_by_occupancy.created_at
   FROM link_influenced_by_occupancy
UNION ALL
 SELECT md5(('influenced_by_principle'::text || link_influenced_by_principle.source_id::text) || link_influenced_by_principle.target_id::text)::uuid AS id,
    'influenced_by_principle'::text AS edge_type,
    'proposal'::text AS source_type,
    link_influenced_by_principle.source_id,
    'principle'::text AS target_type,
    link_influenced_by_principle.target_id,
    link_influenced_by_principle.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_influenced_by_principle.created_at
   FROM link_influenced_by_principle
UNION ALL
 SELECT md5(('mentions'::text || link_mentions.source_id::text) || link_mentions.target_id::text)::uuid AS id,
    'mentions'::text AS edge_type,
    'chunk'::text AS source_type,
    link_mentions.source_id,
    'entity'::text AS target_type,
    link_mentions.target_id,
    link_mentions.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_mentions.created_at
   FROM link_mentions
UNION ALL
 SELECT md5(('linked_to_po'::text || link_linked_to_po.source_id::text) || link_linked_to_po.target_id::text)::uuid AS id,
    'linked_to_po'::text AS edge_type,
    'restock_request'::text AS source_type,
    link_linked_to_po.source_id,
    'purchase_order'::text AS target_type,
    link_linked_to_po.target_id,
    link_linked_to_po.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_linked_to_po.created_at
   FROM link_linked_to_po
UNION ALL
 SELECT md5(('triggered_alert'::text || link_triggered_alert.source_id::text) || link_triggered_alert.target_id::text)::uuid AS id,
    'triggered_alert'::text AS edge_type,
    'stock_log'::text AS source_type,
    link_triggered_alert.source_id,
    'alert'::text AS target_type,
    link_triggered_alert.target_id,
    link_triggered_alert.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_triggered_alert.created_at
   FROM link_triggered_alert
UNION ALL
 SELECT md5(('log_fulfills_request'::text || link_log_fulfills_request.source_id::text) || link_log_fulfills_request.target_id::text)::uuid AS id,
    'log_fulfills_request'::text AS edge_type,
    'stock_log'::text AS source_type,
    link_log_fulfills_request.source_id,
    'restock_request'::text AS target_type,
    link_log_fulfills_request.target_id,
    link_log_fulfills_request.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    link_log_fulfills_request.created_at
   FROM link_log_fulfills_request
UNION ALL
 SELECT md5(('consumes'::text || l.id::text) || l.variant_id::text)::uuid AS id,
    'consumes'::text AS edge_type,
    'stock_log'::text AS source_type,
    l.id AS source_id,
    'variant'::text AS target_type,
    l.variant_id AS target_id,
    l.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    l."timestamp" AS created_at
   FROM stock_logs l
  WHERE l.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('reverts'::text || l.id::text) || l.revert_of::text)::uuid AS id,
    'reverts'::text AS edge_type,
    'stock_log'::text AS source_type,
    l.id AS source_id,
    'stock_log'::text AS target_type,
    l.revert_of AS target_id,
    l.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    l."timestamp" AS created_at
   FROM stock_logs l
  WHERE l.revert_of IS NOT NULL
UNION ALL
 SELECT md5(('sourced_from'::text || v.id::text) || v.default_supplier_id::text)::uuid AS id,
    'sourced_from'::text AS edge_type,
    'variant'::text AS source_type,
    v.id AS source_id,
    'supplier'::text AS target_type,
    v.default_supplier_id AS target_id,
    p.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM product_variants v
     JOIN products p ON p.id = v.product_id
  WHERE v.default_supplier_id IS NOT NULL
UNION ALL
 SELECT md5(('restocks'::text || r.variant_id::text) || r.id::text)::uuid AS id,
    'restocks'::text AS edge_type,
    'variant'::text AS source_type,
    r.variant_id AS source_id,
    'restock_request'::text AS target_type,
    r.id AS target_id,
    r.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    r.created_at
   FROM restock_requests r
  WHERE r.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('approved_by'::text || r.id::text) || r.approved_by::text)::uuid AS id,
    'approved_by'::text AS edge_type,
    'restock_request'::text AS source_type,
    r.id AS source_id,
    'user'::text AS target_type,
    r.approved_by AS target_id,
    r.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    r.created_at
   FROM restock_requests r
  WHERE r.approved_by IS NOT NULL
UNION ALL
 SELECT md5(('fulfills'::text || rc.id::text) || rc.request_id::text)::uuid AS id,
    'fulfills'::text AS edge_type,
    'restock_receive'::text AS source_type,
    rc.id AS source_id,
    'restock_request'::text AS target_type,
    rc.request_id AS target_id,
    r.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM restock_receives rc
     JOIN restock_requests r ON r.id = rc.request_id
UNION ALL
 SELECT md5(('invoiced_by'::text || i.po_id::text) || i.id::text)::uuid AS id,
    'invoiced_by'::text AS edge_type,
    'purchase_order'::text AS source_type,
    i.po_id AS source_id,
    'po_invoice'::text AS target_type,
    i.id AS target_id,
    i.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    i.created_at
   FROM po_invoices i
  WHERE i.po_id IS NOT NULL
UNION ALL
 SELECT md5(('batch_of'::text || b.id::text) || b.variant_id::text)::uuid AS id,
    'batch_of'::text AS edge_type,
    'product_batch'::text AS source_type,
    b.id AS source_id,
    'variant'::text AS target_type,
    b.variant_id AS target_id,
    b.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM product_batches b
  WHERE b.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('derived_from'::text || f.proposal_id::text) || f.id::text)::uuid AS id,
    'derived_from'::text AS edge_type,
    'proposal'::text AS source_type,
    f.proposal_id AS source_id,
    'forecast_observation'::text AS target_type,
    f.id AS target_id,
    f.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    f.created_at
   FROM forecast_observations f
  WHERE f.proposal_id IS NOT NULL
UNION ALL
 SELECT md5(('cited_in'::text || ch.document_id::text) || ch.id::text)::uuid AS id,
    'cited_in'::text AS edge_type,
    'document'::text AS source_type,
    ch.document_id AS source_id,
    'chunk'::text AS target_type,
    ch.id AS target_id,
    ch.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    ch.created_at
   FROM document_chunks ch
  WHERE ch.document_id IS NOT NULL
UNION ALL
 SELECT md5(('delivery_sourced_from'::text || d.id::text) || d.supplier_id::text)::uuid AS id,
    'delivery_sourced_from'::text AS edge_type,
    'delivery_event'::text AS source_type,
    d.id AS source_id,
    'supplier'::text AS target_type,
    d.supplier_id AS target_id,
    d.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    d.created_at
   FROM delivery_events d
  WHERE d.supplier_id IS NOT NULL
UNION ALL
 SELECT md5(('po_sourced_from'::text || po.id::text) || po.supplier_id::text)::uuid AS id,
    'po_sourced_from'::text AS edge_type,
    'purchase_order'::text AS source_type,
    po.id AS source_id,
    'supplier'::text AS target_type,
    po.supplier_id AS target_id,
    po.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    po.created_at
   FROM purchase_orders po
  WHERE po.supplier_id IS NOT NULL
UNION ALL
 SELECT md5(('recipe_consumes'::text || mi.id::text) || mi.variant_id::text)::uuid AS id,
    'recipe_consumes'::text AS edge_type,
    'menu_item_ingredient'::text AS source_type,
    mi.id AS source_id,
    'variant'::text AS target_type,
    mi.variant_id AS target_id,
    NULL::uuid AS hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM menu_item_ingredients mi
  WHERE mi.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('pick_consumes'::text || pi.id::text) || pi.variant_id::text)::uuid AS id,
    'pick_consumes'::text AS edge_type,
    'pick_list_item'::text AS source_type,
    pi.id AS source_id,
    'variant'::text AS target_type,
    pi.variant_id AS target_id,
    NULL::uuid AS hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM pick_list_items pi
  WHERE pi.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('transfer_approved_by'::text || st.id::text) || st.approved_by_user_id::text)::uuid AS id,
    'transfer_approved_by'::text AS edge_type,
    'stock_transfer'::text AS source_type,
    st.id AS source_id,
    'user'::text AS target_type,
    st.approved_by_user_id AS target_id,
    st.to_hotel_id AS hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    st.created_at
   FROM stock_transfers st
  WHERE st.approved_by_user_id IS NOT NULL
UNION ALL
 SELECT md5(('sold'::text || ps.id::text) || ps.menu_item_id::text)::uuid AS id,
    'sold'::text AS edge_type,
    'pos_sale'::text AS source_type,
    ps.id AS source_id,
    'menu_item'::text AS target_type,
    ps.menu_item_id AS target_id,
    ps.hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    ps.created_at
   FROM pos_sales ps
  WHERE ps.menu_item_id IS NOT NULL
UNION ALL
 SELECT md5(('ingredient_of'::text || mi.id::text) || mi.menu_item_id::text)::uuid AS id,
    'ingredient_of'::text AS edge_type,
    'menu_item_ingredient'::text AS source_type,
    mi.id AS source_id,
    'menu_item'::text AS target_type,
    mi.menu_item_id AS target_id,
    NULL::uuid AS hotel_id,
    'system'::text AS triggered_by,
    NULL::uuid AS actor_id,
    '{}'::jsonb AS metadata,
    now() AS created_at
   FROM menu_item_ingredients mi
  WHERE mi.menu_item_id IS NOT NULL
UNION ALL
 SELECT md5(('line_of'::text || l.id::text) || l.po_id::text)::uuid AS id,
    'line_of'::text AS edge_type, 'purchase_order_line'::text AS source_type, l.id AS source_id,
    'purchase_order'::text AS target_type, l.po_id AS target_id,
    l.hotel_id, 'system'::text AS triggered_by, NULL::uuid AS actor_id, '{}'::jsonb AS metadata, now() AS created_at
   FROM purchase_order_lines l WHERE l.po_id IS NOT NULL
UNION ALL
 SELECT md5(('line_orders'::text || l.id::text) || l.variant_id::text)::uuid,
    'line_orders'::text, 'purchase_order_line'::text, l.id,
    'variant'::text, l.variant_id,
    l.hotel_id, 'system'::text, NULL::uuid, '{}'::jsonb, now()
   FROM purchase_order_lines l WHERE l.variant_id IS NOT NULL
UNION ALL
 SELECT md5(('line_fulfills_request'::text || l.id::text) || l.request_id::text)::uuid,
    'line_fulfills_request'::text, 'purchase_order_line'::text, l.id,
    'restock_request'::text, l.request_id,
    l.hotel_id, 'system'::text, NULL::uuid, '{}'::jsonb, now()
   FROM purchase_order_lines l WHERE l.request_id IS NOT NULL
UNION ALL
 SELECT md5(('discrepancy_of'::text || d.id::text) || d.po_id::text)::uuid,
    'discrepancy_of'::text, 'po_discrepancy'::text, d.id,
    'purchase_order'::text, d.po_id,
    d.hotel_id, 'system'::text, NULL::uuid, '{}'::jsonb, d.detected_at
   FROM po_discrepancies d WHERE d.po_id IS NOT NULL
UNION ALL
 SELECT relationship_edges_store.id,
    relationship_edges_store.edge_type,
    relationship_edges_store.source_type,
    relationship_edges_store.source_id,
    relationship_edges_store.target_type,
    relationship_edges_store.target_id,
    relationship_edges_store.hotel_id,
    relationship_edges_store.triggered_by,
    relationship_edges_store.actor_id,
    relationship_edges_store.metadata,
    relationship_edges_store.created_at
   FROM relationship_edges_store;

-- ── 5. The ratchet moves ─────────────────────────────────────────────────────

UPDATE public.shape_registry
   SET classification = 'domain', reason = 'reached by the ontology (294)'
 WHERE object_kind = 'table' AND object_name IN ('purchase_order_lines','po_discrepancies');

UPDATE public.shape_registry
   SET reason = (SELECT count(*)::text FROM shape_registry WHERE classification = 'domain_untyped')
 WHERE object_kind = 'meta' AND object_name = 'domain_untyped_baseline';

-- ── 6. Assert the traversals actually work ───────────────────────────────────

DO $$
DECLARE n_line int; n_ord int; n_disc int; n_chain int; n_untyped int; baseline int;
BEGIN
  SELECT count(*) INTO n_line FROM relationship_edges WHERE edge_type = 'line_of';
  SELECT count(*) INTO n_ord  FROM relationship_edges WHERE edge_type = 'line_orders';
  SELECT count(*) INTO n_disc FROM relationship_edges WHERE edge_type = 'discrepancy_of';
  IF n_line = 0 OR n_ord = 0 OR n_disc = 0 THEN
    RAISE EXCEPTION 'Migration 294: view projects line_of=% line_orders=% discrepancy_of=% — a link nothing can read is a registration, not a relationship',
      n_line, n_ord, n_disc;
  END IF;

  -- The question this exists for: which variants did this order actually order?
  SELECT count(*) INTO n_chain
  FROM relationship_edges lo
  JOIN relationship_edges ord ON ord.source_id = lo.source_id AND ord.edge_type = 'line_orders'
  WHERE lo.edge_type = 'line_of';
  IF n_chain = 0 THEN
    RAISE EXCEPTION 'Migration 294: purchase_order -> line -> variant returns nothing';
  END IF;

  SELECT count(*) INTO n_untyped FROM shape_registry WHERE classification = 'domain_untyped';
  SELECT reason::int INTO baseline FROM shape_registry WHERE object_kind='meta' AND object_name='domain_untyped_baseline';
  IF n_untyped <> 8 OR baseline <> 8 THEN
    RAISE EXCEPTION 'Migration 294: expected 8 grandfathered tables, found % (baseline %)', n_untyped, baseline;
  END IF;
  RAISE NOTICE 'Migration 294: % order->variant paths · grandfathered 10 -> %', n_chain, n_untyped;
END $$;

COMMIT;
