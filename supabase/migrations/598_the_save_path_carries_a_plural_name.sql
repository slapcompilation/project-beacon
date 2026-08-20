-- 598 — the save path carries a plural name
--
-- 415 gave object_types.plural_label a column and nothing has ever written it,
-- so every type's Plural name is the empty default. The Overview card built
-- alongside this migration reads it, and a field that can only ever be empty is
-- the state readings/object-type-overview.md warns about.
--
-- WHY IT IS DERIVED IN THE SURFACE AND NOT HERE. Foundry's wizard fills it as
-- you type the name:
--
--     "2. Name: [<username>] Flight Alert (plural auto-updates)."
--     -- docs/foundry-deep-dives/01-ontology.md
--
-- and Pipeline Builder says the same of its own dialog:
--
--     "Note that the Plural name and Object type ID will auto-populate from
--      Name for convenience."
--     -- pipeline-builder/outputs-add-ontology-output.md
--
-- Auto-populate FOR CONVENIENCE is a surface affordance the operator overrides,
-- not a stored rule, so this function only carries the value it is given. The
-- web derives it exactly where it already derives the API name from the label.
--
-- MY FIRST READING SAID THE OPPOSITE. Decision 6 of that reading refused
-- derivation because no page said how it derives. Both sentences above were on
-- disk the whole time; I had grepped the mirror and not the courses, which
-- CLAUDE.md rule 3 tells me to do first. 415's own column comment had it right.
--
-- Patched from pg_get_functiondef. Two lines of the head change -- the INSERT
-- column list and the UPDATE SET -- and nothing else in the body moves.

CREATE OR REPLACE FUNCTION public.apply_object_type(p_object_type jsonb, p_properties jsonb, p_datasources jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  t     uuid := nullif(p_object_type->>'id', '')::uuid;
  ont   uuid := nullif(p_object_type->>'ontology_id', '')::uuid;
  keys  text[];
BEGIN
  IF t IS NULL OR NOT EXISTS (SELECT 1 FROM public.object_types WHERE id = t) THEN
    INSERT INTO public.object_types (id, ontology_id, project_id, api_name, label, plural_label, icon, description)
    VALUES (coalesce(t, gen_random_uuid()),
            coalesce(ont, public.default_ontology()),
            nullif(p_object_type->>'project_id','')::uuid,
            p_object_type->>'api_name', p_object_type->>'label',
            coalesce(p_object_type->>'plural_label', ''),
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
       SET label        = coalesce(p_object_type->>'label', label),
           plural_label = coalesce(p_object_type->>'plural_label', plural_label),
           icon         = coalesce(p_object_type->>'icon', icon),
           description = coalesce(p_object_type->>'description', description),
           status = coalesce(p_object_type->>'status', status),
           deprecation_reason = CASE WHEN p_object_type ? 'status'
             THEN nullif(p_object_type->>'deprecation_reason', '') ELSE deprecation_reason END,
           deprecation_deadline = CASE WHEN p_object_type ? 'status'
             THEN nullif(p_object_type->>'deprecation_deadline', '')::date ELSE deprecation_deadline END
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
    shared_property_id, required, visibility, position, is_primary_key, is_title_key,
    derived_aggregation, derived_from_property_id, derived_limit)
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
    coalesce((e->>'is_title_key')::boolean, false),
    nullif(e->>'derived_aggregation', ''),
    nullif(e->>'derived_from_property_id', '')::uuid,
    nullif(e->>'derived_limit', '')::integer
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
    is_title_key       = EXCLUDED.is_title_key,
    derived_aggregation      = EXCLUDED.derived_aggregation,
    derived_from_property_id = EXCLUDED.derived_from_property_id,
    derived_limit            = EXCLUDED.derived_limit;

  -- The chain, replaced whole, the way the datasource block below already
  -- replaces its set: a chain is one value, and half a chain is not a
  -- shorter chain but a different one. A property that stops being derived
  -- loses its hops here rather than keeping a chain nothing reads.
  DELETE FROM public.derived_property_hops h
   USING public.object_type_properties p
   WHERE h.property_id = p.id AND p.object_type_id = t;

  INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
  SELECT p.id, hop.ord::int, hop.val::uuid
    FROM jsonb_array_elements(p_properties) e
    JOIN public.object_type_properties p
      ON p.object_type_id = t AND p.property_id = e->>'property_id'
   CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(e->'hops', '[]'::jsonb))
     WITH ORDINALITY AS hop(val, ord)
   ORDER BY p.id, hop.ord;

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

  
  UPDATE public.object_type_properties p
     SET status               = e->>'status',
         deprecation_reason   = nullif(e->>'deprecation_reason', ''),
         deprecation_deadline = nullif(e->>'deprecation_deadline', '')::date,
         replaced_by          = nullif(e->>'replaced_by', '')
    FROM jsonb_array_elements(coalesce(p_properties, '[]'::jsonb)) e
   WHERE p.object_type_id = t
     AND p.property_id = e->>'property_id'
     AND (e ? 'status');

  RETURN t;

END $function$;


-- The assertion CALLS the function, because one that only inspects the
-- catalogue would pass against a body of RAISE. It works on a SCRATCH type it
-- creates and drops: apply_object_type deletes any property not named in the
-- payload, so exercising it against a real type would round-trip that type's
-- whole property list through a reconstruction, and a migration's assertions
-- COMMIT.
DO $$
DECLARE ot uuid; got text; ont uuid;
BEGIN
  SELECT id INTO ont FROM public.ontologies LIMIT 1;
  IF ont IS NULL THEN RAISE NOTICE 'no ontology to exercise; skipped'; RETURN; END IF;

  ot := public.apply_object_type(
    jsonb_build_object('api_name', 'Probe598', 'label', 'Probe 598',
                       'plural_label', 'Probe 598s', 'ontology_id', ont::text),
    jsonb_build_array(jsonb_build_object(
      'property_id', 'id', 'display_name', 'Id', 'api_name', 'id',
      'base_type', 'string', 'required', true, 'visibility', 'normal',
      'source', 'column', 'backing_column', 'id',
      'is_primary_key', true, 'is_title_key', true)));

  SELECT plural_label INTO got FROM public.object_types WHERE id = ot;
  IF got <> 'Probe 598s' THEN
    RAISE EXCEPTION 'apply_object_type did not carry plural_label on insert (got %)', got;
  END IF;

  -- absent from the payload leaves the stored value alone
  PERFORM public.apply_object_type(
    jsonb_build_object('id', ot::text, 'label', 'Probe 598 renamed'),
    jsonb_build_array(jsonb_build_object(
      'property_id', 'id', 'display_name', 'Id', 'api_name', 'id',
      'base_type', 'string', 'required', true, 'visibility', 'normal',
      'source', 'column', 'backing_column', 'id',
      'is_primary_key', true, 'is_title_key', true)));
  SELECT plural_label INTO got FROM public.object_types WHERE id = ot;
  IF got <> 'Probe 598s' THEN
    RAISE EXCEPTION 'an absent plural_label overwrote the stored one (got %)', got;
  END IF;

  DELETE FROM public.object_types WHERE id = ot;
  IF EXISTS (SELECT 1 FROM public.object_types WHERE id = ot) THEN
    RAISE EXCEPTION 'the scratch type survived cleanup';
  END IF;
END $$;
