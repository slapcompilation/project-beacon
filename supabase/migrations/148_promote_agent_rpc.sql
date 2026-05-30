-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 148 — Phase C step 2a: promote_agent() RPC
--
-- Lets admin/owner promote (or demote) an agent to a target stage. Uses
-- delete-then-insert under the existing UNIQUE(org, agent, stage) index so
-- the latest promotion supersedes the previous row at that stage (matching
-- the model_releases pattern). The "audit history" comes from cron health
-- events + the released_at column — append-only history of every promotion
-- is a later step if needed.
--
-- Gates:
--   - admin/owner only (RAISE on other roles).
--   - target_stage must be one of sandbox / staging / production.
--   - production promotion requires eval_pass_rate >= 0.7 (caller-supplied —
--     no way to verify it server-side until we wire CI eval recording, but
--     forcing the operator to type a number documents the claim).
--
-- Depends on: 147 (agent_releases)
-- ─────────────────────────────────────────────────────────────────────────────

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
     AND (p_eval_pass_rate IS NULL OR p_eval_pass_rate < 0.7) THEN
    RAISE EXCEPTION 'production promotion requires eval_pass_rate >= 0.7 (got: %)',
      coalesce(p_eval_pass_rate::text, 'null')
      USING ERRCODE = '23514';
  END IF;

  -- The previous row at this (org, agent, stage) is dropped — the unique
  -- index forbids two active rows at the same stage. Tag carries the version
  -- so it's still legible after rotation.
  DELETE FROM agent_releases
   WHERE coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND agent_name = p_agent_name
     AND stage      = p_target_stage;

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

REVOKE ALL ON FUNCTION promote_agent(text, text, text, numeric, int, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION promote_agent(text, text, text, numeric, int, text, uuid) TO authenticated;

COMMENT ON FUNCTION promote_agent(text, text, text, numeric, int, text, uuid) IS
  'Promote or demote an agent to a target stage. Admin/owner only. Production requires eval_pass_rate >= 0.7. Delete-then-insert preserves the UNIQUE(org, agent, stage) invariant.';
