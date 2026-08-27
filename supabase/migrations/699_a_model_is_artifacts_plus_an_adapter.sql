-- 699: a model is artifacts plus an adapter, and the VERSION is the unit.
--
--   "In Foundry, a model is an artifact for inference that contains machine learning, forecasting, optimization, physical models, or business rules."
--   — model-integration/models.md
--
-- The architecture is exactly two parts, and both pages spell them the same:
--
--   "Model artifacts: The model weights or container where the trained model is saved."
--   — model-integration/models.md
--
--   "Model adapter: The logic that describes how the platform can interact with the model artifacts to load, initialize, and perform inference with the model."
--   — model-integration/models.md
--
-- The adapter is a DECLARED, TYPED INTERFACE, not an opaque callable:
--
--   "The model adapter's `api()` method specifies the expected inputs and outputs in order to execute this model adapter's inference logic. Inputs and outputs are specified separately."
--   — integrate-models/model-adapter-api.md
--
--   "At runtime, the model adapter's `predict()` method is called with the specified inputs."
--   — integrate-models/model-adapter-api.md
--
-- THE LANGUAGE DIVERGENCE, recorded here because this is where it lives:
-- Foundry's adapter is Python, published as part of a `palantir_models`
-- library. This platform has no Python runtime. What it has is the seam with
-- the same structure — 501's function_versions: versioned code with a
-- declared typed signature, executed in a QuickJS/WASM isolate under the
-- caller's JWT. So an adapter HERE is a function version: its signature
-- plays api(), and calling it is predict(). The divergence is the language
-- and the sandbox, and it is scoped to the adapter_version_id column below.
--
-- The lifecycle image is why the VERSION carries the adapter pin: both
-- creation paths converge on one Model Version box,
--
--   "Model Version … Model dependencies are resolved and saved"
--   — integrate-models/images/custom_adapter-lifecycle.png
--
-- so what deploys is the version, dependencies resolved, never the model
-- head.
--
-- RIDs are attested, not invented: `ri.models.main.model.` appears in
-- integrate-models/transform-model-input.md and three other pages, and
-- `ri.models.main.model-version.` in
-- integrate-models/upload-image-container-model.md.

-- ── the model, a project resource ───────────────────────────────────────────

CREATE TABLE public.models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('models', 'model', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX models_rid_key ON public.models (rid);
CREATE INDEX models_project_idx ON public.models (project_id);
CREATE INDEX models_folder_idx ON public.models (folder_id);
CREATE INDEX models_org_idx ON public.models (organization_id);
CREATE INDEX models_created_by_idx ON public.models (created_by);
COMMENT ON TABLE public.models IS
  'A model: an artifact for inference (model-integration/models). A project resource whose versions carry the artifacts and the adapter pin. The RID kind is attested: ri.models.main.model (integrate-models/transform-model-input).';

-- ── the version: artifacts + a pinned adapter ───────────────────────────────

CREATE TABLE public.model_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid                text GENERATED ALWAYS AS (public.rid_of('models', 'model-version', id)) STORED,
  model_id           uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  -- stamped by trigger, 1, 2, 3 … per model
  version            integer NOT NULL CHECK (version > 0),
  -- "The model weights or container where the trained model is saved" — here
  -- weights, parameters or rules as data; there is no container registry.
  artifacts          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- where this version came from; ours are published programmatically
  source             text NOT NULL DEFAULT 'sdk'
                       CONSTRAINT model_versions_source_check
                       CHECK (source = ANY (ARRAY['importedContainerizedModel', 'external',
                         'codeWorkspace', 'modelStudio', 'codeRepository', 'sdk', 'promoted'])),
  -- the adapter's declared api(): inputs and outputs, specified separately
  api                jsonb NOT NULL DEFAULT '{"inputs": {}, "outputs": {}}'::jsonb,
  adapter_version_id uuid NOT NULL REFERENCES public.function_versions(id) ON DELETE RESTRICT,
  created_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(artifacts) = 'object'),
  UNIQUE (model_id, version)
);
CREATE UNIQUE INDEX model_versions_rid_key ON public.model_versions (rid);
CREATE INDEX model_versions_model_idx ON public.model_versions (model_id);
CREATE INDEX model_versions_adapter_idx ON public.model_versions (adapter_version_id);
CREATE INDEX model_versions_created_by_idx ON public.model_versions (created_by);
COMMENT ON TABLE public.model_versions IS
  'One immutable model version: the artifacts and the exact adapter version they are read through. The version is the unit everything downstream consumes, because the lifecycle diagram converges both creation paths on it — "Model dependencies are resolved and saved" (integrate-models/images/custom_adapter-lifecycle.png). The RID kind is attested: ri.models.main.model-version (integrate-models/upload-image-container-model).';
