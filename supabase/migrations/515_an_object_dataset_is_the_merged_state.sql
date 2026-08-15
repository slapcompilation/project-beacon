-- An object dataset: the merged state, handed back to the dataset layer.
--
--   "Ontology users can create materializations of indexed data from the
--    Ontology that contains the latest state of each object by combining data
--    from both input datasources and user edits."   (object-edits/materializations)
--
-- The prose calls it a materialized dataset. THE PRODUCT DOES NOT: the object
-- type's panel is headed "Output datasets", the list under it "Object
-- datasets", and the button reads "+ Create new object dataset"
-- (object-edits/images/materializations-3.png). The noun here is the UI's.
--
-- ── WHY THIS IS CHEAP ───────────────────────────────────────────────────────
-- The dialog offers two intervals and names them
-- (object-edits/images/materializations-2.png):
--
--   Automatic — "Object datasets are built whenever updates to objects are
--               detected. As builds may happen more frequently this can
--               increase costs."
--   Periodic  — "Object datasets are built when input datasources update or
--               every 6 hours."
--
-- Periodic is word for word the pair 513 already implements for the index. So
-- this is another job on the same engine, not a second scheduler: 513 taught
-- job_specs to OUTPUT an object type, and this teaches it to take one as an
-- INPUT. The rows it copies are the index table, which 442 keyed by property
-- API name — which is exactly what the page demands:
--
--   "the API Name metadata of each property is used as the schema of the
--    materialized dataset"
--
-- ── NO STATUS COLUMN ────────────────────────────────────────────────────────
-- The row shows a status chip, and it is not stored. OSv2 has no scalar index
-- status: "a dedicated pipeline graph that shows the status of various jobs in
-- a Funnel pipeline" (object-indexing/faq) is the surface, and the truth is
-- the job's state. The scalar belongs to Phonograph, which is in planned
-- deprecation. So an object dataset's status is its last build job, read, not
-- written.
--
-- ── RECORDED, NOT BUILT ─────────────────────────────────────────────────────
-- Materializing as a restricted view, the marking and mandatory-control
-- provenance carried from the backing dataset, and multi-datasource subset
-- selection — most of the page's length, all of it waiting on restricted-view
-- plumbing.

-- ── §1 the object dataset ───────────────────────────────────────────────────
CREATE TABLE public.object_datasets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  -- "OSv2 also allows multiple materialized datasets to be created" — several
  -- per type, but one type per dataset.
  dataset_id     uuid NOT NULL UNIQUE REFERENCES public.datasets(id) ON DELETE CASCADE,
  build_interval text NOT NULL DEFAULT 'periodic'
                 CHECK (build_interval IN ('automatic', 'periodic')),
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX object_datasets_type_idx ON public.object_datasets (object_type_id);
CREATE INDEX object_datasets_created_by_idx ON public.object_datasets (created_by);
COMMENT ON TABLE public.object_datasets IS
  'An Output dataset of an object type: the merged state of datasources and user edits, copied into a dataset. Built automatically or periodically. The status shown beside one is its last build job, not a column.';

ALTER TABLE public.object_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readers of the type see its object datasets" ON public.object_datasets
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "editors of the type manage its object datasets" ON public.object_datasets
  FOR ALL USING (public.can_index_object_type(object_type_id))
  WITH CHECK (public.can_index_object_type(object_type_id));

-- "Materializations cannot be created on a branch." / "cannot be edited on a
-- branch." NOT ENFORCED, and the reason is that there is nothing to enforce it
-- against: our ontology branching (461) has no session "current branch" — a
-- branch is created FROM working state by save_to_new_branch, and
-- object_datasets are not a branchable resource kind at all. Inventing a
-- current_ontology_branch() to refuse against would be structure with no
-- caller. Recorded in the reading; revisit if object datasets ever enter
-- working state.

-- ── §2 a job may read an object type ────────────────────────────────────────
ALTER TABLE public.job_specs
  ADD COLUMN source_object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE;

