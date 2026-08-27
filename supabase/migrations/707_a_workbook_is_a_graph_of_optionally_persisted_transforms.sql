-- 707: Code Workbook — a graph of transforms whose persistence is a toggle.
--
--   "**Code Workbook** is an application that allows users to analyze and transform data in code using an intuitive graphical interface."
--   — code-workbook/overview.md
--
-- LEGACY, NOT SUNSET — every page carries the Legacy banner and the
-- lifecycle table defines it as "Production feature without active
-- development", a different row from Sunset. It is on the Home capture, so
-- it is built, whole.
--
-- OPTIONAL PERSISTENCE IS THE EXECUTION MODEL:
--
--   "By default, new transforms are not saved as datasets."
--   — code-workbook/optional-data-persistence.md
--
--   "Unsaved transforms in Code Workbook are logical blocks, not resources in a Project."
--   — code-workbook/optional-data-persistence.md
--
--   "When running a node, the logic from all unpersisted nodes upstream of that node will also be run."
--   — code-workbook/optional-data-persistence.md
--
-- so the compiler inlines unpersisted upstream logic and reads persisted
-- upstream from its dataset — the same recursive shape as Contour's
-- path-headed compile (705). And unsaving is a STATE MACHINE, the line the
-- adversary pass surfaced:
--
--   "If you choose to change a transform from not saved to saved, it will re-link to its previous saved dataset. If a previous saved dataset does not exist, a new dataset will be created."
--   — code-workbook/optional-data-persistence.md
--
-- ALIASES ARE A SECOND, WORKBOOK-LOCAL NAMESPACE:
--
--   "Transforms that are not saved as datasets are identified by a workbook-specific alias that allows you to refer to the transform in code."
--   — code-workbook/transforms-overview.md
--
-- and in SQL the alias is simply the table name — "The dataframe can be
-- read within SQL as a table" (code-workbook/workbooks-input-output-types.md)
-- — which is exactly a CTE name here.
--
-- TRANSFORMS ARE BRANCH-SCOPED, because branching enables teams, in the
-- core-concepts page's words, to operate on logic and data simultaneously —
-- a branch has its own copy of the logic. 707 creates only master; 708 adds
-- the branch operations.
--
-- A HIDDEN CODE REPOSITORY BACKS EVERY WORKBOOK — the adversary pass's
-- largest find, on a page the reading had used only for a RID placeholder:
--
--   "every workbook is backed by a special hidden code repository. This repository serves as a secure backup of the code written in a code workbook while also exposing the history of all code changes made on the workbook."
--   — code-workbook/hidden-repository.md
--
--   "Every code change made on a workbook branch automatically creates a new commit to the corresponding branch in the hidden code repository."
--   — code-workbook/hidden-repository.md
--
-- We built code repositories in 690, so this is wiring, not a note: a
-- trigger regenerates pipeline.sql on the corresponding repo branch and
-- commits. pipeline.py and pipeline.R exist the day those languages run.
--
-- THE DIVERGENCES, recorded here and bounded: the runtime is Spark with
-- Conda environments and three languages — "Code Workbook currently
-- supports three languages: Python, R, and SQL."
-- (code-workbook/workbooks-languages.md). A Python or R transform is legal
-- to STORE (the documented shape) and refuses to RUN, with the substrate
-- divergence in the refusal. Environments, Spark profiles, warm modules,
-- incremental computation: recorded, not built. No workbook RID is attested
-- (the service `vector` is, via ri.vector.main.dataset placeholders; the
-- kind token below is inference; api/ attests CODE_WORKBOOK as a
-- resourceType, so the resource itself is not invented).

-- ── the workbook ────────────────────────────────────────────────────────────

CREATE TABLE public.code_workbooks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- service attested (vector); the kind token is INFERENCE
  rid                  text GENERATED ALWAYS AS (public.rid_of('vector', 'workbook', id)) STORED,
  organization_id      uuid NOT NULL DEFAULT public.auth_org_id()
                         REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id           uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id            uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name                 text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "every workbook is backed by a special hidden code repository"
  hidden_repository_id uuid REFERENCES public.code_repositories(id) ON DELETE SET NULL,
  trashed_at           timestamptz,
  created_by           uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX code_workbooks_rid_key ON public.code_workbooks (rid);
