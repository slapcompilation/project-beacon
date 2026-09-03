-- 741 — a function-backed action submits like any other.
--
-- `apply_action` runs four things before any rule: it opens the application
-- (one submission, one identity), resolves the two prefill type classes,
-- refuses a missing required parameter, and asks the submission criteria. The
-- function path ran NONE of them — `action-apply` mapped inputs and went
-- straight to the isolate, so an action with a failing criterion executed, a
-- missing required parameter passed, and prefill_current_user arrived
-- unresolved.
--
-- These three are PRE-RUN facts: the parameters feed the isolate's arguments,
-- so resolving and refusing after the guest has run would be too late. Hence a
-- preflight the edge function calls first, whose arms are apply_action's own,
-- expression for expression — the prefill CASE, the resolved-requiredness
-- lookup through action_form_effective, and submission_criteria_verdict with
-- its exact error names, so a caller cannot tell the two paths apart:
--
--   "Submission criteria must pass as normal; if the action submission
--    criteria fail, then side effects will not be triggered."
--   — action-types/permissions.md
--
-- The application row opens here too, and 742 makes `apply_function_edits`
-- REQUIRE it — that chaining is what stops a direct RPC caller skipping the
-- preflight: no preflight, no application, no apply. A preflight whose isolate
-- run later fails leaves an application row with no edits; revert of an empty
-- application reverts nothing, which is the harmless reading, and it is said
-- here rather than discovered.

