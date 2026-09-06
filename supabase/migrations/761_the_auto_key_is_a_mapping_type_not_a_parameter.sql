-- The auto-generated key is a mapping type, not a parameter.
--
-- 760 built a create-or-modify rule's "Auto-generated primary key" as a hidden
-- string parameter carrying generate_uuid, mapped onto the key. The post-build
-- reconciliation refuted it against a capture this repository had already
-- read: the MAP TO menu of a rule property, open in
-- action-types/images/build-schedule-run-rid-property.png, is headed SELECT
-- MAPPING TYPE and lists Parameter, Static value, Unique Identifier (a key
-- glyph, with a submenu), Current User and Schedule run RID. Unique Identifier
-- is a sibling of Parameter, not a kind of one. 668 said so when it registered
-- the schedule source from the same capture (its COMMENT calls the Unique
-- Identifier mapping type a recorded residual, not a member) and
-- readings/trigger-schedule-build.md recorded it as the form's generate_uuid
-- cousin on the rule side. 760 reached for the form's cousin. Two more things
-- on the Gaia captures agree: in object-link-types/images/configure-create-
-- object-type.png the key row, Object Id → Unique Identifier 1, is the one MAP
-- TO row without the Configure-parameter arrow every parameter-mapped row
-- carries; and both wizard captures' PROPERTY tables omit the key entirely.
--
-- The rules page's four value sources stay what they were —
--
--   "Each property in turn is mapped to a value provided by one of multiple options (Rules on links can only take object reference parameters):"
--   — action-types/rules.md
--
-- "multiple options", of which the prose lists four and the capture shows two
-- more; 668 admitted the fifth from the capture, this admits the sixth.
--
-- So: unique_identifier joins action_rule_value_sources(); a rule property
-- with that source names no parameter and no static value (418's own XOR
-- checks already say so of the contextual sources); apply_action resolves it
-- as a UUID string — the format is INFERENCE, the walkthrough types the key
-- as a string and functions/edits-generate-id reaches for Uuid.random(); the
-- submenu's options are unrecorded (no capture opens it) and a Question. The
-- generator writes the key mapping with that source and creates no parameter.
-- Its object-parameter half changes one predicate: when the author names none
-- it reuses the parameter named after the type, or generates it — not the
-- first object parameter of the type it finds, which a link side or an
-- object-parameter-property default might own.
--
-- 760's type-class mechanism was never exercised outside its proof block,
-- which rolled back; no rule of the kind exists, so nothing is migrated.
-- generate_uuid stays what 666 made it: a form-side prefill on a parameter.

-- ── the sixth source ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.action_rule_value_sources() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['parameter', 'object_parameter_property', 'static',
               'current_user', 'current_time', 'schedule_run_rid', 'unique_identifier']
$$;
COMMENT ON FUNCTION public.action_rule_value_sources() IS
  'Where a rule property''s value comes from: the 418 set plus schedule_run_rid (668) and unique_identifier (761) — the two contextual sources the MAP TO menu in action-types/images/build-schedule-run-rid-property.png adds to the prose''s four. Unique Identifier generates the value at apply time and names nothing.';

-- ── apply_action resolves it ────────────────────────────────────────────────

DO $$
DECLARE src text; a text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  a := '          WHEN ''schedule_run_rid'' THEN';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION '761: the value CASE anchor is not exactly once in apply_action';
  END IF;
  src := replace(src, a,
'          -- Unique Identifier (761): generated at apply time; a UUID string is inference
          WHEN ''unique_identifier'' THEN to_jsonb(gen_random_uuid()::text)
' || a);
  EXECUTE src;
END $$;

-- ── the generator writes the mapping, not a parameter ───────────────────────

CREATE OR REPLACE FUNCTION public.generate_create_or_modify_parameters(p_action_type uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE r record; ty record; pk record; n int := 0; pos int; api text; pid uuid;
BEGIN
  SELECT coalesce(max(position), -1) + 1 INTO pos
    FROM public.action_type_parameters WHERE action_type_id = p_action_type;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type AND kind = 'create_or_modify_object'
            ORDER BY position
  LOOP
    SELECT * INTO ty FROM public.object_types WHERE id = r.object_type_id;
    CONTINUE WHEN ty.id IS NULL;

    -- "Modify existing selected": an object reference parameter named after
    -- the type when the author named none (594 names an interface's so) —
    -- reused by that name on a re-save, never another parameter of the type
    IF r.object_parameter_id IS NULL THEN
      api := regexp_replace(ty.api_name, '[^A-Za-z0-9]', '', 'g');
      api := lower(left(api, 1)) || right(api, -1);
      SELECT pa.id INTO pid FROM public.action_type_parameters pa
       WHERE pa.action_type_id = p_action_type AND pa.api_name = api
         AND pa.data_kind = 'object' AND pa.object_type_id = ty.id;
      IF pid IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.action_type_parameters
                    WHERE action_type_id = p_action_type AND api_name = api) THEN
          api := api || 'Object';
        END IF;
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, object_type_id, data_kind,
           required, exposed, editable, position)
        VALUES (p_action_type, api, ty.label, NULL, ty.id, 'object', false, true, true, pos)
        RETURNING id INTO pid;
        pos := pos + 1; n := n + 1;
      END IF;
      UPDATE public.action_type_rules SET object_parameter_id = pid WHERE id = r.id;
    END IF;

    -- Or create a new object with → Auto-generated primary key: the key row
    -- maps to the Unique Identifier mapping type, which names no parameter
    IF r.create_new_object_with = 'auto_generated_primary_key' THEN
      SELECT * INTO pk FROM public.object_type_properties
       WHERE object_type_id = ty.id AND is_primary_key;
      IF pk.id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.action_type_rule_properties rp
            WHERE rp.rule_id = r.id AND rp.property_id = pk.id) THEN
        INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source)
        VALUES (r.id, pk.id, 'unique_identifier');
        n := n + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN n;
