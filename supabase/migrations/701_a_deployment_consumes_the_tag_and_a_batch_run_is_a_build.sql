-- 701: a deployment consumes the TAG, and a batch run writes a dataset.
--
-- TWO DEPLOYMENT RESOURCES, because the enumerating table lists two:
--
--   "Model direct deployments | Auto-upgrading model deployments; best for quick iteration and deployment."
--   — model-integration/what-to-use.md
--
--   "One direct model deployment can be created for each branch of a model. When a new model version is published to that branch, the direct model deployment will automatically upgrade to the new endpoint with no downtime."
--   — manage-models/create-a-model-deployment.md
--
-- The pre-build adversary pass caught my reading treating objective
-- deployments as the only kind — create-a-model-deployment.md, which the
-- reading claimed to have read whole, is nine sections about the OTHER kind.
-- Direct deployments bind to a model and follow its latest version; our
-- models have one implicit branch, so it is one direct deployment per MODEL
-- and the branch column is the recorded gap.
--
-- An OBJECTIVE deployment is one resource with a type radio, and it names a
-- tag, never a release. The create form words the two options itself:
--
--   "Batch: Models will take in and output a dataset in one build. Live: Models are available online as near real-time runtime inference endpoints, which can be executed by API calls."
--   — manage-models/images/howto-create-deployment.png
--
-- And the tag is the selector:
--
--   "Deployments can be configured to pick up the latest tagged release. For example, a deployment with a \"Production\" environment will take the latest tagged \"Production\" release."
--   — model-integration/objectives.md
--
--   "There must be an existing release inside the objective with the corresponding [environment tag](/docs/foundry/model-integration/objectives/#releases) of either staging or production."
--   — manage-models/set-up-batch.md
--
-- THE BATCH RUN IS A REAL WRITE — the form's Batch option promises a
-- dataset "in one build", and the prose says where it lands:
--
--   "**Batch deployments** run models within a pipeline by executing the model on a designated input Foundry dataset and publishing results into an output dataset."
--   — model-integration/objectives.md
--
-- The run is split where the substrate splits: SQL resolves the release and
-- reads the input view; the adapter executes in the function isolate (the
-- caller invokes function-run once, with all rows — predict takes the whole
-- dataframe); SQL then writes the output dataset the way run_build does —
-- transaction, schema, rematerialize, file, rows, commit — and pins the
-- input transaction the run consumed. What the probe cannot do is run the
-- isolate; the SQL halves are proven here and the isolate half is 501/502's,
-- already live. One caveat the enumerating table states is inherited
-- honestly: objective batch deployments here run ONE tabular input to ONE
-- tabular output — "Does not support multi-output and external models"
-- (model-integration/what-to-use.md).

-- ── the objective deployment: one resource, a type radio ────────────────────

CREATE TABLE public.objective_deployments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id      uuid NOT NULL REFERENCES public.modeling_objectives(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  description       text NOT NULL DEFAULT '',
  deployment_type   text NOT NULL
                      CONSTRAINT objective_deployments_type_check
                      CHECK (deployment_type = ANY (ARRAY['batch', 'live'])),
  environment       text NOT NULL
                      CONSTRAINT objective_deployments_environment_check
                      CHECK (environment = ANY (ARRAY['staging', 'production'])),
  -- a batch deployment's pipeline ends; live carries neither
  input_dataset_id  uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  output_dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  created_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (CASE deployment_type
           WHEN 'batch' THEN input_dataset_id IS NOT NULL AND output_dataset_id IS NOT NULL
           ELSE input_dataset_id IS NULL AND output_dataset_id IS NULL END)
);
CREATE INDEX objective_deployments_objective_idx ON public.objective_deployments (objective_id);
CREATE INDEX objective_deployments_input_idx ON public.objective_deployments (input_dataset_id);
CREATE INDEX objective_deployments_output_idx ON public.objective_deployments (output_dataset_id);
CREATE INDEX objective_deployments_created_by_idx ON public.objective_deployments (created_by);
COMMENT ON TABLE public.objective_deployments IS
  'One deployment of an objective: "Deployments enable delivery of selected and released models to consumers" (model-integration/objectives). It names a TYPE and an ENVIRONMENT and never a release — resolution to "the latest tagged release" happens at run time, which is how "corresponding deployments pick up the new model versions automatically" (same page) needs no machinery at all.';
