-- `schedules.scope` carried Foundry's two values and meant nothing: no function
-- reads it, no policy tests it, and a project-scoped schedule named no project.
--
-- ── WHAT THE API PUBLISHES, WHICH THE PROSE ONLY GESTURES AT ────────────────
-- `api/v2/orchestration-v2-resources/schedules/create-schedule` carries the
-- field as a union, and it is the boundary of the build rather than a label:
--
--   "scopeMode · union · required
--      The boundaries for the schedule build.
--      - project · object
--        The schedule will only build resources in the following projects.
--        - projectRids · list
--      - user · object
--        When triggered, the schedule will build all resources that the
--        associated user is permitted to build."
--
-- Two things settle here. A project-scoped schedule names a **list** of
-- projects, not one — the open question this closes. And the scope is what
-- bounds the build, which is why the same page warns against the other arm:
--
--   "If the schedule is created in user-scoped mode, outputs to build will be
--    discovered based on resources that the user has access to. If the user's
--    permissions change later, this could change the outputs that will be built
--    or cause builds to fail. Consider using a project-scoped schedule instead."
--
-- That is the same fragility `building-pipelines/scheduling-best-practices`
-- describes in prose — "All schedules should be Project-scoped when possible so
-- that a schedule's ability to run successfully does not depend on the
-- permissions of a single user (the schedule owner)."
--
-- ── HOW OURS DIFFERS, STATED RATHER THAN PAPERED OVER ──────────────────────
-- Foundry's user-scoped schedule DISCOVERS its outputs from what the owner can
-- build. Ours never discovers anything: `run_schedules` builds
-- `s.target_dataset_ids`, which the author named. So the discovery half of the
-- union has no analogue here and none is invented.
--
-- What does carry over is the boundary. "The schedule will only build resources
-- in the following projects" is enforceable against explicit targets, and that
-- is what this migration builds: a project-scoped schedule names its projects,
-- and every target must live in one of them.
--
-- Recorded, not built: notifications, whose behaviour the same page states —
-- "No notification will be sent if the schedule has `scopeMode` set to
-- `ProjectScope`" — and which we do not have.

BEGIN;

ALTER TABLE public.schedules
  ADD COLUMN scope_project_ids uuid[];

COMMENT ON COLUMN public.schedules.scope_project_ids IS
  'The projects a project-scoped schedule may build in — Foundry projectRids, a list. NULL for a user-scoped schedule, which has no project boundary.';

-- The union, as a constraint: `project` carries its list, `user` carries none.
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_scope_names_its_projects CHECK (
    (scope = 'project' AND scope_project_ids IS NOT NULL
                       AND array_length(scope_project_ids, 1) >= 1)
    OR
    (scope = 'user' AND scope_project_ids IS NULL)
  );

-- "The schedule will only build resources in the following projects."
CREATE OR REPLACE FUNCTION public.guard_schedule_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE stray text;
BEGIN
  IF NEW.scope <> 'project' THEN RETURN NEW; END IF;

  SELECT string_agg(d.name, ', ') INTO stray
    FROM unnest(NEW.target_dataset_ids) AS t(dataset_id)
    JOIN public.datasets d ON d.id = t.dataset_id
   WHERE d.project_id IS NULL
      OR NOT (d.project_id = ANY (NEW.scope_project_ids));
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Schedules:TargetOutsideScope — % lies outside the projects this schedule is scoped to', stray
      USING HINT = 'A project-scoped schedule only builds resources in the projects it names.';
  END IF;

  -- Every named project must exist. A dangling rid would silently narrow the
  -- boundary rather than fail, which is the worse of the two outcomes.
  SELECT string_agg(p::text, ', ') INTO stray
    FROM unnest(NEW.scope_project_ids) AS p
   WHERE NOT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p);
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'Schedules:ScopeProjectNotFound — %', stray;
  END IF;

  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_schedule_scope() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_schedule_scope
  BEFORE INSERT OR UPDATE OF scope, scope_project_ids, target_dataset_ids ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.guard_schedule_scope();

-- ── assertions, which execute the path and unwind their fixture ─────────────
DO $do$
DECLARE org uuid; sp uuid; proj uuid; other uuid; ds uuid; stray_ds uuid; n int; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe567') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe567') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe567a', 'In Scope') RETURNING id INTO proj;
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe567b', 'Out Of Scope') RETURNING id INTO other;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'p567_in', 'In') RETURNING id INTO ds;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, other, 'p567_out', 'Out') RETURNING id INTO stray_ds;

    -- A project-scoped schedule building inside its projects is fine.
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                  trigger, scope, scope_project_ids)
    VALUES (org, 'P567 ok', ARRAY[ds], 'manual',
            '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'project', ARRAY[proj]);

    -- One that reaches outside them is not.
    ok := false;
    BEGIN
      INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                    trigger, scope, scope_project_ids)
      VALUES (org, 'P567 stray', ARRAY[ds, stray_ds], 'manual',
              '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'project', ARRAY[proj]);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%TargetOutsideScope%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a project-scoped schedule built outside its projects'; END IF;

    -- The union holds in both directions: project without a list, user with one.
    ok := false;
    BEGIN
      INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                    trigger, scope)
      VALUES (org, 'P567 nolist', ARRAY[ds], 'manual',
              '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'project');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a project-scoped schedule named no projects'; END IF;

    ok := false;
    BEGIN
      INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                    trigger, scope, scope_project_ids)
      VALUES (org, 'P567 userlist', ARRAY[ds], 'manual',
              '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'user', ARRAY[proj]);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a user-scoped schedule carried a project boundary'; END IF;

    -- A user-scoped schedule is unbounded here, as it is there.
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, build_type,
                                  trigger, scope)
    VALUES (org, 'P567 user', ARRAY[ds, stray_ds], 'manual',
            '{"type":"time","cron":"0 4 * * *","timezone":"UTC"}'::jsonb, 'user');

    RAISE EXCEPTION 'probe567:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe567:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe567';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '567: a project-scoped schedule names its projects';
END $do$;

COMMIT;
