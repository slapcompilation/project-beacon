-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 113 — restock_requests.updated_at + auto-touch trigger
--
-- Problem: `escalate_stale_approvals()` (called by the every-15-min
-- `beacon-intelligence-cycle` cron) and `get_smart_proposals()` both reference
-- `rr.updated_at`, but the column was never added to `restock_requests`.
-- Every cron run failed with:
--   ERROR:  42703: column rr.updated_at does not exist
-- ...which aborted the surrounding transaction and produced the cascade of
-- "current transaction is aborted" log entries the user saw.
--
-- Fix: add `updated_at` (timestamptz, NOT NULL, default NOW()), backfill from
-- `created_at` so the existing `last_escalated_at < NOW() - timeout` semantics
-- behave correctly on existing rows, and install a BEFORE UPDATE trigger that
-- maintains it automatically.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Add the column. Idempotent — IF NOT EXISTS lets re-runs no-op.
ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Backfill: existing rows should reflect their last-known mutation time.
--    Prefer the most recent of (last_escalated_at, approved_at, rejected_at,
--    created_at) so escalation timing is preserved for in-flight requests.
UPDATE restock_requests
SET updated_at = GREATEST(
  COALESCE(last_escalated_at, '-infinity'::timestamptz),
  COALESCE(approved_at,       '-infinity'::timestamptz),
  COALESCE(rejected_at,       '-infinity'::timestamptz),
  created_at
)
WHERE updated_at = created_at;  -- only touch rows still at the default

-- 3. Auto-touch trigger. Generic name + IF NOT EXISTS pattern via DROP/CREATE.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_requests_touch ON restock_requests;
CREATE TRIGGER trg_restock_requests_touch
  BEFORE UPDATE ON restock_requests
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 4. Index — escalate_stale_approvals filters by status + updated_at.
CREATE INDEX IF NOT EXISTS idx_rr_status_updated
  ON restock_requests (status, updated_at)
  WHERE status IN ('pending_manager', 'pending_director');

COMMIT;

-- ─── Verification ────────────────────────────────────────────────────────────
-- Run after applying:
--   SELECT * FROM run_intelligence_cycle();         -- should succeed
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='restock_requests' AND column_name='updated_at';
-- Postgres logs: the every-15-min "column rr.updated_at does not exist"
-- error storm should disappear from the next cycle onward.
