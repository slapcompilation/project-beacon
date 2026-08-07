-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 367 — revoking from anon is not enough when PUBLIC holds the grant.
--
-- 366 ran `REVOKE ALL ... FROM anon` and the security_invariants contract still
-- failed. The grant was never anon's directly: a freshly created function gets
-- EXECUTE for PUBLIC, and anon is a member of PUBLIC like every other role. The
-- revoke removed a privilege that was not there and left the one that mattered.
--
-- Worth recording because it is the kind of thing that reads as done: the
-- migration succeeded, its assertion passed (anon holds no direct grant), and
-- the function was still callable by anyone. The contract test asks the real
-- question — can anon EXECUTE this — and is why the gap lasted one run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE EXECUTE ON FUNCTION public.anonymize_user_pii(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymize_user_pii(uuid, text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE grantee IN ('anon', 'PUBLIC') AND routine_schema = 'public'
       AND routine_name = 'anonymize_user_pii'
  ) THEN
    RAISE EXCEPTION 'Migration 367: anon can still reach anonymize_user_pii';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
     WHERE grantee = 'authenticated' AND routine_schema = 'public'
       AND routine_name = 'anonymize_user_pii'
  ) THEN
    RAISE EXCEPTION 'Migration 367: the revoke took authenticated with it';
  END IF;
END $$;

COMMIT;
