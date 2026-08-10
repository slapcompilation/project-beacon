-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 401 — the file/data access split, both halves.
--
-- Reading: docs/foundry-reference/readings/markings.md (M4 + M5)
--
-- M4 and M5 land together on purpose. The plan listed them separately, but a
-- split with only one side is the state I argued against when deferring it: two
-- predicates that cannot differ.
--
-- THE SPLIT IS NAMED BY FOUNDRY'S OWN UI, not inferred. The access panel is two
-- sections, and the second states its own scope:
--
--   "Data access requirements — People must meet these ADDITIONAL requirements
--    propagated from data upstream in order to ACCESS DATA IN THIS FILE."
--
--   File access  →  Roles AND Organizations·Any of AND File markings·All of
--   Data access  →  Additional data markings·All of
--
-- And the failure modes differ. Fail file access and the resource does not exist
-- for you. Pass file access, fail data access, and:
--
--   "the user can DETECT THE PRESENCE of the derived dataset and VIEW THE FILE
--    METADATA, but cannot access the data within."
--
-- `marking-file-inheritance.png` shows how far that goes: the denied user reads
-- the whole schema, including that there is a `credit_card` and a `passport_id`
-- column. COLUMN NAMES ARE METADATA. Hiding them would be more restrictive than
-- Foundry and would break the documented behaviour, so can_read_dataset gates the
-- registry and the schema, and only can_read_dataset_data gates rows.
--
-- WHAT A DATA MARKING IS. Not a second kind of marking:
--
--   "If a dataset has a FILE Marking, every dataset that depends on it inherits
--    that Marking and THE INHERITED MARKING IS KNOWN AS A DATA MARKING."
--
-- The same marking, arriving by a different route, landing in a different bucket.
-- So effective_data_markings collects the FILE markings of every transitive
-- ancestor — never a dataset's own.
--
-- A UNION OVER INPUTS, not a requirement on all of them. `markings-dataset.png`
-- draws two inputs with one marked: the downstream inherits, the propagating edge
-- is bold and the other faded. One marked input marks everything downstream.
--
-- WHERE WE DIVERGE, deliberately: Foundry's `stop_propagating` "must propagate
-- along the latest transactions… which requires you to rebuild the datasets".
-- We have no build system, so a stop takes effect on the next read. That is a
-- consequence of resolving on read rather than materialising, and it matches the
-- behaviour Foundry already has for *directly applied* markings ("you do not need
-- to rebuild datasets downstream").
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- The lineage edge. Foundry derives it from builds and shows it as **Inputs** on
-- the dataset About panel; we have no builds, so it is declared. The edge is the
-- same either way — what is missing is the writer, not the relationship.
CREATE TABLE public.dataset_inputs (
  dataset_id       uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  input_dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE RESTRICT,
  added_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_id, input_dataset_id),
  CHECK (dataset_id <> input_dataset_id)
);

COMMENT ON TABLE public.dataset_inputs IS
  'Which datasets this one was derived from — the Inputs list on the About panel. Markings propagate along these edges as data markings.';

-- `stop_propagating`, at Foundry's granularity: it is configured on an Input, so
-- a marking can be stopped from one input while still arriving from another.
CREATE TABLE public.dataset_input_marking_stops (
  dataset_id       uuid NOT NULL,
  input_dataset_id uuid NOT NULL,
  marking_id       uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  stopped_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset_id, input_dataset_id, marking_id),
  FOREIGN KEY (dataset_id, input_dataset_id)
    REFERENCES public.dataset_inputs (dataset_id, input_dataset_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.dataset_input_marking_stops IS
  'stop_propagating: this marking does not cross this input edge. "If restricted content is removed or obfuscated while deriving a dependent file, you can remove the Marking from the derived file."';

CREATE INDEX dataset_inputs_input_idx ON public.dataset_inputs (input_dataset_id);

CREATE POLICY "read inputs of readable datasets" ON public.dataset_inputs
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write inputs of writable datasets" ON public.dataset_inputs
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));
CREATE POLICY "read stops of readable datasets" ON public.dataset_input_marking_stops
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write stops of writable datasets" ON public.dataset_input_marking_stops
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

