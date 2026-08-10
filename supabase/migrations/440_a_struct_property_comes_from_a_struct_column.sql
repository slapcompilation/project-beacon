-- A struct property comes from a struct column, so a backing datasource must
-- be allowed to contain one.
--
-- Found by the nightly foundry-gap run. `guard_object_type_datasource()`
-- rejected any datasource whose schema holds a STRUCT column — while our own
-- `property_base_types()` lists `struct` as a base type. Every struct property
-- was unbuildable: the column it must be created from could never be bound.
-- Nothing noticed because zero object types exist; a trigger on an empty
-- table is invisible to audits that only read.
--
-- The corpus genuinely says both things, and this is a contradiction to
-- resolve rather than a citation to correct:
--
--   "A backing datasource for an object type may not contain `MapType` or
--    `StructType` columns."                    (create-object-type.md, in the
--                                               helper's select-a-datasource
--                                               step, right after the column
--                                               auto-mapping paragraph)
--
--   "A **struct** is an Ontology property base type that allows users to
--    create schema-based properties with multiple fields. **Struct properties
--    are created from struct type dataset columns.**"
--                                              (structs-overview.md)
--
--   "**Struct:** A type for defining schema-based properties with multiple
--    fields."                                  (base-types.md)
--
-- Resolution: the specific pages win. Two pages make struct a first-class base
-- type whose values COME from struct dataset columns; under the helper page's
-- callout that type could never exist. The callout sits in the wizard flow
-- beside the auto-map step, and auto-mapping a struct column is plausibly what
-- it forbids — but that reading is INFERENCE; what is not inference is that
-- the blanket reading contradicts two other pages and makes part of the
-- documented type system unreachable.
--
-- MAP stays rejected: it is not in `property_base_types()`, and no page makes
-- a property from a map column.

CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql
AS $$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_org uuid;
BEGIN
  SELECT organization_id INTO ds_org FROM public.datasets     WHERE id = NEW.dataset_id;
  SELECT organization_id INTO ot_org FROM public.object_types WHERE id = NEW.object_type_id;
  IF ds_org IS DISTINCT FROM ot_org THEN
    RAISE EXCEPTION 'Ontology:DatasourceInAnotherOrganization — a datasource must belong to the object type''s organization';
  END IF;

  SELECT object_type_id INTO holder FROM public.object_type_datasources
   WHERE dataset_id = NEW.dataset_id AND branch_id = NEW.branch_id
     AND id IS DISTINCT FROM NEW.id;
  IF holder IS NOT NULL THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already backing a different object type and cannot be used again'
      USING HINT = 'Pick another dataset, or another branch of this one.';
  END IF;

  -- "Object types are limited to a maximum of 70 datasources."
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id;
  IF n >= 70 THEN
    RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources, and this one already has %', n;
  END IF;

  -- MAP only. "Struct properties are created from struct type dataset columns"
  -- — a struct column is where a struct property comes from, so it cannot be
  -- grounds for refusing the datasource. Map is not a base type of ours or of
  -- base-types.md, and stays out.
  SELECT string_agg(f ->> 'name', ', ') INTO bad
    FROM jsonb_array_elements(coalesce(public.dataset_branch_schema(NEW.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' = 'MAP';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP columns (%)', bad
      USING HINT = 'Map is not a property base type; there is nothing a MAP column could back.';
  END IF;

  RETURN NEW;
END $$;

-- ── the same rule lives a second time in ontology_violations() ─────────────
-- 410 wrote it twice on purpose — the trigger refuses a bad binding at write
-- time, the violations query reports one that arrived later through a new
-- transaction on an already-bound branch. Both copies must agree, or a
-- datasource the trigger accepts is flagged forever by the badge. Patched in
-- place: the needle is asserted present first and gone after, so a drifted
-- definition fails loudly instead of silently not patching.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.ontology_violations()'::regprocedure);
  IF def NOT LIKE '%IN (''MAP'', ''STRUCT'')%' THEN
    RAISE EXCEPTION 'ontology_violations() no longer contains the MAP/STRUCT predicate — patch it by hand';
  END IF;
  EXECUTE replace(def, 'IN (''MAP'', ''STRUCT'')', '= ''MAP''');
  IF pg_get_functiondef('public.ontology_violations()'::regprocedure) LIKE '%''STRUCT''%' THEN
    RAISE EXCEPTION 'the STRUCT half of the rule survived the patch';
  END IF;
END $$;

-- ── the stager was defeating 428's fix, found by the assertion below ───────
-- 428 made an absent section mean "unchanged". But `save_object_type` (427)
-- stamps `'datasources': coalesce(given, '[]')` into every entry — so a caller
-- that never mentioned datasources stages an EMPTY list, not an absent one,
-- and the save reads empty as "unbind them all". The assertion tripped it: a
-- second save adding a property blew up on the FK of the binding it was
-- unbinding. Sections now enter the entry only when the caller supplies them.
CREATE OR REPLACE FUNCTION public.save_object_type(
  p_object_type jsonb,
  p_properties  jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
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
  ));

  -- Only what the caller actually said. An invented empty section is an
  -- instruction to delete everything in it.
  IF p_properties IS NOT NULL THEN
    v_fields := v_fields || jsonb_build_object('properties', p_properties);
  END IF;
  IF p_object_type ? 'datasources' THEN
    v_fields := v_fields || jsonb_build_object('datasources', p_object_type->'datasources');
  END IF;

  IF NOT exists_live THEN
    v_fields := v_fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_object_type->>'ontology_id',''),
                              public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('object_type', t, v_fields, NULL,
                              CASE WHEN exists_live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $fn$;

COMMENT ON FUNCTION public.save_object_type(jsonb, jsonb) IS
  'Stage an object type and its properties into my working state. Sections enter the entry only when supplied — an absent section means unedited, and an invented empty one would mean delete-all on save. Returns the id it will have; the row does not exist until save_working_state runs.';

REVOKE ALL ON FUNCTION public.save_object_type(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_object_type(jsonb, jsonb) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; t uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('struct-440') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws440@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws440@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS440');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws440', 'WS 440') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws440', 'WS440') RETURNING id INTO proj;

  -- A dataset whose committed schema contains a STRUCT column.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'people', 'people') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"person_id","type":"STRING"},
      {"name":"full_name","type":"STRUCT","subSchemas":[{"name":"first","type":"STRING"},{"name":"last","type":"STRING"}]}]'::jsonb);
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  -- 1. The struct column no longer blocks the binding.
  t := public.save_object_type(
    jsonb_build_object('api_name','Person','label','Person','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','person_id','display_name','Person Id','api_name','personId',
        'base_type','string','source','column','backing_column','person_id',
        'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  -- 2. And the struct property the page describes can exist against it. A
  --    non-key property names the datasource ROW it reads, which exists only
  --    after the binding above landed — hence the second save.
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Person','label','Person'),
    jsonb_build_array(
      jsonb_build_object('property_id','person_id','display_name','Person Id','api_name','personId',
        'base_type','string','source','column','backing_column','person_id',
        'is_primary_key',true,'is_title_key',true,'required',true),
      jsonb_build_object('property_id','full_name','display_name','Full Name','api_name','fullName',
        'base_type','struct','source','column','backing_column','full_name',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources
                           WHERE object_type_id = t))));
  PERFORM public.save_working_state();
  IF NOT EXISTS (SELECT 1 FROM public.object_type_properties
                  WHERE object_type_id = t AND base_type = 'struct') THEN
    RAISE EXCEPTION 'the struct property did not land';
  END IF;
  -- The save never mentioned datasources, so the binding must have survived.
  IF (SELECT count(*) FROM public.object_type_datasources WHERE object_type_id = t) <> 1 THEN
    RAISE EXCEPTION 'a save that never mentioned datasources unbound one';
  END IF;

  -- 3. A MAP column still refuses the whole datasource.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'bad', 'bad') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"k","type":"STRING"},
      {"name":"attrs","type":"MAP","mapKeyType":{"type":"STRING"},"mapValueType":{"type":"STRING"}}]'::jsonb);
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  BEGIN
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
    VALUES (t, ds, br);
    RAISE EXCEPTION 'a MAP column was accepted as a backing datasource';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%UnsupportedColumnType%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '440: a struct column binds and a map column does not';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
