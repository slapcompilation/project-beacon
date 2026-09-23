-- A dataset schema is the one the api publishes, and a DELETE removes.
--
-- Shape audit round 1 (#1030) ranked `dataset_schemas` second, behind object
-- sets, and for a sharper reason than "fields are missing": 392 built it from
-- `data-integration/datasets.md`, the prose page, rather than from the api page
-- that publishes the wire encoding. Every divergence below follows from that one
-- choice, and one of them is not additive — a UNIQUE forecloses a published key.
--
-- Verified by reading the api page directly rather than from the audit's report,
-- because two of the audit's neighbours turned out to be one-off in their counts.
-- `DatasetFieldSchema` publishes:
--
-- `nullable` is published as a required boolean:
--
--   "Indicates whether values of this field may be null."
--   — api/v2-datasets-v2-resources-datasets-get-dataset-schema.md
--
-- the array key is spelled `arraySubtype`:
--
--   "Only used when field type is array."
--   — api/v2-datasets-v2-resources-datasets-get-dataset-schema.md
--
-- the response carries a required `versionId`:
--
--   "The version identifier of a dataset schema."
--   — api/v2-datasets-v2-resources-datasets-get-dataset-schema.md
--
-- and the write side carries a four-member `dataframeReader` enum — AVRO, CSV,
-- PARQUET, DATASOURCE:
--
--   "The dataframe reader used for reading the dataset schema. Defaults to PARQUET."
--   — api/v2-datasets-v2-resources-datasets-put-dataset-schema.md
--
-- TWO PAGES SPELL THE ARRAY KEY DIFFERENTLY. The api writes `arraySubtype` in
-- eight pages; `data-integration/datasets.md` line 151 writes "`ARRAY` requires
-- `arraySubType`, a field type", and 392 took the prose. This is the case
-- CLAUDE.md's *two vocabularies* section is about, and the tie-break is its own:
-- `api/` publishes the WIRE ENCODING and the prose describes it, so where they
-- disagree on a key name the api wins. The audit's audience note says the same
-- from the other side — this layer is reached by rid and has no Ontology Manager
-- surface of its own.
--
-- WHY A NORMALISING TRIGGER AND NOT A STRICTER CHECK. `nullable` is `required`
-- on the wire, and seventeen platform suites plus seventeen web modules build a
-- field as `{name, type}`. Making the CHECK demand it would fail all of them for
-- a key nothing here reads yet. So the shape is completed on WRITE: a BEFORE
-- trigger stamps what the wire requires and canonicalises the array key, and the
-- CHECK then validates the normalised document — a BEFORE trigger runs ahead of
-- the CHECKs, which this repo has recorded since a test once passed against the
-- wrong guard. Every stored field therefore carries `nullable`, no caller moves,
-- and the one inference is the default.
--
-- THE DEFAULT IS AN INFERENCE AND IS MARKED AS ONE. The api marks `nullable`
-- required and publishes no default. `true` is taken because a schema field that
-- has never declared nullability has never refused a null, so stamping `false`
-- would invent a constraint the data may already violate. Recorded rather than
-- presented as published.
--
-- AND A LIVE DEFECT, from the same audit: `dataset_files.removes` is a per-file
-- second copy of a discriminator Foundry keys off the TRANSACTION type, and
-- nothing tied the two. Measured on the live catalog: **zero functions in the
-- database name `removes`**, and all six writers of `dataset_files` insert
-- `(dataset_id, transaction_id, logical_path, row_count)` only. So
-- `dataset_view_from`'s `WHERE NOT latest.removes` could never exclude anything
-- our own engine wrote, and a committed DELETE transaction removed nothing from
-- the view. Only the platform harness computed the flag, as `type === 'DELETE'`,
-- which is the published rule — which is why the suite matched the
-- documentation's printed answer while the engine did not.

-- ── the field normaliser ───────────────────────────────────────────────────
-- Recursive, because a field type nests: an array's subtype, a map's key and
-- value types, and a struct's subSchemas are all field types.
CREATE OR REPLACE FUNCTION public.dataset_field_normalised(f jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE out jsonb; subs jsonb; sub jsonb;
BEGIN
  IF jsonb_typeof(f) <> 'object' THEN RETURN f; END IF;
  out := f;

  -- The api's spelling wins over the prose's, and the old key is not left
  -- beside the new one — two spellings of one field is how one of them drifts.
  IF out ? 'arraySubType' THEN
    out := (out - 'arraySubType') || jsonb_build_object('arraySubtype', out -> 'arraySubType');
  END IF;

  -- "`nullable` · boolean · required". Stamped when absent; never overwritten.
  IF NOT (out ? 'nullable') THEN
    out := out || jsonb_build_object('nullable', true);
  END IF;

  IF out ? 'arraySubtype' THEN
    out := jsonb_set(out, '{arraySubtype}', public.dataset_field_normalised(out -> 'arraySubtype'));
  END IF;
  IF out ? 'mapKeyType' THEN
    out := jsonb_set(out, '{mapKeyType}', public.dataset_field_normalised(out -> 'mapKeyType'));
  END IF;
  IF out ? 'mapValueType' THEN
    out := jsonb_set(out, '{mapValueType}', public.dataset_field_normalised(out -> 'mapValueType'));
  END IF;
  IF jsonb_typeof(out -> 'subSchemas') = 'array' THEN
    subs := '[]'::jsonb;
    FOR sub IN SELECT * FROM jsonb_array_elements(out -> 'subSchemas') LOOP
      subs := subs || jsonb_build_array(public.dataset_field_normalised(sub));
    END LOOP;
    out := jsonb_set(out, '{subSchemas}', subs);
  END IF;
  RETURN out;
END $fn$;

COMMENT ON FUNCTION public.dataset_field_normalised(jsonb) IS
  'Completes one DatasetFieldSchema to the published shape: canonicalises the prose spelling arraySubType to the api''s arraySubtype, and stamps the required `nullable` (defaulting true, an inference the api does not publish). Recurses into array, map and struct members.';

CREATE OR REPLACE FUNCTION public.normalise_dataset_schema()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE out jsonb; f jsonb;
BEGIN
  IF jsonb_typeof(NEW.fields) <> 'array' THEN RETURN NEW; END IF;
  out := '[]'::jsonb;
  FOR f IN SELECT * FROM jsonb_array_elements(NEW.fields) LOOP
    out := out || jsonb_build_array(public.dataset_field_normalised(f));
  END LOOP;
  NEW.fields := out;
  RETURN NEW;
END $fn$;

CREATE TRIGGER normalise_dataset_schema
  BEFORE INSERT OR UPDATE ON public.dataset_schemas
  FOR EACH ROW EXECUTE FUNCTION public.normalise_dataset_schema();

-- ── the validator and the type resolver read the api's spelling ────────────
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'dataset_field_valid';
  src := replace(src, E'\r\n', E'\n');
  out := replace(src,
    '    RETURN f ? ''arraySubType'' AND public.dataset_field_valid(f -> ''arraySubType'');',
    '    RETURN f ? ''arraySubtype'' AND public.dataset_field_valid(f -> ''arraySubtype'');');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: dataset_field_valid did not match'; END IF;
  EXECUTE out;

  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'dataset_field_sql_type';
  src := replace(src, E'\r\n', E'\n');
  out := replace(src,
    'public.dataset_field_sql_type(f -> ''arraySubType'')',
    'public.dataset_field_sql_type(f -> ''arraySubtype'')');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: dataset_field_sql_type did not match'; END IF;
  EXECUTE out;
END $patch$;

-- Existing rows predate the trigger, so they are normalised once, through the
-- same function rather than through a second copy of the rule.
UPDATE public.dataset_schemas SET fields = fields;

-- ── the version, and the UNIQUE that foreclosed it ─────────────────────────
-- This is the part that was not additive: one schema row per transaction made a
-- second version of a schema on the same end transaction unstorable, so
-- `versionId` could not simply be added.
ALTER TABLE public.dataset_schemas
  ADD COLUMN version_id text NOT NULL DEFAULT gen_random_uuid()::text;

COMMENT ON COLUMN public.dataset_schemas.version_id IS
  'The version identifier of a dataset schema (api/v2-datasets-v2-resources-datasets-get-dataset-schema, required on the wire). Generated here: the api publishes the field, not how it is minted.';

ALTER TABLE public.dataset_schemas DROP CONSTRAINT dataset_schemas_transaction_id_key;
ALTER TABLE public.dataset_schemas
  ADD CONSTRAINT dataset_schemas_transaction_version_key UNIQUE (transaction_id, version_id);

-- The current schema of a transaction is its newest version, which is what
-- every existing reader means by "the schema".
CREATE INDEX dataset_schemas_current ON public.dataset_schemas (transaction_id, created_at DESC);

-- ── the dataframe reader ───────────────────────────────────────────────────
-- Four published members, encoded as four values rather than as "is
-- parser_params NULL", under which AVRO, PARQUET and DATASOURCE were the same
-- answer and could not be told apart.
ALTER TABLE public.dataset_schemas
  ADD COLUMN dataframe_reader text NOT NULL DEFAULT 'PARQUET'
    CHECK (dataframe_reader IN ('AVRO', 'CSV', 'PARQUET', 'DATASOURCE'));

COMMENT ON COLUMN public.dataset_schemas.dataframe_reader IS
  'The dataframe reader used for reading the dataset schema. Defaults to PARQUET (api/v2-datasets-v2-resources-datasets-put-dataset-schema).';

COMMENT ON CONSTRAINT dataset_schemas_dataframe_reader_check ON public.dataset_schemas IS
  'Values from api/v2-datasets-v2-resources-datasets-put-dataset-schema. AVRO, CSV, PARQUET, DATASOURCE.';

-- CSV parser options belong to the CSV reader, which is the relationship the
-- old encoding was standing in for. Stated now that both exist.
ALTER TABLE public.dataset_schemas
  ADD CONSTRAINT dataset_schemas_parser_params_are_csv
    CHECK (parser_params IS NULL OR dataframe_reader = 'CSV');

-- A schema that already carries parser options is a CSV one, by that rule.
UPDATE public.dataset_schemas SET dataframe_reader = 'CSV' WHERE parser_params IS NOT NULL;

-- ── a DELETE transaction removes ───────────────────────────────────────────
-- The flag is stamped from the transaction rather than trusted from the caller,
-- so the two can no longer disagree. A trigger and not a CHECK, because the
-- answer lives in another table — the first rung of the ladder that can hold it.
CREATE OR REPLACE FUNCTION public.stamp_dataset_file_removes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  SELECT (t.txn_type = 'DELETE') INTO NEW.removes
    FROM public.dataset_transactions t WHERE t.id = NEW.transaction_id;
  -- The existing CHECK already says a removing file carries no rows, so the
  -- count follows the flag rather than being asserted by the caller.
  IF NEW.removes THEN NEW.row_count := 0; END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER stamp_dataset_file_removes
  BEFORE INSERT OR UPDATE ON public.dataset_files
  FOR EACH ROW EXECUTE FUNCTION public.stamp_dataset_file_removes();

COMMENT ON COLUMN public.dataset_files.removes IS
  'Whether this file entry removes its logical path from the view. Stamped from the transaction type by stamp_dataset_file_removes (844) — before it, nothing in the database set this and a committed DELETE transaction removed nothing.';

-- PROVED BY DOING.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_txn uuid; v_txn2 uuid;
  v_n int; v_f jsonb; v_paths text[]; v_unwound boolean := false; v_removes boolean;
BEGIN
  -- 1. The normaliser, before any fixture.
  v_f := public.dataset_field_normalised('{"name":"a","type":"STRING"}'::jsonb);
  IF (v_f ->> 'nullable') <> 'true' THEN
    RAISE EXCEPTION 'PROOF FAILED: nullable not stamped — %', v_f;
  END IF;
  v_f := public.dataset_field_normalised('{"name":"a","type":"STRING","nullable":false}'::jsonb);
  IF (v_f ->> 'nullable') <> 'false' THEN
    RAISE EXCEPTION 'PROOF FAILED: an explicit nullable was overwritten — %', v_f;
  END IF;
  v_f := public.dataset_field_normalised('{"name":"a","type":"ARRAY","arraySubType":{"type":"STRING"}}'::jsonb);
  IF v_f ? 'arraySubType' OR NOT (v_f ? 'arraySubtype') THEN
    RAISE EXCEPTION 'PROOF FAILED: the array key was not canonicalised — %', v_f;
  END IF;
  IF (v_f -> 'arraySubtype' ->> 'nullable') <> 'true' THEN
    RAISE EXCEPTION 'PROOF FAILED: the nested subtype was not normalised — %', v_f;
  END IF;
  -- A struct's members nest too.
  v_f := public.dataset_field_normalised(
    '{"name":"s","type":"STRUCT","subSchemas":[{"name":"x","type":"STRING"}]}'::jsonb);
  IF (v_f -> 'subSchemas' -> 0 ->> 'nullable') <> 'true' THEN
    RAISE EXCEPTION 'PROOF FAILED: a struct member was not normalised — %', v_f;
  END IF;
  RAISE NOTICE 'PROVED: the normaliser completes a field to the published shape, recursively';

  -- 2. And the existing row was normalised by the backfill, not just new ones.
  SELECT count(*) INTO v_n FROM public.dataset_schemas s,
       jsonb_array_elements(s.fields) f WHERE NOT (f ? 'nullable');
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % stored field(s) still lack nullable', v_n; END IF;
  RAISE NOTICE 'PROVED: the rows that predate the trigger carry the published shape too';

  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz844') RETURNING id INTO v_org;
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz844', 'zz844') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz844_ds', 'zz844_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    -- 3. A schema written the old way comes back the published way.
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_branch, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"tags","type":"ARRAY","arraySubType":{"type":"STRING"}}]'::jsonb);
    SELECT fields -> 0 INTO v_f FROM public.dataset_schemas WHERE transaction_id = v_txn;
    IF NOT (v_f ? 'arraySubtype') OR (v_f ->> 'nullable') <> 'true' THEN
      RAISE EXCEPTION 'PROOF FAILED: the trigger did not normalise on insert — %', v_f;
    END IF;
    -- and the sql type resolver follows the api key
    IF public.dataset_field_sql_type(v_f) <> 'text[]' THEN
      RAISE EXCEPTION 'PROOF FAILED: the array sql type is %', public.dataset_field_sql_type(v_f);
    END IF;
    RAISE NOTICE 'PROVED: a schema written the prose way is stored the api way, and resolves';

    -- 4. A SECOND version on the same transaction, which the old UNIQUE forbade.
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"tags","type":"ARRAY","arraySubtype":{"type":"STRING"}},{"name":"extra","type":"LONG"}]'::jsonb);
    SELECT count(*) INTO v_n FROM public.dataset_schemas WHERE transaction_id = v_txn;
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: % schema version(s) on one transaction', v_n; END IF;
    RAISE NOTICE 'PROVED: a transaction carries more than one schema version — the UNIQUE forbade it';

    -- 5. The dataframe reader is four values, not a nullable column.
    UPDATE public.dataset_schemas SET dataframe_reader = 'AVRO' WHERE transaction_id = v_txn;
    BEGIN
      UPDATE public.dataset_schemas SET dataframe_reader = 'ORC' WHERE transaction_id = v_txn;
      RAISE EXCEPTION 'PROOF FAILED: an unpublished reader was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE NOTICE 'PROVED: the dataframe reader admits exactly the four published members';

    -- 6. The defect: a committed DELETE transaction now removes.
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 5);
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn;
    SELECT array_agg(logical_path) INTO v_paths FROM public.dataset_view(v_branch);
    IF v_paths <> ARRAY['rows.parquet'] THEN
      RAISE EXCEPTION 'PROOF FAILED: the view holds % before the delete', v_paths;
    END IF;

    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
      VALUES (v_ds, v_branch, 'DELETE', v_txn) RETURNING id INTO v_txn2;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn2, 'rows.parquet', 5);
    SELECT removes INTO v_removes FROM public.dataset_files WHERE transaction_id = v_txn2;
    IF NOT v_removes THEN
      RAISE EXCEPTION 'PROOF FAILED: a file in a DELETE transaction was not stamped as removing';
    END IF;
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn2;
    SELECT coalesce(array_agg(logical_path), '{}') INTO v_paths FROM public.dataset_view(v_branch);
    IF v_paths <> '{}'::text[] THEN
      RAISE EXCEPTION 'PROOF FAILED: a committed DELETE left % in the view', v_paths;
    END IF;
    RAISE NOTICE 'PROVED: a committed DELETE transaction removes from the view — before this it removed nothing';

    RAISE EXCEPTION 'ZZ844_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ844_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz844';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
