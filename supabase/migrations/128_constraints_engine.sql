-- Phase 4 — constraint engine: NL rules evaluated at action submission.
-- Categorized into one of four typed buckets:
--   scope         — limits which hotels/orgs an action may touch
--   threshold     — numeric ceiling/floor (e.g. quantity <= 500)
--   time-window   — wall-clock or business-hour restrictions
--   actor-role    — only certain roles may take this action
--
-- typed_rule (jsonb) carries the bucket-specific structured form; the
-- evaluator pattern-matches on bucket + rule shape. Operators author in NL;
-- a categorizer fills bucket + typed_rule. body stays as the source of truth
-- for display + audit.

BEGIN;

CREATE TABLE IF NOT EXISTS constraints (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  /** Natural-language source string the operator typed. */
  body                 text        NOT NULL,
  /** Typed bucket the categorizer chose. */
  bucket               text        NOT NULL
                                   CHECK (bucket IN ('scope','threshold','time-window','actor-role')),
  /** Bucket-specific structured form the evaluator consumes. */
  typed_rule           jsonb       NOT NULL,
  severity             text        NOT NULL DEFAULT 'hard'
                                   CHECK (severity IN ('hard','soft')),

  /** BeaconAction types this constraint gates. Empty array = applies to all. */
  applies_to_action_types text[]   NOT NULL DEFAULT '{}',

  active               boolean     NOT NULL DEFAULT true,
  authored_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at           timestamptz NOT NULL DEFAULT now(),
  deactivated_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_constraints_active_lookup
  ON constraints (hotel_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_constraints_action_types
  ON constraints USING GIN (applies_to_action_types)
  WHERE active = true;

COMMENT ON TABLE constraints IS 'AIP constraint engine — NL rules categorized into typed buckets, evaluated at action submission.';
COMMENT ON COLUMN constraints.typed_rule IS 'Bucket-specific JSON the evaluator pattern-matches. See ConstraintTypedRule union in @beacon/reality-graph.';
COMMENT ON COLUMN constraints.severity IS 'hard = action rejected on violation. soft = action requires higher approval tier.';

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read constraints in scope" ON constraints;
CREATE POLICY "users read constraints in scope" ON constraints
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users author constraints in own hotel" ON constraints;
CREATE POLICY "users author constraints in own hotel" ON constraints
  FOR INSERT TO authenticated
  WITH CHECK (
    authored_by_user_id = auth.uid()
    AND hotel_id = auth_hotel_id()
  );

DROP POLICY IF EXISTS "users update constraints in scope" ON constraints;
CREATE POLICY "users update constraints in scope" ON constraints
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

COMMIT;