COMMENT ON CONSTRAINT objective_deployments_type_check ON public.objective_deployments IS
  'Values from model-integration/objectives, whose Types of Deployments section holds exactly two headings: Batch deployments and Live deployments.';
COMMENT ON CONSTRAINT objective_deployments_environment_check ON public.objective_deployments IS
  'Values from manage-models/set-up-batch: "an existing release inside the objective with the corresponding environment tag of either staging or production".';

-- ── the direct deployment: model-bound, auto-upgrading ──────────────────────

CREATE TABLE public.model_direct_deployments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id   uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  started_at timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX model_direct_deployments_model_key ON public.model_direct_deployments (model_id);
COMMENT ON TABLE public.model_direct_deployments IS
  'A direct model deployment: "Direct model deployments are live hosted endpoints that immediately connect models to user applications" (manage-models/create-a-model-deployment). It binds to the MODEL and follows its latest version — "When a new model version is published to that branch, the direct model deployment will automatically upgrade" — which here means resolution at call time, no stored version. THE RECORDED GAP: Foundry allows one per model BRANCH; our models have no branches, so the unique index holds one per model and a branch column waits on model branches existing at all. Replica scaling, schedule overrides and the compute-module runtime are recorded unbuilt in readings/machine-learning-foundation.';

-- ── resolution: what a caller needs to run inference ────────────────────────

