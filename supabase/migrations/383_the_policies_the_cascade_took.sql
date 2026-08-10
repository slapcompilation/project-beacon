-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 383 — three policies and a view that 382's CASCADE removed.
--
-- 382 asserted that every ontology table still had "a policy". It did — object
-- types kept delete and update — so the assertion passed while SELECT and
-- INSERT were gone. A table nobody can read or write is not a table with a
-- policy, and the check should have counted per COMMAND. Doing that here.
--
-- The relationship_edges projection went the same way: it selected hotel_id.
-- Rebuilt on the organization, as 369 rebuilt it on the store.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE POLICY "read object types in scope" ON public.object_types
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));

CREATE POLICY "admins author object types" ON public.object_types
  FOR INSERT WITH CHECK (source_table IS NULL
    AND auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM auth_org_id())
    AND created_by_user_id = auth.uid());

CREATE POLICY "read link types in scope" ON public.link_types
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));

CREATE OR REPLACE VIEW public.relationship_edges AS
  SELECT id, edge_type, source_type, source_id, target_type, target_id,
         organization_id, triggered_by, actor_id, metadata, created_at
    FROM public.relationship_edges_store;

ALTER VIEW public.relationship_edges SET (security_invoker = true);
GRANT SELECT, INSERT ON public.relationship_edges TO authenticated, service_role;

DO $$
DECLARE t text; c "char"; missing text := '';
BEGIN
  -- Per COMMAND, which is the check 382 should have made.
  FOREACH t IN ARRAY ARRAY['object_types','object_records','object_sets','link_types'] LOOP
    FOREACH c IN ARRAY ARRAY['r'::"char", 'a'::"char"] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy p JOIN pg_class cl ON cl.oid = p.polrelid
         WHERE cl.relname = t AND (p.polcmd = c OR p.polcmd = '*')
      ) THEN
        missing := missing || format('%s:%s ', t, c);
      END IF;
    END LOOP;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'Migration 383: no policy for % (table:command)', missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.views
                  WHERE table_schema='public' AND table_name='relationship_edges') THEN
    RAISE EXCEPTION 'Migration 383: the projection did not come back';
  END IF;
END $$;

COMMIT;
