-- The action Schedule rule, from readings/trigger-schedule-build.md (built
-- after a human read its Decisions block).
--
--   "By configuring a **schedule rule** on an action type, you can trigger a build of that schedule whenever the action is applied."
--   — action-types/trigger-schedule-build.md
--
-- ── ORDERING IS UNCONDITIONAL ────────────────────────────────────────────────
--
--   "When an action type contains a schedule rule, the action's Ontology edits are applied *after* the build begins. Edits do not wait for the build to finish. Instead, the action triggers the build, captures the schedule run RID, and immediately applies the rest of the rules, including the Ontology edits."
--   — action-types/trigger-schedule-build.md
--
-- So apply_action runs schedule rules BEFORE its rule loop, whatever their
-- position, and keeps the last run's RID for the value source below.
--
-- ── PERMISSION MOVES TO EDIT TIME ────────────────────────────────────────────
--
--   "Foundry checks whether a user has permission to run the schedule the first time it is referenced and whenever the schedule rule is edited. Referencing a schedule from an action type delegates control over running it from the schedule to the action type. Anyone who can manage actions on the action type then controls who can trigger the schedule."
--   — action-types/trigger-schedule-build.md
--
-- The rule guard checks the EDITOR can run the schedule (our schedules'
-- manage boundary is the organization) at insert and update; apply time
-- performs no schedule check — the delegation. The delegated runner is the
-- single-schedule core of run_schedules (claims swapped to the schedule's
-- scoping identity, run_build, an outcome row), granted to authenticated but
-- refusing outside the beacon.applying_action window 605 opens — only an
-- action mid-apply can call it. It does NOT touch trigger_state: an
-- action-triggered run is the action's, not the trigger's (the reading's
-- question 2).
--
-- ── THE ONE REQUIREMENT ──────────────────────────────────────────────────────
--
--   "Add a schedule rule to an action type and select a schedule. The schedule must be in [project-scoped mode](/docs/foundry/data-integration/schedules/#project-scope)."
--   — action-types/trigger-schedule-build.md
--
-- ── THE RUN RID IS A VALUE SOURCE ────────────────────────────────────────────
--
--   "This RID is exposed as a value that can be referenced from the action type's Ontology edit rules, allowing you to write it into a string property of an edited object."
--   — action-types/trigger-schedule-build.md
--
-- schedule_runs gains a rid (grammar INFERENCE — no page in the mirror prints
-- a schedule RID; ours follows rid_of), and schedule_run_rid joins the rule
-- properties' value sources — converted to a function-valued set on the way.
-- The status the page renders (Running, Ignored, Failed, Succeeded) is our
-- schedule_runs.outcome vocabulary already, plus the in-flight build.
--
-- Parameterized schedules ("Required inputs") are excluded with the reading:
-- our schedules have no parameterization. The builder surface is a recorded
-- residual; the save path learns to CARRY the rule here (apply_action_type's
-- rules insert gains schedule_id), because a rule the save path wipes on the
-- next Studio save is the 667 defect again.