CREATE FUNCTION public.resolve_objective_deployment(p_deployment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE d record; rel uuid; sub record;
BEGIN
  SELECT * INTO d FROM public.objective_deployments WHERE id = p_deployment;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'Objectives:NoSuchDeployment — % is not a deployment you can see', p_deployment;
  END IF;
  rel := public.latest_tagged_release(d.objective_id, d.environment);
  IF rel IS NULL THEN
    -- "There must be an existing release inside the objective with the
    -- corresponding environment tag"
    RAISE EXCEPTION 'Objectives:NoTaggedRelease — no % release exists in this objective yet', d.environment;
  END IF;
  SELECT s.* INTO sub
    FROM public.objective_releases r
    JOIN public.objective_submissions s ON s.id = r.submission_id
   WHERE r.id = rel;
  RETURN jsonb_build_object(
    'release_id', rel,
    'submission_id', sub.id,
    'artifacts', sub.snapshot -> 'artifacts',
    'adapter', sub.snapshot -> 'adapter');
END $$;
COMMENT ON FUNCTION public.resolve_objective_deployment(uuid) IS
  'Resolves a deployment to what a caller needs for inference: the latest release carrying the deployment''s tag, and the SUBMISSION SNAPSHOT''s artifacts and adapter address — the copy, not the live model, because the copy is what was reviewed and released. Resolution happens per call, which is the page''s automatic upgrade: "corresponding deployments pick up the new model versions automatically without downtime" (model-integration/objectives).';

CREATE FUNCTION public.resolve_direct_deployment(p_deployment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE d record; v record; f record;
BEGIN
  SELECT * INTO d FROM public.model_direct_deployments WHERE id = p_deployment;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'Models:NoSuchDeployment — % is not a direct deployment you can see', p_deployment;
  END IF;
  -- "the direct model deployment will automatically upgrade to the new
  -- endpoint" — latest version, resolved now
  SELECT * INTO v FROM public.model_versions mv
   WHERE mv.model_id = d.model_id ORDER BY mv.version DESC LIMIT 1;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Models:NoVersions — this model has no published versions yet';
  END IF;
  SELECT fn.api_name, fn.ontology_id, fv.major, fv.minor, fv.patch, fv.prerelease
    INTO f
    FROM public.function_versions fv JOIN public.functions fn ON fn.id = fv.function_id
   WHERE fv.id = v.adapter_version_id;
  RETURN jsonb_build_object(
    'model_version_id', v.id,
    'model_version', v.version,
    'artifacts', v.artifacts,
    'adapter', jsonb_build_object(
      'api_name', f.api_name,
      'ontology_id', f.ontology_id,
      'version', f.major || '.' || f.minor || '.' || f.patch
                 || coalesce('-' || f.prerelease, '')));
END $$;
COMMENT ON FUNCTION public.resolve_direct_deployment(uuid) IS
  'Resolves a direct deployment to the model''s LATEST version — "When a new model version is published to that branch, the direct model deployment will automatically upgrade to the new endpoint with no downtime" (manage-models/create-a-model-deployment). Contrast the objective path, which resolves through a reviewed release; the comparison table on that page is exactly this trade.';

-- ── the batch run ledger ────────────────────────────────────────────────────

CREATE TABLE public.batch_deployment_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id         uuid NOT NULL REFERENCES public.objective_deployments(id) ON DELETE CASCADE,
  release_id            uuid NOT NULL REFERENCES public.objective_releases(id) ON DELETE CASCADE,
  -- the input view this run consumed, pinned the way a metric set pins
  input_transaction_id  uuid REFERENCES public.dataset_transactions(id) ON DELETE SET NULL,
  output_transaction_id uuid REFERENCES public.dataset_transactions(id) ON DELETE SET NULL,
  row_count             integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'COMPLETED'
                          CONSTRAINT batch_runs_status_check
                          CHECK (status = ANY (ARRAY['RUNNING', 'COMPLETED', 'FAILED', 'ABORTED'])),
  ran_by                uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ran_at                timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX batch_runs_deployment_idx ON public.batch_deployment_runs (deployment_id);
CREATE INDEX batch_runs_release_idx ON public.batch_deployment_runs (release_id);
CREATE INDEX batch_runs_input_txn_idx ON public.batch_deployment_runs (input_transaction_id);
CREATE INDEX batch_runs_output_txn_idx ON public.batch_deployment_runs (output_transaction_id);
CREATE INDEX batch_runs_ran_by_idx ON public.batch_deployment_runs (ran_by);
COMMENT ON TABLE public.batch_deployment_runs IS
  'One batch run: which release actually ran, the input transaction it consumed, and the output transaction it committed — the lineage "Every step in the model creation and consumption process is subject to platform guarantees around lineage, security, versioning, reproducibility, and auditing" (model-integration/overview) asks for. The HEALTH column of the deployments capture is the latest row''s status; the UPGRADE column is whether that row''s release is still the latest tagged one.';
COMMENT ON CONSTRAINT batch_runs_status_check ON public.batch_deployment_runs IS
  'Values from api/models-v2-resources-model-studio-runs-launch-model-studio, whose buildStatus enum publishes RUNNING, SUCCEEDED, FAILED, CANCELED — and our builds ledger already holds the OMA prose forms RUNNING, COMPLETED, FAILED, ABORTED (493). A batch run IS a build here, so it takes the builds vocabulary; the api page shows model runs speak build vocabulary too.';

-- ── the run: input rows out, predictions in, a dataset written ──────────────

CREATE FUNCTION public.batch_run_input(p_deployment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE d record; br uuid; phys text; rows jsonb; head uuid;
BEGIN
  SELECT * INTO d FROM public.objective_deployments WHERE id = p_deployment;
  IF d.id IS NULL OR d.deployment_type <> 'batch' THEN
    RAISE EXCEPTION 'Objectives:NotABatchDeployment — % has no input dataset to read', p_deployment;
  END IF;
  SELECT b.id, b.head_transaction_id INTO br, head
    FROM public.dataset_branches b
   WHERE b.dataset_id = d.input_dataset_id AND b.name = 'master';
  SELECT ds.physical_table INTO phys FROM public.datasets ds WHERE ds.id = d.input_dataset_id;
  IF phys IS NULL OR br IS NULL THEN
    RAISE EXCEPTION 'Objectives:InputNotMaterialized — the input dataset has no committed view yet';
  END IF;
  -- the current master view's rows, in stable _row order — the same order
  -- record_batch_run zips the predictions back onto
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(r) - ''_row'' - ''_file'' ORDER BY r._row), ''[]''::jsonb)
       FROM datasets.%I r
      WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))', phys, br)
  INTO rows;
  RETURN jsonb_build_object('input_transaction_id', head, 'rows', rows);
END $$;
COMMENT ON FUNCTION public.batch_run_input(uuid) IS
  'The read half of a batch run: the input dataset''s current master view as ordered rows, plus the head transaction so the run can pin what it consumed. The caller hands these rows to the adapter — one predict call takes the whole dataframe, which is what the api() example''s input_dataframe is (integrate-models/model-adapter-api).';

