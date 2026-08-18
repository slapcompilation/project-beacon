-- The same conjunct 558 added, one table over.
--
-- `project_resources` is the placement ledger — which resource sits in which
-- project and folder. Its WRITE policy already requires a role
-- (`role_rank(project_role(project_id)) >= role_rank('editor')`); its READ
-- policy asked only for the organization. So a caller with no role on a
-- project could not see the project (since 558) and could still enumerate what
-- is inside it.
--
-- That is the shape `security/projects-and-roles` rules out from the other
-- direction:
--
--   "role grants inherit to child resources. For example, granting a user
--    Viewer on a Project or folder gives them Viewer on all resources
--    contained by that Project or folder."
--
-- Inheritance is how a role reaches a project's contents. Nothing else does,
-- and organization membership least of all — it is a mandatory control, and
-- those "will always prevent... regardless of the user's role" rather than
-- permit.
--
-- Checked before writing, as 558 was: zero user/row pairs lose visibility, and
-- the table is empty today. The fix is free now and would not have been later.
--
-- ── WHAT THE SWEEP FOUND, AND WHY THE REST IS NOT THIS ──────────────────────
-- Every permissive read policy gated on `auth_org_id` alone was listed — 36 of
-- them — and the rest are org-level directories or documented as
-- organization-visible, not project contents:
--
--   * users, groups, group_members, tags, tag_categories, spaces,
--     space_organizations, organizations — the registries a member of an
--     organization is meant to see.
--   * portfolios, portfolio_curators — "Any user with access to a Space can
--     view its Portfolios, but users still separately need permissions to view
--     the Projects inside a Portfolio" (security/portfolios). Org-visible by
--     specification, and 555 asserts exactly that.
--   * collections, collection_resources — "Anyone can view collections and
--     their descriptions, but you will only have access to curated files that
--     are shared with you" (compass/data-catalog). Same shape, stated.
--   * organization_roles, space_roles — the role vocabulary itself.
--   * the grant ledgers and scoped-session settings.
--
-- Recorded and NOT changed here: `builds`, `build_jobs`, `schedules` and
-- `schedule_runs` are org-scoped reads over pipeline objects that belong to
-- datasets, which belong to projects. Whether a build is a "child resource" of
-- its project in the inheritance sense is a question for whoever reads the
-- builds pages next; it is not answered by the pages this migration cites.

BEGIN;

DROP POLICY "members read project resources" ON public.project_resources;
CREATE POLICY "members read project resources" ON public.project_resources
  FOR SELECT TO authenticated
  USING (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND public.project_role(project_id) IS NOT NULL
  );

-- ── assertions, which execute the path and insert nothing durable ───────────
DO $do$
DECLARE org uuid; sp uuid; proj uuid; usr uuid; n int;
BEGIN
  -- A fixture is needed because the table is empty, so it is built inside a
  -- subtransaction and unwound by raising through it — 557's lesson, applied
  -- rather than repeated.
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe561') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe561') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe561', 'Probe561') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe561@beacon.test')
      RETURNING id INTO usr;
    -- `object_type` and `object_set` are the only kinds the CHECK admits.
    INSERT INTO public.project_resources (resource_kind, resource_id, project_id, organization_id)
      VALUES ('object_type', gen_random_uuid(), proj, org);

    -- A role holder sees the placement.
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (proj, usr, 'viewer', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', usr::text,
        'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.project_resources WHERE project_id = proj;
    RESET ROLE;
    IF n <> 1 THEN
      RAISE EXCEPTION 'a viewer cannot see the contents of their own project (saw %)', n;
    END IF;

    -- A member of the same organization with no role sees nothing.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid()::text,
        'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.project_resources WHERE project_id = proj;
    RESET ROLE;
    IF n <> 0 THEN
      RAISE EXCEPTION 'an organization member with no role enumerated the project contents';
    END IF;

    -- Unwind the fixture by failing this subtransaction on purpose.
    RAISE EXCEPTION 'probe561:done';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF sqlerrm <> 'probe561:done' THEN RAISE; END IF;
  END;

  -- And it really is gone.
  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe561';
  IF n <> 0 THEN
    RAISE EXCEPTION 'the probe fixture survived its own assertion';
  END IF;

  RAISE NOTICE '561: a project''s contents need a role on the project';
END $do$;

COMMIT;
