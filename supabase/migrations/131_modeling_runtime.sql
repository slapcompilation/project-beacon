-- Phase 8 — Modeling Objectives runtime.
--
-- Objectives + adapters are code-level (registered at module load in
-- reality-graph). Operational state lives here:
--   model_eval_runs : append-only metric results per adapter version
--   model_releases  : promotion track (sandbox → staging → production)
--   model_deployments : currently running endpoint per release
--
-- All three are org-scoped so different organizations can pin different
-- adapter versions per environment without stepping on each other.

BEGIN;

-- ── 1. model_eval_runs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_eval_runs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  objective_name     text        NOT NULL,
  adapter_name       text        NOT NULL,
  adapter_version    text        NOT NULL,

  /** Eval dataset identifier (e.g. 'stock_logs:last-90-days'). */
  dataset            text        NOT NULL,
  /** Metric library identifier (e.g. 'mae' | 'rmse' | 'pass_rate'). */
  metric             text        NOT NULL,
  /** Computed metric value. */
  value              numeric     NOT NULL,
  /** Optional cohort slice (e.g. 'per-hotel:<uuid>' | 'overall'). */
  subset             text        NOT NULL DEFAULT 'overall',
  /** How many cases the run scored. */
  case_count         int         NOT NULL DEFAULT 0,

  triggered_by_user_id uuid      REFERENCES auth.users(id) ON DELETE SET NULL,
  run_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_objective
  ON model_eval_runs (objective_name, adapter_name, adapter_version, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_eval_runs_org_recent
  ON model_eval_runs (organization_id, run_at DESC);

COMMENT ON TABLE model_eval_runs IS
  'Phase 8 — eval results per adapter version. Append-only; never updated.';

ALTER TABLE model_eval_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read eval runs in scope" ON model_eval_runs;
CREATE POLICY "users read eval runs in scope" ON model_eval_runs
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

DROP POLICY IF EXISTS "users insert eval runs in scope" ON model_eval_runs;
CREATE POLICY "users insert eval runs in scope" ON model_eval_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

-- ── 2. model_releases ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_releases (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        REFERENCES organizations(id) ON DELETE CASCADE,

  objective_name     text        NOT NULL,
  adapter_name       text        NOT NULL,
  adapter_version    text        NOT NULL,

  stage              text        NOT NULL
                                 CHECK (stage IN ('sandbox','staging','production')),
  /** Human-readable tag (e.g. 'production-2.2'). */
  tag                text        NOT NULL,
  /** Snapshot of the compatibility check that gated this release. */
  compatibility_passed boolean   NOT NULL DEFAULT true,

  released_by_user_id uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at        timestamptz NOT NULL DEFAULT now()
);

-- Only one active release per (org, objective, stage).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_release_per_stage
  ON model_releases (organization_id, objective_name, stage);

CREATE INDEX IF NOT EXISTS idx_releases_objective_recent
  ON model_releases (objective_name, released_at DESC);

COMMENT ON TABLE model_releases IS
  'Phase 8 — which adapter version is pinned at each stage per organization.';

ALTER TABLE model_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read releases in scope" ON model_releases;
CREATE POLICY "users read releases in scope" ON model_releases
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

DROP POLICY IF EXISTS "users manage releases in scope" ON model_releases;
CREATE POLICY "users manage releases in scope" ON model_releases
  FOR ALL TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

-- ── 3. model_deployments ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_deployments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  release_id         uuid        NOT NULL REFERENCES model_releases(id) ON DELETE CASCADE,

  /** 'live' for real-time inference endpoints; 'batch' for pipeline-driven
   *  jobs that populate computed properties. */
  kind               text        NOT NULL
                                 CHECK (kind IN ('live','batch')),

  status             text        NOT NULL DEFAULT 'starting'
                                 CHECK (status IN ('starting','running','failed','stopped')),
  /** k8s-style resource profile identifier; cosmetic until containerized. */
  resource_profile   text        NOT NULL DEFAULT 'low-cpu-low-memory',

  started_at         timestamptz NOT NULL DEFAULT now(),
  /** Updated whenever the deployment phones home or status changes. */
  last_health_check  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_org_recent
  ON model_deployments (organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployments_release
  ON model_deployments (release_id);

COMMENT ON TABLE model_deployments IS
  'Phase 8 — actively running deployments. One per (release, kind) typically.';

ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read deployments in scope" ON model_deployments;
CREATE POLICY "users read deployments in scope" ON model_deployments
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

DROP POLICY IF EXISTS "users manage deployments in scope" ON model_deployments;
CREATE POLICY "users manage deployments in scope" ON model_deployments
  FOR ALL TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = auth_org_id()
  );

COMMIT;
