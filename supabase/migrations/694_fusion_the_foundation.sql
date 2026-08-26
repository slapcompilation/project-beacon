-- 694: Fusion — sheets, cells, table regions, and the sync that makes a
-- dataset.
--
--   "**Fusion** is a spreadsheet application for Foundry."
--   — fusion/overview.md
--
-- THE SYNC IS THE POINT. A spreadsheet here earns its place by producing a
-- dataset other applications consume:
--
--   "Fusion allows you to create datasets based on your spreadsheets. You can either sync a whole sheet to a dataset or select a table range to be synced. After the data is successfully synced to a dataset in Foundry, the data will be available for consumption by other applications, such as Contour."
--   — fusion/sync-table-dataset.md
--
--   "Once you sync a table range to a dataset, any changes made to that table range will trigger a build and be reflected in its associated dataset as long as you have at least `Editor` permissions on the associated dataset. As you edit the table range, you may see a number of finished and aborted transactions on the dataset."
--   — fusion/sync-table-dataset.md
--
-- which is our dataset engine's own shape: a transaction on a branch, a
-- schema, a file, a commit, a materialise. And the exclusivity is a rule:
--
--   "You may only use one type of sync within a Fusion sheet: a sheet sync, or a table sync. Using both types is not allowed as it would cause overlaps in dataset syncs."
--   — fusion/sync-table-dataset.md
--
-- A SORT IS A MUTATION, NOT A VIEW, and the page is emphatic:
--
--   "Sorting in Fusion works differently from other spreadsheet tools that you may have used. Rather than simply presenting a sorted view of the data, performing a sort in Fusion actually rearranges the rows in a sheet so that the cells are in a sorted order."
--   — fusion/create-use-table-regions.md
--
-- so sort_table_region rewrites cells. Storing an order instead would be a
-- quiet divergence nobody notices until their data is in an order they did
-- not expect.
--
-- FORMULAS ARE STORED, NOT EVALUATED, and the number is the reason: the
-- function library holds 202 functions across five categories (Core,
-- Action, Validation, Chart, Time series). A cell keeps what was typed and
-- the surface renders it; nothing computes. That is the widget-catalogue
-- decision again — an indexed backlog beats 202 stubs — and the surface
-- says so rather than looking broken.
--
-- Fusion is NOT sunset, checked at product level unlike Forms, Reports and
-- Data prep. Its overview does steer ontology writeback elsewhere —
-- "If you are adding data to the Ontology, consider using Actions" — so
-- nothing here writes objects.

