-- Migration 207: node-label resolver for Search Around (Foundry parity)
-- Layer: compute (data)
--
-- relationship_edges reference nodes as (type, id) only — no display name. The
-- Search Around graph (and edge chips) need human labels: "Premium Spirits Co",
-- not "supplier:6ab690f1". This resolves a mixed-type batch of node refs to
-- labels in one call. SECURITY INVOKER: each table's RLS scopes the joins to
-- the caller's hotel, so labels only ever resolve for nodes the caller may see.

CREATE OR REPLACE FUNCTION resolve_node_labels(p_refs jsonb)
RETURNS TABLE (node_type text, node_id uuid, label text)
LANGUAGE sql
STABLE
AS $$
  WITH refs AS (
    SELECT (r->>'type') AS t, (r->>'id')::uuid AS id
    FROM jsonb_array_elements(p_refs) r
    WHERE (r->>'id') ~ '^[0-9a-f-]{36}$'
  )
  SELECT 'variant'::text, v.id, COALESCE(p.name || ' · ' || v.name, v.name)
    FROM refs JOIN product_variants v ON v.id = refs.id AND refs.t = 'variant'
    LEFT JOIN products p ON p.id = v.product_id
  UNION ALL
  SELECT 'product', p.id, p.name
    FROM refs JOIN products p ON p.id = refs.id AND refs.t = 'product'
  UNION ALL
  SELECT 'supplier', s.id, s.name
    FROM refs JOIN suppliers s ON s.id = refs.id AND refs.t = 'supplier'
  UNION ALL
  SELECT 'document', d.id, d.title
    FROM refs JOIN documents d ON d.id = refs.id AND refs.t = 'document'
  UNION ALL
  SELECT 'entity', e.id, e.name || ' (' || e.category || ')'
    FROM refs JOIN entities e ON e.id = refs.id AND refs.t = 'entity'
  UNION ALL
  SELECT 'chunk', c.id, 'p.' || c.page::text || ' — ' || left(COALESCE(NULLIF(c.summary, ''), c.text_preview), 60)
    FROM refs JOIN document_chunks c ON c.id = refs.id AND refs.t = 'chunk'
  UNION ALL
  SELECT 'purchase_order', po.id, 'PO ' || COALESCE(po.po_number, left(po.id::text, 8))
    FROM refs JOIN purchase_orders po ON po.id = refs.id AND refs.t = 'purchase_order'
  UNION ALL
  SELECT 'case', ca.id, ca.title
    FROM refs JOIN cases ca ON ca.id = refs.id AND refs.t = 'case'
  UNION ALL
  SELECT 'restock_request', rr.id, 'Restock (' || rr.status || ')'
    FROM refs JOIN restock_requests rr ON rr.id = refs.id AND refs.t = 'restock_request'
  UNION ALL
  SELECT 'proposal', pr.id, 'Proposal (' || pr.status || ')'
    FROM refs JOIN proposals pr ON pr.id = refs.id AND refs.t = 'proposal'
  UNION ALL
  SELECT 'stock_log', sl.id, COALESCE(NULLIF(sl.reason, ''), 'Stock log')
    FROM refs JOIN stock_logs sl ON sl.id = refs.id AND refs.t = 'stock_log';
$$;

REVOKE ALL ON FUNCTION resolve_node_labels(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_node_labels(jsonb) TO authenticated;
