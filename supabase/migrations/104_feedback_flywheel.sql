-- ═══════════════════════════════════════════════════════════════════════════════
-- 104 — Closed-Loop Learning: Feedback Flywheel (Phase D)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Every human decision feeds back into the system. Track proposal outcomes,
--   learn per-variant alert thresholds, and close the loop between AI proposals
--   and real-world results.
--
-- What this migration does:
--   1. Creates `proposal_outcomes` table — end-to-end proposal quality tracking
--   2. Creates `variant_learned_thresholds` — per-variant personalized alert levels
--   3. Creates `compute_proposal_outcomes()` — scores proposals after execution
--   4. Creates `update_learned_thresholds()` — adjusts thresholds from dismissal patterns
--   5. Adds scoring to the intelligence cycle
--
-- Depends on: 022, 025, 054, 102
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. proposal_outcomes ───────────────────────────────────────────────────────
-- Links: notification/proposal → restock_request → receives → post-receive waste
-- Each row is computed by the scoring function, not written by the user.

CREATE TABLE IF NOT EXISTS proposal_outcomes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id               uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  proposal_type          text NOT NULL CHECK (proposal_type IN ('restock_auto', 'restock_manual', 'alert')),
  -- Source
  notification_id        uuid REFERENCES notifications(id),
  restock_request_id     uuid REFERENCES restock_requests(id),
  variant_id             uuid NOT NULL,
  -- Timing
  proposed_at            timestamptz NOT NULL,
  acted_at               timestamptz,          -- when approved/dismissed
  fulfilled_at           timestamptz,          -- when stock received
  -- Outcome
  outcome                text NOT NULL CHECK (outcome IN (
    'approved_fulfilled',     -- approved → ordered → received
    'approved_unfulfilled',   -- approved → never received (stale)
    'approved_excess_waste',  -- approved → received → >20% wrote off within 30d
    'dismissed_not_needed',   -- operator said "not needed"
    'dismissed_wrong_qty',    -- operator adjusted quantity before approving
    'dismissed_wrong_timing', -- "too early"
    'dismissed_wrong_supplier',
    'dismissed_other',
    'auto_approved',          -- passed through auto-approval guardrails
    'expired'                 -- never acted on
  )),
  -- Quality metrics
  proposed_qty           int,
  actual_qty             int,                   -- quantity actually ordered/received
  waste_within_30d       int DEFAULT 0,         -- units written off within 30d of receipt
  quality_score          numeric(3,2),          -- 0.0–1.0 composite score
  -- Metadata
  dismissed_reason       text,
  notes                  text,
  computed_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restock_request_id)                   -- one outcome per restock request
);

ALTER TABLE proposal_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select" ON proposal_outcomes;
CREATE POLICY "po_select" ON proposal_outcomes
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_proposal_outcomes_hotel_variant
  ON proposal_outcomes (hotel_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_proposal_outcomes_computed
  ON proposal_outcomes (computed_at);

COMMENT ON TABLE proposal_outcomes IS
  'End-to-end quality tracking for every AI proposal. '
  'Computed by compute_proposal_outcomes(), used by the feedback flywheel to improve future proposals.';

-- ─── 2. variant_learned_thresholds ──────────────────────────────────────────────
-- Per-variant overrides learned from dismissal patterns.
-- When operators repeatedly dismiss alerts for a variant, the system learns to
-- adjust the alert threshold for that specific variant.

CREATE TABLE IF NOT EXISTS variant_learned_thresholds (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id               uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  variant_id             uuid NOT NULL,
  -- Learned values
  alert_days_threshold   numeric(5,1),          -- override for "alert when N days until zero"
  restock_qty_multiplier numeric(4,2) DEFAULT 1.0, -- scale suggested qty up/down
  suppress_until         timestamptz,           -- temporarily suppress alerts
  -- Learning metadata
  dismissal_count        int NOT NULL DEFAULT 0,
  approval_count         int NOT NULL DEFAULT 0,
  last_dismissed_at      timestamptz,
  last_approved_at       timestamptz,
  confidence             numeric(3,2) DEFAULT 0.5, -- how confident the system is in the learned values
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, variant_id)
);

ALTER TABLE variant_learned_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vlt_select" ON variant_learned_thresholds;
CREATE POLICY "vlt_select" ON variant_learned_thresholds
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_vlt_hotel_variant
  ON variant_learned_thresholds (hotel_id, variant_id);

COMMENT ON TABLE variant_learned_thresholds IS
  'Per-variant learned thresholds from operator feedback. '
  'Dismissals lower sensitivity, approvals reinforce current levels.';

-- ─── 3. compute_proposal_outcomes() ─────────────────────────────────────────────
-- Scores restock proposals that have reached a terminal state (received, cancelled,
-- or stale >14 days). Called by the intelligence cycle.

CREATE OR REPLACE FUNCTION compute_proposal_outcomes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
           rr.approval_notes, rr.dismissed_reason
      FROM restock_requests rr
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

    -- Determine outcome based on status
    IF v_req.status = 'received' THEN
      -- Check how much was received
      SELECT MAX(rr2.created_at)
        INTO v_fulfilled_at
        FROM restock_receives rr2
       WHERE rr2.request_id = v_req.id;

      -- Check waste within 30 days of receipt
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

GRANT EXECUTE ON FUNCTION compute_proposal_outcomes() TO service_role;

-- ─── 4. update_learned_thresholds() ─────────────────────────────────────────────
-- Analyzes proposal outcomes and notification dismissals to learn per-variant
-- alert sensitivity adjustments.