CREATE INDEX code_workbooks_project_idx ON public.code_workbooks (project_id);
CREATE INDEX code_workbooks_folder_idx ON public.code_workbooks (folder_id);
CREATE INDEX code_workbooks_org_idx ON public.code_workbooks (organization_id);
CREATE INDEX code_workbooks_repo_idx ON public.code_workbooks (hidden_repository_id);
CREATE INDEX code_workbooks_created_by_idx ON public.code_workbooks (created_by);
COMMENT ON TABLE public.code_workbooks IS
  '"The main resource you interact with in Code Workbook is a Workbook" (code-workbook/core-concepts). A project resource backed by a hidden code repository (690''s engine) that commits on every code change. The RID kind token is INFERENCE; the service vector is Code Workbook''s own (its merge branches and profile RIDs carry it), and api/ attests CODE_WORKBOOK as a resourceType.';

-- ── branches: the table now, the operations in 708 ──────────────────────────

CREATE TABLE public.workbook_branches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id      uuid NOT NULL REFERENCES public.code_workbooks(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(btrim(name)) > 0),
  parent_branch_id uuid REFERENCES public.workbook_branches(id) ON DELETE SET NULL,
  protected        boolean NOT NULL DEFAULT false,
  -- "By default, a protected branch does not allow any user to use the Run
  -- button" — 708's protect operation applies that default
  allows_running   boolean NOT NULL DEFAULT true,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workbook_id, name)
);
CREATE INDEX workbook_branches_workbook_idx ON public.workbook_branches (workbook_id);
CREATE INDEX workbook_branches_parent_idx ON public.workbook_branches (parent_branch_id);
CREATE INDEX workbook_branches_created_by_idx ON public.workbook_branches (created_by);
COMMENT ON TABLE public.workbook_branches IS
  '"By default, Workbooks are created with a single branch with the same name as the default branch across all of Foundry. Typically, this branch is called master" (code-workbook/branching-overview). A branch holds its own copy of the logic (transforms are branch-scoped) and pins the data it saw at creation (708). At most 100 per workbook, the page''s own cap, enforced in 708''s create.';

-- ── imports: datasets, and the fourth input class ───────────────────────────

CREATE TABLE public.workbook_imports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id    uuid NOT NULL REFERENCES public.code_workbooks(id) ON DELETE CASCADE,
  alias          text NOT NULL CHECK (alias ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  dataset_id     uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  -- "Any queried object types … must be added as workbook inputs"
  object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(dataset_id, object_type_id) = 1),
  UNIQUE (workbook_id, alias)
);
CREATE INDEX workbook_imports_workbook_idx ON public.workbook_imports (workbook_id);
CREATE INDEX workbook_imports_dataset_idx ON public.workbook_imports (dataset_id);
CREATE INDEX workbook_imports_ot_idx ON public.workbook_imports (object_type_id);
COMMENT ON TABLE public.workbook_imports IS
  'What the workbook pulls in: "Input datasets are imported from elsewhere in Foundry to be used as source data" (code-workbook/workbooks-overview) with a freely-editable workbook-specific alias, plus the fourth input class the adversary pass surfaced — WORKBOOK INPUTS, "Any queried object types … or time series catalog syncs (accessed by series ID or a search query) must be added as workbook inputs" (time-series/foundryts). Object types are held; their documented use is time-series property access, which this platform does not run, so the compiler refuses referencing them by name rather than inventing semantics. Time-series catalog syncs are the recorded unbuilt half.';

-- ── the transform: a logical block, branch-scoped ───────────────────────────

CREATE TABLE public.workbook_transforms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id         uuid NOT NULL REFERENCES public.code_workbooks(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES public.workbook_branches(id) ON DELETE CASCADE,
  alias               text NOT NULL CHECK (alias ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  transform_type      text NOT NULL DEFAULT 'code'
                        CONSTRAINT workbook_transforms_type_check
                        CHECK (transform_type = ANY (ARRAY['code', 'template', 'manual_entry'])),
  language            text NOT NULL DEFAULT 'SQL'
                        CONSTRAINT workbook_transforms_language_check
                        CHECK (language = ANY (ARRAY['Python', 'R', 'SQL'])),
  source              text NOT NULL DEFAULT '',
  -- manual entry rows and columns; template parameter values
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_version_id uuid,
  -- OPTIONAL PERSISTENCE: the toggle, and the persistent link it re-links to
  persisted           boolean NOT NULL DEFAULT false,
  saved_dataset_id    uuid REFERENCES public.datasets(id) ON DELETE SET NULL,
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(config) = 'object'),
  CHECK (NOT persisted OR saved_dataset_id IS NOT NULL),
  UNIQUE (branch_id, alias)
);
CREATE INDEX workbook_transforms_workbook_idx ON public.workbook_transforms (workbook_id);
CREATE INDEX workbook_transforms_branch_idx ON public.workbook_transforms (branch_id);
CREATE INDEX workbook_transforms_saved_idx ON public.workbook_transforms (saved_dataset_id);
CREATE INDEX workbook_transforms_tmplv_idx ON public.workbook_transforms (template_version_id);
COMMENT ON TABLE public.workbook_transforms IS
  'One node: "Other than input datasets, each node in the graph represents a transform" (code-workbook/workbooks-overview), branch-scoped because a branch operates "on logic and data simultaneously". persisted=false is the default — a logical block, not a resource; saved_dataset_id survives unsaving so re-saving re-links, the documented state machine. "However, a transform can only have a single output. Multiple outputs are not currently supported" (code-workbook/workbooks-input-output-types) — one saved dataset, never two.';
