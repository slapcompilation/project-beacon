-- The filesystem index is written by the tables it indexes.
--
-- `project_resources` has been the right shape and empty since 330: primary key
-- (resource_kind, resource_id), a project and a folder beside it, and NOTHING
-- WRITES TO IT. Measured before this migration: 0 rows, 0 triggers, and the
-- only three functions naming it (project_of_resource, portfolio_catalog,
-- has_resource_role) all READ. Its CHECK admitted `object_type` and
-- `object_set`, neither of which carries a folder_id, while fourteen tables
-- that do carry one were indexed nowhere.
--
-- So the Files listing hand-wrote its own union instead —
-- `useFiledResources` in apps/web fetches datasets and restricted_views and
-- nothing else, which is the `rebuild_relationship_edges_view` mistake in
-- TypeScript: a listing that claims to be the filesystem while a human
-- maintains its branches, and twelve resource kinds invisible because nobody
-- added a third fetch.
--
-- WHY AN INDEX AND NOT A UNION, which is the question
-- readings/compass-files-and-projects.md Decision 1 originally got wrong and is
-- annotated for. The filesystem v2 API pages publish Compass as a wire
-- type, and the whole of it is identity and placement:
--
--   "A Foundry filesystem resource. This includes resources such as datasets, Workshop modules and Slate applications along with folders and Projects."
--   — api/v2/filesystem-v2-resources/resources-resource-basics.md

-- Fourteen fields, and not one of them is the resource's content. That is why
-- one table for many kinds is NOT the universal-table mistake CLAUDE.md deleted
-- three times: `object_records` held properties; this holds a location.
--
-- The type is not stored independently of the identity either:
--
--   "The type of the resource derived from the Resource Identifier (RID)."
--   — api/v2/filesystem-v2-resources/resources-get-resource.md

-- and the placement fields are the ones the wire type carries:
--
--   "The full path to the resource, including the resource name itself"
--   — api/v2/filesystem-v2-resources/resources-get-resource.md

