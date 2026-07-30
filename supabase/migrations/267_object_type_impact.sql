-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 267 — what breaks if this object type changes.
--
-- Tier 3.1. 266 catches an authored artifact AFTER it breaks; this answers the
-- question BEFORE the edit, which is the version an operator can act on.
-- Foundry does this as impact analysis on an ontology resource; ours is the same
-- question asked of the artifacts we actually have.
--
-- Deliberately NOT a block. An operator may legitimately want to delete a
-- property and fix the tools that used it; refusing outright traps them, and
-- silently breaking them is what we are fixing. So: tell them, precisely, and
-- let them decide.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.object_type_impact(
  p_object_type_id uuid,
  p_removing_keys  text[] DEFAULT NULL   -- NULL = the whole type is going
)
RETURNS TABLE (artifact_kind text, artifact_name text, api_name text, detail text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  -- Tools whose subject is this type
  SELECT 'user_tool', ut.name, ut.api_name,
         CASE WHEN p_removing_keys IS NULL THEN 'asks about this type'
              ELSE format('uses %s', (
                SELECT string_agg(DISTINCT k, ', ') FROM (
                  SELECT f->>'property' k FROM jsonb_array_elements(ut.filters) f
                  UNION SELECT ut.aggregation->>'property'
                ) u WHERE k = ANY(p_removing_keys)))
         END
  FROM user_tools ut
  WHERE ut.subject_type_id = p_object_type_id
    AND (p_removing_keys IS NULL
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(ut.filters) f WHERE f->>'property' = ANY(p_removing_keys))
      OR ut.aggregation->>'property' = ANY(p_removing_keys))

  UNION ALL
  SELECT 'cohort', os.name, os.api_name,
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
  -- Automations reach this type through a cohort, so the chain is worth naming.
  SELECT 'automation', a.name, a.id::text, format('fires on cohort "%s"', os.name)
  FROM automations a JOIN object_sets os ON os.id = a.object_set_id
  WHERE os.subject_type_id = p_object_type_id AND p_removing_keys IS NULL

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
  'What references an object type, or the named properties of one. Answers before the edit; authored_artifact_drift() catches what slipped through after. Not a block — an operator may mean it.';
