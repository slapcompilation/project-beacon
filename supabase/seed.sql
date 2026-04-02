-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — First Admin Seed
-- Follow the steps below IN ORDER.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── STEP 1 — Run this block first to create your hotel ──────────────────────
-- Edit the values, then run. Copy the returned `id` — you'll need it in Step 3.

INSERT INTO hotels (name, address, timezone, currency)
VALUES (
  'My Hotel',           -- ← change to your hotel name
  'Athens, Greece',     -- ← change to your address
  'Europe/Athens',      -- ← change to your timezone (IANA format)
  'EUR'                 -- ← change to your currency code
)
RETURNING id;

-- ─── STEP 2 — Create the auth user in Supabase Dashboard ─────────────────────
-- Go to: Authentication → Users → Add user → Create new user
-- Enter your admin email and a strong password.
-- Copy the UUID shown for that user — you'll need it in Step 3.

-- ─── STEP 3 — Link the auth user to the hotel ────────────────────────────────
-- Replace ALL four placeholders before running.

DO $$
DECLARE
  v_user_id  uuid := 'bedebaae-a4b3-4026-a564-467d104a282d';   -- from Step 2
  v_hotel_id uuid := '0873032d-d25a-42ef-9da5-30a76cce0ac9';       -- from Step 1
  v_email    text := 'pansampanidis@gmail.com';       -- same email used in Step 2
  v_role     text := 'admin';
BEGIN
  -- a) Stamp hotel_id + role into the JWT so RLS works immediately
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object('hotel_id', v_hotel_id, 'role', v_role)
  WHERE id = v_user_id;

  -- b) Create the matching public profile row
  INSERT INTO users (id, email, role, hotel_id)
  VALUES (v_user_id, v_email, v_role, v_hotel_id);

  RAISE NOTICE 'Done — admin user % linked to hotel %', v_email, v_hotel_id;
END $$;
