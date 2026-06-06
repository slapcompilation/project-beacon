-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 157 — Phase H step 2: AIP-shaped Scenarios
--
-- A Scenario is a sandbox graph branch the operator and the LLM co-edit. It
-- carries a graph_overlay (variants / policy / constraints / hypothetical
-- actions) the system merges on top of real state at simulation time. The
-- intelligence cycle runs against the overlay with no-op persistence — the
-- operator sees the delta vs reality, then promotes individual overlay items
-- to real changes or discards the whole branch.
--
-- The previous "scenarios" table (now action_chains, migration 156) carried
-- a list of BeaconActions to dispatch. That's a different concept entirely.
--
-- This migration creates three tables:
--   • scenarios               — the sandbox branch itself + the cached last sim
--   • scenario_messages       — copilot conversation history per scenario
--   • scenario_overlay_edits  — provenance log: who / what changed which
--                                overlay key, when
--
-- Three Logic Tools land in the reality-graph package alongside this:
--   apply_overlay_edit, simulate_cycle_with_overlay, query_simulation_result
--
-- Depends on: 102 (organizations), 127 (auth helpers), 151 (org_policy)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── scenarios table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scenarios (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id           uuid        REFERENCES hotels(id) ON DELETE CASCADE,

  title              text        NOT NULL,
  description        text,

  /** Typed overlay merged on top of real state at simulation time. Shape:
   *    {
   *      "variants":    { "<variantId>": { "par_level"?: number, "current_stock"?: number } },
   *      "policy":      <Partial<OrgPolicy>>,
   *      "constraints": { "disabled": [<id>...], "added": [<ConstraintRecord>...] },
   *      "actions":     [<BeaconAction>...]   // hypothetical actions injected before scan
   *    }
   *  Missing keys = no override for that layer. */
  graph_overlay      jsonb       NOT NULL DEFAULT '{}'::jsonb,

  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','archived','promoted')),

  /** Cached most-recent simulation: { ran_at, result: CycleResult, delta: {...} }.
   *  The list view + tools read this without re-running. */
  last_simulation    jsonb,
  last_simulated_at  timestamptz,

  created_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_org_created
  ON scenarios (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scenarios_hotel_created
  ON scenarios (hotel_id, created_at DESC) WHERE hotel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scenarios_draft
  ON scenarios (organization_id, updated_at DESC) WHERE status = 'draft';

COMMENT ON TABLE scenarios IS
  'Phase H step 2 — sandbox graph branches. graph_overlay carries typed overrides; simulations run via the reality-graph runner with no-op persistence.';

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read scenarios in scope" ON scenarios;
CREATE POLICY "users read scenarios in scope" ON scenarios
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org_id()
    AND (hotel_id IS NULL OR hotel_id = auth_hotel_id() OR auth_role() IN ('admin','owner','org_director'))
  );

DROP POLICY IF EXISTS "operators manage scenarios in scope" ON scenarios;
CREATE POLICY "operators manage scenarios in scope" ON scenarios
  FOR ALL TO authenticated
  USING (
    organization_id = auth_org_id()
    AND auth_role() IN ('admin','owner','org_director','regional_manager','hotel_admin','hotel_manager')
  )
  WITH CHECK (
    organization_id = auth_org_id()
    AND auth_role() IN ('admin','owner','org_director','regional_manager','hotel_admin','hotel_manager')
  );

-- updated_at trigger so the list view can sort by recently-edited.
CREATE OR REPLACE FUNCTION scenarios_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scenarios_touch ON scenarios;
CREATE TRIGGER trg_scenarios_touch
  BEFORE UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION scenarios_touch_updated_at();

-- ── scenario_messages table ─────────────────────────────────────────────────
-- Copilot conversation persisted alongside the scenario. Reopening the
-- scenario reloads the thread — the LLM has continuity across sessions.

CREATE TABLE IF NOT EXISTS scenario_messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,

  role          text        NOT NULL CHECK (role IN ('user','assistant','tool')),
  content       text,
  /** Tool calls + their results, mirrored from the copilot edge fn. */
  tool_calls    jsonb,
  tool_results  jsonb,

  author_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_messages_chrono
  ON scenario_messages (scenario_id, created_at);

ALTER TABLE scenario_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read scenario messages in scope" ON scenario_messages;
CREATE POLICY "users read scenario messages in scope" ON scenario_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scenarios s
      WHERE s.id = scenario_messages.scenario_id
        AND s.organization_id = auth_org_id()
    )
  );

DROP POLICY IF EXISTS "operators write scenario messages in scope" ON scenario_messages;
CREATE POLICY "operators write scenario messages in scope" ON scenario_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenarios s
      WHERE s.id = scenario_messages.scenario_id
        AND s.organization_id = auth_org_id()
        AND auth_role() IN ('admin','owner','org_director','regional_manager','hotel_admin','hotel_manager')
    )
  );