COMMENT ON COLUMN public.model_versions.adapter_version_id IS
  'THE RECORDED DIVERGENCE. Foundry''s adapter is Python (`palantir_models`); ours is a function version — TypeScript in a QuickJS/WASM isolate (501/502). Same seam, different language: the version''s signature is the adapter''s api(), and executing it is predict(). RESTRICT, because deleting the adapter from under a saved model would orphan its artifacts.';
COMMENT ON CONSTRAINT model_versions_source_check ON public.model_versions IS
  'Values from api/models-v2-resources-model-versions-get-model-version, whose source union publishes exactly these seven members: importedContainerizedModel, external, codeWorkspace, modelStudio, codeRepository, sdk, promoted. Wire vocabulary verbatim (the 656 rule). Ours default to sdk, published programmatically, which is that member''s meaning.';
COMMENT ON COLUMN public.model_versions.api IS
  'The adapter''s api() declaration: "The model adapter''s api() method specifies the expected inputs and outputs in order to execute this model adapter''s inference logic. Inputs and outputs are specified separately" (integrate-models/model-adapter-api). Shape: {"inputs": {name: {type, columns?}}, "outputs": {...}}; guard_model_version_api holds each type to the page''s seven API types and each column to its eleven column types. Deliberately NOT a strict runtime gate on batch rows: "Column types are generally not enforced for batch inference, unlike live inference" (integrate-models/model-adapter-api).';
COMMENT ON COLUMN public.model_versions.artifacts IS
  '"The model weights or container where the trained model is saved" (model-integration/models). Weights, parameters or rules as jsonb — the adapter reads them as its bound input. No container form exists here; container models are recorded unbuilt in readings/machine-learning-foundation.';

CREATE FUNCTION public.stamp_model_version()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version IS NOT NULL THEN RETURN NEW; END IF;
  SELECT coalesce(max(v.version), 0) + 1 INTO NEW.version
    FROM public.model_versions v WHERE v.model_id = NEW.model_id;
  RETURN NEW;
END $$;
CREATE TRIGGER stamp_model_version
  BEFORE INSERT ON public.model_versions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_model_version();

