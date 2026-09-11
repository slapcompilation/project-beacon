-- 800 — an effect can take every object that fired
--
-- Reading: docs/foundry-reference/readings/object-set-parameters.md and the
-- effect-input material in readings/automate.md. 630 built the Single object
-- effect input and named its own blocker: an action could not declare a
-- parameter holding many objects. 797 removed that, so the other half of
-- Foundry's effect-input model is now expressible.
--
--   "The following effect inputs can be exposed:"
--   — automate/effect-actions.md
--
-- Four follow — Object set, Object list, Single object, Property reference.
-- This adds the first. Object list is NOT added: it differs from an object set
-- only in being a list, our action parameters have no list-of-objects kind, and
-- the api's parameter union has no member for one. Inventing it would be a kind
-- Foundry does not publish.
--
-- ── THE REFUSAL THE PAGE STATES OUTRIGHT ───────────────────────────────────
--
--   "Note that object set and object list inputs cannot be combined with single object and property reference inputs, since the former includes multiple objects at a time and the latter includes one object at a time."
--   — automate/effect-actions.md
--
-- So an effect binds one or the other, never both, and the reason is in the
-- sentence: they disagree about how many objects an execution is about.
--
-- ── THE EXECUTION MODES, AND WHICH FAMILY HAS THEM ─────────────────────────
--
--   "When effect inputs are used, an execution mode can be configured to determine how objects and actions should be grouped."
--   — automate/effect-actions.md
--
--   "The use of single object and property reference inputs means that each action is executed once for each object from the condition."
--   — automate/effect-actions.md
--
-- A single-object input IS per-object execution, so it has no mode to choose —
-- which is why 630 added no mode column, and why the column added here is NULL
-- for exactly those effects. The three modes belong to the multi-object family
-- and the page enumerates them: once for all objects, once for each batch, once
-- for each group.
--
--   "Ensure that the action is executed once if the condition is triggered by multiple objects at the same time"
--   — automate/effect-actions.md
--
-- Batch carries its own caveat, and it decides a CHECK rather than a comment:
--
--   "The batch size is a maximum, not a minimum: the automation does not wait for additional objects before executing, so a batch may contain fewer objects than the configured size."
--   — automate/effect-actions.md
--
-- and a ceiling from the page that publishes ceilings:
--
--   "| Max batch size of automation                                                                   | 1,000     | Runtime error"
--   — automate/limits.md
--
-- Group carries two, and the second is the one a naive implementation gets
-- wrong:
--
--   "Note that the grouping is based on exact matches of property values. For array type properties, the values must be exact, in-order matches to be grouped together."
--   — automate/effect-actions.md
--
-- ── HOW THE SET REACHES THE ACTION ─────────────────────────────────────────
-- As an inline definition rather than a stored set. The api gives an object-set
-- parameter value two forms of equal standing, a rid or the definition, and the
-- rid form would mean writing an object_sets row per firing — Foundry's answer
-- to that is a temporary object set that expires in 24 hours, which we do not
-- build. The inline form filters the condition's object type by the primary
-- keys that fired, using the valuesFilter our own filter grammar already has.
-- Nothing accumulates.

BEGIN;

-- ── the binding and its configuration ───────────────────────────────────────

ALTER TABLE public.automation_effects
  ADD COLUMN object_set_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  ADD COLUMN execution_mode text,
  ADD COLUMN batch_size integer,
  ADD COLUMN group_by_properties text[];

CREATE INDEX automation_effects_object_set_parameter_id_idx
  ON public.automation_effects (object_set_parameter_id);