CREATE FUNCTION public.record_batch_run(p_deployment uuid, p_input_transaction uuid,
                                        p_output_rows jsonb)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  d record; resolved jsonb; rel uuid; br uuid; txn uuid; fid uuid;
  phys text; fields jsonb; cols text; n integer; run uuid;
  sample jsonb; key text;
BEGIN
  SELECT * INTO d FROM public.objective_deployments WHERE id = p_deployment;
  IF d.id IS NULL OR d.deployment_type <> 'batch' THEN
    RAISE EXCEPTION 'Objectives:NotABatchDeployment — % cannot record a batch run', p_deployment;
  END IF;
  IF jsonb_typeof(p_output_rows) <> 'array' OR jsonb_array_length(p_output_rows) = 0 THEN
    RAISE EXCEPTION 'Objectives:NoOutputRows — a batch run publishes results into an output dataset';
  END IF;
  resolved := public.resolve_objective_deployment(p_deployment);
  rel := (resolved ->> 'release_id')::uuid;

  -- "publishing results into an output dataset" — the run_build sequence:
  -- transaction, schema from the rows, rematerialize, file, rows, commit.
  SELECT id INTO br FROM public.dataset_branches
   WHERE dataset_id = d.output_dataset_id AND name = 'master';
  IF br IS NULL THEN
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (d.output_dataset_id, 'master') RETURNING id INTO br;
  END IF;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (d.output_dataset_id, br, 'SNAPSHOT') RETURNING id INTO txn;

  -- one tabular output: every value STRING or DOUBLE by inspection, because
  -- "Column types are generally not enforced for batch inference"
  sample := p_output_rows -> 0;
  fields := '[]'::jsonb;
  FOR key IN SELECT k FROM jsonb_object_keys(sample) k LOOP
    fields := fields || jsonb_build_array(jsonb_build_object(
      'name', key,
      'type', CASE WHEN jsonb_typeof(sample -> key) = 'number' THEN 'DOUBLE' ELSE 'STRING' END));
  END LOOP;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (d.output_dataset_id, txn, fields);

  phys := public.dataset_rematerialize(d.output_dataset_id, txn);
  n := jsonb_array_length(p_output_rows);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (d.output_dataset_id, txn, format('batch-deployment/%s.rows', d.id), n)
  RETURNING id INTO fid;
  SELECT string_agg(format('%I', f ->> 'name'), ', ') INTO cols
    FROM jsonb_array_elements(fields) f;
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, %s)
     SELECT %L, %s FROM jsonb_to_recordset($1) AS r(%s)',
    phys, cols, fid, cols,
    (SELECT string_agg(format('%I %s', f ->> 'name',
       CASE f ->> 'type' WHEN 'DOUBLE' THEN 'double precision' ELSE 'text' END), ', ')
       FROM jsonb_array_elements(fields) f))
  USING p_output_rows;
  UPDATE public.dataset_transactions
     SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = txn;

  INSERT INTO public.batch_deployment_runs
    (deployment_id, release_id, input_transaction_id, output_transaction_id, row_count)
  VALUES (p_deployment, rel, p_input_transaction, txn, n)
  RETURNING id INTO run;
  RETURN run;
END $$;
COMMENT ON FUNCTION public.record_batch_run(uuid, uuid, jsonb) IS
  'The write half of a batch run: the adapter''s output rows become a committed transaction on the output dataset, exactly the run_build sequence (493), and the run ledger pins which release ran over which input transaction. The isolate half — predict itself — is 501/502''s engine, invoked by the caller between batch_run_input and this. Output types are derived by inspection, not enforced: "Column types are generally not enforced for batch inference, unlike live inference" (integrate-models/model-adapter-api). INVOKER: writing the output dataset takes the caller''s own rights.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.objective_deployments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_direct_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_deployment_runs   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read deployments" ON public.objective_deployments
  FOR SELECT USING ((SELECT public.can_read_objective(objective_id)));
CREATE POLICY "editors author deployments" ON public.objective_deployments
  FOR ALL USING ((SELECT public.can_edit_objective(objective_id)))
          WITH CHECK ((SELECT public.can_edit_objective(objective_id)));

CREATE POLICY "read direct deployments" ON public.model_direct_deployments
  FOR SELECT USING ((SELECT public.can_read_model(model_id)));
