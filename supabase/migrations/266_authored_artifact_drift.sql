-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 266 — the drift tripwire for the OTHER half of the ontology.
--
-- builtin_property_drift() (228) checks that code-owned object types still match
-- their backing tables. Nothing checked the authored side, and that is the half
-- an operator can break by hand: validateUserTool runs in the COMPOSER, so a
-- tool is validated once when written and never again. Delete a property from an
-- object type afterwards and every saved artifact that filtered on it answers
-- zero — confidently, with a basis line and a confidence score.
--
-- That is the failure this whole audit keeps finding: not an error, an answer
-- that is wrong and looks right.
--
-- Checks both STORED and COMPUTED properties. A first pass of this analysis
-- looked only at `properties` and reported a live tool as broken because it
-- aggregates on a computed value — allProperties() has always included both, and
-- a drift check that disagrees with the evaluator is worse than none.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.authored_artifact_drift()
RETURNS TABLE (artifact_kind text, artifact_name text, api_name text, problem text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH props AS (
    -- Stored and computed together: a set may filter on either.
    SELECT t.id AS tid, p->>'key' AS k FROM object_types t, jsonb_array_elements(t.properties) p
    UNION ALL
    SELECT t.id, p->>'key' FROM object_types t, jsonb_array_elements(t.computed_properties) p
  ),
  iface_props AS (
    SELECT i.id AS iid, p->>'key' AS k FROM ontology_interfaces i, jsonb_array_elements(i.properties) p
  )
  -- Tool filters on a property its subject no longer has
  SELECT 'user_tool', ut.name, ut.api_name,
         format('filters on "%s", which is not a property of its subject', f->>'property')
  FROM user_tools ut, jsonb_array_elements(ut.filters) f
  WHERE (ut.subject_type_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM props WHERE props.tid = ut.subject_type_id AND props.k = f->>'property'))
     OR (ut.subject_interface_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM iface_props WHERE iface_props.iid = ut.subject_interface_id AND iface_props.k = f->>'property'))

  UNION ALL
  -- Tool aggregating a property that is gone
  SELECT 'user_tool', ut.name, ut.api_name,
         format('aggregates "%s", which is not a property of its subject', ut.aggregation->>'property')
  FROM user_tools ut
  WHERE coalesce(ut.aggregation->>'property','') <> ''
    AND ((ut.subject_type_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM props WHERE props.tid = ut.subject_type_id AND props.k = ut.aggregation->>'property'))
      OR (ut.subject_interface_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM iface_props WHERE iface_props.iid = ut.subject_interface_id AND iface_props.k = ut.aggregation->>'property')))

  UNION ALL
  -- Cohort filters on a property its subject no longer has
  SELECT 'object_set', os.name, os.api_name,
         format('filters on "%s", which is not a property of its subject', f->>'property')
  FROM object_sets os, jsonb_array_elements(os.filters) f
  WHERE (os.subject_type_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM props WHERE props.tid = os.subject_type_id AND props.k = f->>'property'))
     OR (os.subject_interface_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM iface_props WHERE iface_props.iid = os.subject_interface_id AND iface_props.k = f->>'property'))

  UNION ALL
  -- Cohort traversing a link type nobody registered — searchAround would refuse
  -- it at runtime, so it is broken whether or not anyone has run it.
  SELECT 'object_set', os.name, os.api_name,
         format('traverses "%s", which is not a registered link type', t->>'edgeType')
  FROM object_sets os, jsonb_array_elements(os.traversals) t
  WHERE NOT EXISTS (SELECT 1 FROM link_types lt WHERE lt.edge_type = t->>'edgeType')

  UNION ALL
  -- Automation pointing at a cohort that no longer exists
  SELECT 'automation', a.name, a.id::text, 'points at a cohort that no longer exists'
  FROM automations a
  WHERE a.object_set_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM object_sets os WHERE os.id = a.object_set_id)

  UNION ALL
  -- Agent whose toolset names a tool that is gone
  SELECT 'user_agent', ua.name, ua.api_name,
         format('calls "%s", which is not a registered tool', tool)
  FROM user_agents ua, jsonb_array_elements_text(ua.toolset) tool
  WHERE NOT EXISTS (SELECT 1 FROM user_tools ut WHERE ut.api_name = tool)
    AND tool NOT IN (
      -- shipped tools live in code, not the database
      'forecast_consumption','query_open_restock_requests','query_sister_property_inventory',
      'compute_reorder_point','rank_alternative_suppliers','score_forecast_accuracy',
      'occupancy_adjusted_forecast','compute_decision_quality','compute_decision_calibration',
      'detect_ontology_gaps','query_variant_documents','query_document_chunks','request_clarification'
    );
$$;

COMMENT ON FUNCTION public.authored_artifact_drift() IS
  'Saved artifacts that reference something no longer there. The authored half of the ontology has no compiler: validateUserTool runs in the composer and never again, so a deleted property leaves a tool answering zero with full confidence. Checks stored AND computed properties, because allProperties() does.';
