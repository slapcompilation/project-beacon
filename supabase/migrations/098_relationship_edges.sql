-- Migration 098: Relationship Edges — The Materialized Graph
-- Layer: meta — backs all four layers
-- Purpose: Every BeaconAction writes typed, semantic edges here.
--   The graph visualization, incident correlator, causal chain explorer,
--   and audit trail all read from this table.
--
-- Edge lifecycle:
--   BeaconAction dispatched → mutation executes → edgesForAction() computed
--   → rows inserted here → real-time subscription notifies graph subscribers
--
-- NOTE: This table is append-only. Edges are never updated or deleted
--   (except via hotel CASCADE on hotel deletion). Compensating actions
--   add new edges (e.g. 'reverts') rather than removing old ones.

SET search_path = public;

-- ─── Clean slate — drop if a previous failed run left a partial table ─────────

DROP TABLE IF EXISTS relationship_edges CASCADE;

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE relationship_edges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Semantic edge type — matches EdgeType in packages/reality-graph/src/types.ts
  edge_type     text        NOT NULL,

  -- Source node
  source_type   text        NOT NULL,
  source_id     uuid        NOT NULL,

  -- Target node
  target_type   text        NOT NULL,
  target_id     uuid        NOT NULL,

  -- Scoping
  hotel_id      uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,

  -- Audit context
  triggered_by  text        NOT NULL DEFAULT 'user'
                            CHECK (triggered_by IN (
                              'user',
                              'ai_proposal_accepted',
                              'automation_threshold',
                              'revert',
                              'system'
                            )),
  actor_id      uuid,

  -- Arbitrary structured metadata (e.g. quantity, cost, confidence)
  metadata      jsonb,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes — optimised for graph traversal patterns ─────────────────────────

CREATE INDEX idx_re_source    ON relationship_edges (source_id, source_type, hotel_id);
CREATE INDEX idx_re_target    ON relationship_edges (target_id, target_type, hotel_id);
CREATE INDEX idx_re_type      ON relationship_edges (edge_type, hotel_id, created_at DESC);
CREATE INDEX idx_re_hotel     ON relationship_edges (hotel_id, created_at DESC);
CREATE INDEX idx_re_actor     ON relationship_edges (actor_id, hotel_id, created_at DESC);

-- ─── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE relationship_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel members can view relationship edges"
  ON relationship_edges FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Hotel members can insert relationship edges"
  ON relationship_edges FOR INSERT
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM users WHERE id = auth.uid()));

-- ─── Helper: all edges touching a node ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_node_edges(
  p_node_id   uuid,
  p_node_type text,
  p_hotel_id  uuid
)
RETURNS TABLE (
  id           uuid,
  edge_type    text,
  source_type  text,
  source_id    uuid,
  target_type  text,
  target_id    uuid,
  metadata     jsonb,
  triggered_by text,
  actor_id     uuid,
  created_at   timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    re.id, re.edge_type,
    re.source_type, re.source_id,
    re.target_type, re.target_id,
    re.metadata, re.triggered_by, re.actor_id, re.created_at
  FROM relationship_edges re
  WHERE re.hotel_id = p_hotel_id
    AND (
      (re.source_id = p_node_id AND re.source_type = p_node_type)
      OR
      (re.target_id = p_node_id AND re.target_type = p_node_type)
    )
  ORDER BY re.created_at DESC
$$;

-- ─── Helper: hotel graph snapshot (for visualizer) ────────────────────────────

CREATE OR REPLACE FUNCTION get_hotel_graph(
  p_hotel_id  uuid,
  p_limit     int         DEFAULT 500,
  p_offset    int         DEFAULT 0,
  p_since     timestamptz DEFAULT (now() - interval '7 days')
)
RETURNS TABLE (
  id           uuid,
  edge_type    text,
  source_type  text,
  source_id    uuid,
  target_type  text,
  target_id    uuid,
  metadata     jsonb,
  triggered_by text,
  created_at   timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    re.id, re.edge_type,
    re.source_type, re.source_id,
    re.target_type, re.target_id,
    re.metadata, re.triggered_by, re.created_at
  FROM relationship_edges re
  WHERE re.hotel_id = p_hotel_id
    AND re.created_at >= p_since
  ORDER BY re.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset
$$;
