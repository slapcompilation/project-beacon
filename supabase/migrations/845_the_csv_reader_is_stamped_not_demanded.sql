-- The CSV reader is stamped, not demanded.
--
-- A forward correction to 844, which is applied and therefore immutable.
--
-- 844 added `dataframe_reader` with a CHECK tying `parser_params` to the CSV
-- member — a real relationship, and the one the old "is parser_params NULL"
-- encoding was standing in for. But it demanded of every writer something only
-- the new column knows about, and `upload_file_to_dataset` has written CSV
-- parser options since 393 without any notion of a reader. The result was
-- `new row for relation "dataset_schemas" violates check constraint
-- "dataset_schemas_parser_params_are_csv"` on a production path, caught by the
-- platform suite on the run after the apply.
--
-- THE SAME DESIGN 844 ALREADY CHOSE, APPLIED ONE COLUMN FURTHER. 844's whole
-- argument for a normalising trigger was that the wire's required fields should
-- be completed on WRITE rather than demanded of seventeen call sites. The reader
-- is the same case and was missed: a schema that carries CSV parser options IS a
-- CSV schema, so the trigger says so instead of the CHECK refusing.
--
-- The CHECK stays, and that is deliberate — the trigger makes the common case
-- true, and the CHECK still refuses the incoherent one a caller states outright,
-- such as parser options declared beside AVRO. A default is stamped; a
-- contradiction is refused.

CREATE OR REPLACE FUNCTION public.normalise_dataset_schema()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE out jsonb; f jsonb;
BEGIN
  IF jsonb_typeof(NEW.fields) = 'array' THEN
    out := '[]'::jsonb;
    FOR f IN SELECT * FROM jsonb_array_elements(NEW.fields) LOOP
      out := out || jsonb_build_array(public.dataset_field_normalised(f));
    END LOOP;
    NEW.fields := out;
  END IF;

  -- CSV parser options are the CSV reader's. Stamped only over the DEFAULT, so
  -- a caller that names a reader is never contradicted — it is checked.
  IF NEW.parser_params IS NOT NULL AND NEW.dataframe_reader = 'PARQUET' THEN
    NEW.dataframe_reader := 'CSV';
  END IF;

  RETURN NEW;
END $fn$;

-- PROVED BY DOING: the path that broke, and the contradiction that must still
-- be refused.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_txn uuid;
  v_reader text; v_n int; v_unwound boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz845') RETURNING id INTO v_org;
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz845', 'zz845') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz845_ds', 'zz845_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_branch, 'SNAPSHOT') RETURNING id INTO v_txn;

    -- 1. A writer that knows nothing of readers, which is what 844 broke.
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields, parser_params)
      VALUES (v_ds, v_txn, '[{"name":"a","type":"STRING"}]'::jsonb,
              '{"parser":"CSV_PARSER","nullValues":[]}'::jsonb);
    SELECT dataframe_reader INTO v_reader FROM public.dataset_schemas WHERE transaction_id = v_txn;
    IF v_reader <> 'CSV' THEN
      RAISE EXCEPTION 'PROOF FAILED: parser options did not stamp the CSV reader — got %', v_reader;
    END IF;
    RAISE NOTICE 'PROVED: parser options stamp the CSV reader, and the writer needs to know nothing';

    -- 2. And a stated contradiction is still refused, so the CHECK still earns
    --    its place.
    BEGIN
      UPDATE public.dataset_schemas SET dataframe_reader = 'AVRO' WHERE transaction_id = v_txn;
      RAISE EXCEPTION 'PROOF FAILED: parser options beside AVRO were accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE NOTICE 'PROVED: parser options declared beside another reader are still refused';

    -- 3. A schema with no parser options keeps the published default.
    UPDATE public.dataset_schemas SET parser_params = NULL, dataframe_reader = 'PARQUET'
     WHERE transaction_id = v_txn;
    SELECT dataframe_reader INTO v_reader FROM public.dataset_schemas WHERE transaction_id = v_txn;
    IF v_reader <> 'PARQUET' THEN
      RAISE EXCEPTION 'PROOF FAILED: the default moved to %', v_reader;
    END IF;
    RAISE NOTICE 'PROVED: without parser options the reader stays PARQUET, the published default';

    RAISE EXCEPTION 'ZZ845_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ845_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz845';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
