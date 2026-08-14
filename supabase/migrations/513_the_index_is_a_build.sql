-- The index is a build.
--
-- 442 built the indexer and nothing ever called it. `mark_index_stale_on_commit`
-- fires when a datasource transaction commits, so the platform knows an object
-- type is behind — and `index_object_type` was reachable only from tests, from
-- its own migrations' assertions, and from a button. No timer, no trigger.
--
-- Foundry does not have a separate mechanism for this. The Funnel IS the build
-- engine:
--
--   "A Funnel batch pipeline is comprised of a series of Foundry build jobs"
--                                    (object-indexing/funnel-batch-pipelines)
--
-- and it runs on a published pair of triggers:
--
--   "Live pipelines run whenever their respective datasources are updated.
--    Additionally, if user edits on objects are detected, live pipelines will
--    run every six hours regardless of any explicit backing dataset update"
--
--   "Whenever there is a new data transaction in object type datasources, or
--    In the absence of new data in the datasources, every 6 hours, if edits
--    had been detected on any objects."      (object-edits/how-edits-applied)
--
-- 493-508 built that engine — job specs, builds, the seven job states, build
-- locking, contention queuing, a trigger grammar and a minute hand. The two
-- halves were built separately and never joined. This joins them.
--
-- ── WHAT AN INDEX JOB IS ────────────────────────────────────────────────────
-- A JobSpec whose output is an OBJECT TYPE rather than a dataset. It runs in a
-- build, carries the seven states, appears in the ledger, and is queued behind
-- any unfinished build that rewrites its datasources — which is 507's
-- contention rule applying to indexing for free, and is exactly the sentence
-- "other builds ... that would change the inputs into the build".
--
-- 442's collapse of Foundry's four jobs stands and stays declared: changelog
-- datasets are an incremental-compute optimisation and hydration is a Spark
-- cluster fact, so ours has one job where Foundry has four. What was wrong was
-- never the collapse; it was that nothing ran the result.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- Replacement pipelines ("a new replacement pipeline must be provisioned ...
-- without impacting the live data being served to users") stay unbuilt: they
-- need two live indexes for one type and an atomic swap. Ours still rebuilds
-- in place. Recorded in DELIVERABLE-MAP.md, not smuggled in here.

-- ── §1 a job may output an object type ──────────────────────────────────────
ALTER TABLE public.job_specs
  ADD COLUMN output_object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  ALTER COLUMN output_dataset_id DROP NOT NULL,
  ALTER COLUMN logic_sql DROP NOT NULL;

ALTER TABLE public.job_specs
  ADD CONSTRAINT job_specs_one_output
    CHECK (num_nonnulls(output_dataset_id, output_object_type_id) = 1),
  -- A dataset job is SQL logic; an index job's logic is index_object_type,
  -- which is ours and not authored, so it carries none.
  ADD CONSTRAINT job_specs_logic_matches_output
    CHECK ((output_dataset_id IS NOT NULL) = (logic_sql IS NOT NULL)),
  ADD CONSTRAINT job_specs_output_object_type_key UNIQUE (output_object_type_id);

ALTER TABLE public.build_jobs
  ADD COLUMN output_object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  ALTER COLUMN output_dataset_id DROP NOT NULL;
ALTER TABLE public.build_jobs
  ADD CONSTRAINT build_jobs_one_output
    CHECK (num_nonnulls(output_dataset_id, output_object_type_id) = 1);
CREATE INDEX build_jobs_output_object_type_idx
  ON public.build_jobs (output_object_type_id);

COMMENT ON COLUMN public.job_specs.output_object_type_id IS
  'The object type this job indexes. Foundry indexes through the same build engine: "A Funnel batch pipeline is comprised of a series of Foundry build jobs".';

-- ── §2 who may reindex ──────────────────────────────────────────────────────
-- The same right can_write_dataset asks for, addressed to an object type:
-- editor on its project, or an organization admin. RLS on object_types means a
-- type the caller cannot see answers false.
CREATE OR REPLACE FUNCTION public.can_index_object_type(p_type uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.object_types ot
     WHERE ot.id = p_type
       AND ((SELECT public.auth_role()) IN ('owner', 'admin')
            OR public.role_rank(public.project_role(ot.project_id))
               >= public.role_rank('editor')))
$$;
REVOKE ALL ON FUNCTION public.can_index_object_type(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_index_object_type(uuid) TO authenticated;

-- ── §3 the restated engine ──────────────────────────────────────────────────
-- Every one of these is the LIVE definition with a branch added, taken from
-- pg_get_functiondef rather than from the migration that first created it.
-- 512 exists because I restated apply_action from its original source and
-- deleted a gate a later migration had patched in.

CREATE OR REPLACE FUNCTION public.job_spec_input_state(p_spec uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- A dataset spec reads dataset_inputs; an INDEX spec reads its object
  -- type's datasources. Both answer the same question — what were my inputs
  -- at their latest committed transaction — so freshness needs no second
  -- implementation and job_spec_fresh is untouched.
  SELECT COALESCE(jsonb_object_agg(di.input_dataset_id::text, t.latest::text), '{}'::jsonb)
    FROM public.job_specs js
    JOIN LATERAL (
      SELECT d.input_dataset_id FROM public.dataset_inputs d
       WHERE d.dataset_id = js.output_dataset_id
      UNION
      SELECT ds.dataset_id FROM public.object_type_datasources ds
       WHERE ds.object_type_id = js.output_object_type_id
    ) di ON true
    LEFT JOIN LATERAL (
      SELECT tx.id AS latest FROM public.dataset_transactions tx
        JOIN public.dataset_branches b ON b.id = tx.branch_id
       WHERE tx.dataset_id = di.input_dataset_id
         AND b.name = 'master' AND tx.status = 'COMMITTED'
       ORDER BY tx.committed_at DESC LIMIT 1
    ) t ON true
   WHERE js.id = p_spec
$function$;

CREATE OR REPLACE FUNCTION public.job_blocked_by(p_job uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT other.build_id
    FROM public.build_jobs mine
    JOIN LATERAL (
      -- "other builds ... that would change the inputs into the build". A
      -- dataset job's inputs are declared; an index job's are its object
      -- type's datasources — so a reindex waits for the build rewriting the
      -- data it is about to read, which is the whole point of 507.
      SELECT d.input_dataset_id FROM public.dataset_inputs d
       WHERE d.dataset_id = mine.output_dataset_id
      UNION
      SELECT ds.dataset_id FROM public.object_type_datasources ds
       WHERE ds.object_type_id = mine.output_object_type_id
    ) di ON true
    JOIN public.build_jobs other ON other.output_dataset_id = di.input_dataset_id
    JOIN public.builds b ON b.id = other.build_id
   WHERE mine.id = p_job
     AND other.build_id <> mine.build_id
     AND b.status = 'RUNNING'
     AND other.state IN ('WAITING', 'RUN_PENDING', 'RUNNING')
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.guard_job_spec()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan jsonb; allowed text[]; illegal text; q text;
BEGIN
  -- An INDEX spec has no SQL to plan-walk: its logic is index_object_type,
  -- and its inputs are the object type's datasources rather than declared
  -- dataset_inputs. Everything below this branch is about validating logic.
  IF NEW.output_object_type_id IS NOT NULL THEN
    IF NOT public.can_index_object_type(NEW.output_object_type_id) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — publishing an index JobSpec takes the editor role on the object type''s project';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.object_type_datasources ds
                    WHERE ds.object_type_id = NEW.output_object_type_id) THEN
      RAISE EXCEPTION 'Builds:JobSpecNeedsInputs — the object type has no datasource to index';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.can_write_dataset(NEW.output_dataset_id) THEN
    RAISE EXCEPTION 'Builds:NotAuthorized — publishing a JobSpec takes the editor role on the output''s project';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dataset_inputs di WHERE di.dataset_id = NEW.output_dataset_id) THEN
    RAISE EXCEPTION 'Builds:JobSpecNeedsInputs — declare at least one input on the output dataset first';
  END IF;
  IF NEW.logic_sql ~ ';' THEN
    RAISE EXCEPTION 'Builds:LogicIsOneSelect — the logic is a single SELECT, no statement separators';
  END IF;

  SELECT COALESCE(array_agg(d.physical_table), '{}') INTO allowed
    FROM public.dataset_inputs di
    JOIN public.datasets d ON d.id = di.input_dataset_id
   WHERE di.dataset_id = NEW.output_dataset_id AND d.physical_table IS NOT NULL;
  -- The CTEs replay each input's view, and dataset_view's own plumbing
  -- inlines into the plan — those three are the engine's, not the logic's.
  allowed := allowed || ARRAY['dataset_files', 'dataset_transactions', 'dataset_branches'];

  -- TG_OP guards reuse: on UPDATE only revalidate when the logic changed.
  IF TG_OP = 'UPDATE' AND NEW.logic_sql IS NOT DISTINCT FROM OLD.logic_sql THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.published_at := now();
    NEW.published_by := COALESCE(auth.uid(), OLD.published_by);
  END IF;

  q := public.job_spec_query_text(NEW.output_dataset_id, NEW.logic_sql);
  BEGIN
    EXECUTE 'EXPLAIN (FORMAT JSON) ' || q INTO plan;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Builds:LogicDoesNotParse — %', sqlerrm;
  END;

  SELECT rel INTO illegal
    FROM jsonb_path_query(plan, 'strict $.** ? (@."Relation Name" != null)."Relation Name"') r(v)
   CROSS JOIN LATERAL (SELECT trim(both '"' from v::text)) x(rel)
   WHERE rel <> ALL (allowed)
   LIMIT 1;
  IF illegal IS NOT NULL THEN
    RAISE EXCEPTION 'Builds:LogicReadsOutsideItsInputs — % is not a declared input of this JobSpec', illegal;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.run_build_job(p_job uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF job.output_object_type_id IS NOT NULL THEN
    IF NOT public.can_index_object_type(job.output_object_type_id) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — reindexing % takes the editor role on its project',
        job.output_object_type_id;
    END IF;
  ELSIF NOT public.can_write_dataset(job.output_dataset_id) THEN
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

  -- The Funnel branch. "A Funnel batch pipeline is comprised of a series of
  -- Foundry build jobs", so indexing an object type IS a build job: same
  -- seven states, same contention queue, same ledger. 442 collapsed Foundry's
  -- four jobs (changelog, merge changes, indexing, hydration) into the one
  -- Postgres can do honestly and that collapse stands — what changes is that
  -- something now runs it.
  IF job.output_object_type_id IS NOT NULL THEN
    BEGIN
      IF (public.index_object_type(job.output_object_type_id)).status <> 'success' THEN
        RAISE EXCEPTION 'Builds:IndexFailed — %',
          coalesce((SELECT i.error FROM public.object_type_indexes i
                     WHERE i.object_type_id = job.output_object_type_id),
                   'the index did not build');
      END IF;
      UPDATE public.build_jobs
         SET state = 'COMPLETED', finished_at = clock_timestamp(),
             spec_version = (SELECT version FROM public.job_specs WHERE id = job.job_spec_id),
             input_transactions = public.job_spec_input_state(job.job_spec_id)
       WHERE id = p_job;
      RETURN 'COMPLETED';
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.build_jobs
         SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
       WHERE id = p_job;
      RETURN 'FAILED';
    END;
  END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.run_schedules(p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- "Live pipelines run whenever their respective datasources are updated.
  -- Additionally, if user edits on objects are detected, live pipelines will
  -- run every six hours" — both arms live in run_stale_indexes, which this
  -- minute hand calls the way it already calls schedules.
  PERFORM public.run_stale_indexes(p_at);
  RETURN ran;
END $function$;

-- ── §4 a build that indexes ─────────────────────────────────────────────────
-- The spec is created on demand: an object type's index job is not something a
-- user authors, it is implied by the type having a datasource.
CREATE OR REPLACE FUNCTION public.index_job_spec(p_type uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE spec uuid;
BEGIN
  SELECT id INTO spec FROM public.job_specs WHERE output_object_type_id = p_type;
  IF spec IS NULL THEN
    INSERT INTO public.job_specs (output_object_type_id) VALUES (p_type) RETURNING id INTO spec;
  END IF;
  RETURN spec;
END $$;
REVOKE ALL ON FUNCTION public.index_job_spec(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.index_job_spec(uuid) TO authenticated;

-- One build carrying one index job per type. Separate from the user's own
-- transforms, the way Funnel pipelines are separate from the pipelines that
-- feed them — so contention queuing orders the two rather than a shared build
-- forcing them together.
CREATE OR REPLACE FUNCTION public.run_index_build(p_types uuid[], p_force boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE v_build uuid; t uuid; spec uuid; job uuid; n int := 0;
BEGIN
  FOREACH t IN ARRAY p_types LOOP
    IF NOT public.can_index_object_type(t) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — reindexing % takes the editor role on its project', t;
    END IF;
  END LOOP;

  INSERT INTO public.builds (force) VALUES (p_force) RETURNING id INTO v_build;
  FOREACH t IN ARRAY p_types LOOP
    spec := public.index_job_spec(t);
    -- "If an output dataset is fresh, it will not be recomputed" — the same
    -- rule, asked of an index.
    CONTINUE WHEN NOT p_force AND public.job_spec_fresh(spec);
    INSERT INTO public.build_jobs (build_id, job_spec_id, output_object_type_id)
    VALUES (v_build, spec, t) RETURNING id INTO job;
    n := n + 1;
    CONTINUE WHEN public.job_blocked_by(job) IS NOT NULL;
    PERFORM public.run_build_job(job);
  END LOOP;

  IF n = 0 THEN
    DELETE FROM public.builds WHERE id = v_build;
    RETURN NULL;   -- everything fresh: no build, the way run_build answers
  END IF;
  PERFORM public.settle_build(v_build);
  RETURN v_build;
END $$;
REVOKE ALL ON FUNCTION public.run_index_build(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_index_build(uuid[], boolean) TO authenticated;
COMMENT ON FUNCTION public.run_index_build(uuid[], boolean) IS
  'One build whose jobs index object types. Foundry indexes through build jobs; a job waits for any unfinished build rewriting its datasources. NULL means every index was fresh.';

-- ── §5 the two published triggers ───────────────────────────────────────────
-- Definer, because it runs from the heartbeat with no caller: it impersonates
-- each type''s last indexer the way run_schedules impersonates a schedule''s
-- editor. A type nobody has ever indexed is picked up by its project owner.
CREATE OR REPLACE FUNCTION public.run_stale_indexes(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-stale-indexes')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR t IN
    SELECT ot.id, ot.organization_id, ot.project_id
      FROM public.object_types ot
      JOIN public.object_type_indexes i ON i.object_type_id = ot.id
     WHERE EXISTS (SELECT 1 FROM public.object_type_datasources ds
                    WHERE ds.object_type_id = ot.id)
       -- Arm one: the datasource moved. Arm two: six hours have passed and
       -- there are edits to persist. Both from the pages, both asked here.
       AND (i.status <> 'success'
            OR i.indexed_at IS NULL
            OR (EXISTS (SELECT 1 FROM public.object_edits e
                         WHERE e.object_type_id = ot.id AND e.applied_at > i.indexed_at)
                AND i.indexed_at < p_at - interval '6 hours'))
       -- Nothing already in flight for this type.
       AND NOT EXISTS (
         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
          WHERE bj.output_object_type_id = ot.id
            AND b.status = 'RUNNING' AND bj.state IN ('WAITING', 'RUN_PENDING', 'RUNNING'))
     ORDER BY i.updated_at
     LIMIT 25
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = t.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_index_build(ARRAY[t.id], false);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    END;
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_stale_indexes(timestamptz) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.run_stale_indexes(timestamptz) IS
  'The Funnel live pipeline: reindex a type whose datasource moved, or whose edits are six hours unpersisted. Both arms are the published triggers.';

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE n int; def text;
BEGIN
  -- A job outputs exactly one thing, and an index job carries no SQL.
  -- Asserted from the catalog rather than by probing: guard_job_spec fires
  -- before the CHECK and would answer with its own refusal.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.job_specs'::regclass
     AND conname IN ('job_specs_one_output', 'job_specs_logic_matches_output');
  IF n <> 2 THEN RAISE EXCEPTION 'a JobSpec can output nothing, or both'; END IF;
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.build_jobs'::regclass AND conname = 'build_jobs_one_output';
  IF n <> 1 THEN RAISE EXCEPTION 'a build job can output nothing, or both'; END IF;

  -- The engine kept everything it had.
  def := pg_get_functiondef('public.run_build_job(uuid)'::regprocedure);
  IF def NOT LIKE '%Builds:UnsupportedOutputType%' OR def NOT LIKE '%dataset_rematerialize%' THEN
    RAISE EXCEPTION 'the restated run_build_job lost the dataset path';
  END IF;
  IF def NOT LIKE '%index_object_type%' THEN
    RAISE EXCEPTION 'run_build_job cannot index';
  END IF;
  def := pg_get_functiondef('public.guard_job_spec()'::regprocedure);
  IF def NOT LIKE '%Builds:LogicIsOneSelect%' OR def NOT LIKE '%Builds:LogicReadsOutsideItsInputs%' THEN
    RAISE EXCEPTION 'the restated guard_job_spec lost its plan walk';
  END IF;

  -- The minute hand carries the third call.
  SELECT count(*) INTO n FROM cron.job
   WHERE jobname = 'beacon-run-schedules' AND command LIKE '%drain_waiting_jobs%';
  IF n <> 1 THEN RAISE EXCEPTION 'the minute hand lost drain_waiting_jobs'; END IF;
  IF pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure)
     NOT LIKE '%run_stale_indexes%' THEN
    RAISE EXCEPTION 'the heartbeat does not reindex';
  END IF;

  RAISE NOTICE '513: the index is a build';
END $$;
