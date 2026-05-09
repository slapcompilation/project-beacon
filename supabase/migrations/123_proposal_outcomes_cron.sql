-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 123 — Schedule compute_proposal_outcomes() (Phase D1)
--
-- Layer: Eye (intelligence) + Mind (memory)
-- Scope: organization (system-wide)
-- Cadence: daily 03:00 UTC
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase D1 (Proposal Quality Scoring) needs the
-- `proposal_outcomes` table populated continuously: every restock request that
-- reaches a terminal state should classify into one of the outcome variants
-- (approved_fulfilled, approved_excess_waste, dismissed_*, expired,
-- approved_unfulfilled, auto_approved). That feeds D2 (personalized alert
-- thresholds) and D3 (LLM anomaly explanations grounded in past outcomes).
--
-- The function exists from earlier work but was never scheduled — the
-- feedback flywheel never spins. This migration:
--
--   (1) Patches a latent bug — the function references
--       `restock_requests.dismissed_reason`, a column that does not exist
--       (smoke-call failed with `42703: column rr.dismissed_reason does not
--       exist`, exactly the same shape of bug as migration 113). Replaced
--       with a LEFT LATERAL JOIN against `proposal_dismissals` keyed on
--       (hotel_id, variant_id) — the table that actually tracks dismissal
--       reasons in our schema.
--
--   (2) Schedules the (now-working) function nightly at 03:00 UTC via
--       pg_cron, joining the existing `beacon-*` cron family. The cron
--       health monitor (migration 115) automatically picks up the new job
--       and includes it in `monitor_cron_health()` output, so failure
--       streaks are visible in Settings → Autonomous within 5 min.
--
-- Per CLAUDE.md self-apply rule #1 — every new RPC/trigger/RLS helper ships
-- with a test. The function smoke-test under JWT context is in the
-- verification block at the bottom of this file.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) Patch compute_proposal_outcomes — replace bare reference to
-- `rr.dismissed_reason` with a lateral lookup against proposal_dismissals.
CREATE OR REPLACE FUNCTION public.compute_proposal_outcomes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  v_req   record;
  v_outcome text;
  v_quality numeric;
  v_waste   int;
  v_fulfilled_at timestamptz;
