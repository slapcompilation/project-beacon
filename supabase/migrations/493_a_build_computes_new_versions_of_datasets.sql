-- The pipeline layer, slice B1: JobSpecs, builds, and the engine.
--
-- "A **Build** is the mechanism used to compute new versions of
-- [datasets](/docs/foundry/data-integration/datasets/) in Foundry."
-- "A job specification, or **JobSpec**, is a definition of how a job should
-- be constructed. JobSpecs are published when changes are made to data
-- transformation logic in Foundry" (data-integration/builds.md)
--
-- Decisions from readings/builds-and-schedules.md: the logic is one SQL
-- SELECT with Postgres standing in for Spark (442's precedent); InputSpecs
-- ARE dataset_inputs; staleness compares the inputs' latest committed
-- transactions and the JobSpec version against what the last successful job
-- recorded; build locking is our open-transaction rule, literally.
--
-- The logic executes AS THE CALLER (role + claims), so RLS applies to every
-- input read and no superuser surface is reachable from inside a transform.
-- The plan walk at publish time refuses any base relation that is not a
-- declared input's materialized table — that validation is ours, recorded.

-- ── the JobSpec ─────────────────────────────────────────────────────────────
CREATE TABLE public.job_specs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  output_dataset_id uuid NOT NULL UNIQUE REFERENCES public.datasets(id) ON DELETE CASCADE,
  -- One SQL SELECT over the declared inputs, each visible as a CTE named by
  -- the input dataset's api_name over its current master view.
  logic_sql         text NOT NULL,
  -- "JobSpecs are published when changes are made to data transformation
  -- logic" — the version is what staleness compares.
  version           int NOT NULL DEFAULT 1,
  published_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.job_specs IS
  'How a job is constructed: the output dataset, one SQL SELECT over the declared inputs (dataset_inputs are the InputSpecs), and a version that bumps on every logic change.';

-- ── the two ledgers ─────────────────────────────────────────────────────────
CREATE TABLE public.builds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'RUNNING'
                  CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'ABORTED')),
  force           boolean NOT NULL DEFAULT false,
  requested_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
COMMENT ON TABLE public.builds IS
  'One run of the mechanism that computes new versions of datasets: orchestration, input reads, output writes — jobs carry the work.';

-- The seven documented job states. RUN_PENDING and ABORT_PENDING are the
-- execution-environment handshake; a synchronous engine passes through them
-- without dwelling, but the vocabulary is the page's whole list.
CREATE TABLE public.build_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id           uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  job_spec_id        uuid NOT NULL REFERENCES public.job_specs(id) ON DELETE CASCADE,
  output_dataset_id  uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  state              text NOT NULL DEFAULT 'WAITING'
                     CHECK (state IN ('WAITING', 'RUN_PENDING', 'RUNNING',
                                      'ABORT_PENDING', 'ABORTED', 'FAILED', 'COMPLETED')),
  -- "Opens new transactions on each output dataset to ensure that only the
  -- active build can write to the output dataset. This is known as *build
  -- locking*."
  transaction_id     uuid REFERENCES public.dataset_transactions(id) ON DELETE SET NULL,
  -- The two staleness facts, recorded at completion: the JobSpec version and
  -- the inputs' latest committed transactions as {dataset_id: transaction_id}.
  spec_version       int,
  input_transactions jsonb,
  error              text,
  started_at         timestamptz,
  finished_at        timestamptz
);
CREATE INDEX build_jobs_build_idx  ON public.build_jobs (build_id);
CREATE INDEX build_jobs_spec_idx   ON public.build_jobs (job_spec_id);
CREATE INDEX build_jobs_output_idx ON public.build_jobs (output_dataset_id);
CREATE INDEX builds_org_idx        ON public.builds (organization_id);
CREATE INDEX job_specs_output_idx  ON public.job_specs (output_dataset_id);
COMMENT ON TABLE public.build_jobs IS
  'A unit of work computing one output dataset, through the seven documented states, locking its output with a real transaction.';

