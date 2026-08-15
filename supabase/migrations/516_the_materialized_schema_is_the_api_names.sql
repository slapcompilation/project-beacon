-- The materialized schema is the API names, and one foreign key wanted an index.
--
-- Two corrections to 515, both found by the standing suite on the next run.
--
-- §1 THE SCHEMA WAS WRONG, and the migration comment that justified it was
-- false. 515 said the index table is "keyed by property API name — which is
-- exactly what the page demands". It is not: the index keys its columns by
-- PROPERTY ID. For the seeded Aircraft type the index reads `tail_number` and
-- `first_flight` where the API names are `tailNumber` and `firstFlight`.
--
-- So `SELECT *` copied property ids into the object dataset and made this
-- sentence false:
--
--   "the API Name metadata of each property is used as the schema of the
--    materialized dataset"        (object-edits/materializations)
--
-- The copy now renames each column to its API name. The INDEX keeps its own
-- keying — no page says the index is API-named, and 442 owns that choice; it
-- is only the materialized dataset whose schema the page dictates.
--
-- The test caught it by asserting the output column exists, which is the kind
-- of assertion that survives a wrong belief. The comment did not.
--
-- §2 `build_jobs.source_object_type_id` had no index. catalog.test.ts asks
-- that of every foreign key on every run, and answered on the next one.

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
      -- "the API Name metadata of each property is used as the schema of the
      -- materialized dataset". The index keys its columns by PROPERTY ID, so
      -- the copy renames them; selecting * shipped property ids and made that
      -- sentence false.
      SELECT string_agg(format('%I AS %I', p.property_id, p.api_name), ', '
                        ORDER BY p.is_primary_key DESC, p.api_name)
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = job.source_object_type_id
         AND EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'objects' AND c.table_name = src
                        AND c.column_name = p.property_id);
      IF cols IS NULL THEN
        RAISE EXCEPTION 'Builds:NotIndexed — the index has no columns to copy';
      END IF;
      EXECUTE format('CREATE TEMP TABLE _result ON COMMIT DROP AS SELECT %s FROM objects.%I', cols, src);
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

CREATE INDEX build_jobs_source_object_type_idx
  ON public.build_jobs (source_object_type_id);

-- ── assertions, which run ───────────────────────────────────────────────────
DO $$
DECLARE n int; bad text;
BEGIN
  SELECT string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ') INTO bad
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
     AND NOT EXISTS (SELECT 1 FROM pg_index i
                      WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'foreign keys without an index: %', bad;
  END IF;

  IF pg_get_functiondef('public.run_build_job(uuid)'::regprocedure) NOT LIKE '%AS %I%' THEN
    RAISE EXCEPTION 'the materialization does not rename to API names';
  END IF;
  PERFORM public.run_due_object_datasets(now());

  RAISE NOTICE '516: the materialized schema is the API names';
END $$;