-- the api() declaration is held to the page's enumerations
CREATE FUNCTION public.guard_model_version_api()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE side text; entry record; col jsonb;
BEGIN
  IF jsonb_typeof(NEW.api) <> 'object'
     OR jsonb_typeof(coalesce(NEW.api -> 'inputs', 'null'::jsonb)) <> 'object'
     OR jsonb_typeof(coalesce(NEW.api -> 'outputs', 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Models:MalformedApi — api() specifies inputs and outputs, separately';
  END IF;
  FOREACH side IN ARRAY ARRAY['inputs', 'outputs'] LOOP
    FOR entry IN SELECT key, value FROM jsonb_each(NEW.api -> side) LOOP
      -- "The types of inputs and outputs for the model adapter API can be
      -- specified with the following classes" — the seven, and no others
      IF NOT (entry.value ->> 'type') = ANY (ARRAY[
        'Pandas', 'Spark', 'Parameter', 'FileSystem', 'MediaReference', 'Object', 'ObjectSet']) THEN
        RAISE EXCEPTION 'Models:UnknownApiType — % is not one of the seven model adapter API types', entry.value ->> 'type';
      END IF;
      FOR col IN SELECT * FROM jsonb_array_elements(coalesce(entry.value -> 'columns', '[]'::jsonb)) LOOP
        -- "The following types are supported for tabular columns" — eleven
        IF NOT (col ->> 1) = ANY (ARRAY[
          'str', 'int', 'float', 'bool', 'list', 'dict',
          'datetime.date', 'datetime.time', 'datetime.datetime', 'typing.Any', 'MediaReference']) THEN
          RAISE EXCEPTION 'Models:UnknownColumnType — % is not one of the eleven tabular column types', col ->> 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_model_version_api
  BEFORE INSERT ON public.model_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_model_version_api();
COMMENT ON FUNCTION public.guard_model_version_api() IS
  'Holds a version''s api() declaration to integrate-models/model-adapter-api: the seven API types (Pandas, Spark, Parameter, FileSystem, MediaReference, Object, ObjectSet) and the eleven tabular column types (str, int, float, bool, list, dict, datetime.date, datetime.time, datetime.datetime, typing.Any, MediaReference). A trigger rather than a CHECK because the sets live inside jsonb.';

-- a version is immutable once written — corrections are new versions
CREATE FUNCTION public.guard_model_version_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Models:VersionImmutable — a model version is immutable; publish a new one';
END $$;
CREATE TRIGGER guard_model_version_immutable
  BEFORE UPDATE ON public.model_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_model_version_immutable();

-- ── experiments: the training job's metrics ─────────────────────────────────

CREATE TABLE public.experiments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  name             text NOT NULL DEFAULT '' ,
  parameters       jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(parameters) = 'object'),
  CHECK (jsonb_typeof(metrics) = 'object')
);
CREATE INDEX experiments_version_idx ON public.experiments (model_version_id);
CREATE INDEX experiments_created_by_idx ON public.experiments (created_by);
COMMENT ON TABLE public.experiments IS
  '"Experiments are artifacts that represent a collection of metrics produced during a model training job" (model-studio/core-concepts). One per training run, hanging off the version the run produced — parameters in, metrics out.';

-- ── metric sets: one evaluation, its data pinned ────────────────────────────

CREATE TABLE public.metric_sets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  -- "the singular dataset and transaction (i.e. version) on which the
  -- metrics were computed"
  dataset_id       uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  transaction_id   uuid NOT NULL REFERENCES public.dataset_transactions(id) ON DELETE CASCADE,
  metrics          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  -- clock_timestamp, not now(): "the latest evaluation" must order two
  -- metric sets written in one transaction (the 496 lesson)
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (jsonb_typeof(metrics) = 'object')
);
CREATE INDEX metric_sets_version_idx ON public.metric_sets (model_version_id);
CREATE INDEX metric_sets_dataset_idx ON public.metric_sets (dataset_id);
CREATE INDEX metric_sets_txn_idx ON public.metric_sets (transaction_id);
CREATE INDEX metric_sets_created_by_idx ON public.metric_sets (created_by);
COMMENT ON TABLE public.metric_sets IS
  '"A MetricSet encapsulates the numerical metrics, images, and charts for a single model evaluation. MetricSets contain a reference to the corresponding model (and version), as well as the singular dataset and transaction (i.e. version) on which the metrics were computed" (model-integration/objectives). Four references, all present: version, dataset, transaction, and the metrics themselves. The pinned transaction is what makes an evaluation reproducible.';

