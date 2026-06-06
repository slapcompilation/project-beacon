-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 154 — Phase G3: per-case eval run persistence
--
-- model_eval_runs (migration 131) stores one row per (objective, version, run)
-- with a single pass_rate value. That's enough for the G2 promotion gate but
-- doesn't let the operator answer "which case failed in v1.1 that passed in
-- v1.0?" The reporter rewrite for Vitest 4 already walks per-test cases — so
-- we add a sibling table that stores one row per (run, case) and let the
-- reporter emit both.
--
-- Aggregate row in model_eval_runs is still the source of truth for the
-- pass_rate display + promotion gate; this table is the drilldown surface.
--
-- One row per (eval_run_id, case_id). FK to model_eval_runs lets the operator
-- pivot back to the parent run; FK has ON DELETE CASCADE so deleting an old
-- run cascades to its case rows.
--
-- Depends on: 131 (model_eval_runs)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_eval_case_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id     uuid        NOT NULL REFERENCES model_eval_runs(id) ON DELETE CASCADE,

  /** Mirror of the parent run's identity for cheap filtering without joining. */
  objective_name  text        NOT NULL,
  adapter_version text        NOT NULL,

  /** Stable case identifier the reporter computes from the suite + test name.
   *  Format: <suite-name> > <test-name>. Stable across runs as long as the
   *  describe()/it() text doesn't change. */
  case_id         text        NOT NULL,
  /** Human-readable label — usually the test name without the suite prefix. */
  case_label      text        NOT NULL,

  state           text        NOT NULL
                              CHECK (state IN ('passed','failed','skipped','pending')),
  duration_ms     int,
  /** First line of the assertion error when state='failed'. Null otherwise. */
  error_message   text,

  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_eval_case_runs_run
  ON agent_eval_case_runs (eval_run_id);

CREATE INDEX IF NOT EXISTS idx_agent_eval_case_runs_objective_version
  ON agent_eval_case_runs (objective_name, adapter_version, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_eval_case_runs_failures
  ON agent_eval_case_runs (objective_name, adapter_version, recorded_at DESC)
  WHERE state = 'failed';

COMMENT ON TABLE agent_eval_case_runs IS
  'Phase G3 — per-case eval results, sibling to model_eval_runs. One row per (run, case). Powers the failing-case drilldown on Agent Detail.';

ALTER TABLE agent_eval_case_runs ENABLE ROW LEVEL SECURITY;

-- Reads scoped the same way as model_eval_runs: visible to any authenticated
-- user (eval data is global; org_id NULL on the parent run). The CI sink writes
-- under the service role so RLS bypass applies to inserts.
DROP POLICY IF EXISTS "users read eval cases" ON agent_eval_case_runs;
CREATE POLICY "users read eval cases" ON agent_eval_case_runs
  FOR SELECT TO authenticated
  USING (true);

-- ── get_eval_case_runs(objective, version) ───────────────────────────────────
-- Returns the most recent case-by-case result set for a (objective, version).
-- Cleaner than a raw select because callers don't need to find the latest
-- run_id themselves.

CREATE OR REPLACE FUNCTION get_eval_case_runs(p_objective_name text, p_adapter_version text)
RETURNS TABLE (
  case_id       text,
  case_label    text,
  state         text,
  duration_ms   int,
  error_message text,
  recorded_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT id
    FROM model_eval_runs
    WHERE objective_name  = p_objective_name
      AND adapter_version = p_adapter_version
    ORDER BY run_at DESC
    LIMIT 1
  )
  SELECT c.case_id, c.case_label, c.state, c.duration_ms, c.error_message, c.recorded_at
  FROM agent_eval_case_runs c
  JOIN latest l ON l.id = c.eval_run_id
  ORDER BY (c.state = 'failed') DESC, c.case_id;
$$;

REVOKE ALL ON FUNCTION get_eval_case_runs(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_eval_case_runs(text, text) TO authenticated;

COMMENT ON FUNCTION get_eval_case_runs(text, text) IS
  'Latest per-case eval result set for one (objective, version). Failed cases first, then alphabetical by case_id.';
