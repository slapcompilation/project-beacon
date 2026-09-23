-- An action parameter's type is a union, and two of its members carry payloads
-- our flat pair cannot hold.
--
-- Shape audit item four. `action_type_parameters` holds ZERO rows, so this is
-- the same free moment `object_sets` had at 843 and will not come again.
--
--   "A union of all the types supported by Ontology Action parameters."
--   — api/ontologies-v2-resources-action-types-get-action-type-by-rid.md
--
-- TWENTY-ONE MEMBERS, counted by parsing the page's indentation rather than by
-- eye: date, interfaceObject, struct, string, double, integer, geoshape, long,
-- objectType, boolean, marking, scenarioReference, attachment, mediaReference,
-- array, objectSet, geohash, vector, decimal, object, timestamp.
--
-- Ours is `data_kind` — five values, of which `base_type` is a catch-all that
-- defers to the `base_type` column — plus `object_type_id` and `interface_id`.
-- For seventeen of the twenty-one that is a faithful two-vocabularies mapping
-- and this migration leaves it exactly as it is. For two of them it is not:
--
--   "- `subType` · union · required" under `array`, described as
--   "A union of all the types supported by Ontology Action parameters."
--   — api/ontologies-v2-resources-action-types-get-action-type-by-rid.md
--
-- so `array` is genuinely RECURSIVE into the whole union, and `struct` carries a
-- `fields` list. `action_type_parameters` has no element-type column and no
-- struct-field child, so an `array` or `struct` parameter is a legal terminal
-- value with nowhere to put its payload — silently underspecified rather than
-- refused. Our own `object_type_properties` does better, with
-- `array_declares_element` and the `property_struct_fields` table.
--
-- THE NESTED FIELD TYPE IS A DIFFERENT UNION, and the audit blurred it:
--
--   "A union of all the primitive types used by Palantir's Ontology-based products."
--   — api/ontologies-v2-resources-action-types-get-action-type-by-rid.md
--
-- That is what a struct FIELD carries, and it is not the parameter union — it
-- holds `cipherText`, which the parameter union does not, and lacks `array`,
-- `objectSet` and `object`, which it does. Two unions, named differently by the
-- page, and conflating them would admit a struct field of a type no struct field
-- may have.
--
-- WHAT THIS DOES NOT DO. It does not touch `data_kind`, `base_type`,
-- `object_type_id` or `interface_id`, and it does not migrate a single row —
-- there are none. The flat columns keep their meaning and every one of the
-- twenty-three consumers keeps working, which is the same shape 843 and 847
-- took: the published union lands beside the existing columns as a nullable
-- document, and NULL means the degenerate case the flat columns already state.
--
-- AND THE DEGENERATE READING IS DELIBERATELY PARTIAL. Our twenty-two base types
-- and the published twenty-one parameter types are not the same set — the
-- parameter union has `geohash` where we have `geopoint`, and carries no
-- `cipher` at all — so the resolver maps only what the two vocabularies share by
-- name and answers NULL otherwise. A NULL there means the type is not derivable
-- from the flat columns and must be stored explicitly, which is a true answer;
-- inventing a
-- correspondence would be the failure CLAUDE.md's *enumeration beats a
-- description* section is about.

-- ── the two unions ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.action_parameter_type_members()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'date', 'interfaceObject', 'struct', 'string', 'double', 'integer',
    'geoshape', 'long', 'objectType', 'boolean', 'marking', 'scenarioReference',
    'attachment', 'mediaReference', 'array', 'objectSet', 'geohash', 'vector',
    'decimal', 'object', 'timestamp']
$$;

COMMENT ON FUNCTION public.action_parameter_type_members() IS
  'The twenty-one members of the Ontology Action parameter type union (api/ontologies-v2-resources-action-types-get-action-type-by-rid). Distinct from the struct-field primitive union below.';

-- "A union of all the primitive types used by Palantir's Ontology-based
-- products" — what a struct FIELD may be. It holds cipherText, which the
-- parameter union does not, and lacks array, objectSet and object, which it has.
CREATE OR REPLACE FUNCTION public.ontology_primitive_type_members()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'date', 'struct', 'set', 'string', 'byte', 'double', 'integer', 'float',
    'any', 'long', 'boolean', 'cipherText', 'marking', 'unsupported',
    'geoshape', 'attachment', 'mediaReference', 'geohash', 'vector', 'decimal',
    'timestamp']