-- 1. THE KINDS, as a function rather than a literal CHECK.
--
-- A literal-array CHECK would have to declare one page carrying every member,
-- and no page does — 811 is the migration that learned that the hard way. The
-- ladder's answer for a set that cannot sit in a literal is an IMMUTABLE
-- function returning it, which is what property_base_types() already is.
-- gen:client asks a function-backed vocabulary at runtime rather than emitting
-- a union, so the web stays honest too.
--
-- Each kind is ours, snake_case, one per table that carries placement — and
-- each maps to a member of the 85-member `Resource.type` enum published on
-- resources-get-resource.md. The mapping is in the function's COMMENT so it is
-- checkable rather than folklore. `restricted_view` is the one with no enum
-- member; it is attested in prose instead, by the sentence 809 already cites
-- for resource_markings ("You can only remove inherited Markings from
-- Restricted Views and datasets"), and it is named here as the exception.
--
-- `object_type` and `object_set` are KEPT. 330 put them there, three functions
-- read them, and dropping a kind to tidy the list would be a regression wearing
-- a cleanup's clothes.
create or replace function public.filesystem_resource_kinds()
returns text[] language sql immutable as $$
  SELECT ARRAY[
    'dataset','restricted_view','code_repository','code_workbook',
    'contour_analysis','fusion_spreadsheet','modeling_objective','model',
    'monitoring_view','quiver_analysis','slate_app','vertex_graph',
    'workbook_template','workshop_module',
    'object_type','object_set']
$$;

comment on function public.filesystem_resource_kinds() is
  'The kinds project_resources indexes. Each maps to a member of the Resource.type enum published on api/v2/filesystem-v2-resources/resources-get-resource: dataset=FOUNDRY_DATASET, code_repository=STEMMA_REPOSITORY, code_workbook=VECTOR_WORKBOOK, workbook_template=VECTOR_TEMPLATE, contour_analysis=CONTOUR_ANALYSIS, fusion_spreadsheet=FUSION_DOCUMENT, modeling_objective=FOUNDRY_ML_OBJECTIVE, model=MODELS_MODEL, monitoring_view=DATA_HEALTH_MONITORING_VIEW, quiver_analysis=QUIVER_ANALYSIS, slate_app=SLATE_DOCUMENT, vertex_graph=OPUS_GRAPH, workshop_module=WORKSHOP_MODULE. restricted_view has NO enum member and is attested in prose by platform-security-management/manage-markings instead. object_type and object_set predate this (330) and are ontology kinds, not filesystem ones.';

alter table public.project_resources
  drop constraint if exists project_resources_resource_kind_check;

alter table public.project_resources
  add constraint project_resources_resource_kind_check
  check (resource_kind = any (public.filesystem_resource_kinds()));

-- 2. THE INDEX CARRIES THE NAME AND THE RID, because an index nothing can
-- render is not one. The wire type's displayName and rid; `path`, `spaceRid`,
-- `documentation` and the created/updated pairs are NOT added here, and that is
-- deliberate — no screen asks for them yet and an unread column is this repo's
-- other standing defect.
alter table public.project_resources add column if not exists name text;
alter table public.project_resources add column if not exists rid  text;

comment on column public.project_resources.name is
  'The wire type''s displayName, mirrored from the indexed row so a listing needs no join.';
comment on column public.project_resources.rid is
  'The indexed row''s RID. Null for kinds whose table has no rid column (workbook_templates).';

-- 3. THE WRITER. One trigger function for every table, reading the row through
-- to_jsonb so a table missing trashed_by or rid yields NULL instead of failing
-- — fourteen tables and only three carry trashed_by, so a hand-written
-- per-table trigger would be fourteen chances to drift.
create or replace function public.index_filesystem_resource()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
DECLARE
  v_kind text := TG_ARGV[0];
  v jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.project_resources
     WHERE resource_kind = v_kind AND resource_id = OLD.id;
    RETURN OLD;
  END IF;

  v := to_jsonb(NEW);

  INSERT INTO public.project_resources
    (resource_kind, resource_id, project_id, organization_id, folder_id,
     name, rid, trashed_at, trashed_by)
  VALUES (
    v_kind,
    (v->>'id')::uuid,
    (v->>'project_id')::uuid,
    (v->>'organization_id')::uuid,
    (v->>'folder_id')::uuid,
     v->>'name',
     v->>'rid',
    (v->>'trashed_at')::timestamptz,
    (v->>'trashed_by')::uuid)
  ON CONFLICT (resource_kind, resource_id) DO UPDATE SET
    project_id      = EXCLUDED.project_id,
    organization_id = EXCLUDED.organization_id,
    folder_id       = EXCLUDED.folder_id,
    name            = EXCLUDED.name,
    rid             = EXCLUDED.rid,
    trashed_at      = EXCLUDED.trashed_at,
    trashed_by      = EXCLUDED.trashed_by;

  RETURN NEW;
END $$;

comment on function public.index_filesystem_resource() is
  'Maintains project_resources from the table that owns the row. Attached with the kind as its one argument; reads NEW through to_jsonb so a table without trashed_by or rid indexes NULL rather than raising.';

-- 4. ATTACHED TO EVERY TABLE THAT CARRIES PLACEMENT. Written out rather than
-- generated from information_schema at apply time, because a DO block looping
-- over the catalogue would make the set of indexed tables invisible to anyone
-- reading this file — and the set is the point.
DO $$
DECLARE t text; k text; pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['datasets','dataset'], ['restricted_views','restricted_view'],
    ['code_repositories','code_repository'], ['code_workbooks','code_workbook'],
    ['contour_analyses','contour_analysis'], ['fusion_spreadsheets','fusion_spreadsheet'],
    ['modeling_objectives','modeling_objective'], ['models','model'],
    ['monitoring_views','monitoring_view'], ['quiver_analyses','quiver_analysis'],
    ['slate_apps','slate_app'], ['vertex_graphs','vertex_graph'],
    ['workbook_templates','workbook_template'], ['workshop_modules','workshop_module']]
  LOOP
    t := pair[1]; k := pair[2];
    EXECUTE format('DROP TRIGGER IF EXISTS index_in_filesystem ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER index_in_filesystem AFTER INSERT OR UPDATE OR DELETE ON public.%I'
      ' FOR EACH ROW EXECUTE FUNCTION public.index_filesystem_resource(%L)', t, k);
  END LOOP;
END $$;