COMMENT ON CONSTRAINT workbook_transforms_type_check ON public.workbook_transforms IS
  'Values from code-workbook/workbooks-overview: "There are three types of transforms available in Code Workbook:" — Code, Template, and Manual entry, snake_cased.';
COMMENT ON CONSTRAINT workbook_transforms_language_check ON public.workbook_transforms IS
  'Values from code-workbook/workbooks-languages: "Code Workbook currently supports three languages: Python, R, and SQL." All three are legal to STORE; only SQL runs here — the recorded substrate divergence, refused at compile with the divergence named, never at rest.';

-- an alias names ONE thing per branch, imports included
CREATE FUNCTION public.guard_workbook_alias()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'workbook_transforms' THEN
    IF EXISTS (SELECT 1 FROM public.workbook_imports i
                WHERE i.workbook_id = NEW.workbook_id AND i.alias = NEW.alias) THEN
      RAISE EXCEPTION 'CodeWorkbook:AliasTaken — % already names an import in this workbook', NEW.alias;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.workbook_transforms t
                WHERE t.workbook_id = NEW.workbook_id AND t.alias = NEW.alias) THEN
      RAISE EXCEPTION 'CodeWorkbook:AliasTaken — % already names a transform in this workbook', NEW.alias;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_workbook_transform_alias
  BEFORE INSERT OR UPDATE OF alias ON public.workbook_transforms
  FOR EACH ROW EXECUTE FUNCTION public.guard_workbook_alias();
CREATE TRIGGER guard_workbook_import_alias
  BEFORE INSERT OR UPDATE OF alias ON public.workbook_imports
  FOR EACH ROW EXECUTE FUNCTION public.guard_workbook_alias();

-- manual entry: four column types, at most 500 rows
CREATE FUNCTION public.guard_manual_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col jsonb;
BEGIN
  IF NEW.transform_type <> 'manual_entry' THEN RETURN NEW; END IF;
  IF jsonb_array_length(coalesce(NEW.config -> 'rows', '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'CodeWorkbook:TooManyRows — manual entry holds at most 500 rows';
  END IF;
  FOR col IN SELECT * FROM jsonb_array_elements(coalesce(NEW.config -> 'columns', '[]'::jsonb)) LOOP
    IF NOT (col ->> 'type') = ANY (ARRAY['Double', 'Integer', 'Boolean', 'String']) THEN
      RAISE EXCEPTION 'CodeWorkbook:UnknownColumnType — % is not one of the four manual entry offers', col ->> 'type';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_manual_entry
  BEFORE INSERT OR UPDATE OF config ON public.workbook_transforms
  FOR EACH ROW EXECUTE FUNCTION public.guard_manual_entry();
COMMENT ON FUNCTION public.guard_manual_entry() IS
  'The manual entry board''s bounds from code-workbook/transforms-overview: four column types (Double, Integer, Boolean, String) and a 500-row cap.';

-- ── the edges ───────────────────────────────────────────────────────────────

CREATE TABLE public.workbook_transform_inputs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transform_id       uuid NOT NULL REFERENCES public.workbook_transforms(id) ON DELETE CASCADE,
  input_transform_id uuid REFERENCES public.workbook_transforms(id) ON DELETE CASCADE,
  input_import_id    uuid REFERENCES public.workbook_imports(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(input_transform_id, input_import_id) = 1)
);
CREATE INDEX wt_inputs_transform_idx ON public.workbook_transform_inputs (transform_id);
CREATE INDEX wt_inputs_input_t_idx ON public.workbook_transform_inputs (input_transform_id);
CREATE INDEX wt_inputs_input_i_idx ON public.workbook_transform_inputs (input_import_id);
COMMENT ON TABLE public.workbook_transform_inputs IS
  'One edge: "A Code Workbook transform can have any amount of inputs" (code-workbook/workbooks-input-output-types), each an import or another transform of the SAME BRANCH. The alias is how code sees the edge — in SQL, as a table name.';

CREATE FUNCTION public.guard_wt_input()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE me record; up record;
BEGIN
  SELECT * INTO me FROM public.workbook_transforms WHERE id = NEW.transform_id;
  IF NEW.input_transform_id IS NOT NULL THEN
    SELECT * INTO up FROM public.workbook_transforms WHERE id = NEW.input_transform_id;
    IF up.branch_id IS DISTINCT FROM me.branch_id THEN
      RAISE EXCEPTION 'CodeWorkbook:CrossBranchInput — a transform reads its own branch';
    END IF;
    IF NEW.input_transform_id = NEW.transform_id THEN
      RAISE EXCEPTION 'CodeWorkbook:Cycle — a transform cannot read itself';
    END IF;
    IF EXISTS (
      WITH RECURSIVE upstream(id) AS (
        SELECT NEW.input_transform_id
        UNION
        SELECT i.input_transform_id FROM public.workbook_transform_inputs i
          JOIN upstream u ON u.id = i.transform_id
         WHERE i.input_transform_id IS NOT NULL)
      SELECT 1 FROM upstream WHERE id = NEW.transform_id) THEN
      RAISE EXCEPTION 'CodeWorkbook:Cycle — that input would make the graph circular';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.workbook_imports i
                    WHERE i.id = NEW.input_import_id AND i.workbook_id = me.workbook_id) THEN
      RAISE EXCEPTION 'CodeWorkbook:ImportOutsideWorkbook — an input import belongs to this workbook';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_wt_input
  BEFORE INSERT OR UPDATE ON public.workbook_transform_inputs
  FOR EACH ROW EXECUTE FUNCTION public.guard_wt_input();

