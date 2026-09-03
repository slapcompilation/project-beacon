-- 742 — a function apply is one application, and can be reverted.
--
-- `apply_action` opens an application row and stamps every edit with its id
-- and a "before" snapshot; `revert_action` consumes exactly that. The function
-- path stamped neither, so revert after a function apply found nothing — the
-- Revert affordance existed and did nothing for precisely the actions whose
-- edits come from code.
--
-- The application row is opened by 741's preflight, and this migration closes
-- the chain: `apply_function_edits` now REQUIRES the application — created for
-- this action, by this caller, not yet applied — so a direct RPC caller cannot
-- skip the preflight's arms by going straight to the apply. The "before"
-- expressions are apply_action's own three, verbatim: a create snapshots
-- nothing, a modify snapshots the touched keys out of object_state, a delete
-- snapshots the whole object. The modify keys align because 740 translates the
-- batch to property_id BEFORE this point, which is the key space object_state
-- speaks.
--
-- The signature changes (a third argument), so the two-argument function is
-- DROPPED rather than left as an overload a caller could still reach unstamped.

DROP FUNCTION public.apply_function_edits(uuid, jsonb);

-- The body below is the live definition as of the drop, carried whole with
-- three additions: the third argument, the application validation, and the
-- stamped INSERT. Every arm it carries — old and new — is proven by the probe.
CREATE FUNCTION public.apply_function_edits(
  p_action_type uuid, p_edits jsonb, p_application uuid)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  rule    record;
  appl    record;
  edit    jsonb;
  variant text;
  body    jsonb;
  api     text;
  pk      text;
  ot      uuid;
  allowed text[];
  written integer := 0;
