-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 175 — promote_agent: server-verified production eval gate
--
-- Before: promote_agent enforced the production_pass_rate_floor against the
-- CLIENT-SUPPLIED p_eval_pass_rate. The Promote dialog's "Override" let an admin
-- type any number >= floor and ship to production with no real run — so the gate
-- was "the operator asserts the eval passed," not "the eval passed."
--
-- After: for production, the pass rate is read from the latest recorded
-- model_eval_runs row for (agent@version, metric='pass_rate'). No qualifying run
-- → blocked. Below floor → blocked. The release is bound to the VERIFIED numbers,
-- not the client's. Trust is now tied to CI, not to typing. (sandbox/staging keep
-- the lenient client-supplied behaviour for versions not yet CI-run.)
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
    -- Bind production trust to a real recorded eval run, not a client number.
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

    -- Record the VERIFIED numbers (ignore client-supplied for production).
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

-- Defense in depth: the trust gate is internally admin/owner-gated, but it had a
-- baseline anon EXECUTE grant. Lock it to authenticated (anon was already blocked
-- by the role check; this also clears the anon-SECURITY-DEFINER advisor for it).
REVOKE EXECUTE ON FUNCTION public.promote_agent(text,text,text,numeric,integer,text,uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.promote_agent(text,text,text,numeric,integer,text,uuid) TO authenticated;
