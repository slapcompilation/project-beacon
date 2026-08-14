-- The API reference publishes what the prose never listed, and we had it wrong.
--
-- 493 invented four build statuses by borrowing the JOB states, because
-- `data-integration/builds.md` enumerates the seven job states and never lists
-- a build's. The list exists — in the API reference, which was unmirrored:
--
--   `status` · enum · required
--   one of `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`
--   "The status of the build."
--   (api/v2/orchestration-v2-resources/builds-get-build.md)
--
-- Two of our four are wrong. COMPLETED and ABORTED are the JOB tokens;
-- builds and jobs have different vocabularies and 493 collapsed them.
-- build_jobs.state keeps its seven — "At any given time, a job is always in one
-- of the following states" (builds.md) is its own published list, and the API's
-- six are the external view of the same machine.
--
-- The build TYPES were invented outright. The published union:
--
--   `manual`  "Manually specify all datasets to build."
--   `upstream` "Target the specified datasets along with all upstream datasets
--             except the ignored datasets."
--   `connecting` "All datasets between the input datasets (exclusive) and the
--             target datasets (inclusive) except for the datasets to ignore."
--   (api/v2/orchestration-v2-resources/builds-create-build.md)
--
-- `single` and `full` appear in no page. They become `manual` and `upstream`.
-- `connecting` now has a full shape (inputRids/targetRids/ignoredRids) and is
-- still refused by name — recorded, not built, but no longer for want of a
-- specification.
--
-- Two published fields come along because each is one column and each is
-- already true of the engine in prose:
--
--   `abortOnFailure` "If any job in the build is unsuccessful, immediately
--     finish the build by cancelling all other jobs."
--   `scheduleRid` "Schedule RID of the Schedule that triggered this build. If
--     a user triggered the build, Schedule RID will be empty."
--
-- The second is the Builds screenshot's `Started by: Build schedule`, which we
-- could only answer in reverse through schedule_runs.

-- ── the build's own vocabulary ──────────────────────────────────────────────
ALTER TABLE public.builds DROP CONSTRAINT builds_status_check;
UPDATE public.builds SET status = 'SUCCEEDED' WHERE status = 'COMPLETED';
UPDATE public.builds SET status = 'CANCELED'  WHERE status = 'ABORTED';
ALTER TABLE public.builds
  ADD CONSTRAINT builds_status_check
  CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'));

-- "If any job in the build is unsuccessful, immediately finish the build by
-- cancelling all other jobs." Default false: builds.md makes it the option
-- ("Optionally, a build can be configured to abort all non-dependent jobs"),
-- and dependent-abort happens regardless.
ALTER TABLE public.builds
  ADD COLUMN abort_on_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;
CREATE INDEX builds_schedule_idx ON public.builds (schedule_id);

COMMENT ON COLUMN public.builds.schedule_id IS
  'The schedule that triggered this build. Empty when a user triggered it.';

-- ── the target vocabulary ───────────────────────────────────────────────────
ALTER TABLE public.schedules DROP CONSTRAINT schedules_build_type_check;
UPDATE public.schedules SET build_type = 'manual'   WHERE build_type = 'single';
UPDATE public.schedules SET build_type = 'upstream' WHERE build_type = 'full';
ALTER TABLE public.schedules ALTER COLUMN build_type SET DEFAULT 'manual';
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_build_type_check
  CHECK (build_type IN ('manual', 'upstream'));

