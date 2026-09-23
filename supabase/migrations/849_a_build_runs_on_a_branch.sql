-- A build runs on a branch, and the published Build says which.
--
-- The last of shape audit round 1's five wrong-encoding findings, and the only
-- one with rows already in it — `builds` and `build_jobs` hold thirteen each, so
-- unlike object sets, parameters and interface implementations this one cannot
-- be landed on an empty table.
--
--   "The branch that the build is running on."
--   — api/orchestration-v2-resources-builds-create-build.md
--
-- That is `branchName · string · required` on the `Build` RESPONSE. On the
-- request it is optional:
--
--   "The target branch the build should run on."
--   — api/orchestration-v2-resources-builds-create-build.md
--
-- and a sibling list exists for where to look when the target branch has none:
--
--   "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch."
--   — api/orchestration-v2-resources-builds-create-build.md
--
-- TWO CORRECTIONS TO THE AUDIT THAT REPORTED THIS, both from reading the pages
-- rather than the report, and both the same kind of error it has made before.
--
--   1. The audit called branchName a required field of the published Build,
--      full stop. It is required on the RESPONSE and OPTIONAL on the request —
--      which is what makes this additive rather than a refusal, and decides that
--      the column takes a default instead of demanding one from every caller.
--   2. The audit said branch is a required member of six of the ten Trigger
--      arms. There are ten arms — jobSucceeded, or, newLogic, tableUpdated,
--      and, datasetUpdated, scheduleSucceeded, mediaSetUpdated, time, manual —
--      and FIVE require it: jobSucceeded, newLogic, tableUpdated,
--      datasetUpdated and mediaSetUpdated. Counted by extracting the arms from
--      the page. That is the fourth miscount found in round 1's reports, which
--      is why every count in this header was re-derived.
--
-- WHAT THIS BUILDS: the branch dimension itself. `builds`, `job_specs` and
-- `schedules` each gain the branch they run on, defaulted to `master` because
-- every dataset branch in this platform is master and the thirteen existing
-- builds all ran on it — a backfill that states what happened rather than
-- inventing it.
--
-- WHAT IT DELIBERATELY DOES NOT BUILD, recorded so the next reader does not
-- take this migration for more than it is. The `schedules.trigger` grammar is
-- still ours: a two-level `{type:'event', event:'data_updated'}` where the page
-- publishes a one-level union keyed by member name, whose `and` and `or` arms
-- carry `triggers · list of Trigger · union · required` and are therefore
-- recursive, and which has a `manual` arm we cannot store at all. Converting it
-- rewrites every stored trigger and `schedule_trigger_valid` with them, so it is
-- its own chunk with its own proof — and it is the chunk that gives the five
-- branch-carrying arms somewhere to put their branch. This migration gives the
-- BUILD a branch; it does not give the TRIGGER one.
--
-- AND `fallbackBranches` STAYS UNBUILT, as `readings/builds-and-schedules.md`
-- already records it among the deliberate residual, because nothing here
-- resolves a JobSpec across branches yet. The column would have no reader.

ALTER TABLE public.builds
  ADD COLUMN branch_name text NOT NULL DEFAULT 'master';

COMMENT ON COLUMN public.builds.branch_name IS
  'The branch the build is running on (api/orchestration-v2-resources-builds-create-build — required on the Build response, optional on the request). Defaulted to master: every dataset branch here is master, and the thirteen builds that predate this column all ran on it.';

ALTER TABLE public.job_specs
  ADD COLUMN branch_name text NOT NULL DEFAULT 'master';

COMMENT ON COLUMN public.job_specs.branch_name IS
  'The branch this JobSpec is published on. The published request carries fallbackBranches — "The branches to retrieve JobSpecs from if no JobSpec is found on the target branch" — which is unbuilt, so a spec is found on its own branch only.';

ALTER TABLE public.schedules
  ADD COLUMN branch_name text NOT NULL DEFAULT 'master';

COMMENT ON COLUMN public.schedules.branch_name IS
  'The branch the schedule''s action runs its build on (api/orchestration-v2-resources-schedules-create-schedule). The TRIGGER''s own branch is a different thing and is unbuilt — see 849''s header.';

-- A JobSpec was unique per output; it is now unique per output PER BRANCH,
-- which is what makes a branch dimension mean anything. The old constraint
-- foreclosed exactly the case `fallbackBranches` exists to serve.
ALTER TABLE public.job_specs DROP CONSTRAINT IF EXISTS job_specs_output_dataset_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS job_specs_one_per_output_and_branch
  ON public.job_specs (output_dataset_id, branch_name)
  WHERE output_dataset_id IS NOT NULL;