$$;

COMMENT ON FUNCTION public.ontology_primitive_type_members() IS
  'The primitive types a struct field may be (api/ontologies-v2-resources-action-types-get-action-type-by-rid). A DIFFERENT union from the action parameter one: it carries cipherText and set, and has no array, objectSet or object.';

GRANT EXECUTE ON FUNCTION public.action_parameter_type_members() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ontology_primitive_type_members() TO authenticated, service_role;

-- ── the validator ──────────────────────────────────────────────────────────
-- Freely recursive, because `array.subType` is the whole union again — unlike
-- 847's interface implementation, which the page bounds on purpose.
CREATE OR REPLACE FUNCTION public.action_parameter_type_valid(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE k text; body jsonb; f jsonb; ft text;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;          -- the degenerate case
  IF jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p)) <> 1 THEN RETURN false; END IF;
  SELECT key INTO k FROM jsonb_object_keys(p) key LIMIT 1;
  IF NOT (k = ANY (public.action_parameter_type_members())) THEN RETURN false; END IF;
  body := p -> k;
  IF jsonb_typeof(body) <> 'object' THEN RETURN false; END IF;

  IF k = 'array' THEN
    -- "`subType` · union · required"
    RETURN body ? 'subType' AND public.action_parameter_type_valid(body -> 'subType');
  END IF;

  IF k = 'struct' THEN
    IF jsonb_typeof(body -> 'fields') <> 'array' THEN RETURN false; END IF;
    FOR f IN SELECT * FROM jsonb_array_elements(body -> 'fields') LOOP
      IF jsonb_typeof(f) <> 'object' THEN RETURN false; END IF;
      -- "`name` · string · required" and "`fieldType` · union · required"
      IF coalesce(f->>'name', '') = '' OR jsonb_typeof(f -> 'fieldType') <> 'object' THEN
        RETURN false;
      END IF;
      IF (SELECT count(*) FROM jsonb_object_keys(f -> 'fieldType')) <> 1 THEN RETURN false; END IF;
      SELECT key INTO ft FROM jsonb_object_keys(f -> 'fieldType') key LIMIT 1;
      -- The OTHER union. A struct field may not be an array, an object set or
      -- an object, and may be a cipherText, which the parameter union cannot.
      IF NOT (ft = ANY (public.ontology_primitive_type_members())) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  IF k = 'object' THEN
    -- Both marked required on this member, unlike objectSet's.
    RETURN coalesce(body->>'objectApiName', '') <> ''
       AND coalesce(body->>'objectTypeApiName', '') <> '';
  END IF;

  IF k = 'vector' THEN
    RETURN jsonb_typeof(body -> 'dimension') = 'number';
  END IF;

  IF k = 'marking' THEN
    RETURN body -> 'markingType' IS NULL
        OR (body ->> 'markingType') IN ('CBAC', 'MANDATORY');
  END IF;

  -- The rest carry optional fields or none at all.
  RETURN true;
END $fn$;

COMMENT ON FUNCTION public.action_parameter_type_valid(jsonb) IS
  'Whether a document is a well-formed Ontology Action parameter type. Freely recursive through array.subType, and a struct field is checked against the PRIMITIVE union rather than this one.';

GRANT EXECUTE ON FUNCTION public.action_parameter_type_valid(jsonb) TO authenticated, service_role;

ALTER TABLE public.action_type_parameters
  ADD COLUMN parameter_type jsonb,
  ADD CONSTRAINT action_type_parameters_parameter_type_valid
    CHECK (public.action_parameter_type_valid(parameter_type));

COMMENT ON COLUMN public.action_type_parameters.parameter_type IS
  'The parameter''s type as the published union (api/ontologies-v2-resources-action-types-get-action-type-by-rid). NULL is the degenerate case the flat columns already state. Required in practice for `array` and `struct`, which carry payloads data_kind and base_type cannot hold.';

