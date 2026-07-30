-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 260 — rebuild relationship_edges from the real backings.
--
-- 259 emptied the table before its READERS were migrated. Thirteen functions
-- still select from it — get_hotel_graph, get_causal_trace, get_node_edges,
-- get_variant_flow and others — so the graph surface went blank and contract C7
-- failed on the next run. The retirement was correct in direction and wrong in
-- order: the backings should feed the readers before the old rows go.
--
-- Nothing irreplaceable was lost. Every retired relationship is now derivable:
-- 4,071 links sit in the link_* tables with real foreign keys, and the other ten
-- relationships are foreign key columns that were always the source of truth.
-- The only rows not coming back are the 2,574 that referenced deleted endpoints,
-- which is the point — they could never be reconstructed because the things they
-- pointed at do not exist.
--
-- relationship_edges is therefore now a PROJECTION of the backings, not a store.
-- It stays until the readers move to link types (Tier 2.3), and this migration is
-- the seam that lets that happen one function at a time instead of all at once.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Join-table backed (258) ──────────────────────────────────────────────────
INSERT INTO relationship_edges (edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, created_at)
SELECT 'causes','pos_sale',source_id,'stock_log',target_id,hotel_id,'system',created_at FROM link_causes
UNION ALL SELECT 'influenced_by_occupancy','stock_log',source_id,'occupancy_log',target_id,hotel_id,'system',created_at FROM link_influenced_by_occupancy
UNION ALL SELECT 'influenced_by_principle','proposal',source_id,'principle',target_id,hotel_id,'system',created_at FROM link_influenced_by_principle
UNION ALL SELECT 'mentions','chunk',source_id,'entity',target_id,hotel_id,'system',created_at FROM link_mentions
UNION ALL SELECT 'linked_to_po','restock_request',source_id,'purchase_order',target_id,hotel_id,'system',created_at FROM link_linked_to_po
UNION ALL SELECT 'triggered_alert','stock_log',source_id,'alert',target_id,hotel_id,'system',created_at FROM link_triggered_alert
UNION ALL SELECT 'log_fulfills_request','stock_log',source_id,'restock_request',target_id,hotel_id,'system',created_at FROM link_log_fulfills_request;

-- ── Foreign-key backed (256) — projected straight from the columns ───────────
INSERT INTO relationship_edges (edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, created_at)
SELECT 'consumes','stock_log',l.id,'variant',l.variant_id,l.hotel_id,'system',l.timestamp
  FROM stock_logs l WHERE l.variant_id IS NOT NULL
UNION ALL
SELECT 'reverts','stock_log',l.id,'stock_log',l.revert_of,l.hotel_id,'system',l.timestamp
  FROM stock_logs l WHERE l.revert_of IS NOT NULL
UNION ALL
SELECT 'sourced_from','variant',v.id,'supplier',v.default_supplier_id,p.hotel_id,'system',now()
  FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.default_supplier_id IS NOT NULL
UNION ALL
SELECT 'restocks','variant',r.variant_id,'restock_request',r.id,r.hotel_id,'system',r.created_at
  FROM restock_requests r WHERE r.variant_id IS NOT NULL
UNION ALL
SELECT 'approved_by','restock_request',r.id,'user',r.approved_by,r.hotel_id,'system',r.created_at
  FROM restock_requests r WHERE r.approved_by IS NOT NULL
UNION ALL
SELECT 'fulfills','restock_receive',rc.id,'restock_request',rc.request_id,r.hotel_id,'system',now()
  FROM restock_receives rc JOIN restock_requests r ON r.id = rc.request_id WHERE rc.request_id IS NOT NULL
UNION ALL
SELECT 'invoiced_by','purchase_order',i.po_id,'po_invoice',i.id,i.hotel_id,'system',i.created_at
  FROM po_invoices i WHERE i.po_id IS NOT NULL
UNION ALL
SELECT 'batch_of','product_batch',b.id,'variant',b.variant_id,b.hotel_id,'system',now()
  FROM product_batches b WHERE b.variant_id IS NOT NULL
UNION ALL
SELECT 'derived_from','proposal',f.proposal_id,'forecast_observation',f.id,f.hotel_id,'system',f.created_at
  FROM forecast_observations f WHERE f.proposal_id IS NOT NULL
UNION ALL
SELECT 'cited_in','document',ch.document_id,'chunk',ch.id,ch.hotel_id,'system',now()
  FROM document_chunks ch WHERE ch.document_id IS NOT NULL;

DO $$
DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM relationship_edges;
  RAISE NOTICE 'relationship_edges rebuilt from backings: % rows', n;
END $$;

COMMIT;
