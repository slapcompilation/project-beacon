-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 153 — Phase G step 1: non-destructive agent release ledger
--
-- Today `promote_agent` (migration 148) DELETEs the previous row at the same
-- (org, agent, stage) before inserting the new one — so the table reflects the
-- current state but loses history. That makes the Agent Studio unable to show
-- a release timeline, and undermines audit ("when did we promote v1.0.0 to
-- production? what pass rate at the time?").
--
-- Fix: append-only history.
--   • Add `superseded_at timestamptz` — NULL means this row is current.
--   • `promote_agent` UPDATEs the prior row's `superseded_at = now()` instead of
--     DELETEing, then INSERTs the new row.
--   • `get_current_agent_releases()` filters `superseded_at IS NULL`.
--   • Drop the UNIQUE index — multiple rows at the same (org, agent, stage)
--     are valid now (only one with NULL superseded_at). Replaced by a partial
--     UNIQUE index over the current rows so the invariant still holds.
--   • Backfill: existing rows are current — leave their `superseded_at` NULL.
--
-- Depends on: 147 (agent_releases), 148 (promote_agent)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE agent_releases
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

COMMENT ON COLUMN agent_releases.superseded_at IS
  'When a later promotion to the same (org, agent, stage) replaced this row. NULL = currently active.';

-- Swap the old "one row per stage" unique index for a partial one over the
-- currently-active rows. History rows (superseded_at NOT NULL) accumulate freely.
DROP INDEX IF EXISTS uniq_agent_release_per_stage;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_release_current_per_stage
  ON agent_releases (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    agent_name,
    stage
  )
  WHERE superseded_at IS NULL;

-- Browsing the timeline pulls the full history per agent in released_at order.
CREATE INDEX IF NOT EXISTS idx_agent_releases_history
  ON agent_releases (agent_name, released_at);

-- ── get_current_agent_releases() — filter by NULL superseded_at ──────────────
-- Same signature; same scoping rules; only the active row per (agent, stage)
-- now that history accumulates in the same table.

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
        ORDER BY (r.organization_id = auth_org_id()) DESC NULLS LAST, r.released_at DESC
      ) AS rn
    FROM agent_releases r
    WHERE r.superseded_at IS NULL
      AND (r.organization_id IS NULL OR r.organization_id = auth_org_id())
  )
  SELECT agent_name, stage, version, tag, eval_pass_rate, eval_case_count, released_at, notes
  FROM ranked
  WHERE rn = 1
  ORDER BY agent_name, stage;
$$;

COMMENT ON FUNCTION get_current_agent_releases() IS
  'Active (non-superseded) release per (agent, stage) for the caller''s org, with NULL-org rows as a global fallback.';

-- ── promote_agent — UPDATE-then-INSERT preserves history ─────────────────────
-- Same signature + same gates; the only change is that the prior row at this
-- (org, agent, stage) is marked superseded instead of deleted.

CREATE OR REPLACE FUNCTION promote_agent(
  p_agent_name      text,
  p_version         text,
  p_target_stage    text,
  p_eval_pass_rate  numeric DEFAULT NULL,
  p_eval_case_count int     DEFAULT NULL,
  p_notes           text    DEFAULT NULL,
  p_organization_id uuid    DEFAULT NULL
)
RETURNS agent_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth_role();
  v_uid  uuid := auth.uid();
  v_min_pass numeric := org_policy_numeric(ARRAY['promotion','production_pass_rate_floor'], 0.7);
  v_row  agent_releases;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_stage NOT IN ('sandbox','staging','production') THEN
    RAISE EXCEPTION 'invalid target stage: %', p_target_stage
      USING ERRCODE = '22023';
  END IF;

  IF p_target_stage = 'production'
     AND (p_eval_pass_rate IS NULL OR p_eval_pass_rate < v_min_pass) THEN
    RAISE EXCEPTION 'production promotion requires eval_pass_rate >= % (got: %)',
      v_min_pass, coalesce(p_eval_pass_rate::text, 'null')
      USING ERRCODE = '23514';
  END IF;

  -- Mark the prior currently-active row at this (org, agent, stage) as
  -- superseded so the new one becomes the only NULL-superseded row.
  UPDATE agent_releases
     SET superseded_at = now()
   WHERE coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND agent_name    = p_agent_name
     AND stage         = p_target_stage
     AND superseded_at IS NULL;

  INSERT INTO agent_releases (
    organization_id, agent_name, version, stage, tag,
    eval_pass_rate, eval_case_count, notes, released_by_user_id
  ) VALUES (
    p_organization_id, p_agent_name, p_version, p_target_stage,
    p_target_stage || '-' || p_version,
    p_eval_pass_rate, p_eval_case_count, p_notes, v_uid
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION promote_agent(text, text, text, numeric, int, text, uuid) IS
  'Promote or demote an agent to a target stage. Admin/owner only. Production requires eval_pass_rate >= org_policy.promotion.production_pass_rate_floor. UPDATE-then-INSERT preserves release history (superseded_at).';

-- ── get_agent_release_history(p_agent_name) ──────────────────────────────────
-- Returns the full release timeline for one agent, oldest → newest. Powers the
-- Agent Detail timeline component. Same org-scoped filter as the current
-- helper — the caller sees their org's rows + the NULL-org global defaults.

CREATE OR REPLACE FUNCTION get_agent_release_history(p_agent_name text)
RETURNS TABLE (
  id                  uuid,
  organization_id     uuid,
  agent_name          text,
  version             text,
  stage               text,
  tag                 text,
  eval_pass_rate      numeric,
  eval_case_count     int,
  notes               text,
  released_by_user_id uuid,
  released_at         timestamptz,
  superseded_at       timestamptz,
  is_current          boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.id, r.organization_id, r.agent_name, r.version, r.stage, r.tag,
    r.eval_pass_rate, r.eval_case_count, r.notes, r.released_by_user_id,
    r.released_at, r.superseded_at,
    (r.superseded_at IS NULL) AS is_current
  FROM agent_releases r
  WHERE r.agent_name = p_agent_name
    AND (r.organization_id IS NULL OR r.organization_id = auth_org_id())
  ORDER BY r.released_at ASC;
$$;

REVOKE ALL ON FUNCTION get_agent_release_history(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_agent_release_history(text) TO authenticated;

COMMENT ON FUNCTION get_agent_release_history(text) IS
  'Full chronological release timeline for one agent, scoped to caller''s org + NULL-org defaults. Powers the Agent Detail timeline.';
