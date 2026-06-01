-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 152 — Phase E2b: SQL RPCs honour org_policy
--
-- Closes out E2 by plumbing the two remaining hardcoded gates:
--   1. promote_agent's "production requires eval_pass_rate >= 0.7" check.
--   2. compute_supplier_reliability's default window of 90 days.
--
-- Both now read from org_policy first, fall back to the same code defaults
-- that DEFAULT_ORG_POLICY exposes in @beacon/reality-graph.
--
-- The supplier-reliability default window changes from 90 → NULL so callers
-- can pass NULL to mean "use policy". The weekly cron is rescheduled to call
-- compute_supplier_reliability(NULL, true) so its window respects policy too.
-- Depends on: 148 (promote_agent), 146 (compute_supplier_reliability), 151 (org_policy)
-- ─────────────────────────────────────────────────────────────────────────────

-- Small helper so plpgsql can pluck a numeric from the merged-with-defaults
-- policy in one call. SECURITY INVOKER so RLS on org_policy applies.
CREATE OR REPLACE FUNCTION org_policy_numeric(p_path text[], p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(jsonb_extract_path_text(
      coalesce(
        (SELECT policy FROM org_policy WHERE organization_id = auth_org_id() LIMIT 1),
        (SELECT policy FROM org_policy WHERE organization_id IS NULL          LIMIT 1),
        '{}'::jsonb
      ),
      VARIADIC p_path
    ), '')::numeric,
    p_default
  );
$$;

REVOKE ALL ON FUNCTION org_policy_numeric(text[], numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION org_policy_numeric(text[], numeric) TO authenticated;

COMMENT ON FUNCTION org_policy_numeric(text[], numeric) IS
  'Read a numeric scalar from the caller''s org policy at the given path, falling back to the supplied default. Phase E2b.';

-- ── promote_agent: read production_pass_rate_floor from policy ────────────────

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
  v_role  text    := auth_role();
  v_uid   uuid    := auth.uid();
  v_floor numeric := org_policy_numeric(ARRAY['promotion','production_pass_rate_floor'], 0.7);
  v_row   agent_releases;
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
     AND (p_eval_pass_rate IS NULL OR p_eval_pass_rate < v_floor) THEN
    RAISE EXCEPTION 'production promotion requires eval_pass_rate >= % (got: %)',
      v_floor, coalesce(p_eval_pass_rate::text, 'null')
      USING ERRCODE = '23514';
  END IF;

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
  'Promote or demote an agent. Admin/owner only. Production gate reads org_policy.promotion.production_pass_rate_floor (default 0.7).';

-- ── compute_supplier_reliability: NULL window means "read policy" ────────────

CREATE OR REPLACE FUNCTION compute_supplier_reliability(
  p_window_days    int     DEFAULT NULL,
  p_only_with_data boolean DEFAULT true
)
RETURNS TABLE (
  supplier_id       uuid,
  on_time_pct       numeric,
  cost_variance_pct numeric,
  sample_size       int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window int          := coalesce(p_window_days, org_policy_numeric(ARRAY['supplier_reliability','window_days'], 90)::int);
  v_cutoff timestamptz  := now() - (v_window || ' days')::interval;
  v_row    record;
BEGIN
  FOR v_row IN
    SELECT
      s.id AS sid,
      (
        SELECT round(
          coalesce(
            count(*) FILTER (WHERE po.closed_at::date <= po.expected_delivery_date)::numeric * 100
            / nullif(count(*), 0),
            NULL
          ),
          2
        )
        FROM purchase_orders po
        WHERE po.supplier_id = s.id
          AND po.closed_at IS NOT NULL
          AND po.expected_delivery_date IS NOT NULL
          AND po.created_at >= v_cutoff
      ) AS on_time,
      (
        SELECT round(avg(abs(inv.discrepancy_amount)::numeric / nullif(inv.po_amount, 0) * 100), 2)
        FROM po_invoices inv
        JOIN purchase_orders po ON po.id = inv.po_id
        WHERE po.supplier_id = s.id
          AND inv.created_at >= v_cutoff
          AND inv.po_amount > 0
      ) AS cost_variance,
      greatest(
        coalesce((SELECT count(*) FROM purchase_orders po
                  WHERE po.supplier_id = s.id AND po.created_at >= v_cutoff AND po.closed_at IS NOT NULL), 0),
        coalesce((SELECT count(*) FROM po_invoices inv
                  JOIN purchase_orders po ON po.id = inv.po_id
                  WHERE po.supplier_id = s.id AND inv.created_at >= v_cutoff), 0)
      )::int AS sample
    FROM suppliers s
  LOOP
    IF p_only_with_data AND v_row.on_time IS NULL AND v_row.cost_variance IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE suppliers
       SET on_time_pct             = v_row.on_time,
           cost_variance_pct       = v_row.cost_variance,
           reliability_sample_size = v_row.sample,
           reliability_computed_at = now()
     WHERE id = v_row.sid;

    supplier_id       := v_row.sid;
    on_time_pct       := v_row.on_time;
    cost_variance_pct := v_row.cost_variance;
    sample_size       := v_row.sample;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION compute_supplier_reliability(int, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION compute_supplier_reliability(int, boolean) TO authenticated;
GRANT  EXECUTE ON FUNCTION compute_supplier_reliability(int, boolean) TO service_role;

COMMENT ON FUNCTION compute_supplier_reliability(int, boolean) IS
  'Derives supplier reliability over a window. NULL window reads org_policy.supplier_reliability.window_days (default 90). Skips writes when only_with_data and the supplier has no data so the agent keeps its conservative defaults.';

-- ── Reschedule the weekly cron to use policy-driven window ───────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — supplier-reliability cron not rescheduled.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname = 'beacon-supplier-reliability-weekly';

  PERFORM cron.schedule(
    'beacon-supplier-reliability-weekly',
    '0 5 * * 0',
    'SELECT * FROM compute_supplier_reliability(NULL, true)'
  );
END;
$$;
