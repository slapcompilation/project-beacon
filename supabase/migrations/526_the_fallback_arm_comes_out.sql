-- The transition arm goes, now that it is unreachable.
--
-- 524 added it because 523 hid every object: the pure OSv2 predicate asked
-- whether the last index BUILD JOB completed, and every index predated 513.
-- 525 gave each of them a real build, and asserted there are none left
-- without one.
--
-- So `object_type_index_ready()` becomes what the documentation describes and
-- nothing more: an object type may be read when its index pipeline has
-- completed. No Phonograph, no scalar, no transition.
--
--   "A green tick in the Object Storage v2 node in the graph indicates that
--    the indexing is complete and the object type is ready to be queried from
--    OSv2."                                          (object-indexing/faq)
--
-- The guard against 523 repeating is the assertion at the bottom, which runs
-- the predicate against every index that exists rather than trusting that the
-- backfill covered them.

CREATE OR REPLACE FUNCTION public.object_type_index_ready(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.object_type_index_state(p_type) = 'COMPLETED'
$$;
COMMENT ON FUNCTION public.object_type_index_ready(uuid) IS
  'Whether this object type may be read: its index pipeline completed. The OSv2 answer, and the only one — the legacy scalar is no longer consulted.';

DO $$
DECLARE broke int; t uuid;
BEGIN
  -- The 523 failure, asked directly: is anything that was readable now dark?
  SELECT count(*) INTO broke FROM public.object_type_indexes i
   WHERE i.status = 'success' AND NOT public.object_type_index_ready(i.object_type_id);
  IF broke > 0 THEN
    RAISE EXCEPTION '% readable type(s) went dark — the fallback was still load-bearing', broke;
  END IF;

  -- And the predicate no longer reads the column at all.
  IF pg_get_functiondef('public.object_type_index_ready(uuid)'::regprocedure)
     LIKE '%object_type_indexes%' THEN
    RAISE EXCEPTION 'the predicate still consults the legacy table';
  END IF;

  IF public.object_type_index_ready(gen_random_uuid()) THEN
    RAISE EXCEPTION 'an unindexed type reported ready';
  END IF;

  RAISE NOTICE '526: readiness is the pipeline, and only the pipeline';
END $$;
