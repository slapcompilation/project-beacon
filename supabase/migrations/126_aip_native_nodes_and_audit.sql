-- AIP foundation: expand triggered_by audit enum + recognize new node/edge types.
-- These changes are additive — no rows touched, no behavior changes to existing flows.

-- ── 1. Allow 'ai_auto_approved' on relationship_edges.triggered_by ────────────

ALTER TABLE relationship_edges
  DROP CONSTRAINT IF EXISTS relationship_edges_triggered_by_check;

ALTER TABLE relationship_edges
  ADD CONSTRAINT relationship_edges_triggered_by_check
  CHECK (triggered_by IN (
    'user',
    'ai_proposal_accepted',
    'ai_auto_approved',
    'automation_threshold',
    'revert',
    'system'
  ));

-- ── 2. Recognize AIP-native node types on relationship_nodes ─────────────────
-- Some installs gate node `type` with a CHECK; expand it if present.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class    cls ON cls.oid = con.conrelid
   WHERE cls.relname = 'relationship_nodes'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE relationship_nodes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- ── 3. Recognize AIP-native edge types on relationship_edges ─────────────────

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class    cls ON cls.oid = con.conrelid
   WHERE cls.relname = 'relationship_edges'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%edge_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE relationship_edges DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

COMMENT ON TABLE relationship_edges IS
  'Typed semantic edges. edge_type vocabulary is governed by @beacon/reality-graph EdgeType union; CHECK omitted so app-layer types are authoritative.';
