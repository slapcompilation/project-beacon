-- Phase 18.a — Scenarios.
--
-- CLAUDE.md: "Scenarios are exploratory and uncommitted — distinct from
-- versions." An operator forks from a base (proposal / case / clean slate),
-- adds simulated BeaconActions to a private bucket, sees how the state
-- diverges, then commits (dispatches the actions for real) or discards.
--
-- v1 stores simulated_actions as a jsonb array directly on the row. The
-- alternative (a child table per action) is over-engineered for the read
-- pattern: the detail page wants all actions in one round-trip.

BEGIN;

CREATE TABLE IF NOT EXISTS scenarios (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  title                text        NOT NULL,
  description          text,
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','committed','discarded')),

  /** Optional fork point. NULL = clean slate scenario. */
  base_proposal_id     uuid        REFERENCES proposals(id) ON DELETE SET NULL,
  base_case_id         uuid        REFERENCES cases(id)     ON DELETE SET NULL,

  /** Array of typed BeaconActions the operator has tried inside the scenario.
   *  Shape: [{ type, ...payload }, ...]. Each entry mirrors the BeaconAction
   *  union the dispatcher consumes on commit. */
  simulated_actions    jsonb       NOT NULL DEFAULT '[]'::jsonb,

  /** Free-text notes captured during exploration. */
  notes                text,

  opened_by_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  committed_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  committed_at         timestamptz,
  /** Ids of the actions dispatched on commit (so the Object View can link to
   *  the resulting nodes). Shape: [{ logId|restockId|transferId|... }]. */
  commit_results       jsonb,

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_hotel_draft
  ON scenarios (hotel_id, created_at DESC)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_scenarios_hotel_all
  ON scenarios (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scenarios_base_proposal
  ON scenarios (base_proposal_id)
  WHERE base_proposal_id IS NOT NULL;

COMMENT ON TABLE scenarios IS
  'Phase 18.a — exploratory uncommitted branches. Operator adds simulated BeaconActions; commit dispatches them as a batch.';

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read scenarios in scope" ON scenarios;
CREATE POLICY "users read scenarios in scope" ON scenarios
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users create scenarios in scope" ON scenarios;
CREATE POLICY "users create scenarios in scope" ON scenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

DROP POLICY IF EXISTS "users update scenarios in scope" ON scenarios;
CREATE POLICY "users update scenarios in scope" ON scenarios
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

DROP POLICY IF EXISTS "users delete scenarios in scope" ON scenarios;
CREATE POLICY "users delete scenarios in scope" ON scenarios
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

-- Atomic append helper so concurrent edits don't drop actions.
CREATE OR REPLACE FUNCTION append_simulated_action(p_scenario_id uuid, p_action jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE scenarios
     SET simulated_actions = simulated_actions || p_action
   WHERE id = p_scenario_id;
$$;

CREATE OR REPLACE FUNCTION remove_simulated_action(p_scenario_id uuid, p_index int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actions jsonb;
BEGIN
  SELECT simulated_actions INTO v_actions FROM scenarios WHERE id = p_scenario_id;
  IF v_actions IS NULL THEN RETURN; END IF;
  IF p_index < 0 OR p_index >= jsonb_array_length(v_actions) THEN RETURN; END IF;
  UPDATE scenarios
     SET simulated_actions = v_actions - p_index
   WHERE id = p_scenario_id;
END;
$$;

REVOKE ALL ON FUNCTION append_simulated_action(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_simulated_action(uuid, int)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_simulated_action(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_simulated_action(uuid, int)   TO authenticated;

COMMIT;