-- The index spec is one per object type, and per branch for the same reason.
DROP INDEX IF EXISTS job_specs_one_per_object_type;
CREATE UNIQUE INDEX IF NOT EXISTS job_specs_one_per_object_type_and_branch
  ON public.job_specs (output_object_type_id, branch_name)
  WHERE output_object_type_id IS NOT NULL;

-- A build runs its jobs on its own branch, and a job spec from another branch is
-- not a job this build can run. A fact needing another table, so a trigger.
CREATE OR REPLACE FUNCTION public.guard_build_job_branch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_build text; v_spec text;
BEGIN
  SELECT b.branch_name INTO v_build FROM public.builds b WHERE b.id = NEW.build_id;
  SELECT js.branch_name INTO v_spec FROM public.job_specs js WHERE js.id = NEW.job_spec_id;
  IF v_build IS NOT NULL AND v_spec IS NOT NULL AND v_build <> v_spec THEN
    RAISE EXCEPTION 'Builds:JobSpecOnAnotherBranch — this build runs on %, and the job spec is published on %', v_build, v_spec
      USING HINT = 'fallbackBranches is the published way to reach a spec on another branch, and is unbuilt.';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER guard_build_job_branch
  BEFORE INSERT OR UPDATE ON public.build_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_build_job_branch();

-- PROVED BY DOING.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_user uuid; v_ds uuid; v_branch uuid;
  v_build uuid; v_spec uuid; v_spec2 uuid; v_in uuid; v_inbr uuid; v_txn uuid;
  v_n int; v_ok boolean;
  v_unwound boolean := false;
BEGIN
  -- 1. The thirteen builds that predate the column say what they did.
  SELECT count(*) INTO v_n FROM public.builds WHERE branch_name <> 'master';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % existing build(s) are not on master', v_n; END IF;
  RAISE NOTICE 'PROVED: every build that predates the column is recorded on master';

  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz849') RETURNING id INTO v_org;
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz849', 'zz849') RETURNING id INTO v_proj;
    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz849@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz849@beacon.test', 'admin', v_org);
    -- Publishing a JobSpec takes the editor role on the output's project, which
    -- the guard asks of the CALLER, so the fixture has to be one.
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz849_ds', 'zz849_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    -- A JobSpec needs at least one declared input on its output dataset, which
    -- the guard asks before anything about branches.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz849_in', 'zz849_in') RETURNING id INTO v_in;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_in, 'master') RETURNING id INTO v_inbr;
    -- and the logic has to have something to run over, so the input is real.
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_in, v_inbr, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_in, v_txn, '[{"name":"n","type":"LONG"}]'::jsonb);
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn;
    PERFORM public.dataset_materialize(v_in, v_txn);
    INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (v_ds, v_in);

    -- 2. TWO job specs for one output, on two branches — which the old UNIQUE
    --    foreclosed, and which is the whole point of a branch dimension.
    INSERT INTO public.job_specs (output_dataset_id, logic_sql, branch_name)
      VALUES (v_ds, 'SELECT 1 AS n', 'master') RETURNING id INTO v_spec;
    INSERT INTO public.job_specs (output_dataset_id, logic_sql, branch_name)
      VALUES (v_ds, 'SELECT 2 AS n', 'feature') RETURNING id INTO v_spec2;
    SELECT count(*) INTO v_n FROM public.job_specs WHERE output_dataset_id = v_ds;
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: % spec(s) for one output', v_n; END IF;
    RAISE NOTICE 'PROVED: one output carries a job spec per branch — the old UNIQUE forbade it';

    -- 3. And still only one per output per branch.
    v_ok := false;
    BEGIN
      INSERT INTO public.job_specs (output_dataset_id, logic_sql, branch_name)
        VALUES (v_ds, 'SELECT 3 AS n', 'master');
    EXCEPTION WHEN unique_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'PROOF FAILED: two specs landed on one branch for one output'; END IF;
    RAISE NOTICE 'PROVED: and still exactly one per output per branch';

    -- 4. A build runs its own branch's specs, and not another branch's.
    INSERT INTO public.builds (organization_id, requested_by, branch_name)
      VALUES (v_org, v_user, 'master') RETURNING id INTO v_build;
    INSERT INTO public.build_jobs (build_id, job_spec_id, output_dataset_id)
      VALUES (v_build, v_spec, v_ds);
    v_ok := false;
    BEGIN
      INSERT INTO public.build_jobs (build_id, job_spec_id, output_dataset_id)
        VALUES (v_build, v_spec2, v_ds);
    EXCEPTION WHEN others THEN
      IF SQLERRM NOT LIKE '%JobSpecOnAnotherBranch%' THEN RAISE; END IF;
      v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'PROOF FAILED: a master build ran a feature branch job spec';
    END IF;
    RAISE NOTICE 'PROVED: a build refuses a job spec published on another branch, and names why';

    RAISE EXCEPTION 'ZZ849_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ849_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz849';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
