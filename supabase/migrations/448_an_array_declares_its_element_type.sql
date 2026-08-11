-- An array property declares its element type, which makes two documented
-- rules enforceable that were silently not.
--
-- The open QA item the nightly gap run re-surfaced: "array properties have no
-- element-type column… blocks two documented rules". The rules, verbatim:
--
--   "All base types may be used in arrays to represent multiple values for a
--    property, excluding the `Vector` and `Time series` types."
--                                          (object-link-types/base-types)
--
--   "If the inner type of the `Array` is not a valid title property, the
--    `Array` property also cannot be used as the title property."
--   "Nested arrays are not supported in Object Storage v2."
--                                          (object-link-types/properties-overview)
--
-- The title rule composes through the function that already answers title
-- eligibility — `title_key_eligible()` gets the ELEMENT type when the property
-- is an array, so the rule is one CASE, not a second list.

ALTER TABLE public.object_type_properties
  ADD COLUMN array_element_type text,
  -- An array names its element; nothing else carries one.
  ADD CONSTRAINT array_declares_element
    CHECK ((base_type = 'array') = (array_element_type IS NOT NULL)),
  -- "Nested arrays are not supported in Object Storage v2."
  ADD CONSTRAINT array_not_nested
    CHECK (array_element_type IS DISTINCT FROM 'array'),
  -- "excluding the Vector and Time series types"
  ADD CONSTRAINT array_element_allowed
    CHECK (array_element_type IS NULL
           OR (array_element_type = ANY (public.property_base_types())
               AND array_element_type NOT IN ('vector', 'time_series')));

COMMENT ON COLUMN public.object_type_properties.array_element_type IS
  'The base type of an array property''s elements. Required exactly when base_type is array; never array (no nesting), never vector or time_series.';

-- The title rule, composed through the element.
ALTER TABLE public.object_type_properties DROP CONSTRAINT object_type_properties_check2;
ALTER TABLE public.object_type_properties ADD CONSTRAINT object_type_properties_check2
  CHECK ((NOT is_title_key) OR public.title_key_eligible(
           CASE WHEN base_type = 'array' THEN array_element_type ELSE base_type END));

-- The writer carries the column.
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
    base_type, array_element_type, source, datasource_id, backing_column,
    shared_property_id, required, visibility, position, is_primary_key, is_title_key)
  SELECT
    t, e->>'property_id', e->>'display_name', e->>'api_name',
    coalesce(e->>'description', ''),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(e->'aliases')), '{}'::text[]),
    e->>'base_type',
    nullif(e->>'array_element_type', ''),
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
    array_element_type = EXCLUDED.array_element_type,
    source             = EXCLUDED.source,
    datasource_id      = EXCLUDED.datasource_id,
    backing_column     = EXCLUDED.backing_column,
    shared_property_id = EXCLUDED.shared_property_id,
    required           = EXCLUDED.required,
    visibility         = EXCLUDED.visibility,
    position           = EXCLUDED.position,
    is_primary_key     = EXCLUDED.is_primary_key,
    is_title_key       = EXCLUDED.is_title_key;

  DELETE FROM public.object_type_datasources d
   WHERE d.object_type_id = t
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_datasources) e
                      WHERE (e->>'dataset_id')::uuid = d.dataset_id
                        AND (e->>'branch_id')::uuid  = d.branch_id);

  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  SELECT t, (e->>'dataset_id')::uuid, (e->>'branch_id')::uuid
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_type_datasources d
      WHERE d.dataset_id = (e->>'dataset_id')::uuid
        AND d.branch_id  = (e->>'branch_id')::uuid);

  RETURN t;
END $$;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('array-448') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws448@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws448@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS448');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws448', 'WS 448') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws448', 'WS448') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'a448', 'a448') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;

  -- 1. An array of strings lands, with its element recorded. Two saves: the
  --    non-key property names the datasource row the first save creates.
  t := public.save_object_type(
    jsonb_build_object('api_name','Tagged','label','Tagged','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','k','display_name','K','api_name','k',
        'base_type','string','source','column','backing_column','k',
        'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Tagged','label','Tagged'),
    jsonb_build_array(
      jsonb_build_object('property_id','k','display_name','K','api_name','k',
        'base_type','string','source','column','backing_column','k',
        'is_primary_key',true,'is_title_key',true,'required',true),
      jsonb_build_object('property_id','tags','display_name','Tags','api_name','tags',
        'base_type','array','array_element_type','string',
        'source','column','backing_column','tags',
        'datasource_id', (SELECT id::text FROM public.object_type_datasources
                           WHERE object_type_id = t))));
  PERFORM public.save_working_state();
  IF (SELECT array_element_type FROM public.object_type_properties
       WHERE object_type_id = t AND property_id = 'tags') <> 'string' THEN
    RAISE EXCEPTION 'the element type did not land';
  END IF;

  -- 2. An array without an element refuses.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
    VALUES (t, 'bad', 'Bad', 'bad', 'array', 'column', 'bad');
    RAISE EXCEPTION 'an array with no element type was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. Nested arrays and the two excluded element types refuse.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, array_element_type, source, backing_column)
    VALUES (t, 'bad2', 'Bad', 'bad2', 'array', 'array', 'column', 'bad2');
    RAISE EXCEPTION 'a nested array was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, array_element_type, source, backing_column)
    VALUES (t, 'bad3', 'Bad', 'bad3', 'array', 'vector', 'column', 'bad3');
    RAISE EXCEPTION 'an array of vectors was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 4. The title rule composes through the element: an array of markings
  --    cannot be the title, an array of strings can.
  BEGIN
    UPDATE public.object_type_properties
       SET array_element_type = 'marking' WHERE object_type_id = t AND property_id = 'tags';
    UPDATE public.object_type_properties
       SET is_title_key = true WHERE object_type_id = t AND property_id = 'tags';
    RAISE EXCEPTION 'an array of markings became the title';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '448: arrays declare their element, and both documented rules now enforce';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