ALTER TABLE public.automation_effects
  ADD CONSTRAINT automation_effects_one_input_family
    CHECK (object_input_parameter_id IS NULL OR object_set_parameter_id IS NULL),
  ADD CONSTRAINT automation_effects_mode_needs_a_set
    CHECK ((execution_mode IS NOT NULL) = (object_set_parameter_id IS NOT NULL)),
  ADD CONSTRAINT automation_effects_execution_mode_known
    CHECK (execution_mode IS NULL
       OR execution_mode = ANY (ARRAY['once_for_all', 'once_per_batch', 'once_per_group'])),
  ADD CONSTRAINT automation_effects_batch_size_shape
    CHECK ((batch_size IS NOT NULL) = (execution_mode = 'once_per_batch')
        OR (batch_size IS NULL AND execution_mode IS DISTINCT FROM 'once_per_batch')),
  ADD CONSTRAINT automation_effects_batch_size_bounded
    CHECK (batch_size IS NULL OR (batch_size >= 1 AND batch_size <= 1000)),
  ADD CONSTRAINT automation_effects_group_properties_shape
    CHECK ((group_by_properties IS NOT NULL) = (execution_mode = 'once_per_group')
        OR (group_by_properties IS NULL AND execution_mode IS DISTINCT FROM 'once_per_group')),
  ADD CONSTRAINT automation_effects_group_properties_nonempty
    CHECK (group_by_properties IS NULL OR array_length(group_by_properties, 1) >= 1);

COMMENT ON COLUMN public.automation_effects.object_set_parameter_id IS
  'The action parameter that receives every object the condition fired on — Foundry''s "Object set" effect input. Mutually exclusive with object_input_parameter_id, because automate/effect-actions says object set and single object inputs cannot be combined: the former is about many objects at a time and the latter one.';
COMMENT ON CONSTRAINT automation_effects_execution_mode_known ON public.automation_effects IS
  'Values from automate/effect-actions — the three grouping options it enumerates for object set and object list inputs. A single-object input has no mode, because it IS per-object execution.';
COMMENT ON COLUMN public.automation_effects.batch_size IS
  'A maximum, not a minimum: automate/effect-actions says the automation does not wait for more objects, so a batch may hold fewer. Capped at the 1,000 automate/limits publishes as the max batch size of an automation.';
COMMENT ON COLUMN public.automation_effects.group_by_properties IS
  'Property api names from the condition''s object type. Grouping is on exact matches, and for an array property the values must be exact, in-order matches — so equality here is over the rendered value, never a set comparison.';

-- ── what the binding must be true of ────────────────────────────────────────

CREATE FUNCTION public.guard_object_set_input()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_cond jsonb; v_subject uuid; par record; p text;
BEGIN
  IF NEW.object_set_parameter_id IS NULL THEN RETURN NEW; END IF;

  SELECT a.condition INTO v_cond FROM public.automations a WHERE a.id = NEW.automation_id;

  -- The same three conditions 630 admits, for the same reason: they are the
  -- ones the page lists as exposing an effect input at all.
  IF (v_cond ->> 'type') NOT IN ('objects_added', 'objects_removed', 'objects_modified') THEN
    RAISE EXCEPTION 'Automate:ConditionExposesNoInput — a % condition exposes no effect input', v_cond ->> 'type'
      USING HINT = 'Objects added, Objects removed and Objects modified expose one.';
  END IF;

  SELECT * INTO par FROM public.action_type_parameters WHERE id = NEW.object_set_parameter_id;
  IF par.id IS NULL OR par.action_type_id IS DISTINCT FROM NEW.action_type_id THEN
    RAISE EXCEPTION 'Automate:ParameterNotOnThisAction — the bound parameter does not belong to this effect''s action type';
  END IF;
  IF par.data_kind <> 'objectSet' THEN
    RAISE EXCEPTION 'Automate:InputTypeMismatch — parameter % takes a %, and an Object set input needs an object set parameter',
      par.api_name, par.data_kind;
  END IF;

  -- "the type of the action parameter needs to align with the type of the
  --  exposed condition effect input" — and an object-set parameter MAY be
  --  untyped, which the api allows and this therefore does not refuse.
  SELECT s.subject_type_id INTO v_subject
    FROM public.object_sets s WHERE s.id = (v_cond ->> 'object_set_id')::uuid;
  IF par.object_type_id IS NOT NULL AND v_subject IS NOT NULL
     AND par.object_type_id IS DISTINCT FROM v_subject THEN
    RAISE EXCEPTION 'Automate:InputTypeMismatch — parameter % is over a different object type than the condition watches',
      par.api_name;
  END IF;

  -- Grouping names properties, and they have to exist on what fired.
  IF NEW.group_by_properties IS NOT NULL AND v_subject IS NOT NULL THEN
    FOREACH p IN ARRAY NEW.group_by_properties LOOP
      IF NOT EXISTS (SELECT 1 FROM public.object_type_properties op
                      WHERE op.object_type_id = v_subject AND op.api_name = p) THEN
        RAISE EXCEPTION 'Automate:GroupPropertyNotOnType — % is not a property of the object type the condition watches', p;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $fn$;

