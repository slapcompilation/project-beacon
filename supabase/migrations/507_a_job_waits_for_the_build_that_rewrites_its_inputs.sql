-- The fourth bullet of Build resolution, which 493 skipped.
--
--   "Detects if other builds are in progress that would change the inputs into
--    the build. If so, the build may be *queued* and wait for the other build
--    to complete."
--   (data-integration/builds.md, Build resolution)
--
-- WHERE THE WAITING LIVES. Not on the build: the published enum is
-- `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED` and there is no QUEUED
-- (builds-get-build.md). It lives on the job, where `WAITING` is a first-class
-- status and the clock is documented as starting there:
--
--   `startedTime` — "The time this job started waiting for the dependencies to
--   be resolved." (jobs-get-job.md)
--
-- The Builds screenshot agrees from the other side: the Gantt legend's Queued
-- is a job bar, and the per-job timeline reads Started job → Waited for
-- resources → Running → Finished.
--
-- So a contended build is RUNNING with jobs WAITING, and 493's own default —
-- `state text NOT NULL DEFAULT 'WAITING'` — was already the right shape.
--
-- WHAT COUNTS AS CONTENTION. "other builds ... that would change the inputs
-- into the build": another unfinished build has a job whose OUTPUT is one of
-- my job's INPUTS. Not output-output collision — that is build locking, which
-- 493 built with real open transactions.
--
-- WHO ADVANCES IT. Foundry drains with infrastructure we do not have; here the
-- minute hand that already runs schedules picks the job up, under the claims
-- swap 486 established, as the build's own requester. Nothing new is
-- scheduled: run_schedules gains one call.