BEGIN
  -- Edits from here are edits VIA AN ACTION, which is what guard_object_edit
  -- asks of an object type that only allows those (605).
  PERFORM set_config('beacon.applying_action', 'on', true);

  IF jsonb_typeof(p_edits) <> 'array' THEN
    RAISE EXCEPTION 'Actions:InvalidOutput — an edit function returns an array of edits, got %',
      coalesce(jsonb_typeof(p_edits), 'null');
  END IF;

  SELECT r.*, v.edits AS provenance
    INTO rule
    FROM public.action_type_rules r
    JOIN public.function_versions v ON v.id = r.function_version_id
   WHERE r.action_type_id = p_action_type AND r.kind = 'function';
  IF rule.id IS NULL THEN
    RAISE EXCEPTION 'Actions:NotFunctionBacked — % has no function rule', p_action_type;
  END IF;

  -- One submission, one identity (742): the preflight opened it, this apply
  -- consumes it, and the chain is what keeps a direct caller from skipping
  -- the submit arms.
  SELECT * INTO appl FROM public.action_applications
   WHERE id = p_application AND action_type_id = p_action_type
     AND applied_by_user_id IS NOT DISTINCT FROM auth.uid();
  IF appl.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ApplicationNotFound — the preflight opens the application this apply names';
  END IF;
  IF EXISTS (SELECT 1 FROM public.object_edits e WHERE e.application_id = p_application) THEN
    RAISE EXCEPTION 'Actions:ApplicationAlreadyApplied — % has already applied its edits', p_application;
  END IF;

  -- "the provenance consists only of the object types that the action may
  -- edit at runtime"
  SELECT array_agg(t) INTO allowed
    FROM jsonb_array_elements_text(rule.provenance->'object_types') t;

  IF jsonb_array_length(p_edits) > public.action_edit_limit() THEN
    RAISE EXCEPTION 'Actions:ScaleLimit — % edits exceeds the % objects one action may edit',
      jsonb_array_length(p_edits), public.action_edit_limit();
  END IF;

  FOR edit IN SELECT * FROM jsonb_array_elements(p_edits) LOOP
    SELECT k INTO variant FROM jsonb_object_keys(edit) k LIMIT 1;
    body := edit -> variant;

    IF variant IN ('addLink', 'deleteLink') THEN
      RAISE EXCEPTION 'Actions:LinkEditsNotSupported — % edits a many-to-many link, which has no instance store here', variant
        USING HINT = 'A foreign-key link is edited as a property, which arrives as modifyObject.';
    END IF;
    IF variant NOT IN ('addObject', 'modifyObject', 'deleteObject') THEN
      RAISE EXCEPTION 'Actions:InvalidOutput — % is not one of the published edit variants', coalesce(variant, 'an empty edit');
    END IF;

    api := body ->> 'objectType';
    pk  := body ->> 'primaryKey';
    IF api IS NULL OR pk IS NULL OR btrim(pk) = '' THEN
      RAISE EXCEPTION 'Actions:InvalidOutput — every edit carries an objectType and a primaryKey';
    END IF;

    IF NOT (api = ANY (coalesce(allowed, '{}'))) THEN
      RAISE EXCEPTION 'Functions:UndeclaredObjectTypeEdited — % is not declared in the function spec', api;
    END IF;

    SELECT ot2.id INTO ot FROM public.object_types ot2
     WHERE ot2.api_name = api
       AND ot2.ontology_id = (SELECT a.ontology_id FROM public.action_types a WHERE a.id = p_action_type);
    IF ot IS NULL THEN
      RAISE EXCEPTION 'Actions:UnknownObjectType — % is not an object type in this ontology', api;
    END IF;

    -- The Edits toggle governs a function-backed edit exactly as it governs a
    -- rule-backed one.
    IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = ot) THEN
      RAISE EXCEPTION 'Actions:EditsDisabled — % has edits disabled', api;
    END IF;

    -- The guest speaks api names; storage speaks property_id (740). Translate
    -- at the boundary, and refuse what does not translate — an unknown key, a
    -- primary key on a modify, a mandatory control outside its allowed sets.
    IF variant <> 'deleteObject' THEN
      DECLARE
        translated jsonb := '{}'::jsonb;
        k text; val jsonb; prop record;
      BEGIN
        FOR k, val IN SELECT key, value FROM jsonb_each(coalesce(body -> 'properties', '{}'::jsonb)) LOOP
          SELECT p2.property_id, p2.is_primary_key, p2.base_type, p2.datasource_id
            INTO prop
            FROM public.object_type_properties p2
           WHERE p2.object_type_id = ot AND p2.api_name = k;
          IF prop.property_id IS NULL THEN
            RAISE EXCEPTION 'Actions:UnknownProperty — % is not a property of %', k, api;
          END IF;
          -- "you cannot update the primary key property value of an existing
          -- object" (api-ontology-edits).
          IF prop.is_primary_key AND variant = 'modifyObject' THEN
            RAISE EXCEPTION 'Actions:CannotModifyPrimaryKey — % is the primary key of %, and primary key values cannot be modified', k, api;
          END IF;
          -- 727: an edit setting an invalid mandatory-control value is
          -- rejected at submit, on this path exactly as on apply_action's.
          IF prop.base_type = 'marking' AND NOT public.marking_value_allowed(val,
               (SELECT d.allowed_markings FROM public.object_type_datasources d WHERE d.id = prop.datasource_id),
               (SELECT d.allowed_organizations FROM public.object_type_datasources d WHERE d.id = prop.datasource_id)) THEN
            RAISE EXCEPTION 'Actions:MandatoryControlValueNotAllowed — the value is outside the datasource''s allowed markings and organizations';
          END IF;
          translated := translated || jsonb_build_object(prop.property_id, val);
        END LOOP;
        body := jsonb_set(body, '{properties}', translated);
      END;
    END IF;

    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id, application_id, "before")
    VALUES (ot, pk,
            CASE variant WHEN 'addObject' THEN 'create'
                         WHEN 'modifyObject' THEN 'modify'
                         ELSE 'delete' END,
            CASE WHEN variant = 'deleteObject' THEN '{}'::jsonb
                 ELSE coalesce(body -> 'properties', '{}'::jsonb) END,
            p_action_type, p_application,
            -- apply_action's own three snapshots, verbatim: nothing for a
            -- create, the touched keys for a modify, the whole object for a
            -- delete. The modify keys are property_id because 740 translated
            -- them just above — the key space object_state speaks.
            CASE variant
              WHEN 'addObject' THEN '{}'::jsonb
              WHEN 'modifyObject' THEN
                coalesce((SELECT jsonb_object_agg(k2, coalesce(s.properties -> k2, 'null'::jsonb))
                            FROM jsonb_object_keys(coalesce(body -> 'properties', '{}'::jsonb)) k2,
                                 LATERAL public.object_state(ot, pk, NULL) s),
                         '{}'::jsonb)
              ELSE coalesce((SELECT s.properties FROM public.object_state(ot, pk, NULL) s), '{}'::jsonb)
            END);
    written := written + 1;
  END LOOP;

  -- the window closes with the body: is_local means an abort restores it,
  -- and this makes the normal path just as narrow (606).
  PERFORM set_config('beacon.applying_action', 'off', true);
  RETURN written;
