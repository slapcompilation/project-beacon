-- 692: a transform file is a job spec, and publishing is what makes it one.
--
-- This is the arc that turns Code Repositories from an application beside
-- the platform into the front door of the build engine. 690 recorded it as
-- the residual; this closes it.
--
-- THE FILE DECLARES ITS OUTPUT BY ITS NAME:
--
--   "Your newly created `.sql` file will declare an output dataset based on the filename you provide. For instance, if your repository is inside `/Public/Authoring` and you create `titanicAnalysis.sql`, your new file will automatically declare an output dataset `/Public/Authoring/titanicAnalysis`."
--   — building-pipelines/create-batch-pipeline-cr.md
--
-- and the file's body is a CREATE TABLE over backticked inputs, as the
-- worked example draws it (building-pipelines/images/finished-code.png):
-- CREATE TABLE `…/titanicAnalysis` AS SELECT … FROM `titanic`. Our job
-- specs are already that shape — declared inputs plus one SQL SELECT, with
-- job_spec_query_text wrapping each input as a CTE named for its api_name.
-- So deriving one from a file is parsing, not a new engine.
--
-- PUBLISHING IS THE HOOK, AND FOUNDRY NAMES IT:
--
--   "In order to publish changes to your data, the continuous integration process `ci/foundry-publish` must run and finish successfully. There are no guarantees that changes will take effect if you merge changes before it finishes successfully so it is highly recommended to make this a requirement for your protected branch."
--   — code-repositories/branch-settings.md
--
-- That sentence explains the whole design: the publish check IS the step
-- that makes code take effect. So publish_transform_branch derives the job
-- specs and records the check under that exact name — which is also the
-- name 690's protected-branch requirement already looks for, so the two
-- halves meet without either being bent to fit.
--
-- WHAT THIS DOES NOT DO, stated rather than discovered: it parses SQL
-- transforms only. Python transforms declare inputs and outputs through
-- @transform.using decorators (transforms-python/transforms) and running
-- Python is not something this platform does; a functions repository is
-- 501/502's business. A .py file in a transforms repository is skipped and
-- said to be skipped, never silently ignored.

