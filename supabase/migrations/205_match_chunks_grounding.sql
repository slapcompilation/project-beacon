-- Migration 205: enrich match_document_chunks for grounded, citable answers (P9)
-- Layer: compute (search)
--
-- The document copilot answers over retrieved chunks and must cite them by
-- document title + page. The Track-1/2 pipeline now stores a per-chunk summary
-- (the embed target) and full text, so retrieval should return both plus the
-- document title — not just the 240-char preview. Same params; the RETURNS
-- TABLE grows, so DROP + recreate. Extra columns are ignored by existing
-- callers (the agents' GraphReader maps by name).

DROP FUNCTION IF EXISTS match_document_chunks(uuid, vector, float, int);

CREATE FUNCTION match_document_chunks(
  p_hotel_id  uuid,
  p_query     vector(1536),
  p_threshold float DEFAULT 0.70,
  p_limit     int   DEFAULT 8
)
RETURNS TABLE (
  id             uuid,
  document_id    uuid,
  document_title text,
  chunk_key      text,
  page           int,
  text_preview   text,
  summary        text,
  text_full      text,
  similarity     float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    d.title AS document_title,
    c.chunk_key,
    c.page,
    c.text_preview,
    c.summary,
    c.text_full,
    1 - (c.embedding <=> p_query) AS similarity
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE c.hotel_id  = p_hotel_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_query) >= p_threshold
  ORDER BY c.embedding <=> p_query
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION match_document_chunks(uuid, vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_document_chunks(uuid, vector, float, int) TO authenticated;
