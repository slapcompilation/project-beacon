-- 790 — an upload lands a file as a transaction
--
-- Reading: docs/foundry-reference/readings/ingestion.md. 789 held the rules;
-- this is the thing that finally writes rows. The datasets reading's open list
-- has said since 391 that nothing writes rows, that there is no upload and no
-- ingest, and this closes that line.
--
-- WHICH UPLOAD. Two manual surfaces exist and only one is ours: Compass
-- uploads into a FOLDER and branches three ways, all of them media-set or
-- schemaless; Dataset Preview uploads into an EXISTING dataset.
--
--   "In Dataset Preview, you can upload files of the following types directly into a dataset"
--   — dataset-preview/overview.md
--
-- Five types follow and this builds the two that carry a documented schema
-- story, .csv and .tsv. The three Excel types are accepted upstream and then
-- unmentioned by every page read, so they are refused here by name rather than
-- half-handled.
--
-- THE LIFECYCLE IS THE ENDPOINT'S, NOT A NEW ONE.
--
--   "By default the file is uploaded to a new transaction on the default branch"
--   — api/datasets-resources-files-upload-file.md
--
--   "By default the TransactionType will be `UPDATE`, to override this"
--   — api/datasets-resources-files-upload-file.md
--
-- So a branch defaults to master, a transaction is opened and committed for
-- the caller, and an explicit type overrides. The endpoint's error list carries
-- CreateTransactionPermissionDenied, CommitTransactionPermissionDenied and
-- OpenTransactionAlreadyExists, which a write-the-bytes endpoint would have no
-- reason to declare — so the upload owns the whole transaction, and 638's
-- commit path is reused rather than reimplemented.
--
-- WHAT PICKS THE TYPE, when the caller does not.
--
--   "If the filename and schema of the new file are identical to a previous upload, you can"
--   — dataset-preview/overview.md
--
--   "in the existing dataset. If the filename is different from previous uploads, you can"
--   — dataset-preview/overview.md
--
-- The words inside those two links are update and append, and their hrefs are
-- the anchors for those two transaction types, so the type is carried by the
-- link targets rather than by the prose. Same name and same schema is UPDATE;
-- a new name is APPEND. That asymmetry is not decoration: 393's commit trigger
-- refuses an APPEND that overwrites a path already in the view, so a re-upload
-- of a filename could not be an APPEND even if someone wanted it to be.
--
-- SAME NAME, DIFFERENT SCHEMA IS UNDEFINED BY EVERY PAGE READ, and this
-- refuses it rather than guessing. UPDATE would leave the physical table's
-- columns disagreeing with the file it now holds; SNAPSHOT would destroy data
-- nobody asked to replace. Datasets:UploadSchemaDiffers is ours and says so.
--
-- WHAT IS NOT BUILT, with the reason rather than silence. No part of Data
-- Connection: every configuration the api enumerates — s3, rest, snowflake,
-- databricks, smb, jdbc — names an external system reached through
-- credentials, an egress policy and a worker, and we have none of the three.
-- Executing a file import returns a build rid, so if it is ever built it hangs
-- off builds and job_specs rather than becoming a fifth execution mechanism.
--
-- WHAT BUILDING THIS TURNED UP, and it is worth stating because nothing green
-- could have caught it. A dataset view walks back along parent_transaction_id
-- from the branch head to the latest SNAPSHOT. Only create_transaction sets
-- that link; five other writers insert a transaction row directly and leave it
-- NULL, which makes each of their transactions a root whose view is exactly
-- its own files. Every one of those five writes SNAPSHOT, and a SNAPSHOT is
-- the boundary the walk stops at anyway, so the missing link has never
-- mattered. This is the first APPEND anyone has written here, and it is the
-- first thing that could see the difference. 791 closes it at the table.
--
-- THE TYPE INFERENCE BELOW IS OURS. No page in the 65 read documents an
-- algorithm; what they document is coercion afterwards, and that part is
-- Foundry's: jaggedRowBehavior and parseErrorBehavior both default to throwing,
-- so a malformed row fails loudly here rather than being null-filled.

BEGIN;

-- ── the tokeniser ───────────────────────────────────────────────────────────
-- One row per record, so a jagged row survives to be judged rather than being
-- flattened. Honours the four parameters that describe the grammar; the
-- doubled quote is the CSV escape.

CREATE FUNCTION public.csv_rows(p_content text, p_params jsonb)
RETURNS SETOF text[] LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  delim text; quote text; rec text; skip integer;
  i integer := 1; n integer; ch text;
  field text := ''; row_acc text[] := '{}';
  in_quotes boolean := false; started boolean := false; emitted integer := 0;
