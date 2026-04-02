-- Migration 060: Fix approval velocity timestamp precision + spend trend actual amounts
-- Layer: Flow
-- Fixes two correctness issues found in 059:
--
-- 1. get_approval_velocity() used `date` (a DATE column — no time component) as the
--    request creation timestamp. Dividing (approved_at - date) gave hours-since-midnight
--    rather than hours-since-creation, introducing up to 24h error per request.
--    Fix: add created_at timestamptz to restock_requests; backfill from date; use it.
--
-- 2. get_spend_trend() returned estimated_cost as "fulfilled" spend. estimated_cost is
--    quantity_needed × variant.cost at creation time — not actual received amounts.
--    Fix: compute actual_fulfilled from restock_receives (quantity_received × unit_cost)
--    and rename the column so callers cannot mistake it for an actual invoice total.

SET search_path = public;

-- ─── 1. Add created_at timestamptz to restock_requests ────────────────────────

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Backfill existing rows: cast date (midnight UTC) to timestamptz as best approximation
UPDATE restock_requests
   SET created_at = date::timestamptz
 WHERE created_at IS NULL;

-- Lock in NOT NULL + default for all future inserts
ALTER TABLE restock_requests
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

COMMENT ON COLUMN restock_requests.created_at IS
  'Exact creation timestamp. Backfilled from date column (midnight UTC) for rows created before migration 060.';

CREATE INDEX IF NOT EXISTS idx_restock_requests_created_at
  ON restock_requests (hotel_id, created_at DESC);

-- ─── 2. Update get_approval_velocity() to use created_at ──────────────────────

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
    COUNT(*)                                                                           AS total_requests,
    COUNT(*) FILTER (WHERE status = 'approved')                                        AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected')                                        AS rejected_count,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600.0)
        FILTER (WHERE approved_at IS NOT NULL),
      1
    )                                                                                  AS avg_hours_to_approve,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (rejected_at - created_at)) / 3600.0)
        FILTER (WHERE rejected_at IS NOT NULL),
      1
    )                                                                                  AS avg_hours_to_reject,
    COUNT(*) FILTER (WHERE escalation_count > 0)                                       AS escalated_count
  FROM restock_requests
  WHERE hotel_id    = auth_hotel_id()
    AND created_at >= NOW() - make_interval(days => p_days)
  GROUP BY required_approval_tier
  ORDER BY required_approval_tier;
$$;

-- ─── 3. Update get_spend_trend() — actual received amounts ────────────────────
-- Must drop first: the return type changes (total_fulfilled → actual_fulfilled).

DROP FUNCTION IF EXISTS get_spend_trend(integer);
-- total_estimated : estimated_cost (qty_needed × cost at creation) — labelled clearly.
-- actual_fulfilled: sum of quantity_received × unit_cost from restock_receives for
--                   fulfilled requests. NULL when no receives have been recorded.
-- Managers can now see the gap between what was estimated and what was actually spent.

CREATE OR REPLACE FUNCTION get_spend_trend(p_months integer DEFAULT 6)
RETURNS TABLE (
  month              date,
  total_estimated    numeric,
  actual_fulfilled   numeric,   -- renamed from total_fulfilled; now uses real receive data
  request_count      bigint,
  fulfilled_count    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE_TRUNC('month', rr.date)::date                                        AS month,
    SUM(rr.estimated_cost)                                                     AS total_estimated,
    SUM(recv.actual_cost)                                                      AS actual_fulfilled,
    COUNT(DISTINCT rr.id)                                                      AS request_count,
    COUNT(DISTINCT rr.id) FILTER (WHERE rr.status = 'fulfilled')               AS fulfilled_count
  FROM restock_requests rr
  LEFT JOIN LATERAL (
    SELECT SUM(rec.quantity_received * COALESCE(rec.unit_cost, 0)) AS actual_cost
      FROM restock_receives rec
     WHERE rec.request_id = rr.id
  ) recv ON TRUE
  WHERE rr.hotel_id = auth_hotel_id()
    AND rr.date    >= (DATE_TRUNC('month', NOW()) - make_interval(months => p_months))::date
  GROUP BY DATE_TRUNC('month', rr.date)::date
  ORDER BY month ASC;
$$;

-- ─── Acceptance test helper ───────────────────────────────────────────────────
-- Run this in the SQL editor to verify auto-escalation end-to-end:
--
--   -- 1. Find a pending_manager request and force it to look stale:
--   UPDATE restock_requests
--      SET updated_at = NOW() - INTERVAL '48 hours'
--    WHERE status = 'pending_manager'
--    LIMIT 1;
--
--   -- 2. Trigger the job manually:
--   SELECT escalate_stale_approvals();
--
--   -- 3. Confirm the row moved to pending_director and escalation_count = 1:
--   SELECT id, status, required_approval_tier, escalation_count, last_escalated_at
--     FROM restock_requests
--    WHERE escalation_count > 0;
