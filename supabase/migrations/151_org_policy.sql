-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 151 — Phase E1: org_policy table + get/set RPCs
--
-- The autonomy knobs (auto-exec confidence floors, promotion gate threshold,
-- overstock factor, par recompute window, sweep caps, etc.) were code constants
-- until now. That makes Beacon a fixed system, not the AIP control room
-- CLAUDE.md describes. This migration introduces a single JSONB-backed
-- per-org policy document + the read/write RPCs that drive a Mind → Policy
-- tab. Callers (decideAutoExecution, useOrgOverstockSweep, promote_agent,
-- compute_supplier_reliability) get plumbed in Phase E2; this is the
-- foundation.
--
-- Shape (matches @beacon/reality-graph DEFAULT_ORG_POLICY constant):
-- {
--   auto_execution: { thresholds: { REQUEST_RESTOCK: 0.9, ... } },
--   promotion:      { production_pass_rate_floor: 0.7 },
--   overstock:      { factor: 2 },
--   par:            { service_level: 0.95, window_days: 90 },
--   supplier_reliability: { window_days: 90 },
--   caps:           { max_variants_per_cycle: 25, max_proposals_per_sweep: 25 }
-- }
--
-- Defaults live in code (DEFAULT_ORG_POLICY) so the system has sensible
-- behaviour with an empty table. The org row stores only operator overrides;
-- merging happens client-side. One row per org (UNIQUE on coalesce(org, sentinel)
-- handles the NULL-org global default — same pattern as agent_releases).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_policy (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  policy              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_policy_per_org
  ON org_policy (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

COMMENT ON TABLE org_policy IS
  'Per-org autonomy policy overrides. One row per org. Empty == use DEFAULT_ORG_POLICY from @beacon/reality-graph. Phase E1.';

ALTER TABLE org_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read org policy in scope" ON org_policy;
CREATE POLICY "users read org policy in scope" ON org_policy
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = auth_org_id());

-- Writes go through set_org_policy() RPC (admin/owner only). No direct INSERT/UPDATE policy.

-- ── get_org_policy() ─────────────────────────────────────────────────────────
-- Returns the caller's org policy as jsonb. If no org row exists, returns the
-- NULL-org global default row. If neither, returns '{}'. Callers (and the UI)
-- merge with DEFAULT_ORG_POLICY in code.

CREATE OR REPLACE FUNCTION get_org_policy()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT policy FROM org_policy WHERE organization_id = auth_org_id() LIMIT 1),
    (SELECT policy FROM org_policy WHERE organization_id IS NULL          LIMIT 1),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION get_org_policy() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_org_policy() TO authenticated;

COMMENT ON FUNCTION get_org_policy() IS
  'Caller''s org policy as jsonb (org-specific over NULL-org default). Empty means use DEFAULT_ORG_POLICY.';

-- ── set_org_policy() ─────────────────────────────────────────────────────────
-- Admin/owner only. Replaces the entire org's policy with p_policy (last-writer-wins).
-- Delete-then-insert keeps the UNIQUE(coalesce(org, sentinel)) invariant.

CREATE OR REPLACE FUNCTION set_org_policy(p_policy jsonb)
RETURNS org_policy
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth_role();
  v_org  uuid := auth_org_id();
  v_uid  uuid := auth.uid();
  v_row  org_policy;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_policy) <> 'object' THEN
    RAISE EXCEPTION 'policy must be a JSON object' USING ERRCODE = '22023';
  END IF;

  DELETE FROM org_policy
   WHERE coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(v_org,            '00000000-0000-0000-0000-000000000000'::uuid);

  INSERT INTO org_policy (organization_id, policy, updated_by_user_id)
  VALUES (v_org, p_policy, v_uid)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION set_org_policy(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION set_org_policy(jsonb) TO authenticated;

COMMENT ON FUNCTION set_org_policy(jsonb) IS
  'Admin/owner-only. Replaces caller''s org policy. Last-writer-wins (no merge — client sends the full document).';
