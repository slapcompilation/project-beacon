-- The legacy arm comes out of `object_type_index_ready()`. Third attempt.
--
-- 523 removed the legacy read with no fallback and the entire read path went
-- dark: every index predated 513, so no index had a build job and `ready()`
-- was false for all of them. 526 removed it again on 525's assertion that no
-- index lacked a build job — the assertion was TRUE and the conclusion WRONG,
-- because it described **the rows that existed, not the system**: the indexer
-- was callable directly, so a fixture could mint an index with no pipeline at
-- any moment, and eight exploration cases failed instantly.
--
-- 532 changed the system. `index_object_type` now takes the build job it runs
-- under and refuses without a RUNNING one for that type, so the argument this
-- time is about reachability rather than about rows:
--
--   an `object_type_indexes` row exists
--     ⟹ `index_object_type` ran (it holds the only INSERT — `mark_index_stale`
--        and its two siblings UPDATE, they never create)
--     ⟹ a RUNNING build job for that type existed
--     ⟹ `object_type_index_state()` finds it, so the ELSE arm is not taken.
--
-- Three ways that chain could still break, all checked rather than assumed:
--
--   **The row could be written around the function.** `authenticated` and
--   `anon` hold INSERT on the table, but RLS carries only a SELECT policy, so
--   the insert is refused — verified as `authenticated`, not as the owner.
--   `service_role` has BYPASSRLS and could forge one, which is true of every
--   table in the database and is not a hole this arm was closing.
--
--   **The job could be pruned**, and then the answer disappears with it. The
--   only DELETE on `builds` anywhere is in `run_index_build`, and it fires at
--   `n = 0` — a build with no jobs at all. A build that produced an index is
--   never deleted.
--
--   **The lights could go out on the rows that exist**, which is what happened
--   twice. That is not an argument, so it is an assertion below.

CREATE OR REPLACE FUNCTION public.object_type_index_ready(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  -- OSv2 has no scalar: "A green tick in the Object Storage v2 node in the
  -- graph indicates that the indexing is complete and the object type is ready
  -- to be queried from OSv2" (object-indexing/faq). The job is the tick.
  SELECT public.object_type_index_state(p_type) = 'COMPLETED'
$$;
COMMENT ON FUNCTION public.object_type_index_ready(uuid) IS
  'Whether an object type can be read: its last index build job COMPLETED. The legacy scalar is no longer consulted — since 532 an index is only ever produced by a build job.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE dark int; n int;
BEGIN
  -- THE ONE BOTH FAILURES NEEDED. Every index that reads as built must still
  -- read as built with the arm gone. A single row here would have stopped 523
  -- and 526 before they landed.
  SELECT count(*) INTO dark
    FROM public.object_type_indexes i
   WHERE i.status = 'success' AND NOT public.object_type_index_ready(i.object_type_id);
  IF dark > 0 THEN
    RAISE EXCEPTION '% object type(s) would go dark — the arm is still load-bearing', dark;
  END IF;

  -- And it really is gone, not merely bypassed.
  IF pg_get_functiondef('public.object_type_index_ready(uuid)'::regprocedure) LIKE '%status%' THEN
    RAISE EXCEPTION 'the readiness predicate still reads the legacy scalar';
  END IF;

  -- The chain the argument rests on: one INSERT, and it is inside the gated
  -- indexer. If a second writer appears, this stops being true silently.
  SELECT count(*) INTO n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND pg_get_functiondef(p.oid) ILIKE '%insert into public.object_type_indexes%';
  IF n <> 1 THEN
    RAISE EXCEPTION '% functions insert an index row; the arm came out on there being one', n;
  END IF;

  RAISE NOTICE '533: an index is ready when its build job says so, and only then';
END $$;
