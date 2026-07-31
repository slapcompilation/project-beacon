-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 284 — take EXECUTE on stamp_source_run away from everybody.
--
-- security_invariants.sql failed the moment 283 landed:
--
--   SECURITY INVARIANT 1 VIOLATED — anon can EXECUTE SECURITY DEFINER
--   function(s): public.stamp_source_run
--
-- Correct catch. A new function gets EXECUTE to PUBLIC by default, and this one
-- is SECURITY DEFINER precisely so it can write a table its callers may not —
-- which is fine as a trigger and not fine as something anon can invoke to
-- backdate every source in the registry.
--
-- Revoked from PUBLIC rather than granted narrowly: a trigger function needs no
-- EXECUTE grant at all. The trigger fires as the function's owner regardless of
-- who ran the INSERT, which is the whole reason it works for a floor manager
-- entering occupancy by hand.
--
-- Written as its own migration rather than an edit to 283, which is already
-- recorded: a fix folded into an applied migration runs nowhere else.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE ALL ON FUNCTION public.stamp_source_run() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.stamp_source_run()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stamp_source_run()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 284: stamp_source_run is still executable by a client role';
  END IF;
END $$;

COMMIT;
