-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — GDPR Erasure + Notifications
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Make stock_logs.user_id nullable (required for GDPR anonymisation) ───
ALTER TABLE stock_logs ALTER COLUMN user_id DROP NOT NULL;

-- ─── 2. Notifications table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id  uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message   text NOT NULL,
  type      text NOT NULL DEFAULT 'system'
              CHECK (type IN ('low_stock', 'expiry', 'approval', 'system')),
  timestamp timestamptz NOT NULL DEFAULT now(),
  read      boolean NOT NULL DEFAULT false
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON notifications
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── 3. GDPR erasure requests table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_erasure_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid NOT NULL REFERENCES hotels(id),
  subject_email text NOT NULL,          -- store email separately so we have a record
  requested_by  uuid NOT NULL REFERENCES auth.users(id),
  status        text NOT NULL DEFAULT 'processed'
                  CHECK (status IN ('pending', 'processed')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

ALTER TABLE gdpr_erasure_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only" ON gdpr_erasure_requests
  FOR ALL USING (hotel_id = auth_hotel_id() AND auth_role() IN ('owner', 'admin'));

-- ─── 4. anonymize_user_pii RPC ───────────────────────────────────────────────
-- SECURITY DEFINER runs as the function owner (postgres) so it can UPDATE
-- stock_logs, which has no UPDATE RLS policy by design (immutability).
-- The hotel-isolation and role checks are enforced inside the function body.

CREATE OR REPLACE FUNCTION anonymize_user_pii(
  p_user_id    uuid,
  p_user_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
BEGIN
  -- Enforce caller is an admin or owner
  IF auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can anonymise user data';
  END IF;

  -- Nullify user_id in stock_logs for this user within this hotel only
  UPDATE stock_logs
  SET user_id = NULL
  WHERE user_id = p_user_id
    AND hotel_id = v_hotel_id;

  -- Record the erasure request
  INSERT INTO gdpr_erasure_requests (
    hotel_id, subject_email, requested_by, status, processed_at
  )
  VALUES (
    v_hotel_id, p_user_email, auth.uid(), 'processed', now()
  );
END;
$$;
