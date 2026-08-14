-- Two holes 507 opened by splitting the engine, closed.
--
-- 493 checked permission once, in run_build, before creating any job:
--   "Builds:NotAuthorized — building % takes the editor role on its project"
-- That was sound while resolution and execution were one function. 507 split
-- them so a waiting job could be advanced later, and the check stayed with
-- resolution — so `run_build_job(<any job id>)` ran a JobSpec's SQL for a job
-- the caller never authorized. It is SECURITY INVOKER, so its reads and writes
-- are bounded by RLS, but it reaches `dataset_rematerialize`, which is a
-- definer. A permission checked at one door is not checked at the other.
--
-- The check moves onto the job itself, which is where it holds no matter who
-- opens the door: run_build still refuses early with the same error, and the
-- job refuses again on its own behalf.
--
-- Second: job_blocked_by was SECURITY DEFINER for no reason. Contention is
-- only ever between builds in one organization — a dataset cannot be another
-- organization's input — so an invoker reads exactly the rows it needs under
-- "org members see builds". The engine is invoker by design (493), and this
-- helper had quietly opted out.

CREATE OR REPLACE FUNCTION public.job_blocked_by(p_job uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
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

-- The one added statement, at the top of the job.
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

  -- The same right run_build demands at resolution, re-asked here: computing
  -- an output writes it, whoever asked.
  IF NOT public.can_write_dataset(job.output_dataset_id) THEN
    RAISE EXCEPTION 'Builds:NotAuthorized — building % takes the editor role on its project',
      job.output_dataset_id;
  END IF;

  IF job.state <> 'WAITING' THEN RETURN job.state; END IF;
  IF public.job_blocked_by(p_job) IS NOT NULL THEN RETURN 'WAITING'; END IF;

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

-- settle_build only reads job states and closes its own build; invoker, and
-- an org member could compute the same answer with a SELECT.
REVOKE ALL ON FUNCTION public.settle_build(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_build(uuid) TO authenticated;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE n int; bad text;
BEGIN
  -- Neither helper bypasses RLS any more.
  SELECT string_agg(proname, ', ') INTO bad FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('job_blocked_by', 'run_build_job', 'settle_build')
     AND prosecdef;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'still SECURITY DEFINER: %', bad;
  END IF;

  -- The drainer stays out of reach: it swaps claims, so it must not be callable.
  SELECT count(*) INTO n
    FROM pg_proc p
   WHERE p.proname = 'drain_waiting_jobs' AND p.pronamespace = 'public'::regnamespace
     AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR has_function_privilege('anon', p.oid, 'EXECUTE'));
  IF n > 0 THEN RAISE EXCEPTION 'drain_waiting_jobs is callable by a user'; END IF;

  RAISE NOTICE '508: a job checks the permission its build checked';
END $$;
