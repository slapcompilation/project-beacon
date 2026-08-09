-- An absent section means unchanged, not empty.
--
-- 427 passed `coalesce(c.fields->'properties', '[]')` to the writer, and the
-- writer treats its list as authoritative — what is not named is deleted. That
-- is right when the surface sends a whole object type. It is wrong for every
-- other way an entry can be made:
--
--   select stage_change('object_type', t, '{"label":"Flight Leg"}');
--   select save_working_state();
--   → the label lands, and every property and datasource is dropped.
--
-- Found by the regression suite rather than by the migration assertions, which
-- is the distinction those tests exist for: 427 only ever staged through
-- `save_object_type`, which always sends the full picture, so the migration
-- could not see it. `stage_change` is a public entry point and the working
-- state is a diff — `fields` holds what I changed, which is why `base` is
-- captured per key. A section absent from the diff was never edited.

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
      -- What the type looks like now, so a section the entry never mentions
      -- survives the save instead of being read as "delete them all".
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
  'Apply my working state to the ontology, bump its version and clear the state. A section the entry never mentions — properties, datasources — is left as it stands: the working state is a diff, so absent means unedited. Errors caused by this save block it and nothing lands.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  usr uuid := gen_random_uuid(); before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('partial-428') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ws428@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
                      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS428');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws428', 'WS 428') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws428', 'WS428') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
  VALUES (ds, 'master') RETURNING id INTO br;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(
        jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object(
      'property_id','flight_id', 'display_name','Flight Id', 'api_name','flightId',
      'base_type','string', 'source','column', 'backing_column','flight_id',
      'is_primary_key', true, 'is_title_key', true, 'required', true)));
  PERFORM public.save_working_state();

  -- The bug, as the smallest thing that triggers it: one field, nothing else.
  PERFORM public.stage_change('object_type', t, jsonb_build_object('label','Flight Leg'));
  PERFORM public.save_working_state();

  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight Leg' THEN
    RAISE EXCEPTION 'the edit did not land';
  END IF;
  SELECT count(*) INTO n FROM public.object_type_properties WHERE object_type_id = t;
  IF n <> 1 THEN
    RAISE EXCEPTION 'a one-field edit deleted the properties — % left', n;
  END IF;
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t;
  IF n <> 1 THEN
    RAISE EXCEPTION 'a one-field edit unbound the datasource';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '428: a section the entry never named survives the save';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
