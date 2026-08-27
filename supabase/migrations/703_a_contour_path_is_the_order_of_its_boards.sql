-- 703: Contour — an analysis is paths of boards, and the path is the order.
--
--   "An *analysis* in Contour consists of one or more analytical *paths*."
--   — contour/core-concepts.md
--
--   "Data flows down through the applied boards from the top of a Contour path to the bottom."
--   — contour/boards-overview.md
--
-- The path is the ordered spine of a board's PRIMARY input — and only that.
-- The pre-build adversary pass falsified the pure-list model before this
-- file was written: join-class boards name a second set, that set can be
-- another path, and common-input paths fan out:
--
--   "Instead, use a **common input path** and use that path's result as an input for other paths."
--   — contour/performance-optimize.md
--
-- So boards carry optional secondary input references, paths may head at
-- another path's result, and a guard keeps the path graph acyclic.
--
-- A PATH'S HEAD IS ONE OF FOUR KINDS — a dataset, another path's result, a
-- restricted view, or a virtual table:
--
--   "In Contour, there are two types of datasets you can use to begin a new analysis path:"
--   — contour/analysis-create-path.md
--
-- names the first two; restricted views appear in the parameterize page's
-- inventory of starting boards and in datasets-save's refusal (which 705
-- enforces); virtual tables are a product this platform does not have, so
-- that head kind is recorded, not built.
--
-- THE BOARD ROW CARRIES MORE THAN KIND + CONFIG. A board can be disabled in
-- place (the deep-dive course: toggling Enabled leaves it visible but
-- unapplied), retitled, and an aggregating board can PIVOT:
--
--   "Some boards that allow you to calculate aggregate metrics have an option to pivot. This switches your working dataset to the aggregate data computed in that board, instead of the original dataset. Any boards that follow will use the new aggregate dataset."
--   — contour/analysis-switch-aggregated.md
--
-- THE CATALOGUE IS THE PAGE'S OWN MATRIX. boards-descriptions opens with a
-- 25-row table whose columns are Visualize / Filter Rows / Aggregate /
-- Manipulate Columns / Remove Duplicates — five booleans, not a category
-- scalar. The Map board is the 26th row, from its own page
-- (contour/boards-map); the Text board is named by dashboards-getting-started
-- and has no page, so it is a note, not a row. The toolbar's six categories
-- are display grouping and stay in the surface, capture-derived.
--
-- No Contour RID is attested anywhere in the mirror (grepped `ri.contour`);
-- the filesystem API enumerates CONTOUR_ANALYSIS as a resource type, so the
-- resource is real and the RID token below is marked INFERENCE, the 488
-- precedent.

-- ── the catalogue: 26 boards, five capability flags ─────────────────────────

