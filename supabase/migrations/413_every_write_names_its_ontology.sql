-- 413 — every write names its ontology
--
-- 412 gave the four resource tables a NOT NULL `ontology_id`, which breaks every
-- path that creates one. Verified rather than assumed:
--
--   save_object_type FAILS: null value in column "ontology_id" of relation
--   "object_types" violates not-null constraint
--
-- Foundry never has this problem because the Ontology Manager always has one
-- selected — "a drop-down to select between different Ontologies" — and every
-- create happens inside it. So the question is only how the selection reaches
-- the database.
--
-- IT IS A PARAMETER, NOT A SESSION VARIABLE. A resolver like `auth_org_id()`
-- would have been symmetrical and wrong: the organization comes from the JWT
-- because it is who you ARE, and the ontology comes from the UI because it is
-- what you are LOOKING AT. Putting it in the session would make a write depend
-- on state nobody sends, and the failure mode is writing to the wrong ontology
-- silently.
--
-- `default_ontology()` exists only as a convenience for the single-ontology
-- case, and it REFUSES to guess when there is more than one.

BEGIN;

-- ── the unambiguous case, and only that case ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.default_ontology()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE n int; result uuid;
BEGIN
  SELECT count(*), (array_agg(id))[1] INTO n, result
    FROM public.ontologies
   WHERE organization_id IS NOT DISTINCT FROM public.auth_org_id();

  IF n = 0 THEN
    RAISE EXCEPTION 'Ontology:NoOntology — this organization has no ontology yet'
      USING HINT = 'A space holds one ontology. Create a space, then an ontology in it.';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'Ontology:AmbiguousOntology — this organization has % ontologies; name the one you mean', n
      USING HINT = 'Pass the ontology explicitly. Which one you are editing is a choice, not a default.';
  END IF;
  RETURN result;
END $$;

COMMENT ON FUNCTION public.default_ontology() IS
  'The caller organization''s ontology when it has exactly one. Raises rather than guessing when there are none or several — the Ontology Manager picker is a choice, and a silent wrong guess writes to the wrong ontology.';

REVOKE ALL ON FUNCTION public.default_ontology() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_ontology() TO authenticated;

-- ── the save takes one ───────────────────────────────────────────────────────
-- Same shape as 409 otherwise: one call for the type and its properties, because
-- "To save a new object type, these object type fields must not be empty… And
-- these property fields must not be empty…" is one list over both.

CREATE OR REPLACE FUNCTION public.save_object_type(
  p_object_type jsonb,
  p_properties  jsonb
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  t     uuid := nullif(p_object_type->>'id', '')::uuid;
  ont   uuid := nullif(p_object_type->>'ontology_id', '')::uuid;
  keys  text[];
BEGIN
  IF t IS NULL THEN
    -- Only on create. An object type never moves between ontologies: its API
    -- name is unique per ontology, so moving it could collide, and its RID —
    -- which other systems hold — would be resolving inside a different one.
    INSERT INTO public.object_types (ontology_id, api_name, label, icon, description)
    VALUES (coalesce(ont, public.default_ontology()),
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
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ontology:ObjectTypeNotFound %', t USING ERRCODE = 'no_data_found';
    END IF;
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

  RETURN t;
END $$;

COMMENT ON FUNCTION public.save_object_type(jsonb, jsonb) IS
  'One save for an object type and its properties, into a named ontology. Invoker rights: the RLS policies decide.';

REVOKE ALL ON FUNCTION public.save_object_type(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_object_type(jsonb, jsonb) TO authenticated;

-- ── the three tables written directly ────────────────────────────────────────
-- Link types, shared properties and interfaces are inserted straight from the
-- client. A column default keeps those call sites working in the single-ontology
-- case and RAISES in the ambiguous one, which is the whole point of the resolver.

ALTER TABLE public.link_types          ALTER COLUMN ontology_id SET DEFAULT public.default_ontology();
ALTER TABLE public.shared_properties   ALTER COLUMN ontology_id SET DEFAULT public.default_ontology();
ALTER TABLE public.ontology_interfaces ALTER COLUMN ontology_id SET DEFAULT public.default_ontology();

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp1 uuid; sp2 uuid; ont1 uuid; ont2 uuid; t uuid;
  usr uuid := gen_random_uuid(); claims text; before text; got uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '413@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m413') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m413 prod') RETURNING id INTO sp1;
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp1, org, 'prod', 'Production') RETURNING id INTO ont1;

  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);

  -- One ontology: the default resolves, and the save that failed before works.
  IF public.default_ontology() <> ont1 THEN
    RAISE EXCEPTION 'Migration 413: default_ontology did not find the only one';
  END IF;

  t := public.save_object_type(jsonb_build_object('api_name','Flight','label','Flight'), '[]'::jsonb);
  IF (SELECT ontology_id FROM public.object_types WHERE id = t) <> ont1 THEN
    RAISE EXCEPTION 'Migration 413: the saved object type landed in the wrong ontology';
  END IF;

  -- A default also reaches the tables written directly.
  INSERT INTO public.shared_properties (organization_id, api_name, label, base_type)
       VALUES (org, 'cost', 'Cost', 'decimal');
  IF (SELECT ontology_id FROM public.shared_properties WHERE api_name = 'cost') <> ont1 THEN
    RAISE EXCEPTION 'Migration 413: the shared property did not default into the ontology';
  END IF;

  PERFORM set_config('role', 'none', true);
  INSERT INTO public.spaces (name) VALUES ('m413 dev') RETURNING id INTO sp2;
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp2, org, 'dev', 'Development') RETURNING id INTO ont2;
  PERFORM set_config('role', 'authenticated', true);

  -- Two ontologies: it refuses rather than picking. This is the assertion that
  -- matters — a silent guess here writes to the wrong ontology.
  BEGIN
    PERFORM public.default_ontology();
    RAISE EXCEPTION 'Migration 413: default_ontology guessed between two ontologies';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:AmbiguousOntology%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.save_object_type(jsonb_build_object('api_name','Guess','label','Guess'), '[]'::jsonb);
    RAISE EXCEPTION 'Migration 413: a save with no ontology guessed one';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:AmbiguousOntology%' THEN RAISE; END IF;
  END;

  -- Named explicitly, it lands where it was told.
  got := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont2::text), '[]'::jsonb);
  IF (SELECT ontology_id FROM public.object_types WHERE id = got) <> ont2 THEN
    RAISE EXCEPTION 'Migration 413: an explicitly named ontology was not honoured';
  END IF;

  -- And an object type does not move.
  BEGIN
    PERFORM public.save_object_type(
      jsonb_build_object('id', t::text, 'ontology_id', ont2::text), '[]'::jsonb);
    RAISE EXCEPTION 'Migration 413: an object type was moved between ontologies';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:CannotMoveObjectType%' THEN RAISE; END IF;
  END;

  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.object_type_properties
   WHERE object_type_id IN (SELECT id FROM public.object_types WHERE ontology_id IN (ont1, ont2));
  DELETE FROM public.shared_properties WHERE ontology_id IN (ont1, ont2);
  DELETE FROM public.object_types WHERE ontology_id IN (ont1, ont2);
  DELETE FROM public.ontologies WHERE id IN (ont1, ont2);
  DELETE FROM public.spaces WHERE id IN (sp1, sp2);
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
