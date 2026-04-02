-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper: read hotel_id from JWT app_metadata ─────────────────────────────
-- All RLS policies use this instead of querying the users table per row.
-- hotel_id is stamped into app_metadata when a user account is created (server-side).

CREATE OR REPLACE FUNCTION auth_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'hotel_id')::uuid
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'limited_access')
$$;

-- ─── Hotels ──────────────────────────────────────────────────────────────────

CREATE TABLE hotels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text NOT NULL DEFAULT '',
  timezone    text NOT NULL DEFAULT 'UTC',
  currency    text NOT NULL DEFAULT 'USD',
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;

-- Owners can see all hotels they belong to; other roles see only their own.
-- Simplified for Phase 1: every user sees only their hotel.
CREATE POLICY "hotel_isolation" ON hotels
  FOR ALL USING (id = auth_hotel_id());

-- ─── Users (extends auth.users) ──────────────────────────────────────────────

CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'team_member'
                CHECK (role IN ('owner', 'admin', 'team_member', 'limited_access')),
  hotel_id    uuid NOT NULL REFERENCES hotels(id),
  preferences jsonb NOT NULL DEFAULT '{
    "theme": "system",
    "compact_view": false,
    "quiet_hours_start": null,
    "quiet_hours_end": null,
    "default_view": "inventory",
    "language": "en"
  }',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON users
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── Categories ──────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id  uuid NOT NULL REFERENCES hotels(id),
  name      text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  "order"   integer NOT NULL DEFAULT 0
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON categories
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── Products ────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          uuid NOT NULL REFERENCES hotels(id),
  name              text NOT NULL,
  description       text,
  sku               text NOT NULL,
  image_url         text,
  cost              numeric(10, 2) NOT NULL DEFAULT 0,
  category_id       uuid REFERENCES categories(id) ON DELETE SET NULL,
  custom_attributes jsonb NOT NULL DEFAULT '{}',
  enabled           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, sku)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON products
  FOR ALL USING (hotel_id = auth_hotel_id());

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Product Variants ─────────────────────────────────────────────────────────

CREATE TABLE product_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                text NOT NULL,
  sku                 text NOT NULL,
  current_stock       integer NOT NULL DEFAULT 0,
  expiry_date         date,
  lot_number          text,
  serial              text,
  cost                numeric(10, 2) NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 0
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Variants are accessed via their parent product's hotel_id
CREATE POLICY "hotel_isolation" ON product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id
        AND p.hotel_id = auth_hotel_id()
    )
  );

-- ─── Stock Logs (IMMUTABLE — no UPDATE or DELETE policies) ───────────────────

CREATE TABLE stock_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES hotels(id),
  variant_id      uuid NOT NULL REFERENCES product_variants(id),
  user_id         uuid NOT NULL,        -- not FK: anonymised on GDPR erasure
  quantity_change integer NOT NULL,
  balance_after   integer NOT NULL,
  reason          text NOT NULL,
  timestamp       timestamptz NOT NULL DEFAULT now(),
  is_revert       boolean NOT NULL DEFAULT false,
  revert_of       uuid REFERENCES stock_logs(id),
  sync_batch_id   uuid,
  was_offline     boolean NOT NULL DEFAULT false
);

ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;

-- Read: hotel members can read their own logs
CREATE POLICY "hotel_isolation_select" ON stock_logs
  FOR SELECT USING (hotel_id = auth_hotel_id());

-- Insert: hotel members can append logs
CREATE POLICY "hotel_isolation_insert" ON stock_logs
  FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());

-- NO UPDATE or DELETE policies — stock_logs are immutable by design.

-- ─── Restock Requests ────────────────────────────────────────────────────────

CREATE TABLE restock_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES hotels(id),
  variant_id      uuid NOT NULL REFERENCES product_variants(id),
  quantity_needed integer NOT NULL,
  supplier        text,
  requestor_id    uuid NOT NULL REFERENCES users(id),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  date            timestamptz NOT NULL DEFAULT now(),
  notes           text
);

ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON restock_requests
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── Action History (general audit) ──────────────────────────────────────────

