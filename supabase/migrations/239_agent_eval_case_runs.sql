-- Recovered from supabase_migrations version 20260606094227.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

CREATE TABLE IF NOT EXISTS agent_eval_case_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id     uuid        NOT NULL REFERENCES model_eval_runs(id) ON DELETE CASCADE,
  objective_name  text        NOT NULL,
  adapter_version text        NOT NULL,
  case_id         text        NOT NULL,
  case_label      text        NOT NULL,
  state           text        NOT NULL CHECK (state IN ('passed','failed','skipped','pending')),
  duration_ms     int,
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

DROP POLICY IF EXISTS "users read eval cases" ON agent_eval_case_runs;
CREATE POLICY "users read eval cases" ON agent_eval_case_runs
  FOR SELECT TO authenticated
  USING (true);

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
