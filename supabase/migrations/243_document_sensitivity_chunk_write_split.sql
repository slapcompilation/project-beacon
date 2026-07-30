-- Recovered from supabase_migrations version 20260722052937.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- The chunk write policy was FOR ALL, so its USING clause also governed SELECT
-- and (permissive OR) bypassed the clearance-gated read policy. Split it into
-- write-only commands so SELECT is governed solely by the clearance policy.
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
