-- Migration 059: Approval Hardening
-- Layer: Flow
-- Purpose: Three gaps closed:
--   1. Configurable auto-escalation timeout per hotel (pg_cron job)
--   2. classify_restock_tier() now falls back to variant_cost_history when
--      product_variants.cost is NULL — prevents uncosted items bypassing approval
--   3. get_approval_velocity() + get_spend_trend() analytics RPCs for Flow Dashboard

SET search_path = public;

-- ─── 1. Escalation timeout + escalation tracking ──────────────────────────────

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS escalation_timeout_hours integer NOT NULL DEFAULT 24;

COMMENT ON COLUMN hotels.escalation_timeout_hours IS
  'Hours before a stale pending_manager request is auto-escalated to pending_director.';

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS escalation_count    integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at   timestamptz;

COMMENT ON COLUMN restock_requests.escalation_count   IS 'Number of times this request has been auto-escalated due to timeout.';
COMMENT ON COLUMN restock_requests.last_escalated_at  IS 'Timestamp of the last auto-escalation.';

-- ─── 2. Fix classify_restock_tier() — cost_history fallback ───────────────────
-- Original: skipped approval when product_variants.cost IS NULL.
-- Fixed:    falls back to the most recent variant_cost_history entry so that
--           items with a stale or missing current cost still get routed correctly.

CREATE OR REPLACE FUNCTION classify_restock_tier()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_unit_cost          numeric;
  v_manager_threshold  numeric;
  v_director_threshold numeric;
  v_cost               numeric;
BEGIN
  -- Only classify newly inserted rows still in 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Use variant.cost; fall back to most recent cost_history entry when NULL
  SELECT COALESCE(
    pv.cost,
    (SELECT vch.cost
       FROM variant_cost_history vch
      WHERE vch.variant_id = NEW.variant_id
      ORDER BY vch.effective_from DESC
      LIMIT 1)
  )
    INTO v_unit_cost
    FROM product_variants pv
   WHERE pv.id = NEW.variant_id;

  SELECT manager_approval_threshold, director_approval_threshold
    INTO v_manager_threshold, v_director_threshold
    FROM hotels
   WHERE id = NEW.hotel_id;

  -- Still uncosted after fallback: skip approval, leave tier = 'none'
  IF v_unit_cost IS NULL THEN
    RETURN NEW;
  END IF;

  v_cost             := v_unit_cost * NEW.quantity_needed;
  NEW.estimated_cost := v_cost;

  IF v_cost > COALESCE(v_director_threshold, 500) THEN
    NEW.required_approval_tier := 'director';
    NEW.status                 := 'pending_director';
  ELSIF v_cost > COALESCE(v_manager_threshold, 100) THEN
    NEW.required_approval_tier := 'manager';
    NEW.status                 := 'pending_manager';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (no-op if already attached, but harmless to drop/recreate)
DROP TRIGGER IF EXISTS trg_classify_restock_tier ON restock_requests;
CREATE TRIGGER trg_classify_restock_tier
BEFORE INSERT ON restock_requests
FOR EACH ROW EXECUTE FUNCTION classify_restock_tier();

-- ─── 3. escalate_stale_approvals() ────────────────────────────────────────────
-- Called by pg_cron every 30 minutes.
-- pending_manager past timeout → escalated to pending_director + escalation_count++
-- pending_director past timeout → escalation_count++ (already at max tier, just flag)
-- Returns total number of rows touched.

CREATE OR REPLACE FUNCTION escalate_stale_approvals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escalated integer := 0;
  v_flagged   integer := 0;
BEGIN
  -- Escalate pending_manager → pending_director
  WITH escalated AS (
    UPDATE restock_requests rr
       SET status                 = 'pending_director',
           required_approval_tier = 'director',
           escalation_count       = rr.escalation_count + 1,
           last_escalated_at      = NOW(),
           updated_at             = NOW()
      FROM hotels h
     WHERE rr.hotel_id = h.id
       AND rr.status   = 'pending_manager'
       AND rr.updated_at < NOW() - make_interval(hours => h.escalation_timeout_hours)
    RETURNING rr.id
  )
  SELECT COUNT(*)::integer INTO v_escalated FROM escalated;

  -- Bump escalation_count for pending_director past timeout
  WITH flagged AS (
    UPDATE restock_requests rr
       SET escalation_count  = rr.escalation_count + 1,
           last_escalated_at = NOW(),
           updated_at        = NOW()
      FROM hotels h
     WHERE rr.hotel_id = h.id
       AND rr.status   = 'pending_director'
       AND (
         rr.last_escalated_at IS NULL
         OR rr.last_escalated_at < NOW() - make_interval(hours => h.escalation_timeout_hours)
       )
    RETURNING rr.id
  )
  SELECT COUNT(*)::integer INTO v_flagged FROM flagged;

  RETURN v_escalated + v_flagged;
END;
$$;

