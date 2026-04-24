-- Migration 101: Outbound webhook endpoints + delivery audit log
-- Phase 8 — every BeaconAction can notify external PMS / supplier systems.
--
-- Architecture:
--   webhook_endpoints  — hotel-configured HTTPS targets, per-event-type filtering
--   webhook_deliveries — immutable delivery audit (never deleted, used for replay/debug)
--
-- The fire-webhooks edge function reads enabled endpoints, POSTs signed payloads,
-- and writes a delivery record regardless of success or failure.

-- ─── 1. webhook_endpoints ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name         text        NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  url          text        NOT NULL CHECK (url LIKE 'https://%'),
  -- HMAC-SHA256 signing secret — minimum 16 chars to prevent weak secrets
  secret       text        NOT NULL CHECK (char_length(secret) >= 16),
  -- Empty array = subscribe to all action types
  -- Non-empty  = only fire for those action types (e.g. ['ADJUST_STOCK','WRITE_OFF'])
  event_types  text[]      NOT NULL DEFAULT '{}',
  enabled      boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_members_read_webhook_endpoints"
  ON webhook_endpoints FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "admins_manage_webhook_endpoints"
  ON webhook_endpoints FOR ALL
  USING  (hotel_id = auth_hotel_id() AND auth_role() IN ('admin', 'owner'))
  WITH CHECK (hotel_id = auth_hotel_id() AND auth_role() IN ('admin', 'owner'));

GRANT ALL ON webhook_endpoints TO authenticated;

-- ─── 2. webhook_deliveries ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id   uuid        NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  hotel_id      uuid        NOT NULL,
  action_type   text        NOT NULL,
  -- Full signed payload that was posted (for replay / debug)
  payload       jsonb       NOT NULL,
  status_code   integer,
  success       boolean     NOT NULL DEFAULT false,
  -- HTTP error or network error message
  error         text,
  duration_ms   integer,
  delivered_at  timestamptz NOT NULL DEFAULT now()
);

-- Deliveries are append-only — no UPDATE or DELETE via client
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_webhook_deliveries"
  ON webhook_deliveries FOR SELECT
  USING (hotel_id = auth_hotel_id() AND auth_role() IN ('admin', 'owner'));

-- Inserts come from the service-role edge function only — no client INSERT policy

GRANT SELECT ON webhook_deliveries TO authenticated;

-- ─── 3. Index for efficient per-endpoint delivery lookups ─────────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_delivered
  ON webhook_deliveries (endpoint_id, delivered_at DESC);
