-- Schedules were readable and writable by anyone in the organization. The
-- rule is published, and it is about the DATASETS, not the organization.
--
-- ── THE CITATION, WHICH IS UNUSUALLY EXACT ──────────────────────────────────
--   "To edit, delete, or pause a schedule, you need to have `Editor`
--    permissions on the target dataset and `Editor` permissions on the Project
--    to which the schedule is scoped. To view a schedule, you need to have
--    `Viewer` permissions on the target dataset."
--                        (building-pipelines/schedule-troubleshooting)
--
-- and, for the project-scoped case, with the quantifier stated by consequence:
--
--   "To edit a schedule in Project-scoped mode, you must have `Editor`
--    permissions on the target datasets, `Viewer` permissions on the trigger
--    datasets, and `Editor` permissions on the Project to which the schedule is
--    scoped. If you lost permissions for one dataset, remove this dataset from
--    the schedule before you save your changes."
--
-- That last sentence settles ALL-versus-ANY on the write path: losing
-- permission on ONE target blocks the save, so editing needs every target.
--
-- ── READ IS `ANY`, AND THAT IS AN INFERENCE ─────────────────────────────────
-- The view rule says "the target dataset", singular, because a Foundry
-- schedule typically has one. Ours carries `target_dataset_ids`, an array.
-- *Inference, marked*: a schedule is visible if the caller can view ANY target
-- it builds. The Build Schedules application supports that reading — its search
-- finds schedules "by the datasets or other files in Foundry that they build"
-- (`building-pipelines/find-manage-schedules`), so a schedule is reached
-- THROUGH a file you can already see. Requiring all targets would hide a
-- schedule from someone who can see most of what it builds, which that search
-- would then contradict.
--
-- ── WHAT IS NOT BUILT, AND WHY ──────────────────────────────────────────────
-- "`Editor` permissions on the Project to which the schedule is scoped" needs
-- the schedule to name that project. `schedules.scope` already carries
-- Foundry's two values — `user` and `project` — but no `project_id` column
-- exists, so the scoped project is unmodelled. Where a schedule is scoped to
-- the project holding its targets the two clauses collapse, and the dataset
-- clause below is the whole rule; where it is not, the second clause is simply
-- absent. **Recorded as a schema gap rather than inferred**, because choosing
-- which project a schedule is scoped to is Foundry's user's decision and not
-- ours to derive.
--
-- Builds, build_jobs and schedule_runs are LEFT ALONE. No page read states who
-- may view a build, and `data-integration/application-reference` describes the
-- Builds application as showing "all builds occurring across Foundry", which
-- is a product description rather than a permission. Guessing there is what
-- this migration deliberately does not do.

BEGIN;

-- The caller's role on a dataset is their role on the project holding it —
-- "role grants inherit to child resources". SECURITY DEFINER for 560's reason:
-- a predicate consulted by a policy must not be subject to the RLS it decides,
-- and `datasets` is guarded.
CREATE OR REPLACE FUNCTION public.dataset_role(p_dataset uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.project_role(d.project_id)
    FROM public.datasets d WHERE d.id = p_dataset
$fn$;
REVOKE ALL ON FUNCTION public.dataset_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dataset_role(uuid) TO authenticated;
COMMENT ON FUNCTION public.dataset_role(uuid) IS
  'The caller''s role on a dataset, inherited from the project that holds it.';

DROP POLICY "org members see schedules" ON public.schedules;
CREATE POLICY "viewers of a target dataset see the schedule" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND EXISTS (
      SELECT 1 FROM unnest(target_dataset_ids) AS t(dataset_id)
       WHERE public.role_rank(public.dataset_role(t.dataset_id))
             >= public.role_rank('viewer'))
  );

DROP POLICY "builders manage schedules" ON public.schedules;
CREATE POLICY "editors of every target dataset manage the schedule" ON public.schedules
  FOR ALL TO authenticated
  USING (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(target_dataset_ids) AS t(dataset_id)
       WHERE public.role_rank(public.dataset_role(t.dataset_id))
             < public.role_rank('editor'))
  )
  WITH CHECK (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(target_dataset_ids) AS t(dataset_id)
       WHERE public.role_rank(public.dataset_role(t.dataset_id))
             < public.role_rank('editor'))
  );

-- ── assertions, which execute the path and unwind their fixture ─────────────
DO $do$
DECLARE org uuid; sp uuid; proj uuid; ds uuid; br uuid; sch uuid; usr uuid; n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe562') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe562') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe562', 'Probe562') RETURNING id INTO proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'probe562_ds', 'Probe562 DS') RETURNING id INTO ds;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe562@beacon.test')
      RETURNING id INTO usr;
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                  trigger, scope, updated_by)
      VALUES (org, 'Probe562', ARRAY[ds], 'manual',
              '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'project', usr)
      RETURNING id INTO sch;

    -- A viewer of the target sees the schedule and cannot edit it.
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (proj, usr, 'viewer', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', usr::text,
        'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.schedules WHERE id = sch;
    IF n <> 1 THEN
      RESET ROLE; RAISE EXCEPTION 'a viewer of the target cannot see the schedule';
    END IF;
    UPDATE public.schedules SET paused = true WHERE id = sch;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    IF n <> 0 THEN
      RAISE EXCEPTION 'a viewer paused a schedule, which takes editor';
    END IF;

    -- An editor of every target may. The upgrade clears the claims first,
    -- because `enforce_grant_ceiling` caps a caller at their own role — a
    -- viewer cannot grant editor even to themselves, and even as an org admin.
    -- Its own escape is the migration path, `auth.uid() IS NULL`.
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE public.project_role_grants SET role = 'editor'
     WHERE project_id = proj AND user_id = usr;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', usr::text,
        'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.schedules SET paused = true WHERE id = sch;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    IF n <> 1 THEN
      RAISE EXCEPTION 'an editor of every target could not pause the schedule';
    END IF;

    -- And a member of the organization with no role sees nothing.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid()::text,
        'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.schedules WHERE id = sch;
    RESET ROLE;
    IF n <> 0 THEN
      RAISE EXCEPTION 'an organization member with no role sees the schedule';
    END IF;

    RAISE EXCEPTION 'probe562:done';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF sqlerrm <> 'probe562:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe562';
  IF n <> 0 THEN
    RAISE EXCEPTION 'the probe fixture survived its own assertion';
  END IF;

  RAISE NOTICE '562: a schedule is seen through the datasets it builds';
END $do$;

COMMIT;
