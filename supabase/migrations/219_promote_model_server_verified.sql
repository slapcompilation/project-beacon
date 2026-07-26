-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 219 — promote_model: server-verified model release gate
--
-- Model releases were the weak half of the trust spine. agent_releases has an
-- admin/owner-gated policy and promotion runs through promote_agent, which reads
-- the pass rate from a recorded eval run (migration 175). Models had neither:
--
--   * model_releases     ALL policy = org scope only, NO role check. Any
--                        authenticated org member — team_member included — could
--                        POST a production release straight through PostgREST.
--   * model_deployments  same: any member could deploy or stop a live model.
--   * the eval gate      lived only in the web client (usePromoteRelease), so it
--                        was bypassed by not using the web client.
--
-- After: promote_model is the sanctioned path. Admin/owner only; production is
-- bound to a recorded model_eval_runs row for that exact adapter + version, and
-- a recorded MAPE above the org's max_forecast_mape ceiling blocks the promotion
-- — the same accuracy bar decideAutoExecution already uses to veto a forecast is
-- now applied before the model can reach production at all.
--
-- Direct table writes are narrowed to admin/owner as defense in depth, matching
-- agent_releases. Read stays org-wide.
--
-- Honest limit: model_eval_runs is insertable by org members (in-app evals are
-- real runs, e.g. the Forecast Lab backtest), so an eval row attests "a run
-- happened here", not "CI ran it". This closes the privilege hole; making eval
-- rows unforgeable is a separate change.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_model(
  p_objective_name  text,
  p_adapter_name    text,
  p_adapter_version text,
  p_target_stage    text,
  p_tag             text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS model_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role      text    := auth_role();
  v_uid       uuid    := auth.uid();
  v_org       uuid    := coalesce(p_organization_id, auth_org_id());
  v_max_mape  numeric := org_policy_numeric(ARRAY['auto_execution','max_forecast_mape'], 0.4);
  v_has_eval  boolean;
  v_mape      numeric;
  v_row       model_releases;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  IF p_target_stage NOT IN ('sandbox','staging','production') THEN
    RAISE EXCEPTION 'invalid target stage: %', p_target_stage USING ERRCODE = '22023';
  END IF;

  -- Without this a caller whose JWT carries no org writes organization_id NULL,
  -- which every org can read — one tenant minting a global release.
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'permission denied: no organization in scope' USING ERRCODE = '42501';
  END IF;

  -- Callers may only release into their own org.
  IF v_org IS DISTINCT FROM auth_org_id() THEN
    RAISE EXCEPTION 'permission denied: cannot release into another organization' USING ERRCODE = '42501';
  END IF;

  IF p_target_stage = 'production' THEN
    SELECT true INTO v_has_eval
    FROM model_eval_runs
    WHERE objective_name  = p_objective_name
      AND adapter_name    = p_adapter_name
      AND adapter_version = p_adapter_version
      AND (organization_id IS NULL OR organization_id = v_org)
    LIMIT 1;

    IF v_has_eval IS NOT TRUE THEN
      RAISE EXCEPTION 'production release blocked: no recorded eval run for %@% — backtest or run the eval suite first',
        p_adapter_name, p_adapter_version USING ERRCODE = '23514';
    END IF;

    -- If accuracy was measured, hold it to the same ceiling the auto-execution
    -- gate uses. Lower MAPE is better; above the ceiling never reaches production.
    SELECT value INTO v_mape
    FROM model_eval_runs
    WHERE objective_name  = p_objective_name
      AND adapter_name    = p_adapter_name
      AND adapter_version = p_adapter_version
      AND metric          = 'mape'
      AND (organization_id IS NULL OR organization_id = v_org)
    ORDER BY run_at DESC
    LIMIT 1;

    IF v_mape IS NOT NULL AND v_mape > v_max_mape THEN
      RAISE EXCEPTION 'production release blocked: recorded MAPE % exceeds the % ceiling for %@%',
        v_mape, v_max_mape, p_adapter_name, p_adapter_version USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO model_releases (
    organization_id, objective_name, adapter_name, adapter_version,
    stage, tag, compatibility_passed, released_by_user_id, released_at
  ) VALUES (
    v_org, p_objective_name, p_adapter_name, p_adapter_version,
    p_target_stage,
    coalesce(p_tag, p_target_stage || '-' || p_adapter_name || '-' || p_adapter_version),
    true, v_uid, now()
  )
  ON CONFLICT (organization_id, objective_name, stage) DO UPDATE
    SET adapter_name        = EXCLUDED.adapter_name,
        adapter_version     = EXCLUDED.adapter_version,
        tag                 = EXCLUDED.tag,
        released_by_user_id = EXCLUDED.released_by_user_id,
        released_at         = EXCLUDED.released_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Invariant 1: Postgres grants EXECUTE to PUBLIC by default on new functions.
REVOKE EXECUTE ON FUNCTION public.promote_model(text,text,text,text,text,uuid) FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION public.promote_model(text,text,text,text,text,uuid) TO authenticated;

-- Narrow direct writes to admin/owner (read stays org-wide), matching
-- agent_releases. The RPC above remains the sanctioned promotion path.
DROP POLICY IF EXISTS "users manage releases in scope" ON model_releases;
CREATE POLICY "admins manage releases in scope" ON model_releases
  FOR ALL
  USING      (auth_role() IN ('admin','owner') AND (organization_id IS NULL OR organization_id = auth_org_id()))
  WITH CHECK (auth_role() IN ('admin','owner') AND (organization_id IS NULL OR organization_id = auth_org_id()));

DROP POLICY IF EXISTS "users manage deployments in scope" ON model_deployments;
CREATE POLICY "admins manage deployments in scope" ON model_deployments
  FOR ALL
  USING      (auth_role() IN ('admin','owner') AND (organization_id IS NULL OR organization_id = auth_org_id()))
  WITH CHECK (auth_role() IN ('admin','owner') AND (organization_id IS NULL OR organization_id = auth_org_id()));
