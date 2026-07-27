-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 220 — promote_model: require staging before production
--
-- Agents got this in migration 178 (Gap D); models were still missing it after
-- 219, so an admin could take a fresh adapter straight from backtest to
-- production with nobody having watched it run. The eval gate proves accuracy on
-- history; staging is the human-in-the-loop step that proves it in place.
--
-- model_releases holds ONE active release per (org, objective, stage), so the
-- check is stronger than the agent equivalent: the adapter you're promoting must
-- be the one CURRENTLY in staging, not merely one that passed through it. The
-- staging check runs before the eval read so the operator gets "stage it first"
-- rather than an accuracy complaint about a version they haven't staged.
--
-- Existing production rows are untouched — this gates new promotions only.
-- Guarded by supabase/tests/rls_contracts.sql (C17e).
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
    -- Staging first: the adapter going to production must be the one on staging now.
    IF NOT EXISTS (
      SELECT 1 FROM model_releases
       WHERE organization_id IS NOT DISTINCT FROM v_org
         AND objective_name  = p_objective_name
         AND stage           = 'staging'
         AND adapter_name    = p_adapter_name
         AND adapter_version = p_adapter_version
    ) THEN
      RAISE EXCEPTION 'production release blocked: %@% is not the staging release for % — promote it to staging first',
        p_adapter_name, p_adapter_version, p_objective_name USING ERRCODE = '23514';
    END IF;

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

REVOKE EXECUTE ON FUNCTION public.promote_model(text,text,text,text,text,uuid) FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION public.promote_model(text,text,text,text,text,uuid) TO authenticated;
