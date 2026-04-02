-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Profiles Table + Team Management RPCs
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. profiles table ────────────────────────────────────────────────────────
-- Mirrors auth.users with hotel + role context for client-side team management.
-- RLS isolates by hotel. Trigger keeps it in sync with auth.users app_metadata.

CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'team_member'
               CHECK (role IN ('owner', 'admin', 'team_member', 'limited_access')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON profiles
  FOR ALL USING (hotel_id = auth_hotel_id());

-- ─── 2. Auto-upsert profile when auth.users is created or updated ─────────────
-- Fires for normal signup AND after admin sets app_metadata on an invited user.

CREATE OR REPLACE FUNCTION handle_auth_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when hotel_id is present in app_metadata (not set on raw invite row)
  IF (NEW.raw_app_meta_data->>'hotel_id') IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO profiles (id, hotel_id, email, role)
  VALUES (
    NEW.id,
    (NEW.raw_app_meta_data->>'hotel_id')::uuid,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'role', 'team_member')
  )
  ON CONFLICT (id) DO UPDATE
    SET hotel_id = EXCLUDED.hotel_id,
        email    = EXCLUDED.email,
        role     = EXCLUDED.role;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_change
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_auth_user_change();

-- ─── 3. update_member_role RPC ────────────────────────────────────────────────
-- Updates both profiles.role (for listing) and auth.users app_metadata (for JWT).

CREATE OR REPLACE FUNCTION update_member_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can change member roles';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  IF p_role NOT IN ('admin', 'team_member', 'limited_access') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, team_member, or limited_access';
  END IF;

  UPDATE profiles
    SET role = p_role
    WHERE id = p_user_id AND hotel_id = auth_hotel_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found in this hotel';
  END IF;

  -- Propagate to app_metadata so the JWT reflects the change on next sign-in
  UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_role)
    WHERE id = p_user_id;
END;
$$;

-- ─── 4. remove_team_member RPC ────────────────────────────────────────────────
-- Removes the profile row only (preserves auth.users + stock log history).

CREATE OR REPLACE FUNCTION remove_team_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can remove members';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself from the team';
  END IF;

  DELETE FROM profiles
    WHERE id = p_user_id AND hotel_id = auth_hotel_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found in this hotel';
  END IF;
END;
$$;