-- ── the engine, restated with the published tokens ──────────────────────────
-- Only the vocabulary and the two new columns change; every step 493 built is
-- untouched, and the ordering IS the design.
CREATE OR REPLACE FUNCTION public.run_build(
  p_targets uuid[], p_force boolean DEFAULT false, p_build_type text DEFAULT 'manual',
  p_schedule uuid DEFAULT NULL, p_abort_on_failure boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp AS $$
DECLARE
  v_build uuid; spec record; job record; ds uuid;
  n_failed int := 0; n_aborted int := 0;
  q text; txn uuid; fid uuid; fields jsonb; cols text; phys text; n bigint;
  col record;
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
    SELECT bj.id, bj.job_spec_id, bj.output_dataset_id
      FROM public.build_jobs bj JOIN _jobset j ON j.dataset_id = bj.output_dataset_id
     WHERE bj.build_id = v_build
     ORDER BY j.depth DESC, bj.output_dataset_id
  LOOP
    -- "The job was aborted … as a result of a dependent job failing", and with
    -- abortOnFailure, "immediately finish the build by cancelling all other
    -- jobs" — so any failure cancels the rest, dependent or not.
    IF (p_abort_on_failure AND n_failed > 0) OR EXISTS (
      SELECT 1 FROM public.build_jobs up
       WHERE up.build_id = v_build AND up.state IN ('FAILED', 'ABORTED')
         AND up.output_dataset_id IN (
           SELECT di.input_dataset_id FROM public.dataset_inputs di
            WHERE di.dataset_id = job.output_dataset_id)
    ) THEN
      UPDATE public.build_jobs SET state = 'ABORTED', finished_at = clock_timestamp()
       WHERE id = job.id;
      n_aborted := n_aborted + 1;
      CONTINUE;
    END IF;

    UPDATE public.build_jobs SET state = 'RUNNING', started_at = clock_timestamp()
     WHERE id = job.id;
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
      UPDATE public.build_jobs SET transaction_id = txn WHERE id = job.id;
      INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (job.output_dataset_id, txn, fields);

      phys := public.dataset_rematerialize(job.output_dataset_id, txn);

      SELECT count(*) INTO n FROM _result;
      INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (job.output_dataset_id, txn, format('build/%s.rows', v_build), n)
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
       WHERE id = job.id;
    EXCEPTION WHEN OTHERS THEN
      DROP TABLE IF EXISTS _result;
      UPDATE public.dataset_transactions SET status = 'ABORTED' WHERE id = txn AND status = 'OPEN';
      UPDATE public.build_jobs
         SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
       WHERE id = job.id;
      n_failed := n_failed + 1;
    END;
    txn := NULL;
  END LOOP;

  -- The published tokens: a build SUCCEEDED or FAILED. CANCELED is reached by
  -- request, which is Cancel build and is not built.
  UPDATE public.builds
     SET status = CASE WHEN n_failed > 0 OR n_aborted > 0 THEN 'FAILED' ELSE 'SUCCEEDED' END,
         finished_at = clock_timestamp()
   WHERE id = v_build;
  RETURN v_build;
END $$;

-- The old arity is gone: leaving it would let a caller keep passing 'single'.
DROP FUNCTION IF EXISTS public.run_build(uuid[], boolean, text);

REVOKE ALL ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.run_build(uuid[], boolean, text, uuid, boolean) IS
  'One build: resolve the job set (manual or upstream), refuse cycles, skip the fresh unless forced, run jobs in dependency order as the caller, lock each output with a real transaction, abort dependents on failure. NULL means everything was fresh and no build was created.';

-- The heartbeat records which schedule started the build, which is what
-- scheduleRid holds.
CREATE OR REPLACE FUNCTION public.run_schedules(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s record; u record; state jsonb; before text; built uuid; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-schedules')) THEN
    RETURN 0;
  END IF;

  before := current_setting('request.jwt.claims', true);
  FOR s IN SELECT * FROM public.schedules WHERE NOT paused LOOP
    state := public.schedule_observe(s.trigger, s.trigger_state);
    IF state IS DISTINCT FROM s.trigger_state THEN
      UPDATE public.schedules SET trigger_state = state WHERE id = s.id;
    END IF;
    CONTINUE WHEN NOT public.schedule_satisfied(s.trigger, state, p_at);

    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2 WHERE u2.id = s.updated_by;
    CONTINUE WHEN u IS NULL;

    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      built := public.run_build(s.target_dataset_ids, false, s.build_type, s.id);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, build_id)
      VALUES (s.id, CASE WHEN built IS NULL THEN 'Ignored' ELSE 'Succeeded' END, built);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      INSERT INTO public.schedule_runs (schedule_id, outcome, error)
      VALUES (s.id, 'Failed', sqlerrm);
    END;

    UPDATE public.schedules SET trigger_state = '{}'::jsonb, last_run_at = p_at WHERE id = s.id;
    ran := ran + 1;
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_schedules(timestamptz) FROM PUBLIC, anon, authenticated;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  -- No row anywhere still carries a token the API does not publish.
  SELECT count(*) INTO n FROM public.builds
   WHERE status NOT IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');
  IF n > 0 THEN RAISE EXCEPTION '% build(s) kept an unpublished status', n; END IF;

  SELECT count(*) INTO n FROM public.schedules WHERE build_type NOT IN ('manual', 'upstream');
  IF n > 0 THEN RAISE EXCEPTION '% schedule(s) kept an unpublished build type', n; END IF;

  -- The old three-argument form is gone, so 'single' cannot be passed at all.
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'run_build' AND pronamespace = 'public'::regnamespace;
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly one run_build, found %', n; END IF;

  RAISE NOTICE '506: builds speak the published vocabulary';
END $$;