CREATE FUNCTION public.action_function_preflight(
  p_action_type uuid, p_parameters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  act record;
  par record;
  app uuid;
  verdict text;
BEGIN
  SELECT * INTO act FROM public.action_types WHERE id = p_action_type;
  IF act.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.action_type_rules r
                  WHERE r.action_type_id = p_action_type AND r.kind = 'function') THEN
    RAISE EXCEPTION 'Actions:NotFunctionBacked — % has no function rule', p_action_type;
  END IF;

  -- one submission, one identity: the revert names this, not the action type
  INSERT INTO public.action_applications (action_type_id, applied_by_user_id, revertible)
  VALUES (p_action_type, auth.uid(), act.allow_revert)
  RETURNING id INTO app;

  -- the two prefill type classes hold server-side: an absent value is filled,
  -- a submitted one is never overwritten (local values take precedence)
  FOR par IN SELECT api_name, type_classes FROM public.action_type_parameters
              WHERE action_type_id = p_action_type
                AND type_classes && ARRAY['generate_uuid', 'prefill_current_user']
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = 'null'::jsonb
       OR btrim(coalesce(p_parameters->>par.api_name, '')) = '' THEN
      p_parameters := jsonb_set(coalesce(p_parameters, '{}'::jsonb), ARRAY[par.api_name],
        CASE WHEN 'generate_uuid' = ANY (par.type_classes)
             THEN to_jsonb(gen_random_uuid()::text)
             ELSE to_jsonb(auth.uid()::text) END);
    END IF;
  END LOOP;

  -- requiredness is the RESOLVED requiredness, so a required-by-override
  -- parameter holds against a raw caller too
  FOR par IN SELECT p.api_name FROM public.action_type_parameters p
              WHERE p.action_type_id = p_action_type
                AND coalesce((public.action_form_effective(p_action_type, p_parameters)
                              #>> ARRAY['parameters', p.api_name, 'required'])::boolean,
                             p.required)
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = 'null'::jsonb
       OR btrim(p_parameters->>par.api_name) = '' THEN
      RAISE EXCEPTION 'Actions:MissingParameter — "%" is required', par.api_name;
    END IF;
  END LOOP;

  verdict := public.submission_criteria_verdict(p_action_type, p_parameters);
  IF verdict IS NOT NULL THEN
    RAISE EXCEPTION 'Actions:SubmissionCriteriaFailed — %', verdict;
  END IF;

  RETURN jsonb_build_object('application_id', app, 'parameters', p_parameters);
END $fn$;

COMMENT ON FUNCTION public.action_function_preflight(uuid, jsonb) IS
  'What apply_action runs before any rule, for the path that runs its rule in the isolate: the application row, the two prefill type classes, resolved requiredness, and the submission criteria — same expressions, same error names. The edge function calls this BEFORE the guest runs, because the parameters feed its arguments. 741.';

GRANT EXECUTE ON FUNCTION public.action_function_preflight(uuid, jsonb) TO authenticated, service_role;

-- ── PROVED BY DOING — each arm, with apply_action's own names ──────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; t uuid;
  fn uuid; ver uuid; act uuid; n int;
  got jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m741 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm741-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm741-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M741 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm741p', 'm741 probe') RETURNING id INTO proj;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M741Ticket', 'M741 ticket', true) RETURNING id INTO t;

  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm741EditFn', 'M741 edit fn') RETURNING id INTO fn;
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  -- A real edit function, because the rule guard refuses a version that does
  -- not apply edits.
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          '{"object_types":[],"link_types":[]}'::jsonb,
          '{"object_types":["M741Ticket"]}'::jsonb) RETURNING id INTO ver;

  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'm741-run', 'M741 run') RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm741EditFn', ver);
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, base_type, required, exposed, editable, position)
  VALUES (act, 'reason', 'Reason', 'string', true, true, true, 0),
         (act, 'requestedBy', 'Requested by', 'string', false, true, true, 1);
  UPDATE public.action_type_parameters
     SET type_classes = ARRAY['prefill_current_user']
   WHERE action_type_id = act AND api_name = 'requestedBy';

  -- A missing required parameter refuses with apply_action's own name.
  BEGIN
    PERFORM public.action_function_preflight(act, '{}'::jsonb);
    RAISE EXCEPTION 'a missing required parameter passed';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%MissingParameter%' THEN RAISE; END IF;
  END;

  -- The prefill fills what the caller left absent, and never overwrites.
  got := public.action_function_preflight(act, '{"reason":"because"}'::jsonb);
  IF got #>> '{parameters,requestedBy}' IS DISTINCT FROM usr::text THEN
    RAISE EXCEPTION 'prefill_current_user arrived unresolved: %', got -> 'parameters';
  END IF;
  IF (got ->> 'application_id') IS NULL THEN
    RAISE EXCEPTION 'no application row was opened';
  END IF;
  got := public.action_function_preflight(act,
    jsonb_build_object('reason', 'because', 'requestedBy', 'someone-else'));
  IF got #>> '{parameters,requestedBy}' <> 'someone-else' THEN
    RAISE EXCEPTION 'a submitted value was overwritten';
  END IF;

  -- A failing criterion refuses with its authored message.
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, node_type, logical_operator, position, failure_message)
  VALUES (act, 'logical', 'all', 0, 'M741 requirements not met.');
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, parent_id, node_type, position, template,
     parameter_id, operator, value_source, static_value, failure_message)
  SELECT act, c.id, 'condition', 0, 'parameter',
         (SELECT p.id FROM public.action_type_parameters p
           WHERE p.action_type_id = act AND p.api_name = 'reason'),
         'is not', 'static', '"no"'::jsonb, 'Reason may not be no.'
    FROM public.action_type_submission_criteria c
   WHERE c.action_type_id = act AND c.node_type = 'logical';
  BEGIN
    PERFORM public.action_function_preflight(act, '{"reason":"no"}'::jsonb);
    RAISE EXCEPTION 'a failing criterion executed';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%SubmissionCriteriaFailed%' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.action_applications WHERE action_type_id = act;
  IF n <> 2 THEN RAISE EXCEPTION '% application rows, not the 2 successful preflights', n; END IF;

  DELETE FROM public.action_applications WHERE action_type_id = act;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.function_versions WHERE id = ver;
  DELETE FROM public.functions WHERE id = fn;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
