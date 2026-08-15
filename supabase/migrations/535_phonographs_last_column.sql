-- The Index status scalar is deleted. §5 step 5, second half.
--
-- "Index status: The status of the last reindex of the object type and its
--  backing datasources. It can be `success`, `failed`, or `not started`."
--                                   (object-link-types/object-type-metadata)
--
-- That sentence describes OSv1. Phonograph "is in the planned deprecation
-- phase of development and will be unavailable after June 30, 2026", and OSv2
-- publishes no such field: the state of an index is the state of its job in
-- the Funnel pipeline graph. 520 introduced the replacement, 523–533 moved the
-- readers onto it, and 534 moved the writers and staleness. Nothing reads
-- either column now.
--
-- `error` goes with it, and for the same reason. It was the other half of the
-- scalar — the message behind 'failed' — and since 534 the indexer raises
-- instead of recording, so the message lives on `build_jobs.error` where the
-- page puts it. Leaving an unwritten column would be worse than dropping it:
-- a surface reading it would get NULL and conclude the index is fine.
--
-- What remains on the table is what OSv2 still has: where the index lives,
-- how many objects it holds, and when it was built.

ALTER TABLE public.object_type_indexes
  DROP COLUMN status,
  DROP COLUMN error;

COMMENT ON TABLE public.object_type_indexes IS
  'Where an object type''s index lives and what it last produced: the physical table, the row count, and when. Its state is the last build job, through object_type_index_state() — OSv2 has no status scalar.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE n int; t uuid;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'object_type_indexes'
     AND column_name IN ('status', 'error');
  IF n <> 0 THEN RAISE EXCEPTION 'the scalar survived the drop'; END IF;

  -- The read path still answers on a built type. Dropping a column no function
  -- declares is silent until something runs, so something runs.
  SELECT i.object_type_id INTO t FROM public.object_type_indexes i LIMIT 1;
  IF t IS NOT NULL THEN
    IF NOT public.object_type_index_ready(t) THEN
      RAISE EXCEPTION 'a built type stopped reading as ready';
    END IF;
    PERFORM public.object_type_index_report();
  END IF;
  -- The caller-scoped readers — count_object_set, search_visible_types and the
  -- rest of the exploration path — cannot be asked here: a migration carries no
  -- claims, and they answer "not an object type you can see". The platform
  -- suite asks them as `authenticated`, which is the only honest way to.

  -- And the heartbeat's three hands still plan, which is where a dropped
  -- column shows up as "column i.status does not exist" at 03:00.
  PERFORM public.run_stale_indexes(now());
  PERFORM public.run_due_object_datasets(now());

  RAISE NOTICE '535: Phonograph''s last column is gone';
END $$;
