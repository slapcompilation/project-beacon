-- 695: many table syncs, or one sheet sync — not one sync per sheet.
--
-- The post-build reconciliation re-read sync-table-dataset whole and found
-- 694 STRICTER THAN FOUNDRY, which is the second time this session and the
-- same class as 691. 694 read this rule:
--
--   "You may only use one type of sync within a Fusion sheet: a sheet sync, or a table sync. Using both types is not allowed as it would cause overlaps in dataset syncs."
--   — fusion/sync-table-dataset.md
--
-- and enforced one synced REGION per sheet. But the page says plainly, two
-- sections later, that several table syncs on one sheet are fine:
--
--   "While you can use table range syncs to create multiple datasets from within one Fusion sheet, a sheet sync will create only one dataset for the whole sheet."
--   — fusion/sync-table-dataset.md
--
-- So the exclusivity is between the two KINDS, not between regions. A sheet
-- may have many table syncs, or exactly one sheet sync, and never both.
-- That is what sync_kind plus the two indexes below now say.
--
-- Recorded from the same re-read, not built: "Stop syncing" in the table
-- details window, and the fact that a sync is backed by a JOB SPEC on the
-- dataset — "Go to the dataset and delete the job spec by navigating
-- through the following: **Details tab > Job spec > Edit > Delete**" — which
-- is the same job_specs our transforms publish into, and a connection worth
-- making when a Fusion sync becomes rebuildable rather than one-shot.

ALTER TABLE public.fusion_table_regions
  ADD COLUMN sync_kind text NOT NULL DEFAULT 'table'
    CONSTRAINT fusion_regions_sync_kind_check
    CHECK (sync_kind = ANY (ARRAY['table', 'sheet']));
COMMENT ON COLUMN public.fusion_table_regions.sync_kind IS
  'Which kind of sync this region is: a table range sync, of which a sheet may have many, or the sheet sync, of which it may have exactly one and no table syncs beside it (fusion/sync-table-dataset).';
COMMENT ON CONSTRAINT fusion_regions_sync_kind_check ON public.fusion_table_regions IS
  'Values from fusion/sync-table-dataset, which names both and no third: "You may only use one type of sync within a Fusion sheet: a sheet sync, or a table sync."';

-- 694's index said one synced region per sheet. Wrong: that is the rule for
-- SHEET syncs alone.
DROP INDEX public.fusion_one_sync_per_sheet;

-- at most one sheet sync per sheet
CREATE UNIQUE INDEX fusion_one_sheet_sync
  ON public.fusion_table_regions (sheet_id)
  WHERE dataset_id IS NOT NULL AND sync_kind = 'sheet';

-- "Using both types is not allowed" — a trigger, because the fact spans rows
CREATE FUNCTION public.guard_sync_kind_exclusivity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dataset_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.sync_kind = 'sheet' THEN
    IF EXISTS (SELECT 1 FROM public.fusion_table_regions r
                WHERE r.sheet_id = NEW.sheet_id AND r.id <> NEW.id
                  AND r.dataset_id IS NOT NULL AND r.sync_kind = 'table') THEN
      RAISE EXCEPTION 'Fusion:SyncKindsConflict — this sheet already has table syncs; you may only use one type of sync within a Fusion sheet';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.fusion_table_regions r
                WHERE r.sheet_id = NEW.sheet_id AND r.id <> NEW.id
                  AND r.dataset_id IS NOT NULL AND r.sync_kind = 'sheet') THEN
      RAISE EXCEPTION 'Fusion:SyncKindsConflict — this sheet is synced whole; you may only use one type of sync within a Fusion sheet';
    END IF;
  END IF;
  -- two regions may not target the SAME dataset, which would be the overlap
  -- the page warns about
  IF EXISTS (SELECT 1 FROM public.fusion_table_regions r
              WHERE r.dataset_id = NEW.dataset_id AND r.id <> NEW.id) THEN
    RAISE EXCEPTION 'Fusion:DatasetAlreadySynced — another region already syncs to that dataset';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_sync_kind_exclusivity
  BEFORE INSERT OR UPDATE OF dataset_id, sync_kind ON public.fusion_table_regions
  FOR EACH ROW EXECUTE FUNCTION public.guard_sync_kind_exclusivity();

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; wb uuid; sh uuid;
  r1 uuid; r2 uuid; d1 uuid; d2 uuid; d3 uuid;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('fus-695') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('fus-695') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fus695@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'fus695@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'fus_695', 'Fusion 695') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    SELECT public.create_spreadsheet(proj, 'Many syncs') INTO wb;
    SELECT id INTO sh FROM public.fusion_sheets WHERE spreadsheet_id = wb;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'out_one', 'out_one') RETURNING id INTO d1;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'out_two', 'out_two') RETURNING id INTO d2;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'out_three', 'out_three') RETURNING id INTO d3;

    -- 1. THE CORRECTION: two table syncs on one sheet are allowed, because
    --    "you can use table range syncs to create multiple datasets from
    --    within one Fusion sheet". 694 refused this.
    INSERT INTO public.fusion_table_regions
      (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
    VALUES (sh, 'first', 0, 0, 3, '[{"name":"a","type":"STRING"}]'::jsonb, d1, 'table')
    RETURNING id INTO r1;
    INSERT INTO public.fusion_table_regions
      (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
    VALUES (sh, 'second', 10, 0, 3, '[{"name":"b","type":"STRING"}]'::jsonb, d2, 'table')
    RETURNING id INTO r2;

    -- 2. A sheet sync beside them is refused: not both kinds.
    BEGIN
      INSERT INTO public.fusion_table_regions
        (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
      VALUES (sh, 'whole', 0, 0, 20, '[{"name":"a","type":"STRING"}]'::jsonb, d3, 'sheet');
      RAISE EXCEPTION 'a sheet sync joined table syncs';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:SyncKindsConflict%' THEN RAISE; END IF;
    END;

    -- 3. Two regions may not target one dataset — the overlap the page warns of.
    BEGIN
      INSERT INTO public.fusion_table_regions
        (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
      VALUES (sh, 'third', 20, 0, 3, '[{"name":"c","type":"STRING"}]'::jsonb, d1, 'table');
      RAISE EXCEPTION 'two regions synced to one dataset';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:DatasetAlreadySynced%' THEN RAISE; END IF;
    END;

    -- 4. With the table syncs stopped, a sheet sync is fine — and only one.
    UPDATE public.fusion_table_regions SET dataset_id = NULL WHERE id IN (r1, r2);
    INSERT INTO public.fusion_table_regions
      (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
    VALUES (sh, 'whole', 0, 0, 20, '[{"name":"a","type":"STRING"}]'::jsonb, d3, 'sheet');
    BEGIN
      INSERT INTO public.fusion_table_regions
        (sheet_id, name, top_row, left_col, row_count, columns, dataset_id, sync_kind)
      VALUES (sh, 'whole2', 0, 0, 20, '[{"name":"a","type":"STRING"}]'::jsonb, d1, 'sheet');
      RAISE EXCEPTION 'a second sheet sync was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Fusion:SyncKindsConflict%'
         AND SQLERRM NOT LIKE '%fusion_one_sheet_sync%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '695 proved: many table syncs share one sheet (the 694 defect, corrected), a sheet sync beside them is refused, two regions may not target one dataset, and once the table syncs stop a single sheet sync is allowed while a second is not';
  END;
END $$;
