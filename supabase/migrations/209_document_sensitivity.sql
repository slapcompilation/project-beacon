-- P8 Data-sensitivity marking (Foundry Data-Protection parity). A classification
-- on documents that PROPAGATES to their chunks and GATES retrieval at the LLM
-- boundary: an under-cleared user's copilot/agent answer never sees confidential
-- or restricted content, because the marking is enforced in the deepest place —
-- the RLS on documents + document_chunks — so no RPC or direct read can bypass it.
--
-- The marking is derived from content by the PII scanner (governance/pii.ts, run
-- at ingest), not left to an operator to remember to set.

-- ── Marking columns ─────────────────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'internal'
    CHECK (sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  ADD COLUMN IF NOT EXISTS pii_types text[] NOT NULL DEFAULT '{}';

-- ── Clearance model ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sensitivity_rank(s text) RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE s
    WHEN 'public' THEN 0 WHEN 'internal' THEN 1
    WHEN 'confidential' THEN 2 WHEN 'restricted' THEN 3
    ELSE 1 END;
$$;

-- The highest sensitivity rank the caller may read. Admins/owners see everything;
-- everyone else is capped at 'internal' (no confidential/restricted content).
-- Purpose-based per-role tuning is a later increment; this is the role→clearance
-- floor. Reads the caller's JWT via auth_role() (invoker), so no DEFINER exposure.
CREATE OR REPLACE FUNCTION user_doc_clearance() RETURNS int
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN auth_role() IN ('owner', 'admin') THEN 3 ELSE 1 END;
$$;

-- ── Enforcement: gate reads by clearance (the LLM boundary + exposure) ───────
-- documents: hide the row (and thus its storage_path + preview) above clearance.
DROP POLICY IF EXISTS "users read documents in scope" ON documents;
CREATE POLICY "users read documents in scope" ON documents
  FOR SELECT TO authenticated
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND sensitivity_rank(sensitivity) <= user_doc_clearance()
  );

-- Write side: an under-cleared user must not modify or delete a document above
-- their clearance (e.g. lower a restricted doc to read it). USING gates which
-- rows they can touch; WITH CHECK still lets a cleared user set any new level.
DROP POLICY IF EXISTS "users update documents in scope" ON documents;
CREATE POLICY "users update documents in scope" ON documents
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id) AND sensitivity_rank(sensitivity) <= user_doc_clearance())
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users delete documents in scope" ON documents;
CREATE POLICY "users delete documents in scope" ON documents
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id) AND sensitivity_rank(sensitivity) <= user_doc_clearance());

-- document_chunks: the parsed content that reaches an LLM (text_full, summaries)
-- via match_document_chunks / query_document_chunks — both SECURITY INVOKER, so
-- this policy governs them automatically.
DROP POLICY IF EXISTS "users read chunks in scope" ON document_chunks;
CREATE POLICY "users read chunks in scope" ON document_chunks
  FOR SELECT TO authenticated
  USING (
    hotel_is_in_user_scope(hotel_id)
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_chunks.document_id
        AND sensitivity_rank(d.sensitivity) <= user_doc_clearance()
    )
  );

-- The old chunk write policy was FOR ALL — its USING clause also governed SELECT
-- and (permissive OR) bypassed the clearance read policy above. Split into
-- write-only commands so SELECT is governed solely by clearance. (Chunks are
-- pipeline-written by the service role, which bypasses RLS anyway.)
DROP POLICY IF EXISTS "users write chunks in scope" ON document_chunks;
CREATE POLICY "users insert chunks in scope" ON document_chunks
  FOR INSERT TO authenticated
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "users update chunks in scope" ON document_chunks
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));
CREATE POLICY "users delete chunks in scope" ON document_chunks
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));
