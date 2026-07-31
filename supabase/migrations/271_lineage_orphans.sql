-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 271 — orphans become visible and reapable. Tier 4.1.
--
-- Audit §10.3: Foundry's Data Lifetime applies LINEAGE-AWARE retention — deleting
-- governs a dataset's transactions and all descendants, "preventing orphaned or
-- incomplete removal". We had the failure in BOTH directions at once: D3 deleted
-- too much along one edge (a user deletion took their documents), D4 too little
-- along another (23 entities outlived the documents that produced them, and are
-- still here).
--
-- D3's half is fixed — migration 231 made provenance FKs SET NULL. This is D4's.
--
-- NOT AUTOMATIC, deliberately. Migration 204 states that entity rows are "stable
-- vocabulary and stay": re-ingesting a document should find the same entity, not
-- mint a new one, and resolved_to edges built by harmonization hang off them. A
-- trigger that deleted an entity on its last mention would quietly reverse a
-- decision someone made on purpose. So: make them visible, make reaping one
-- explicit admin action, and say why the automatic version is wrong.
--
-- Which is also the audit's own recommendation: "either cascade them or make
-- orphan entities visible and reapable."
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.ontology_orphans()
RETURNS TABLE (kind text, id uuid, label text, reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  -- An entity exists to be mentioned. Nothing mentions it and nothing resolved
  -- it to an operational node, so it is vocabulary with no source and no use.
  SELECT 'entity', e.id, e.name,
         'no chunk mentions it and it resolves to nothing'
  FROM entities e
  WHERE NOT EXISTS (SELECT 1 FROM link_mentions m WHERE m.target_id = e.id)
    AND NOT EXISTS (
      SELECT 1 FROM relationship_edges_store re
      WHERE re.edge_type = 'resolved_to' AND re.source_id = e.id)

  UNION ALL
  -- Suggestions about a document that is gone. The FK cascades these today, so
  -- this is a tripwire for a path that stops doing so.
  SELECT 'entity_link_suggestion', s.id, s.chunk_key, 'its document no longer exists'
  FROM entity_link_suggestions s
  WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = s.document_id);
$$;

COMMENT ON FUNCTION public.ontology_orphans() IS
  'Derived nodes whose source is gone — the D4 half of lineage-aware retention. Reported rather than reaped automatically: entities are stable vocabulary by design (migration 204), so deleting one on its last mention would reverse a deliberate decision.';

CREATE OR REPLACE FUNCTION public.reap_ontology_orphans()
RETURNS TABLE (kind text, reaped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n_entities int; n_sugg int;
BEGIN
  IF auth_role() NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only owner or admin may reap orphans' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Scope matters as much as role: an admin reaps their own organization's
  -- vocabulary, never a neighbour's.
  DELETE FROM entities e
   WHERE e.id IN (SELECT o.id FROM ontology_orphans() o WHERE o.kind = 'entity')
     AND hotel_is_in_user_scope(e.hotel_id);
  GET DIAGNOSTICS n_entities = ROW_COUNT;

  DELETE FROM entity_link_suggestions s
   WHERE s.id IN (SELECT o.id FROM ontology_orphans() o WHERE o.kind = 'entity_link_suggestion')
     AND hotel_is_in_user_scope(s.hotel_id);
  GET DIAGNOSTICS n_sugg = ROW_COUNT;

  RETURN QUERY VALUES ('entity', n_entities), ('entity_link_suggestion', n_sugg);
END $$;

REVOKE ALL ON FUNCTION public.reap_ontology_orphans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reap_ontology_orphans() TO authenticated;

COMMENT ON FUNCTION public.reap_ontology_orphans() IS
  'Deletes what ontology_orphans() reports, admin-only and inside the caller''s scope. Explicit because entities are vocabulary: reaping is a decision, not a background sweep.';

COMMIT;
