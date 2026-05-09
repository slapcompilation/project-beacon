-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 120 — get_node_set() RPC (Phase 5: Reality Graph Core)
--
-- Layer: meta — graph-aware query primitive used by all four layers
-- Scope: hotel (with org-scope-aware authorization)
-- Cadence: on-demand (called from the typed nodeSet() chainable in TS)
--
-- Why this exists
-- ───────────────
-- osdk-ts comparative audit, punch-list item #3: replace ad-hoc Supabase
-- `from('table').select('*, joins').eq(...)` calls — repeated across ~30 feature
-- APIs — with a single set-based, edge-aware query primitive backed by
-- relationship_edges. This is the foundation for:
--   • Phase 5: Reality Graph Core
--   • Phase B: Copilot tool definitions (Tier 1 deterministic graph queries)
--   • Future: chained traversal (`.via().to()`) that today requires manual
--     `traverseGraph()` over pre-fetched edge sets in the engine module.
--
-- Existing RPCs covered single-node walks:
--   • get_node_edges(node_id, node_type, hotel_id)        — one node
--   • get_variant_flow(variant_id)                        — variant-specific
--   • get_causal_trace(root_type, root_id, max_depth)     — recursive walk
-- This adds the set-based primitive: "given N nodes of type T, traverse via
-- edge type E to nodes of type U" — a single round-trip instead of N+1
-- queries or whole-hotel edge prefetches.
--
-- Authorization
-- ─────────────
-- SECURITY DEFINER + manual scope check via existing helpers:
--   • auth.uid() must be non-null (authenticated caller)
--   • p_hotel_id must be auth_hotel_id() OR hotel_is_in_user_scope(p_hotel_id)
-- This matches the org-scope-aware pattern from migrations 111a/b/c.
-- EXECUTE granted to authenticated only; revoked from anon/PUBLIC.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_node_set(
  p_node_type     text,
  p_node_ids      uuid[],
  p_hotel_id      uuid,
  p_via_edge_type text DEFAULT NULL,
  p_to_node_type  text DEFAULT NULL,
  p_direction     text DEFAULT 'out'
)
RETURNS TABLE (
  edge_id      uuid,
  edge_type    text,
  source_type  text,
  source_id    uuid,
  target_type  text,
  target_id    uuid,
  hotel_id     uuid,
  triggered_by text,
  actor_id     uuid,
  metadata     jsonb,
  created_at   timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auth: must be a signed-in user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'permission denied: requires authenticated session'
      USING ERRCODE = '42501';
  END IF;

  -- Scope: caller's hotel OR a hotel in their org scope
  IF p_hotel_id IS NULL OR (
    p_hotel_id <> auth_hotel_id()
    AND NOT hotel_is_in_user_scope(p_hotel_id)
  ) THEN
    RAISE EXCEPTION 'permission denied: hotel % not in user scope', p_hotel_id
      USING ERRCODE = '42501';
  END IF;

  -- Direction validation — keep the contract tight
  IF p_direction NOT IN ('out', 'in', 'both') THEN
    RAISE EXCEPTION 'invalid direction: %, must be out/in/both', p_direction
      USING ERRCODE = '22023';
  END IF;

  -- Empty input → empty output. Don't error; chainable callers may iterate.
  IF p_node_ids IS NULL OR array_length(p_node_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Set-based filter. The CASE expression matches the direction; the optional
  -- p_via_edge_type / p_to_node_type narrow the result further. All comparisons
  -- are index-friendly: relationship_edges is indexed on (source_id, source_type)
  -- and (target_id, target_type).
  RETURN QUERY
  SELECT
    e.id,
    e.edge_type,
    e.source_type,
    e.source_id,
    e.target_type,
    e.target_id,
    e.hotel_id,
    e.triggered_by,
    e.actor_id,
    e.metadata,
    e.created_at
  FROM relationship_edges e
  WHERE e.hotel_id = p_hotel_id
    AND (
      (p_direction IN ('out', 'both')
        AND e.source_type = p_node_type
        AND e.source_id = ANY(p_node_ids))
      OR
      (p_direction IN ('in', 'both')
        AND e.target_type = p_node_type
        AND e.target_id = ANY(p_node_ids))
    )
    AND (p_via_edge_type IS NULL OR e.edge_type = p_via_edge_type)
    AND (
      p_to_node_type IS NULL
      OR (
        (p_direction IN ('out', 'both') AND e.target_type = p_to_node_type)
        OR (p_direction IN ('in',  'both') AND e.source_type = p_to_node_type)
      )
    )
  ORDER BY e.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_node_set IS
  'Phase 5 graph query primitive. Set-based traversal over relationship_edges. '
  'Caller passes a node type + ids + hotel scope; optional via/to narrow the '
  'edge filter. Used by the typed nodeSet() chainable in '
  'packages/reality-graph/src/queries.';

-- Lock down REST exposure beyond authenticated. The function role-gates
-- internally via auth.uid() + hotel_is_in_user_scope() so it is safe to expose
-- at /rest/v1/rpc/get_node_set, but anon must not hit it.
REVOKE EXECUTE ON FUNCTION public.get_node_set(text, uuid[], uuid, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_node_set(text, uuid[], uuid, text, text, text) TO   authenticated;

-- ─── Verification ────────────────────────────────────────────────────────────
--
-- 1. As an authenticated user, fetch all stock_logs that consume a variant set:
--    SELECT * FROM get_node_set(
--      p_node_type     => 'variant',
--      p_node_ids      => ARRAY['<var1>', '<var2>']::uuid[],
--      p_hotel_id      => '<hotel-uuid>',
--      p_via_edge_type => 'consumes',
--      p_to_node_type  => 'stock_log',
--      p_direction     => 'in'
--    );
--
-- 2. Anonymous: SELECT get_node_set(...)  -- should raise 42501.
--
-- 3. Cross-hotel attempt: a user in hotel A passes p_hotel_id = hotel B
--    they don't have org scope to → 42501.