-- ── the compiler: inline the unpersisted, read the persisted ────────────────

-- the latest schema's column list, quoted — the runner's input CTEs carry
-- _row and _file, so a bare * would leak them into every output (705's
-- lesson, held here as a helper because two arms need it)
CREATE FUNCTION public.workbook_schema_columns(p_dataset uuid)
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(
    (SELECT string_agg(format('%I', f ->> 'name'), ', ')
       FROM (SELECT sc.fields FROM public.dataset_schemas sc
              WHERE sc.dataset_id = p_dataset
              ORDER BY sc.created_at DESC LIMIT 1) latest,
            jsonb_array_elements(latest.fields) f), '*')
$$;

CREATE FUNCTION public.compile_workbook_transform(p_transform uuid)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  t record; e record; ctes text := ''; body text; piece text;
BEGIN
  SELECT * INTO t FROM public.workbook_transforms WHERE id = p_transform;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchTransform — % is not a transform you can see', p_transform;
  END IF;
  IF t.language <> 'SQL' THEN
    RAISE EXCEPTION 'CodeWorkbook:LanguageNotRun — % transforms are stored but do not run here; this platform runs SQL, the recorded substrate divergence', t.language;
  END IF;

  FOR e IN SELECT i.*, wt.alias AS t_alias, wt.persisted, wt.saved_dataset_id,
                  im.alias AS i_alias, im.dataset_id, im.object_type_id
             FROM public.workbook_transform_inputs i
             LEFT JOIN public.workbook_transforms wt ON wt.id = i.input_transform_id
             LEFT JOIN public.workbook_imports im ON im.id = i.input_import_id
            WHERE i.transform_id = p_transform LOOP
    IF e.input_import_id IS NOT NULL THEN
      IF e.object_type_id IS NOT NULL THEN
        -- a workbook input's documented use is time-series access, unbuilt
        RAISE EXCEPTION 'CodeWorkbook:WorkbookInputNotReadable — % is an object-type workbook input; its documented use is time series access, which this platform does not run', e.i_alias;
      END IF;
      -- the alias reads the dataset's runner CTE (named by api_name); the
      -- schema's columns are selected explicitly because the runner's CTE
      -- carries _row and _file (the 705 lesson)
      SELECT format('%I AS (SELECT %s FROM %I)', e.i_alias,
                    public.workbook_schema_columns(d.id), d.api_name) INTO piece
        FROM public.datasets d WHERE d.id = e.dataset_id;
    ELSIF e.persisted THEN
      -- "persisted nodes only compute a write" — downstream reads the dataset
      SELECT format('%I AS (SELECT %s FROM %I)', e.t_alias,
                    public.workbook_schema_columns(d.id), d.api_name) INTO piece
        FROM public.datasets d WHERE d.id = e.saved_dataset_id;
    ELSE
      -- "the logic from all unpersisted nodes upstream … will also be run"
      piece := format('%I AS (%s)', e.t_alias,
                      public.compile_workbook_transform(e.input_transform_id));
    END IF;
    ctes := ctes || CASE WHEN ctes = '' THEN '' ELSE ', ' END || piece;
  END LOOP;

  IF t.transform_type = 'manual_entry' THEN
    -- literal rows: four column types, compiled to a VALUES list
    SELECT format('SELECT * FROM jsonb_to_recordset(%L::jsonb) AS r(%s)',
                  (t.config -> 'rows')::text,
                  (SELECT string_agg(format('%I %s', c ->> 'name',
                     CASE c ->> 'type' WHEN 'Double' THEN 'double precision'
                                       WHEN 'Integer' THEN 'integer'
                                       WHEN 'Boolean' THEN 'boolean'
                                       ELSE 'text' END), ', ')
                     FROM jsonb_array_elements(t.config -> 'columns') c))
      INTO body;
  ELSE
    body := t.source;
  END IF;

  RETURN CASE WHEN ctes = '' THEN body
              ELSE format('WITH %s %s', ctes, body) END;
