-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 376 — object_type_impact comes back, over the artifacts that exist.
--
-- 373 dropped it because its body read user_tools and automations. Both were
-- ours and are gone; the FUNCTION is not — Foundry does impact analysis on an
-- ontology resource before you change it, and the three remaining branches are
-- pure ontology: object sets drawn from the type, link types touching it, and
-- interfaces it implements.
--
-- Third time this pattern has cost a restore (365, 372, now this). The matcher
-- asks "does this body name a doomed table" when the question is "does this
-- function still have a job". Recorded here rather than fixed in the matcher
-- because the right fix is not to sweep functions by table name at all.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.object_type_impact(
  p_object_type_id uuid,
  p_removing_keys  text[] DEFAULT NULL   -- NULL = the whole type is going
)
RETURNS TABLE (artifact_kind text, artifact_name text, api_name text, detail text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT 'object_set', os.name, os.api_name,
         CASE WHEN p_removing_keys IS NULL THEN 'is drawn from this type'
              ELSE format('filters on %s', (
                SELECT string_agg(DISTINCT f->>'property', ', ')
                FROM jsonb_array_elements(os.filters) f WHERE f->>'property' = ANY(p_removing_keys)))
         END
  FROM object_sets os
  WHERE os.subject_type_id = p_object_type_id
    AND (p_removing_keys IS NULL
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(os.filters) f WHERE f->>'property' = ANY(p_removing_keys)))

  UNION ALL
  SELECT 'link_type', lt.label, lt.api_name,
         format('links %s', CASE WHEN lt.source_object_type_id = p_object_type_id THEN 'from this type' ELSE 'to this type' END)
  FROM link_types lt
  WHERE p_removing_keys IS NULL
    AND (lt.source_object_type_id = p_object_type_id OR lt.target_object_type_id = p_object_type_id)

  UNION ALL
  SELECT 'interface', i.label, i.api_name, 'this type implements it'
  FROM object_type_interfaces oti JOIN ontology_interfaces i ON i.id = oti.interface_id
  WHERE oti.object_type_id = p_object_type_id AND p_removing_keys IS NULL;
$$;

COMMENT ON FUNCTION public.object_type_impact(uuid, text[]) IS
  'What references an object type, or the named properties of one. Answers before the edit, so an operator can decide rather than discover. Not a block — they may mean it.';

DO $$
BEGIN
  PERFORM 1 FROM object_type_impact(gen_random_uuid()) LIMIT 1;
END $$;

COMMIT;
