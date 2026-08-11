-- An interface travels whole through the session: properties, both constraint
-- clauses and its extensions are sections of one entry.
--
-- The 444 treatment, applied to the second of the three kinds 434 named. One
-- structural difference from action types, and it decides the writer's shape:
-- `interface_properties` ARE referenced from outside — every implementer's
-- mapping points at a property row by id — so properties UPSERT by their
-- natural key (interface_id, property_id) to preserve identity, where an
-- action's children could be replaced wholesale because nothing referenced
-- them. Deleting a property still cascades its mappings, which is correct:
-- the obligation is gone, so is its satisfaction.
--
-- Constraints upsert by api_name for the same reason (action satisfactions
-- reference a constraint by id); extensions are a replaced set, each insert
-- re-passing the cycle and collision guards.

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

  IF row_json IS NOT NULL AND p_kind = 'action_type' THEN
    row_json := row_json
      || jsonb_build_object('parameters', coalesce(
           (SELECT jsonb_agg((to_jsonb(pa) - 'id' - 'action_type_id') ORDER BY pa.position)
              FROM public.action_type_parameters pa WHERE pa.action_type_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('rules', coalesce(
           (SELECT jsonb_agg(
                     (to_jsonb(r) - 'id' - 'action_type_id' - 'created_at')
                     || jsonb_build_object('properties', coalesce(
                          (SELECT jsonb_agg(jsonb_build_object(
                                    'property_id', rp.property_id,
                                    'value_source', rp.value_source,
                                    'parameter_api_name', pa2.api_name,
                                    'static_value', rp.static_value))
                             FROM public.action_type_rule_properties rp
                             LEFT JOIN public.action_type_parameters pa2 ON pa2.id = rp.parameter_id
                            WHERE rp.rule_id = r.id),
                          '[]'::jsonb))
                     ORDER BY r.position)
              FROM public.action_type_rules r WHERE r.action_type_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('criteria', coalesce(
           (SELECT jsonb_agg(
                     (to_jsonb(c) - 'id' - 'action_type_id' - 'parent_id'
                      - 'parameter_id' - 'value_parameter_id')
                     || jsonb_build_object(
                          'key', c.id::text,
                          'parent_key', c.parent_id::text,
                          'parameter_api_name',
                            (SELECT api_name FROM public.action_type_parameters WHERE id = c.parameter_id),
                          'value_parameter_api_name',
                            (SELECT api_name FROM public.action_type_parameters WHERE id = c.value_parameter_id))
                     ORDER BY c.parent_id NULLS FIRST, c.position)
              FROM public.action_type_submission_criteria c WHERE c.action_type_id = p_id),
           '[]'::jsonb));
  END IF;

  -- The contract's three clauses plus its parents, in the staged shape.
  IF row_json IS NOT NULL AND p_kind = 'interface' THEN
    row_json := row_json
      || jsonb_build_object('properties', coalesce(
           (SELECT jsonb_agg((to_jsonb(p) - 'id' - 'interface_id') ORDER BY p.position)
              FROM public.interface_properties p WHERE p.interface_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('link_constraints', coalesce(
           (SELECT jsonb_agg((to_jsonb(lc) - 'id' - 'interface_id') ORDER BY lc.api_name)
              FROM public.interface_link_constraints lc WHERE lc.interface_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('action_constraints', coalesce(
           (SELECT jsonb_agg((to_jsonb(ac) - 'id' - 'interface_id') ORDER BY ac.api_name)
              FROM public.interface_action_constraints ac WHERE ac.interface_id = p_id),
           '[]'::jsonb))
      || jsonb_build_object('extends', coalesce(
           (SELECT jsonb_agg(e.parent_interface_id ORDER BY e.parent_interface_id)
              FROM public.interface_extensions e WHERE e.interface_id = p_id),
           '[]'::jsonb));
  END IF;

  RETURN row_json;
END $$;

-- ── the writer ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_interface(
  p_interface          jsonb,
  p_properties         jsonb DEFAULT '[]'::jsonb,
  p_link_constraints   jsonb DEFAULT '[]'::jsonb,
  p_action_constraints jsonb DEFAULT '[]'::jsonb,
  p_extends            jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE t uuid := nullif(p_interface->>'id', '')::uuid; e jsonb;
BEGIN
  IF t IS NULL OR NOT EXISTS (SELECT 1 FROM public.ontology_interfaces WHERE id = t) THEN
    INSERT INTO public.ontology_interfaces (id, ontology_id, api_name, label, description, icon, searchable)
    VALUES (coalesce(t, gen_random_uuid()),
            coalesce(nullif(p_interface->>'ontology_id','')::uuid, public.default_ontology()),
            p_interface->>'api_name', p_interface->>'label',
            coalesce(p_interface->>'description', ''),
            coalesce(p_interface->>'icon', 'cube'),
            coalesce((p_interface->>'searchable')::boolean, false))
    RETURNING id INTO t;
  ELSE
    UPDATE public.ontology_interfaces
       SET label       = coalesce(p_interface->>'label', label),
           description = coalesce(p_interface->>'description', description),
           icon        = coalesce(p_interface->>'icon', icon),
           searchable  = coalesce((p_interface->>'searchable')::boolean, searchable),
           status      = coalesce(p_interface->>'status', status)
     WHERE id = t;
  END IF;

  -- Properties upsert by natural key: implementers' mappings point at these
  -- rows, so identity survives a re-save. What is not listed is deleted, and
  -- its mappings cascade with it.
  DELETE FROM public.interface_properties p
   WHERE p.interface_id = t
     AND p.property_id <> ALL (coalesce(
       (SELECT array_agg(x->>'property_id') FROM jsonb_array_elements(p_properties) x),
       '{}'::text[]));

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_properties, '[]'::jsonb)) LOOP
    INSERT INTO public.interface_properties
      (interface_id, property_id, display_name, api_name, description, base_type,
       array_element_type, source, shared_property_id, required, pk_constraint,
       visibility, position)
    VALUES (t, e->>'property_id', e->>'display_name', e->>'api_name',
            coalesce(e->>'description',''), e->>'base_type',
            nullif(e->>'array_element_type',''),
            coalesce(e->>'source','local'),
            nullif(e->>'shared_property_id','')::uuid,
            coalesce((e->>'required')::boolean, true),
            coalesce(e->>'pk_constraint','none'),
            coalesce(e->>'visibility','normal'),
            coalesce((e->>'position')::integer, 0))
    ON CONFLICT (interface_id, property_id) DO UPDATE SET
      display_name = EXCLUDED.display_name, api_name = EXCLUDED.api_name,
      description = EXCLUDED.description, base_type = EXCLUDED.base_type,
      array_element_type = EXCLUDED.array_element_type,
      source = EXCLUDED.source, shared_property_id = EXCLUDED.shared_property_id,
      required = EXCLUDED.required, pk_constraint = EXCLUDED.pk_constraint,
      visibility = EXCLUDED.visibility, position = EXCLUDED.position;
  END LOOP;

  -- Constraints upsert by api_name: satisfactions reference them by id.
  DELETE FROM public.interface_link_constraints lc
   WHERE lc.interface_id = t
     AND lc.api_name <> ALL (coalesce(
       (SELECT array_agg(x->>'api_name') FROM jsonb_array_elements(p_link_constraints) x),
       '{}'::text[]));
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_link_constraints, '[]'::jsonb)) LOOP
    INSERT INTO public.interface_link_constraints
      (interface_id, api_name, display_name, required, cardinality, target_kind,
       target_interface_id, target_object_type_id)
    VALUES (t, e->>'api_name', e->>'display_name',
            coalesce((e->>'required')::boolean, true),
            e->>'cardinality', e->>'target_kind',
            nullif(e->>'target_interface_id','')::uuid,
            nullif(e->>'target_object_type_id','')::uuid)
    ON CONFLICT (interface_id, api_name) DO UPDATE SET
      display_name = EXCLUDED.display_name, required = EXCLUDED.required,
      cardinality = EXCLUDED.cardinality, target_kind = EXCLUDED.target_kind,
      target_interface_id = EXCLUDED.target_interface_id,
      target_object_type_id = EXCLUDED.target_object_type_id;
  END LOOP;

  DELETE FROM public.interface_action_constraints ac
   WHERE ac.interface_id = t
     AND ac.api_name <> ALL (coalesce(
       (SELECT array_agg(x->>'api_name') FROM jsonb_array_elements(p_action_constraints) x),
       '{}'::text[]));
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_action_constraints, '[]'::jsonb)) LOOP
    INSERT INTO public.interface_action_constraints
      (interface_id, api_name, display_name, description, required)
    VALUES (t, e->>'api_name', e->>'display_name',
            coalesce(e->>'description',''), coalesce((e->>'required')::boolean, true))
    ON CONFLICT (interface_id, api_name) DO UPDATE SET
      display_name = EXCLUDED.display_name, description = EXCLUDED.description,
      required = EXCLUDED.required;
  END LOOP;

  -- Extensions are a set; each insert re-passes the cycle/collision guards.
  DELETE FROM public.interface_extensions x
   WHERE x.interface_id = t
     AND x.parent_interface_id <> ALL (coalesce(
       (SELECT array_agg((v.value #>> '{}')::uuid) FROM jsonb_array_elements(p_extends) v),
       '{}'::uuid[]));
  INSERT INTO public.interface_extensions (interface_id, parent_interface_id)
  SELECT t, (v.value #>> '{}')::uuid
    FROM jsonb_array_elements(coalesce(p_extends, '[]'::jsonb)) v
  ON CONFLICT DO NOTHING;

  RETURN t;
END $$;

COMMENT ON FUNCTION public.apply_interface(jsonb, jsonb, jsonb, jsonb, jsonb) IS
  'Write an interface and its three clauses plus extensions. Called by save_working_state and nothing else. Properties and constraints upsert by natural key because implementations reference them by id; extensions replace as a set through the guards.';

REVOKE ALL ON FUNCTION public.apply_interface(jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_interface(jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- ── the stager ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_interface(p_interface jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_interface->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.ontology_interfaces WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  fields := jsonb_strip_nulls(jsonb_build_object(
    'api_name',    p_interface->>'api_name',
    'label',       p_interface->>'label',
    'description', p_interface->>'description',
    'icon',        p_interface->>'icon',
    'status',      p_interface->>'status'));
  IF p_interface ? 'searchable' THEN
    fields := fields || jsonb_build_object('searchable', (p_interface->>'searchable')::boolean);
  END IF;
  IF p_interface ? 'properties' THEN
    fields := fields || jsonb_build_object('properties', p_interface->'properties');
  END IF;
  IF p_interface ? 'link_constraints' THEN
    fields := fields || jsonb_build_object('link_constraints', p_interface->'link_constraints');
  END IF;
  IF p_interface ? 'action_constraints' THEN
    fields := fields || jsonb_build_object('action_constraints', p_interface->'action_constraints');
  END IF;
  IF p_interface ? 'extends' THEN
    fields := fields || jsonb_build_object('extends', p_interface->'extends');
  END IF;

  IF NOT live THEN
    fields := fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_interface->>'ontology_id',''), public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('interface', t, fields, NULL,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_interface(jsonb) IS
  'Stage an interface whole — properties, both constraint clauses and extensions travel inside the entry; absent sections mean unedited.';

REVOKE ALL ON FUNCTION public.save_interface(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_interface(jsonb) TO authenticated;

-- ── the save gains its interface arm ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_working_state(p_branch uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        record;
  v_live   jsonb;
  v_ont    uuid;
  v_stale  integer;
  v_before text[];
  v_bad    text;
  v_saved  integer := 0;
  tbl      text;
  cols     text;
  vals     text;
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
      v_live := coalesce(public.ontology_resource_row('object_type', c.resource_id), '{}'::jsonb);
      PERFORM public.apply_object_type(
        (c.fields - 'properties' - 'datasources')
          || jsonb_build_object('id', c.resource_id::text,
                                'ontology_id', c.ontology_id::text),
        coalesce(c.fields->'properties',  v_live->'properties',  '[]'::jsonb),
        coalesce(c.fields->'datasources', v_live->'datasources', '[]'::jsonb));
      v_saved := v_saved + 1;
      CONTINUE;
    END IF;

    IF c.resource_kind = 'action_type' AND c.operation <> 'deleted' THEN
      v_live := coalesce(public.ontology_resource_row('action_type', c.resource_id), '{}'::jsonb);
      PERFORM public.apply_action_type(
        (c.fields - 'parameters' - 'rules' - 'criteria')
          || jsonb_build_object('id', c.resource_id::text,
                                'ontology_id', c.ontology_id::text),
        coalesce(c.fields->'parameters', v_live->'parameters', '[]'::jsonb),
        coalesce(c.fields->'rules',      v_live->'rules',      '[]'::jsonb),
        coalesce(c.fields->'criteria',   v_live->'criteria',   '[]'::jsonb));
      v_saved := v_saved + 1;
      CONTINUE;
    END IF;

    IF c.resource_kind = 'interface' AND c.operation <> 'deleted' THEN
      v_live := coalesce(public.ontology_resource_row('interface', c.resource_id), '{}'::jsonb);
      PERFORM public.apply_interface(
        (c.fields - 'properties' - 'link_constraints' - 'action_constraints' - 'extends')
          || jsonb_build_object('id', c.resource_id::text,
                                'ontology_id', c.ontology_id::text),
        coalesce(c.fields->'properties',         v_live->'properties',         '[]'::jsonb),
        coalesce(c.fields->'link_constraints',   v_live->'link_constraints',   '[]'::jsonb),
        coalesce(c.fields->'action_constraints', v_live->'action_constraints', '[]'::jsonb),
        coalesce(c.fields->'extends',            v_live->'extends',            '[]'::jsonb));
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

    ELSE
      SELECT string_agg(quote_ident(e.key), ', ' ORDER BY e.key),
             string_agg(format('($2->>%L)::%s', e.key,
                        public.ontology_column_type(tbl, e.key)), ', ' ORDER BY e.key)
        INTO cols, vals
        FROM jsonb_each(c.fields) e;

      IF c.operation = 'created' THEN
        EXECUTE format('INSERT INTO public.%I (id, %s) SELECT $1, %s', tbl, cols, vals)
          USING c.resource_id, c.fields;
      ELSE
        SELECT string_agg(format('%I = ($2->>%L)::%s', e.key, e.key,
                          public.ontology_column_type(tbl, e.key)), ', ' ORDER BY e.key)
          INTO vals FROM jsonb_each(c.fields) e;
        EXECUTE format('UPDATE public.%I SET %s WHERE id = $1', tbl, vals)
          USING c.resource_id, c.fields;
      END IF;
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
  'Apply my working state to the ontology, bump its version and clear the state. Object types, action types and interfaces go through their writers so their sections travel; every other kind is a flat row. Absent sections mean unedited. Errors caused by this save block it and nothing lands.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  base_i uuid; iface uuid; ip_id uuid; opid uuid; map_id uuid;
  usr uuid := gen_random_uuid(); before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('iface-451') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws451@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws451@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS451');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws451', 'WS 451') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws451', 'WS451') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'i451', 'i451') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Ticket','label','Ticket','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','ticket_id','display_name','Ticket Id',
      'api_name','ticketId','base_type','string','source','column','backing_column','ticket_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  SELECT id INTO opid FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'ticket_id';

  INSERT INTO public.ontology_interfaces (ontology_id, api_name, label)
  VALUES (ont, 'Base', 'Base') RETURNING id INTO base_i;

  -- 1. The whole interface stages as one entry and lands whole.
  iface := public.save_interface(jsonb_build_object(
    'api_name','Trackable', 'label','Trackable', 'ontology_id', ont::text,
    'properties', jsonb_build_array(jsonb_build_object(
      'property_id','identifier','display_name','Identifier','api_name','identifier',
      'base_type','string','required',true,'pk_constraint','must')),
    'link_constraints', jsonb_build_array(jsonb_build_object(
      'api_name','owner','display_name','Owner','cardinality','ONE',
      'target_kind','object_type','target_object_type_id', t::text)),
    'action_constraints', jsonb_build_array(jsonb_build_object(
      'api_name','close','display_name','Close')),
    'extends', jsonb_build_array(base_i::text)));
  SELECT count(*) INTO n FROM public.working_state_changes;
  IF n <> 1 THEN RAISE EXCEPTION 'the interface staged as % entries', n; END IF;
  IF EXISTS (SELECT 1 FROM public.ontology_interfaces WHERE id = iface) THEN
    RAISE EXCEPTION 'the interface wrote through';
  END IF;
  PERFORM public.save_working_state();
  IF (SELECT count(*) FROM public.interface_properties WHERE interface_id = iface) <> 1
     OR (SELECT count(*) FROM public.interface_link_constraints WHERE interface_id = iface) <> 1
     OR (SELECT count(*) FROM public.interface_action_constraints WHERE interface_id = iface) <> 1
     OR (SELECT count(*) FROM public.interface_extensions WHERE interface_id = iface) <> 1 THEN
    RAISE EXCEPTION 'a clause did not land';
  END IF;

  -- 2. Property identity survives a re-save: an implementer's mapping keeps
  --    pointing at the same row.
  SELECT id INTO ip_id FROM public.interface_properties
   WHERE interface_id = iface AND property_id = 'identifier';
  INSERT INTO public.object_type_interfaces (object_type_id, interface_id)
  VALUES (t, iface);
  INSERT INTO public.interface_implementation_mappings
    (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
  VALUES (t, iface, ip_id, 'choose_existing', opid) RETURNING id INTO map_id;
  SET CONSTRAINTS assert_implementation_conforms IMMEDIATE;

  PERFORM public.save_interface(jsonb_build_object(
    'id', iface::text, 'label','Trackable thing',
    'properties', jsonb_build_array(jsonb_build_object(
      'property_id','identifier','display_name','The identifier','api_name','identifier',
      'base_type','string','required',true,'pk_constraint','must'))));
  PERFORM public.save_working_state();
  IF (SELECT id FROM public.interface_properties
       WHERE interface_id = iface AND property_id = 'identifier') <> ip_id THEN
    RAISE EXCEPTION 'the property lost its identity on re-save';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interface_implementation_mappings WHERE id = map_id) THEN
    RAISE EXCEPTION 'the implementer''s mapping did not survive the re-save';
  END IF;

  -- 3. A label-only edit leaves every clause standing.
  PERFORM public.save_interface(jsonb_build_object('id', iface::text, 'label','Trackable!'));
  PERFORM public.save_working_state();
  IF (SELECT count(*) FROM public.interface_link_constraints WHERE interface_id = iface) <> 1
     OR (SELECT count(*) FROM public.interface_extensions WHERE interface_id = iface) <> 1 THEN
    RAISE EXCEPTION 'a label edit deleted a clause';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '451: an interface stages whole, keeps property identity, and partial edits touch nothing else';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