BEGIN
  delim := p_params ->> 'fieldDelimiter';
  quote := p_params ->> 'quoteCharacter';
  rec   := p_params ->> 'recordDelimiter';
  skip  := coalesce((p_params ->> 'skipLines')::integer, 0);

  -- A carriage return belongs to the line ending, not to the last field.
  p_content := replace(p_content, chr(13) || chr(10), chr(10));
  n := length(p_content);

  WHILE i <= n LOOP
    ch := substr(p_content, i, 1);
    started := true;

    IF in_quotes THEN
      IF ch = quote THEN
        IF substr(p_content, i + 1, 1) = quote THEN
          field := field || quote; i := i + 2; CONTINUE;
        END IF;
        in_quotes := false; i := i + 1; CONTINUE;
      END IF;
      field := field || ch; i := i + 1; CONTINUE;
    END IF;

    IF ch = quote THEN in_quotes := true; i := i + 1; CONTINUE; END IF;

    IF ch = delim THEN
      row_acc := row_acc || field; field := ''; i := i + 1; CONTINUE;
    END IF;

    IF ch = right(rec, 1) THEN
      row_acc := row_acc || field; field := ''; i := i + 1;
      emitted := emitted + 1;
      IF emitted > skip THEN RETURN NEXT row_acc; END IF;
      row_acc := '{}'; started := false; CONTINUE;
    END IF;

    field := field || ch; i := i + 1;
  END LOOP;

  -- A file need not end with its record delimiter.
  IF started THEN
    row_acc := row_acc || field;
    emitted := emitted + 1;
    IF emitted > skip THEN RETURN NEXT row_acc; END IF;
  END IF;
  RETURN;
END $fn$;

COMMENT ON FUNCTION public.csv_rows(text, jsonb) IS
  'Splits delimited text into records using the fieldDelimiter, quoteCharacter, recordDelimiter and skipLines of dataset-preview/csv-parsing. Returns one array per record so that a jagged row reaches jaggedRowBehavior instead of being silently squared off.';

-- ── inference, which is ours ────────────────────────────────────────────────
-- Narrowest type every non-null value in the column satisfies. Recorded as an
-- open question in the reading: no page publishes an algorithm.

