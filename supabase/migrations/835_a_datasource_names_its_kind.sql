-- A datasource names its kind, and an edits-only datasource becomes possible.
--
-- First item of the parity queue derived 2026-09-21 (DELIVERABLE-MAP.md, `The
-- parity queue`). Highest transitive blocking reach of the 245 open nodes at 25,
-- because every other datasource kind waits behind it.
--
-- WHAT THE API ENUMERATES. `ObjectTypeDatasource.definition` is a union of TEN
-- members: `dataset`, `restrictedView`, `mediaSetView`, `timeSeries`, `stream`,
-- `direct`, `geotimeSeries`, `editsOnly`, `table`, `unsupported`
-- (api/ontologies-v2-resources-object-types-get-object-type-by-rid-batch). We
-- carry four. `unsupported` is not a tenth kind to build — the api describes it as
-- a datasource whose kind is not yet exposed on the wire, so it is an encoding
-- artifact of an endpoint we do not serve. Nine real kinds, four of them ours.
--
-- WHY A DISCRIMINATOR COLUMN, AND NOT SIMPLY MORE NULLABLE COLUMNS. This is the
-- correction my own adversarial pass made to the queue's stated reason. The queue
-- argued from the api having a discriminator, which on its own would be a wire
-- detail and a bad reason: our four mutually exclusive FK columns under
-- `object_type_datasources_one_backing` ALREADY form a discriminated union, with
-- the discriminator implicit in which column is non-null. Adding a redundant
-- label to that would only create a second thing to keep in agreement.
--
-- The real argument is that one published member cannot be encoded that way at
-- all:
--
--   "An object type datasource that is not backed by any external Foundry resource. All properties on the object type can only be populated via Actions."
--   — api/ontologies-v2-resources-object-types-get-object-type-by-rid-batch.md
--
-- `editsOnly` carries NO FIELDS. It has no resource to point at, and
-- `one_backing` requires exactly one backing arm to be non-null, so an edits-only
-- datasource is not merely unbuilt here — it is unrepresentable. A kind with no
-- resource pointer cannot be discriminated by which resource pointer is set.
-- That is what forces an explicit kind, and it is why this migration is the one
-- the others wait behind.
--
-- AND IT CARRIES ITS OWN EXCLUSIVITY RULE, from the same paragraph:
--
--   "Note that this datasource type is incompatible with any other datasource and all the properties on the object type are backed by it."
--   — api/ontologies-v2-resources-object-types-get-object-type-by-rid-batch.md
--
-- So an object type has an edits-only datasource ALONE or does not have one. That
-- is a fact about a SET of rows, which puts it on the partial-index rung rather
-- than in a trigger (CLAUDE.md, `Where does the rule go?`).
--
-- WHAT THIS MIGRATION DOES NOT DO. It does not add `stream`, `direct`,
-- `geotimeSeries` or `table`. Each of those names a backing resource we do not
-- model — a Foundry stream, a direct-write source, a geotime series integration, a
-- Foundry table — and each is its own chunk with its own reading. Enumerating them
-- in the CHECK now would be a vocabulary that admits values nothing can produce.
-- The CHECK therefore holds the five kinds that are REPRESENTABLE today, and the
-- COMMENT records the four that are published and unbuilt, so the next reader sees
-- the gap rather than inferring the set is complete.
--
-- THE DISCRIMINATOR IS DERIVED, NEVER ASSERTED. `datasource_kind` is a GENERATED
-- column, so it cannot disagree with the arms: there is no backfill to get wrong
-- and no trigger to keep them in step. The one non-derivable case is exactly the
-- one that motivated the column — all arms NULL means edits-only.

-- 1. The kind, derived from the arms that already exist.
alter table public.object_type_datasources
  add column datasource_kind text
  generated always as (
    CASE
      WHEN dataset_id IS NOT NULL         THEN 'dataset'
      WHEN restricted_view_id IS NOT NULL THEN 'restrictedView'
      WHEN media_set_rid IS NOT NULL      THEN 'mediaSetView'
      WHEN time_series_sync_id IS NOT NULL THEN 'timeSeries'
      ELSE 'editsOnly'
    END
  ) stored;

alter table public.object_type_datasources
  add constraint object_type_datasources_kind_check
  check (datasource_kind = ANY (ARRAY[
    'dataset', 'restrictedView', 'mediaSetView', 'timeSeries', 'editsOnly']));

comment on constraint object_type_datasources_kind_check on public.object_type_datasources is
  'Values from api/ontologies-v2-resources-object-types-get-object-type-by-rid-batch — the ObjectTypeDatasource.definition union. Five of its ten members. Published and NOT yet representable, each needing the backing resource it names: stream (streamRid), direct (directSourceRid), geotimeSeries, table (tableRid). The tenth, unsupported, is an encoding artifact for a kind not exposed on the wire and is not a kind to build.';