CREATE FUNCTION public.contour_board_kinds()
RETURNS TABLE (kind text, description text, visualize boolean, filter_rows boolean,
               aggregate boolean, manipulate_columns boolean, remove_duplicates boolean,
               built boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- boards-descriptions' own summary table, row for row, flags verbatim
  -- ("Yes, via the Pivot option" is true here, with the pivot rule enforced
  -- by guard_contour_board); Map appended from its own page.
  SELECT * FROM (VALUES
    ('summary',             'Reports the row count for your table.', true, false, false, false, false, true, NULL),
    ('filter',              'Filter your dataset by numeric, text, or date and time values.', false, true, false, false, true, true, NULL),
    ('expression',          'Use the expression language to derive new columns or perform complex filtering.', false, true, false, true, false, true,
      'the expression text passes through to the compiled SQL, so the dialect is Postgres, not SparkSQL — the recorded substrate divergence (692''s precedent)'),
    ('table',               'View a portion of raw data, explore schemas and calculate data coverage metrics.', true, false, false, false, false, true, NULL),
    ('histogram',           'Create a histogram of your data and filter to specific groups.', true, true, true, true, false, true,
      'manipulate_columns is "Yes, via the Pivot option" on the page — the pivot flag is that option'),
    ('distribution',        'Create a distribution plot of your data.', true, true, false, false, false, false, NULL),
    ('time_series',         'Create a chart with date/time on the x-axis and filter to specific groups.', true, true, false, false, false, false, NULL),
    ('edit_columns',        'Combine, duplicate, remove, rename, or split columns.', false, false, false, true, false, false, NULL),
    ('transform_data',      'Obfuscate data, find and replace values, or parse dates.', false, false, false, true, false, false,
      'the Actions-mode toolbar capture labels this family "Edit data" — recorded, the enumeration wins'),
    ('chart',               'Create customizable, multi-layered charts.', true, true, true, false, false, false,
      'the Actions-mode toolbar capture spells it "Charts" — recorded, the enumeration wins'),
    ('grid',                'Create a matrix of two categorical columns. Cells can be filtered and are displayed as a heatmap.', true, true, false, false, false, false, NULL),
    ('heatmap',             'View a heatmap based on coordinate data.', true, true, false, false, false, false, NULL),
    ('pivot_table',         'Create a pivot table for one or more metrics.', true, true, true, true, false, false,
      'manipulate_columns is "Yes, via the Pivot option" on the page'),
    ('column_editor',       'Derive new columns or remove unnecessary columns.', false, false, false, true, true, false, NULL),
    ('multi_column_editor', 'Rename, remove, reorder columns, or remove duplicate rows in the data.', false, false, false, false, false, false, NULL),
    ('enrich',              'Enrich data with another dataset and return columns from both datasets.', false, false, false, true, true, false, NULL),
    ('link',                'Join to another dataset and return the matching records of that dataset.', false, false, false, true, true, false, NULL),
    ('set_math',            'Keep, add, or remove rows based on external dataset.', false, true, false, false, false, false, NULL),
    ('join',                'Perform curated joins.', false, true, false, false, false, false, NULL),
    ('export',              'Export your final filtered set of observations to CSV or XLS.', false, false, false, false, false, false, NULL),
    ('reorder_columns',     'Reorder the columns in your table.', false, false, false, false, false, false, NULL),
    ('macro',               'Apply templatized transformations to your path.', false, false, false, false, false, false, NULL),
    ('sort',                'Sort the rows of data based on one or more columns.', false, false, false, false, false, false, NULL),
    ('calculation',         'Display multiple aggregate calculations.', true, false, true, false, false, false, NULL),
    ('unpivot',             'Reshape your data by turning some columns into rows.', false, false, false, true, false, false, NULL),
    ('map',                 'Display geographic data in layers, each with its own data source.', true, true, false, false, false, false,
      'outside the 25-row enumeration, from its own page (contour/boards-map); one source PER LAYER, so building it means N secondary inputs. The Text board is named by dashboards-getting-started and has no page of its own — named, not a row.')
  ) AS t(kind, description, visualize, filter_rows, aggregate, manipulate_columns,
         remove_duplicates, built, note)
$$;
COMMENT ON FUNCTION public.contour_board_kinds() IS
  'The 25 boards contour/boards-descriptions enumerates as headings plus Map from its own page, with the five capability flags of that page''s own summary matrix (Visualize / Filter Rows / Aggregate / Manipulate Columns / Remove Duplicates) — the adversary pass established the category is these five booleans, not a scalar. Five kinds are built — summary, filter, expression, table, histogram: filter, derive, see, count. The rest refuse by name, the seventh indexed catalogue.';

-- ── the analysis, a project resource ────────────────────────────────────────

CREATE TABLE public.contour_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CONTOUR_ANALYSIS is an attested resource TYPE (the filesystem API enum);
  -- the RID token is INFERENCE — no ri.contour.* appears in the mirror
  rid             text GENERATED ALWAYS AS (public.rid_of('contour', 'analysis', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "name the dashboard" — the one dashboard's name lives on the analysis,
  -- because the API publishes no CONTOUR_DASHBOARD resource
  dashboard_name  text NOT NULL DEFAULT 'Untitled dashboard',
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contour_analyses_rid_key ON public.contour_analyses (rid);
CREATE INDEX contour_analyses_project_idx ON public.contour_analyses (project_id);
CREATE INDEX contour_analyses_folder_idx ON public.contour_analyses (folder_id);
CREATE INDEX contour_analyses_org_idx ON public.contour_analyses (organization_id);
CREATE INDEX contour_analyses_created_by_idx ON public.contour_analyses (created_by);
COMMENT ON TABLE public.contour_analyses IS
  'A Contour analysis: paths of boards over datasets, with exactly one dashboard — the filesystem API enumerates CONTOUR_ANALYSIS and no CONTOUR_DASHBOARD, so the dashboard''s name is a column here and its structure hangs off the analysis (704). The RID kind token is INFERENCE: no ri.contour.* is attested anywhere in the mirror.';

-- ── the path: an ordered spine with a four-kind head ────────────────────────

CREATE TABLE public.contour_paths (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           uuid NOT NULL REFERENCES public.contour_analyses(id) ON DELETE CASCADE,
  name                  text NOT NULL DEFAULT 'New path',
  position              integer NOT NULL DEFAULT 0,
  -- the four documented head kinds; virtual tables are not built here and
  -- their absence is the recorded gap, not a fourth column
  head_dataset_id         uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  head_path_id            uuid REFERENCES public.contour_paths(id) ON DELETE CASCADE,
  head_restricted_view_id uuid REFERENCES public.restricted_views(id) ON DELETE CASCADE,
  -- "Contour allows you to start an analysis with a previous version of your
  -- dataset" — the version selector's pin; refresh moves it to latest
  pinned_transaction_id uuid REFERENCES public.dataset_transactions(id) ON DELETE SET NULL,
  created_by            uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(head_dataset_id, head_path_id, head_restricted_view_id) = 1)
);
CREATE INDEX contour_paths_analysis_idx ON public.contour_paths (analysis_id);
CREATE INDEX contour_paths_head_dataset_idx ON public.contour_paths (head_dataset_id);
CREATE INDEX contour_paths_head_path_idx ON public.contour_paths (head_path_id);
CREATE INDEX contour_paths_head_rv_idx ON public.contour_paths (head_restricted_view_id);
CREATE INDEX contour_paths_pin_idx ON public.contour_paths (pinned_transaction_id);
CREATE INDEX contour_paths_created_by_idx ON public.contour_paths (created_by);
COMMENT ON TABLE public.contour_paths IS
  'One analytical path: "Each Contour path should begin with a particular dataset" (contour/core-concepts) — or another path''s result ("Results from a path in the current analysis", contour/analysis-create-path) or a restricted view (which datasets-save refuses to save, enforced in 705). A virtual-table head is the recorded unbuilt fourth kind. The pinned transaction is the version selector; "there is no way to automatically update a Contour analysis path" (contour/faq), so refresh_path moves it by hand.';

-- a path may not head at itself, transitively — the common-input DAG stays
-- acyclic, and a head must live in the same analysis
CREATE FUNCTION public.guard_contour_path_head()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.head_path_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.head_path_id = NEW.id THEN
    RAISE EXCEPTION 'Contour:PathCycle — a path cannot begin at its own result';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contour_paths p
                  WHERE p.id = NEW.head_path_id AND p.analysis_id = NEW.analysis_id) THEN
    RAISE EXCEPTION 'Contour:HeadOutsideAnalysis — a path begins at a result from the current analysis';
  END IF;
  IF EXISTS (
    WITH RECURSIVE up(id) AS (
      SELECT NEW.head_path_id
      UNION
      SELECT p.head_path_id FROM public.contour_paths p
        JOIN up u ON u.id = p.id WHERE p.head_path_id IS NOT NULL)
    SELECT 1 FROM up WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Contour:PathCycle — that head would make the path graph circular';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_contour_path_head
  BEFORE INSERT OR UPDATE OF head_path_id ON public.contour_paths
  FOR EACH ROW EXECUTE FUNCTION public.guard_contour_path_head();

-- ── the board ───────────────────────────────────────────────────────────────

CREATE TABLE public.contour_boards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id       uuid NOT NULL REFERENCES public.contour_paths(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  kind          text NOT NULL,
  title         text NOT NULL DEFAULT '',
  -- "This will leave the board visible in your path, but the filter won't be applied to the data."
  -- — docs/foundry-deep-dives/text/07-contour/filtering-data.txt
  enabled       boolean NOT NULL DEFAULT true,
  -- the switch-to-aggregated option; guarded to aggregating kinds below
  pivoted       boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- the board's interactive selection (a histogram bar, a grid cell…), typed
  -- per kind by the surface; the compiler reads it as a filter
  selection     jsonb,
  -- the SECONDARY input of join-class boards — a dataset or another path
  input_dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  input_path_id    uuid REFERENCES public.contour_paths(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(configuration) = 'object'),
  CHECK (num_nonnulls(input_dataset_id, input_path_id) <= 1)
);
CREATE INDEX contour_boards_path_idx ON public.contour_boards (path_id, position);
CREATE INDEX contour_boards_input_ds_idx ON public.contour_boards (input_dataset_id);
CREATE INDEX contour_boards_input_path_idx ON public.contour_boards (input_path_id);
COMMENT ON TABLE public.contour_boards IS
  'One board: kind (a contour_board_kinds row), position (the primary input — the board above), configuration, an optional typed selection, and for join-class boards an optional SECONDARY input, dataset or path — "The Data source represents the dataset or Contour path that the layer will use" (contour/boards-map). enabled=false leaves it visible but unapplied; pivoted switches every board below onto this board''s aggregate output (contour/analysis-switch-aggregated).';

CREATE FUNCTION public.guard_contour_board()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM public.contour_board_kinds() ck WHERE ck.kind = NEW.kind;
  IF k.kind IS NULL THEN
    RAISE EXCEPTION 'Contour:UnknownBoardKind — % is not a board Contour documents', NEW.kind;
  END IF;
  IF NOT k.built THEN
    RAISE EXCEPTION 'Contour:BoardNotBuilt — % is a Contour board this platform has not built', NEW.kind;
  END IF;
  -- "Some boards that allow you to calculate aggregate metrics have an
  -- option to pivot" — only those
  IF NEW.pivoted AND NOT k.aggregate THEN
    RAISE EXCEPTION 'Contour:CannotPivot — % does not calculate aggregate metrics, so it has no pivot option', NEW.kind;
  END IF;
  -- a secondary path input stays inside the analysis and acyclic through
  -- the path graph
  IF NEW.input_path_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.contour_paths p
                    JOIN public.contour_paths mine ON mine.id = NEW.path_id
                   WHERE p.id = NEW.input_path_id
                     AND p.analysis_id = mine.analysis_id) THEN
      RAISE EXCEPTION 'Contour:InputOutsideAnalysis — a board joins to a path of the current analysis';
    END IF;
    IF NEW.input_path_id = NEW.path_id THEN
      RAISE EXCEPTION 'Contour:PathCycle — a board cannot take its own path as input';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_contour_board
  BEFORE INSERT OR UPDATE OF kind, pivoted, input_path_id ON public.contour_boards
  FOR EACH ROW EXECUTE FUNCTION public.guard_contour_board();

-- ── RLS: the project decides, composed ──────────────────────────────────────

ALTER TABLE public.contour_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contour_paths    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contour_boards   ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_contour_analysis(p_analysis uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.contour_analyses a
                  WHERE a.id = p_analysis
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(a.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_contour_analysis(p_analysis uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.contour_analyses a
                  WHERE a.id = p_analysis
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(a.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_contour_analysis(uuid) IS
  'Editor on the analysis'' project edits it — the application-resource floor, composed from the project role like every application here.';

CREATE POLICY "project members read analyses" ON public.contour_analyses
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author analyses" ON public.contour_analyses
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read paths" ON public.contour_paths
  FOR SELECT USING ((SELECT public.can_read_contour_analysis(analysis_id)));
CREATE POLICY "author paths" ON public.contour_paths
  FOR ALL USING ((SELECT public.can_edit_contour_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_contour_analysis(analysis_id)));

CREATE POLICY "read boards" ON public.contour_boards
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.contour_paths p
                             WHERE p.id = path_id
                               AND public.can_read_contour_analysis(p.analysis_id)));
CREATE POLICY "author boards" ON public.contour_boards
  FOR ALL USING (EXISTS (SELECT 1 FROM public.contour_paths p
                          WHERE p.id = path_id
                            AND public.can_edit_contour_analysis(p.analysis_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contour_paths p
                       WHERE p.id = path_id
                         AND public.can_edit_contour_analysis(p.analysis_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_paths    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_boards   TO authenticated;

-- ── creation and refresh ────────────────────────────────────────────────────

CREATE FUNCTION public.create_contour_analysis(p_project uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE a uuid;
BEGIN
  INSERT INTO public.contour_analyses (project_id, name)
  VALUES (p_project, p_name) RETURNING id INTO a;
  RETURN a;
END $$;
COMMENT ON FUNCTION public.create_contour_analysis(uuid, text) IS
  'Creates an analysis with no paths yet — "+Create a new path" is the next documented step (contour/analysis-create-path). INVOKER.';

CREATE FUNCTION public.refresh_contour_path(p_path uuid)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE p record; head uuid;
BEGIN
  SELECT * INTO p FROM public.contour_paths WHERE id = p_path;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Contour:NoSuchPath — % is not a path you can see', p_path;
  END IF;
  IF p.head_dataset_id IS NULL THEN
    -- a path-headed or restricted-view-headed path has no pin of its own
    UPDATE public.contour_paths SET pinned_transaction_id = NULL WHERE id = p_path;
    RETURN NULL;
  END IF;
  SELECT b.head_transaction_id INTO head
    FROM public.dataset_branches b
   WHERE b.dataset_id = p.head_dataset_id AND b.name = 'master';
  UPDATE public.contour_paths SET pinned_transaction_id = head WHERE id = p_path;
  RETURN head;
END $$;
COMMENT ON FUNCTION public.refresh_contour_path(uuid) IS
  '"You can also refresh a path from your analysis to get the latest version of its underlying datasets" (contour/core-concepts) — and nothing refreshes it automatically: "there is no way to automatically update a Contour analysis path; this must be completed manually" (contour/faq). Moves the pin to the head transaction. INVOKER.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid;
  p1 uuid; p2 uuid; p3 uuid; b1 uuid; ds uuid; ds2 uuid; br uuid; txn uuid;
  rv uuid; got uuid; n integer;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ct-703') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ct-703') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct703@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ct703@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ct_703', 'CT 703') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'trips_703', 'trips_703') RETURNING id INTO ds;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'zones_703', 'zones_703') RETURNING id INTO ds2;

    -- 1. The catalogue is the page's matrix: 26 rows, five built, and the
    --    aggregate flag marks exactly the four the page marks plus none.
    SELECT count(*) INTO n FROM public.contour_board_kinds();
    IF n <> 26 THEN RAISE EXCEPTION 'the catalogue holds % kinds, not 26', n; END IF;
    SELECT count(*) INTO n FROM public.contour_board_kinds() k WHERE k.built;
    IF n <> 5 THEN RAISE EXCEPTION '% kinds claim built, not 5', n; END IF;
    SELECT count(*) INTO n FROM public.contour_board_kinds() k WHERE k.aggregate;
    IF n <> 4 THEN RAISE EXCEPTION '% kinds aggregate; the page marks 4', n; END IF;

    -- 2. An analysis, a dataset-headed path, boards in order.
    SELECT public.create_contour_analysis(proj, 'Taxi analysis') INTO a;
    INSERT INTO public.contour_paths (analysis_id, name, head_dataset_id)
    VALUES (a, 'Main path', ds) RETURNING id INTO p1;
    INSERT INTO public.contour_boards (path_id, position, kind, configuration)
    VALUES (p1, 0, 'filter', '{"mode": "keep", "column": "fare", "op": ">=", "value": 10}'::jsonb)
    RETURNING id INTO b1;
    INSERT INTO public.contour_boards (path_id, position, kind) VALUES (p1, 1, 'table');

    -- 3. An unbuilt kind refuses BY NAME; an invented one refuses too.
    BEGIN
      INSERT INTO public.contour_boards (path_id, position, kind) VALUES (p1, 2, 'heatmap');
      RAISE EXCEPTION 'an unbuilt board kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:BoardNotBuilt%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.contour_boards (path_id, position, kind) VALUES (p1, 2, 'wordcloud');
      RAISE EXCEPTION 'an undocumented board kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:UnknownBoardKind%' THEN RAISE; END IF;
    END;

    -- 4. Pivot is only for aggregating kinds: histogram may, filter may not.
    INSERT INTO public.contour_boards (path_id, position, kind, pivoted, configuration)
    VALUES (p1, 2, 'histogram', true, '{"bucket_column": "city"}'::jsonb);
    BEGIN
      UPDATE public.contour_boards SET pivoted = true WHERE id = b1;
      RAISE EXCEPTION 'a filter board pivoted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:CannotPivot%' THEN RAISE; END IF;
    END;

    -- 5. Paths fan out and stay acyclic: p2 heads at p1's result, p1 may not
    --    then head at p2.
    INSERT INTO public.contour_paths (analysis_id, name, head_path_id, position)
    VALUES (a, 'Downstream', p1, 1) RETURNING id INTO p2;
    BEGIN
      UPDATE public.contour_paths SET head_dataset_id = NULL, head_path_id = p2 WHERE id = p1;
      RAISE EXCEPTION 'a path cycle was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:PathCycle%' THEN RAISE; END IF;
    END;

    -- 6. A board's secondary input must be a path of the SAME analysis.
    INSERT INTO public.contour_analyses (project_id, name) VALUES (proj, 'Other') RETURNING id INTO got;
    INSERT INTO public.contour_paths (analysis_id, name, head_dataset_id)
    VALUES (got, 'Foreign', ds2) RETURNING id INTO p3;
    BEGIN
      INSERT INTO public.contour_boards (path_id, position, kind, input_path_id)
      VALUES (p1, 3, 'filter', p3);
      RAISE EXCEPTION 'a foreign-analysis input was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:InputOutsideAnalysis%' THEN RAISE; END IF;
    END;

    -- 7. A restricted-view head is legal (saving it is 705's refusal). The
    --    policy grammar validates columns against the backing dataset, so the
    --    dataset gets its schema first.
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ds, txn, '[{"name": "owner_id", "type": "STRING"}, {"name": "fare", "type": "DOUBLE"}]'::jsonb);
    PERFORM public.commit_transaction(txn);
    INSERT INTO public.restricted_views (organization_id, project_id, input_dataset_id,
                                         api_name, name, policy)
    VALUES (org, proj, ds, 'rv_703', 'RV 703',
      '{"match": "all", "rules": [{"left": {"user_attribute": "user_id"}, "comparison": "equal", "right": {"column": "owner_id"}}]}'::jsonb)
    RETURNING id INTO rv;
    INSERT INTO public.contour_paths (analysis_id, name, head_restricted_view_id, position)
    VALUES (a, 'Guarded', rv, 2);

    -- 8. Refresh pins the head transaction; there is nothing automatic.
    SELECT public.refresh_contour_path(p1) INTO got;
    IF got IS DISTINCT FROM txn THEN
      RAISE EXCEPTION 'refresh did not pin the head transaction';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '703 proved, as the caller: the catalogue is the page''s 26-row five-flag matrix with five built and four aggregating; boards order under a path; an unbuilt and an unknown kind refuse by name; pivot is only for aggregating kinds; paths fan out from a path result and a cycle refuses; a board''s secondary input may not leave the analysis; a restricted-view head is legal; and refresh pins the head transaction by hand';
  END;
END $$;
