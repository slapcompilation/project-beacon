-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 114 — SECURITY DEFINER on RLS helper functions
--
-- Problem: stack depth limit exceeded → HTTP 500 on every query touching RLS
--
-- The helper functions auth_hotel_id(), auth_role(), auth_org_id(),
-- auth_org_role(), and hotel_is_in_user_scope() were defined WITHOUT
-- SECURITY DEFINER. They ran as the calling (authenticated) role, so the
-- internal SELECTs they perform (e.g. `SELECT organization_id FROM hotels
-- WHERE id = auth_hotel_id()`) re-triggered RLS, which called these helpers
-- again, infinite recursion → stack overflow.
--
--   user_org_memberships SELECT
--   ↳ RLS USING (... OR organization_id = auth_org_id())
--     ↳ auth_org_id() → SELECT FROM hotels   ← runs as authenticated
--       ↳ hotels RLS → hotel_is_in_user_scope()
--         ↳ auth_org_role() → SELECT FROM user_org_memberships
--           ↳ uom RLS → auth_org_id()  ← LOOP
--
-- Fix: re-create all five helpers with SECURITY DEFINER. Owner is `postgres`,
-- which has BYPASSRLS, so internal SELECTs skip RLS and return immediately.
-- The functions remain STABLE and side-effect-free; SECURITY DEFINER is the
-- correct posture for RLS primitives.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'hotel_id')::uuid
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'limited_access')
$$;

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (SELECT organization_id FROM hotels WHERE id = auth_hotel_id())
  )
$$;

CREATE OR REPLACE FUNCTION auth_org_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'org_role',
    (SELECT role FROM user_org_memberships
      WHERE user_id = auth.uid()
        AND organization_id = auth_org_id()
      LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION hotel_is_in_user_scope(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_hotel_id = auth_hotel_id()
    OR (
      auth_org_role() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM hotels h
        WHERE h.id = p_hotel_id
          AND h.organization_id = auth_org_id()
      )
    )
$$;

-- ─── Verification ────────────────────────────────────────────────────────────
-- After applying:
--   SELECT prosecdef FROM pg_proc WHERE proname='auth_org_id';   -- → true
-- A signed-in user reading user_org_memberships should now succeed without
-- "stack depth limit exceeded".