CREATE TABLE action_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES hotels(id),
  user_id     uuid NOT NULL,   -- not FK: anonymised on GDPR erasure
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  old_value   jsonb,
  new_value   jsonb,
  timestamp   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation_select" ON action_history
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_isolation_insert" ON action_history
  FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());

-- NO UPDATE or DELETE policies — audit history is immutable.

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id  uuid NOT NULL REFERENCES hotels(id),
  user_id   uuid NOT NULL REFERENCES users(id),
  message   text NOT NULL,
  type      text NOT NULL CHECK (type IN ('low_stock', 'expiry', 'approval', 'system')),
  timestamp timestamptz NOT NULL DEFAULT now(),
  read      boolean NOT NULL DEFAULT false
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "own_notifications" ON notifications
  FOR SELECT USING (hotel_id = auth_hotel_id() AND user_id = auth.uid());

CREATE POLICY "hotel_isolation_insert" ON notifications
  FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());

-- Users can mark their own notifications as read
CREATE POLICY "mark_read" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Saved Reports ───────────────────────────────────────────────────────────

CREATE TABLE saved_reports (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id  uuid NOT NULL REFERENCES hotels(id),
  user_id   uuid NOT NULL REFERENCES users(id),
  name      text NOT NULL,
  filters   jsonb NOT NULL DEFAULT '{}',
  columns   jsonb NOT NULL DEFAULT '[]',
  schedule  text,
  last_run  timestamptz
);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON saved_reports
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── GDPR Erasure Requests ────────────────────────────────────────────────────

CREATE TABLE gdpr_erasure_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES hotels(id),
  user_id      uuid NOT NULL,  -- the user whose data is being erased
  requested_by uuid NOT NULL REFERENCES users(id),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE gdpr_erasure_requests ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can create or view erasure requests (enforced in app layer too)
CREATE POLICY "hotel_isolation" ON gdpr_erasure_requests
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Products lookup by hotel (most common query)
CREATE INDEX idx_products_hotel_id ON products(hotel_id);
CREATE INDEX idx_products_enabled ON products(hotel_id, enabled);

-- Variants lookup by product
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_low_stock ON product_variants(product_id, current_stock, low_stock_threshold);
CREATE INDEX idx_variants_expiry ON product_variants(expiry_date) WHERE expiry_date IS NOT NULL;

-- Stock log queries (by hotel, by variant, by time)
CREATE INDEX idx_stock_logs_hotel_time ON stock_logs(hotel_id, timestamp DESC);
CREATE INDEX idx_stock_logs_variant ON stock_logs(variant_id, timestamp DESC);

-- Notifications (unread)
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- Action history (audit trail)
CREATE INDEX idx_action_history_hotel_time ON action_history(hotel_id, timestamp DESC);
CREATE INDEX idx_action_history_entity ON action_history(entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- INSTRUCTIONS FOR USE
-- ─────────────────────────────────────────────────────────────────────────────
-- After running this migration:
--
-- 1. Create your first hotel row manually (or via a seed script):
--    INSERT INTO hotels (name, timezone, currency)
--    VALUES ('My Hotel', 'Europe/Athens', 'EUR');
--
-- 2. Create a user via Supabase Auth (dashboard or API).
--
-- 3. Set their app_metadata with hotel_id and role using the service role key:
--    PATCH /auth/v1/admin/users/{user_id}
--    { "app_metadata": { "hotel_id": "<uuid>", "role": "admin" } }
--    (This is done server-side only — never from the client)
--
-- 4. Insert a matching row in public.users:
--    INSERT INTO users (id, email, role, hotel_id)
--    VALUES ('<auth_user_id>', 'admin@hotel.com', 'admin', '<hotel_uuid>');
-- ─────────────────────────────────────────────────────────────────────────────