-- ── scenario_overlay_edits table ────────────────────────────────────────────
-- Provenance log: every change to graph_overlay records who/what made it.
-- Lets the H3 UI render a timeline + lets the operator revert a specific edit.

CREATE TABLE IF NOT EXISTS scenario_overlay_edits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,

  /** JSON path into graph_overlay, e.g. ['policy','auto_execution','thresholds','REQUEST_RESTOCK']. */
  path          jsonb       NOT NULL,
  /** Value before the edit (NULL when the key didn't exist). */
  before        jsonb,
  /** Value after the edit (NULL when the edit removes the key). */
  after         jsonb,

  /** What initiated the change. */
  source        text        NOT NULL CHECK (source IN ('llm','operator')),

  author_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_overlay_edits_chrono
  ON scenario_overlay_edits (scenario_id, created_at);

ALTER TABLE scenario_overlay_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read scenario overlay edits in scope" ON scenario_overlay_edits;
CREATE POLICY "users read scenario overlay edits in scope" ON scenario_overlay_edits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scenarios s
      WHERE s.id = scenario_overlay_edits.scenario_id
        AND s.organization_id = auth_org_id()
    )
  );

DROP POLICY IF EXISTS "operators write scenario overlay edits in scope" ON scenario_overlay_edits;
CREATE POLICY "operators write scenario overlay edits in scope" ON scenario_overlay_edits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenarios s
      WHERE s.id = scenario_overlay_edits.scenario_id
        AND s.organization_id = auth_org_id()
        AND auth_role() IN ('admin','owner','org_director','regional_manager','hotel_admin','hotel_manager')
    )
  );

-- ── apply_overlay_edit() RPC ────────────────────────────────────────────────
-- Atomic edit: rewrites a JSON path inside graph_overlay AND inserts the
-- provenance row in one statement. Source = 'llm' when called by the copilot,
-- 'operator' when called from the UI.

CREATE OR REPLACE FUNCTION apply_overlay_edit(
  p_scenario_id uuid,
  p_path        jsonb,     -- e.g. '["policy","auto_execution","thresholds","REQUEST_RESTOCK"]'::jsonb
  p_value       jsonb,     -- new value; NULL to remove the key
  p_source      text       -- 'llm' | 'operator'
)
RETURNS scenarios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_path text[]    := ARRAY(SELECT jsonb_array_elements_text(p_path));
  v_before jsonb;
  v_row    scenarios;
BEGIN
  IF p_source NOT IN ('llm','operator') THEN
    RAISE EXCEPTION 'invalid source: %', p_source USING ERRCODE = '22023';
  END IF;

  SELECT graph_overlay #> v_path INTO v_before
  FROM scenarios WHERE id = p_scenario_id;

  IF p_value IS NULL THEN
    UPDATE scenarios
       SET graph_overlay = graph_overlay #- v_path
     WHERE id = p_scenario_id
     RETURNING * INTO v_row;
  ELSE
    UPDATE scenarios
       SET graph_overlay = jsonb_set(graph_overlay, v_path, p_value, true)
     WHERE id = p_scenario_id
     RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'scenario % not found or not writable', p_scenario_id;
  END IF;

  INSERT INTO scenario_overlay_edits (scenario_id, path, before, after, source, author_id)
  VALUES (p_scenario_id, p_path, v_before, p_value, p_source, auth.uid());

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION apply_overlay_edit(uuid, jsonb, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION apply_overlay_edit(uuid, jsonb, jsonb, text) TO authenticated;

COMMENT ON FUNCTION apply_overlay_edit(uuid, jsonb, jsonb, text) IS
  'Atomically edit graph_overlay + write provenance. Used by the LLM (via apply_overlay_edit logic tool) and by the operator (from the overlay editor UI).';

-- ── record_simulation_result() RPC ──────────────────────────────────────────
-- The runner caches the most recent CycleResult on the scenario row so the
-- list view + future LLM calls can read it without rerunning. simulate_cycle
-- (tool) invokes this on completion.

CREATE OR REPLACE FUNCTION record_simulation_result(p_scenario_id uuid, p_result jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE scenarios
     SET last_simulation   = p_result,
         last_simulated_at = now()
   WHERE id = p_scenario_id;
$$;

REVOKE ALL ON FUNCTION record_simulation_result(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION record_simulation_result(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION record_simulation_result(uuid, jsonb) IS
  'Caches the most recent simulation CycleResult + delta on the scenario row. Called by simulate_cycle_with_overlay after the runner completes.';

COMMIT;