-- 5. BACKFILL. The same shape as the trigger, once per table.
DO $$
DECLARE t text; k text; pair text[]; n int; total int := 0;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['datasets','dataset'], ['restricted_views','restricted_view'],
    ['code_repositories','code_repository'], ['code_workbooks','code_workbook'],
    ['contour_analyses','contour_analysis'], ['fusion_spreadsheets','fusion_spreadsheet'],
    ['modeling_objectives','modeling_objective'], ['models','model'],
    ['monitoring_views','monitoring_view'], ['quiver_analyses','quiver_analysis'],
    ['slate_apps','slate_app'], ['vertex_graphs','vertex_graph'],
    ['workbook_templates','workbook_template'], ['workshop_modules','workshop_module']]
  LOOP
    t := pair[1]; k := pair[2];
    EXECUTE format($f$
      INSERT INTO public.project_resources
        (resource_kind, resource_id, project_id, organization_id, folder_id, name, rid, trashed_at, trashed_by)
      SELECT %L,
             (to_jsonb(x)->>'id')::uuid,
             (to_jsonb(x)->>'project_id')::uuid,
             (to_jsonb(x)->>'organization_id')::uuid,
             (to_jsonb(x)->>'folder_id')::uuid,
              to_jsonb(x)->>'name',
              to_jsonb(x)->>'rid',
             (to_jsonb(x)->>'trashed_at')::timestamptz,
             (to_jsonb(x)->>'trashed_by')::uuid
        FROM public.%I x
       WHERE (to_jsonb(x)->>'project_id') IS NOT NULL
      ON CONFLICT (resource_kind, resource_id) DO NOTHING
    $f$, k, t);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
  END LOOP;
  RAISE NOTICE 'backfilled % row(s) into the filesystem index', total;
END $$;

-- PROVED BY DOING.
--
-- Not "the triggers exist" — 592 is the migration that asserted a catalogue
-- while the body was broken. This creates a real dataset, watches the index
-- gain it, moves it to a folder, watches the index follow, deletes it, watches
-- the index lose it. If the trigger body were RAISE, every one of these fails.
DO $$
DECLARE
  v_project uuid; v_org uuid; v_ds uuid; v_folder uuid; v_seen int; v_folder_seen uuid;
BEGIN
  -- Every NOT NULL column without a usable default is supplied explicitly:
  -- organization_id defaults to auth_org_id(), which is NULL in a migration,
  -- and api_name has no default at all. Read off information_schema rather than
  -- discovered one failed apply at a time.
  SELECT id, organization_id INTO v_project, v_org
    FROM public.projects ORDER BY created_at LIMIT 1;
  IF v_project IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no projects'; END IF;

  INSERT INTO public.datasets (project_id, name, api_name, organization_id)
    VALUES (v_project, 'zz-proof-812-dataset', 'zz_proof_812_dataset', v_org)
    RETURNING id INTO v_ds;

  SELECT count(*) INTO v_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF FAILED: a new dataset put % row(s) in the index, expected 1', v_seen;
  END IF;

  IF (SELECT name FROM public.project_resources
       WHERE resource_kind='dataset' AND resource_id=v_ds) <> 'zz-proof-812-dataset' THEN
    RAISE EXCEPTION 'PROOF FAILED: the index did not carry the name';
  END IF;

  -- Placement follows the row.
  INSERT INTO public.folders (project_id, name, organization_id)
    VALUES (v_project, 'zz-proof-812-folder', v_org) RETURNING id INTO v_folder;
  UPDATE public.datasets SET folder_id = v_folder WHERE id = v_ds;

  SELECT folder_id INTO v_folder_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_folder_seen IS DISTINCT FROM v_folder THEN
    RAISE EXCEPTION 'PROOF FAILED: the index did not follow the move (folder_id=%)', v_folder_seen;
  END IF;
  RAISE NOTICE 'PROVED: the index gains a resource on insert and follows it on move';

  DELETE FROM public.datasets WHERE id = v_ds;
  SELECT count(*) INTO v_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: the index kept % row(s) after the dataset was deleted', v_seen;
  END IF;
  DELETE FROM public.folders WHERE id = v_folder;
  RAISE NOTICE 'PROVED: the index loses a resource when its row goes';
END $$;

-- And every table that carries placement is attached — counted, so adding a
-- fifteenth table without its trigger is visible here rather than as a missing
-- row in a listing months later.
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(c.table_name, ', ') INTO v_missing
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.column_name = 'folder_id'
     AND c.table_name <> 'project_resources'
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = format('public.%I', c.table_name)::regclass
          AND t.tgname = 'index_in_filesystem');

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: table(s) carry folder_id and are not indexed: %', v_missing;
  END IF;
  RAISE NOTICE 'PROVED: all % table(s) carrying folder_id are indexed',
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND column_name='folder_id' AND table_name<>'project_resources');
END $$;