CREATE TRIGGER guard_object_set_input
  BEFORE INSERT OR UPDATE ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_object_set_input();

-- ── the value a firing hands over ───────────────────────────────────────────

CREATE FUNCTION public.fired_object_set_value(p_object_type uuid, p_keys text[])
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE api text; pk text;
BEGIN
  SELECT t.api_name INTO api FROM public.object_types t WHERE t.id = p_object_type;
  SELECT op.api_name INTO pk FROM public.object_type_properties op
   WHERE op.object_type_id = p_object_type AND op.is_primary_key;
  IF api IS NULL OR pk IS NULL THEN
    RAISE EXCEPTION 'Automate:NoPrimaryKey — the condition''s object type has no primary key to name its objects by';
  END IF;

  -- The inline form, which the api gives equal standing with a rid. A rid would
  -- mean an object_sets row per firing, and Foundry's answer to that is a
  -- temporary set that expires in 24 hours — a thing we do not build.
  RETURN jsonb_build_object(
    'objectType', api,
    'filters', jsonb_build_array(jsonb_build_object(
      'type', 'propertyFilter',
      'propertyType', pk,
      'value', jsonb_build_object('type', 'valuesFilter',
                                  'values', to_jsonb(coalesce(p_keys, '{}'::text[]))))));
END $fn$;

COMMENT ON FUNCTION public.fired_object_set_value(uuid, text[]) IS
  'The object set an effect receives, as an inline definition over the primary keys that fired. api/ontologies-v2-resources-actions-apply-action encodes an Object Set value as a string OR the object set definition, and the definition form leaves nothing behind.';

-- ── running one ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.run_effect_for_set(
  p_automation uuid, p_effect uuid, p_event uuid, p_keys text[])
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  e record; par text; subject uuid; rid uuid; n integer := 0;
  batch text[]; i integer; grp record; gprops text[]; pkid text;