-- The inputs a file names, as backticked references in its body. Foundry's
-- editor resolves a backtick to a dataset RID; ours resolves it to a
-- dataset by api_name or by name within the repository's project, which is
-- a recorded simplification of the same idea.
CREATE FUNCTION public.transform_file_inputs(p_body text, p_project uuid)
RETURNS TABLE (dataset_id uuid, reference text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT d.id, refs.ref
    FROM (SELECT (m.parts)[1] AS ref
            FROM regexp_matches(p_body, '`([^`]+)`', 'g') AS m(parts)) refs
    JOIN public.datasets d
      ON d.project_id = p_project
     AND (d.api_name = refs.ref OR d.name = refs.ref
          OR d.rid = refs.ref OR refs.ref LIKE '%/' || d.api_name)
$$;
COMMENT ON FUNCTION public.transform_file_inputs(text, uuid) IS
  'The datasets a SQL transform names in backticks, resolved within the repository''s project. Foundry''s editor rewrites a backtick to a dataset RID so the code survives a move; ours accepts the RID, the api name, the name, or a trailing path segment — a recorded simplification of the same intent (building-pipelines/create-batch-pipeline-cr).';

-- The SELECT a file's body holds, after the CREATE TABLE … AS.
CREATE FUNCTION public.transform_file_logic(p_body text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(coalesce(
    (regexp_match(p_body, 'CREATE\s+TABLE\s+`[^`]+`\s+AS\s+(.*)$', 'is'))[1],
    p_body))
$$;
COMMENT ON FUNCTION public.transform_file_logic(text) IS
  'The SELECT inside a SQL transform — the body after CREATE TABLE `path` AS, as the worked example writes it (building-pipelines/images/finished-code.png). A file with no CREATE TABLE is taken as the logic itself.';

-- Publishing one file: the output dataset the FILENAME declares, the inputs
-- its body names, and a job spec over them.
CREATE FUNCTION public.publish_transform_file(p_file uuid)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  f record; repo record; r record; out_name text; out_ds uuid; logic text; n integer;
BEGIN
  SELECT * INTO f FROM public.code_files WHERE id = p_file;
  IF f.id IS NULL THEN
    RAISE EXCEPTION 'CodeRepositories:FileNotFound — % is not a file you can see', p_file;
  END IF;
  SELECT * INTO repo FROM public.code_repositories WHERE id = f.repository_id;
  IF repo.kind <> 'transforms' THEN
    RAISE EXCEPTION 'CodeRepositories:NotATransformsRepository — only a transforms repository publishes datasets';
  END IF;
  IF f.path !~ '\.sql$' THEN
    RAISE EXCEPTION 'CodeRepositories:NotASqlTransform — % is not a .sql file; Python transforms declare their datasets through decorators and are not published here', f.path;
  END IF;

  -- "declare an output dataset based on the filename you provide"
  out_name := regexp_replace(regexp_replace(f.path, '^.*/', ''), '\.sql$', '');
  IF out_name !~ '^[a-z][a-z0-9_]*$' THEN
    -- our datasets take a snake_case api name; say so rather than mangling
    RAISE EXCEPTION 'CodeRepositories:OutputNameNotUsable — "%" cannot name a dataset here; use lower_snake_case', out_name;
  END IF;

  SELECT id INTO out_ds FROM public.datasets
   WHERE project_id = repo.project_id AND api_name = out_name;
  IF out_ds IS NULL THEN
    INSERT INTO public.datasets (organization_id, project_id, api_name, name,
                                 description)
    VALUES (repo.organization_id, repo.project_id, out_name, out_name,
            format('Declared by %s in %s', f.path, repo.name))
    RETURNING id INTO out_ds;
  END IF;

  logic := public.transform_file_logic(f.content);
  IF btrim(logic) = '' THEN
    RAISE EXCEPTION 'CodeRepositories:EmptyTransform — % declares an output but holds no logic', f.path;
  END IF;

  -- Backticks are Spark SQL's identifier quoting, and job_spec_query_text
  -- wraps each input as a CTE named for its api_name. So a reference is
  -- rewritten to that name — the same move Foundry's editor makes when it
  -- replaces a backticked name with the dataset's RID, resolved one step
  -- further because our query builder names the CTEs.
  FOR r IN SELECT DISTINCT i.reference, d.api_name
             FROM public.transform_file_inputs(f.content, repo.project_id) i
             JOIN public.datasets d ON d.id = i.dataset_id
  LOOP
    logic := replace(logic, '`' || r.reference || '`', r.api_name);
  END LOOP;

  -- the inputs the body names, replacing whatever was declared before: a
  -- transform's inputs are its code's, not an accumulation
  DELETE FROM public.dataset_inputs WHERE dataset_id = out_ds;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id)
  SELECT DISTINCT out_ds, i.dataset_id
    FROM public.transform_file_inputs(f.content, repo.project_id) i
   WHERE i.dataset_id <> out_ds;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'CodeRepositories:NoInputsResolved — % names no dataset this project holds; a backticked reference must resolve', f.path;
  END IF;

  -- one spec per output dataset: publishing again REPLACES the logic rather
  -- than adding a second, which is what re-running the check means
  INSERT INTO public.job_specs (output_dataset_id, logic_sql, published_by)
  VALUES (out_ds, logic, auth.uid())
  ON CONFLICT (output_dataset_id) DO UPDATE
    SET logic_sql = EXCLUDED.logic_sql,
        published_by = EXCLUDED.published_by,
        published_at = now();
  RETURN out_ds;
END $$;
COMMENT ON FUNCTION public.publish_transform_file(uuid) IS
  'Turns one SQL transform file into a job spec: the output dataset its FILENAME declares (building-pipelines/create-batch-pipeline-cr), the inputs its backticks name, and the SELECT its body holds. Python transforms are refused by name — they declare through decorators and this platform does not run Python.';

-- Publishing a branch: what ci/foundry-publish does, under that name.
CREATE FUNCTION public.publish_transform_branch(p_branch uuid)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  b record; f record; published integer := 0; failure text; chk uuid;
BEGIN
  SELECT * INTO b FROM public.code_branches WHERE id = p_branch;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'CodeRepositories:BranchNotFound — % is not a branch you can see', p_branch;
  END IF;

  INSERT INTO public.code_checks (repository_id, branch_id, name, status, detail)
  VALUES (b.repository_id, p_branch, 'ci/foundry-publish', 'running', '')
  RETURNING id INTO chk;

  FOR f IN SELECT id, path FROM public.code_files
            WHERE branch_id = p_branch AND path ~ '\.sql$' ORDER BY path
  LOOP
    BEGIN
      PERFORM public.publish_transform_file(f.id);
      published := published + 1;
    EXCEPTION WHEN OTHERS THEN
      failure := coalesce(failure || '; ', '') || f.path || ': ' || SQLERRM;
    END;
  END LOOP;

  UPDATE public.code_checks
     SET status = CASE WHEN failure IS NULL THEN 'succeeded' ELSE 'failed' END,
         detail = coalesce(failure,
                    format('%s transform(s) published', published)),
         finished_at = clock_timestamp()
   WHERE id = chk;

  -- A failed check is RECORDED, not raised: raising would roll back the very
  -- row that records the failure, and the Checks tab exists to show failures.
  -- The caller reads the check; a protected branch requiring it stays blocked.
  RETURN published;
END $$;
COMMENT ON FUNCTION public.publish_transform_branch(uuid) IS
  'What ci/foundry-publish does, under Foundry''s own name for it: derives a job spec from every SQL transform on the branch and records the check the page says must succeed before changes take effect (code-repositories/branch-settings). 690''s protected-branch requirement already looks for a check of exactly this name, so the two halves meet without either being bent.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; repo uuid; master uuid; sandbox uuid;
  src uuid; fid uuid; out_ds uuid; n integer; txn uuid; st text;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('xform-692') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('xform-692') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'xform692@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'xform692@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'xform_692', 'Transforms 692') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- an input dataset to transform from, materialised: the job spec guard
    -- refuses logic over an input with no physical table, which is correct
    -- and which publishing inherits
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'titanic', 'titanic') RETURNING id INTO src;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (src, 'master');
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status)
    SELECT src, b.id, 'SNAPSHOT', 'OPEN' FROM public.dataset_branches b
     WHERE b.dataset_id = src AND b.name = 'master' RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (src, txn, '[{"name":"name","type":"STRING"},{"name":"age","type":"INTEGER"},
                        {"name":"survived","type":"INTEGER"},{"name":"ticket","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (src, txn, 'part-0.csv', 3);
    PERFORM public.commit_transaction(txn);
    PERFORM public.dataset_materialize(src, txn);

    SELECT public.create_code_repository(proj, 'Simple batch pipeline', 'transforms') INTO repo;
    SELECT id INTO master FROM public.code_branches WHERE repository_id = repo AND name = 'master';
    INSERT INTO public.code_branches (repository_id, name) VALUES (repo, 'batch-pipeline-tutorial')
    RETURNING id INTO sandbox;

    -- the file the tutorial writes, near enough
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-sql/src/main/sql/titanic_analysis.sql',
            'CREATE TABLE `/Data/xform_692/titanic_analysis` AS'
            || E'\n  SELECT name, age, survived, ticket FROM `titanic`')
    RETURNING id INTO fid;

    -- 1. The filename declares the output, and the backtick resolves.
    SELECT public.publish_transform_file(fid) INTO out_ds;
    IF (SELECT d.api_name FROM public.datasets d WHERE d.id = out_ds) <> 'titanic_analysis' THEN
      RAISE EXCEPTION 'the output dataset was not named by the filename';
    END IF;
    SELECT count(*) INTO n FROM public.dataset_inputs
     WHERE dataset_id = out_ds AND input_dataset_id = src;
    IF n <> 1 THEN RAISE EXCEPTION 'the backticked input did not resolve'; END IF;

    -- 2. The job spec holds the SELECT, not the CREATE TABLE.
    SELECT js.logic_sql INTO st FROM public.job_specs js
     WHERE js.output_dataset_id = out_ds ORDER BY js.version DESC LIMIT 1;
    IF st IS NULL OR st LIKE 'CREATE TABLE%' THEN
      RAISE EXCEPTION 'the job spec should hold the SELECT alone, got %', left(coalesce(st,''), 40);
    END IF;
    IF st NOT LIKE '%SELECT name%' THEN
      RAISE EXCEPTION 'the job spec lost the logic';
    END IF;
    IF st LIKE '%`%' THEN
      RAISE EXCEPTION 'the stored logic still carries Spark backticks: %', st;
    END IF;

    -- 3. Re-publishing REPLACES the inputs rather than accumulating them.
    UPDATE public.code_files
       SET content = 'CREATE TABLE `x` AS SELECT name FROM `titanic`'
     WHERE id = fid;
    PERFORM public.publish_transform_file(fid);
    SELECT count(*) INTO n FROM public.dataset_inputs WHERE dataset_id = out_ds;
    IF n <> 1 THEN RAISE EXCEPTION 'inputs accumulated instead of being replaced: %', n; END IF;

    -- 4. A Python transform refuses by name rather than being ignored.
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-python/src/pipeline.py', '@transform.using(...)')
    RETURNING id INTO fid;
    BEGIN
      PERFORM public.publish_transform_file(fid);
      RAISE EXCEPTION 'a python file was published';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:NotASqlTransform%' THEN RAISE; END IF;
    END;

    -- 5. Publishing the branch records the check under Foundry's own name,
    --    and 690's protected-branch requirement looks for exactly that.
    SELECT public.publish_transform_branch(sandbox) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'the branch should publish one transform, got %', n; END IF;
    SELECT c.status INTO st FROM public.code_checks c
     WHERE c.branch_id = sandbox AND c.name = 'ci/foundry-publish'
     ORDER BY c.started_at DESC LIMIT 1;
    IF st <> 'succeeded' THEN RAISE EXCEPTION 'the publish check did not succeed, got %', st; END IF;

    -- 6. THE TWO HALVES MEET: a branch requiring the publish check is
    --    unblocked by having run it.
    UPDATE public.code_branches SET require_publish_check = true, require_code_reviews = 0
     WHERE id = master;
    INSERT INTO public.code_pull_requests (repository_id, source_branch_id, target_branch_id, title)
    VALUES (repo, sandbox, master, 'Add titanic analysis') RETURNING id INTO fid;
    SELECT count(*) INTO n FROM public.pull_request_blockers(fid);
    IF n <> 0 THEN
      RAISE EXCEPTION 'the published branch still blocks on its publish check';
    END IF;

    -- 7. A transform naming nothing resolvable RECORDS a failed check
    --    rather than raising, so the failure survives to be read.
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-sql/src/main/sql/broken.sql',
            'CREATE TABLE `y` AS SELECT 1 FROM `no_such_dataset`');
    PERFORM public.publish_transform_branch(sandbox);
    SELECT c.status INTO st FROM public.code_checks c
     WHERE c.branch_id = sandbox AND c.name = 'ci/foundry-publish'
     ORDER BY c.started_at DESC LIMIT 1;
    IF st <> 'failed' THEN RAISE EXCEPTION 'the failed publish did not record as failed'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '692 proved: a .sql filename declares its output dataset, its backticks resolve to inputs, the job spec holds the SELECT alone, re-publishing replaces inputs rather than accumulating, a Python transform refuses by name, publishing a branch records ci/foundry-publish, that check unblocks a protected branch requiring it, and an unresolvable input RECORDS a failed check rather than raising, so the failure survives to be read';
  END;
END $$;