COMMENT ON CONSTRAINT action_type_parameters_parameter_type_valid ON public.action_type_parameters IS
  'Values from api/ontologies-v2-resources-action-types-get-action-type-by-rid. The twenty-one members of the action parameter type union.';

-- ── the degenerate reading, deliberately partial ───────────────────────────
CREATE OR REPLACE FUNCTION public.action_parameter_type(p_parameter uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN pa.parameter_type IS NOT NULL THEN pa.parameter_type
    WHEN pa.data_kind = 'objectType' THEN jsonb_build_object('objectType', '{}'::jsonb)
    WHEN pa.data_kind = 'objectSet' THEN
      jsonb_build_object('objectSet',
        coalesce(jsonb_build_object('objectTypeApiName', ot.api_name), '{}'::jsonb))
    WHEN pa.data_kind = 'object' THEN
      jsonb_build_object('object',
        jsonb_build_object('objectApiName', ot.api_name, 'objectTypeApiName', ot.api_name))
    WHEN pa.data_kind = 'interfaceObject' THEN
      jsonb_build_object('interfaceObject',
        jsonb_build_object('interfaceTypeApiName', i.api_name))
    -- Only the base types whose NAME the two vocabularies share. `array` and
    -- `struct` are deliberately absent: their payload is not in these columns,
    -- so the honest answer is that the union must be stored explicitly.
    WHEN pa.base_type = ANY (ARRAY['string','double','integer','long','boolean',
                                   'date','timestamp','decimal','attachment',
                                   'marking','geoshape','vector'])
      THEN jsonb_build_object(pa.base_type, '{}'::jsonb)
    ELSE NULL
  END
    FROM public.action_type_parameters pa
    LEFT JOIN public.object_types ot ON ot.id = pa.object_type_id
    LEFT JOIN public.ontology_interfaces i ON i.id = pa.interface_id
   WHERE pa.id = p_parameter
$$;

COMMENT ON FUNCTION public.action_parameter_type(uuid) IS
  'The published parameter type: the stored union when there is one, else what the flat columns state. NULL means not derivable — our base types and the published parameter types are not the same set, so a shared name is required rather than a guess.';

GRANT EXECUTE ON FUNCTION public.action_parameter_type(uuid) TO authenticated, service_role;

-- An array or struct parameter with nothing to say about its payload is the
-- defect this migration exists for. A fact needing the row's own columns but
-- advisory rather than blocking, because the parameter is savable today and the
-- page does not refuse it.
CREATE OR REPLACE FUNCTION public.action_parameter_type_problems()
RETURNS TABLE(parameter_id uuid, problem text)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT pa.id,
         format('parameter "%s" is %s but declares no element or field type; the published union carries one',
                pa.api_name, pa.base_type)
    FROM public.action_type_parameters pa
   WHERE pa.data_kind = 'base_type'
     AND pa.base_type IN ('array', 'struct')
     AND pa.parameter_type IS NULL
$$;

COMMENT ON FUNCTION public.action_parameter_type_problems() IS
  'Array or struct action parameters with no stored parameter_type, so their element or field type is unstated. Advisory: the page does not refuse such a parameter, it simply has nowhere to say what it holds.';

GRANT EXECUTE ON FUNCTION public.action_parameter_type_problems() TO authenticated, service_role;

-- PROVED BY DOING.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_space uuid; v_ont uuid; v_type uuid; v_user uuid;
  v_act uuid; v_p uuid; v_n int; v_t jsonb; v_unwound boolean := false;
BEGIN
  -- 1. The two unions are different sets, which is the thing most easily lost.
  IF array_length(public.action_parameter_type_members(), 1) <> 21 THEN
    RAISE EXCEPTION 'PROOF FAILED: the parameter union does not have 21 members';
  END IF;
  IF 'cipherText' = ANY (public.action_parameter_type_members()) THEN
    RAISE EXCEPTION 'PROOF FAILED: cipherText is in the parameter union and should not be';
  END IF;
  IF NOT ('cipherText' = ANY (public.ontology_primitive_type_members())) THEN
    RAISE EXCEPTION 'PROOF FAILED: cipherText is not in the primitive union and should be';
  END IF;
  IF 'array' = ANY (public.ontology_primitive_type_members()) THEN
    RAISE EXCEPTION 'PROOF FAILED: array is in the primitive union and should not be';
  END IF;
  RAISE NOTICE 'PROVED: two unions, and a struct field may not be what a parameter may';

  -- 2. The validator, including the recursion array.subType opens.
  IF NOT public.action_parameter_type_valid('{"string":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a string parameter was rejected';
  END IF;
  IF NOT public.action_parameter_type_valid('{"array":{"subType":{"array":{"subType":{"string":{}}}}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an array of arrays was rejected — subType is the whole union';
  END IF;
  IF public.action_parameter_type_valid('{"array":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an array with no subType was accepted';
  END IF;
  IF NOT public.action_parameter_type_valid(
       '{"struct":{"fields":[{"name":"street","fieldType":{"string":{}}},{"name":"key","fieldType":{"cipherText":{}}}]}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a struct with a cipherText field was rejected';
  END IF;
  -- The other union's bound: a struct field may not be an array.
  IF public.action_parameter_type_valid(
       '{"struct":{"fields":[{"name":"tags","fieldType":{"array":{"subType":{"string":{}}}}}]}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a struct field typed as an array was accepted';
  END IF;
  IF public.action_parameter_type_valid('{"object":{"objectApiName":"Flight"}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an object missing its required objectTypeApiName was accepted';
  END IF;
  IF public.action_parameter_type_valid('{"marking":{"markingType":"NOPE"}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an unpublished marking type was accepted';
  END IF;
  IF public.action_parameter_type_valid('{"nope":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an unpublished member was accepted';
  END IF;
  RAISE NOTICE 'PROVED: the parameter union recurses, and the struct-field union is bounded differently';

  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz848') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz848') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz848', 'zz848') RETURNING id INTO v_proj;
    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz848@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz848@beacon.test', 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz848', 'Zz848', false) RETURNING id INTO v_ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz848Thing', 'Zz848 thing') RETURNING id INTO v_type;
    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (v_ont, 'zz848-act', 'Zz848 act') RETURNING id INTO v_act;

    -- 3. An array parameter can now say what it holds, which it could not.
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, data_kind, position, parameter_type)
    VALUES (v_act, 'tags', 'Tags', 'array', 'base_type', 0,
            '{"array":{"subType":{"string":{}}}}'::jsonb)
    RETURNING id INTO v_p;
    IF public.action_parameter_type(v_p) -> 'array' -> 'subType' IS NULL THEN
      RAISE EXCEPTION 'PROOF FAILED: the stored union did not come back';
    END IF;
    RAISE NOTICE 'PROVED: an array parameter states its element type';

    -- 4. And one that does not is an advisory finding, not a refusal.
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, data_kind, position)
    VALUES (v_act, 'bare', 'Bare', 'array', 'base_type', 1) RETURNING id INTO v_p;
    SELECT count(*) INTO v_n FROM public.action_parameter_type_problems() WHERE parameter_id = v_p;
    IF v_n <> 1 THEN RAISE EXCEPTION 'PROOF FAILED: an unstated array parameter was not reported'; END IF;
    RAISE NOTICE 'PROVED: an array parameter with nothing to say about its payload is reported, not refused';

    -- 5. The degenerate reading, and its honest NULL.
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, data_kind, position)
    VALUES (v_act, 'name', 'Name', 'string', 'base_type', 2) RETURNING id INTO v_p;
    v_t := public.action_parameter_type(v_p);
    IF NOT (v_t ? 'string') THEN
      RAISE EXCEPTION 'PROOF FAILED: a string parameter resolved to %', v_t;
    END IF;
    -- geopoint is ours and geohash is theirs; the resolver does not guess.
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, data_kind, position)
    VALUES (v_act, 'where', 'Where', 'geopoint', 'base_type', 3) RETURNING id INTO v_p;
    IF public.action_parameter_type(v_p) IS NOT NULL THEN
      RAISE EXCEPTION 'PROOF FAILED: geopoint was mapped to a published member it does not share a name with';
    END IF;
    RAISE NOTICE 'PROVED: a shared name resolves and an unshared one answers NULL rather than guessing';

    RAISE EXCEPTION 'ZZ848_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ848_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz848';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