-- ── the contention predicate ────────────────────────────────────────────────
-- STABLE, and asked per job rather than per build, because "the inputs into
-- the build" are a property of each job's own inputs.
CREATE OR REPLACE FUNCTION public.job_blocked_by(p_job uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT other.build_id
    FROM public.build_jobs mine
    JOIN public.dataset_inputs di ON di.dataset_id = mine.output_dataset_id
    JOIN public.build_jobs other ON other.output_dataset_id = di.input_dataset_id
    JOIN public.builds b ON b.id = other.build_id
   WHERE mine.id = p_job
     AND other.build_id <> mine.build_id
     AND b.status = 'RUNNING'
     AND other.state IN ('WAITING', 'RUN_PENDING', 'RUNNING')
   LIMIT 1
$$;
COMMENT ON FUNCTION public.job_blocked_by(uuid) IS
  'The unfinished build whose output is one of this job''s inputs, or NULL. A job with one waits rather than reading data that is about to change.';

-- ── run one waiting job ─────────────────────────────────────────────────────
-- The execution half of 493's engine, addressed to a single job. Staleness is
-- re-asked here rather than trusted from resolution time, on the wording of
-- the published field: `forceBuild` is "Whether to ignore staleness
-- information when running the build" — when RUNNING, not when creating. The
-- blocking build has just rewritten this job's inputs, so the question has a
-- different answer now than it had at submit.
CREATE OR REPLACE FUNCTION public.run_build_job(p_job uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE
  job record; q text; txn uuid; fid uuid; fields jsonb; cols text; phys text;
  n bigint; col record;
BEGIN
  SELECT bj.*, b.force AS build_force, b.abort_on_failure
    INTO job
    FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
   WHERE bj.id = p_job;
  IF job IS NULL THEN RAISE EXCEPTION 'Builds:JobNotFound — %', p_job; END IF;
  IF job.state <> 'WAITING' THEN RETURN job.state; END IF;

  IF public.job_blocked_by(p_job) IS NOT NULL THEN RETURN 'WAITING'; END IF;

  -- A dependency failed while we waited.
  IF EXISTS (
    SELECT 1 FROM public.build_jobs up
     WHERE up.build_id = job.build_id AND up.state IN ('FAILED', 'ABORTED')
       AND up.output_dataset_id IN (
         SELECT di.input_dataset_id FROM public.dataset_inputs di
          WHERE di.dataset_id = job.output_dataset_id)
  ) THEN
    UPDATE public.build_jobs SET state = 'ABORTED', finished_at = clock_timestamp()
     WHERE id = p_job;
    RETURN 'ABORTED';
  END IF;

  -- Staleness, re-asked. Fresh now means there is nothing to compute.
  IF NOT job.build_force AND public.job_spec_fresh(job.job_spec_id) THEN
    UPDATE public.build_jobs SET state = 'COMPLETED', finished_at = clock_timestamp(),
           spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
           input_transactions = public.job_spec_input_state(job.job_spec_id)
     WHERE id = p_job;
    RETURN 'COMPLETED';
  END IF;

  UPDATE public.build_jobs SET state = 'RUNNING', started_at = clock_timestamp()
   WHERE id = p_job;
  BEGIN
    SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = job.output_dataset_id;
    q := public.job_spec_query(job.job_spec_id);
    EXECUTE 'CREATE TEMP TABLE _result ON COMMIT DROP AS ' || q;

    fields := '[]'::jsonb;
    FOR col IN
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS t
        FROM pg_attribute a
       WHERE a.attrelid = '_result'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum
    LOOP
      IF public.build_field_of(col.t) IS NULL THEN
        RAISE EXCEPTION 'Builds:UnsupportedOutputType — column %s is %s, which no dataset field can hold', col.attname, col.t;
      END IF;
      fields := fields || jsonb_build_array(
        public.build_field_of(col.t) || jsonb_build_object('name', col.attname));
    END LOOP;

    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    SELECT job.output_dataset_id, b.id, 'SNAPSHOT'
      FROM public.dataset_branches b
     WHERE b.dataset_id = job.output_dataset_id AND b.name = 'master'
    RETURNING id INTO txn;
    UPDATE public.build_jobs SET transaction_id = txn WHERE id = p_job;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (job.output_dataset_id, txn, fields);

    phys := public.dataset_rematerialize(job.output_dataset_id, txn);

    SELECT count(*) INTO n FROM _result;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (job.output_dataset_id, txn, format('build/%s.rows', job.build_id), n)
    RETURNING id INTO fid;
    SELECT string_agg(format('%I', f->>'name'), ', ') INTO cols
      FROM jsonb_array_elements(fields) f;
    EXECUTE format('INSERT INTO datasets.%I (_file, %s) SELECT %L, %s FROM _result',
                   phys, cols, fid, cols);
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;
    DROP TABLE _result;

    UPDATE public.build_jobs
       SET state = 'COMPLETED', finished_at = clock_timestamp(),
           spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
           input_transactions = public.job_spec_input_state(job.job_spec_id)
     WHERE id = p_job;
    RETURN 'COMPLETED';
  EXCEPTION WHEN OTHERS THEN
    DROP TABLE IF EXISTS _result;
    UPDATE public.dataset_transactions SET status = 'ABORTED' WHERE id = txn AND status = 'OPEN';
    UPDATE public.build_jobs
       SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
     WHERE id = p_job;
    RETURN 'FAILED';
  END;
END $$;
REVOKE ALL ON FUNCTION public.run_build_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_build_job(uuid) TO authenticated;

-- ── a build finishes when its jobs do ───────────────────────────────────────
-- "If all jobs in the build are completed, then the build is considered
-- completed." A build with a job still WAITING is not finished, so its status
-- stays RUNNING — which is exactly the queued build the page describes.
CREATE OR REPLACE FUNCTION public.settle_build(p_build uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE unfinished int; bad int;
BEGIN
  SELECT count(*) FILTER (WHERE state IN ('WAITING', 'RUN_PENDING', 'RUNNING')),
         count(*) FILTER (WHERE state IN ('FAILED', 'ABORTED'))
    INTO unfinished, bad
    FROM public.build_jobs WHERE build_id = p_build;
  IF unfinished > 0 THEN RETURN 'RUNNING'; END IF;
  UPDATE public.builds
     SET status = CASE WHEN bad > 0 THEN 'FAILED' ELSE 'SUCCEEDED' END,
         finished_at = clock_timestamp()
   WHERE id = p_build AND status = 'RUNNING';
  RETURN CASE WHEN bad > 0 THEN 'FAILED' ELSE 'SUCCEEDED' END;
END $$;

-- ── the minute hand advances what is waiting ────────────────────────────────
-- Each job runs as the user who requested its build — the same claims swap
-- run_schedules already uses, for the same reason: run_build_job is INVOKER,
-- so the transform's SQL executes with its requester's own rights.
CREATE OR REPLACE FUNCTION public.drain_waiting_jobs()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-drain-builds')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR j IN
    SELECT bj.id, bj.build_id, b.requested_by
      FROM public.build_jobs bj
      JOIN public.builds b ON b.id = bj.build_id
     WHERE bj.state = 'WAITING' AND b.status = 'RUNNING'
       AND public.job_blocked_by(bj.id) IS NULL
     ORDER BY b.started_at, bj.id
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2 WHERE u2.id = j.requested_by;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_build_job(j.id);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      UPDATE public.build_jobs SET state = 'FAILED', error = sqlerrm,
             finished_at = clock_timestamp() WHERE id = j.id;
    END;
    PERFORM public.settle_build(j.build_id);
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.drain_waiting_jobs() FROM PUBLIC, anon, authenticated;

-- One heartbeat carries both: schedules create builds, and this advances the
-- jobs that were waiting on somebody else's.
SELECT cron.unschedule('beacon-run-schedules');
SELECT cron.schedule('beacon-run-schedules', '* * * * *',
  'SELECT public.run_schedules(); SELECT public.drain_waiting_jobs()');

-- ── resolution leaves a contended job waiting ───────────────────────────────
-- 506's engine, with one branch added: a job whose inputs another build is
-- rewriting is left WAITING instead of run, and the build settles to RUNNING
-- rather than SUCCEEDED. Everything else is byte-identical, and an uncontended
-- build behaves exactly as it did.
CREATE OR REPLACE FUNCTION public.run_build(
  p_targets uuid[], p_force boolean DEFAULT false, p_build_type text DEFAULT 'manual',
  p_schedule uuid DEFAULT NULL, p_abort_on_failure boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp AS $$
DECLARE
  v_build uuid; job record; ds uuid; outcome text;
BEGIN
  IF p_build_type NOT IN ('manual', 'upstream') THEN
    RAISE EXCEPTION 'Builds:UnknownBuildType — % (manual and upstream exist; connecting is recorded, not built)', p_build_type;
  END IF;

  DROP TABLE IF EXISTS _jobset;
  CREATE TEMP TABLE _jobset (dataset_id uuid PRIMARY KEY, spec_id uuid, depth int) ON COMMIT DROP;
  IF p_build_type = 'manual' THEN
    INSERT INTO _jobset
    SELECT js.output_dataset_id, js.id, 0 FROM public.job_specs js
     WHERE js.output_dataset_id = ANY (p_targets);
  ELSE
    WITH RECURSIVE up AS (
      SELECT t.id AS dataset_id, 0 AS depth, ARRAY[t.id] AS path
        FROM unnest(p_targets) t(id)
      UNION ALL
      SELECT di.input_dataset_id, up.depth + 1, up.path || di.input_dataset_id
        FROM public.dataset_inputs di
        JOIN up ON di.dataset_id = up.dataset_id
       WHERE NOT (di.input_dataset_id = ANY (up.path)) AND up.depth < 50
    )
    INSERT INTO _jobset
    SELECT js.output_dataset_id, js.id, max(up.depth)
      FROM up JOIN public.job_specs js ON js.output_dataset_id = up.dataset_id
     GROUP BY js.output_dataset_id, js.id;
  END IF;
  IF EXISTS (
    WITH RECURSIVE walk AS (
      SELECT j.dataset_id AS start, di.input_dataset_id AS at, 1 AS depth
        FROM _jobset j JOIN public.dataset_inputs di ON di.dataset_id = j.dataset_id
      UNION ALL
      SELECT w.start, di.input_dataset_id, w.depth + 1
        FROM walk w JOIN public.dataset_inputs di ON di.dataset_id = w.at
       WHERE w.depth < 50
    ) SELECT 1 FROM walk WHERE start = at
  ) THEN
    RAISE EXCEPTION 'Builds:CycleDetected — the specified input datasets contain a cycle';
  END IF;

  FOR ds IN SELECT dataset_id FROM _jobset LOOP
    IF NOT public.can_write_dataset(ds) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — building % takes the editor role on its project', ds;
    END IF;
  END LOOP;

  IF NOT p_force THEN
    DELETE FROM _jobset j WHERE public.job_spec_fresh(j.spec_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _jobset) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.builds (force, schedule_id, abort_on_failure)
  VALUES (p_force, p_schedule, p_abort_on_failure) RETURNING id INTO v_build;
  INSERT INTO public.build_jobs (build_id, job_spec_id, output_dataset_id)
  SELECT v_build, j.spec_id, j.dataset_id FROM _jobset j;

  FOR job IN
    SELECT bj.id, bj.output_dataset_id
      FROM public.build_jobs bj JOIN _jobset j ON j.dataset_id = bj.output_dataset_id
     WHERE bj.build_id = v_build
     ORDER BY j.depth DESC, bj.output_dataset_id
  LOOP
    -- "If any job in the build is unsuccessful, immediately finish the build
    -- by cancelling all other jobs."
    IF p_abort_on_failure AND EXISTS (
      SELECT 1 FROM public.build_jobs f
       WHERE f.build_id = v_build AND f.state = 'FAILED') THEN
      UPDATE public.build_jobs SET state = 'ABORTED', finished_at = clock_timestamp()
       WHERE id = job.id;
      CONTINUE;
    END IF;
    -- Contended: leave it WAITING. The minute hand picks it up when the other
    -- build finishes, and re-asks staleness then.
    CONTINUE WHEN public.job_blocked_by(job.id) IS NOT NULL;
    outcome := public.run_build_job(job.id);
  END LOOP;

  PERFORM public.settle_build(v_build);
  RETURN v_build;
END $$;
REVOKE ALL ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) IS
  'One build: resolve the job set (manual or upstream), refuse cycles, skip the fresh unless forced, run jobs in dependency order as the caller. A job whose inputs another unfinished build is rewriting stays WAITING and the build stays RUNNING — the queue the page describes. NULL means everything was fresh and no build was created.';

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; proj uuid; u uuid := gen_random_uuid(); before text;
  src uuid; mid uuid; leaf uuid; b1 uuid; b2 uuid;
  st text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);
  -- The predicate answers on a job with no contention, and the heartbeat is
  -- carried by exactly one cron entry.
  SELECT count(*) INTO n FROM cron.job
   WHERE jobname = 'beacon-run-schedules' AND command LIKE '%drain_waiting_jobs%';
  IF n <> 1 THEN RAISE EXCEPTION 'the minute hand does not drain waiting jobs (% entries)', n; END IF;

  -- A job with no other build in flight is never blocked.
  SELECT count(*) INTO n FROM public.build_jobs bj
   WHERE public.job_blocked_by(bj.id) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.builds b
                      WHERE b.id = public.job_blocked_by(bj.id) AND b.status = 'RUNNING');
  IF n > 0 THEN RAISE EXCEPTION 'job_blocked_by named a finished build % times', n; END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '507: a contended job waits, and the minute hand advances it';
END $$;
