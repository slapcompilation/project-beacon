-- The indexer has been callable by anon since 528, and this is the third time
-- this bug class has shipped.
--
-- 442 created index_object_type(uuid) and closed it properly:
--
--   REVOKE ALL ON FUNCTION public.index_object_type(uuid) FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.index_object_type(uuid) TO authenticated;
--
-- 528 gave the indexer a SECOND ARGUMENT. A changed signature is a NEW function,
-- and Postgres grants EXECUTE on a new function to PUBLIC — so the revoke 442
-- wrote does not carry across, because it names a signature that is no longer
-- the one being called. 529 reverted, 532 reintroduced the two-argument form,
-- and 534 replaced it; none of the three restated either statement.
--
-- `anon` is a member of PUBLIC, so for the last eighteen migrations an
-- unauthenticated caller could start an index build.
--
-- 177 fixed this exact class once: "get_recent_activity ... carry EXECUTE
-- granted to PUBLIC ... so anon still inherited it". 513 got it right for the
-- sibling — `REVOKE ALL ON FUNCTION public.can_index_object_type(uuid) FROM
-- PUBLIC, anon` — so the habit exists and was simply not applied to the new
-- signature.
--
-- It was never intended: 527 is titled "the arm stays until the indexer is
-- private", which only makes sense if the indexer being private was the plan.
--
-- The lesson, recorded because a comment is the only place it can live: CREATE
-- OR REPLACE keeps a function's grants, and CHANGING THE ARGUMENT LIST does not.
-- Any migration that adds or removes a parameter must restate the revoke.

BEGIN;

REVOKE ALL ON FUNCTION public.index_object_type(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.index_object_type(uuid, uuid) TO authenticated;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int;
BEGIN
  -- anon cannot execute it, by the catalog's own answer rather than by grep.
  IF has_function_privilege('anon', 'public.index_object_type(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute the indexer';
  END IF;
  IF has_function_privilege('public', 'public.index_object_type(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC can still execute the indexer';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.index_object_type(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost the indexer';
  END IF;

  -- The same question asked of every SECURITY DEFINER function we own, because
  -- the point of this migration is that one of them was missed for 18 migrations.
  SELECT count(*) INTO n
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.prosecdef
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n > 0 THEN
    RAISE WARNING '% SECURITY DEFINER function(s) in public are still executable by anon', n;
  END IF;

  RAISE NOTICE '547: the indexer is private again';
END $do$;

COMMIT;