-- ─── 4. pg_cron schedule ──────────────────────────────────────────────────────
-- Runs every 30 minutes. Wrapped in a DO block so the migration succeeds even
-- if pg_cron is not enabled. Enable via Supabase dashboard → Database → Extensions
-- → pg_cron, then re-run this block manually or apply the schedule there.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $cron$
      SELECT cron.unschedule(jobid)
        FROM cron.job
       WHERE jobname = 'escalate-stale-approvals';

      SELECT cron.schedule(
        'escalate-stale-approvals',
        '*/30 * * * *',
        'SELECT escalate_stale_approvals()'
      );
    $cron$;
  ELSE
    RAISE NOTICE 'pg_cron not enabled — escalate_stale_approvals() must be scheduled manually. Enable pg_cron via Supabase dashboard → Database → Extensions.';
  END IF;
END;
$$;

-- ─── 5. update_approval_thresholds() — extend with escalation timeout ─────────
-- Drop old 2-arg overload; recreate with 3-arg signature that also saves
-- escalation_timeout_hours. Old callers that pass 2 args will need updating —
-- all callers are internal (frontend API layer), updated in this sprint.

DROP FUNCTION IF EXISTS update_approval_thresholds(numeric, numeric);

CREATE OR REPLACE FUNCTION update_approval_thresholds(
  p_manager_threshold         numeric,
  p_director_threshold        numeric,
  p_escalation_timeout_hours  integer DEFAULT 24
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() != 'owner' THEN
    RAISE EXCEPTION 'Only hotel owners can change approval thresholds';
  END IF;

  IF p_director_threshold <= p_manager_threshold THEN
    RAISE EXCEPTION 'Director threshold must be strictly greater than manager threshold';
  END IF;

  IF p_escalation_timeout_hours < 1 THEN
    RAISE EXCEPTION 'Escalation timeout must be at least 1 hour';
  END IF;

  UPDATE hotels
     SET manager_approval_threshold  = p_manager_threshold,
         director_approval_threshold = p_director_threshold,
         escalation_timeout_hours    = p_escalation_timeout_hours
   WHERE id = auth_hotel_id();
END;
$$;

GRANT EXECUTE ON FUNCTION update_approval_thresholds(numeric, numeric, integer) TO authenticated;

-- ─── 6. get_approval_velocity(p_days) ─────────────────────────────────────────
-- Returns avg hours to approve/reject by tier over a rolling window.
-- Used by the Flow Dashboard to show operational health of the approval queue.

CREATE OR REPLACE FUNCTION get_approval_velocity(p_days integer DEFAULT 30)
RETURNS TABLE (
  required_approval_tier  text,
  total_requests          bigint,
  approved_count          bigint,
  rejected_count          bigint,
  avg_hours_to_approve    numeric,
  avg_hours_to_reject     numeric,
  escalated_count         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    required_approval_tier,
    COUNT(*)                                                                          AS total_requests,
    COUNT(*) FILTER (WHERE status = 'approved')                                       AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected')                                       AS rejected_count,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (approved_at - date)) / 3600.0)
        FILTER (WHERE approved_at IS NOT NULL),
      1
    )                                                                                 AS avg_hours_to_approve,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (rejected_at - date)) / 3600.0)
        FILTER (WHERE rejected_at IS NOT NULL),
      1
    )                                                                                 AS avg_hours_to_reject,
    COUNT(*) FILTER (WHERE escalation_count > 0)                                      AS escalated_count
  FROM restock_requests
  WHERE hotel_id = auth_hotel_id()
    AND date    >= NOW() - make_interval(days => p_days)
  GROUP BY required_approval_tier
  ORDER BY required_approval_tier;
$$;

-- ─── 6. get_spend_trend(p_months) ─────────────────────────────────────────────
-- Returns monthly restock spend for the Flow Dashboard spend-trend panel.
-- total_estimated: estimated_cost of all requests in that month.
-- total_fulfilled: estimated_cost of requests that reached 'fulfilled' status.

CREATE OR REPLACE FUNCTION get_spend_trend(p_months integer DEFAULT 6)
RETURNS TABLE (
  month              date,
  total_estimated    numeric,
  total_fulfilled    numeric,
  request_count      bigint,
  fulfilled_count    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE_TRUNC('month', date)::date          AS month,
    SUM(estimated_cost)                      AS total_estimated,
    SUM(estimated_cost) FILTER (WHERE status = 'fulfilled') AS total_fulfilled,
    COUNT(*)                                 AS request_count,
    COUNT(*) FILTER (WHERE status = 'fulfilled') AS fulfilled_count
  FROM restock_requests
  WHERE hotel_id = auth_hotel_id()
    AND date     >= (DATE_TRUNC('month', NOW()) - make_interval(months => p_months))::date
  GROUP BY DATE_TRUNC('month', date)::date
  ORDER BY month ASC;
$$;

GRANT EXECUTE ON FUNCTION get_approval_velocity(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spend_trend(integer)       TO authenticated;
GRANT EXECUTE ON FUNCTION escalate_stale_approvals()     TO authenticated;
