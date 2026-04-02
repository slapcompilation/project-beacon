-- ─── User preferences on profiles ────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}';

-- Allow each user to update only their own profile row.
-- The existing hotel_isolation policy covers SELECT for all hotel members.
CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());