-- the metric set's transaction must belong to its dataset — a fact spanning
-- two tables, so a trigger
CREATE FUNCTION public.guard_metric_set_transaction()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dataset_transactions t
                  WHERE t.id = NEW.transaction_id AND t.dataset_id = NEW.dataset_id) THEN
    RAISE EXCEPTION 'Models:TransactionNotOnDataset — the pinned transaction is not on the input dataset';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_metric_set_transaction
  BEFORE INSERT OR UPDATE ON public.metric_sets
  FOR EACH ROW EXECUTE FUNCTION public.guard_metric_set_transaction();

-- ── Model Studio's trainers, an indexed catalogue ───────────────────────────

CREATE FUNCTION public.model_studio_trainers()
RETURNS TABLE (trainer text, description text, built boolean)
LANGUAGE sql IMMUTABLE AS $$
  -- the three model-studio/core-concepts enumerates, with its own wording
  SELECT * FROM (VALUES
    ('timeseries_forecasting', 'Predicts future values by analyzing patterns in training data.', false),
    ('regression',             'Predicts continuous numeric values by learning relationships between input features and target variables in the training data.', false),
    ('classification',         'Assigns input data to predefined categories or classes by identifying patterns and distinctions in training data.', false)
  ) AS t(trainer, description, built)
$$;
COMMENT ON FUNCTION public.model_studio_trainers() IS
  'The three trainers model-studio/core-concepts enumerates — "Model studio trainers are the actual model training implementation that is used to train a model. Each trainer is targeted at a specific task." None is built: training here means publishing a version whose artifacts came from elsewhere. The catalogue exists so an unbuilt trainer refuses by name, the same pattern as quiver_card_kinds.';

-- ── RLS: the project decides, composed ──────────────────────────────────────

ALTER TABLE public.models         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_sets    ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_model(p_model uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.models m
                  WHERE m.id = p_model
                    AND m.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(m.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_model(p_model uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.models m
                  WHERE m.id = p_model
                    AND m.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(m.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_model(uuid) IS
  'Editor on the model''s project edits it — the application-resource floor. "Full version history, granular model permissioning" (model-integration/models) is the project''s permissioning here, composed rather than restated.';

CREATE POLICY "project members read models" ON public.models
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author models" ON public.models
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read versions" ON public.model_versions
  FOR SELECT USING ((SELECT public.can_read_model(model_id)));
CREATE POLICY "author versions" ON public.model_versions
  FOR ALL USING ((SELECT public.can_edit_model(model_id)))
          WITH CHECK ((SELECT public.can_edit_model(model_id)));

CREATE POLICY "read experiments" ON public.experiments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.model_versions v
                             WHERE v.id = model_version_id
                               AND public.can_read_model(v.model_id)));
CREATE POLICY "author experiments" ON public.experiments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.model_versions v
                          WHERE v.id = model_version_id
                            AND public.can_edit_model(v.model_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.model_versions v
                       WHERE v.id = model_version_id
                         AND public.can_edit_model(v.model_id)));

CREATE POLICY "read metric sets" ON public.metric_sets
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.model_versions v
                             WHERE v.id = model_version_id
                               AND public.can_read_model(v.model_id)));