-- ── helpers the engine and the guard share ──────────────────────────────────
-- The latest committed transactions of a JobSpec's inputs, as the staleness
-- fact shape build_jobs stores.
CREATE OR REPLACE FUNCTION public.job_spec_input_state(p_spec uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(di.input_dataset_id::text, t.latest::text), '{}'::jsonb)
    FROM public.job_specs js
    JOIN public.dataset_inputs di ON di.dataset_id = js.output_dataset_id
    LEFT JOIN LATERAL (
      SELECT tx.id AS latest FROM public.dataset_transactions tx
        JOIN public.dataset_branches b ON b.id = tx.branch_id
       WHERE tx.dataset_id = di.input_dataset_id
         AND b.name = 'master' AND tx.status = 'COMMITTED'
       ORDER BY tx.committed_at DESC LIMIT 1
    ) t ON true
   WHERE js.id = p_spec
$$;

-- "An output dataset is considered *fresh* if … input datasets and the logic
-- specified within the JobSpec have not changed since the last time the
-- output dataset was built."
CREATE OR REPLACE FUNCTION public.job_spec_fresh(p_spec uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.build_jobs bj
     JOIN public.job_specs js ON js.id = bj.job_spec_id
    WHERE bj.job_spec_id = p_spec
      AND bj.state = 'COMPLETED'
      AND bj.spec_version = js.version
      AND bj.input_transactions = public.job_spec_input_state(p_spec)
      AND bj.finished_at = (SELECT max(b2.finished_at) FROM public.build_jobs b2
                             WHERE b2.job_spec_id = p_spec AND b2.state = 'COMPLETED'))
$$;