-- ── THE KIND ─────────────────────────────────────────────────────────────────
-- Patch the live definition, never retype it: one anchor, one refusal.
DO $do$
DECLARE src text; a1 text;
BEGIN
  src := replace(pg_get_functiondef('public.action_rule_kinds()'::regprocedure), chr(13), '');
  a1 := '''A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.'')';
  IF position(a1 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: action_rule_kinds is not the text 668 read';
  END IF;
  -- the anchor appears twice (create/delete link on interface); extend after
  -- the LAST occurrence by splitting on it
  src := substring(src from 1 for position(a1 in src) - 1)
      || replace(substring(src from position(a1 in src)), a1,
         a1 || ',
    (''schedule'', ''schedule'', true, ''sql'',
     ''Triggers a build of the named project-scoped schedule before the edits apply; the run RID becomes a value source.'')');
  EXECUTE src;
END $do$;

ALTER TABLE public.action_type_rules
  ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.action_type_rules.schedule_id IS
  'The schedule a schedule rule triggers (action-types/trigger-schedule-build). RESTRICT: a schedule referenced by an action cannot vanish out from under it.';

CREATE INDEX action_type_rules_schedule ON public.action_type_rules (schedule_id);

-- The kind demands its target, the target must be project-scoped, and the
-- EDITOR must be able to run it — the page's edit-time clock. A claims-less
-- path (a migration probe, a system fixture) still gets the deterministic
-- shape checks.
CREATE FUNCTION public.guard_schedule_rule() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s record;
BEGIN
  IF NEW.kind <> 'schedule' THEN
    IF NEW.schedule_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ontology:NotAScheduleRule — only a schedule rule names a schedule';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.schedule_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ScheduleRuleNeedsSchedule — a schedule rule names the schedule it triggers';
  END IF;
  SELECT * INTO s FROM public.schedules WHERE id = NEW.schedule_id;
  IF s.scope IS DISTINCT FROM 'project' THEN
    RAISE EXCEPTION 'Ontology:ScheduleNotProjectScoped — the schedule must be in project-scoped mode';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.auth_in_org(s.organization_id) THEN
    RAISE EXCEPTION 'Ontology:CannotRunSchedule — referencing a schedule delegates running it, so the editor must be able to run it themselves';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_schedule_rule BEFORE INSERT OR UPDATE ON public.action_type_rules
FOR EACH ROW EXECUTE FUNCTION public.guard_schedule_rule();

-- ── THE RUN RID ──────────────────────────────────────────────────────────────

ALTER TABLE public.schedule_runs
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('schedules', 'schedule-run', id)) STORED;

COMMENT ON COLUMN public.schedule_runs.rid IS
  'The schedule run RID the page has actions capture (action-types/trigger-schedule-build). Grammar is inference — no mirrored page prints a schedule RID — following our rid_of shape.';

CREATE UNIQUE INDEX schedule_runs_rid_key ON public.schedule_runs (rid);

-- The value-source set becomes function-valued as schedule_run_rid joins it.
CREATE FUNCTION public.action_rule_value_sources() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['parameter', 'object_parameter_property', 'static',
               'current_user', 'current_time', 'schedule_run_rid']
$$;

COMMENT ON FUNCTION public.action_rule_value_sources() IS
  'Where a rule property''s value comes from: the 418 set plus schedule_run_rid — the contextual source trigger-schedule-build exposes ("allowing you to write it into a string property of an edited object"). The capture''s Unique Identifier mapping type is a recorded residual, not a member.';

ALTER TABLE public.action_type_rule_properties
  DROP CONSTRAINT action_type_rule_properties_value_source_check;
ALTER TABLE public.action_type_rule_properties
  ADD CONSTRAINT action_type_rule_properties_value_source_check
  CHECK (value_source = ANY (public.action_rule_value_sources()));

-- ── THE DELEGATED RUNNER ─────────────────────────────────────────────────────

CREATE FUNCTION public.run_schedule_now(p_schedule uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE s record; u record; before text; built uuid; v_run uuid;
BEGIN
  -- "delegates control over running it from the schedule to the action type"
  -- — callable only inside the action window 605 opens
  IF current_setting('beacon.applying_action', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Actions:NotApplying — a schedule runs through an action only while that action is applying';
  END IF;
  SELECT * INTO s FROM public.schedules WHERE id = p_schedule;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actions:NoSuchSchedule — %', p_schedule;
  END IF;
  SELECT u2.id, u2.role, u2.organization_id INTO u
    FROM public.users u2 WHERE u2.id = s.updated_by;
  IF u IS NULL THEN
    INSERT INTO public.schedule_runs (schedule_id, outcome, error)
    VALUES (s.id, 'Failed', 'the schedule''s scoping user no longer exists')
    RETURNING id INTO v_run;
    RETURN v_run;
  END IF;

  -- the run_schedules recipe, one schedule at a time; trigger_state is the
  -- trigger's business, not the action's, and stays untouched
  before := current_setting('request.jwt.claims', true);
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u.id::text,
        'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
    built := public.run_build(s.target_dataset_ids, false, s.build_type);
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    INSERT INTO public.schedule_runs (schedule_id, outcome, build_id)
    VALUES (s.id, CASE WHEN built IS NULL THEN 'Ignored' ELSE 'Succeeded' END, built)
    RETURNING id INTO v_run;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    INSERT INTO public.schedule_runs (schedule_id, outcome, error)
    VALUES (s.id, 'Failed', sqlerrm)
    RETURNING id INTO v_run;
  END;
  RETURN v_run;
END $$;

COMMENT ON FUNCTION public.run_schedule_now(uuid) IS
  'The delegated runner behind the schedule rule: the single-schedule core of run_schedules — claims swapped to the schedule''s scoping identity, run_build, an outcome row whose RID the action captures. Refuses outside the applying-action window; a failure to start still yields a run row, because the edits never wait.';

REVOKE ALL ON FUNCTION public.run_schedule_now(uuid) FROM PUBLIC, anon;

-- ── APPLY RUNS SCHEDULE RULES FIRST, AND RESOLVES THE RID ────────────────────
-- Patch the live definition, never retype it: three anchors, one refusal.
DO $do$
DECLARE src text; a1 text; a2 text; a3 text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  a1 := '  ref_pk   text;';
  a2 := 'FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type ORDER BY position
  LOOP';
  a3 := 'WHEN ''current_time'' THEN to_jsonb(now())';
  IF position(a1 in src) = 0 OR position(a2 in src) = 0 OR position(a3 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: apply_action is not the text 668 read';
  END IF;
  src := replace(src, a1, a1 || '
  sched_run uuid;');
  src := replace(src, a2,
'-- the action triggers the build, captures the run RID, and immediately
  -- applies the rest of the rules (the header quotes the page) — schedule
  -- rules first, whatever their position
  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type AND kind = ''schedule''
            ORDER BY position
  LOOP
    sched_run := public.run_schedule_now(r.schedule_id);
  END LOOP;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type AND kind <> ''schedule''
            ORDER BY position
  LOOP');
  src := replace(src, a3, a3 || '
          WHEN ''schedule_run_rid'' THEN
            to_jsonb((SELECT sr.rid FROM public.schedule_runs sr WHERE sr.id = sched_run))');
  EXECUTE src;
END $do$;

-- ── THE SAVE PATH CARRIES THE RULE ───────────────────────────────────────────
-- apply_action_type's rules insert gains schedule_id, so a schedule rule
-- round-trips through a Studio save instead of dying on the next one.
DO $do$
DECLARE src text; a1 text; a2 text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action_type(jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  a1 := '(action_type_id, kind, position, object_type_id, link_type_id, function_name,
       function_version_id, auto_upgrade, interface_id)';
  a2 := 'nullif(e->>''interface_id'','''')::uuid)
    RETURNING id INTO rid;';
  IF position(a1 in src) = 0 OR position(a2 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: apply_action_type is not the text 668 read';
  END IF;
  src := replace(src, a1,
'(action_type_id, kind, position, object_type_id, link_type_id, function_name,
       function_version_id, auto_upgrade, interface_id, schedule_id)');
  src := replace(src, a2,
'nullif(e->>''interface_id'','''')::uuid,
            nullif(e->>''schedule_id'','''')::uuid)
    RETURNING id INTO rid;');
  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_org2 uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid;
  v_usr2 uuid; v_ds uuid; v_br uuid; v_ot uuid; v_pid uuid; v_rid_pid uuid;
  v_dsid uuid; v_sched uuid; v_bad uuid; v_act uuid; v_rid text; v_n int; v_state jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe668') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe668') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe668', 'Probe668') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe668', 'Probe 668', false) RETURNING id INTO v_ont;
    v_usr := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe668-' || v_usr || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, 'probe668-' || v_usr || '@beacon.test', 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe668', 'Probe668') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, trigger,
                                  scope, scope_project_ids, updated_by)
      VALUES (v_org, 'Probe668', ARRAY[v_ds],
              '{"type": "time", "cron": "0 * * * *", "timezone": "UTC"}',
              'project', ARRAY[v_proj], v_usr)
      RETURNING id INTO v_sched;
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, trigger, updated_by)
      VALUES (v_org, 'Probe668 user-scoped', ARRAY[v_ds],
              '{"type": "time", "cron": "0 * * * *", "timezone": "UTC"}', v_usr)
      RETURNING id INTO v_bad;

    INSERT INTO public.object_types (ontology_id, api_name, label)
      VALUES (v_ont, 'Probe668Run', 'Probe668 Run') RETURNING id INTO v_ot;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_dsid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column, is_primary_key, is_title_key, required)
      VALUES (v_ot, 'run_key', 'runKey', 'Run key', 'string', 'column',
              v_dsid, 'run_key', true, true, true) RETURNING id INTO v_pid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column)
      VALUES (v_ot, 'run_rid', 'runRid', 'Run RID', 'string', 'column',
              v_dsid, 'run_rid') RETURNING id INTO v_rid_pid;
    UPDATE public.object_types SET edits_enabled = true WHERE id = v_ot;

    -- the action: the schedule rule (deliberately LAST by position) and a
    -- create rule whose run_rid property reads the captured RID — through the
    -- save path, proving it carries schedule_id
    v_act := public.save_action_type(jsonb_build_object(
      'api_name', 'probe-668-run', 'label', 'Probe 668 run', 'ontology_id', v_ont::text,
      'parameters', jsonb_build_array(jsonb_build_object(
        'api_name', 'runKey', 'display_name', 'Run key', 'base_type', 'string',
        'required', true, 'position', 0)),
      'rules', jsonb_build_array(
        jsonb_build_object('kind', 'create_object', 'position', 0,
          'object_type_id', v_ot::text,
          'properties', jsonb_build_array(
            jsonb_build_object('property_id', v_pid::text,
              'value_source', 'parameter', 'parameter_api_name', 'runKey'),
            jsonb_build_object('property_id', v_rid_pid::text,
              'value_source', 'schedule_run_rid'))),
        jsonb_build_object('kind', 'schedule', 'position', 1,
          'schedule_id', v_sched::text))));
    PERFORM public.save_working_state();

    -- refusals: a user-scoped schedule, a missing schedule, an editor of
    -- another organization
    BEGIN
      INSERT INTO public.action_type_rules (action_type_id, kind, position, schedule_id)
      VALUES (v_act, 'schedule', 2, v_bad);
      RAISE EXCEPTION 'a user-scoped schedule was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:ScheduleNotProjectScoped%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.action_type_rules (action_type_id, kind, position)
      VALUES (v_act, 'schedule', 2);
      RAISE EXCEPTION 'a schedule rule without a schedule was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:ScheduleRuleNeedsSchedule%' THEN RAISE; END IF;
    END;
    INSERT INTO public.organizations (name) VALUES ('probe668-other') RETURNING id INTO v_org2;
    v_usr2 := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe668b-' || v_usr2 || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr2, 'probe668b-' || v_usr2 || '@beacon.test', 'admin', v_org2);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr2::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org2))::text, true);
    BEGIN
      INSERT INTO public.action_type_rules (action_type_id, kind, position, schedule_id)
      VALUES (v_act, 'schedule', 2, v_sched);
      RAISE EXCEPTION 'a foreign editor referenced the schedule';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Ontology:CannotRunSchedule%' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- the runner refuses outside the action window
    BEGIN
      PERFORM public.run_schedule_now(v_sched);
      RAISE EXCEPTION 'the runner ran outside the action window';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:NotApplying%' THEN RAISE; END IF;
    END;

    -- the apply: the schedule rule runs FIRST despite position 1, the run
    -- lands (Ignored — no job spec computes the dataset), the RID is written
    -- into the created object's property, and trigger_state stays untouched
    SELECT trigger_state INTO v_state FROM public.schedules WHERE id = v_sched;
    v_n := public.apply_action(v_act, '{"runKey": "R-1"}');
    IF v_n < 1 THEN
      RAISE EXCEPTION 'the create rule should have written an edit';
    END IF;
    SELECT sr.rid INTO v_rid FROM public.schedule_runs sr
     WHERE sr.schedule_id = v_sched AND sr.outcome = 'Ignored';
    IF v_rid IS NULL THEN
      RAISE EXCEPTION 'the delegated run should have landed as Ignored';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.object_edits e
       WHERE e.object_type_id = v_ot
         AND (e.properties ->> 'runRid' = v_rid OR e.properties ->> 'run_rid' = v_rid)) THEN
      RAISE EXCEPTION 'the run RID was not written into the edited object';
    END IF;
    IF (SELECT trigger_state FROM public.schedules WHERE id = v_sched)
       IS DISTINCT FROM v_state THEN
      RAISE EXCEPTION 'an action-triggered run must not consume the trigger state';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '668 proved: the schedule rule round-trips the save path, refuses a user-scoped schedule, a missing schedule and a foreign editor, the runner refuses outside the action window, and one apply starts the run first, writes its RID into the created object, and leaves the trigger state alone';
  END;
END $$;
