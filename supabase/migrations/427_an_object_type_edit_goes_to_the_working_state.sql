-- Routing object type edits through the working state.
--
-- 426 built the layer and nothing reached it. `save_object_type` still wrote
-- straight to `object_types`, which is the thing the layer exists to stop:
--
--   "Any changes you make in the Ontology Manager are stored locally in a
--    work-in-progress state."          (ontology-manager/save-changes)
--
-- So the function splits in two, and the names say which is which:
--
--   save_object_type   → stages an edit. What the surface calls.
--   apply_object_type  → writes it. What save_working_state calls, and nothing
--                        else. It is the old body, unchanged.
--
-- The course confirms the visible consequence: on the object type Overview,
-- `RID` reads **"Set on save"** — a type has no identity in the ontology until
-- the session ends. Ours still mints the uuid up front, because the working
-- state entry has to be keyed by something, but the row does not exist until
-- the save.
--
-- ── PROPERTIES TRAVEL WITH THE TYPE ────────────────────────────────────────
-- An entry in the Review edits dialog is a resource, and properties appear as a
-- SECTION inside the object type's entry rather than as entries of their own —
-- resource → section → sub-resource → field, read off
-- `save-review-edits-error-navigate.png`. So `fields` carries a `properties`
-- array, and `ontology_resource_row` grows to match: the live shape a working
-- state entry is compared against must be the shape the dialog shows.

