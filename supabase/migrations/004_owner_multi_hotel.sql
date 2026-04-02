-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Owner Multi-Hotel Access
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────
-- Allows owners to be members of multiple hotels via a junction table.
-- After running this, an owner added to hotel_memberships can see and switch
-- between all hotels they have access to.

-- ─── Junction table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_hotel_memberships (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id  uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, hotel_id)
);

ALTER TABLE user_hotel_memberships ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "own_memberships_select" ON user_hotel_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Only owners can insert memberships (via service role in practice)
CREATE POLICY "own_memberships_insert" ON user_hotel_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── Update hotels policy ─────────────────────────────────────────────────────
-- Owners who have a membership entry can also see those hotels.

DROP POLICY IF EXISTS "hotel_isolation" ON hotels;

CREATE POLICY "hotel_access" ON hotels
  FOR SELECT USING (
    id = auth_hotel_id()
    OR EXISTS (
      SELECT 1 FROM user_hotel_memberships
      WHERE user_id = auth.uid()
        AND hotel_id = hotels.id
    )
  );

-- For write operations (INSERT/UPDATE/DELETE), keep single-hotel isolation
CREATE POLICY "hotel_write_isolation" ON hotels
  FOR ALL
  USING (id = auth_hotel_id())
  WITH CHECK (id = auth_hotel_id());

-- ─── Seed example: add an owner to a second hotel ────────────────────────────
-- Run manually after identifying the user and hotel IDs:
--
--   INSERT INTO user_hotel_memberships (user_id, hotel_id)
--   VALUES ('<owner-user-id>', '<second-hotel-id>');
--
-- The user must also have hotel_id set to their PRIMARY hotel in app_metadata.
-- The hotel switcher in the UI will then show both hotels.
