-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 393 — files, the view algorithm, and the physical table.
--
-- WHY FILES AND NOT ROWS. Every transaction type in
-- `data-integration/datasets` is defined over FILES, not rows:
--
--   SNAPSHOT  "replaces the current view of the dataset with a completely new
--             set of files"
--   APPEND    "cannot modify existing files in the current dataset view. If an
--             APPEND transaction is opened and existing files are overwritten,
--             then attempting to commit the transaction will fail."
--   UPDATE    "may also overwrite the contents of existing files"
--   DELETE    "removes files that are in the current dataset view"
--
-- And the upload rule keys off a file's NAME: "If the filename and schema of the
-- new file are identical to a previous upload, you can update data in the
-- existing dataset. If the filename is different from previous uploads, you can
-- append data." (`dataset-preview/overview`)
--
-- So the unit of a transaction is a named file, and a file is a batch of rows.
-- Model it any coarser and APPEND and UPDATE become the same operation, which
-- makes the commit rule above unenforceable.
--
-- THE VIEW ALGORITHM, quoted and then implemented verbatim:
--
--   1. "Start with an empty set of files."
--   2. "The view at a given time begins at the latest SNAPSHOT transaction
--      before that point in time. If there is no SNAPSHOT transaction present,
--      then take the earliest transaction for the dataset instead."
--   3. "For a SNAPSHOT or APPEND transaction, add all the transaction's files to
--      the set. For an UPDATE transaction, add all the transaction's files to
--      the set and replace existing files. For a DELETE transaction, remove all
--      files in the transaction from the set."
--
-- Branches fall out of it for free. A branch is "a pointer to the most recent
-- transaction", and each transaction records its parent, so walking the parent
-- chain from a branch head gives the linear history — crossing the fork point
-- into the parent branch exactly as `datasets` describes: "A view may constitute
-- transactions from multiple branches."
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE public.dataset_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id     uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.dataset_transactions(id) ON DELETE CASCADE,
  -- The identity a transaction addresses. UPDATE replaces by this, DELETE
  -- removes by this, and an upload picks its transaction type by comparing it.
  logical_path   text NOT NULL CHECK (length(btrim(logical_path)) > 0),
  -- A DELETE transaction's entries name a path to drop; they carry no rows.
  removes        boolean NOT NULL DEFAULT false,
  row_count      integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, logical_path),
  CHECK (NOT removes OR row_count = 0)
);

COMMENT ON TABLE public.dataset_files IS
  'One named file written (or removed) by one transaction. The unit every transaction type is defined over.';

CREATE INDEX dataset_files_txn_idx ON public.dataset_files (transaction_id);

CREATE POLICY "read files of readable datasets" ON public.dataset_files
  FOR SELECT USING (public.can_read_dataset(dataset_id));
CREATE POLICY "write files of writable datasets" ON public.dataset_files
  FOR ALL USING (public.can_write_dataset(dataset_id))
          WITH CHECK (public.can_write_dataset(dataset_id));

-- ── the view ─────────────────────────────────────────────────────────────────

-- The committed history behind a branch head, oldest first. Crosses fork points
-- because the parent chain does.
CREATE OR REPLACE FUNCTION public.dataset_history(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, committed_at timestamptz, seq bigint)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE head AS (
    SELECT b.head_transaction_id AS id FROM public.dataset_branches b WHERE b.id = p_branch
  ), chain AS (
    SELECT t.* FROM public.dataset_transactions t JOIN head h ON t.id = h.id
    UNION ALL
    SELECT t.* FROM public.dataset_transactions t
      JOIN chain c ON t.id = c.parent_transaction_id
  )
  SELECT c.id, c.txn_type, c.committed_at,
         row_number() OVER (ORDER BY c.committed_at, c.started_at)
    FROM chain c
   WHERE c.status = 'COMMITTED'
     AND (p_at IS NULL OR c.committed_at <= p_at)
   ORDER BY c.committed_at, c.started_at
$$;

