-- An action type travels whole through the session: rules, parameters and
-- submission criteria are sections of its entry, not resources beside it.
--
-- 434 said it plainly and deferred it: "Interfaces, action types and type
-- groups each have child tables… so each needs the treatment 427 gave object
-- types." This is that treatment for action types — the richest of the three,
-- and the one the map's next phase needs: the Review edits dialog renders an
-- action's edits inside ONE entry (resource → section → sub-resource → field,
-- the §10.2 shape), so the working state must carry the whole action.
--
--   "an action type, which has three components: The Rules (what it does) …
--    The Form (what the user sees) … submission criteria"
--                                (deep-dive, Create an action type; 418's map)
--
-- ── KEYS, because the children reference each other ────────────────────────
-- `action_type_rule_properties.parameter_id` and the criteria's
-- `value_parameter_id` point at `action_type_parameters.id` — uuids that do
-- not exist yet while the payload is only staged. So the staged shape uses
-- NATURAL keys and the writer maps them on land:
--   parameters — by `api_name` (unique per action)
--   rules      — positional; their properties name object_type_properties by
--                uuid (external, stable) and parameters by api_name
--   criteria   — a tree; each node carries a client `key` and a `parent_key`,
--                parents listed before children
-- The writer replaces children wholesale rather than upserting: unlike object
-- type properties, nothing outside the action references a rule or a
-- parameter row by id, so identity has nothing to preserve.

-- ── a landmine 441 could not see, found by this migration's assertions ──────
-- 441 dropped organization_id from action_types and recreated every POLICY,
-- but `can_read_action_type()` — the 418 helper the children's policies call —
-- still read `a.organization_id`. A function body carries no dependency
-- Postgres tracks, so the CASCADE missed it, and every insert into an action's
-- children failed on a column that no longer exists. Same class as
-- auth_org_id() reading a dropped table. Rewritten to the from-space predicate
-- the policies themselves use.
CREATE OR REPLACE FUNCTION public.can_read_action_type(p_action uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.action_types a
                  WHERE a.id = p_action AND public.auth_in_ontology(a.ontology_id))
$fn$;

CREATE OR REPLACE FUNCTION public.can_write_action_type(p_action uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.action_types a
     WHERE a.id = p_action AND public.auth_member_of_ontology(a.ontology_id))
$fn$;

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

  -- The action's three components, in the staged (natural-key) shape, so the
  -- working state diffs against exactly what a stager would write.
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

  RETURN row_json;
END $$;

-- ── the writer ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_action_type(
  p_action     jsonb,
  p_parameters jsonb DEFAULT '[]'::jsonb,
  p_rules      jsonb DEFAULT '[]'::jsonb,
  p_criteria   jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  t        uuid := nullif(p_action->>'id', '')::uuid;
  param_id jsonb := '{}'::jsonb;   -- api_name → uuid
  crit_id  jsonb := '{}'::jsonb;   -- client key → uuid
  e        jsonb;
  rp       jsonb;
  rid      uuid;
  cid      uuid;
BEGIN
  IF t IS NULL OR NOT EXISTS (SELECT 1 FROM public.action_types WHERE id = t) THEN
    INSERT INTO public.action_types (id, ontology_id, api_name, label, description)
    VALUES (coalesce(t, gen_random_uuid()),
            coalesce(nullif(p_action->>'ontology_id','')::uuid, public.default_ontology()),
            p_action->>'api_name', p_action->>'label',
            coalesce(p_action->>'description', ''))
    RETURNING id INTO t;
  ELSE
    UPDATE public.action_types
       SET label       = coalesce(p_action->>'label', label),
           description = coalesce(p_action->>'description', description),
           status      = coalesce(p_action->>'status', status)
     WHERE id = t;
  END IF;

  -- Wholesale replace: nothing outside the action references these rows.
  DELETE FROM public.action_type_submission_criteria WHERE action_type_id = t;
  DELETE FROM public.action_type_rules WHERE action_type_id = t;   -- cascades rule properties
  DELETE FROM public.action_type_parameters WHERE action_type_id = t;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, description, base_type, object_type_id,
       required, exposed, editable, position)
    VALUES (t, e->>'api_name', e->>'display_name', coalesce(e->>'description',''),
            nullif(e->>'base_type',''), nullif(e->>'object_type_id','')::uuid,
            coalesce((e->>'required')::boolean, false),
            coalesce((e->>'exposed')::boolean, true),
            coalesce((e->>'editable')::boolean, true),
            coalesce((e->>'position')::integer, 0))
    RETURNING id INTO cid;
    param_id := param_id || jsonb_build_object(e->>'api_name', cid::text);
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_rules
      (action_type_id, kind, position, object_type_id, link_type_id, function_name)
    VALUES (t, e->>'kind', coalesce((e->>'position')::integer, 0),
            nullif(e->>'object_type_id','')::uuid,
            nullif(e->>'link_type_id','')::uuid,
            nullif(e->>'function_name',''))
    RETURNING id INTO rid;

    FOR rp IN SELECT * FROM jsonb_array_elements(coalesce(e->'properties', '[]'::jsonb)) LOOP
      INSERT INTO public.action_type_rule_properties
        (rule_id, property_id, value_source, parameter_id, static_value)
      -- A round-tripped section carries JSON nulls, and jsonb null is not SQL
      -- NULL — the XOR checks read it as a value. Strip both here.
      VALUES (rid, (rp->>'property_id')::uuid, rp->>'value_source',
              (param_id->>(rp->>'parameter_api_name'))::uuid,
              nullif(rp->'static_value', 'null'::jsonb));
    END LOOP;
  END LOOP;

  -- Parents before children: the payload lists them in that order, and the
  -- map of client keys to landed ids grows as we go.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) LOOP
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator, template,
       parameter_id, user_field, attribute_name, operator, value_source,
       value_parameter_id, static_value, failure_message)
    VALUES (t,
            (crit_id->>(e->>'parent_key'))::uuid,
            coalesce((e->>'position')::integer, 0),
            e->>'node_type', nullif(e->>'logical_operator',''), nullif(e->>'template',''),
            (param_id->>(e->>'parameter_api_name'))::uuid,
            nullif(e->>'user_field',''), nullif(e->>'attribute_name',''),
            nullif(e->>'operator',''), nullif(e->>'value_source',''),
            (param_id->>(e->>'value_parameter_api_name'))::uuid,
            nullif(e->'static_value', 'null'::jsonb),
            coalesce(e->>'failure_message', ''))
    RETURNING id INTO cid;
    IF e->>'key' IS NOT NULL THEN
      crit_id := crit_id || jsonb_build_object(e->>'key', cid::text);
    END IF;
  END LOOP;

  RETURN t;
