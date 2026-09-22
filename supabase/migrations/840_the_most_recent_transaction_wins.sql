-- A repeated primary key across transactions is the newer value, not an error.
--
-- The head of the parity queue's tier 2, and a correction to a build path that
-- has been shipping the wrong answer since 442.
--
-- The rule is published in three sentences and all three are on one page:
--
--   "If the dataset contains more than one row for the same primary key, the data of the row in the most recent transaction will be present in the Ontology. You may not have duplicate primary keys within a single transaction."
--   — object-indexing/funnel-batch-pipelines.md
--
--   "If a primary key appears in multiple transactions, the row from the most recent transaction will be kept."
--   — object-indexing/funnel-batch-pipelines.md
--
--   "Each transaction must contain at most one row per primary key."
--   — object-indexing/funnel-batch-pipelines.md
--
-- WHAT WE DO TODAY, AND WHY IT IS WRONG. `index_object_type` stages every row
-- of every datasource's current view into a temp table keyed by primary key and
-- raises `non-unique primary keys` on ANY collision. It cannot tell a repeat
-- within one transaction — which Foundry refuses — from a repeat across
-- transactions — which Foundry resolves. So an object type backed by a dataset
-- that receives APPEND transactions, which is exactly what the page calls an
-- incremental dataset, fails its build the first time a row is updated.
--
-- That is the failure mode CLAUDE.md names by name: do not be stricter than
-- Foundry. And the refusal never traced to this rule. It traces to a phrase in
-- a deep-dive lesson listing example failures ("such as non-unique primary
-- keys"), which 442 quoted for the ERROR SURFACE and then implemented as a much
-- wider refusal than the rule that governs it.
--
-- IT WAS ALSO ALREADY READ. docs/foundry-reference/readings/datasets-rid-and-object-storage.md
-- records all three sentences together, in the section on changelog datasets.
-- The reading was right and the code never followed it.
--
-- WHAT DOES NOT CHANGE, stated here so the next reader does not take a wider
-- claim from this migration than it makes:
--
--   * A repeat ACROSS DATASOURCES still raises. The page's rule is about the
--     transactions of one dataset; it says nothing about two datasources
--     offering the same object, and column-wise multi-datasource object types
--     are a separate, unbuilt capability. The existing unique_violation handler
--     keeps that case, and its message now says which case it is.
--   * A row with no primary key value still raises, unchanged.
--   * Indexing stays a FULL re-read of the current view. 442 collapsed
--     Foundry's four jobs into one, and
--     docs/foundry-reference/readings/ontology-backend-architecture.md
--     Decision 3 keeps that collapse; Decision 4 records the 80% threshold as a
--     Spark cost heuristic with no observable effect here. This migration
--     touches neither. It changes only WHICH ROW WINS — a semantic the page
--     states, and one we get wrong under full and incremental indexing alike.

-- ── the view, with its transactions back in order ──────────────────────────
-- `dataset_view` answers which files a reader sees and deliberately drops the
-- ordering. "Most recent transaction wins" needs that ordering back, and the
-- authoritative one is the chain's own seq — not committed_at, which is wall
-- clock and says nothing about which branch a transaction sits on.
CREATE OR REPLACE FUNCTION public.dataset_view_file_order(p_branch uuid)
RETURNS TABLE(file_id uuid, seq bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT v.file_id, t.seq
    FROM public.dataset_view(p_branch) v
    JOIN public.dataset_files f ON f.id = v.file_id
    JOIN public.dataset_view_transactions_from(
           (SELECT b.head_transaction_id FROM public.dataset_branches b WHERE b.id = p_branch)) t
      ON t.transaction_id = f.transaction_id
$$;

COMMENT ON FUNCTION public.dataset_view_file_order(uuid) IS
  'Each file of a branch''s current view with the sequence of the transaction that wrote it — the ordering OSv2''s "most recent transaction wins" needs (object-indexing/funnel-batch-pipelines).';

GRANT EXECUTE ON FUNCTION public.dataset_view_file_order(uuid) TO authenticated, service_role;

-- ── the indexer, patched in place ──────────────────────────────────────────
-- Patched from the live definition, never retyped: three replaces, each
-- asserted to have changed something, and nothing else moves.
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'index_object_type';
  IF src IS NULL THEN RAISE EXCEPTION 'PATCH FAILED: index_object_type is not there'; END IF;

  -- 1. A variable for the offending key.
  out := replace(src, '  bad      text;', '  bad      text;' || E'\n' || '  dup      text;');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the declare block did not match'; END IF;
  src := out;

  -- 2. The gather, which now resolves the repeat instead of colliding on it,
  --    and refuses first where the page refuses: inside one transaction.
  out := replace(src,
$old$      rows_sql := format(
        'SELECT jsonb_build_object(%s) AS row FROM datasets.%I r
          WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
        cols, ds.physical_table, ds.branch_id);
$old$,
$new$      -- "Each transaction must contain at most one row per primary key."
      -- Asked first, because it is the case the page forbids outright.
      EXECUTE format(
        'SELECT s.pk FROM (
           SELECT jsonb_build_object(%s) ->> %L AS pk, o.seq AS seq
             FROM datasets.%I r
             JOIN public.dataset_view_file_order(%L) o ON o.file_id = r._file) s
          WHERE s.pk IS NOT NULL
          GROUP BY s.pk, s.seq HAVING count(*) > 1 LIMIT 1',
        cols, pk_prop, ds.physical_table, ds.branch_id) INTO dup;
      IF dup IS NOT NULL THEN
        RAISE EXCEPTION 'non-unique primary keys: "%" appears more than once in one transaction of a backing datasource', dup;
      END IF;

      -- "If a primary key appears in multiple transactions, the row from the
      -- most recent transaction will be kept." The chain's seq is that order.
      rows_sql := format(
        'SELECT DISTINCT ON (s.row ->> %L) s.row FROM (
           SELECT jsonb_build_object(%s) AS row, o.seq AS seq
             FROM datasets.%I r
             JOIN public.dataset_view_file_order(%L) o ON o.file_id = r._file) s
          ORDER BY s.row ->> %L, s.seq DESC',
        pk_prop, cols, ds.physical_table, ds.branch_id, pk_prop);
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the gather did not match'; END IF;
  src := out;

  -- 3. The surviving collision is the cross-datasource one, and says so.
  out := replace(src,
    'appears more than once in the backing datasources',
    'appears more than once, in two different backing datasources');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the collision message did not match'; END IF;
  src := out;

  EXECUTE src;
END $patch$;

-- PROVED BY DOING, and by behaviour rather than by name: 833's patch passed an
-- assertion that the function NAMED its helper while one of its three edits had
-- silently no-opped.
-- This builds a type over a dataset, updates a row in a LATER transaction, and
-- asks which value the index holds.
DO $proof$
DECLARE
  v_org uuid; v_space uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_phys text;
  v_ont uuid; v_type uuid; v_otds uuid; v_user uuid; v_txn uuid; v_file uuid; v_txn2 uuid; v_file2 uuid;
  v_build uuid; v_state text; v_err text; v_tbl text; v_city text; v_n int;
  v_unwound boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz840') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz840') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz840', 'zz840') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz840_ds', 'zz840_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz840@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz840@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- One SNAPSHOT: A=ATH, B=SKG.
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_branch, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"pk","type":"STRING"},{"name":"city","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 2) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, city) VALUES ($1,''A'',''ATH''),($1,''B'',''SKG'')', v_phys)
      USING v_file;

    -- Built by direct insert, the way the platform suite builds one: the save
    -- path stages into a working state and a non-key property must name a
    -- datasource that does not exist until the save returns.
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz840', 'Zz840', false) RETURNING id INTO v_ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz840Thing', 'Zz840 thing') RETURNING id INTO v_type;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_type, v_ds, v_branch) RETURNING id INTO v_otds;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required, datasource_id)
    VALUES (v_type, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true, null),
           (v_type, 'city', 'city', 'City', 'string', 'column', 'city', false, false, false, v_otds);

    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'COMPLETED' THEN RAISE EXCEPTION 'PROOF CANNOT RUN: first build % — %', v_state, v_err; END IF;

    -- 1. The same primary key again, in a LATER transaction. The page says the
    --    newer row wins; before this migration the build failed here.
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
      VALUES (v_ds, v_branch, 'APPEND', v_txn) RETURNING id INTO v_txn2;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn2, 'update.parquet', 1) RETURNING id INTO v_file2;
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn2;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, city) VALUES ($1,''A'',''THESSALONIKI'')', v_phys)
      USING v_file2;

    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'COMPLETED' THEN
      RAISE EXCEPTION 'PROOF FAILED: a repeat across transactions still fails the build — % / %', v_state, v_err;
    END IF;
    SELECT index_table INTO v_tbl FROM public.object_type_indexes WHERE object_type_id = v_type;
    EXECUTE format('SELECT city FROM objects.%I WHERE pk = ''A''', v_tbl) INTO v_city;
    IF v_city <> 'THESSALONIKI' THEN
      RAISE EXCEPTION 'PROOF FAILED: the index holds "%", not the most recent transaction''s value', v_city;
    END IF;
    EXECUTE format('SELECT count(*) FROM objects.%I', v_tbl) INTO v_n;
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: % objects, expected 2 — the repeat became a second object', v_n; END IF;
    RAISE NOTICE 'PROVED: the most recent transaction wins, and the object count does not grow';

    -- 2. And the case the page forbids outright still fails: two rows with the
    --    same primary key inside ONE transaction.
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, city) VALUES ($1,''A'',''LARISA'')', v_phys)
      USING v_file2;
    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'FAILED' OR v_err NOT LIKE '%more than once in one transaction%' THEN
      RAISE EXCEPTION 'PROOF FAILED: a repeat inside one transaction gave % / %', v_state, coalesce(v_err, '(no error)');
    END IF;
    RAISE NOTICE 'PROVED: a duplicate primary key inside one transaction still fails the build';

    -- 3. And the failure left the live index serving, which is 644's contract.
    EXECUTE format('SELECT city FROM objects.%I WHERE pk = ''A''', v_tbl) INTO v_city;
    IF v_city <> 'THESSALONIKI' THEN
      RAISE EXCEPTION 'PROOF FAILED: the failed build disturbed the live index';
    END IF;
    RAISE NOTICE 'PROVED: the refused build left the live index serving';

    RAISE EXCEPTION 'ZZ840_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ840_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz840';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