-- Step 2 of the algorithm: where the view begins.
CREATE OR REPLACE FUNCTION public.dataset_view_transactions(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (transaction_id uuid, txn_type text, seq bigint)
LANGUAGE sql STABLE AS $$
  WITH h AS (SELECT * FROM public.dataset_history(p_branch, p_at)),
       -- "begins at the latest SNAPSHOT transaction before that point in time.
       --  If there is no SNAPSHOT transaction present, then take the earliest
       --  transaction for the dataset instead."
       start AS (
         SELECT coalesce(
           (SELECT max(h.seq) FROM h WHERE h.txn_type = 'SNAPSHOT'),
           (SELECT min(h.seq) FROM h)
         ) AS seq
       )
  SELECT h.transaction_id, h.txn_type, h.seq
    FROM h, start s
   WHERE s.seq IS NOT NULL AND h.seq >= s.seq
   ORDER BY h.seq
$$;

COMMENT ON FUNCTION public.dataset_view_transactions(uuid, timestamptz) IS
  'The transactions that make up a branch''s view, oldest first. "the number of views in a dataset''s history is equal to the number of SNAPSHOT transactions it contains."';

-- Step 3: replay them into a set of files, keyed by path.
CREATE OR REPLACE FUNCTION public.dataset_view_files(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (file_id uuid, logical_path text, row_count integer)
LANGUAGE sql STABLE AS $$
  -- Within the view, the last transaction to touch a path decides its fate:
  -- SNAPSHOT/APPEND/UPDATE set it, DELETE drops it. Ordering by seq makes
  -- "replace existing files" and "remove all files in the transaction" the same
  -- rule read twice.
  SELECT DISTINCT ON (f.logical_path) f.id, f.logical_path, f.row_count
    FROM public.dataset_view_transactions(p_branch, p_at) v
    JOIN public.dataset_files f ON f.transaction_id = v.transaction_id
   ORDER BY f.logical_path, v.seq DESC
$$;

-- A view is the non-removed survivors of that replay.
CREATE OR REPLACE FUNCTION public.dataset_view(p_branch uuid, p_at timestamptz DEFAULT NULL)
RETURNS TABLE (file_id uuid, logical_path text, row_count integer)
LANGUAGE sql STABLE AS $$
  SELECT v.file_id, v.logical_path, v.row_count
    FROM public.dataset_view_files(p_branch, p_at) v
    JOIN public.dataset_files f ON f.id = v.file_id
   WHERE NOT f.removes
$$;

-- ── the commit rule ──────────────────────────────────────────────────────────
-- "If an APPEND transaction is opened and existing files are overwritten, then
-- attempting to commit the transaction will fail." Enforced where it is stated:
-- at commit, not at write.

CREATE OR REPLACE FUNCTION public.enforce_transaction_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE clashing text;
BEGIN
  IF NEW.status <> 'COMMITTED' OR OLD.status = 'COMMITTED' THEN RETURN NEW; END IF;

  IF NEW.txn_type = 'APPEND' THEN
    SELECT string_agg(f.logical_path, ', ') INTO clashing
      FROM public.dataset_files f
      JOIN public.dataset_view(
             (SELECT b.id FROM public.dataset_branches b WHERE b.id = NEW.branch_id)) v
        ON v.logical_path = f.logical_path
     WHERE f.transaction_id = NEW.id;

    IF clashing IS NOT NULL THEN
      RAISE EXCEPTION 'Datasets:AppendOverwritesExistingFiles — an APPEND transaction may not overwrite files already in the view (%)', clashing
        USING HINT = 'Use an UPDATE transaction, or write to a different path.';
    END IF;
  END IF;

  -- A DELETE names paths to remove; naming one that is not in the view is a
  -- caller error, not a silent no-op.
  IF NEW.txn_type = 'DELETE' THEN
    SELECT string_agg(f.logical_path, ', ') INTO clashing
      FROM public.dataset_files f
     WHERE f.transaction_id = NEW.id
       AND NOT EXISTS (SELECT 1 FROM public.dataset_view(NEW.branch_id) v
                        WHERE v.logical_path = f.logical_path);
    IF clashing IS NOT NULL THEN
      RAISE EXCEPTION 'Datasets:DeleteTargetsAbsentFiles — no such file in the current view (%)', clashing;
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER enforce_transaction_commit
  BEFORE UPDATE ON public.dataset_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_commit();

-- The branch pointer follows the head. "dataset branches are simply a pointer to
-- the most recent transaction on that branch."
CREATE OR REPLACE FUNCTION public.advance_branch_head()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.dataset_branches SET head_transaction_id = NEW.id WHERE id = NEW.branch_id;
  RETURN NEW;
END $$;

CREATE TRIGGER advance_branch_head
  AFTER INSERT ON public.dataset_transactions
  FOR EACH ROW EXECUTE FUNCTION public.advance_branch_head();

-- ── the physical table ───────────────────────────────────────────────────────
-- The fifteen field types, mapped. MAP and STRUCT land in jsonb, which is also
-- why they are the two field types that cannot be property base types: "All
-- field types are valid base types except for Map and Binary types."

CREATE OR REPLACE FUNCTION public.dataset_field_sql_type(f jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE f ->> 'type'
    WHEN 'BOOLEAN'   THEN 'boolean'
    WHEN 'BYTE'      THEN 'smallint'
    WHEN 'SHORT'     THEN 'smallint'
    WHEN 'INTEGER'   THEN 'integer'
    WHEN 'LONG'      THEN 'bigint'
    WHEN 'FLOAT'     THEN 'real'
    WHEN 'DOUBLE'    THEN 'double precision'
    WHEN 'DECIMAL'   THEN format('numeric(%s,%s)', f ->> 'precision', f ->> 'scale')
    WHEN 'STRING'    THEN 'text'
    WHEN 'BINARY'    THEN 'bytea'
    WHEN 'DATE'      THEN 'date'
    WHEN 'TIMESTAMP' THEN 'timestamptz'
    WHEN 'MAP'       THEN 'jsonb'
    WHEN 'STRUCT'    THEN 'jsonb'
    WHEN 'ARRAY'     THEN public.dataset_field_sql_type(f -> 'arraySubType') || '[]'
  END
$$;

-- Build the dataset's table from the schema on a transaction. The two system
-- columns are the file each row belongs to (so a view filters to its files) and
-- nothing else — row identity is the file's, per the model above.
CREATE OR REPLACE FUNCTION public.dataset_materialize(p_dataset uuid, p_transaction uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tbl text; cols text; fields jsonb;
BEGIN
  IF NOT public.can_write_dataset(p_dataset) THEN
    RAISE EXCEPTION 'Datasets:NotAuthorized — no editor role on this dataset''s project';
  END IF;

  SELECT d.api_name INTO tbl FROM public.datasets d WHERE d.id = p_dataset;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Datasets:NoSuchDataset — %', p_dataset; END IF;

  SELECT s.fields INTO fields FROM public.dataset_schemas s WHERE s.transaction_id = p_transaction;
  IF fields IS NULL THEN
    RAISE EXCEPTION 'Datasets:NoSchemaOnTransaction — a table needs a schema, and schemas hang off a transaction';
  END IF;

  SELECT string_agg(format('%I %s', f ->> 'name', public.dataset_field_sql_type(f)), ', ')
    INTO cols FROM jsonb_array_elements(fields) f;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS datasets.%I (
       _row  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       _file uuid NOT NULL REFERENCES public.dataset_files(id) ON DELETE CASCADE,
       %s)', tbl, cols);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON datasets.%I (_file)', tbl || '_file_idx', tbl);

  -- Generated, not written by hand: the policy names this dataset because the
  -- table belongs to exactly one, and reuses the same predicate the registry does.
  EXECUTE format(
    'DROP POLICY IF EXISTS "rows follow the dataset" ON datasets.%I', tbl);
  EXECUTE format(
    'CREATE POLICY "rows follow the dataset" ON datasets.%I FOR ALL
       USING (public.can_read_dataset(%L::uuid))
       WITH CHECK (public.can_write_dataset(%L::uuid))', tbl, p_dataset, p_dataset);

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON datasets.%I TO authenticated', tbl);

  UPDATE public.datasets SET physical_table = tbl, updated_at = now() WHERE id = p_dataset;
  RETURN tbl;
END $$;

COMMENT ON FUNCTION public.dataset_materialize(uuid, uuid) IS
  'Create the dataset''s real table in the datasets schema from the schema on a transaction. SECURITY DEFINER because it issues DDL; it checks can_write_dataset first.';

REVOKE ALL ON FUNCTION public.dataset_materialize(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_materialize(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF public.dataset_field_sql_type('{"type":"DECIMAL","precision":38,"scale":18}'::jsonb) <> 'numeric(38,18)'
  OR public.dataset_field_sql_type('{"type":"ARRAY","arraySubType":{"type":"STRING"}}'::jsonb) <> 'text[]'
  OR public.dataset_field_sql_type('{"type":"TIMESTAMP"}'::jsonb) <> 'timestamptz'
  THEN RAISE EXCEPTION 'Migration 393: field type mapping is wrong'; END IF;

  -- Every one of the fifteen must map; a NULL here would become an unquoted
  -- fragment in the CREATE TABLE and fail far from the cause.
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['BOOLEAN','BYTE','SHORT','INTEGER','LONG','FLOAT','DOUBLE',
                               'STRING','BINARY','DATE','TIMESTAMP','MAP','STRUCT']) AS t(name)
     WHERE public.dataset_field_sql_type(jsonb_build_object('type', t.name)) IS NULL)
  THEN RAISE EXCEPTION 'Migration 393: a field type has no SQL mapping'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                  WHERE n.nspname='public' AND c.relname='dataset_files' AND c.relrowsecurity)
  THEN RAISE EXCEPTION 'Migration 393: dataset_files is missing RLS'; END IF;
END $$;

COMMIT;
