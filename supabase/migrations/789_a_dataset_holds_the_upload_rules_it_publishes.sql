-- 789 — a dataset holds the upload rules it publishes
--
-- Reading: docs/foundry-reference/readings/ingestion.md (65 pages, 89 of 89
-- images parsed). This is the storage half of getting data in; 790 is the
-- upload itself. Three of the four changes here are corrections to rules
-- Foundry publishes and we never held, found by reading the api against the
-- live catalogue before building anything.
--
-- 1. A FILE PATH MAY NOT BEGIN WITH A SLASH.
--
--   "Paths are relative and must not start with a leading slash."
--   — api/datasets-resources-files-upload-file.md
--
-- Refused there as InvalidFilePath. 393 checked only that the trimmed path is
-- non-empty. The same page's examples show that nested paths and multi-dot
-- names are both legal, so nothing else is refused: no length bound, no
-- character set, no ruling on dot-dot segments, because no page states one and
-- being stricter than Foundry is its own defect.
--
-- 2. A BRANCH NAME MAY NOT LOOK LIKE A RID OR A UUID.
--
--   "Branch names cannot be empty and must not look like RIDs or UUIDs."
--   — api/datasets-resources-files-upload-file.md
--
-- Refused there as InvalidBranchId. We held the empty half since 392 and not
-- the second. INFERENCE, and it is mine: the page says look like rather than
-- be, so this refuses a name that STARTS ri. and a name shaped like a uuid,
-- rather than composing rid_valid — a name may resemble a rid closely enough
-- to confuse a reader without being a well-formed one.
--
-- 3. ONE RULE, TWO INDEXES, AND THAT ONE IS MINE.
--
--   "A branch of a dataset can only have one open transaction at a time."
--   — api/datasets-resources-files-upload-file.md
--
-- 392 built dataset_transactions_one_open_per_branch for exactly this, citing
-- the prose sentence. 638 built one_open_transaction_per_branch, byte for byte
-- the same index under a second name, 246 migrations later, while giving the
-- api error names to the transaction lifecycle. Nothing misbehaves: a violator
-- simply gets whichever name Postgres reports first, so the error message is a
-- coin flip and two indexes are maintained for one rule. Dropped forward,
-- keeping 392 because 392 carries the citation.
--
-- 4. CSV PARSE PARAMETERS BELONG IN THE SCHEMA.
--
--   "These parameters are stored in the schema of a dataset."
--   — dataset-preview/csv-parsing.md
--
-- A structural fact rather than a UI detail, and dataset_schemas carried only
-- a field list. The twelve options and their defaults are that page's table.
-- Two are marked required, parser and nullValues. Its example JSON carries two
-- keys the table never lists and omits one the table marks required, so the
-- table wins: an enumeration beats an example, and unknown keys are refused.
--
-- What is deliberately NOT enforced, each with its reason. The table's fifth
-- column scopes several options to particular parsers, and reads as
-- applicability rather than refusal, so a field delimiter on a parser that
-- ignores it is stored rather than rejected. No page bounds a file's size,
-- row count or column count; api/general-overview-limits publishes only rate
-- and concurrency limits, and the one byte figure nearby governs attachments,
-- a different resource.

BEGIN;

-- ── 1. the file path rule ───────────────────────────────────────────────────

ALTER TABLE public.dataset_files
  ADD CONSTRAINT dataset_files_logical_path_is_relative
  CHECK (logical_path !~ '^/');

COMMENT ON CONSTRAINT dataset_files_logical_path_is_relative ON public.dataset_files IS
  'Paths are relative and must not start with a leading slash (api/datasets-resources-files-upload-file). Refused upstream as InvalidFilePath. Nothing else about a path is refused, because nothing else is published.';

-- ── 2. the branch name rule ─────────────────────────────────────────────────