CREATE POLICY "author metric sets" ON public.metric_sets
  FOR ALL USING (EXISTS (SELECT 1 FROM public.model_versions v
                          WHERE v.id = model_version_id
                            AND public.can_edit_model(v.model_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.model_versions v
                       WHERE v.id = model_version_id
                         AND public.can_edit_model(v.model_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.models         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiments    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_sets    TO authenticated;

-- ── creation ────────────────────────────────────────────────────────────────

CREATE FUNCTION public.create_model(p_project uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE m uuid;
BEGIN
  INSERT INTO public.models (project_id, name)
  VALUES (p_project, p_name) RETURNING id INTO m;
  RETURN m;
END $$;
COMMENT ON FUNCTION public.create_model(uuid, text) IS
  'Creates a model with no versions yet. INVOKER, so the model''s own policy decides who may.';

CREATE FUNCTION public.publish_model_version(p_model uuid, p_artifacts jsonb,
                                             p_adapter_version uuid,
                                             p_api jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v uuid; sig jsonb;
BEGIN
  SELECT fv.signature INTO sig FROM public.function_versions fv WHERE fv.id = p_adapter_version;
  IF sig IS NULL THEN
    RAISE EXCEPTION 'Models:NoSuchAdapter — % is not a published function version', p_adapter_version;
  END IF;
  -- "Palantir interacts with all models in the same way by interfacing with
  -- the model adapter class of that model version." One way: the adapter
  -- function is predict(artifacts, input) returning a JSON string — parsing
  -- the artifacts string is its load() step, in the only language we run.
  IF sig -> 'parameters' <> '[{"name": "artifacts", "type": "string", "required": true}, {"name": "input", "type": "string", "required": true}]'::jsonb
     OR sig ->> 'returns' <> 'string' THEN
    RAISE EXCEPTION 'Models:AdapterShape — an adapter is predict(artifacts: string, input: string) returning string, so the platform can interact with every model the same way';
  END IF;
  INSERT INTO public.model_versions (model_id, artifacts, adapter_version_id, api)
  VALUES (p_model, coalesce(p_artifacts, '{}'::jsonb), p_adapter_version,
          coalesce(p_api, '{"inputs": {}, "outputs": {}}'::jsonb))
  RETURNING id INTO v;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.publish_model_version(uuid, jsonb, uuid, jsonb) IS
  'Model.publish, the second box of the lifecycle diagram: artifacts, the declared api(), and the exact adapter version they are read through become one immutable model version. Refuses an adapter that is not the uniform predict shape, because "Palantir interacts with all models in the same way by interfacing with the model adapter class of that model version" (integrate-models/model-adapter-overview). INVOKER.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid;
  fn uuid; fn_odd uuid; fv uuid; fv_odd uuid; m uuid; v1 uuid; v2 uuid;
  ds uuid; br uuid; txn uuid; other_txn uuid; ds2 uuid; br2 uuid;
  u1 uuid := gen_random_uuid(); before text; n integer;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ml-699') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ml-699') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'ml699', 'ML699', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ml699@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ml699@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ml_699', 'ML 699') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- the adapter: a function version whose signature is the api()
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, 'predictPrice', 'Predict price') RETURNING id INTO fn;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn, 1, 0, 0,
      'export default function f(client, artifacts, input) { const a = JSON.parse(artifacts); const rows = JSON.parse(input); return JSON.stringify(rows.map(r => ({...r, prediction: a.intercept + a.slope * r.sqft}))) }',
      '{"parameters": [{"name": "artifacts", "type": "string", "required": true}, {"name": "input", "type": "string", "required": true}], "returns": "string"}'::jsonb)
    RETURNING id INTO fv;
    -- a second FUNCTION with a non-uniform shape, for the refusal below
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, 'oddShape', 'Odd shape') RETURNING id INTO fn_odd;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn_odd, 1, 0, 0,
      'export default function f(client, rows) { return rows.map(() => 1) }',
      '{"parameters": [{"name": "rows", "type": "Double[]", "required": true}], "returns": "Double[]"}'::jsonb)
    RETURNING id INTO fv_odd;

    -- 1. A model publishes versions that stamp 1, 2 in order, both with RIDs.
    SELECT public.create_model(proj, 'House prices') INTO m;
    SELECT public.publish_model_version(m, '{"slope": 2.0, "intercept": 1.0}'::jsonb, fv,
      '{"inputs": {"input_dataframe": {"type": "Pandas", "columns": [["sqft", "float"]]}}, "outputs": {"output_dataframe": {"type": "Pandas", "columns": [["sqft", "float"], ["prediction", "float"]]}}}'::jsonb) INTO v1;
    SELECT public.publish_model_version(m, '{"slope": 2.1, "intercept": 0.9}'::jsonb, fv) INTO v2;
    IF (SELECT version FROM public.model_versions WHERE id = v1) <> 1
       OR (SELECT version FROM public.model_versions WHERE id = v2) <> 2 THEN
      RAISE EXCEPTION 'versions did not stamp 1 then 2';
    END IF;
    IF (SELECT rid FROM public.model_versions WHERE id = v1)
       NOT LIKE 'ri.models.main.model-version.%' THEN
      RAISE EXCEPTION 'the version rid is not the attested shape';
    END IF;

    -- 2. A version is immutable — corrections are new versions.
    BEGIN
      UPDATE public.model_versions SET artifacts = '{"slope": 99}'::jsonb WHERE id = v1;
      RAISE EXCEPTION 'a model version was edited in place';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:VersionImmutable%' THEN RAISE; END IF;
    END;

    -- 3. An adapter must be a real published version, and it must be the
    --    uniform predict shape.
    BEGIN
      PERFORM public.publish_model_version(m, '{}'::jsonb, gen_random_uuid());
      RAISE EXCEPTION 'an invented adapter was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:NoSuchAdapter%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.publish_model_version(m, '{}'::jsonb, fv_odd);
      RAISE EXCEPTION 'a non-uniform adapter was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:AdapterShape%' THEN RAISE; END IF;
    END;

    -- 3b. The api() declaration is held to the page's two enumerations.
    BEGIN
      PERFORM public.publish_model_version(m, '{}'::jsonb, fv,
        '{"inputs": {"x": {"type": "Dataframe"}}, "outputs": {}}'::jsonb);
      RAISE EXCEPTION 'an invented API type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:UnknownApiType%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.publish_model_version(m, '{}'::jsonb, fv,
        '{"inputs": {"x": {"type": "Pandas", "columns": [["a", "double"]]}}, "outputs": {}}'::jsonb);
      RAISE EXCEPTION 'an invented column type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:UnknownColumnType%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.model_versions (model_id, artifacts, adapter_version_id, source)
      VALUES (m, '{}'::jsonb, fv, 'notebook');
      RAISE EXCEPTION 'a source outside the union was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 4. A metric set pins its transaction, and the pin is checked against
    --    the dataset it claims.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'eval_699', 'eval_699') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    PERFORM public.commit_transaction(txn);
    INSERT INTO public.metric_sets (model_version_id, dataset_id, transaction_id, metrics)
    VALUES (v1, ds, txn, '{"rmse": 3.2}'::jsonb);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'other_699', 'other_699') RETURNING id INTO ds2;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO other_txn;
    PERFORM public.commit_transaction(other_txn);
    BEGIN
      INSERT INTO public.metric_sets (model_version_id, dataset_id, transaction_id)
      VALUES (v1, ds, other_txn);
      RAISE EXCEPTION 'a transaction from another dataset was pinned';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Models:TransactionNotOnDataset%' THEN RAISE; END IF;
    END;

    -- 5. An experiment hangs off the version its training run produced.
    INSERT INTO public.experiments (model_version_id, name, parameters, metrics)
    VALUES (v2, 'run-2', '{"learning_rate": 0.1}'::jsonb, '{"loss": 0.42}'::jsonb);

    -- 6. The trainer catalogue holds the three, none built.
    SELECT count(*) INTO n FROM public.model_studio_trainers();
    IF n <> 3 THEN RAISE EXCEPTION 'the trainer catalogue holds %, not 3', n; END IF;
    SELECT count(*) INTO n FROM public.model_studio_trainers() t WHERE t.built;
    IF n <> 0 THEN RAISE EXCEPTION '% trainers claim to be built', n; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '699 proved, as the caller: versions stamp 1 then 2 with the attested ri.models.main RID shapes; a version is immutable in place; an invented adapter, a non-uniform adapter shape, an API type outside the seven, a column type outside the eleven and a source outside the wire union all refuse; a metric set pins a transaction and refuses one from another dataset; an experiment records a training run; and the trainer catalogue holds three, none built';
  END;
END $$;
