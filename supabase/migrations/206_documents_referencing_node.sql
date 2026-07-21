-- Migration 206: reverse document lineage for Object Views (P10)
-- Layer: compute (search)
--
-- The ingestion pipeline links documents to operational nodes two ways:
--   describes_entity : document -> supplier|variant   (human-approved link)
--   resolved_to      : entity   -> supplier|variant   (deterministic auto-match)
--                      reached from the node via mentions (chunk -> entity)
--                      and cited_in (document -> chunk).
-- Nothing surfaced this on the node's own page. This RPC answers, for a
-- supplier or variant, "which documents reference me, how, and where" — one
-- row per (document, link_kind) with a representative page + snippet for the
-- mentioned path. SECURITY INVOKER: every underlying table is RLS-scoped by
-- hotel, so the traversal only ever sees the caller's documents.

CREATE OR REPLACE FUNCTION documents_referencing_node(
  p_hotel_id  uuid,
  p_node_type text,   -- 'supplier' | 'variant'
  p_node_id   uuid
)
RETURNS TABLE (
  document_id     uuid,
  document_title  text,
  ingestion_stage text,
  link_kind       text,   -- 'described' (approved) | 'mentioned' (auto via entity)
  page            int,
  snippet         text
)
LANGUAGE sql
STABLE
AS $$
  WITH direct AS (
    -- Approved describes_entity edges point straight at the document.
    SELECT e.source_id AS document_id, 'described'::text AS link_kind,
           NULL::int AS page, NULL::text AS snippet
    FROM relationship_edges e
    WHERE e.edge_type   = 'describes_entity'
      AND e.source_type = 'document'
      AND e.target_type = p_node_type
      AND e.target_id   = p_node_id
      AND e.hotel_id    = p_hotel_id
  ),
  via_entity AS (
    -- resolved_to (entity -> node) -> mentions (chunk -> entity) -> chunk -> document.
    -- Keep the lowest-page chunk per document as the representative citation.
    SELECT DISTINCT ON (dc.document_id)
           dc.document_id, 'mentioned'::text AS link_kind,
           dc.page, dc.text_preview AS snippet
    FROM relationship_edges r
    JOIN relationship_edges m
      ON m.edge_type = 'mentions' AND m.target_type = 'entity' AND m.target_id = r.source_id
    JOIN document_chunks dc ON dc.id = m.source_id
    WHERE r.edge_type = 'resolved_to'
      AND r.target_id = p_node_id
      AND r.hotel_id  = p_hotel_id
    ORDER BY dc.document_id, dc.page
  ),
  combined AS (
    SELECT * FROM direct
    UNION ALL
    SELECT * FROM via_entity
  )
  -- One row per (document, link_kind); 'described' wins if a doc appears both ways
  -- is handled at the UI by preferring described, but we return both so the
  -- provenance is explicit.
  SELECT DISTINCT ON (c.document_id, c.link_kind)
         c.document_id,
         d.title           AS document_title,
         d.ingestion_stage,
         c.link_kind,
         c.page,
         c.snippet
  FROM combined c
  JOIN documents d ON d.id = c.document_id
  WHERE d.hotel_id = p_hotel_id
  ORDER BY c.document_id, c.link_kind, c.page NULLS FIRST;
$$;

REVOKE ALL ON FUNCTION documents_referencing_node(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION documents_referencing_node(uuid, text, uuid) TO authenticated;