-- The composed query: each declared input as a CTE named by its api_name
-- over its current master view, the logic as the body.
CREATE OR REPLACE FUNCTION public.job_spec_query(p_spec uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE ctes text; logic text;
BEGIN
  SELECT string_agg(format(
    '%I AS (SELECT * FROM datasets.%I r WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L)))',
    d.api_name, d.physical_table, b.id), ', ')
    INTO ctes
    FROM public.job_specs js
    JOIN public.dataset_inputs di ON di.dataset_id = js.output_dataset_id
    JOIN public.datasets d ON d.id = di.input_dataset_id
    JOIN public.dataset_branches b ON b.dataset_id = d.id AND b.name = 'master'
   WHERE js.id = p_spec AND d.physical_table IS NOT NULL;
  SELECT js.logic_sql INTO logic FROM public.job_specs js WHERE js.id = p_spec;
  IF ctes IS NULL THEN
    RAISE EXCEPTION 'Builds:InputNotMaterialized — every declared input needs a schema and a physical table before logic can run over it';
  END IF;
  RETURN 'WITH ' || ctes || ' SELECT * FROM (' || logic || ') q';
END $$;

-- ── the publish guard: the plan walk ────────────────────────────────────────
-- EXPLAIN the composed query and refuse any base relation that is not a
-- declared input's materialized table. Ours — no page prints how Foundry
-- sandboxes SQL logic (reading, open question 1).
CREATE OR REPLACE FUNCTION public.guard_job_spec()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan jsonb; allowed text[]; illegal text; q text;
BEGIN
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
END $$;

-- The composer for a spec that does not exist yet (the guard runs BEFORE
-- INSERT), taking the pieces directly.
CREATE OR REPLACE FUNCTION public.job_spec_query_text(p_output uuid, p_logic text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE ctes text;
BEGIN
  SELECT string_agg(format(
    '%I AS (SELECT * FROM datasets.%I r WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L)))',
    d.api_name, d.physical_table, b.id), ', ')
    INTO ctes
    FROM public.dataset_inputs di
    JOIN public.datasets d ON d.id = di.input_dataset_id
    JOIN public.dataset_branches b ON b.dataset_id = d.id AND b.name = 'master'
   WHERE di.dataset_id = p_output AND d.physical_table IS NOT NULL;
  IF ctes IS NULL THEN
    RAISE EXCEPTION 'Builds:InputNotMaterialized — every declared input needs a schema and a physical table before logic can run over it';
  END IF;
  RETURN 'WITH ' || ctes || ' SELECT * FROM (' || p_logic || ') q';
END $$;

CREATE TRIGGER trg_guard_job_spec BEFORE INSERT OR UPDATE ON public.job_specs
FOR EACH ROW EXECUTE FUNCTION public.guard_job_spec();

-- ── the engine ──────────────────────────────────────────────────────────────
-- Result columns become a dataset schema; the reverse of
-- dataset_field_sql_type, kept to the types a SELECT can honestly produce.
CREATE OR REPLACE FUNCTION public.build_field_of(p_pg_type text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_pg_type
    WHEN 'text'                     THEN '{"type":"STRING"}'::jsonb
    WHEN 'character varying'        THEN '{"type":"STRING"}'::jsonb
    WHEN 'boolean'                  THEN '{"type":"BOOLEAN"}'::jsonb
    WHEN 'smallint'                 THEN '{"type":"SHORT"}'::jsonb
    WHEN 'integer'                  THEN '{"type":"INTEGER"}'::jsonb
    WHEN 'bigint'                   THEN '{"type":"LONG"}'::jsonb
    WHEN 'real'                     THEN '{"type":"FLOAT"}'::jsonb
    WHEN 'double precision'         THEN '{"type":"DOUBLE"}'::jsonb
    WHEN 'numeric'                  THEN '{"type":"DOUBLE"}'::jsonb
    WHEN 'date'                     THEN '{"type":"DATE"}'::jsonb
    WHEN 'timestamp with time zone' THEN '{"type":"TIMESTAMP"}'::jsonb
    WHEN 'text[]'                   THEN '{"type":"ARRAY","arraySubType":{"type":"STRING"}}'::jsonb
  END
$$;

-- The one privileged step: swap the physical table for the new schema.
-- Definer because dropping a table takes its owner; guarded by the same
-- write test dataset_materialize itself applies.
CREATE OR REPLACE FUNCTION public.dataset_rematerialize(p_dataset uuid, p_transaction uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE phys text;
BEGIN
  IF NOT public.can_write_dataset(p_dataset) THEN
    RAISE EXCEPTION 'Datasets:NotAuthorized — no editor role on this dataset''s project';
  END IF;
  SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = p_dataset;
  IF phys IS NOT NULL THEN
    EXECUTE format('DROP TABLE IF EXISTS datasets.%I', phys);
    UPDATE public.datasets SET physical_table = NULL WHERE id = p_dataset;
  END IF;
  RETURN public.dataset_materialize(p_dataset, p_transaction);
END $$;
REVOKE ALL ON FUNCTION public.dataset_rematerialize(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_rematerialize(uuid, uuid) TO authenticated;

-- One build: resolve the job set, refuse cycles, skip the fresh, run in
-- dependency order, lock each output with a real transaction, terminate
-- dependents on failure. Returns the build id, or NULL when everything was
-- fresh and no build was created — the fact a schedule records as Ignored.
CREATE OR REPLACE FUNCTION public.run_build(
  p_targets uuid[], p_force boolean DEFAULT false, p_build_type text DEFAULT 'single')
RETURNS uuid LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp AS $$
DECLARE
  v_build uuid; spec record; job record; ds uuid;
  n_failed int := 0; n_aborted int := 0;
  q text; txn uuid; fid uuid; fields jsonb; cols text; phys text; n bigint;
  col record;
BEGIN
  IF p_build_type NOT IN ('single', 'full') THEN
    RAISE EXCEPTION 'Builds:UnknownBuildType — % (single and full exist; connecting is recorded, not built)', p_build_type;
  END IF;

  -- Resolve the job set. Full walks upstream through dataset_inputs;
  -- "Detects cycles in the specified input datasets and fails the build".
  DROP TABLE IF EXISTS _jobset;
  CREATE TEMP TABLE _jobset (dataset_id uuid PRIMARY KEY, spec_id uuid, depth int) ON COMMIT DROP;
  IF p_build_type = 'single' THEN
    INSERT INTO _jobset
    SELECT js.output_dataset_id, js.id, 0 FROM public.job_specs js
     WHERE js.output_dataset_id = ANY (p_targets);
  ELSE
    WITH RECURSIVE up AS (
      SELECT t.id AS dataset_id, 0 AS depth, ARRAY[t.id] AS path
        FROM unnest(p_targets) t(id)
      UNION ALL
      -- The path check terminates the walk on a cycle; the detector below
      -- then names it as the refusal.
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

  -- Permission: computing an output writes it.
  FOR ds IN SELECT dataset_id FROM _jobset LOOP
    IF NOT public.can_write_dataset(ds) THEN
      RAISE EXCEPTION 'Builds:NotAuthorized — building % takes the editor role on its project', ds;
    END IF;
  END LOOP;

  -- "If an output dataset is fresh, it will not be recomputed" — unless force.
  IF NOT p_force THEN
    DELETE FROM _jobset j WHERE public.job_spec_fresh(j.spec_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _jobset) THEN
    RETURN NULL; -- everything fresh: no build is created
  END IF;

  INSERT INTO public.builds (force) VALUES (p_force) RETURNING id INTO v_build;
  INSERT INTO public.build_jobs (build_id, job_spec_id, output_dataset_id)
  SELECT v_build, j.spec_id, j.dataset_id FROM _jobset j;

  -- Dependency order: an output that feeds another _jobset output runs first.
  FOR job IN
    SELECT bj.id, bj.job_spec_id, bj.output_dataset_id
      FROM public.build_jobs bj JOIN _jobset j ON j.dataset_id = bj.output_dataset_id
     WHERE bj.build_id = v_build
     ORDER BY j.depth DESC, bj.output_dataset_id
  LOOP
    -- "The job was aborted … as a result of a dependent job failing."
    IF EXISTS (
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

      -- The whole engine is SECURITY INVOKER, so the logic runs with the
      -- caller's own rights: RLS on every input read, and nothing reachable
      -- that the author could not already call by hand.
      EXECUTE 'CREATE TEMP TABLE _result ON COMMIT DROP AS ' || q;

      -- The result's columns become the output schema.
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

      -- Build locking: the open transaction is the lock.
      INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      SELECT job.output_dataset_id, b.id, 'SNAPSHOT'
        FROM public.dataset_branches b
       WHERE b.dataset_id = job.output_dataset_id AND b.name = 'master'
      RETURNING id INTO txn;
      UPDATE public.build_jobs SET transaction_id = txn WHERE id = job.id;
      INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (job.output_dataset_id, txn, fields);

      -- SNAPSHOT semantics: the physical table follows the newest schema.
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
      -- "previously completed jobs may still have written data" — only this
      -- job's transaction aborts.
      DROP TABLE IF EXISTS _result;
      UPDATE public.dataset_transactions SET status = 'ABORTED' WHERE id = txn AND status = 'OPEN';
      UPDATE public.build_jobs
         SET state = 'FAILED', error = sqlerrm, finished_at = clock_timestamp()
       WHERE id = job.id;
      n_failed := n_failed + 1;
    END;
    txn := NULL;
  END LOOP;

  UPDATE public.builds
     SET status = CASE WHEN n_failed > 0 OR n_aborted > 0 THEN 'FAILED' ELSE 'COMPLETED' END,
         finished_at = clock_timestamp()
   WHERE id = v_build;
  RETURN v_build;
END $$;

REVOKE ALL ON FUNCTION public.run_build(uuid[], boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_build(uuid[], boolean, text) TO authenticated;
COMMENT ON FUNCTION public.run_build(uuid[], boolean, text) IS
  'One build: resolve the job set (single or full), refuse cycles, skip the fresh unless forced, run jobs in dependency order as the caller, lock each output with a real transaction, abort dependents on failure. NULL means everything was fresh and no build was created.';

-- ── visibility ──────────────────────────────────────────────────────────────
ALTER TABLE public.job_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readers of the output see its JobSpec" ON public.job_specs FOR SELECT
  USING (public.can_read_dataset(output_dataset_id));
CREATE POLICY "editors of the output publish its JobSpec" ON public.job_specs FOR ALL
  USING (public.can_write_dataset(output_dataset_id))
  WITH CHECK (public.can_write_dataset(output_dataset_id));
CREATE POLICY "org members see builds" ON public.builds FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "org members see build jobs" ON public.build_jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.builds b
                  WHERE b.id = build_id
                    AND NOT (b.organization_id IS DISTINCT FROM public.auth_org_id())));
-- The invoker engine writes the ledger as the requester. A forged row grants
-- nothing: whoever could forge freshness here already holds the editor role
-- on the outputs and could write those datasets by hand.
CREATE POLICY "requesters write their builds" ON public.builds FOR ALL
  USING (requested_by = auth.uid()
         AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()))
  WITH CHECK (requested_by = auth.uid()
              AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "requesters write their build jobs" ON public.build_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.builds b
                  WHERE b.id = build_id AND b.requested_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builds b
                       WHERE b.id = build_id AND b.requested_by = auth.uid()));

-- ── assertions: the arc, then every refusal ─────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid;
  raw uuid; braw uuid; clean uuid; bclean uuid; onward uuid; bonward uuid;
  txn uuid; fid uuid; ptbl text; u1 uuid := gen_random_uuid(); before text;
  b1 uuid; b2 uuid; spec uuid; r record; n bigint;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('builds-493') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b493@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 'b493@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('B493');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'b493', 'B493') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);

  -- raw, with three rows on master.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'raw_taxi_493', 'raw taxi') RETURNING id INTO raw;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (raw, 'master') RETURNING id INTO braw;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (raw, braw, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (raw, txn,
    '[{"name":"ride_id","type":"STRING"},{"name":"fare","type":"INTEGER"},{"name":"city","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (raw, txn, 'rides.parquet', 3) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(raw, txn);
  EXECUTE format('INSERT INTO datasets.%I (_file, ride_id, fare, city) VALUES
    ($1,''R1'',10,''ATH''),($1,''R2'',30,''ATH''),($1,''R3'',20,''SKG'')', ptbl) USING fid;

  -- clean derives from raw.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'clean_taxi_493', 'clean taxi') RETURNING id INTO clean;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (clean, 'master') RETURNING id INTO bclean;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean, raw);
  INSERT INTO public.job_specs (output_dataset_id, logic_sql)
  VALUES (clean, 'SELECT city, sum(fare)::bigint AS total_fare FROM raw_taxi_493 GROUP BY city')
  RETURNING id INTO spec;

  -- 1. The build computes: two rows, schema derived, view readable.
  b1 := public.run_build(ARRAY[clean], false, 'single');
  IF b1 IS NULL THEN RAISE EXCEPTION 'a stale output produced no build'; END IF;
  SELECT * INTO r FROM public.build_jobs WHERE build_id = b1;
  IF r.state <> 'COMPLETED' THEN RAISE EXCEPTION 'the job should complete, got % (%)', r.state, r.error; END IF;
  SELECT count(*) INTO n FROM public.dataset_view(bclean);
  IF n <> 1 THEN RAISE EXCEPTION 'the output view should hold the build file'; END IF;
  EXECUTE format('SELECT count(*) FROM datasets.%I',
    (SELECT physical_table FROM public.datasets WHERE id = clean)) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'the transform should write 2 grouped rows, got %', n; END IF;

  -- 2. Fresh: the second run creates no build. Force overrides.
  b2 := public.run_build(ARRAY[clean], false, 'single');
  IF b2 IS NOT NULL THEN RAISE EXCEPTION 'a fresh output was rebuilt without force'; END IF;
  b2 := public.run_build(ARRAY[clean], true, 'single');
  IF b2 IS NULL THEN RAISE EXCEPTION 'force should build regardless of freshness'; END IF;

  -- 3. New input data makes it stale again.
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
  SELECT raw, braw, 'APPEND', b.head_transaction_id FROM public.dataset_branches b WHERE b.id = braw
  RETURNING id INTO txn;
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (raw, txn, 'rides2.parquet', 1) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  EXECUTE format('INSERT INTO datasets.%I (_file, ride_id, fare, city) VALUES ($1,''R4'',5,''SKG'')', ptbl) USING fid;
  b2 := public.run_build(ARRAY[clean], false, 'single');
  IF b2 IS NULL THEN RAISE EXCEPTION 'new input data should make the output stale'; END IF;

  -- 4. A full build chains: onward derives from clean; failing logic FAILS
  --    its job and the build; the completed upstream keeps its data.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'onward_493', 'onward') RETURNING id INTO onward;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (onward, 'master') RETURNING id INTO bonward;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (onward, clean);
  INSERT INTO public.job_specs (output_dataset_id, logic_sql)
  VALUES (onward, 'SELECT city, total_fare / 0 AS boom FROM clean_taxi_493');
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
  SELECT raw, braw, 'APPEND', b.head_transaction_id FROM public.dataset_branches b WHERE b.id = braw
  RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  b2 := public.run_build(ARRAY[onward], false, 'full');
  SELECT count(*) INTO n FROM public.build_jobs WHERE build_id = b2 AND state = 'COMPLETED';
  IF n <> 1 THEN RAISE EXCEPTION 'the upstream job should complete, % did', n; END IF;
  SELECT count(*) INTO n FROM public.build_jobs WHERE build_id = b2 AND state = 'FAILED';
  IF n <> 1 THEN RAISE EXCEPTION 'the failing job should record FAILED'; END IF;
  SELECT status INTO r FROM public.builds WHERE id = b2;
  IF r.status <> 'FAILED' THEN RAISE EXCEPTION 'a build with a failed job is FAILED'; END IF;

  -- 5. The plan walk refuses logic that reads outside its inputs.
  BEGIN
    UPDATE public.job_specs SET logic_sql = 'SELECT email FROM public.users' WHERE id = spec;
    RAISE EXCEPTION 'logic read outside its inputs';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Builds:LogicReadsOutsideItsInputs%' THEN RAISE; END IF;
  END;

  -- 6. A version bump on logic change, and it makes the output stale.
  SELECT version INTO n FROM public.job_specs WHERE id = spec;
  UPDATE public.job_specs
     SET logic_sql = 'SELECT city, sum(fare)::bigint AS total_fare, count(*) AS rides FROM raw_taxi_493 GROUP BY city'
   WHERE id = spec;
  SELECT version INTO r FROM public.job_specs WHERE id = spec;
  IF r.version <> n + 1 THEN RAISE EXCEPTION 'a logic change should bump the version'; END IF;
  b2 := public.run_build(ARRAY[clean], false, 'single');
  IF b2 IS NULL THEN RAISE EXCEPTION 'new logic should make the output stale'; END IF;

  -- 7. A cycle refuses.
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (raw, onward);
  BEGIN
    PERFORM public.run_build(ARRAY[clean], true, 'full');
    RAISE EXCEPTION 'a cyclic input graph built';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Builds:CycleDetected%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '493: a build computes new versions of datasets, and skips what is fresh';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