comment on column public.object_type_datasources.datasource_kind is
  'The api''s ObjectTypeDatasource.definition discriminator, GENERATED from the backing arms so it cannot disagree with them. It exists because editsOnly has no resource to point at and so cannot be discriminated by which pointer is set.';

-- 2. `one_backing` required exactly one arm. Edits-only has none, so the rule
--    becomes: at most one, and the zero case is edits-only. Dropped and replaced
--    rather than edited, because a CHECK cannot be altered in place.
alter table public.object_type_datasources
  drop constraint object_type_datasources_one_backing;

alter table public.object_type_datasources
  add constraint object_type_datasources_one_backing
  check (
    ((dataset_id IS NOT NULL) AND (branch_id IS NOT NULL) AND (restricted_view_id IS NULL) AND (media_set_rid IS NULL) AND (time_series_sync_id IS NULL))
    OR ((restricted_view_id IS NOT NULL) AND (dataset_id IS NULL) AND (branch_id IS NULL) AND (media_set_rid IS NULL) AND (time_series_sync_id IS NULL))
    OR ((media_set_rid IS NOT NULL) AND (media_set_view_rid IS NOT NULL) AND (dataset_id IS NULL) AND (branch_id IS NULL) AND (restricted_view_id IS NULL) AND (time_series_sync_id IS NULL))
    OR ((time_series_sync_id IS NOT NULL) AND (dataset_id IS NULL) AND (branch_id IS NULL) AND (restricted_view_id IS NULL) AND (media_set_rid IS NULL))
    -- editsOnly: no backing resource at all.
    OR ((dataset_id IS NULL) AND (branch_id IS NULL) AND (restricted_view_id IS NULL) AND (media_set_rid IS NULL) AND (media_set_view_rid IS NULL) AND (time_series_sync_id IS NULL))
  );

comment on constraint object_type_datasources_one_backing on public.object_type_datasources is
  'At most one backing resource. The zero case is the editsOnly member of ObjectTypeDatasource.definition, which is not backed by any external Foundry resource.';

-- 3. "incompatible with any other datasource" — a fact about a SET of rows, so a
--    partial unique index, not a trigger. An object type may hold at most one
--    edits-only datasource, and holding one forbids every other row.
create unique index object_type_datasources_edits_only_alone
  on public.object_type_datasources (object_type_id)
  where datasource_kind = 'editsOnly';

-- The other half of "incompatible": a non-edits-only row may not join an object
-- type that already has an edits-only one. That direction needs another table's
-- rows, which is the trigger rung.
create or replace function public.guard_edits_only_datasource()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.object_type_datasources d
     WHERE d.object_type_id = NEW.object_type_id
       AND d.id IS DISTINCT FROM NEW.id
       AND (d.datasource_kind = 'editsOnly' OR NEW.datasource_kind = 'editsOnly')
  ) THEN
    RAISE EXCEPTION 'Ontology:EditsOnlyDatasourceIsExclusive — an edits-only datasource is incompatible with any other datasource on this object type'
      USING HINT = 'All properties of an edits-only object type are populated via Actions.';
  END IF;
  RETURN NEW;
END $$;

create trigger guard_edits_only_datasource
  before insert or update on public.object_type_datasources
  for each row execute function public.guard_edits_only_datasource();

-- 4. The organization guard predates the kind and assumed a resource exists.
--    `guard_object_type_datasource` computes `synced` by ELIMINATION — not a media
--    set and not a time series sync — which is TRUE for an edits-only row, so it
--    then looked up the organization of a dataset that is not there, found NULL,
--    and refused with `Ontology:DatasourceInAnotherOrganization`. Found by the dry
--    run, not reasoned about: the first version of this migration could not insert
--    the very row it exists to make possible.
--
--    The fix states `synced` positively. The guard's own comment already says what
--    it means — a dataset or a restricted view — so this makes the code agree with
--    the comment rather than changing the rule.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.guard_object_type_datasource()'::regprocedure);
  out := replace(src,
    '  synced := NEW.media_set_rid IS NULL AND NEW.time_series_sync_id IS NULL;',
    '  -- Positively, so a kind with NO backing resource (editsOnly, 835) is not' || E'\n' ||
    '  -- swept in by elimination and asked which organization its dataset is in.' || E'\n' ||
    '  synced := NEW.dataset_id IS NOT NULL OR NEW.restricted_view_id IS NOT NULL;');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the synced anchor did not match'; END IF;
  EXECUTE out;
  IF pg_get_functiondef('public.guard_object_type_datasource()'::regprocedure)
     NOT LIKE '%NEW.dataset_id IS NOT NULL OR NEW.restricted_view_id IS NOT NULL%' THEN
    RAISE EXCEPTION 'PATCH FAILED: the guard still decides synced by elimination';
  END IF;
  RAISE NOTICE 'PATCHED: the datasource guard decides synced positively';
