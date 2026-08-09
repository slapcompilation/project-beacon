-- The rest of the ontology gets a session too.
--
-- 427 routed object types through the working state and left five kinds writing
-- straight through — so "you must save your changes" was true of one resource
-- and false of the others, which is worse than either.
--
-- Link types and shared properties are flat: every field is a column on one
-- row, so `save_working_state`'s generic arm already applies them correctly and
-- all that was missing was a stager. Object types needed 427's special case
-- only because their properties and datasources are sections inside the entry.
--
-- Interfaces, action types and type groups each have child tables — interface
-- implementations, action rules and parameters, group members — so each needs
-- the treatment 427 gave object types. They stage and save their own columns
-- correctly today and their children do not travel; that is stated here rather
-- than left to be discovered, and there is no surface for any of the three yet.
--
-- ── DELETION IS AN OPERATION, NOT AN ABSENCE ───────────────────────────────
--   "[Planning] OOTO … Deleted"   — ontology-manager/images/cleanup-staging-example.png
--
-- The review dialog shows a deleted resource as an entry with a state pill, so
-- a deletion is staged like anything else and lands on save. `stage_change`
-- already takes 'deleted'; this gives it a name a surface can call, and refuses
-- the two cases where a delete is not ours to stage.

-- ── the generic arm never actually applied a non-text column ───────────────
-- `jsonb ->> key` is text, and 426 fed it straight into every column:
--
--   INSERT INTO public.link_types (id, ontology_id, …) SELECT $1, $2->>'ontology_id', …
--   → column "ontology_id" is of type uuid but expression is of type text
--
-- Object types never reached it — 427 routes them through `apply_object_type`,
-- which casts each column by hand — so the arm has been dead since it was
-- written and the first flat resource to use it found it immediately. Each
-- value is now cast to the column's own type, read from the catalogue rather
-- than guessed.
CREATE OR REPLACE FUNCTION public.ontology_column_type(p_table text, p_column text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
  SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
   WHERE a.attrelid = ('public.' || quote_ident(p_table))::regclass
     AND a.attname = p_column AND a.attnum > 0 AND NOT a.attisdropped
$fn$;

COMMENT ON FUNCTION public.ontology_column_type(text, text) IS
  'A column''s type, for casting a jsonb ->> back into it. The working state stores values as jsonb; every column that is not text needs the cast the catalogue names.';

REVOKE ALL ON FUNCTION public.ontology_column_type(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_column_type(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_working_state(p_branch uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
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
      -- Same order in both lists, and each value cast to its column's type.
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
END $fn$;

COMMENT ON FUNCTION public.save_working_state(uuid) IS
  'Apply my working state to the ontology, bump its version and clear the state. An object type goes through apply_object_type so its sections travel with it; every other kind is a flat row, each value cast back to its column type. A section the entry never mentions is left as it stands. Errors caused by this save block it and nothing lands.';

REVOKE ALL ON FUNCTION public.save_working_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_working_state(uuid) TO authenticated;

-- ── link types ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_link_type(p_link jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_link->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.link_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  -- Only what was given. An absent key is unedited, which is what lets a
  -- rename stage without dragging the whole row along.
  fields := jsonb_strip_nulls(jsonb_build_object(
    'source_object_type_id', p_link->>'source_object_type_id',
    'target_object_type_id', p_link->>'target_object_type_id',
    'api_name',              p_link->>'api_name',
    'label',                 p_link->>'label',
    'source_api_name',       p_link->>'source_api_name',
    'target_api_name',       p_link->>'target_api_name',
    'source_label',          p_link->>'source_label',
    'target_label',          p_link->>'target_label',
    'source_visibility',     p_link->>'source_visibility',
    'target_visibility',     p_link->>'target_visibility',
    'cardinality',           p_link->>'cardinality',
    'backing_kind',          p_link->>'backing_kind',
    'backing_column',        p_link->>'backing_column',
    'status',                p_link->>'status',
    'visibility',            p_link->>'visibility'));

  IF NOT live THEN
    fields := fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_link->>'ontology_id',''), public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('link_type', t, fields, NULL,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_link_type(jsonb) IS
  'Stage a link type into my working state. Flat — every field is a column — so save_working_state applies it through the generic arm.';

REVOKE ALL ON FUNCTION public.save_link_type(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_link_type(jsonb) TO authenticated;

-- ── shared properties ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_shared_property(p_property jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_property->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.shared_properties WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  fields := jsonb_strip_nulls(jsonb_build_object(
    'api_name',    p_property->>'api_name',
    'label',       p_property->>'label',
    'description', p_property->>'description',
    'base_type',   p_property->>'base_type',
    'visibility',  p_property->>'visibility'));

  IF NOT live THEN
    fields := fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_property->>'ontology_id',''), public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('shared_property', t, fields, NULL,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_shared_property(jsonb) IS
  'Stage a shared property into my working state. One definition used by several object types, so a change here is felt by all of them — which is the argument for it going through a review dialog rather than straight through.';

REVOKE ALL ON FUNCTION public.save_shared_property(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_property(jsonb) TO authenticated;

-- ── deleting, for any kind ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_ontology_resource(p_kind text, p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE live jsonb;
BEGIN
  live := public.ontology_resource_row(p_kind, p_id);

  IF live IS NULL THEN
    -- Either it never existed or it is a creation I have not saved. The second
    -- is a discard, not a deletion, and calling it one would stage a delete for
    -- a row that will never exist.
    IF EXISTS (SELECT 1 FROM public.working_state_changes
                WHERE user_id = auth.uid() AND resource_kind = p_kind
                  AND resource_id = p_id AND operation = 'created') THEN
      RAISE EXCEPTION 'OntologyMetadata:NotSavedYet — % % exists only in your working state', p_kind, p_id
        USING HINT = 'Discard the entry instead; there is nothing in the ontology to delete.';
    END IF;
    RAISE EXCEPTION 'OntologyMetadata:ResourceNotFound — % % does not exist', p_kind, p_id;
  END IF;

  PERFORM public.stage_change(p_kind, p_id, '{}'::jsonb, NULL, 'deleted');
  RETURN p_id;
END $$;

COMMENT ON FUNCTION public.delete_ontology_resource(text, uuid) IS
  'Stage a deletion. The review dialog shows a deleted resource as an entry with a Deleted pill, so it is reviewable and discardable like any other change, and the row survives until save.';

REVOKE ALL ON FUNCTION public.delete_ontology_resource(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_ontology_resource(text, uuid) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; a uuid; b uuid;
  lt uuid; shp uuid; usr uuid := gen_random_uuid(); before text; n int;
  props jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('rest-434') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ws434@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws434@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
                      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS434');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws434', 'WS 434') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws434', 'WS434') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;

  props := jsonb_build_array(jsonb_build_object(
    'property_id','k','display_name','K','api_name','k','base_type','string',
    'source','column','backing_column','k','is_primary_key',true,'is_title_key',true,'required',true));

  a := public.save_object_type(jsonb_build_object('api_name','Flight','label','Flight',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))), props);
  PERFORM public.save_working_state();

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'alerts', 'alerts') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  b := public.save_object_type(jsonb_build_object('api_name','Alert','label','Alert',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', ds::text, 'branch_id', br::text))), props);
  PERFORM public.save_working_state();

  -- 1. A link type stages instead of writing.
  lt := public.save_link_type(jsonb_build_object(
    'source_object_type_id', a::text, 'target_object_type_id', b::text,
    'api_name','flightAlerts', 'label','Flight alerts', 'ontology_id', ont::text));
  IF EXISTS (SELECT 1 FROM public.link_types WHERE id = lt) THEN
    RAISE EXCEPTION 'a link type wrote straight through';
  END IF;

  -- 2. A shared property too, in the same session.
  shp := public.save_shared_property(jsonb_build_object(
    'api_name','cost', 'label','Cost', 'base_type','double', 'ontology_id', ont::text));
  SELECT count(*) INTO n FROM public.working_state_changes;
  IF n <> 2 THEN RAISE EXCEPTION 'expected two entries in one session, found %', n; END IF;

  -- 3. One save lands both, through the generic arm.
  IF public.save_working_state() <> 2 THEN
    RAISE EXCEPTION 'the save did not apply both resources';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.link_types WHERE id = lt AND api_name = 'flightAlerts') THEN
    RAISE EXCEPTION 'the link type never landed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_properties WHERE id = shp AND base_type = 'double') THEN
    RAISE EXCEPTION 'the shared property never landed';
  END IF;

  -- 4. An edit to a flat resource changes only what it named.
  PERFORM public.save_link_type(jsonb_build_object('id', lt::text, 'label','Alerts on flight'));
  PERFORM public.save_working_state();
  IF (SELECT api_name FROM public.link_types WHERE id = lt) <> 'flightAlerts' THEN
    RAISE EXCEPTION 'a label edit overwrote the api name';
  END IF;

  -- 5. A deletion is staged, and the row survives until save.
  PERFORM public.delete_ontology_resource('shared_property', shp);
  IF NOT EXISTS (SELECT 1 FROM public.shared_properties WHERE id = shp) THEN
    RAISE EXCEPTION 'a staged deletion took effect immediately';
  END IF;
  IF (SELECT operation FROM public.working_state_changes WHERE resource_id = shp) <> 'deleted' THEN
    RAISE EXCEPTION 'the deletion did not stage as one';
  END IF;

  -- 6. Discarding it puts the resource back, because it never went anywhere.
  PERFORM public.discard_working_state('shared_property', shp);
  IF NOT EXISTS (SELECT 1 FROM public.shared_properties WHERE id = shp) THEN
    RAISE EXCEPTION 'discarding a staged deletion deleted it';
  END IF;

  -- 7. And on save it is gone.
  PERFORM public.delete_ontology_resource('shared_property', shp);
  PERFORM public.save_working_state();
  IF EXISTS (SELECT 1 FROM public.shared_properties WHERE id = shp) THEN
    RAISE EXCEPTION 'the deletion did not land';
  END IF;

  -- 8. Deleting something that exists only in my working state is a discard.
  shp := public.save_shared_property(jsonb_build_object(
    'api_name','unsaved', 'label','Unsaved', 'base_type','string', 'ontology_id', ont::text));
  BEGIN
    PERFORM public.delete_ontology_resource('shared_property', shp);
    RAISE EXCEPTION 'an unsaved creation was staged for deletion';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%NotSavedYet%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '434: link types, shared properties and deletions go through the session';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