CREATE FUNCTION public.infer_field_type(vals text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE v text; any_value boolean := false;
        is_long boolean := true; is_double boolean := true;
        is_bool boolean := true; is_date boolean := true; is_ts boolean := true;
BEGIN
  FOREACH v IN ARRAY vals LOOP
    CONTINUE WHEN v IS NULL;
    any_value := true;
    IF is_long   AND v !~ '^-?[0-9]+$' THEN is_long := false; END IF;
    IF is_double AND v !~ '^-?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$' THEN is_double := false; END IF;
    IF is_bool   AND lower(v) NOT IN ('true', 'false') THEN is_bool := false; END IF;
    IF is_date THEN BEGIN PERFORM v::date; EXCEPTION WHEN others THEN is_date := false; END; END IF;
    IF is_ts   THEN BEGIN PERFORM v::timestamptz; EXCEPTION WHEN others THEN is_ts := false; END; END IF;
  END LOOP;

  IF NOT any_value THEN RETURN 'STRING'; END IF;
  IF is_bool   THEN RETURN 'BOOLEAN'; END IF;
  IF is_long   THEN RETURN 'LONG'; END IF;
  IF is_double THEN RETURN 'DOUBLE'; END IF;
  -- A bare date is also a valid timestamptz, so date is tested first.
  IF is_date   THEN RETURN 'DATE'; END IF;
  IF is_ts     THEN RETURN 'TIMESTAMP'; END IF;
  RETURN 'STRING';
END $fn$;

COMMENT ON FUNCTION public.infer_field_type(text[]) IS
  'The narrowest of the fifteen dataset field types that every non-null value in a column satisfies, falling back to STRING. OURS: no page among the 65 read for readings/ingestion.md publishes an inference algorithm, and the reading records that as an open question.';

-- ── the upload ──────────────────────────────────────────────────────────────

CREATE FUNCTION public.upload_file_to_dataset(
  p_dataset          uuid,
  p_path             text,
  p_content          text,
  p_branch           text DEFAULT 'master',
  p_params           jsonb DEFAULT NULL,
  p_transaction_type text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  params jsonb; br uuid; txn uuid; kind text; phys text;
  header text[]; ncols integer; seen integer := 0; r text[];
  nulls text[]; jagged text; on_error text;
  fields jsonb := '[]'::jsonb; col text[]; c integer;
  existing_file uuid; existing_fields jsonb; view_fields jsonb;
  file_id uuid; cols_sql text; vals_sql text; nrows integer;
BEGIN
  -- The mandatory control, restated because this body is SECURITY DEFINER and
  -- a definer function is exactly where a discretionary check ends up alone.
  IF NOT public.can_write_dataset_data(p_dataset) THEN
    RAISE EXCEPTION 'Datasets:UploadFilePermissionDenied — the provided token does not have permission to upload the given file to the given dataset and transaction';
  END IF;

  IF p_path !~ '\.(csv|tsv)$' THEN
    RAISE EXCEPTION 'Datasets:UploadTypeNotBuilt — % is not one of the two delimited types this builds; the three Excel types are accepted by Foundry and described by no page read', p_path;
  END IF;
  IF p_path ~ '^/' THEN
    RAISE EXCEPTION 'Datasets:InvalidFilePath — the provided file path is invalid. Check that the path does not start with a leading slash';
  END IF;

  params := coalesce(p_params, public.csv_parser_defaults());
  IF p_path ~ '\.tsv$' AND p_params IS NULL THEN
    params := params || jsonb_build_object('fieldDelimiter', chr(9));
  END IF;
  IF public.csv_parser_params_valid(params) IS NOT TRUE THEN
    RAISE EXCEPTION 'Datasets:InvalidParserParams — the given parse parameters are not the options dataset-preview/csv-parsing enumerates';
  END IF;

  SELECT id INTO br FROM public.dataset_branches
   WHERE dataset_id = p_dataset AND name = coalesce(p_branch, 'master');
  IF br IS NULL THEN
    RAISE EXCEPTION 'Datasets:BranchNotFound — the requested branch could not be found, or the client token does not have access to it';
  END IF;

  nulls    := ARRAY(SELECT jsonb_array_elements_text(params -> 'nullValues'));
  jagged   := params ->> 'jaggedRowBehavior';
  on_error := params ->> 'parseErrorBehavior';

  -- Records land in a temp table rather than a two-dimensional array, because
  -- array_agg refuses to accumulate arrays of differing length — which is
  -- precisely what a jagged row is. Squaring them off here would decide
  -- jaggedRowBehavior by accident.
  DROP TABLE IF EXISTS pg_temp.upload_records;
  CREATE TEMP TABLE upload_records (seq bigint GENERATED ALWAYS AS IDENTITY, vals text[]);

  FOR r IN SELECT * FROM public.csv_rows(p_content, params) LOOP
    seen := seen + 1;
    IF seen = 1 THEN
      header := r; ncols := coalesce(array_length(r, 1), 0);
      CONTINUE;
    END IF;
    SELECT array_agg(CASE WHEN u.v = ANY (nulls) THEN NULL ELSE u.v END ORDER BY u.o)
      INTO r FROM unnest(r) WITH ORDINALITY AS u(v, o);
    IF coalesce(array_length(r, 1), 0) <> ncols THEN
      IF jagged = 'DROP_ROW' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Datasets:JaggedRow — record % has % field(s) where the header has %', seen, coalesce(array_length(r, 1), 0), ncols;
    END IF;
    INSERT INTO upload_records (vals) VALUES (r);
  END LOOP;

  IF seen = 0 OR coalesce(ncols, 0) = 0 THEN
    RAISE EXCEPTION 'Datasets:EmptyUpload — the file holds no header';
  END IF;
  SELECT count(*) INTO nrows FROM upload_records;

  -- One inferred type per column, from the rows that survived.
  FOR c IN 1 .. ncols LOOP
    SELECT array_agg(u.vals[c] ORDER BY u.seq) INTO col FROM upload_records u;
    fields := fields || jsonb_build_object(
      'name', header[c],
      'type', public.infer_field_type(coalesce(col, '{}'::text[])));
  END LOOP;
  IF public.dataset_schema_valid(fields) IS NOT TRUE THEN
    RAISE EXCEPTION 'Datasets:SchemaInferenceFailed — the header does not yield a valid schema; a column name must look like an identifier and must not repeat';
  END IF;

  SELECT v.file_id INTO existing_file FROM public.dataset_view(br) v
   WHERE v.logical_path = p_path;
  SELECT s.fields INTO view_fields FROM public.dataset_schemas s
    JOIN public.dataset_transactions t ON t.id = s.transaction_id
   WHERE t.branch_id = br AND t.status = 'COMMITTED'
   ORDER BY t.committed_at DESC LIMIT 1;

  kind := upper(coalesce(p_transaction_type, ''));
  IF kind = '' THEN
    IF existing_file IS NULL THEN
      kind := 'APPEND';
    ELSE
      SELECT s.fields INTO existing_fields FROM public.dataset_schemas s
        JOIN public.dataset_files f ON f.transaction_id = s.transaction_id
       WHERE f.id = existing_file;
      IF existing_fields IS DISTINCT FROM fields THEN
        RAISE EXCEPTION 'Datasets:UploadSchemaDiffers — % is already in the view with a different schema. No page states what a same-name different-schema upload does, so name the transaction type you want', p_path;
      END IF;
      kind := 'UPDATE';
    END IF;
  END IF;
  -- Values from data-integration/datasets — the four transaction types, less
  -- DELETE. The upload endpoint's own transactionType parameter does accept all
  -- four; DELETE is excluded here rather than upstream because a DELETE names
  -- paths to remove and this entry point takes content, so the two cannot meet.
  IF NOT (kind = ANY (ARRAY['SNAPSHOT', 'APPEND', 'UPDATE'])) THEN
    RAISE EXCEPTION 'Datasets:UploadTransactionType — an upload writes SNAPSHOT, APPEND or UPDATE; DELETE names paths to remove and carries no content';
  END IF;

  -- An APPEND or UPDATE onto a dataset that already has a schema must match
  -- it: the physical table has one column set, and the Dataset Preview FAQ
  -- documents this exact case failing rather than merging.
  IF kind <> 'SNAPSHOT' AND view_fields IS NOT NULL AND view_fields IS DISTINCT FROM fields THEN
    RAISE EXCEPTION 'Datasets:SchemaInferenceFailed — this file''s columns differ from the dataset''s current schema. A SNAPSHOT replaces the schema; merging is what the FAQ says the troubleshooting steps do not do';
  END IF;

  -- 638's entry point, not a raw INSERT. It is the only writer that links the
  -- new transaction to the branch head, and that link is what the view walks
  -- back along; it also gives the api's own names to a missing dataset, a
  -- missing branch, a refused write and a branch that already has one open.
  txn := public.create_transaction(p_dataset, kind, coalesce(p_branch, 'master'));

  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields, parser_params)
  VALUES (p_dataset, txn, fields, params);

  IF kind = 'SNAPSHOT' THEN
    phys := public.dataset_rematerialize(p_dataset, txn);
  ELSE
    phys := public.dataset_materialize(p_dataset, txn);
  END IF;

  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (p_dataset, txn, p_path, nrows)
  RETURNING id INTO file_id;

  IF nrows > 0 THEN
    SELECT string_agg(format('%I', f ->> 'name'), ', ' ORDER BY ord),
           string_agg(format('u.vals[%s]::%s', ord, public.dataset_field_sql_type(f)), ', ' ORDER BY ord)
      INTO cols_sql, vals_sql
      FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord);

    BEGIN
      EXECUTE format(
        'INSERT INTO datasets.%I (_file, %s) SELECT %L::uuid, %s FROM upload_records u ORDER BY u.seq',
        phys, cols_sql, file_id, vals_sql);
    EXCEPTION WHEN others THEN
      IF on_error = 'REPLACE_WITH_NULL' THEN
        RAISE EXCEPTION 'Datasets:ParseErrorBehaviorNotBuilt — a value failed to parse and REPLACE_WITH_NULL is not built; the inferred schema is the widest type every value satisfies, so this path needs a caller-supplied schema, which no entry point offers yet (%)', SQLERRM;
      END IF;
      RAISE EXCEPTION 'Datasets:ParseError — a value failed to parse into its column type, and parseErrorBehavior is THROW_EXCEPTION (%)', SQLERRM;
    END;
  END IF;

  DROP TABLE IF EXISTS pg_temp.upload_records;
  PERFORM public.commit_transaction(txn);
  RETURN txn;