-- Every transitive ancestor's FILE markings. UNION rather than UNION ALL so a
-- cycle in the graph terminates: once no new dataset id appears, the recursion
-- stops on its own.
-- A marking FLOWS down the edges; it is not collected from a flat list of
-- ancestors. The difference is the stop. Gathering every ancestor and then
-- filtering by stops recorded on the target only cuts the last hop — a marking
-- stopped at `clean` still reached `onward` through it, because the stop is on
-- (clean, raw) and onward was asking about stops on (onward, *). Pruning has to
-- happen during the traversal, so the recursion carries (dataset, marking) pairs
-- and drops one the moment it meets a stopped edge.
CREATE OR REPLACE FUNCTION public.effective_data_markings(p_dataset uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up AS (
    -- Scope the walk to this dataset's ancestry rather than the whole graph.
    SELECT di.input_dataset_id AS id
      FROM public.dataset_inputs di
     WHERE di.dataset_id = p_dataset
    UNION
    SELECT di.input_dataset_id
      FROM public.dataset_inputs di
      JOIN up ON di.dataset_id = up.id
  ),
  flow AS (
    -- Seed: each ancestor holds its own file markings.
    SELECT u.id AS at, m.id AS marking
      FROM up u
     CROSS JOIN LATERAL unnest(public.effective_file_markings('dataset', u.id)) AS m(id)
    UNION
    -- Step: a marking at X reaches any Y that takes X as an input, unless that
    -- exact edge stops that exact marking. UNION dedups the pairs, so a cycle
    -- terminates on its own.
    SELECT di.dataset_id, f.marking
      FROM flow f
      JOIN public.dataset_inputs di ON di.input_dataset_id = f.at
     WHERE NOT EXISTS (
       SELECT 1 FROM public.dataset_input_marking_stops s
        WHERE s.dataset_id = di.dataset_id
          AND s.input_dataset_id = di.input_dataset_id
          AND s.marking_id = f.marking)
  )
  SELECT coalesce(array_agg(DISTINCT f.marking), '{}'::uuid[])
    FROM flow f
   WHERE f.at = p_dataset
     -- "ADDITIONAL data markings" — a marking already demanded by the file route
     -- is not restated here. Presentational only: conjunctive either way.
     AND NOT f.marking = ANY (public.effective_file_markings('dataset', p_dataset))
$$;

COMMENT ON FUNCTION public.effective_data_markings(uuid) IS
  'The file markings of every transitive input, arriving here as data markings. A union over inputs: one marked input marks everything downstream.';

-- ── the two predicates ───────────────────────────────────────────────────────
-- 392 wrote can_read_dataset as "the row is visible"; 395 gave it the tenant
-- check. It now also carries file markings, and gains a sibling for rows.

CREATE OR REPLACE FUNCTION public.can_read_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       -- Mandatory, and stated here rather than left to RLS: a SECURITY DEFINER
       -- caller does not get RLS, and this function is called from one.
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
       -- File access: "Users must meet all of the following requirements to
       -- access this file." Metadata, not rows.
       AND public.satisfies_markings(public.effective_file_markings('dataset', d.id))
  )
$$;

/** Rows. Everything file access demands, plus the markings propagated from
 *  upstream data. The gap between the two is the documented state where a user
 *  "can detect the presence of the derived dataset and view the file metadata,
 *  but cannot access the data within". */