CREATE POLICY "editors author direct deployments" ON public.model_direct_deployments
  FOR ALL USING ((SELECT public.can_edit_model(model_id)))
          WITH CHECK ((SELECT public.can_edit_model(model_id)));

CREATE POLICY "read batch runs" ON public.batch_deployment_runs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.objective_deployments d
                             WHERE d.id = deployment_id
                               AND public.can_read_objective(d.objective_id)));
CREATE POLICY "editors record batch runs" ON public.batch_deployment_runs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.objective_deployments d
                                  WHERE d.id = deployment_id
                                    AND public.can_edit_objective(d.objective_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_deployments    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_direct_deployments TO authenticated;
GRANT SELECT, INSERT                 ON public.batch_deployment_runs    TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────
--
-- The probe runs the batch loop with the isolate step STUBBED: it reads the
-- input rows with batch_run_input, computes the predictions in SQL standing
-- in for predict(), and hands them to record_batch_run. Every SQL half is
-- exercised for real — resolution through the tag, the pinned input
-- transaction, the output dataset write, the ledger. The isolate half is
-- 501/502's engine, live since #565.

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid;
  fn uuid; fv uuid; m uuid; v1 uuid; obj uuid; sub uuid; rel uuid;
  ind uuid; outd uuid; br uuid; txn uuid; fid uuid; phys text;
  dep uuid; live uuid; direct uuid; run uuid; got jsonb; rows jsonb;
  preds jsonb; n integer; out_rows integer;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ml-701') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ml-701') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'ml701', 'ML701', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ml701@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ml701@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ml_701', 'ML 701') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, 'predictPrice', 'Predict price') RETURNING id INTO fn;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn, 1, 0, 0,
      'export default function f(client, artifacts, input) { const a = JSON.parse(artifacts); return JSON.stringify(JSON.parse(input).map(r => ({...r, prediction: a.slope * r.sqft}))) }',
      '{"parameters": [{"name": "artifacts", "type": "string", "required": true}, {"name": "input", "type": "string", "required": true}], "returns": "string"}'::jsonb)
    RETURNING id INTO fv;
    SELECT public.create_model(proj, 'House prices') INTO m;
    SELECT public.publish_model_version(m, '{"slope": 3.0}'::jsonb, fv) INTO v1;
    SELECT public.create_modeling_objective(proj, 'Predict prices') INTO obj;
    SELECT public.submit_model(obj, v1) INTO sub;

    -- the input dataset: two rows, committed and materialized
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'houses_701', 'houses_701') RETURNING id INTO ind;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ind, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ind, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ind, txn, '[{"name": "address", "type": "STRING"}, {"name": "sqft", "type": "DOUBLE"}]'::jsonb);
    SELECT public.dataset_materialize(ind, txn) INTO phys;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (ind, txn, 'seed/houses.rows', 2) RETURNING id INTO fid;
    EXECUTE format('INSERT INTO datasets.%I (_file, address, sqft) VALUES ($1, ''12 Elm'', 100), ($1, ''9 Oak'', 250)', phys) USING fid;
    PERFORM public.commit_transaction(txn);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'prices_701', 'prices_701') RETURNING id INTO outd;

    -- 1. A live deployment refuses dataset ends; a batch one requires them.
    BEGIN
      INSERT INTO public.objective_deployments (objective_id, name, deployment_type, environment, input_dataset_id)
      VALUES (obj, 'bad', 'live', 'staging', ind);
      RAISE EXCEPTION 'a live deployment took an input dataset';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.objective_deployments (objective_id, name, deployment_type, environment)
    VALUES (obj, 'Live staging', 'live', 'staging') RETURNING id INTO live;
    INSERT INTO public.objective_deployments
      (objective_id, name, deployment_type, environment, input_dataset_id, output_dataset_id)
    VALUES (obj, 'Nightly prices', 'batch', 'production', ind, outd) RETURNING id INTO dep;

    -- 2. Resolution refuses while no release carries the tag: "There must be
    --    an existing release inside the objective with the corresponding
    --    environment tag".
    BEGIN
      PERFORM public.resolve_objective_deployment(dep);
      RAISE EXCEPTION 'a deployment resolved with no tagged release';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:NoTaggedRelease%' THEN RAISE; END IF;
    END;
    SELECT public.create_release(sub, '1.0', 'first') INTO rel;
    -- staging resolves now; production still refuses until promotion
    SELECT public.resolve_objective_deployment(live) INTO got;
    IF (got ->> 'release_id')::uuid IS DISTINCT FROM rel THEN
      RAISE EXCEPTION 'the live staging deployment did not resolve the staging release';
    END IF;
    BEGIN
      PERFORM public.resolve_objective_deployment(dep);
      RAISE EXCEPTION 'production resolved before promotion';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:NoTaggedRelease%' THEN RAISE; END IF;
    END;
    PERFORM public.mark_release_as_production(rel);
    SELECT public.resolve_objective_deployment(dep) INTO got;
    IF (got -> 'artifacts' ->> 'slope') <> '3.0' THEN
      RAISE EXCEPTION 'resolution did not carry the submission snapshot''s artifacts';
    END IF;

    -- 3. THE BATCH LOOP, isolate stubbed. Read the input view…
    SELECT public.batch_run_input(dep) INTO rows;
    IF jsonb_array_length(rows -> 'rows') <> 2 THEN
      RAISE EXCEPTION 'the input read returned % rows, not 2', jsonb_array_length(rows -> 'rows');
    END IF;
    IF (rows ->> 'input_transaction_id')::uuid IS DISTINCT FROM txn THEN
      RAISE EXCEPTION 'the input read did not pin the head transaction';
    END IF;
    -- …stand in for predict(artifacts, input) with the same arithmetic…
    SELECT jsonb_agg(jsonb_set(r, '{prediction}',
             to_jsonb(3.0 * (r ->> 'sqft')::double precision)) ORDER BY r ->> 'address')
      INTO preds FROM jsonb_array_elements(rows -> 'rows') r;
    -- …and record: the output dataset gets a committed transaction.
    SELECT public.record_batch_run(dep, (rows ->> 'input_transaction_id')::uuid, preds) INTO run;
    IF (SELECT status FROM public.batch_deployment_runs WHERE id = run) <> 'COMPLETED' THEN
      RAISE EXCEPTION 'the run did not record COMPLETED';
    END IF;
    IF (SELECT release_id FROM public.batch_deployment_runs WHERE id = run) IS DISTINCT FROM rel THEN
      RAISE EXCEPTION 'the run did not pin the release that ran';
    END IF;
    SELECT ds.physical_table INTO phys FROM public.datasets ds WHERE ds.id = outd;
    EXECUTE format('SELECT count(*) FROM datasets.%I', phys) INTO out_rows;
    IF out_rows <> 2 THEN
      RAISE EXCEPTION 'the output dataset holds % rows, not 2', out_rows;
    END IF;
    EXECUTE format('SELECT count(*) FROM datasets.%I WHERE prediction = 750', phys) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION '9 Oak at 250 sqft should predict 750'; END IF;

    -- 4. A direct deployment is one per model and follows the LATEST version.
    INSERT INTO public.model_direct_deployments (model_id) VALUES (m) RETURNING id INTO direct;
    BEGIN
      INSERT INTO public.model_direct_deployments (model_id) VALUES (m);
      RAISE EXCEPTION 'a second direct deployment on one model was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    SELECT public.resolve_direct_deployment(direct) INTO got;
    IF (got ->> 'model_version')::integer <> 1 THEN
      RAISE EXCEPTION 'the direct deployment did not resolve version 1';
    END IF;
    PERFORM public.publish_model_version(m, '{"slope": 4.0}'::jsonb, fv);
    SELECT public.resolve_direct_deployment(direct) INTO got;
    IF (got ->> 'model_version')::integer <> 2
       OR (got -> 'artifacts' ->> 'slope') <> '4.0' THEN
      RAISE EXCEPTION 'the direct deployment did not auto-upgrade to version 2';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '701 proved, as the caller: a live deployment refuses dataset ends and a batch one requires them; resolution refuses until a release carries the deployment''s tag, staging resolves before promotion and production only after; the batch loop reads the input view pinned to its head transaction, records the predictions as a committed transaction on the output dataset with the right arithmetic in the rows, and pins which release ran; and a direct deployment is one per model, resolving version 1 then auto-upgrading to version 2 the moment it is published';
  END;
END $$;
