-- Recovered from supabase_migrations version 20260722053448.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Close the write side: an under-cleared user must not be able to modify or
-- delete a document above their clearance (e.g. lower a restricted doc to read
-- it). USING gates which rows they can touch; WITH CHECK still lets a cleared
-- user set any new level.
DROP POLICY IF EXISTS "users update documents in scope" ON documents;
CREATE POLICY "users update documents in scope" ON documents
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id) AND sensitivity_rank(sensitivity) <= user_doc_clearance())
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users delete documents in scope" ON documents;
CREATE POLICY "users delete documents in scope" ON documents
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id) AND sensitivity_rank(sensitivity) <= user_doc_clearance());
