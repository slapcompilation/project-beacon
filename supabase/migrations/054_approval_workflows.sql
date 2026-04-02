-- Migration 054: Tiered Approval Workflows
-- Layer: Flow
-- Purpose: Add tiered spend authority to restock requests.
-- Manager tier  (default $100–$499): requires admin or owner to approve.
-- Director tier (default $500+)    : requires owner to approve.
-- New statuses: pending_manager, pending_director, rejected
-- A BEFORE INSERT trigger auto-classifies every request on creation,
-- so all existing code paths (manual, AI proposals, auto-trigger) benefit
-- without any frontend changes required beyond the new approve/reject RPCs.

SET search_path = public;

-- ─── 1. Hotel approval thresholds ─────────────────────────────────────────────

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS manager_approval_threshold  numeric(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS director_approval_threshold numeric(10,2) NOT NULL DEFAULT 500;

COMMENT ON COLUMN hotels.manager_approval_threshold  IS
  'Restock requests with estimated_cost above this value route to pending_manager.';
COMMENT ON COLUMN hotels.director_approval_threshold IS
  'Restock requests with estimated_cost above this value route to pending_director (owner-only approval).';

-- ─── 2. restock_requests — extended status + approval metadata ─────────────────

-- Widen the status CHECK to include new values.
-- PostgreSQL names inline column CHECKs as <table>_<column>_check.
ALTER TABLE restock_requests DROP CONSTRAINT IF EXISTS restock_requests_status_check;
ALTER TABLE restock_requests
  ADD CONSTRAINT restock_requests_status_check
  CHECK (status IN (
    'pending', 'pending_manager', 'pending_director',
    'approved', 'fulfilled', 'cancelled', 'rejected'
  ));

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS estimated_cost         numeric(10,2),
  ADD COLUMN IF NOT EXISTS required_approval_tier text NOT NULL DEFAULT 'none'
    CONSTRAINT restock_requests_tier_check
    CHECK (required_approval_tier IN ('none', 'manager', 'director')),
  ADD COLUMN IF NOT EXISTS approved_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at            timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes         text,
  ADD COLUMN IF NOT EXISTS rejected_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at            timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason        text;

COMMENT ON COLUMN restock_requests.estimated_cost         IS 'quantity_needed × variant.cost at creation time. NULL when variant has no cost set.';
COMMENT ON COLUMN restock_requests.required_approval_tier IS 'none = standard flow, manager = admin/owner required, director = owner only.';

-- ─── 3. Tier classification trigger (BEFORE INSERT) ───────────────────────────
-- Fires on every new restock request. Computes estimated_cost and
-- routes to pending_manager / pending_director when thresholds are exceeded.
-- If the variant has no cost, estimated_cost is NULL and tier defaults to 'none'
-- (uncosted items skip approval — add a cost to enforce approval).

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

  SELECT cost
    INTO v_unit_cost
    FROM product_variants
   WHERE id = NEW.variant_id;

  SELECT manager_approval_threshold, director_approval_threshold
    INTO v_manager_threshold, v_director_threshold
    FROM hotels
   WHERE id = NEW.hotel_id;

  -- Uncosted variant: skip approval, leave tier = 'none'
  IF v_unit_cost IS NULL THEN
    RETURN NEW;
  END IF;

  v_cost               := v_unit_cost * NEW.quantity_needed;
  NEW.estimated_cost   := v_cost;

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

DROP TRIGGER IF EXISTS trg_classify_restock_tier ON restock_requests;
CREATE TRIGGER trg_classify_restock_tier
BEFORE INSERT ON restock_requests
FOR EACH ROW EXECUTE FUNCTION classify_restock_tier();

-- ─── 4. approve_restock() ─────────────────────────────────────────────────────
-- Validates caller's role against the request's required_approval_tier,
-- then atomically sets status = 'approved' with audit metadata.

CREATE OR REPLACE FUNCTION approve_restock(
  p_request_id uuid,
  p_notes      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req  restock_requests%ROWTYPE;
  v_role text;
BEGIN
  v_role := auth_role();

  SELECT * INTO v_req
    FROM restock_requests
   WHERE id = p_request_id AND hotel_id = auth_hotel_id()
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restock request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'pending_manager', 'pending_director') THEN
    RAISE EXCEPTION 'Cannot approve: request is in status %', v_req.status;
  END IF;

  -- Tier permission checks
  IF v_req.required_approval_tier = 'director' AND v_role != 'owner' THEN
    RAISE EXCEPTION 'Director-tier requests require owner role to approve';
  END IF;

  IF v_req.required_approval_tier = 'manager' AND v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Manager-tier requests require admin or owner role to approve';
  END IF;

  UPDATE restock_requests
     SET status        = 'approved',
         approved_by   = auth.uid(),
         approved_at   = now(),
         approval_notes = p_notes
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_restock(uuid, text) TO authenticated;

-- ─── 5. reject_restock() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reject_restock(
  p_request_id uuid,
  p_reason     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req  restock_requests%ROWTYPE;
  v_role text;
BEGIN
  v_role := auth_role();

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Rejection requires admin or owner role';
  END IF;

  SELECT * INTO v_req
    FROM restock_requests
   WHERE id = p_request_id AND hotel_id = auth_hotel_id()
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restock request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'pending_manager', 'pending_director') THEN
    RAISE EXCEPTION 'Can only reject pending requests (current: %)', v_req.status;
  END IF;

  UPDATE restock_requests
     SET status          = 'rejected',
         rejected_by     = auth.uid(),
         rejected_at     = now(),
         rejected_reason = p_reason
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_restock(uuid, text) TO authenticated;

-- ─── 6. update_approval_thresholds() ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_approval_thresholds(
  p_manager_threshold  numeric,
  p_director_threshold numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() != 'owner' THEN
    RAISE EXCEPTION 'Only hotel owners can update approval thresholds';
  END IF;

  IF p_manager_threshold < 0 OR p_director_threshold < 0 THEN
    RAISE EXCEPTION 'Thresholds must be non-negative';
  END IF;

  IF p_director_threshold <= p_manager_threshold THEN
    RAISE EXCEPTION 'Director threshold must be strictly greater than manager threshold';
  END IF;

  UPDATE hotels
     SET manager_approval_threshold  = p_manager_threshold,
         director_approval_threshold = p_director_threshold
   WHERE id = auth_hotel_id();
END;
$$;

GRANT EXECUTE ON FUNCTION update_approval_thresholds(numeric, numeric) TO authenticated;

-- ─── 7. Extend approval notification trigger ──────────────────────────────────
-- Replace the existing function to also fire on rejection.

CREATE OR REPLACE FUNCTION notify_restock_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  -- Build label
  SELECT COALESCE(pv.name || ' (' || p.name || ')', p.name)
    INTO v_label
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
   WHERE pv.id = NEW.variant_id;

  -- Guard: requestor must still have a profile
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.requestor_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    VALUES (
      NEW.hotel_id,
      NEW.requestor_id,
      'Your restock request for ' || COALESCE(v_label, 'a product') || ' has been approved.',
      'approval'
    );
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO notifications (hotel_id, user_id, message, type)
    VALUES (
      NEW.hotel_id,
      NEW.requestor_id,
      'Your restock request for ' || COALESCE(v_label, 'a product') || ' has been rejected'
        || CASE WHEN NEW.rejected_reason IS NOT NULL THEN ': ' || NEW.rejected_reason ELSE '.' END,
      'alert'
    );
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger definition unchanged — just the function body was extended.
