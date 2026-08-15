-- Object types stop carrying Phonograph's status scalar as their truth.
--
-- OSv1 (Phonograph) "is in the planned deprecation phase of development and
-- will be unavailable after June 30, 2026" (ontologies/oss-limitations, and
-- five other pages). We built `object_type_indexes.status` from a metadata
-- page whose own Index status entry links to the OSv1 page for its definition:
--
--   "Index status: The status of the last reindex of the object type and its
--    backing datasources. It can be `success`, `failed`, or `not started`."
--                                   (object-link-types/object-type-metadata)
--
-- OSv2 HAS NO SUCH SCALAR. The status is the pipeline's job states:
--
--   "The Ontology Manager application has a dedicated pipeline graph that
--    shows the status of various jobs in a Funnel pipeline. A green tick in
--    the Object Storage v2 node in the graph indicates that the indexing is
--    complete and the object type is ready to be queried from OSv2."
--                                              (object-indexing/faq)
--
-- and on failure the same page sends you to the same place: "indexing jobs
-- will not succeed and will report the underlying problem in the pipeline
-- graph in the Ontology Manager application."
--
-- 513 made a reindex a build job, so that pipeline exists here now and its
-- job carries the seven documented states. This makes the job the answer.
--
-- ── WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT ────────────────────────────
-- `object_type_index_state()` reads the last index build job. That is the v2
-- answer and the one every new caller should use.
--
-- The column stays, for now, and its comment says exactly what it is: a
-- legacy scalar that index_object_type still writes for its own bookkeeping.
-- Sixteen migrations and three web surfaces read it; ripping it out in the
-- same change that introduces its replacement would be two risks at once, and
-- an applied migration cannot be edited afterwards. The follow-up is recorded
-- in DELIVERABLE-MAP.md rather than implied here.

CREATE OR REPLACE FUNCTION public.object_type_index_state(p_type uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  -- The OSv2 answer: whatever the most recent index job says. A type that has
  -- never been indexed answers NULL, which is a different fact from any of
  -- Phonograph's three tokens and is why no legacy value appears here.
  SELECT bj.state
    FROM public.build_jobs bj
   WHERE bj.output_object_type_id = p_type
   ORDER BY coalesce(bj.finished_at, bj.started_at) DESC NULLS LAST
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.object_type_index_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_type_index_state(uuid) TO authenticated;
COMMENT ON FUNCTION public.object_type_index_state(uuid) IS
  'The state of the last index build job for this object type, in the seven documented job states. OSv2 has no scalar index status: "a dedicated pipeline graph that shows the status of various jobs in a Funnel pipeline" is the surface.';

COMMENT ON COLUMN public.object_type_indexes.status IS
  'LEGACY, OSv1-shaped. Phonograph published success/failed/not started as a single Index status; Object Storage v2 replaced that with the Funnel pipeline job states and Phonograph is in planned deprecation. index_object_type still writes this for its own bookkeeping — read object_type_index_state() instead.';

COMMENT ON TABLE public.object_type_indexes IS
  'Where an object type''s index lives and what it last produced: the physical table, the row count, and when. Its status column is a legacy OSv1 scalar; the state of an index is the last build job, through object_type_index_state().';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE t uuid; s text; n int;
BEGIN
  -- Agrees with the ledger on a type that has been built through 513.
  SELECT bj.output_object_type_id INTO t FROM public.build_jobs bj
   WHERE bj.output_object_type_id IS NOT NULL
   ORDER BY bj.finished_at DESC NULLS LAST LIMIT 1;
  IF t IS NOT NULL THEN
    s := public.object_type_index_state(t);
    IF s IS NULL THEN RAISE EXCEPTION 'a built type reported no index state'; END IF;
    IF s NOT IN ('WAITING','RUN_PENDING','RUNNING','ABORT_PENDING','ABORTED','FAILED','COMPLETED') THEN
      RAISE EXCEPTION 'index state % is not one of the seven job states', s;
    END IF;
  END IF;

  -- A type nobody has indexed answers NULL, not a legacy token.
  IF public.object_type_index_state(gen_random_uuid()) IS NOT NULL THEN
    RAISE EXCEPTION 'an unindexed type reported a state';
  END IF;

  -- And no OSv1 vocabulary leaks out of the new function.
  IF pg_get_functiondef('public.object_type_index_state(uuid)'::regprocedure)
     LIKE '%not started%' THEN
    RAISE EXCEPTION 'the v2 state function speaks Phonograph';
  END IF;

  RAISE NOTICE '520: an index state is the build job, not a Phonograph scalar';
END $$;