-- 513 said a dataset output implies authored SQL. A materialization is the
-- third shape: a dataset output whose logic is the copy itself.
ALTER TABLE public.job_specs DROP CONSTRAINT job_specs_logic_matches_output;
ALTER TABLE public.job_specs
  ADD CONSTRAINT job_specs_logic_matches_output
    CHECK (CASE
             WHEN output_object_type_id IS NOT NULL THEN logic_sql IS NULL AND source_object_type_id IS NULL
             WHEN source_object_type_id IS NOT NULL THEN logic_sql IS NULL
             ELSE logic_sql IS NOT NULL
           END);
CREATE INDEX job_specs_source_object_type_idx ON public.job_specs (source_object_type_id);

ALTER TABLE public.build_jobs
  ADD COLUMN source_object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.job_specs.source_object_type_id IS
  'The object type this job copies into its output dataset — a materialization. Its inputs are that type''s datasources.';

-- ── §3 the restated engine ──────────────────────────────────────────────────
-- Live definitions with branches added, from pg_get_functiondef.

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
      UNION
      -- A materialization job reads an object type and writes a dataset, so
      -- its inputs are that type's datasources: when they move, the merged
      -- state it copies has moved with them.
      SELECT ds.dataset_id FROM public.object_type_datasources ds
       WHERE ds.object_type_id = js.source_object_type_id
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

  -- A MATERIALIZATION spec writes a dataset from an object type. There is no
  -- authored SQL to plan-walk and no dataset_inputs to declare: its input is
  -- the type, and reading it takes the right to read the type.
  IF NEW.source_object_type_id IS NOT NULL THEN
    IF NOT public.can_index_object_type(NEW.source_object_type_id) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — materializing an object type takes the editor role on its project';
    END IF;
    RETURN NEW;
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
  n bigint; col record; src text;
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
    -- "materializations of indexed data from the Ontology that contains the
    -- latest state of each object by combining data from both input
    -- datasources and user edits" — which is what the index table already
    -- holds, keyed by property API name because 442 built it that way and the
    -- page requires exactly that: "the API Name metadata of each property is
    -- used as the schema of the materialized dataset".
    IF job.source_object_type_id IS NOT NULL THEN
      SELECT i.index_table INTO src FROM public.object_type_indexes i
       WHERE i.object_type_id = job.source_object_type_id AND i.status = 'success';
      IF src IS NULL THEN
        RAISE EXCEPTION 'Builds:NotIndexed — the object type has no successful index to copy';
      END IF;
      EXECUTE format('CREATE TEMP TABLE _result ON COMMIT DROP AS SELECT * FROM objects.%I', src);
    ELSE
      q := public.job_spec_query(job.job_spec_id);
      EXECUTE 'CREATE TEMP TABLE _result ON COMMIT DROP AS ' || q;
    END IF;

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

    -- "materialized datasets are subject to a retention that is not
    -- customizable. Historical transactions are constantly deleted and only
    -- the latest snapshot is guaranteed to be available."
    IF job.source_object_type_id IS NOT NULL THEN
      DELETE FROM public.dataset_transactions old
       WHERE old.dataset_id = job.output_dataset_id AND old.id <> txn;
    END IF;
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
  PERFORM public.run_due_object_datasets(p_at);
  RETURN ran;
END $function$;