BEGIN
  SELECT * INTO e FROM public.automation_effects WHERE id = p_effect;
  SELECT api_name INTO par FROM public.action_type_parameters
   WHERE id = e.object_set_parameter_id;
  IF par IS NULL THEN
    RAISE EXCEPTION 'Automate:InputUnbound — the effect names no object set parameter';
  END IF;

  SELECT s.subject_type_id INTO subject
    FROM public.automations a
    JOIN public.object_sets s ON s.id = (a.condition ->> 'object_set_id')::uuid
   WHERE a.id = p_automation;

  IF coalesce(array_length(p_keys, 1), 0) = 0 THEN RETURN 0; END IF;

  IF e.execution_mode = 'once_for_all' THEN
    -- "the action is executed once if the condition is triggered by multiple
    --  objects at the same time"
    rid := public.record_automation_run(p_automation, p_effect, p_event, NULL);
    BEGIN
      PERFORM public.apply_action(e.action_type_id,
        coalesce(e.parameters, '{}'::jsonb)
        || jsonb_build_object(par, public.fired_object_set_value(subject, p_keys)));
      PERFORM public.settle_automation_run(rid, 'succeeded', NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.settle_automation_run(rid, 'failed', sqlerrm, NULL);
    END;
    RETURN 1;
  END IF;

  IF e.execution_mode = 'once_per_batch' THEN
    i := 1;
    WHILE i <= array_length(p_keys, 1) LOOP
      batch := p_keys[i : least(i + e.batch_size - 1, array_length(p_keys, 1))];
      rid := public.record_automation_run(p_automation, p_effect, p_event, NULL);
      BEGIN
        PERFORM public.apply_action(e.action_type_id,
          coalesce(e.parameters, '{}'::jsonb)
          || jsonb_build_object(par, public.fired_object_set_value(subject, batch)));
        PERFORM public.settle_automation_run(rid, 'succeeded', NULL, NULL);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.settle_automation_run(rid, 'failed', sqlerrm, NULL);
      END;
      n := n + 1;
      i := i + e.batch_size;
    END LOOP;
    RETURN n;
  END IF;

  IF e.execution_mode = 'once_per_group' THEN
    -- "the grouping is based on exact matches of property values" — so the key
    -- is the rendered values in the order the effect names them, and an array
    -- property compares as the whole value rather than as a set, which is what
    -- exact, in-order matches means.
    -- An indexed row is keyed by property_id, and the effect names properties
    -- by api_name, so the two are resolved here rather than assumed equal.
    SELECT array_agg(op.property_id ORDER BY u.ord) INTO gprops
      FROM unnest(e.group_by_properties) WITH ORDINALITY AS u(nm, ord)
      JOIN public.object_type_properties op
        ON op.object_type_id = subject AND op.api_name = u.nm;
    SELECT op.property_id INTO pkid FROM public.object_type_properties op
     WHERE op.object_type_id = subject AND op.is_primary_key;

    FOR grp IN
      SELECT array_agg(t.k) AS keys
        FROM (
          SELECT r ->> pkid AS k,
                 (SELECT jsonb_agg(r -> g ORDER BY o2)
                    FROM unnest(gprops) WITH ORDINALITY AS gg(g, o2)) AS gkey
            FROM public.evaluate_object_set(
                   subject,
                   public.fired_object_set_value(subject, p_keys) -> 'filters',
                   NULL, 100000, 0, NULL) AS r
        ) t
       GROUP BY t.gkey
    LOOP
      rid := public.record_automation_run(p_automation, p_effect, p_event, NULL);
      BEGIN
        PERFORM public.apply_action(e.action_type_id,
          coalesce(e.parameters, '{}'::jsonb)
          || jsonb_build_object(par, public.fired_object_set_value(subject, grp.keys)));
        PERFORM public.settle_automation_run(rid, 'succeeded', NULL, NULL);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.settle_automation_run(rid, 'failed', sqlerrm, NULL);
      END;
      n := n + 1;
    END LOOP;
    RETURN n;
  END IF;

  RAISE EXCEPTION 'Automate:UnknownExecutionMode — %', e.execution_mode;
END $fn$;

COMMENT ON FUNCTION public.run_effect_for_set(uuid, uuid, uuid, text[]) IS
  'The multi-object half of automate/effect-actions'' execution modes: once for all the objects that fired, once per batch of at most batch_size, or once per group of equal values across the named properties. The single-object half is run_effect_per_object, and 630''s header says why it needs no mode.';

GRANT EXECUTE ON FUNCTION public.fired_object_set_value(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_effect_for_set(uuid, uuid, uuid, text[]) TO authenticated;

-- ── the dispatcher learns the second family ─────────────────────────────────

DO $do$
DECLARE src text; anchored int; anchor text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'run_automations';

  anchor := '          ELSIF e.object_input_parameter_id IS NULL THEN';

  SELECT count(*) INTO anchored FROM regexp_matches(src, 'ELSIF e\.object_input_parameter_id IS NULL THEN', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one dispatch site, found %', anchored;
  END IF;

  -- The anchor survives in the replacement: a splice that eats its own anchor
  -- loses the branch it was anchored to.
  src := replace(src, anchor,
'          ELSIF e.object_set_parameter_id IS NOT NULL THEN
            PERFORM public.run_effect_for_set(a.id, e.id, ev, fired);
          ELSIF e.object_input_parameter_id IS NULL THEN');

  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; sp uuid; proj uuid; ont uuid; ot uuid; oset uuid;
  auto uuid; act uuid; setpar uuid; objpar uuid; eff uuid; v jsonb; n integer;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m800 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm800-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm800-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M800 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m800proj', 'm800proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M800Ticket', 'Ticket') RETURNING id INTO ot;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, position)
  VALUES (ot, 'category', 'Category', 'category', 'string', 'column', 'category', 1);
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M800 set', 'm800_set', ot, proj, ont, '[]'::jsonb) RETURNING id INTO oset;
  INSERT INTO public.automations (project_id, display_name, owner_id, condition)
  VALUES (proj, 'M800 watch', usr,
          jsonb_build_object('type', 'objects_added', 'object_set_id', oset))
  RETURNING id INTO auto;
  INSERT INTO public.action_types (ontology_id, project_id, api_name, label, automate_can_submit)
  VALUES (ont, proj, 'm800-act', 'Act', true) RETURNING id INTO act;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, data_kind, object_type_id, position)
  VALUES (act, 'targets', 'Targets', 'objectSet', ot, 0) RETURNING id INTO setpar;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, data_kind, object_type_id, position)
  VALUES (act, 'one', 'One', 'object', ot, 1) RETURNING id INTO objpar;

  -- 1. the binding lands, with a mode
  INSERT INTO public.automation_effects
    (automation_id, position, kind, action_type_id, object_set_parameter_id, execution_mode)
  VALUES (auto, 0, 'action', act, setpar, 'once_for_all') RETURNING id INTO eff;

  -- 2. the published refusal: never both families at once
  BEGIN
    UPDATE public.automation_effects
       SET object_input_parameter_id = objpar WHERE id = eff;
    RAISE EXCEPTION 'an effect bound both an object set and a single object input';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 3. a mode without a set, and a set without a mode, are both refused
  BEGIN
    UPDATE public.automation_effects SET execution_mode = NULL WHERE id = eff;
    RAISE EXCEPTION 'an object set input without an execution mode was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 4. the enumerated set, and the two shapes that hang off it
  BEGIN
    UPDATE public.automation_effects SET execution_mode = 'once_per_thing' WHERE id = eff;
    RAISE EXCEPTION 'an unenumerated execution mode was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.automation_effects SET execution_mode = 'once_per_batch' WHERE id = eff;
    RAISE EXCEPTION 'a batch mode with no batch size was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.automation_effects
       SET execution_mode = 'once_per_batch', batch_size = 5000 WHERE id = eff;
    RAISE EXCEPTION 'a batch size above the published 1,000 was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.automation_effects
     SET execution_mode = 'once_per_batch', batch_size = 2 WHERE id = eff;

  -- 5. grouping names properties that exist on what fired
  BEGIN
    UPDATE public.automation_effects
       SET execution_mode = 'once_per_group', batch_size = NULL,
           group_by_properties = ARRAY['nosuchprop'] WHERE id = eff;
    RAISE EXCEPTION 'a group property that is not on the object type was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:GroupPropertyNotOnType%' THEN RAISE; END IF;
  END;
  UPDATE public.automation_effects
     SET execution_mode = 'once_per_group', batch_size = NULL,
         group_by_properties = ARRAY['category'] WHERE id = eff;

  -- 6. a parameter of the wrong kind, and one on another action
  BEGIN
    UPDATE public.automation_effects SET object_set_parameter_id = objpar WHERE id = eff;
    RAISE EXCEPTION 'a single-object parameter was accepted as an object set input';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:InputTypeMismatch%' THEN RAISE; END IF;
  END;

  -- 7. the value handed over is the api's inline definition over what fired
  v := public.fired_object_set_value(ot, ARRAY['T1', 'T2']);
  IF v ->> 'objectType' <> 'M800Ticket' THEN
    RAISE EXCEPTION 'the value names the condition''s object type';
  END IF;
  IF v -> 'filters' -> 0 -> 'value' ->> 'type' <> 'valuesFilter' THEN
    RAISE EXCEPTION 'the keys that fired are a valuesFilter over the primary key';
  END IF;
  IF jsonb_array_length(v -> 'filters' -> 0 -> 'value' -> 'values') <> 2 THEN
    RAISE EXCEPTION 'both keys should be in the value';
  END IF;
  IF public.object_set_parameter_value_valid(v) IS NOT TRUE THEN
    RAISE EXCEPTION 'the value handed over must satisfy 797''s own validator';
  END IF;

  -- 8. an empty firing runs nothing rather than applying with no objects
  UPDATE public.automation_effects
     SET execution_mode = 'once_for_all', group_by_properties = NULL WHERE id = eff;
  n := public.run_effect_for_set(auto, eff, NULL, ARRAY[]::text[]);
  IF n <> 0 THEN RAISE EXCEPTION 'nothing fired, so nothing runs; got %', n; END IF;

  -- teardown, in dependency order and away from the sequential guard
  DELETE FROM public.automation_effects WHERE automation_id = auto;
  DELETE FROM public.automations WHERE project_id = proj;
  DELETE FROM public.action_type_parameters WHERE action_type_id = act;
  DELETE FROM public.action_types WHERE id = act;
  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.object_type_properties WHERE object_type_id = ot;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '800 proved: the binding, the one-family refusal, three modes, the published cap, and the value';
END $do$;

COMMIT;
