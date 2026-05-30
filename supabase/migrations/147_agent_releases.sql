-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 147 — Phase C step 1: agent release ledger
--
-- Today every agent in apps/web/.../agentStudio/registry.ts statically declares
-- `releaseStage: 'sandbox'`, even though restock_advisor is actually running
-- in production via the intelligence-cycle edge function + pg_cron. That's the
-- exact drift Phase C exists to fix: the DB becomes the source of truth for
-- which agent version is in which stage; the code's static value is a default
-- only.
--
-- This is the schema + read RPC + a seed reflecting the real state. Promotion
-- UI + a runtime gate (decideAutoExecution refuses to fire unless the agent is
-- in production) ride in Phase C step 2.
--
-- Shape mirrors model_releases (migration 131): one active row per
-- (organization_id, agent_name, stage). NULL organization_id = global default
-- that applies until an org-specific row overrides it.
--
-- Depends on: 102 (organizations), 127 (auth_role / RLS helpers established)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_releases (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  agent_name          text        NOT NULL,
  version             text        NOT NULL,
  stage               text        NOT NULL
                                  CHECK (stage IN ('sandbox','staging','production')),
  /** Human-readable tag, e.g. 'production-2.2'. Free-form. */
  tag                 text,
  /** Snapshot of the eval-suite pass rate at the moment of release. */
  eval_pass_rate      numeric(5,4),
  eval_case_count     int,
  /** Operator-readable note explaining the promotion. */
  notes               text,
  released_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at         timestamptz NOT NULL DEFAULT now()
);

-- One active row per (organization, agent, stage). Matches the model_releases
-- pattern: a new promotion to the same stage supersedes the previous one.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_release_per_stage
  ON agent_releases (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    agent_name,
    stage
  );

CREATE INDEX IF NOT EXISTS idx_agent_releases_recent
  ON agent_releases (agent_name, released_at DESC);

COMMENT ON TABLE agent_releases IS
  'Phase C — DB-backed agent release ledger. One active row per (org, agent, stage). Drives the runtime gate in decideAutoExecution (Phase C step 2).';

ALTER TABLE agent_releases ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read releases relevant to their org (or the
-- NULL-org global default).
DROP POLICY IF EXISTS "users read agent releases in scope" ON agent_releases;
CREATE POLICY "users read agent releases in scope" ON agent_releases
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = auth_org_id());

-- Writes (promotions) are admin/owner only; reuses auth_role().
DROP POLICY IF EXISTS "admins manage agent releases in scope" ON agent_releases;
CREATE POLICY "admins manage agent releases in scope" ON agent_releases
  FOR ALL TO authenticated
  USING (
    auth_role() IN ('admin','owner')
    AND (organization_id IS NULL OR organization_id = auth_org_id())
  )
  WITH CHECK (
    auth_role() IN ('admin','owner')
    AND (organization_id IS NULL OR organization_id = auth_org_id())
  );

-- ── get_current_agent_releases() RPC ─────────────────────────────────────────
-- Returns the currently active release per agent per stage, scoped to the
-- caller's org (with NULL-org rows acting as a global fallback when no
-- org-specific row exists). Single round-trip for the Agent Studio.

CREATE OR REPLACE FUNCTION get_current_agent_releases()
RETURNS TABLE (
  agent_name      text,
  stage           text,
  version         text,
  tag             text,
  eval_pass_rate  numeric,
  eval_case_count int,
  released_at     timestamptz,
  notes           text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      r.*,
      row_number() OVER (
        PARTITION BY r.agent_name, r.stage
        -- prefer the caller's org row, then the global default; latest wins within either
        ORDER BY (r.organization_id = auth_org_id()) DESC NULLS LAST, r.released_at DESC
      ) AS rn
    FROM agent_releases r
    WHERE r.organization_id IS NULL OR r.organization_id = auth_org_id()
  )
  SELECT agent_name, stage, version, tag, eval_pass_rate, eval_case_count, released_at, notes
  FROM ranked
  WHERE rn = 1
  ORDER BY agent_name, stage;
$$;

REVOKE ALL ON FUNCTION get_current_agent_releases() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_current_agent_releases() TO authenticated;

COMMENT ON FUNCTION get_current_agent_releases() IS
  'Active release per (agent, stage) for the caller''s org, with NULL-org rows as a global fallback.';

-- ── Seed: reflect the real state ─────────────────────────────────────────────
-- restock_advisor is running in production via the intelligence-cycle edge fn
-- (PR #116 + migration 143); the other two are still sandbox-only.

INSERT INTO agent_releases (organization_id, agent_name, version, stage, tag, notes)
VALUES
  (NULL, 'restock_advisor',       '1.0.0', 'production', 'production-1.0', 'Initial promotion: live via beacon-agent-intelligence-cycle since 2026-05-30.'),
  (NULL, 'waste_triage',          '1.0.0', 'sandbox',    'sandbox-1.0',    'Initial sandbox release; eval suite green.'),
  (NULL, 'overstock_rebalancer',  '1.0.0', 'sandbox',    'sandbox-1.0',    'Initial sandbox release; eval suite green.')
ON CONFLICT DO NOTHING;
