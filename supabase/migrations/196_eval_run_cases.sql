-- Per-case eval results (Phase 3.2a). The reporter previously persisted only
-- the aggregate pass_rate; the version-diff UI needs the case-by-case matrix
-- ("which exact cases regressed between v1.0 and v1.1"). Array of
-- { name: string, passed: boolean }; NULL for pre-3.2 rows.
ALTER TABLE model_eval_runs ADD COLUMN IF NOT EXISTS cases jsonb;

COMMENT ON COLUMN model_eval_runs.cases IS
  'Per-test results [{name, passed}] from the CI reporter; NULL on aggregate-only rows (pre-196).';