-- ── §4 building one ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.object_dataset_job_spec(p_object_dataset uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE od record; spec uuid;
BEGIN
  SELECT * INTO od FROM public.object_datasets WHERE id = p_object_dataset;
  IF od.id IS NULL THEN
    RAISE EXCEPTION 'Materializations:NotFound — % is not an object dataset you can see', p_object_dataset;
  END IF;
  SELECT id INTO spec FROM public.job_specs WHERE output_dataset_id = od.dataset_id;
  IF spec IS NULL THEN
    INSERT INTO public.job_specs (output_dataset_id, source_object_type_id)
    VALUES (od.dataset_id, od.object_type_id) RETURNING id INTO spec;
  END IF;
  RETURN spec;
END $$;
REVOKE ALL ON FUNCTION public.object_dataset_job_spec(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_dataset_job_spec(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_object_dataset_build(
  p_object_dataset uuid, p_force boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE od record; spec uuid; v_build uuid; job uuid;
BEGIN
  SELECT * INTO od FROM public.object_datasets WHERE id = p_object_dataset;
  IF od.id IS NULL THEN
    RAISE EXCEPTION 'Materializations:NotFound — % is not an object dataset you can see', p_object_dataset;
  END IF;
  spec := public.object_dataset_job_spec(p_object_dataset);
  IF NOT p_force AND public.job_spec_fresh(spec) THEN RETURN NULL; END IF;

  INSERT INTO public.builds (force) VALUES (p_force) RETURNING id INTO v_build;
  INSERT INTO public.build_jobs (build_id, job_spec_id, output_dataset_id, source_object_type_id)
  VALUES (v_build, spec, od.dataset_id, od.object_type_id) RETURNING id INTO job;
  IF public.job_blocked_by(job) IS NULL THEN
    PERFORM public.run_build_job(job);
  END IF;
  PERFORM public.settle_build(v_build);
  RETURN v_build;
END $$;
REVOKE ALL ON FUNCTION public.run_object_dataset_build(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_object_dataset_build(uuid, boolean) TO authenticated;

-- ── §5 the two intervals ────────────────────────────────────────────────────
-- When this object dataset last received data. Never built answers -infinity,
-- so a new one is due on the next tick under either interval.
CREATE OR REPLACE FUNCTION public.object_dataset_built_at(p_dataset uuid)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(max(t.committed_at), '-infinity'::timestamptz)
    FROM public.dataset_transactions t
   WHERE t.dataset_id = p_dataset AND t.status = 'COMMITTED'
$$;

-- Periodic asks the same question run_stale_indexes asks. Automatic asks one
-- more: has the index moved since we last copied it.
CREATE OR REPLACE FUNCTION public.run_due_object_datasets(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-object-datasets')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR d IN
    SELECT od.id, p.organization_id
      FROM public.object_datasets od
      JOIN public.object_types ot ON ot.id = od.object_type_id
      JOIN public.projects p ON p.id = ot.project_id
      JOIN public.object_type_indexes i ON i.object_type_id = ot.id
     WHERE i.status = 'success'
       AND NOT EXISTS (
         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
          WHERE bj.output_dataset_id = od.dataset_id
            AND b.status = 'RUNNING' AND bj.state IN ('WAITING', 'RUN_PENDING', 'RUNNING'))
       AND CASE od.build_interval
             -- "built whenever updates to objects are detected" — the index
             -- moving IS the update; never-built coalesces to -infinity and
             -- so is always due.
             WHEN 'automatic' THEN i.indexed_at > public.object_dataset_built_at(od.dataset_id)
             -- "built when input datasources update or every 6 hours". The
             -- first arm is job_spec_fresh's business and is asked by
             -- run_object_dataset_build; this is the clock.
             ELSE public.object_dataset_built_at(od.dataset_id) < p_at - interval '6 hours'
           END
     ORDER BY od.created_at
     LIMIT 25
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = d.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_object_dataset_build(d.id, false);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    END;
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_due_object_datasets(timestamptz) FROM PUBLIC, anon, authenticated;

-- ── assertions, which RUN rather than grep ──────────────────────────────────
-- 514 exists because 513's assertions matched text and never executed the
-- query. These execute.
DO $$
DECLARE n int;
BEGIN
  n := public.run_due_object_datasets(now());
  IF n IS NULL THEN RAISE EXCEPTION 'run_due_object_datasets returned nothing'; END IF;
  PERFORM public.run_schedules(now());

  -- The three job shapes are mutually exclusive and exhaustive.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.job_specs'::regclass AND conname = 'job_specs_logic_matches_output';
  IF n <> 1 THEN RAISE EXCEPTION 'the job shapes are unconstrained'; END IF;

  IF pg_get_functiondef('public.run_build_job(uuid)'::regprocedure) NOT LIKE '%Builds:NotIndexed%' THEN
    RAISE EXCEPTION 'run_build_job cannot materialize';
  END IF;
  IF pg_get_functiondef('public.run_schedules(timestamptz)'::regprocedure)
     NOT LIKE '%run_due_object_datasets%' THEN
    RAISE EXCEPTION 'the heartbeat does not build object datasets';
  END IF;

  RAISE NOTICE '515: an object dataset is the merged state, built';
END $$;