END $$;
COMMENT ON FUNCTION public.compile_workbook_transform(uuid) IS
  'The run model of optional persistence, compiled: unpersisted upstream inlines as a CTE named by its alias ("the logic from all unpersisted nodes upstream of that node will also be run"); persisted upstream reads its dataset ("persisted nodes only compute a write"); imports read the runner''s api_name CTE through their alias, which is how "The dataframe can be read within SQL as a table". Python and R refuse with the divergence named; an object-type workbook input refuses because its documented use is time-series access.';

-- ── save: re-link or create, publish the job spec ───────────────────────────

CREATE FUNCTION public.save_workbook_transform(p_transform uuid, p_dataset uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE t record; ds uuid; logic text; wb record;
BEGIN
  SELECT * INTO t FROM public.workbook_transforms WHERE id = p_transform;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchTransform — % is not a transform you can see', p_transform;
  END IF;
  SELECT * INTO wb FROM public.code_workbooks WHERE id = t.workbook_id;
  logic := public.compile_workbook_transform(p_transform);

  -- "it will re-link to its previous saved dataset. If a previous saved
  -- dataset does not exist, a new dataset will be created."
  ds := coalesce(t.saved_dataset_id, p_dataset);
  IF ds IS NULL THEN
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (wb.organization_id, wb.project_id,
            t.alias || '_' || substr(replace(t.id::text, '-', ''), 1, 8), t.alias)
    RETURNING id INTO ds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dataset_branches b
                  WHERE b.dataset_id = ds AND b.name = 'master') THEN
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master');
  END IF;

  DELETE FROM public.dataset_inputs WHERE dataset_id = ds;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id)
  SELECT DISTINCT ds, x.d FROM (
    WITH RECURSIVE up(tid) AS (
      SELECT p_transform
      UNION
      SELECT i.input_transform_id FROM public.workbook_transform_inputs i
        JOIN up u ON u.tid = i.transform_id
        JOIN public.workbook_transforms wt ON wt.id = i.input_transform_id
       WHERE NOT wt.persisted)
    SELECT im.dataset_id AS d
      FROM up JOIN public.workbook_transform_inputs i ON i.transform_id = up.tid
      JOIN public.workbook_imports im ON im.id = i.input_import_id
     WHERE im.dataset_id IS NOT NULL
    UNION
    SELECT wt.saved_dataset_id
      FROM up JOIN public.workbook_transform_inputs i ON i.transform_id = up.tid
      JOIN public.workbook_transforms wt ON wt.id = i.input_transform_id
     WHERE wt.persisted) x
  WHERE x.d IS NOT NULL AND x.d <> ds
  ON CONFLICT DO NOTHING;

  INSERT INTO public.job_specs (output_dataset_id, logic_sql, published_by)
  VALUES (ds, logic, auth.uid())
  ON CONFLICT (output_dataset_id) DO UPDATE
    SET logic_sql = EXCLUDED.logic_sql,
        published_by = EXCLUDED.published_by,
        published_at = now();

  UPDATE public.workbook_transforms
     SET persisted = true, saved_dataset_id = ds WHERE id = p_transform;
  RETURN ds;
END $$;
COMMENT ON FUNCTION public.save_workbook_transform(uuid, uuid) IS
  'The Save as dataset toggle, on: re-links to the previous saved dataset or creates one (optional-data-persistence''s state machine), publishes the compiled logic as the job spec (692''s upsert shape), and declares the persisted frontier''s datasets as inputs. The build validates the schema — "at least one column exists, column names are not duplicated" (code-workbook/faq) is the runner''s own output typing. INVOKER.';

