-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 156 — Phase H step 1: rename scenarios → action_chains
--
-- What 136 called "Scenarios" is structurally Action Chains (per CLAUDE.md):
-- a list of BeaconActions batched then committed via dispatchAction. AIP-shaped
-- Scenarios — a graph-overlay sandbox the LLM and operator co-edit — land in
-- migration 157 (H2). This migration frees the "scenarios" namespace so the
-- new feature can claim it.
--
-- This migration also reverts an in-flight 155_scenarios.sql that was dropped:
-- it replaced 136's RLS policies with an org-scoped variant and added a
-- trigger referencing a column that doesn't exist on the original schema.
-- 156 restores the original policy semantics and drops the broken trigger
-- before renaming.
--
-- Depends on: 136 (original scenarios table)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Undo 155's damage ─────────────────────────────────────────────────────

DROP TRIGGER  IF EXISTS trg_scenarios_touch ON scenarios;
DROP FUNCTION IF EXISTS scenarios_touch_updated_at();

DROP POLICY IF EXISTS "users read scenarios in scope"    ON scenarios;
DROP POLICY IF EXISTS "admins manage scenarios in scope" ON scenarios;
DROP POLICY IF EXISTS "users create scenarios in scope"  ON scenarios;
DROP POLICY IF EXISTS "users update scenarios in scope"  ON scenarios;
DROP POLICY IF EXISTS "users delete scenarios in scope"  ON scenarios;

DROP INDEX IF EXISTS idx_scenarios_org;
DROP INDEX IF EXISTS idx_scenarios_hotel;

-- ── 2. Rename table + indices ────────────────────────────────────────────────

ALTER TABLE scenarios RENAME TO action_chains;

ALTER INDEX IF EXISTS idx_scenarios_hotel_draft   RENAME TO idx_action_chains_hotel_draft;
ALTER INDEX IF EXISTS idx_scenarios_hotel_all     RENAME TO idx_action_chains_hotel_all;
ALTER INDEX IF EXISTS idx_scenarios_base_proposal RENAME TO idx_action_chains_base_proposal;

-- ── 3. Restore the original 136 RLS policies under the new name ──────────────

CREATE POLICY "users read action chains in scope" ON action_chains
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "users create action chains in scope" ON action_chains
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by_user_id = auth.uid()
    AND hotel_is_in_user_scope(hotel_id)
  );

CREATE POLICY "users update action chains in scope" ON action_chains
  FOR UPDATE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id))
  WITH CHECK (hotel_is_in_user_scope(hotel_id));

CREATE POLICY "users delete action chains in scope" ON action_chains
  FOR DELETE TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

-- ── 4. Rename the RPCs ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS append_simulated_action(uuid, jsonb);
DROP FUNCTION IF EXISTS remove_simulated_action(uuid, int);

CREATE OR REPLACE FUNCTION append_action_chain_step(p_chain_id uuid, p_action jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE action_chains
     SET simulated_actions = simulated_actions || p_action
   WHERE id = p_chain_id;
$$;

CREATE OR REPLACE FUNCTION remove_action_chain_step(p_chain_id uuid, p_index int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actions jsonb;
BEGIN
  SELECT simulated_actions INTO v_actions FROM action_chains WHERE id = p_chain_id;
  IF v_actions IS NULL THEN RETURN; END IF;
  IF p_index < 0 OR p_index >= jsonb_array_length(v_actions) THEN RETURN; END IF;
  UPDATE action_chains
     SET simulated_actions = v_actions - p_index
   WHERE id = p_chain_id;
END;
$$;

REVOKE ALL ON FUNCTION append_action_chain_step(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_action_chain_step(uuid, int)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_action_chain_step(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_action_chain_step(uuid, int)   TO authenticated;

COMMENT ON TABLE action_chains IS
  'H1 (renamed from "scenarios" in 136). Multi-step BeaconAction sequence batched as a unit; commit dispatches via the Action Registry. The "Scenarios" namespace is now reserved for the AIP-shaped graph-overlay sandbox (H2).';

COMMIT;