ALTER TABLE public.dataset_branches
  ADD CONSTRAINT dataset_branches_name_is_not_a_rid_or_uuid
  CHECK (name !~* '^ri\.'
     AND name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

COMMENT ON CONSTRAINT dataset_branches_name_is_not_a_rid_or_uuid ON public.dataset_branches IS
  'Branch names cannot be empty and must not look like RIDs or UUIDs (api/datasets-resources-files-upload-file). Refused upstream as InvalidBranchId. 392 holds the empty half. Looking like a rid is read as starting ri., which is looser than rid_valid on purpose — the page says look like, not be.';

-- ── 3. the duplicate index ──────────────────────────────────────────────────

DROP INDEX IF EXISTS public.one_open_transaction_per_branch;

COMMENT ON INDEX public.dataset_transactions_one_open_per_branch IS
  'Every branch has at most one open transaction. 638 added a second, identical index for this rule under another name; 789 dropped that one and kept this, because this one carries the citation.';

-- ── 4. parse parameters on the schema ───────────────────────────────────────

CREATE FUNCTION public.csv_parser_params_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE k text; v jsonb;
BEGIN
  IF jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;

  -- The table marks exactly two options required.
  IF NOT (p ? 'parser' AND p ? 'nullValues') THEN RETURN false; END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(p) LOOP
    -- Values from dataset-preview/csv-parsing — the options table, which is the
    -- enumeration; the example JSON on the same page carries charsetName and
    -- addFilePathInsteadOfUri, which the table does not list and this refuses.
    IF NOT (k = ANY (ARRAY['parser', 'nullValues', 'fieldDelimiter',
                           'recordDelimiter', 'quoteCharacter', 'dateFormat',
                           'skipLines', 'jaggedRowBehavior', 'parseErrorBehavior',
                           'addFilePath', 'addImportedAt', 'initialReadTimeout']))
    THEN RETURN false; END IF;

    CASE k
      WHEN 'parser' THEN
        IF NOT (v #>> '{}' = ANY (ARRAY['CSV_PARSER', 'MULTILINE_CSV_PARSER',
                                        'SIMPLE_PARSER', 'SINGLE_COLUMN_PARSER']))
        THEN RETURN false; END IF;
      WHEN 'nullValues' THEN
        IF jsonb_typeof(v) <> 'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v) e
                    WHERE jsonb_typeof(e) <> 'string') THEN RETURN false; END IF;
      WHEN 'fieldDelimiter' THEN
        IF jsonb_typeof(v) <> 'string' OR length(v #>> '{}') <> 1 THEN RETURN false; END IF;
      WHEN 'quoteCharacter' THEN
        IF jsonb_typeof(v) <> 'string' OR length(v #>> '{}') <> 1 THEN RETURN false; END IF;
      WHEN 'recordDelimiter' THEN
        -- "A string ends with newline character" is the accepted-values cell.
        IF jsonb_typeof(v) <> 'string' OR right(v #>> '{}', 1) <> E'\n' THEN RETURN false; END IF;
      WHEN 'dateFormat' THEN
        IF jsonb_typeof(v) <> 'object' THEN RETURN false; END IF;
      WHEN 'skipLines' THEN
        IF jsonb_typeof(v) <> 'number' OR (v #>> '{}')::numeric < 0 THEN RETURN false; END IF;
      WHEN 'jaggedRowBehavior' THEN
        IF NOT (v #>> '{}' = ANY (ARRAY['THROW_EXCEPTION', 'DROP_ROW'])) THEN RETURN false; END IF;
      WHEN 'parseErrorBehavior' THEN
        IF NOT (v #>> '{}' = ANY (ARRAY['THROW_EXCEPTION', 'REPLACE_WITH_NULL'])) THEN RETURN false; END IF;
      WHEN 'addFilePath' THEN
        IF jsonb_typeof(v) <> 'boolean' THEN RETURN false; END IF;
      WHEN 'addImportedAt' THEN
        IF jsonb_typeof(v) <> 'boolean' THEN RETURN false; END IF;
      WHEN 'initialReadTimeout' THEN
        IF jsonb_typeof(v) <> 'string' THEN RETURN false; END IF;
    END CASE;
  END LOOP;

  RETURN true;
END $$;

COMMENT ON FUNCTION public.csv_parser_params_valid(jsonb) IS
  'Values from dataset-preview/csv-parsing — the twelve options its table enumerates, with parser and nullValues required and the three enumerated value sets (parser, jaggedRowBehavior, parseErrorBehavior). Unknown keys are refused, which is what makes the table rather than its example JSON the source. The table''s fifth column scopes options to parsers and is applicability rather than refusal, so it is not enforced here.';

-- The documented defaults, in one place, so the upload path and a surface
-- cannot disagree about them. skipLines is the table's 0, not the example's 1.
CREATE FUNCTION public.csv_parser_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'parser',             'CSV_PARSER',
    'nullValues',         '[]'::jsonb,
    'fieldDelimiter',     ',',
    'recordDelimiter',    E'\n',
    'quoteCharacter',     '"',
    'dateFormat',         '{}'::jsonb,
    'skipLines',          0,
    'jaggedRowBehavior',  'THROW_EXCEPTION',
    'parseErrorBehavior', 'THROW_EXCEPTION',
    'addFilePath',        false,
    'addImportedAt',      false,
    'initialReadTimeout', '1 hour')
$$;

COMMENT ON FUNCTION public.csv_parser_defaults() IS
  'The defaults column of dataset-preview/csv-parsing''s options table. Both behaviour options default to throwing: Foundry''s documented answer to a malformed row is to fail loudly rather than null-fill.';

ALTER TABLE public.dataset_schemas
  ADD COLUMN parser_params jsonb,
  ADD CONSTRAINT dataset_schemas_parser_params_valid
  CHECK (parser_params IS NULL OR public.csv_parser_params_valid(parser_params));

COMMENT ON COLUMN public.dataset_schemas.parser_params IS
  'CSV parsing parameters, which dataset-preview/csv-parsing says are stored in the schema of a dataset. NULL where a schema did not come from delimited text — a parquet-backed or Fusion-synced schema has none.';

GRANT EXECUTE ON FUNCTION public.csv_parser_params_valid(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.csv_parser_defaults() TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────
-- Every assertion below CALLS the thing rather than asking the catalogue
-- whether it exists. A body of RAISE would fail all of them.

DO $$
DECLARE ok boolean; ds uuid; br uuid; txn uuid; org uuid; proj uuid; sp uuid;
BEGIN
  -- 4a. the validator accepts the documented defaults and refuses the example's
  --     two extra keys, which is the whole point of preferring the table.
  IF public.csv_parser_params_valid(public.csv_parser_defaults()) IS NOT TRUE THEN
    RAISE EXCEPTION 'the defaults do not satisfy the validator';
  END IF;
  IF public.csv_parser_params_valid(public.csv_parser_defaults() || '{"charsetName":"UTF-8"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'charsetName is in the example JSON and not the table, and must be refused';
  END IF;
  IF public.csv_parser_params_valid(public.csv_parser_defaults() || '{"addFilePathInsteadOfUri":false}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'addFilePathInsteadOfUri is in the example JSON and not the table, and must be refused';
  END IF;

  -- 4b. the two required options
  IF public.csv_parser_params_valid('{"nullValues":[]}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'parser is required';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'nullValues is required';
  END IF;

  -- 4c. the three enumerated sets, each probed on a member and a non-member
  IF public.csv_parser_params_valid('{"parser":"SINGLE_COLUMN_PARSER","nullValues":[]}'::jsonb) IS NOT TRUE THEN
    RAISE EXCEPTION 'SINGLE_COLUMN_PARSER is one of the four';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"SPARK","nullValues":[]}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'a parser off the enumeration must be refused';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[],"jaggedRowBehavior":"DROP_ROW"}'::jsonb) IS NOT TRUE THEN
    RAISE EXCEPTION 'DROP_ROW is one of the two';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[],"parseErrorBehavior":"DROP_ROW"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'DROP_ROW belongs to jaggedRowBehavior, not parseErrorBehavior';
  END IF;

  -- 4d. the shape rules the accepted-values column states
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[],"fieldDelimiter":"||"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'a field delimiter is a one-character string';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[],"recordDelimiter":"X"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'a record delimiter ends with a newline character';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[],"skipLines":-1}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'skipLines is a non-negative number';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":["", "NA"]}'::jsonb) IS NOT TRUE THEN
    RAISE EXCEPTION 'nullValues is a list of strings';
  END IF;
  IF public.csv_parser_params_valid('{"parser":"CSV_PARSER","nullValues":[1]}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'nullValues holds strings, not numbers';
  END IF;

  -- 3. the duplicate is gone and the cited one remains
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
              AND indexname = 'one_open_transaction_per_branch') THEN
    RAISE EXCEPTION '638''s duplicate index is still here';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND indexname = 'dataset_transactions_one_open_per_branch') THEN
    RAISE EXCEPTION '392''s index is the one that stays';
  END IF;

  -- 1 and 2 are proved by writing rows, because a CHECK that is never
  -- exercised proves only that it parses.
  INSERT INTO public.organizations (name) VALUES ('m789org') RETURNING id INTO org;
  INSERT INTO public.spaces (name, path) VALUES ('m789space', '/m789space') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m789proj', 'm789proj', sp, org) RETURNING id INTO proj;
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m789ds', 'm789', proj, org) RETURNING id INTO ds;

  BEGIN
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (ds, 'ri.foundry.main.dataset.deadbeef');
    RAISE EXCEPTION 'a branch named like a rid was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (ds, '47516b65-f965-47b5-bab1-0a31901b641c');
    RAISE EXCEPTION 'a branch named like a uuid was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- and an ordinary name still works, including one merely containing a dash
  INSERT INTO public.dataset_branches (dataset_id, name)
  VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'feature-1');

  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status)
  VALUES (ds, br, 'SNAPSHOT', 'OPEN') RETURNING id INTO txn;

  BEGIN
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path)
    VALUES (ds, txn, '/absolute.csv');
    RAISE EXCEPTION 'a leading-slash path was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- the examples the same page prints are all legal
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path)
  VALUES (ds, txn, 'my-file.txt'), (ds, txn, 'path/to/my-file.jpg'),
         (ds, txn, 'dataframe.snappy.parquet');

  -- a schema may now carry its parse parameters, and may not carry nonsense
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields, parser_params)
  VALUES (ds, txn, '[{"name":"a","type":"STRING"}]'::jsonb, public.csv_parser_defaults());

  BEGIN
    UPDATE public.dataset_schemas SET parser_params = '{"parser":"NOPE","nullValues":[]}'::jsonb
     WHERE transaction_id = txn;
    RAISE EXCEPTION 'an unenumerated parser reached the column';
  EXCEPTION WHEN check_violation THEN NULL; END;

  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '789 proved: path, branch name, one index, and twelve parse options';
END $$;

COMMIT;
