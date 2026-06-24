-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 178 — promote_agent: require staging before production (Gap D)
--
-- Before: an admin could promote sandbox→production directly. Combined with the
-- Gap B eval gate that meant "passing eval" was the only thing standing between a
-- fresh version and unattended execution — no human-in-the-loop staging step.
--
-- After: production promotion requires the EXACT (agent, version) to already have
-- a staging release in the same org scope. You stage it (someone watches it run),
-- then promote. Existing production rows are untouched — this only gates new
-- promotions. Staging check runs first so the operator gets "stage it first"
-- before any eval complaint. Guarded by supabase/tests/rls_contracts.sql (C5).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_agent(
  p_agent_name text, p_version text, p_target_stage text,
  p_eval_pass_rate numeric DEFAULT NULL, p_eval_case_count integer DEFAULT NULL,
  p_notes text DEFAULT NULL, p_organization_id uuid DEFAULT NULL
)
RETURNS agent_releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text    := auth_role();
  v_uid      uuid    := auth.uid();
  v_min_pass numeric := org_policy_numeric(ARRAY['promotion','production_pass_rate_floor'], 0.7);
  v_pass     numeric := p_eval_pass_rate;
  v_cases    integer := p_eval_case_count;
  v_rec_pass numeric;
  v_rec_cases integer;
  v_row      agent_releases;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'permission denied: requires admin or owner role' USING ERRCODE = '42501';
  END IF;

  IF p_target_stage NOT IN ('sandbox','staging','production') THEN
    RAISE EXCEPTION 'invalid target stage: %', p_target_stage USING ERRCODE = '22023';
  END IF;

  IF p_target_stage = 'production' THEN
    -- Gap D: no sandbox→production jumps. The exact version going to prod must
    -- have passed through staging in the same org scope.
    IF NOT EXISTS (
      SELECT 1 FROM agent_releases
      WHERE coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND agent_name = p_agent_name
        AND version    = p_version
        AND stage      = 'staging'
    ) THEN
      RAISE EXCEPTION 'production promotion blocked: %@% has no staging release in scope — promote to staging first',
        p_agent_name, p_version USING ERRCODE = '23514';
    END IF;

    -- Gap B: bind production trust to a real recorded eval run, not a client number.
    SELECT value, case_count INTO v_rec_pass, v_rec_cases
    FROM model_eval_runs
    WHERE objective_name = p_agent_name
      AND adapter_version = p_version
      AND metric = 'pass_rate'
    ORDER BY run_at DESC
    LIMIT 1;

    IF v_rec_pass IS NULL THEN
      RAISE EXCEPTION 'production promotion blocked: no recorded eval run for %@% — land a CI eval first',
        p_agent_name, p_version USING ERRCODE = '23514';
    END IF;
    IF v_rec_pass < v_min_pass THEN
      RAISE EXCEPTION 'production promotion blocked: recorded eval pass rate % is below floor % for %@%',
        v_rec_pass, v_min_pass, p_agent_name, p_version USING ERRCODE = '23514';
    END IF;

    v_pass  := v_rec_pass;
    v_cases := v_rec_cases;
  END IF;

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
    v_pass, v_cases, p_notes, v_uid
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- CREATE OR REPLACE keeps existing grants, but re-assert for a self-contained migration.
REVOKE EXECUTE ON FUNCTION public.promote_agent(text,text,text,numeric,integer,text,uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.promote_agent(text,text,text,numeric,integer,text,uuid) TO authenticated;