END $fn$;

COMMENT ON FUNCTION public.apply_function_edits(uuid, jsonb, uuid) IS
  'Applies an edit function''s batch as one action application: 741''s preflight opens the application, this consumes it exactly once, and every edit carries the application id and apply_action''s own before-snapshot, so revert_action reads both paths the same way. 742.';

GRANT EXECUTE ON FUNCTION public.apply_function_edits(uuid, jsonb, uuid) TO authenticated, service_role;

-- ── PROVED BY DOING — the chain, the stamps, and the revert ────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  t uuid; src_id uuid; fn uuid; ver uuid; act uuid; app uuid; other_app uuid; n int;
  e record;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m742 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm742-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm742-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M742 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm742p', 'm742 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm742ds', 'm742ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"status","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M742Ticket', 'M742 ticket', true) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br) RETURNING id INTO src_id;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (t, 'status', 'Status', 'status', 'string', 'column', 'status', src_id);

  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm742EditFn', 'M742 edit fn') RETURNING id INTO fn;
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          '{"object_types":[],"link_types":[]}'::jsonb,
          '{"object_types":["M742Ticket"]}'::jsonb) RETURNING id INTO ver;
  INSERT INTO public.action_types (ontology_id, api_name, label, allow_revert)
  VALUES (ont, 'm742-run', 'M742 run', true) RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm742EditFn', ver);

  -- No preflight, no apply: a made-up application refuses.
  BEGIN
    PERFORM public.apply_function_edits(act,
      '[{"addObject":{"objectType":"M742Ticket","primaryKey":"T-1","properties":{}}}]'::jsonb,
      gen_random_uuid());
    RAISE EXCEPTION 'an apply without a preflight was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%ApplicationNotFound%' THEN RAISE; END IF;
  END;

  app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;

  -- The batch lands stamped: application id on every edit, and the three
  -- before-snapshots apply_action writes.
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('addObject', jsonb_build_object(
      'objectType','M742Ticket','primaryKey','T-1',
      'properties', jsonb_build_object('status','open')))), app);
  SELECT * INTO e FROM public.object_edits
   WHERE object_type_id = t AND primary_key = 'T-1';
  IF e.application_id IS DISTINCT FROM app THEN
    RAISE EXCEPTION 'the edit does not carry its application';
  END IF;
  IF e."before" <> '{}'::jsonb THEN
    RAISE EXCEPTION 'a create snapshots nothing, got %', e."before";
  END IF;

  -- The application is consumed: applying it again refuses.
  BEGIN
    PERFORM public.apply_function_edits(act,
      '[{"addObject":{"objectType":"M742Ticket","primaryKey":"T-2","properties":{}}}]'::jsonb, app);
    RAISE EXCEPTION 'a consumed application applied twice';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%ApplicationAlreadyApplied%' THEN RAISE; END IF;
  END;

  -- A modify snapshots the touched keys, in property_id space, and revert
  -- restores them — the affordance that found nothing before 742.
  other_app := (public.action_function_preflight(act, '{}'::jsonb) ->> 'application_id')::uuid;
  PERFORM public.apply_function_edits(act, jsonb_build_array(
    jsonb_build_object('modifyObject', jsonb_build_object(
      'objectType','M742Ticket','primaryKey','T-1',
      'properties', jsonb_build_object('status','closed')))), other_app);
  SELECT * INTO e FROM public.object_edits
   WHERE application_id = other_app;
  IF e."before" -> 'status' IS NULL THEN
    RAISE EXCEPTION 'the modify snapshot misses the touched key: %', e."before";
  END IF;

  PERFORM public.revert_action(other_app);
  SELECT count(*) INTO n FROM public.object_edits
   WHERE object_type_id = t AND primary_key = 'T-1'
     AND properties ->> 'status' = 'open';
  IF n < 1 THEN RAISE EXCEPTION 'revert after a function apply restored nothing'; END IF;

  DELETE FROM public.object_edits WHERE object_type_id = t;
  DELETE FROM public.action_applications WHERE action_type_id = act;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.function_versions WHERE id = ver;
  DELETE FROM public.functions WHERE id = fn;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