END $fn$;

COMMENT ON FUNCTION public.upload_file_to_dataset(uuid, text, text, text, jsonb, text) IS
  'Uploads one delimited file into an existing dataset, opening and committing its transaction the way api/datasets-resources-files-upload-file describes. The transaction type follows dataset-preview/overview: the same filename and schema is UPDATE, a new filename is APPEND, and a same-filename different-schema upload is refused because no page defines it.';

REVOKE EXECUTE ON FUNCTION public.upload_file_to_dataset(uuid, text, text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.upload_file_to_dataset(uuid, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.csv_rows(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.infer_field_type(text[]) TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; sp uuid; proj uuid; ds uuid; br uuid; t1 uuid; t2 uuid; usr uuid;
  got text[]; n integer; ty text;
BEGIN
  -- the tokeniser, on the grammar the page describes
  SELECT array_agg(x ORDER BY o) INTO got
    FROM (SELECT r, row_number() OVER () rn FROM public.csv_rows(
            'a,b' || chr(10) || '1,"he said ""hi"", loudly"' || chr(10),
            public.csv_parser_defaults()) r) s,
         LATERAL unnest(s.r) WITH ORDINALITY AS u(x, i),
         LATERAL (SELECT s.rn * 100 + u.i AS o) ord;
  IF got IS DISTINCT FROM ARRAY['a', 'b', '1', 'he said "hi", loudly'] THEN
    RAISE EXCEPTION 'the doubled quote and the delimiter inside quotes are mishandled: %', got;
  END IF;

  SELECT count(*) INTO n FROM public.csv_rows('skip me' || chr(10) || 'a,b' || chr(10) || '1,2' || chr(10),
    public.csv_parser_defaults() || '{"skipLines":1}'::jsonb);
  IF n <> 2 THEN RAISE EXCEPTION 'skipLines should have left 2 records, left %', n; END IF;

  -- a file that does not end in its record delimiter still yields its last row
  SELECT count(*) INTO n FROM public.csv_rows('a,b' || chr(10) || '1,2', public.csv_parser_defaults());
  IF n <> 2 THEN RAISE EXCEPTION 'a file without a trailing newline lost its last record'; END IF;

  -- inference
  IF public.infer_field_type(ARRAY['1','2']) <> 'LONG' THEN RAISE EXCEPTION 'integers are LONG'; END IF;
  IF public.infer_field_type(ARRAY['1','2.5']) <> 'DOUBLE' THEN RAISE EXCEPTION 'a decimal widens to DOUBLE'; END IF;
  IF public.infer_field_type(ARRAY['true','FALSE']) <> 'BOOLEAN' THEN RAISE EXCEPTION 'booleans are BOOLEAN'; END IF;
  IF public.infer_field_type(ARRAY['2020-01-01']) <> 'DATE' THEN RAISE EXCEPTION 'a bare date is DATE, not TIMESTAMP'; END IF;
  IF public.infer_field_type(ARRAY['1','x']) <> 'STRING' THEN RAISE EXCEPTION 'a mixed column falls back to STRING'; END IF;
  IF public.infer_field_type(ARRAY[NULL, NULL]::text[]) <> 'STRING' THEN RAISE EXCEPTION 'an all-null column is STRING'; END IF;

  -- the whole path, against a real dataset
  -- The upload composes can_write_dataset_data, so the prover needs a real
  -- caller rather than the owner connection: a guard that only ever runs as
  -- the owner proves nothing about the role that will call it.
  INSERT INTO public.organizations (name) VALUES ('m790 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm790-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm790-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M790 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m790proj', 'm790proj', sp, org) RETURNING id INTO proj;
  INSERT INTO public.datasets (api_name, name, project_id, organization_id)
  VALUES ('m790ds', 'm790', proj, org) RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  t1 := public.upload_file_to_dataset(ds, 'crew.csv',
          'name,seats' || chr(10) || 'Ada,2' || chr(10) || 'Grace,3' || chr(10));

  SELECT txn_type INTO ty FROM public.dataset_transactions WHERE id = t1;
  IF ty <> 'APPEND' THEN RAISE EXCEPTION 'a first upload with a new filename is an APPEND, got %', ty; END IF;
  IF (SELECT status FROM public.dataset_transactions WHERE id = t1) <> 'COMMITTED' THEN
    RAISE EXCEPTION 'the upload must commit its own transaction';
  END IF;
  EXECUTE 'SELECT count(*) FROM datasets.m790ds' INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'two data rows should have landed, got %', n; END IF;
  IF (SELECT count(*) FROM public.dataset_schemas s
       WHERE s.transaction_id = t1 AND s.parser_params IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'the parse parameters must be stored on the schema';
  END IF;
  IF (SELECT s.fields -> 1 ->> 'type' FROM public.dataset_schemas s WHERE s.transaction_id = t1) <> 'LONG' THEN
    RAISE EXCEPTION 'the seats column should have been inferred as LONG';
  END IF;

  -- same name, same schema is an UPDATE, and the view keeps only the newer file
  t2 := public.upload_file_to_dataset(ds, 'crew.csv',
          'name,seats' || chr(10) || 'Ada,2' || chr(10) || 'Grace,3' || chr(10) || 'Kay,4' || chr(10));
  IF (SELECT txn_type FROM public.dataset_transactions WHERE id = t2) <> 'UPDATE' THEN
    RAISE EXCEPTION 'the same filename with the same schema is an UPDATE';
  END IF;
  IF (SELECT count(*) FROM public.dataset_view(br)) <> 1 THEN
    RAISE EXCEPTION 'only the most recent version of a path is visible in the view';
  END IF;
  EXECUTE 'SELECT count(*) FROM datasets.m790ds r WHERE r._file IN (SELECT file_id FROM public.dataset_view($1))'
    INTO n USING br;
  IF n <> 3 THEN RAISE EXCEPTION 'the view should now show three rows, got %', n; END IF;

  -- a different filename is an APPEND
  IF (SELECT txn_type FROM public.dataset_transactions
       WHERE id = public.upload_file_to_dataset(ds, 'more.csv',
               'name,seats' || chr(10) || 'Hop,1' || chr(10))) <> 'APPEND' THEN
    RAISE EXCEPTION 'a different filename is an APPEND';
  END IF;

  -- same name, different schema is refused, by name
  BEGIN
    PERFORM public.upload_file_to_dataset(ds, 'crew.csv',
      'name,seats,rank' || chr(10) || 'Ada,2,1' || chr(10));
    RAISE EXCEPTION 'a same-name different-schema upload was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:UploadSchemaDiffers%' THEN RAISE; END IF;
  END;

  -- a jagged row throws by default, and DROP_ROW drops it
  BEGIN
    PERFORM public.upload_file_to_dataset(ds, 'jag.csv', 'name,seats' || chr(10) || 'Ada' || chr(10));
    RAISE EXCEPTION 'a jagged row was accepted under the default behaviour';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:JaggedRow%' THEN RAISE; END IF;
  END;

  PERFORM public.upload_file_to_dataset(ds, 'jag.csv',
    'name,seats' || chr(10) || 'Ada' || chr(10) || 'Grace,3' || chr(10),
    'master', public.csv_parser_defaults() || '{"jaggedRowBehavior":"DROP_ROW"}'::jsonb);
  IF (SELECT row_count FROM public.dataset_files WHERE logical_path = 'jag.csv') <> 1 THEN
    RAISE EXCEPTION 'DROP_ROW should have kept exactly the well-formed record';
  END IF;

  -- a leading slash and an unbuilt file type are both refused by name
  BEGIN
    PERFORM public.upload_file_to_dataset(ds, '/abs.csv', 'a' || chr(10) || '1' || chr(10));
    RAISE EXCEPTION 'a leading-slash path was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:InvalidFilePath%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.upload_file_to_dataset(ds, 'book.xlsx', 'a' || chr(10) || '1' || chr(10));
    RAISE EXCEPTION 'an Excel upload was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Datasets:UploadTypeNotBuilt%' THEN RAISE; END IF;
  END;

  -- a SNAPSHOT may change the schema, because it replaces the view
  PERFORM public.upload_file_to_dataset(ds, 'crew.csv',
    'name,seats,rank' || chr(10) || 'Ada,2,1' || chr(10), 'master', NULL, 'SNAPSHOT');
  IF (SELECT count(*) FROM public.dataset_view(br)) <> 1 THEN
    RAISE EXCEPTION 'a SNAPSHOT view holds exactly the files of that transaction';
  END IF;

  -- nullValues turns the named token into a real NULL
  PERFORM public.upload_file_to_dataset(ds, 'nulls.csv',
    'name,seats' || chr(10) || 'Ada,NA' || chr(10), 'master',
    public.csv_parser_defaults() || '{"nullValues":["NA"]}'::jsonb, 'SNAPSHOT');
  EXECUTE 'SELECT count(*) FROM datasets.m790ds WHERE seats IS NULL' INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'the NA token should have landed as NULL'; END IF;

  DELETE FROM public.organizations WHERE id = org;
  EXECUTE 'DROP TABLE IF EXISTS datasets.m790ds';
  RAISE NOTICE '790 proved: tokenise, infer, APPEND/UPDATE/SNAPSHOT, jagged, nulls, and four refusals';
END $do$;

COMMIT;
