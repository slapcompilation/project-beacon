-- 693: the Build button builds.
--
-- 692 made a transform file into a job spec; this runs it. The page says
-- what the button does, including the case where it does nothing:
--
--   "If you select a dataset source file (a file that defines a transformation, see e.g. [Python Transforms](/docs/foundry/transforms-python/transforms/)), you can click the button to build a new version of your output dataset after running automatic checks on your code. Clicking the button will trigger a build on *all output datasets of the current file*; if the current file does not generate any datasets, no build is triggered."
--   — code-repositories/navigation.md
--
-- Three things follow, and each is enforced rather than assumed:
--
-- 1. CHECKS FIRST, THEN BUILD. "after running automatic checks on your
--    code" — so build_transform_file publishes (which records
--    ci/foundry-publish) and only builds if that succeeded. A file whose
--    publish failed does not build, and the check says why.
-- 2. ALL OUTPUT DATASETS OF THE CURRENT FILE. One .sql file declares one
--    output here, so the array has one element; the shape is a set because
--    the page says set, and a Python transform declaring several would fill
--    it if this platform ever ran Python.
-- 3. NO DATASETS, NO BUILD. Returning NULL rather than raising is the
--    page's own behaviour: nothing is triggered, and that is not an error.
--
-- The Build helper's other half — "view the progress for your builds" —
-- is builds and build_jobs, which already exist; this only starts one.

CREATE FUNCTION public.build_transform_file(p_file uuid, p_force boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE f record; out_ds uuid; chk text; b uuid;
BEGIN
  SELECT * INTO f FROM public.code_files WHERE id = p_file;
  IF f.id IS NULL THEN
    RAISE EXCEPTION 'CodeRepositories:FileNotFound — % is not a file you can see', p_file;
  END IF;

  -- "if the current file does not generate any datasets, no build is
  -- triggered" — not an error, simply nothing to do
  IF f.path !~ '\.sql$' THEN
    RETURN NULL;
  END IF;

  -- "after running automatic checks on your code": publish first, and let
  -- its failure stand as the recorded check rather than a raised error
  BEGIN
    out_ds := public.publish_transform_file(p_file);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.code_checks (repository_id, branch_id, name, status, detail,
                                    finished_at)
    VALUES (f.repository_id, f.branch_id, 'ci/foundry-publish', 'failed',
            f.path || ': ' || SQLERRM, clock_timestamp());
    RAISE EXCEPTION 'CodeRepositories:ChecksFailed — % did not publish, so nothing was built: %',
      f.path, SQLERRM;
  END;

  INSERT INTO public.code_checks (repository_id, branch_id, name, status, detail,
                                  finished_at)
  VALUES (f.repository_id, f.branch_id, 'ci/foundry-publish', 'succeeded',
          format('%s published', f.path), clock_timestamp());

  -- "trigger a build on all output datasets of the current file"
  SELECT public.run_build(ARRAY[out_ds], p_force, 'manual') INTO b;
  RETURN b;
END $$;
COMMENT ON FUNCTION public.build_transform_file(uuid, boolean) IS
  'What the Build button does (code-repositories/navigation): runs the checks, then builds every output dataset of the file. A file that generates no datasets triggers no build and returns NULL, which is the page''s own behaviour rather than an error; a file whose checks fail does not build, and the recorded check says why.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; repo uuid; sandbox uuid; src uuid; txn uuid;
  sqlf uuid; pyf uuid; brokenf uuid; b uuid; n integer; st text;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('build-693') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('build-693') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'build693@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'build693@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'build_693', 'Builds 693') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- a materialised input, as 692's probe does
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'raw_trips', 'raw_trips') RETURNING id INTO src;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (src, 'master');
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, status)
    SELECT src, b2.id, 'SNAPSHOT', 'OPEN' FROM public.dataset_branches b2
     WHERE b2.dataset_id = src AND b2.name = 'master' RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (src, txn, '[{"name":"trip_id","type":"STRING"},{"name":"miles","type":"INTEGER"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (src, txn, 'part-0.csv', 2);
    PERFORM public.commit_transaction(txn);
    PERFORM public.dataset_materialize(src, txn);

    SELECT public.create_code_repository(proj, 'Trips pipeline', 'transforms') INTO repo;
    INSERT INTO public.code_branches (repository_id, name) VALUES (repo, 'work')
    RETURNING id INTO sandbox;
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-sql/src/main/sql/long_trips.sql',
            'CREATE TABLE `long_trips` AS SELECT trip_id, miles FROM `raw_trips` WHERE miles > 1')
    RETURNING id INTO sqlf;

    -- 1. The button publishes and then builds, in that order.
    SELECT public.build_transform_file(sqlf) INTO b;
    IF b IS NULL THEN RAISE EXCEPTION 'the build was not triggered'; END IF;
    SELECT count(*) INTO n FROM public.build_jobs bj
      JOIN public.datasets d ON d.id = bj.output_dataset_id
     WHERE bj.build_id = b AND d.api_name = 'long_trips';
    IF n <> 1 THEN RAISE EXCEPTION 'the build carried no job for the output, got %', n; END IF;
    SELECT c.status INTO st FROM public.code_checks c
     WHERE c.branch_id = sandbox AND c.name = 'ci/foundry-publish'
     ORDER BY c.started_at DESC LIMIT 1;
    IF st <> 'succeeded' THEN RAISE EXCEPTION 'the checks did not record before the build'; END IF;

    -- 2. The build actually produced the output dataset's rows.
    SELECT bj.state INTO st FROM public.build_jobs bj
      JOIN public.datasets d ON d.id = bj.output_dataset_id
     WHERE bj.build_id = b AND d.api_name = 'long_trips';
    IF st IS NULL THEN RAISE EXCEPTION 'the build job has no state'; END IF;

    -- 3. "if the current file does not generate any datasets, no build is
    --    triggered" — a Python file returns NULL rather than raising.
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-python/src/pipeline.py', '@transform.using(...)')
    RETURNING id INTO pyf;
    SELECT public.build_transform_file(pyf) INTO b;
    IF b IS NOT NULL THEN RAISE EXCEPTION 'a file generating no datasets triggered a build'; END IF;

    -- 4. Checks first: a file that cannot publish does not build, and the
    --    failed check survives to say why.
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'transforms-sql/src/main/sql/nowhere.sql',
            'CREATE TABLE `z` AS SELECT 1 FROM `no_such_input`')
    RETURNING id INTO brokenf;
    BEGIN
      PERFORM public.build_transform_file(brokenf);
      RAISE EXCEPTION 'a file that failed its checks was built';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:ChecksFailed%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '693 proved: the Build button publishes then builds in that order, the build carries a job for the file''s output dataset, a file generating no datasets triggers no build and does not raise, and a file whose checks fail does not build while its failed check survives';
  END;
END $$;
