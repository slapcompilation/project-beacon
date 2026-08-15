-- 523 hid every object. Fixing it forward.
--
-- object_type_index_ready() asked only the OSv2 question — did the last index
-- BUILD JOB complete — and every index that exists was built before 513 made
-- reindexing a build job. None has one. So the predicate answered false for
-- all of them and the whole read path went dark: exploration, counts,
-- aggregations, histograms, quicksearch, restricted views.
--
-- Caught by the platform suite immediately, which is why the substitution was
-- done with it as the gate. Eight of the ten functions 523 restated are the
-- hot read path, and this is exactly the failure that made §5 worth its own
-- change.
--
-- THE FIX IS NOT TO RETREAT. The v2 answer stays primary; what was missing is
-- that an index built before the build engine existed still IS an index. So
-- the predicate prefers the job and falls back to the legacy scalar only when
-- no job exists.
--
-- That second arm is the transition, not the design. It disappears when
-- index_object_type stops writing the scalar — DELIVERABLE-MAP §5, steps 3
-- and 4 — at which point every index has a job by construction and the
-- fallback becomes unreachable.

CREATE OR REPLACE FUNCTION public.object_type_index_ready(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    -- OSv2: the pipeline's job state is the truth where a pipeline has run.
    WHEN public.object_type_index_state(p_type) IS NOT NULL
      THEN public.object_type_index_state(p_type) = 'COMPLETED'
    -- Transition only: an index built before 513 has no job to ask.
    ELSE EXISTS (SELECT 1 FROM public.object_type_indexes i
                  WHERE i.object_type_id = p_type AND i.status = 'success')
  END
$$;
COMMENT ON FUNCTION public.object_type_index_ready(uuid) IS
  'Whether this object type may be read. Prefers the OSv2 answer — the last index build job COMPLETED — and falls back to the legacy scalar only for indexes built before 513, which have no job. The fallback goes when index_object_type stops writing that column.';

DO $$
DECLARE t uuid; n int;
BEGIN
  -- An index with no job, built the old way, is still readable.
  SELECT i.object_type_id INTO t FROM public.object_type_indexes i
   WHERE i.status = 'success'
     AND NOT EXISTS (SELECT 1 FROM public.build_jobs bj
                      WHERE bj.output_object_type_id = i.object_type_id)
   LIMIT 1;
  IF t IS NOT NULL THEN
    IF NOT public.object_type_index_ready(t) THEN
      RAISE EXCEPTION 'a pre-build index was treated as unready — the read path is dark';
    END IF;
    -- No read call here: this runs as the migration role with no claims, so
    -- count_object_set would refuse on RLS rather than on readiness. The
    -- platform suite exercises the read path as `authenticated`, which is the
    -- only place that question can honestly be asked.
  END IF;

  -- A completed job is still the answer where one exists.
  SELECT bj.output_object_type_id INTO t FROM public.build_jobs bj
   WHERE bj.output_object_type_id IS NOT NULL AND bj.state = 'COMPLETED'
   ORDER BY bj.finished_at DESC NULLS LAST LIMIT 1;
  IF t IS NOT NULL AND NOT public.object_type_index_ready(t) THEN
    RAISE EXCEPTION 'a completed index build reported not ready';
  END IF;

  IF public.object_type_index_ready(gen_random_uuid()) THEN
    RAISE EXCEPTION 'an unindexed type reported ready';
  END IF;

  RAISE NOTICE '524: a pre-build index still counts as ready';
END $$;
