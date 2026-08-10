-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 372 — ontology_orphans comes back, minus the half that went.
--
-- 371 dropped both lineage functions because their bodies read
-- entity_link_suggestions. Only that BRANCH was ours: the entity branch is the
-- D4 retention check the ontology_drift contract calls, and it is machinery.
--
-- Same lesson as 365, one migration later: a function that touches a dropped
-- table is not automatically a dropped function. The right question is whether
-- its JOB survives, and here half of it did. The contract test caught it —
-- "function ontology_orphans() does not exist" — because it calls the function
-- rather than assuming it.
--
-- The reaper keeps its scope check: an admin reaps their own organization's
-- vocabulary, never a neighbour's, which is why hotel_is_in_user_scope is
-- still in the DELETE and not just the role gate.
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
      WHERE re.edge_type = 'resolved_to' AND re.source_id = e.id);
$$;

COMMENT ON FUNCTION public.ontology_orphans() IS
  'Derived nodes whose source is gone — the D4 half of lineage-aware retention. Reported rather than reaped automatically: entities are stable vocabulary by design (migration 204), so deleting one on its last mention would reverse a deliberate decision.';

CREATE OR REPLACE FUNCTION public.reap_ontology_orphans()
RETURNS TABLE (kind text, reaped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n_entities int;
BEGIN
  IF auth_role() NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only owner or admin may reap orphans' USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM entities e
   WHERE e.id IN (SELECT o.id FROM ontology_orphans() o WHERE o.kind = 'entity')
     AND hotel_is_in_user_scope(e.hotel_id);
  GET DIAGNOSTICS n_entities = ROW_COUNT;

  RETURN QUERY VALUES ('entity', n_entities);
END $$;

REVOKE ALL ON FUNCTION public.reap_ontology_orphans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reap_ontology_orphans() TO authenticated;

DO $$
BEGIN
  PERFORM 1 FROM ontology_orphans() LIMIT 1;   -- must be callable
  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE grantee IN ('anon','PUBLIC') AND routine_schema='public'
       AND routine_name IN ('reap_ontology_orphans')
  ) THEN
    RAISE EXCEPTION 'Migration 372: anon can reach the reaper';
  END IF;
END $$;

COMMIT;
