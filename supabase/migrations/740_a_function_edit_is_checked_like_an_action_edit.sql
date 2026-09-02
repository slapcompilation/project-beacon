-- 740 — a function edit is checked like an action edit.
--
-- `apply_function_edits` validated the batch's frame — the variants, the
-- provenance, the scale limit, the edits toggle — and then inserted
-- `body->'properties'` verbatim. Three arms `apply_action` enforces never ran
-- on the function path, and the third is F3's seam making its third
-- appearance:
--
--   * a modifyObject could carry the primary key. The page:
--
--       "Note that you cannot update the primary key property value of an
--        existing object."
--       — functions/api-ontology-edits.md
--
--   * a marking property could be written unchecked — 727 put the refusal in
--     apply_action and the indexer, and a function batch walked past both at
--     submit time. Same helper, same error name, so a caller cannot tell the
--     two paths apart.
--
--   * the property KEYS were never validated, and worse, never translated.
--     The guest audience is authored code, which speaks api names
--     (`newLaptopRequest.employeeName = ...` — functions/types-reference.md's
--     own example); storage speaks property_id since 715. A guest writing
--     `noteText` against a property whose id is `note_text` landed an edit
--     `object_state` would never merge — silently, at index time, far from
--     the submit. The boundary now translates api name to property_id and
--     refuses a key that is no property, the same audience ruling 739 stated
--     for the imports wire: code speaks api names, storage speaks ids,
--     conversion at the boundary.
--
-- Live exposure: zero rows in object_edits carry an action-function
-- provenance; the arms bind forward.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_function_edits';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'insert anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$    -- The guest speaks api names; storage speaks property_id (740). Translate
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

    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — each arm, and the translation, through the function ───

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  rv uuid; t uuid; rvsrc uuid; fn uuid; ver uuid; act uuid; mk uuid := gen_random_uuid();
  n int; landed jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m740 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm740-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm740-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M740 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm740p', 'm740 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm740ds', 'm740ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},
                     {"name":"note_text","type":"STRING"},
                     {"name":"ctrl","type":"ARRAY","arraySubType":{"type":"STRING"}},
                     {"name":"owner_id","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm740rv', 'm740rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M740Ticket', 'M740 ticket', true) RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id, allowed_markings)
  VALUES (t, rv, ARRAY[mk]) RETURNING id INTO rvsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);
  -- The seam on purpose: property_id and api name DIFFER.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id)
  VALUES (t, 'note_text', 'Note', 'noteText', 'string', 'column', 'note_text', rvsrc);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, datasource_id, required, visibility, allow_empty_arrays)
  VALUES (t, 'ctrl', 'Control', 'ctrl', 'marking', 'column', 'ctrl', rvsrc, true, 'hidden', true);

  INSERT INTO public.functions (ontology_id, api_name, display_name)
  VALUES (ont, 'm740EditFn', 'M740 edit fn') RETURNING id INTO fn;
  INSERT INTO public.function_versions
    (function_id, major, minor, patch, source, signature, imports, edits)
  VALUES (fn, 1, 0, 0, 'export default function f(){return []}',
          '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb,
          '{"object_types":[],"link_types":[]}'::jsonb,
          '{"object_types":["M740Ticket"]}'::jsonb) RETURNING id INTO ver;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'm740-run', 'M740 run') RETURNING id INTO act;
  INSERT INTO public.action_type_rules
    (action_type_id, kind, position, function_name, function_version_id)
  VALUES (act, 'function', 0, 'm740EditFn', ver);

  -- An unknown key refuses by name.
  BEGIN
    PERFORM public.apply_function_edits(act,
      '[{"addObject":{"objectType":"M740Ticket","primaryKey":"T-1","properties":{"nonsense":"x"}}}]'::jsonb);
    RAISE EXCEPTION 'an unknown property was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%UnknownProperty%' THEN RAISE; END IF;
  END;

  -- A modify carrying the primary key refuses by name.
  BEGIN
    PERFORM public.apply_function_edits(act,
      '[{"modifyObject":{"objectType":"M740Ticket","primaryKey":"T-1","properties":{"id":"T-9"}}}]'::jsonb);
    RAISE EXCEPTION 'a primary key modify was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%CannotModifyPrimaryKey%' THEN RAISE; END IF;
  END;

  -- A marking outside the allowed sets refuses with apply_action's own name.
  BEGIN
    PERFORM public.apply_function_edits(act,
      jsonb_build_array(jsonb_build_object('addObject', jsonb_build_object(
        'objectType', 'M740Ticket', 'primaryKey', 'T-1',
        'properties', jsonb_build_object('ctrl', jsonb_build_array(gen_random_uuid()))))));
    RAISE EXCEPTION 'a foreign marking value was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%MandatoryControlValueNotAllowed%' THEN RAISE; END IF;
  END;

  -- The allowed value lands, and it lands TRANSLATED: the guest wrote api
  -- names, the stored edit speaks property_id.
  PERFORM public.apply_function_edits(act,
    jsonb_build_array(jsonb_build_object('addObject', jsonb_build_object(
      'objectType', 'M740Ticket', 'primaryKey', 'T-1',
      'properties', jsonb_build_object('noteText', 'hello', 'ctrl', jsonb_build_array(mk))))));
  SELECT properties INTO landed FROM public.object_edits
   WHERE object_type_id = t AND primary_key = 'T-1';
  IF NOT (landed ? 'note_text') OR landed ? 'noteText' THEN
    RAISE EXCEPTION 'the boundary did not translate: %', landed;
  END IF;
  SELECT count(*) INTO n FROM public.object_edits WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION '% edits landed, not 1', n; END IF;

  DELETE FROM public.object_edits WHERE object_type_id = t;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.function_versions WHERE id = ver;
  DELETE FROM public.functions WHERE id = fn;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