END $patch$;

-- PROVED BY DOING. The fixture unwinds in a subtransaction: 70 datasources is a
-- published cap counted per object type, and a half-failed proof must not leave a
-- row behind that shifts that count.
DO $$
DECLARE
  v_ot uuid; v_ont uuid; v_proj uuid; v_user uuid; v_org uuid;
  v_kind text; v_n int; v_msg text; v_fired boolean; v_unwound boolean := false;
BEGIN
  SELECT id, organization_id INTO v_user, v_org
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT t.id, t.ontology_id, t.project_id INTO v_ot, v_ont, v_proj
    FROM public.object_types t
    JOIN public.object_type_datasources d ON d.object_type_id = t.id
   WHERE d.dataset_id IS NOT NULL LIMIT 1;
  IF v_ot IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no dataset-backed object type'; END IF;

  -- Creating an object type publishes an index JobSpec, which asks the caller's
  -- project role — so the proof has to BE somebody, not the bare owner session.
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

  -- 0. The existing row names itself, with no backfill having been written.
  SELECT d.datasource_kind INTO v_kind FROM public.object_type_datasources d
   WHERE d.object_type_id = v_ot AND d.dataset_id IS NOT NULL;
  IF v_kind <> 'dataset' THEN
    RAISE EXCEPTION 'PROOF FAILED: a dataset-backed row reports kind %', v_kind;
  END IF;
  RAISE NOTICE 'PROVED: an existing row derives its own kind — %', v_kind;

  BEGIN
    -- 1. THE POINT OF THE MIGRATION. An edits-only datasource was unrepresentable
    --    before this file: every arm NULL failed one_backing.
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz835EditsOnly', 'Zz 835 Edits Only') RETURNING id INTO v_ot;
    INSERT INTO public.object_type_datasources (object_type_id, added_by_user_id)
      VALUES (v_ot, v_user);
    SELECT d.datasource_kind INTO v_kind FROM public.object_type_datasources d
     WHERE d.object_type_id = v_ot;
    IF v_kind <> 'editsOnly' THEN
      RAISE EXCEPTION 'PROOF FAILED: a resourceless datasource reports kind %', coalesce(v_kind, 'NULL');
    END IF;
    RAISE NOTICE 'PROVED: a datasource with no backing resource is editsOnly';

    -- 2. It is exclusive, from the other direction: a dataset row may not join it.
    v_fired := false;
    BEGIN
      INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id, added_by_user_id)
        SELECT v_ot, d.dataset_id, d.branch_id, v_user
          FROM public.object_type_datasources d WHERE d.dataset_id IS NOT NULL LIMIT 1;
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired OR v_msg NOT LIKE 'Ontology:EditsOnlyDatasourceIsExclusive%' THEN
      RAISE EXCEPTION 'PROOF FAILED: a datasource joined an edits-only type (%)', coalesce(v_msg, 'no error');
    END IF;
    RAISE NOTICE 'PROVED: no other datasource may join an edits-only object type';

    -- 3. And only one of them.
    v_fired := false;
    BEGIN
      INSERT INTO public.object_type_datasources (object_type_id, added_by_user_id)
        VALUES (v_ot, v_user);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired THEN
      RAISE EXCEPTION 'PROOF FAILED: a second edits-only datasource was accepted';
    END IF;
    RAISE NOTICE 'PROVED: at most one edits-only datasource per object type';

    -- 4. A kind outside the CHECK cannot be reached, because the column is
    --    GENERATED — there is no way to assert a wrong one. Proved by showing the
    --    column refuses a direct write rather than by trusting the CHECK.
    v_fired := false;
    BEGIN
      UPDATE public.object_type_datasources SET datasource_kind = 'stream'
       WHERE object_type_id = v_ot;
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired THEN
      RAISE EXCEPTION 'PROOF FAILED: the discriminator was writable';
    END IF;
    RAISE NOTICE 'PROVED: the discriminator cannot be asserted, only derived';

    RAISE EXCEPTION 'ZZ835_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ835_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  SELECT count(*) INTO v_n FROM public.object_types WHERE api_name = 'Zz835EditsOnly';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: a fixture survived the unwind'; END IF;

  -- 5. Every existing row still names a legal kind, which is the regression this
  --    migration could most plausibly cause.
  SELECT count(*) INTO v_n FROM public.object_type_datasources
   WHERE datasource_kind IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % row(s) have no kind', v_n; END IF;
  RAISE NOTICE 'PROVED: fixture unwound, every datasource names a legal kind';
END $$;