CREATE OR REPLACE FUNCTION public.can_read_dataset_data(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT public.can_read_dataset(p_dataset)
     AND public.satisfies_markings(public.effective_data_markings(p_dataset))
$$;

COMMENT ON FUNCTION public.can_read_dataset(uuid) IS
  'FILE access: same organization, and a member of every file marking. Gates the registry row, the schema and the transaction history — not the rows.';
COMMENT ON FUNCTION public.can_read_dataset_data(uuid) IS
  'DATA access: file access plus every data marking propagated from upstream. Gates rows only.';

-- Writing data is writing data, so it is gated by the data predicate too — a
-- caller who cannot read the rows must not be able to replace them.
CREATE OR REPLACE FUNCTION public.can_write_dataset_data(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT public.can_write_dataset(p_dataset) AND public.can_read_dataset_data(p_dataset)
$$;

-- Generated tables get the split too. Tables created before this migration keep
-- their old policy; there are none, and the assertion below proves the generator
-- emits the new one.
CREATE OR REPLACE FUNCTION public.dataset_materialize(p_dataset uuid, p_transaction uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tbl text; cols text; fields jsonb;
BEGIN
  IF NOT public.can_write_dataset(p_dataset) THEN
    RAISE EXCEPTION 'Datasets:NotAuthorized — no editor role on this dataset''s project';
  END IF;

  SELECT d.api_name INTO tbl FROM public.datasets d WHERE d.id = p_dataset;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Datasets:NoSuchDataset — %', p_dataset; END IF;

  SELECT s.fields INTO fields FROM public.dataset_schemas s WHERE s.transaction_id = p_transaction;
  IF fields IS NULL THEN
    RAISE EXCEPTION 'Datasets:NoSchemaOnTransaction — a table needs a schema, and schemas hang off a transaction';
  END IF;

  SELECT string_agg(format('%I %s', f ->> 'name', public.dataset_field_sql_type(f)), ', ')
    INTO cols FROM jsonb_array_elements(fields) f;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS datasets.%I (
       _row  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       _file uuid NOT NULL REFERENCES public.dataset_files(id) ON DELETE CASCADE,
       %s)', tbl, cols);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON datasets.%I (_file)', tbl || '_file_idx', tbl);

  -- Rows are DATA. The registry row, the schema and the history are metadata and
  -- are gated one level looser, which is the whole point of the split.
  EXECUTE format('DROP POLICY IF EXISTS "rows follow the dataset" ON datasets.%I', tbl);
  EXECUTE format(
    'CREATE POLICY "rows follow the dataset" ON datasets.%I FOR ALL
       USING (public.can_read_dataset_data(%L::uuid))
       WITH CHECK (public.can_write_dataset_data(%L::uuid))', tbl, p_dataset, p_dataset);

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON datasets.%I TO authenticated', tbl);

  UPDATE public.datasets SET physical_table = tbl, updated_at = now() WHERE id = p_dataset;
  RETURN tbl;
END $$;

REVOKE ALL ON FUNCTION public.dataset_materialize(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_materialize(uuid, uuid) TO authenticated;

DO $$
DECLARE
  org uuid; proj uuid; raw uuid; clean uuid; onward uuid; other uuid;
  cat uuid; mk uuid; before text; dm uuid[];
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m401') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm401', 'm401') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm401_raw', 'raw') RETURNING id INTO raw;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm401_clean', 'clean') RETURNING id INTO clean;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm401_onward', 'onward') RETURNING id INTO onward;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm401_other', 'other') RETURNING id INTO other;

  INSERT INTO public.marking_categories (name) VALUES ('m401') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  -- raw ──> clean ──> onward,  and other ──> clean (an UNMARKED second input)
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean, raw);
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean, other);
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (onward, clean);

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'dataset', raw);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  -- The marked dataset holds it as a FILE marking, never as a data marking.
  IF NOT (mk = ANY (public.effective_file_markings('dataset', raw))) THEN
    RAISE EXCEPTION 'Migration 401: the applied marking is not a file marking on its own dataset';
  END IF;
  IF array_length(public.effective_data_markings(raw), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 401: a dataset''s own marking leaked into its data markings';
  END IF;

  -- One marked input out of two is enough — the union, drawn in markings-dataset.png.
  dm := public.effective_data_markings(clean);
  IF NOT (mk = ANY (dm)) THEN
    RAISE EXCEPTION 'Migration 401: a marked input did not propagate to its consumer';
  END IF;
  IF array_length(public.effective_file_markings('dataset', clean), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 401: an inherited data marking was filed as a file marking';
  END IF;

  -- Transitive: "propagate through transform and analysis logic".
  IF NOT (mk = ANY (public.effective_data_markings(onward))) THEN
    RAISE EXCEPTION 'Migration 401: a marking did not propagate past the first hop';
  END IF;

  -- stop_propagating cuts it at the edge, and everything below goes clear.
  INSERT INTO public.dataset_input_marking_stops (dataset_id, input_dataset_id, marking_id)
       VALUES (clean, raw, mk);
  IF array_length(public.effective_data_markings(clean), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 401: stop_propagating did not stop the marking';
  END IF;
  IF array_length(public.effective_data_markings(onward), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 401: a stop upstream did not clear the datasets below it';
  END IF;

  -- The generator must emit the data predicate, not the metadata one. Reading the
  -- source is the only way to catch a policy that is wrong but syntactically fine.
  IF position('can_read_dataset_data' in
        (SELECT prosrc FROM pg_proc WHERE proname = 'dataset_materialize')) = 0 THEN
    RAISE EXCEPTION 'Migration 401: generated row policies still use the metadata predicate';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.dataset_input_marking_stops WHERE dataset_id = clean;
  DELETE FROM public.dataset_inputs WHERE dataset_id IN (clean, onward);
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = mk;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.datasets WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = mk;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