-- ── the resource as the dialog sees it ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ontology_resource_row(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE row_json jsonb; tbl text;
BEGIN
  tbl := CASE p_kind
           WHEN 'object_type'     THEN 'object_types'
           WHEN 'link_type'       THEN 'link_types'
           WHEN 'shared_property' THEN 'shared_properties'
           WHEN 'interface'       THEN 'ontology_interfaces'
           WHEN 'action_type'     THEN 'action_types'
           WHEN 'type_group'      THEN 'type_groups'
         END;
  IF tbl IS NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:UnknownResourceKind — % is not an ontology resource', p_kind;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', tbl)
    INTO row_json USING p_id;

  -- Properties and datasources are SECTIONS of the object type, not resources
  -- beside it. The creation wizard proves it for the datasource: "Use existing
  -- datasource → Select datasource" is step 2, before the type exists at all,
  -- so it cannot be a row that references one.
  IF row_json IS NOT NULL AND p_kind = 'object_type' THEN
    row_json := row_json
      || jsonb_build_object('properties', coalesce(
           (SELECT jsonb_agg(to_jsonb(p) - 'object_type_id' - 'id' ORDER BY p.position)
              FROM public.object_type_properties p WHERE p.object_type_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('datasources', coalesce(
           (SELECT jsonb_agg(jsonb_build_object('dataset_id', d.dataset_id,
                                                'branch_id', d.branch_id)
                             ORDER BY d.dataset_id)
              FROM public.object_type_datasources d WHERE d.object_type_id = p_id),
           '[]'::jsonb));
  END IF;

  RETURN row_json;
END $$;

COMMENT ON FUNCTION public.ontology_resource_row(text, uuid) IS
  'A resource as jsonb, in the shape the Review edits dialog shows it — for an object type that includes its properties, which the dialog renders as a section inside the type''s entry rather than as entries of their own.';

-- ── the writer ──────────────────────────────────────────────────────────────
-- Verbatim the body 413 gave `save_object_type`, under its real name.
CREATE OR REPLACE FUNCTION public.apply_object_type(
  p_object_type jsonb,
  p_properties  jsonb,
  p_datasources jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  t     uuid := nullif(p_object_type->>'id', '')::uuid;
  ont   uuid := nullif(p_object_type->>'ontology_id', '')::uuid;
  keys  text[];
BEGIN
  IF t IS NULL OR NOT EXISTS (SELECT 1 FROM public.object_types WHERE id = t) THEN
    INSERT INTO public.object_types (id, ontology_id, api_name, label, icon, description)
    VALUES (coalesce(t, gen_random_uuid()),
            coalesce(ont, public.default_ontology()),
            p_object_type->>'api_name', p_object_type->>'label',
            coalesce(p_object_type->>'icon', 'cube'),
            coalesce(p_object_type->>'description', ''))
    RETURNING id INTO t;
  ELSE
    IF ont IS NOT NULL AND ont IS DISTINCT FROM
       (SELECT ontology_id FROM public.object_types WHERE id = t) THEN
      RAISE EXCEPTION 'Ontology:CannotMoveObjectType — an object type stays in the ontology it was created in'
        USING HINT = 'Its API name is unique per ontology and its RID resolves inside one.';
    END IF;
    UPDATE public.object_types
       SET label       = coalesce(p_object_type->>'label', label),
           icon        = coalesce(p_object_type->>'icon', icon),
           description = coalesce(p_object_type->>'description', description)
     WHERE id = t;
  END IF;

  SELECT array_agg(e->>'property_id') INTO keys FROM jsonb_array_elements(p_properties) e;
  DELETE FROM public.object_type_properties
   WHERE object_type_id = t AND property_id <> ALL (coalesce(keys, '{}'::text[]));

  UPDATE public.object_type_properties
     SET is_primary_key = false, is_title_key = false
   WHERE object_type_id = t AND (is_primary_key OR is_title_key);

  INSERT INTO public.object_type_properties (
    object_type_id, property_id, display_name, api_name, description, aliases,
    base_type, source, datasource_id, backing_column, shared_property_id,
    required, visibility, position, is_primary_key, is_title_key)
  SELECT
    t, e->>'property_id', e->>'display_name', e->>'api_name',
    coalesce(e->>'description', ''),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(e->'aliases')), '{}'::text[]),
    e->>'base_type',
    coalesce(e->>'source', 'column'),
    nullif(e->>'datasource_id', '')::uuid,
    nullif(e->>'backing_column', ''),
    nullif(e->>'shared_property_id', '')::uuid,
    coalesce((e->>'required')::boolean, false),
    coalesce(e->>'visibility', 'normal'),
    coalesce((e->>'position')::integer, (ord - 1)::integer),
    coalesce((e->>'is_primary_key')::boolean, false),
    coalesce((e->>'is_title_key')::boolean, false)
  FROM jsonb_array_elements(p_properties) WITH ORDINALITY AS a(e, ord)
  ON CONFLICT (object_type_id, property_id) DO UPDATE SET
    display_name       = EXCLUDED.display_name,
    api_name           = EXCLUDED.api_name,
    description        = EXCLUDED.description,
    aliases            = EXCLUDED.aliases,
    base_type          = EXCLUDED.base_type,
    source             = EXCLUDED.source,
    datasource_id      = EXCLUDED.datasource_id,
    backing_column     = EXCLUDED.backing_column,
    shared_property_id = EXCLUDED.shared_property_id,
    required           = EXCLUDED.required,
    visibility         = EXCLUDED.visibility,
    position           = EXCLUDED.position,
    is_primary_key     = EXCLUDED.is_primary_key,
    is_title_key       = EXCLUDED.is_title_key;

  -- The datasource binding, same shape as the properties above: what is listed
  -- stays, what is not is unbound.
  DELETE FROM public.object_type_datasources d
   WHERE d.object_type_id = t
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_datasources) e
                      WHERE (e->>'dataset_id')::uuid = d.dataset_id
                        AND (e->>'branch_id')::uuid  = d.branch_id);

  -- Only pairs not already bound. ON CONFLICT would not do: the uniqueness is
  -- enforced by a trigger that raises Phonograph2:DatasetAndBranchAlreadyRegistered
  -- before the conflict clause is ever reached, so a re-save of an unchanged
  -- binding has to not attempt the insert at all.
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  SELECT t, (e->>'dataset_id')::uuid, (e->>'branch_id')::uuid
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_type_datasources d
      WHERE d.dataset_id = (e->>'dataset_id')::uuid
        AND d.branch_id  = (e->>'branch_id')::uuid);

  RETURN t;
END $$;

COMMENT ON FUNCTION public.apply_object_type(jsonb, jsonb, jsonb) IS
  'Write an object type and its properties to the ontology. Called by save_working_state and by nothing else — a surface that calls this directly has skipped the session.';