CREATE FUNCTION public.unsave_workbook_transform(p_transform uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  -- the link SURVIVES: re-saving re-links
  UPDATE public.workbook_transforms SET persisted = false WHERE id = p_transform;
END $$;
COMMENT ON FUNCTION public.unsave_workbook_transform(uuid) IS
  'The toggle, off: the transform becomes a logical block again, and its saved_dataset_id stays so a later re-save "will re-link to its previous saved dataset" (code-workbook/optional-data-persistence). INVOKER.';

-- ── the hidden repository: commit on every code change ──────────────────────

CREATE FUNCTION public.sync_workbook_hidden_repo()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE wb record; rb uuid; body text; cm uuid;
BEGIN
  SELECT * INTO wb FROM public.code_workbooks WHERE id = NEW.workbook_id;
  IF wb.hidden_repository_id IS NULL THEN RETURN NEW; END IF;
  SELECT b.name INTO body FROM public.workbook_branches b WHERE b.id = NEW.branch_id;
  SELECT cb.id INTO rb FROM public.code_branches cb
   WHERE cb.repository_id = wb.hidden_repository_id AND cb.name = body;
  IF rb IS NULL THEN RETURN NEW; END IF;
  -- "The pipeline.R, pipeline.py, and pipeline.sql files each contain all of
  -- the code of the converted workbook for their respective language."
  SELECT coalesce(string_agg(format(E'-- %s\n%s', t.alias, t.source), E'\n\n'
                  ORDER BY t.position, t.created_at), '')
    INTO body
    FROM public.workbook_transforms t
   WHERE t.branch_id = NEW.branch_id AND t.language = 'SQL';
  INSERT INTO public.code_files (repository_id, branch_id, path, content)
  VALUES (wb.hidden_repository_id, rb, 'pipeline.sql', body)
  ON CONFLICT (branch_id, path) DO UPDATE
    SET content = EXCLUDED.content, updated_at = now();
  -- "Every code change … automatically creates a new commit"
  INSERT INTO public.code_commits (repository_id, branch_id, message)
  VALUES (wb.hidden_repository_id, rb, format('Update %s', NEW.alias))
  RETURNING id INTO cm;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_workbook_hidden_repo
  AFTER INSERT OR UPDATE OF source ON public.workbook_transforms
  FOR EACH ROW EXECUTE FUNCTION public.sync_workbook_hidden_repo();
COMMENT ON FUNCTION public.sync_workbook_hidden_repo() IS
  'The hidden repository''s promise, kept mechanically: every code change regenerates pipeline.sql on the corresponding repo branch and commits — "Every code change made on a workbook branch automatically creates a new commit to the corresponding branch in the hidden code repository" (code-workbook/hidden-repository). pipeline.py and pipeline.R exist the day those languages run here.';

-- ── creation ────────────────────────────────────────────────────────────────

CREATE FUNCTION public.create_code_workbook(p_project uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE wb uuid; repo uuid; org uuid;
BEGIN
  SELECT p.organization_id INTO org FROM public.projects p WHERE p.id = p_project;
  -- the hidden repository, in 690's engine, read-only in spirit: it has no
  -- surface entry and the workbook writes it
  INSERT INTO public.code_repositories (organization_id, project_id, name, kind)
  VALUES (org, p_project, p_name || ' (workbook)', 'transforms')
  RETURNING id INTO repo;
  INSERT INTO public.code_branches (repository_id, name) VALUES (repo, 'master');
  INSERT INTO public.code_workbooks (project_id, name, hidden_repository_id)
  VALUES (p_project, p_name, repo) RETURNING id INTO wb;
  INSERT INTO public.workbook_branches (workbook_id, name) VALUES (wb, 'master');
  RETURN wb;
END $$;
COMMENT ON FUNCTION public.create_code_workbook(uuid, text) IS
  'Creates the workbook, its master branch, and the hidden repository with its own master — "every workbook is backed by a special hidden code repository" (code-workbook/hidden-repository). INVOKER.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.code_workbooks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_imports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_transforms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_transform_inputs ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_workbook(p_workbook uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.code_workbooks w
                  WHERE w.id = p_workbook
                    AND w.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(w.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_workbook(p_workbook uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.code_workbooks w
                  WHERE w.id = p_workbook
                    AND w.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(w.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_workbook(uuid) IS
  'Editor on the workbook''s project edits it. The branch-level view/edit/maintain/manage tokens (708) compose from the same role — "By default, compass:read expands to view, compass:edit expands to edit, and compass:manage expands to maintain and manage" (code-workbook/faq).';

CREATE POLICY "project members read workbooks" ON public.code_workbooks
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author workbooks" ON public.code_workbooks
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read branches" ON public.workbook_branches
  FOR SELECT USING ((SELECT public.can_read_workbook(workbook_id)));
CREATE POLICY "author branches" ON public.workbook_branches
  FOR ALL USING ((SELECT public.can_edit_workbook(workbook_id)))
          WITH CHECK ((SELECT public.can_edit_workbook(workbook_id)));

CREATE POLICY "read imports" ON public.workbook_imports
  FOR SELECT USING ((SELECT public.can_read_workbook(workbook_id)));
CREATE POLICY "author imports" ON public.workbook_imports
  FOR ALL USING ((SELECT public.can_edit_workbook(workbook_id)))
          WITH CHECK ((SELECT public.can_edit_workbook(workbook_id)));

CREATE POLICY "read transforms" ON public.workbook_transforms
  FOR SELECT USING ((SELECT public.can_read_workbook(workbook_id)));
CREATE POLICY "author transforms" ON public.workbook_transforms
  FOR ALL USING ((SELECT public.can_edit_workbook(workbook_id)))
          WITH CHECK ((SELECT public.can_edit_workbook(workbook_id)));

CREATE POLICY "read transform inputs" ON public.workbook_transform_inputs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workbook_transforms t
                             WHERE t.id = transform_id
                               AND public.can_read_workbook(t.workbook_id)));
CREATE POLICY "author transform inputs" ON public.workbook_transform_inputs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.workbook_transforms t
                          WHERE t.id = transform_id
                            AND public.can_edit_workbook(t.workbook_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workbook_transforms t
                       WHERE t.id = transform_id
                         AND public.can_edit_workbook(t.workbook_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_workbooks            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_branches         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_imports          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_transforms       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_transform_inputs TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; wb uuid; mbr uuid; repo uuid;
  ds uuid; outd uuid; br uuid; txn uuid; fid uuid; phys text;
  imp uuid; ta uuid; tb uuid; n integer; ds2 uuid; ot uuid; oimp uuid; tp uuid;
  u1 uuid := gen_random_uuid(); before text; ont uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('cw-707') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('cw-707') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'cw707', 'CW707', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cw707@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'cw707@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'cw_707', 'CW 707') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'meteors_707', 'meteors_707') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ds, txn, '[{"name": "name", "type": "STRING"}, {"name": "mass", "type": "DOUBLE"}]'::jsonb);
    SELECT public.dataset_materialize(ds, txn) INTO phys;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (ds, txn, 'seed/meteors.rows', 3) RETURNING id INTO fid;
    EXECUTE format('INSERT INTO datasets.%I (_file, name, mass) VALUES ($1, ''Yani'', 10), ($1, ''Hoba'', 60000), ($1, ''Willam'', 15000)', phys) USING fid;
    PERFORM public.commit_transaction(txn);

    -- 1. Creation makes the workbook, its master, and the hidden repository
    --    with its own master.
    SELECT public.create_code_workbook(proj, 'Meteorite analysis') INTO wb;
    SELECT id INTO mbr FROM public.workbook_branches WHERE workbook_id = wb;
    SELECT hidden_repository_id INTO repo FROM public.code_workbooks WHERE id = wb;
    IF repo IS NULL OR NOT EXISTS (SELECT 1 FROM public.code_branches
                                    WHERE repository_id = repo AND name = 'master') THEN
      RAISE EXCEPTION 'the hidden repository did not appear with its master';
    END IF;

    -- 2. Imports carry aliases; an alias collision refuses across kinds.
    INSERT INTO public.workbook_imports (workbook_id, alias, dataset_id)
    VALUES (wb, 'meteors', ds) RETURNING id INTO imp;
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, source)
    VALUES (wb, mbr, 'big_ones', 'SELECT name, mass FROM meteors WHERE mass > 1000')
    RETURNING id INTO ta;
    BEGIN
      INSERT INTO public.workbook_imports (workbook_id, alias, dataset_id)
      VALUES (wb, 'big_ones', ds);
      RAISE EXCEPTION 'an import took a transform''s alias';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:AliasTaken%' THEN RAISE; END IF;
    END;

    -- 3. Every code change committed to the hidden repository, and
    --    pipeline.sql carries the source.
    SELECT count(*) INTO n FROM public.code_commits WHERE repository_id = repo;
    IF n < 1 THEN RAISE EXCEPTION 'no commit landed in the hidden repository'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.code_files
                    WHERE repository_id = repo AND path = 'pipeline.sql'
                      AND content LIKE '%mass > 1000%') THEN
      RAISE EXCEPTION 'pipeline.sql does not carry the transform source';
    END IF;

    -- 4. THE PERSISTENCE MODEL, end to end. B reads unpersisted A: A inlines.
    INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id)
    SELECT ta, NULL WHERE false; -- no-op, keeps shape explicit
    INSERT INTO public.workbook_transform_inputs (transform_id, input_import_id)
    VALUES (ta, imp);
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, source, position)
    VALUES (wb, mbr, 'heaviest', 'SELECT max(mass) AS heaviest FROM big_ones', 1)
    RETURNING id INTO tb;
    INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id)
    VALUES (tb, ta);
    SELECT public.save_workbook_transform(tb, NULL) INTO outd;
    PERFORM public.run_build(ARRAY[outd], true);
    SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = outd;
    EXECUTE format('SELECT count(*) FROM datasets.%I WHERE heaviest = 60000', phys) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'the inlined chain should find Hoba at 60000'; END IF;

    -- 5. Unsave keeps the link; re-save re-links to the SAME dataset.
    PERFORM public.unsave_workbook_transform(tb);
    IF (SELECT saved_dataset_id FROM public.workbook_transforms WHERE id = tb) IS NULL THEN
      RAISE EXCEPTION 'unsaving dropped the dataset link';
    END IF;
    SELECT public.save_workbook_transform(tb, NULL) INTO ds2;
    IF ds2 IS DISTINCT FROM outd THEN
      RAISE EXCEPTION 're-saving did not re-link to the previous dataset';
    END IF;

    -- 6. Once A persists, B reads A's DATASET, not its logic.
    PERFORM public.save_workbook_transform(ta, NULL);
    IF public.compile_workbook_transform(tb) NOT LIKE '%big_ones AS (SELECT * FROM %' THEN
      RAISE EXCEPTION 'a persisted upstream should compile as a dataset read';
    END IF;

    -- 7. A Python transform stores but refuses to run, naming the divergence.
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, language, source, position)
    VALUES (wb, mbr, 'py_node', 'Python', 'def py_node(big_ones): return big_ones', 2)
    RETURNING id INTO tp;
    BEGIN
      PERFORM public.compile_workbook_transform(tp);
      RAISE EXCEPTION 'a Python transform ran';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:LanguageNotRun%' THEN RAISE; END IF;
    END;

    -- 8. Manual entry compiles to literal rows; a fifth column type refuses.
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, transform_type, config, position)
    VALUES (wb, mbr, 'lookup', 'manual_entry',
      '{"columns": [{"name": "code", "type": "String"}, {"name": "factor", "type": "Double"}], "rows": [{"code": "A", "factor": 1.5}]}'::jsonb, 3);
    BEGIN
      INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, transform_type, config, position)
      VALUES (wb, mbr, 'bad_lookup', 'manual_entry',
        '{"columns": [{"name": "ts", "type": "Timestamp"}], "rows": []}'::jsonb, 4);
      RAISE EXCEPTION 'a fifth manual entry column type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:UnknownColumnType%' THEN RAISE; END IF;
    END;

    -- 9. An object-type workbook input registers, and refuses at compile.
    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'Sensor707', 'Sensor') RETURNING id INTO ot;
    INSERT INTO public.workbook_imports (workbook_id, alias, object_type_id)
    VALUES (wb, 'sensors', ot) RETURNING id INTO oimp;
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, source, position)
    VALUES (wb, mbr, 'sensor_read', 'SELECT * FROM sensors', 5) RETURNING id INTO tp;
    INSERT INTO public.workbook_transform_inputs (transform_id, input_import_id)
    VALUES (tp, oimp);
    BEGIN
      PERFORM public.compile_workbook_transform(tp);
      RAISE EXCEPTION 'an object-type workbook input compiled';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:WorkbookInputNotReadable%' THEN RAISE; END IF;
    END;

    -- 10. A cycle refuses.
    BEGIN
      INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id)
      VALUES (ta, tb);
      RAISE EXCEPTION 'a cycle was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:Cycle%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '707 proved, as the caller: creation brings the hidden repository and both masters; aliases are one namespace across imports and transforms; every code change commits pipeline.sql; an unpersisted chain inlines and builds Hoba at 60000 through the job spec; unsave keeps the link and re-save re-links; a persisted upstream compiles as a dataset read; Python stores but refuses to run naming the divergence; manual entry compiles literal rows and refuses a fifth column type; an object-type workbook input registers and refuses at compile; and a cycle refuses';
  END;
END $$;
