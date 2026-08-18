-- The role conjunct the read path never had.
-- From `readings/access-model-and-permission-vocabulary`, approved.
--
-- ── THE PUBLISHED FORMULA ───────────────────────────────────────────────────
-- The Check access panel has to state the rule in order to explain a verdict,
-- and does — `security/checking-permissions`:
--
--   "Displayed under Access requirements, this includes:
--    1. Satisfying the Organization and Marking requirements.
--    2. Having one or more roles (directly, via a group, or a default role)."
--
-- Two clauses, and the second was missing here. The asymmetry is the reason it
-- matters — `security/projects-and-roles`:
--
--   "mandatory controls, Organizations and Markings, will always prevent an
--    ineligible user from accessing a resource, regardless of the user's role."
--
-- Mandatory controls only subtract. A role is the only thing that grants, and
-- with no role required, membership of the organization was granting instead.
--
-- ── BOTH HALVES ALREADY EXISTED ─────────────────────────────────────────────
-- `resource_file_access` is the mandatory half: organization, markings, scoped
-- session. `project_role` is the discretionary half and is already complete —
-- a direct grant, a grant to a group the caller is in, and the project's
-- `default_role`, ordered by `role_rank` so the strongest wins. Those are
-- exactly the three routes clause 2 names. Nothing needed building; the read
-- policies simply called one and not the other.
--
-- ── AND FOLDERS ALREADY DID IT RIGHT ────────────────────────────────────────
-- `project readers see folders` is already
-- `resource_file_access('folder', id, organization_id)
--    AND (project_role(project_id) IS NOT NULL)`.
-- So this is not a new pattern being introduced — it is two sibling policies
-- being brought into line with the third, which had it from the start.
--
-- ── WHY NO BACKFILL, WHICH WAS THE OPEN QUESTION ────────────────────────────
-- The reading asked whether existing projects need a `default_role` so that
-- adding the conjunct preserves behaviour, and whether that default should be
-- `viewer` or `discoverer`. **Neither, as it turns out.** Every user/resource
-- pair in production was checked before writing this: both users hold an
-- explicit `owner` grant on the one shared project, and each personal project
-- is owned by its person. **Zero pairs lose visibility.** The data already
-- satisfies the stricter rule, so inventing a default role would have been a
-- change dressed as a migration.
--
-- `can_read_dataset` is SECURITY INVOKER over the guarded table, so it
-- inherits this through RLS rather than needing its own edit.

BEGIN;

DROP POLICY "members read projects" ON public.projects;
CREATE POLICY "members read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.resource_file_access('project', id, organization_id)
    AND public.project_role(id) IS NOT NULL
  );

DROP POLICY "members read datasets" ON public.datasets;
CREATE POLICY "members read datasets" ON public.datasets
  FOR SELECT TO authenticated
  USING (
    public.resource_file_access('dataset', id, organization_id)
    AND public.project_role(project_id) IS NOT NULL
  );

-- ── assertions, which execute the path and INSERT NOTHING ───────────────────
-- 557's lesson is that a migration with no COMMIT of its own is wrapped in
-- one, so anything an assertion inserts is committed with the schema change.
-- The better answer than cleaning up is having nothing to clean: every
-- predicate here reads the caller from `request.jwt.claims`, and `auth.uid()`
-- does not require the subject to exist. So the stranger below is a claim, not
-- a row.
DO $do$
DECLARE org uuid; usr uuid; proj uuid; n int;
BEGIN
  SELECT p.id, p.organization_id INTO proj, org
    FROM public.projects p WHERE p.api_name = 'example_data';
  IF proj IS NULL THEN
    RAISE EXCEPTION '558: no example project to assert against';
  END IF;

  -- A real grantee still reads what they read yesterday. This is the half a
  -- careless tightening breaks, so it is checked first.
  SELECT g.user_id INTO usr FROM public.project_role_grants g
   WHERE g.project_id = proj AND g.user_id IS NOT NULL LIMIT 1;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  RESET ROLE;
  IF n <> 1 THEN
    RAISE EXCEPTION 'a grantee lost the project they hold a role on';
  END IF;

  -- And a member of the SAME organization holding no role now sees nothing.
  -- Same organization on purpose: the mandatory half must pass, so the role is
  -- the only variable — 555 learned that twice. The claimed role is
  -- `limited_access` rather than `admin`, because `admins and owners write
  -- projects` is a FOR ALL policy and would otherwise admit the SELECT on its
  -- own, which is the other half of the same lesson.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  IF n <> 0 THEN
    RESET ROLE;
    RAISE EXCEPTION 'an organization member with no role still reads the project';
  END IF;
  SELECT count(*) INTO n FROM public.datasets;
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'an organization member with no role still reads % dataset(s)', n;
  END IF;

  RAISE NOTICE '558: access is a conjunction on the read path too';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