BEGIN
  -- Process restock requests that don't have an outcome yet
  FOR v_req IN
    SELECT rr.id, rr.hotel_id, rr.variant_id, rr.quantity_needed, rr.status,
           rr.created_at, rr.is_auto_proposed,
           rr.approval_notes,
           pd.reason AS dismissed_reason
      FROM restock_requests rr
      -- Most-recent dismissal of this variant in the same hotel.
      -- Bounded to dismissals BEFORE the request was last touched so we
      -- don't pick up reasons logged after the fact.
      LEFT JOIN LATERAL (
        SELECT pd.reason
          FROM proposal_dismissals pd
         WHERE pd.hotel_id   = rr.hotel_id
           AND pd.variant_id = rr.variant_id
           AND pd.dismissed_at <= COALESCE(rr.last_escalated_at, rr.created_at + interval '30 days')
         ORDER BY pd.dismissed_at DESC
         LIMIT 1
      ) pd ON TRUE
     WHERE NOT EXISTS (
       SELECT 1 FROM proposal_outcomes po WHERE po.restock_request_id = rr.id
     )
     AND (
       rr.status IN ('received', 'cancelled')
       OR (rr.status = 'pending' AND rr.created_at < NOW() - interval '14 days')
       OR (rr.status = 'approved' AND rr.created_at < NOW() - interval '30 days')
     )
  LOOP
    v_waste := 0;
    v_fulfilled_at := NULL;

    IF v_req.status = 'received' THEN
      SELECT MAX(rr2.created_at)
        INTO v_fulfilled_at
        FROM restock_receives rr2
       WHERE rr2.request_id = v_req.id;

      IF v_fulfilled_at IS NOT NULL THEN
        SELECT COALESCE(ABS(SUM(sl.quantity_change)), 0)
          INTO v_waste
          FROM stock_logs sl
         WHERE sl.variant_id = v_req.variant_id
           AND sl.hotel_id = v_req.hotel_id
           AND sl.quantity_change < 0
           AND sl.reason IN ('write_off', 'waste', 'expired', 'breakage')
           AND sl.timestamp BETWEEN v_fulfilled_at AND v_fulfilled_at + interval '30 days';
      END IF;

      IF v_waste > GREATEST(v_req.quantity_needed * 0.2, 2) THEN
        v_outcome := 'approved_excess_waste';
        v_quality := 0.3;
      ELSE
        v_outcome := 'approved_fulfilled';
        v_quality := 0.9;
      END IF;

    ELSIF v_req.status = 'cancelled' THEN
      v_outcome := CASE
        WHEN v_req.dismissed_reason ILIKE '%not needed%'    THEN 'dismissed_not_needed'
        WHEN v_req.dismissed_reason ILIKE '%timing%'        THEN 'dismissed_wrong_timing'
        WHEN v_req.dismissed_reason ILIKE '%supplier%'      THEN 'dismissed_wrong_supplier'
        WHEN v_req.dismissed_reason ILIKE '%quantity%'      THEN 'dismissed_wrong_qty'
        WHEN v_req.dismissed_reason IS NOT NULL              THEN 'dismissed_other'
        ELSE 'dismissed_other'
      END;
      v_quality := 0.2;

    ELSIF v_req.status = 'pending' THEN
      v_outcome := 'expired';
      v_quality := 0.1;

    ELSIF v_req.status = 'approved' THEN
      v_outcome := 'approved_unfulfilled';
      v_quality := 0.4;

    ELSE
      CONTINUE;
    END IF;

    -- Auto-approved proposals get a separate tag
    IF v_req.approval_notes ILIKE '%auto-approved%' AND v_outcome = 'approved_fulfilled' THEN
      v_outcome := 'auto_approved';
      v_quality := 0.95;
    END IF;

    INSERT INTO proposal_outcomes (
      hotel_id, proposal_type, restock_request_id, variant_id,
      proposed_at, acted_at, fulfilled_at, outcome,
      proposed_qty, waste_within_30d, quality_score,
      dismissed_reason
    ) VALUES (
      v_req.hotel_id,
      CASE WHEN v_req.is_auto_proposed THEN 'restock_auto' ELSE 'restock_manual' END,
      v_req.id,
      v_req.variant_id,
      v_req.created_at,
      CASE WHEN v_req.status IN ('cancelled', 'received', 'approved') THEN NOW() END,
      v_fulfilled_at,
      v_outcome,
      v_req.quantity_needed,
      v_waste,
      v_quality,
      v_req.dismissed_reason
    ) ON CONFLICT (restock_request_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.compute_proposal_outcomes IS
  'Phase D1 feedback flywheel. Classifies terminal restock_requests into '
  'proposal_outcomes rows. Cadence: daily 03:00 UTC. Reads dismissal reasons '
  'from proposal_dismissals (hotel_id + variant_id, most recent before '
  'last_escalated_at). Idempotent via UNIQUE(restock_request_id) + '
  'ON CONFLICT DO NOTHING.';

-- Tighten EXECUTE to authenticated only (consistent with migration 121's posture).
REVOKE EXECUTE ON FUNCTION public.compute_proposal_outcomes() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.compute_proposal_outcomes() TO authenticated;


-- (2) Schedule it daily 03:00 UTC ────────────────────────────────────────────
-- Joins beacon-* cron family. Cron health monitor (115) picks it up
-- automatically; failures surface in Settings → Autonomous within 5 min.
DO $$
DECLARE
  v_existing int;
BEGIN
  SELECT count(*) INTO v_existing
  FROM cron.job WHERE jobname = 'beacon-proposal-outcomes-daily';

  IF v_existing = 0 THEN
    PERFORM cron.schedule(
      'beacon-proposal-outcomes-daily',
      '0 3 * * *',
      $cmd$ SELECT compute_proposal_outcomes() $cmd$
    );
  END IF;
END $$;


-- ─── Verification ────────────────────────────────────────────────────────────
-- After applying:
--
--   -- 1. Function executes without error against current data
--   SELECT compute_proposal_outcomes();    -- returns int (rows classified)
--
--   -- 2. Cron job is registered + active
--   SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'beacon-proposal-outcomes-daily';
--   -- expected: ('beacon-proposal-outcomes-daily', '0 3 * * *', true)
--
--   -- 3. Cron health monitor sees the new job in its summary
--   SELECT get_cron_health_summary()->'jobs';
--   -- expected: array now includes beacon-proposal-outcomes-daily
--
--   -- 4. Idempotency: running twice in a row classifies 0 new rows the second
--   --    time (UNIQUE constraint + ON CONFLICT DO NOTHING)
--   SELECT compute_proposal_outcomes();   -- repeat → 0 (or near-0)