END $fn$;
COMMENT ON FUNCTION public.generate_create_or_modify_parameters(uuid) IS
  'What a create-or-modify rule card compiles into (760, corrected 761): the object reference parameter its "Modify existing selected" chip is, named after the type when the author named none; and, for "Auto-generated primary key", the key row mapped to the Unique Identifier mapping type — a value source, not a parameter (action-types/images/build-schedule-run-rid-property.png). Idempotent: a re-save adds nothing.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE src text;
BEGIN
  IF NOT ('unique_identifier' = ANY (public.action_rule_value_sources())) THEN
    RAISE EXCEPTION 'unique_identifier should be a value source';
  END IF;
  src := pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure);
  IF position('WHEN ''unique_identifier'' THEN to_jsonb(gen_random_uuid()::text)' in src) = 0 THEN
    RAISE EXCEPTION 'apply_action should resolve unique_identifier';
  END IF;
END $$;

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid; ds uuid; br uuid;
  ty uuid; act uuid; key text; n int; srcname text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m761 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm761-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm761-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M761 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm761p', 'm761 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm761ds', 'm761ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M761Note', 'label', 'M761 Note', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(
      jsonb_build_object('property_id', 'note_id', 'display_name', 'Note Id', 'api_name', 'noteId',
        'base_type', 'string', 'source', 'column', 'backing_column', 'note_id',
        'is_primary_key', true, 'is_title_key', true, 'required', true)))
    INTO ty;
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id = ty;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, datasource_id, required)
  VALUES (ty, 'body', 'Body', 'body', 'string', 'column', 'body',
          (SELECT d.id FROM public.object_type_datasources d WHERE d.object_type_id = ty), false);

  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm761-upsert', 'label', 'M761 upsert', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'body', 'display_name', 'Body', 'base_type', 'string', 'required', true, 'position', 0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_or_modify_object', 'position', 0, 'object_type_id', ty,
      'create_new_object_with', 'auto_generated_primary_key',
      'properties', jsonb_build_array(
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'body'),
                           'value_source', 'parameter', 'parameter_api_name', 'body')))))) INTO act;
  PERFORM public.save_working_state();

  -- the key row is the mapping type; no parameter was minted for it
  SELECT rp.value_source INTO srcname
    FROM public.action_type_rule_properties rp
    JOIN public.action_type_rules r ON r.id = rp.rule_id
    JOIN public.object_type_properties p ON p.id = rp.property_id
   WHERE r.action_type_id = act AND p.is_primary_key;
  IF srcname IS DISTINCT FROM 'unique_identifier' THEN
    RAISE EXCEPTION 'the key row should map to unique_identifier, maps to %', srcname;
  END IF;
  SELECT count(*) INTO n FROM public.action_type_parameters
   WHERE action_type_id = act AND 'generate_uuid' = ANY (type_classes);
  IF n <> 0 THEN RAISE EXCEPTION 'no generate_uuid parameter should be minted, % were', n; END IF;
  SELECT count(*) INTO n FROM public.action_type_parameters WHERE action_type_id = act;
  IF n <> 2 THEN RAISE EXCEPTION 'the action should hold body and the generated object parameter, holds %', n; END IF;

  -- a re-save that names no object parameter reuses the generated one by name
  PERFORM public.save_action_type(jsonb_build_object('id', act, 'label', 'M761 upsert again'));
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.action_type_parameters WHERE action_type_id = act;
  IF n <> 2 THEN RAISE EXCEPTION 'a re-save should mint nothing, the action holds % parameters', n; END IF;

  -- nothing selected: a create keyed by the generated identifier
  IF public.apply_action(act, '{"body":"hello"}'::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the create should write one edit';
  END IF;
  SELECT primary_key INTO key FROM public.object_edits WHERE action_type_id = act AND instruction = 'create';
  IF key IS NULL OR length(key) <> 36 THEN
    RAISE EXCEPTION 'the create should carry a generated key, got %', key;
  END IF;
  -- selected: a modify, the key row standing aside
  IF public.apply_action(act, jsonb_build_object('m761Note', key, 'body', 'edited')) <> 1 THEN
    RAISE EXCEPTION 'the modify should write one edit';
  END IF;
  IF (SELECT properties FROM public.object_edits WHERE action_type_id = act AND instruction = 'modify')
     <> '{"body":"edited"}'::jsonb THEN
    RAISE EXCEPTION 'the modify should write the body only';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0761', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0761' THEN
  NULL;
END $$;