CREATE TABLE public.fusion_spreadsheets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('fusion', 'spreadsheet', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fusion_spreadsheets_rid_key ON public.fusion_spreadsheets (rid);
CREATE INDEX fusion_spreadsheets_project_idx ON public.fusion_spreadsheets (project_id);
CREATE INDEX fusion_spreadsheets_folder_idx ON public.fusion_spreadsheets (folder_id);
CREATE INDEX fusion_spreadsheets_org_idx ON public.fusion_spreadsheets (organization_id);
CREATE INDEX fusion_spreadsheets_created_by_idx ON public.fusion_spreadsheets (created_by);
COMMENT ON TABLE public.fusion_spreadsheets IS
  'A Fusion spreadsheet (fusion/overview): sheets of cells whose table regions sync to datasets other applications consume. A project resource.';

CREATE TABLE public.fusion_sheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id uuid NOT NULL REFERENCES public.fusion_spreadsheets(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(btrim(name)) > 0),
  position       integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX fusion_sheets_name_key ON public.fusion_sheets (spreadsheet_id, lower(name));
CREATE INDEX fusion_sheets_spreadsheet_idx ON public.fusion_sheets (spreadsheet_id);
COMMENT ON TABLE public.fusion_sheets IS
  'One sheet of a spreadsheet. Names are unique per spreadsheet because a reference names one: "Cell references work as one would expect (e.g `=A1`, `=A1:A3`, `=Sheet2!A1:A3`)" (fusion/sheets-overview).';

CREATE FUNCTION public.fusion_cell_types()
RETURNS TABLE (cell_type text, example text)
LANGUAGE sql IMMUTABLE AS $$
  -- the seven fusion/sheets-overview enumerates, with its own examples
  SELECT * FROM (VALUES
    ('string',    'Fusion, or =''Fusion'' — Fusion uses single quotes for strings'),
    ('number',    '12, or =12'),
    ('date',      '2013-02-18, or =date(2013, 2, 18)'),
    ('timestamp', '2013-02-18 00:00:00'),
    ('boolean',   '=true'),
    ('array',     '=array(1, 2)'),
    ('null',      '=null')
  ) AS t(cell_type, example)
$$;
COMMENT ON FUNCTION public.fusion_cell_types() IS
  'The cell types fusion/sheets-overview lists as the most common, with the page''s own examples. Note the platform''s own quirk, kept: Fusion uses single quotes for strings, not double.';

CREATE TABLE public.fusion_cells (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id  uuid NOT NULL REFERENCES public.fusion_sheets(id) ON DELETE CASCADE,
  -- a cell is addressed by numbers; A1 is a rendering, not a stored string
  row_index integer NOT NULL CHECK (row_index >= 0),
  col_index integer NOT NULL CHECK (col_index >= 0),
  -- what the author typed, kept as typed: that is what makes it editable
  raw       text NOT NULL DEFAULT '',
  cell_type text NOT NULL DEFAULT 'string',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fusion_cells_address_key
  ON public.fusion_cells (sheet_id, row_index, col_index);
COMMENT ON TABLE public.fusion_cells IS
  'One cell, addressed by row and column. Stores what was typed rather than only a computed value, because that is what a spreadsheet edits. A raw beginning with = is a formula, STORED AND NOT EVALUATED — the function library holds 202 functions and this arc builds none of them (694''s header).';
COMMENT ON COLUMN public.fusion_cells.raw IS
  'The cell''s input exactly as typed. "Type `=` into any cell to use a formula" (fusion/formulas-overview); a formula is kept and rendered, never computed here.';

CREATE FUNCTION public.guard_cell_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fusion_cell_types() t WHERE t.cell_type = NEW.cell_type) THEN
    RAISE EXCEPTION 'Fusion:UnknownCellType — % is not one of the cell types Fusion names', NEW.cell_type;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_cell_type
  BEFORE INSERT OR UPDATE OF cell_type ON public.fusion_cells
  FOR EACH ROW EXECUTE FUNCTION public.guard_cell_type();

CREATE TABLE public.fusion_table_regions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id   uuid NOT NULL REFERENCES public.fusion_sheets(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  -- the region's bounds; a table enforces a strictly tabular format
  top_row    integer NOT NULL CHECK (top_row >= 0),
  left_col   integer NOT NULL CHECK (left_col >= 0),
  row_count  integer NOT NULL CHECK (row_count > 0),
  -- "allow you to assign column headers, refer to columns by column names"
  columns    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- where this region syncs, when it does
  dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL,
  CHECK (jsonb_typeof(columns) = 'array')
);
CREATE UNIQUE INDEX fusion_table_regions_name_key
  ON public.fusion_table_regions (sheet_id, lower(name));
CREATE INDEX fusion_table_regions_sheet_idx ON public.fusion_table_regions (sheet_id);
CREATE INDEX fusion_table_regions_dataset_idx ON public.fusion_table_regions (dataset_id);
COMMENT ON TABLE public.fusion_table_regions IS
  'A table over a region — "table regions enforce a strictly tabular format to a region and allow you to assign column headers, refer to columns by column names (vs cell references), sort the rows by any column" (fusion/create-use-table-regions). Its columns carry the names and the export types the author picks.';

-- "You may only use one type of sync within a Fusion sheet: a sheet sync,
-- or a table sync." One synced region per sheet holds that here, since a
-- sheet sync is one region covering the sheet.
CREATE UNIQUE INDEX fusion_one_sync_per_sheet
  ON public.fusion_table_regions (sheet_id) WHERE dataset_id IS NOT NULL;

-- ── the sort, which mutates ─────────────────────────────────────────────────

CREATE FUNCTION public.sort_table_region(p_region uuid, p_column integer,
                                         p_descending boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r record; moved integer := 0;
BEGIN
  SELECT * INTO r FROM public.fusion_table_regions WHERE id = p_region;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Fusion:RegionNotFound — % is not a table region you can see', p_region;
  END IF;
  IF p_column < 0 OR p_column >= jsonb_array_length(r.columns) THEN
    RAISE EXCEPTION 'Fusion:NoSuchColumn — the region has % column(s)', jsonb_array_length(r.columns);
  END IF;

  -- The rows in their new order, by the sort column's raw value. The header
  -- row stays put: only the body is rearranged.
  CREATE TEMP TABLE _order ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY key.raw ASC) - 1 AS new_offset,
         src.offset_in_region
    FROM (SELECT generate_series(1, r.row_count - 1) AS offset_in_region) src
    LEFT JOIN LATERAL (
      SELECT c.raw FROM public.fusion_cells c
       WHERE c.sheet_id = r.sheet_id
         AND c.row_index = r.top_row + src.offset_in_region
         AND c.col_index = r.left_col + p_column) key ON true;
  IF p_descending THEN
    UPDATE _order SET new_offset = (r.row_count - 2) - new_offset;
  END IF;

  -- Rewrite the cells: a sort here IS the rearrangement, so the rows move.
  CREATE TEMP TABLE _moved ON COMMIT DROP AS
  SELECT o.new_offset, c.col_index, c.raw, c.cell_type
    FROM _order o
    JOIN public.fusion_cells c
      ON c.sheet_id = r.sheet_id
     AND c.row_index = r.top_row + o.offset_in_region;

  DELETE FROM public.fusion_cells c
   WHERE c.sheet_id = r.sheet_id
     AND c.row_index > r.top_row
     AND c.row_index < r.top_row + r.row_count;

  INSERT INTO public.fusion_cells (sheet_id, row_index, col_index, raw, cell_type)
  SELECT r.sheet_id, r.top_row + 1 + m.new_offset, m.col_index, m.raw, m.cell_type
    FROM _moved m;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END $$;
COMMENT ON FUNCTION public.sort_table_region(uuid, integer, boolean) IS
  'Sorts a table region by REARRANGING ITS CELLS, because that is what Fusion does: "performing a sort in Fusion actually rearranges the rows in a sheet so that the cells are in a sorted order ... a sort in Fusion cannot be turned off to return to the original ordering" (fusion/create-use-table-regions). Storing an order instead would be a quiet divergence.';

-- ── the sync, which makes a dataset ─────────────────────────────────────────

CREATE FUNCTION public.sync_table_region(p_region uuid)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  r record; sheet record; sh record; ds uuid; txn uuid; br uuid;
  fields jsonb; rows_written integer;
BEGIN
  SELECT * INTO r FROM public.fusion_table_regions WHERE id = p_region;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Fusion:RegionNotFound — % is not a table region you can see', p_region;
  END IF;
  IF r.dataset_id IS NULL THEN
    RAISE EXCEPTION 'Fusion:RegionNotSynced — this region names no dataset to sync to';
  END IF;
  IF jsonb_array_length(r.columns) = 0 THEN
    RAISE EXCEPTION 'Fusion:NoColumns — a synced region names its columns and their types';
  END IF;
  ds := r.dataset_id;

  -- "as long as you have at least `Editor` permissions on the associated
  -- dataset" — composed, not restated
  IF NOT EXISTS (SELECT 1 FROM public.datasets d
                  WHERE d.id = ds
                    AND public.role_rank(public.project_role(d.project_id))
                        >= public.role_rank('editor')) THEN
    RAISE EXCEPTION 'Fusion:NotAnEditor — syncing a region needs at least Editor on the dataset';
  END IF;

  -- the schema the region's column headers and chosen types declare
  SELECT jsonb_agg(jsonb_build_object(
           'name', col ->> 'name',
           'type', upper(coalesce(col ->> 'type', 'STRING'))))
    INTO fields
    FROM jsonb_array_elements(r.columns) col;

  SELECT id INTO br FROM public.dataset_branches
   WHERE dataset_id = ds AND name = 'master';
  IF br IS NULL THEN
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master')
    RETURNING id INTO br;
  END IF;

  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status)
  VALUES (ds, br, 'SNAPSHOT', 'OPEN') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, fields);

  SELECT greatest(r.row_count - 1, 0) INTO rows_written;
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, format('fusion/%s.csv', r.name), rows_written);

  PERFORM public.commit_transaction(txn);
  PERFORM public.dataset_materialize(ds, txn);
  RETURN txn;
