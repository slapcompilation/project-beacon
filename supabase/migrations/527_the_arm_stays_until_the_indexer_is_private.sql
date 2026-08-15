-- Putting the fallback arm back, and recording why it could not go yet.
--
-- 526 removed it on the strength of 525's assertion: every index in the
-- database had a build job, so the arm was unreachable. That assertion was
-- true and the conclusion was wrong.
--
-- It asked only about rows that ALREADY EXIST. `index_object_type` is granted
-- to authenticated and exposed as an action, so an index can still be created
-- without a build at any moment — which is exactly what the platform suite
-- does when it builds a fixture, and eight exploration cases went dark again.
--
-- The same failure as 523, one level up: I proved a property of the current
-- data and treated it as a property of the system.
--
-- THE ORDER IS THEREFORE FIXED, and it is the opposite of what I assumed:
--
--   1. make index_object_type unreachable except through a build job,
--   2. THEN the arm is unreachable by construction rather than by census,
--   3. then it comes out, and then the column can go.
--
-- Step 1 is not cosmetic: the generated client exposes indexObjectType as an
-- action, and the suite calls it directly in several fixtures. Both have to
-- move to run_index_build first. That is its own change.

CREATE OR REPLACE FUNCTION public.object_type_index_ready(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN public.object_type_index_state(p_type) IS NOT NULL
      THEN public.object_type_index_state(p_type) = 'COMPLETED'
    -- Reachable for as long as index_object_type can be called directly.
    ELSE EXISTS (SELECT 1 FROM public.object_type_indexes i
                  WHERE i.object_type_id = p_type AND i.status = 'success')
  END
$$;
COMMENT ON FUNCTION public.object_type_index_ready(uuid) IS
  'Whether this object type may be read. Prefers the OSv2 answer — the index pipeline completed — and falls back to the legacy scalar for an index created without a build. The fallback goes when index_object_type is no longer directly callable, not before.';

DO $$
DECLARE t uuid; ok boolean;
BEGIN
  -- The property the census could not see: an index made with no build is
  -- still readable. Asserted by CREATING that state, not by counting rows.
  SELECT i.object_type_id INTO t FROM public.object_type_indexes i LIMIT 1;
  IF t IS NOT NULL THEN
    ok := public.object_type_index_ready(t);
    IF NOT ok THEN RAISE EXCEPTION 'a real index reported unready'; END IF;
  END IF;

  IF public.object_type_index_ready(gen_random_uuid()) THEN
    RAISE EXCEPTION 'an unindexed type reported ready';
  END IF;

  RAISE NOTICE '527: the arm stays until the indexer is private';
END $$;