CREATE OR REPLACE FUNCTION update_learned_thresholds()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count    int := 0;
  v_variant  record;
  v_dismiss  int;
  v_approve  int;
  v_new_days numeric;
  v_new_mult numeric;
  v_conf     numeric;
BEGIN
  -- For each variant that has proposal outcomes in the last 90 days
  FOR v_variant IN
    SELECT DISTINCT po.hotel_id, po.variant_id
      FROM proposal_outcomes po
     WHERE po.computed_at > NOW() - interval '90 days'
  LOOP
    -- Count dismissals vs approvals
    SELECT
      COUNT(*) FILTER (WHERE outcome LIKE 'dismissed_%'),
      COUNT(*) FILTER (WHERE outcome IN ('approved_fulfilled', 'auto_approved'))
    INTO v_dismiss, v_approve
    FROM proposal_outcomes
    WHERE hotel_id = v_variant.hotel_id
      AND variant_id = v_variant.variant_id
      AND computed_at > NOW() - interval '90 days';

    -- Skip if too few data points
    IF v_dismiss + v_approve < 3 THEN
      CONTINUE;
    END IF;

    -- Calculate learned values
    -- High dismiss rate → raise alert threshold (alert later / less)
    -- High approve rate → keep or tighten threshold
    v_conf := LEAST((v_dismiss + v_approve) / 10.0, 1.0);

    IF v_dismiss > v_approve * 2 THEN
      -- Dismissed more than 2:1 → reduce sensitivity
      v_new_days := GREATEST(3, 7 * (1 - v_dismiss::numeric / (v_dismiss + v_approve)));
      v_new_mult := GREATEST(0.5, 1.0 - 0.1 * (v_dismiss - v_approve));
    ELSIF v_approve > v_dismiss * 3 THEN
      -- Strong approval signal → tighten slightly
      v_new_days := 10;
      v_new_mult := LEAST(1.5, 1.0 + 0.05 * v_approve);
    ELSE
      -- Balanced → keep defaults
      v_new_days := 7;
      v_new_mult := 1.0;
    END IF;

    INSERT INTO variant_learned_thresholds (
      hotel_id, variant_id, alert_days_threshold, restock_qty_multiplier,
      dismissal_count, approval_count, confidence, updated_at
    ) VALUES (
      v_variant.hotel_id, v_variant.variant_id,
      v_new_days, v_new_mult,
      v_dismiss, v_approve, v_conf, NOW()
    )
    ON CONFLICT (hotel_id, variant_id) DO UPDATE SET
      alert_days_threshold   = EXCLUDED.alert_days_threshold,
      restock_qty_multiplier = EXCLUDED.restock_qty_multiplier,
      dismissal_count        = EXCLUDED.dismissal_count,
      approval_count         = EXCLUDED.approval_count,
      confidence             = EXCLUDED.confidence,
      updated_at             = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_learned_thresholds() TO service_role;

-- ─── 5. get_proposal_quality_summary() ──────────────────────────────────────────
-- Dashboard RPC: aggregated proposal quality metrics for the hotel.

CREATE OR REPLACE FUNCTION get_proposal_quality_summary(p_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_proposals',     COUNT(*),
    'avg_quality_score',   ROUND(AVG(quality_score), 2),
    'approval_rate',       ROUND(
      COUNT(*) FILTER (WHERE outcome IN ('approved_fulfilled', 'auto_approved', 'approved_unfulfilled'))::numeric
      / NULLIF(COUNT(*), 0), 2
    ),
    'auto_approval_rate',  ROUND(
      COUNT(*) FILTER (WHERE outcome = 'auto_approved')::numeric
      / NULLIF(COUNT(*), 0), 2
    ),
    'excess_waste_rate',   ROUND(
      COUNT(*) FILTER (WHERE outcome = 'approved_excess_waste')::numeric
      / NULLIF(COUNT(*), 0), 3
    ),
    'dismissal_breakdown', jsonb_build_object(
      'not_needed',        COUNT(*) FILTER (WHERE outcome = 'dismissed_not_needed'),
      'wrong_qty',         COUNT(*) FILTER (WHERE outcome = 'dismissed_wrong_qty'),
      'wrong_timing',      COUNT(*) FILTER (WHERE outcome = 'dismissed_wrong_timing'),
      'wrong_supplier',    COUNT(*) FILTER (WHERE outcome = 'dismissed_wrong_supplier'),
      'other',             COUNT(*) FILTER (WHERE outcome = 'dismissed_other'),
      'expired',           COUNT(*) FILTER (WHERE outcome = 'expired')
    ),
    'variants_with_learned_thresholds', (
      SELECT COUNT(*) FROM variant_learned_thresholds
       WHERE hotel_id = auth_hotel_id() AND confidence > 0.3
    )
  )
  INTO v_result
  FROM proposal_outcomes
  WHERE hotel_id = auth_hotel_id()
    AND computed_at > NOW() - (p_days || ' days')::interval;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_proposal_quality_summary(int) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
-- - proposal_outcomes: tracks every proposal from creation → outcome
-- - variant_learned_thresholds: per-variant sensitivity learned from feedback
-- - compute_proposal_outcomes(): scores completed proposals
-- - update_learned_thresholds(): adjusts sensitivity from patterns
-- - get_proposal_quality_summary(): dashboard metrics
--
-- The intelligence cycle (run_intelligence_cycle) should call:
--   1. compute_proposal_outcomes() to score completed proposals
--   2. update_learned_thresholds() to learn from patterns
-- ═══════════════════════════════════════════════════════════════════════════════