END $$;
COMMENT ON FUNCTION public.sync_table_region(uuid) IS
  'Syncs a table region to its dataset as a transaction — "any changes made to that table range will trigger a build and be reflected in its associated dataset ... you may see a number of finished and aborted transactions" (fusion/sync-table-dataset). The schema comes from the region''s column headers and their chosen export types; Editor on the dataset is required, as the page says.';

-- ── permissions: the project resource shape ─────────────────────────────────

ALTER TABLE public.fusion_spreadsheets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_sheets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_cells          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_table_regions  ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_spreadsheet(p_sheet uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.fusion_spreadsheets s
                  WHERE s.id = p_sheet
                    AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(s.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_spreadsheet(p_sheet uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.fusion_spreadsheets s
                  WHERE s.id = p_sheet
                    AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(s.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_spreadsheet(uuid) IS
  'Editor edits a spreadsheet, the floor every application resource here uses. The dataset sync asks its own question separately, because the page permissions the DATASET rather than the sheet.';

CREATE POLICY "project members read spreadsheets" ON public.fusion_spreadsheets
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author spreadsheets" ON public.fusion_spreadsheets
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read sheets" ON public.fusion_sheets
  FOR SELECT USING ((SELECT public.can_read_spreadsheet(spreadsheet_id)));
CREATE POLICY "author sheets" ON public.fusion_sheets
  FOR ALL USING ((SELECT public.can_edit_spreadsheet(spreadsheet_id)))
          WITH CHECK ((SELECT public.can_edit_spreadsheet(spreadsheet_id)));

CREATE POLICY "read cells" ON public.fusion_cells
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.fusion_sheets s
                             WHERE s.id = sheet_id
                               AND public.can_read_spreadsheet(s.spreadsheet_id)));
CREATE POLICY "author cells" ON public.fusion_cells
  FOR ALL USING (EXISTS (SELECT 1 FROM public.fusion_sheets s
                          WHERE s.id = sheet_id
                            AND public.can_edit_spreadsheet(s.spreadsheet_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fusion_sheets s
                       WHERE s.id = sheet_id
                         AND public.can_edit_spreadsheet(s.spreadsheet_id)));

CREATE POLICY "read regions" ON public.fusion_table_regions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.fusion_sheets s
                             WHERE s.id = sheet_id
                               AND public.can_read_spreadsheet(s.spreadsheet_id)));
CREATE POLICY "author regions" ON public.fusion_table_regions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.fusion_sheets s
                          WHERE s.id = sheet_id
                            AND public.can_edit_spreadsheet(s.spreadsheet_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fusion_sheets s
                       WHERE s.id = sheet_id
                         AND public.can_edit_spreadsheet(s.spreadsheet_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fusion_spreadsheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fusion_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fusion_cells TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fusion_table_regions TO authenticated;

CREATE FUNCTION public.create_spreadsheet(p_project uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE s uuid;
BEGIN
  INSERT INTO public.fusion_spreadsheets (project_id, name)
  VALUES (p_project, p_name) RETURNING id INTO s;
  INSERT INTO public.fusion_sheets (spreadsheet_id, name, position)
  VALUES (s, 'Sheet1', 0);
  RETURN s;
END $$;
COMMENT ON FUNCTION public.create_spreadsheet(uuid, text) IS
  'Creates a spreadsheet with its first sheet. INVOKER, so the spreadsheet''s own policy decides who may.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; wb uuid; sh uuid; reg uuid; ds uuid; txn uuid;
  n integer; v text; u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('fus-694') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('fus-694') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fus694@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'fus694@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'fus_694', 'Fusion 694') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- 1. A spreadsheet starts with a sheet, and carries a fusion RID.
    SELECT public.create_spreadsheet(proj, 'Trip log') INTO wb;
    SELECT id INTO sh FROM public.fusion_sheets WHERE spreadsheet_id = wb;
    IF sh IS NULL THEN RAISE EXCEPTION 'a new spreadsheet has no sheet'; END IF;
    IF (SELECT s.rid FROM public.fusion_spreadsheets s WHERE s.id = wb)
       NOT LIKE 'ri.fusion.main.spreadsheet.%' THEN
      RAISE EXCEPTION 'the spreadsheet rid does not follow the grammar';
    END IF;

    -- 2. Cells take the types Fusion names, and only those.
    INSERT INTO public.fusion_cells (sheet_id, row_index, col_index, raw, cell_type) VALUES
      (sh, 0, 0, 'city',   'string'), (sh, 0, 1, 'miles',  'string'),
      (sh, 1, 0, 'Cairo',  'string'), (sh, 1, 1, '30',     'number'),
      (sh, 2, 0, 'Aachen', 'string'), (sh, 2, 1, '10',     'number'),
      (sh, 3, 0, 'Bern',   'string'), (sh, 3, 1, '20',     'number');
    BEGIN
      INSERT INTO public.fusion_cells (sheet_id, row_index, col_index, raw, cell_type)
      VALUES (sh, 9, 9, 'x', 'currency');
      RAISE EXCEPTION 'an unknown cell type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:UnknownCellType%' THEN RAISE; END IF;
    END;

    -- 3. A formula is STORED, not computed.
    INSERT INTO public.fusion_cells (sheet_id, row_index, col_index, raw, cell_type)
    VALUES (sh, 4, 1, '=sum(B2:B4)', 'string');
    SELECT c.raw INTO v FROM public.fusion_cells c
     WHERE c.sheet_id = sh AND c.row_index = 4 AND c.col_index = 1;
    IF v <> '=sum(B2:B4)' THEN RAISE EXCEPTION 'the formula was not kept as typed'; END IF;

    -- 4. A SORT REARRANGES THE CELLS — the page's own emphasis.
    INSERT INTO public.fusion_table_regions (sheet_id, name, top_row, left_col, row_count, columns)
    VALUES (sh, 'trips', 0, 0, 4,
            '[{"name":"city","type":"STRING"},{"name":"miles","type":"INTEGER"}]'::jsonb)
    RETURNING id INTO reg;
    PERFORM public.sort_table_region(reg, 0);
    SELECT c.raw INTO v FROM public.fusion_cells c
     WHERE c.sheet_id = sh AND c.row_index = 1 AND c.col_index = 0;
    IF v <> 'Aachen' THEN
      RAISE EXCEPTION 'the sort did not rearrange the cells, first row is %', v;
    END IF;
    SELECT c.raw INTO v FROM public.fusion_cells c
     WHERE c.sheet_id = sh AND c.row_index = 1 AND c.col_index = 1;
    IF v <> '10' THEN RAISE EXCEPTION 'the sort moved a column out of step with its row'; END IF;
    -- the header stayed put
    SELECT c.raw INTO v FROM public.fusion_cells c
     WHERE c.sheet_id = sh AND c.row_index = 0 AND c.col_index = 0;
    IF v <> 'city' THEN RAISE EXCEPTION 'the sort moved the header row'; END IF;

    -- 5. A column the region does not have refuses.
    BEGIN
      PERFORM public.sort_table_region(reg, 5);
      RAISE EXCEPTION 'a sort on a missing column was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:NoSuchColumn%' THEN RAISE; END IF;
    END;

    -- 6. THE SYNC: a region becomes a dataset, as a committed transaction.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'trips_from_fusion', 'trips_from_fusion') RETURNING id INTO ds;
    BEGIN
      PERFORM public.sync_table_region(reg);
      RAISE EXCEPTION 'an unsynced region was synced';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:RegionNotSynced%' THEN RAISE; END IF;
    END;
    UPDATE public.fusion_table_regions SET dataset_id = ds WHERE id = reg;
    SELECT public.sync_table_region(reg) INTO txn;
    IF (SELECT t.status FROM public.dataset_transactions t WHERE t.id = txn) <> 'COMMITTED' THEN
      RAISE EXCEPTION 'the sync did not commit its transaction';
    END IF;
    SELECT count(*) INTO n FROM public.dataset_schemas WHERE transaction_id = txn;
    IF n <> 1 THEN RAISE EXCEPTION 'the sync wrote no schema'; END IF;
    IF (SELECT d.physical_table FROM public.datasets d WHERE d.id = ds) IS NULL THEN
      RAISE EXCEPTION 'the sync did not materialise the dataset';
    END IF;

    -- 7. One sync per sheet: "a sheet sync, or a table sync", never both.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'second_output', 'second_output') RETURNING id INTO ds;
    BEGIN
      INSERT INTO public.fusion_table_regions
        (sheet_id, name, top_row, left_col, row_count, columns, dataset_id)
      VALUES (sh, 'other', 10, 0, 2, '[{"name":"x","type":"STRING"}]'::jsonb, ds);
      RAISE EXCEPTION 'a second synced region on one sheet was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '694 proved: a spreadsheet opens with a sheet and a fusion RID, cells take only the types Fusion names, a formula is stored as typed and not computed, a sort REARRANGES the cells while leaving the header, a missing sort column refuses, a synced region commits a transaction with a schema and materialises the dataset, and one sheet takes only one sync';
  END;
END $$;