END $$;

COMMENT ON FUNCTION public.apply_action_type(jsonb, jsonb, jsonb, jsonb) IS
  'Write an action type and its three components. Called by save_working_state and nothing else. Children are replaced wholesale — nothing outside the action references them by id — with natural keys (parameter api_name, criteria client keys) mapped to fresh uuids on land.';

REVOKE ALL ON FUNCTION public.apply_action_type(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_action_type(jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- ── the stager ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_action_type(p_action jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_action->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.action_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  fields := jsonb_strip_nulls(jsonb_build_object(
    'api_name',    p_action->>'api_name',
    'label',       p_action->>'label',
    'description', p_action->>'description',
    'status',      p_action->>'status'));

  -- Sections only when supplied: an invented empty section is an instruction
  -- to delete everything in it (440's lesson).
  IF p_action ? 'parameters' THEN
    fields := fields || jsonb_build_object('parameters', p_action->'parameters');
  END IF;
  IF p_action ? 'rules' THEN
    fields := fields || jsonb_build_object('rules', p_action->'rules');
  END IF;
  IF p_action ? 'criteria' THEN
    fields := fields || jsonb_build_object('criteria', p_action->'criteria');
  END IF;

  IF NOT live THEN
    fields := fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_action->>'ontology_id',''), public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('action_type', t, fields, NULL,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_action_type(jsonb) IS
  'Stage an action type — rules, parameters and criteria travel inside the entry, absent sections mean unedited. Returns the id it will have; the row exists after save_working_state.';

REVOKE ALL ON FUNCTION public.save_action_type(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_action_type(jsonb) TO authenticated;

-- ── the save gains its action arm ───────────────────────────────────────────
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
  'Apply my working state to the ontology, bump its version and clear the state. Object types and action types go through their writers so their sections travel; every other kind is a flat row. Absent sections mean unedited. Errors caused by this save block it and nothing lands.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid; act uuid;
  usr uuid := gen_random_uuid(); before text; n int; pid uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('action-444') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws444@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws444@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS444');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws444', 'WS 444') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws444', 'WS444') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights444', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','flight_id','display_name','Flight Id',
      'api_name','flightId','base_type','string','source','column','backing_column','flight_id',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  SELECT id INTO pid FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'flight_id';

  -- 1. The whole action stages as ONE entry and lands whole.
  act := public.save_action_type(jsonb_build_object(
    'api_name','set-root-cause', 'label','Set root cause', 'ontology_id', ont::text,
    'parameters', jsonb_build_array(jsonb_build_object(
      'api_name','rootCause','display_name','Root cause','base_type','string',
      'required',true,'position',0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind','modify_object','position',0,'object_type_id', t::text,
      'properties', jsonb_build_array(jsonb_build_object(
        'property_id', pid::text, 'value_source','parameter',
        'parameter_api_name','rootCause')))),
    'criteria', jsonb_build_array(
      jsonb_build_object('key','g1','node_type','logical','logical_operator','all',
        'position',0,'failure_message',''),
      jsonb_build_object('key','c1','parent_key','g1','node_type','condition',
        'position',0,'template','parameter','parameter_api_name','rootCause',
        'operator','is not','value_source','static','static_value', to_jsonb(''::text),
        'failure_message','A root cause is required.'))));
  SELECT count(*) INTO n FROM public.working_state_changes;
  IF n <> 1 THEN RAISE EXCEPTION 'the action staged as % entries, not one', n; END IF;
  IF EXISTS (SELECT 1 FROM public.action_types WHERE id = act) THEN
    RAISE EXCEPTION 'the action wrote through';
  END IF;

  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.action_type_parameters WHERE action_type_id = act;
  IF n <> 1 THEN RAISE EXCEPTION 'the parameter did not land'; END IF;
  SELECT count(*) INTO n FROM public.action_type_rules WHERE action_type_id = act;
  IF n <> 1 THEN RAISE EXCEPTION 'the rule did not land'; END IF;
  SELECT count(*) INTO n FROM public.action_type_rule_properties rp
    JOIN public.action_type_rules r ON r.id = rp.rule_id
   WHERE r.action_type_id = act AND rp.parameter_id IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'the rule property did not resolve its parameter by api_name'; END IF;
  SELECT count(*) INTO n FROM public.action_type_submission_criteria
   WHERE action_type_id = act AND parent_id IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'the criterion did not find its parent group'; END IF;

  -- 2. A label-only edit leaves all three sections standing (440's lesson).
  PERFORM public.save_action_type(jsonb_build_object('id', act::text, 'label','Set the root cause'));
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.action_type_parameters WHERE action_type_id = act;
  IF n <> 1 THEN RAISE EXCEPTION 'a label edit deleted the parameters'; END IF;
  SELECT count(*) INTO n FROM public.action_type_submission_criteria WHERE action_type_id = act;
  IF n <> 2 THEN RAISE EXCEPTION 'a label edit deleted the criteria'; END IF;

  -- 3. Deletion stages, survives until save, and takes the children with it.
  PERFORM public.delete_ontology_resource('action_type', act);
  IF NOT EXISTS (SELECT 1 FROM public.action_types WHERE id = act) THEN
    RAISE EXCEPTION 'a staged deletion took effect immediately';
  END IF;
  PERFORM public.save_working_state();
  IF EXISTS (SELECT 1 FROM public.action_types WHERE id = act)
     OR EXISTS (SELECT 1 FROM public.action_type_parameters WHERE action_type_id = act) THEN
    RAISE EXCEPTION 'the deletion did not land whole';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '444: an action type stages, lands, survives partial edits and deletes whole';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