REVOKE ALL ON FUNCTION public.apply_object_type(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_object_type(jsonb, jsonb, jsonb) TO authenticated;

-- ── the stager, under the name the surface already calls ───────────────────
CREATE OR REPLACE FUNCTION public.save_object_type(
  p_object_type jsonb,
  p_properties  jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_object_type->>'id', '')::uuid;
  exists_live boolean;
  v_fields jsonb;
BEGIN
  exists_live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.object_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  v_fields := jsonb_strip_nulls(jsonb_build_object(
    'api_name',    p_object_type->>'api_name',
    'label',       p_object_type->>'label',
    'icon',        coalesce(p_object_type->>'icon', 'cube'),
    'description', coalesce(p_object_type->>'description', '')
  )) || jsonb_build_object('properties',  coalesce(p_properties, '[]'::jsonb),
                           'datasources', coalesce(p_object_type->'datasources', '[]'::jsonb));

  IF NOT exists_live THEN
    -- A creation carries its ontology; stage_change refuses one without.
    v_fields := v_fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_object_type->>'ontology_id',''),
                              public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('object_type', t, v_fields, NULL,
                              CASE WHEN exists_live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_object_type(jsonb, jsonb) IS
  'Stage an object type and its properties into my working state. Returns the id it will have — the row does not exist until save_working_state runs, which is why the object type Overview shows RID as "Set on save".';

REVOKE ALL ON FUNCTION public.save_object_type(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_object_type(jsonb, jsonb) TO authenticated;

-- ── the save, now aware that an object type is not a flat row ──────────────
CREATE OR REPLACE FUNCTION public.save_working_state(p_branch uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        record;
  v_ont    uuid;
  v_stale  integer;
  v_before text[];
  v_bad    text;
  v_saved  integer := 0;
  tbl      text;
  sets     text;
  k        text;
BEGIN
  IF p_branch IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:BranchSaveNotImplemented — saving onto a branch writes to the branch overlay, which is a separate path'
      USING HINT = 'Save on main, or use the branch overlay directly until that path exists.';
  END IF;

  SELECT count(*) INTO v_stale FROM public.working_state_conflicts(p_branch);
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'OntologyMetadata:StaleWorkingState — % field(s) were changed by someone else since you began', v_stale
      USING HINT = 'Update to pull their changes in, then choose per field. working_state_conflicts() lists them.';
  END IF;

  SELECT array_agg(format('%s|%s|%s|%s', object_type, scope, subject, problem))
    INTO v_before FROM public.ontology_violations();

  FOR c IN SELECT * FROM public.working_state_changes
            WHERE user_id = auth.uid() AND branch_id IS NOT DISTINCT FROM p_branch
            ORDER BY created_at
  LOOP
    v_ont := c.ontology_id;

    IF c.resource_kind = 'object_type' AND c.operation <> 'deleted' THEN
      -- One writer for a type and its properties, as 409 established.
      PERFORM public.apply_object_type(
        (c.fields - 'properties' - 'datasources')
          || jsonb_build_object('id', c.resource_id::text,
                                'ontology_id', c.ontology_id::text),
        coalesce(c.fields->'properties',  '[]'::jsonb),
        coalesce(c.fields->'datasources', '[]'::jsonb));
      v_saved := v_saved + 1;
      CONTINUE;
    END IF;

    tbl := CASE c.resource_kind
             WHEN 'object_type'     THEN 'object_types'
             WHEN 'link_type'       THEN 'link_types'
             WHEN 'shared_property' THEN 'shared_properties'
             WHEN 'interface'       THEN 'ontology_interfaces'
             WHEN 'action_type'     THEN 'action_types'
             WHEN 'type_group'      THEN 'type_groups'
           END;

    IF c.operation = 'deleted' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id = $1', tbl) USING c.resource_id;
    ELSIF c.operation = 'created' THEN
      EXECUTE format(
        'INSERT INTO public.%I (id, %s) SELECT $1, %s',
        tbl,
        (SELECT string_agg(quote_ident(key), ', ') FROM jsonb_each(c.fields)),
        (SELECT string_agg(format('$2->>%L', key), ', ') FROM jsonb_each(c.fields)))
      USING c.resource_id, c.fields;
    ELSE
      sets := '';
      FOR k IN SELECT jsonb_object_keys(c.fields) LOOP
        sets := sets || CASE WHEN sets = '' THEN '' ELSE ', ' END
                     || format('%I = ($2->>%L)', k, k);
      END LOOP;
      EXECUTE format('UPDATE public.%I SET %s WHERE id = $1', tbl, sets)
        USING c.resource_id, c.fields;
    END IF;

    v_saved := v_saved + 1;
  END LOOP;

  IF v_saved = 0 THEN RETURN 0; END IF;

  SELECT string_agg(v.shown, '; ') INTO v_bad
    FROM (SELECT format('%s.%s: %s', object_type, subject, problem) AS shown,
                 format('%s|%s|%s|%s', object_type, scope, subject, problem) AS key
            FROM public.ontology_violations()) v
   WHERE NOT (v.key = ANY (coalesce(v_before, ARRAY[]::text[])));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:SaveBlockedByErrors — %', v_bad
      USING HINT = 'Errors need to be handled in order to save. Nothing was written.';
  END IF;

  UPDATE public.ontologies SET version = version + 1 WHERE id = v_ont;

  DELETE FROM public.working_state_changes
   WHERE user_id = auth.uid() AND branch_id IS NOT DISTINCT FROM p_branch;

  RETURN v_saved;
END $$;

COMMENT ON FUNCTION public.save_working_state(uuid) IS
  'Apply my working state to the ontology, bump its version and clear the state. An object type goes through apply_object_type so its properties travel with it; every other kind is a flat row. Errors caused by this save block it and nothing lands.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  usr uuid := gen_random_uuid(); before text; n int; props jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('stage-427') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ws427@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
                      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS427');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws427', 'WS 427') RETURNING id INTO ont;

  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws427', 'WS427') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
  VALUES (ds, 'master') RETURNING id INTO br;

  props := jsonb_build_array(jsonb_build_object(
    'property_id','flight_id', 'display_name','Flight Id', 'api_name','flightId',
    'base_type','string', 'source','column', 'backing_column','flight_id',
    'is_primary_key', true, 'is_title_key', true, 'required', true));

  -- 1. Creating does NOT write to the ontology.
  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(
        jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))), props);
  IF EXISTS (SELECT 1 FROM public.object_types WHERE id = t) THEN
    RAISE EXCEPTION 'save_object_type still wrote through — 427 changed nothing';
  END IF;
  SELECT count(*) INTO n FROM public.working_state_changes WHERE resource_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one staged entry, found %', n; END IF;

  -- 2. The entry carries the properties, because the dialog shows them inside it.
  SELECT jsonb_array_length(fields->'properties') INTO n
    FROM public.working_state_changes WHERE resource_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'the properties did not travel with the type'; END IF;

  -- 3. Saving lands the type AND its properties.
  n := public.save_working_state();
  IF n <> 1 THEN RAISE EXCEPTION 'expected one resource saved, got %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_types WHERE id = t AND api_name = 'Flight') THEN
    RAISE EXCEPTION 'the object type never landed';
  END IF;
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND is_primary_key;
  IF n <> 1 THEN RAISE EXCEPTION 'the primary key property did not land'; END IF;
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'the datasource picked in the wizard did not land'; END IF;

  -- 4. A later edit stages as `modified`, and still does not write through.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Flight','label','Flight Leg',
      'datasources', jsonb_build_array(
        jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))), props);
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight' THEN
    RAISE EXCEPTION 'an edit to an existing type wrote through';
  END IF;
  IF (SELECT operation FROM public.working_state_changes WHERE resource_id = t) <> 'modified' THEN
    RAISE EXCEPTION 'an edit to an existing type staged as a creation';
  END IF;

  -- 5. And a property list unchanged since the base is not a conflict.
  SELECT count(*) INTO n FROM public.working_state_conflicts();
  IF n <> 0 THEN
    RAISE EXCEPTION 'the properties section conflicted with itself — % field(s)', n;
  END IF;

  PERFORM public.save_working_state();
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight Leg' THEN
    RAISE EXCEPTION 'the second save did not land';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '427: object type edits go to the working state and land only on save';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
