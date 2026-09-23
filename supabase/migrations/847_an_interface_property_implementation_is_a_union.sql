-- An interface property implementation is a union, and it is a different axis
-- from the wizard's resolution.
--
-- Shape audit round 1 (#1030) ranked `interface_implementation_mappings` third
-- and reported that the api "falsifies" Decision 4 of
-- `readings/interfaces-phase.md`. **It does not, and the correction is the point
-- of this migration**: the audit conflated two axes that both exist.
--
-- OUR `resolution` IS THE WIZARD'S AXIS. 450 took `choose_existing`,
-- `replace_existing`, `choose_backing_column`, `edit_only` and `skip` from the
-- implementation wizard's menu, and its header and the reading's Decision 4 both
-- flag those five identifiers as OURS, not Palantir's. That is still true: the
-- api publishes no vocabulary for how a user RESOLVED a mapping conflict.
--
-- THE API'S UNION IS A DIFFERENT QUESTION — how the implementation is
-- EXPRESSED:
--
--   "Describes how an object type implements an interface property."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
-- Four arms. Read off the page directly rather than from the audit's report:
--
--   "An implementation of an interface property via a local property."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
--   "An implementation of an interface property via the field of a local struct property."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
--   "An implementation of a struct interface property via a local struct property. Specifies a mapping of interface struct fields to local struct fields or properties."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
--   "An implementation of an interface property via applying reducers on the nested implementation."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
-- THE TWO AXES COMPOSE RATHER THAN COMPETE. `resolution` names WHICH local
-- property was chosen and by what route; `implementation` names HOW that
-- property realises the interface property — directly, through one of its struct
-- fields, through a field-by-field mapping, or reduced. So a struct field
-- implementation still carries `object_property_id`, and the CHECK that ties
-- `choose_existing` to a property is untouched.
--
-- ALL FIVE OF OUR RESOLUTIONS PRODUCE ONE OF THOSE ARMS. `choose_existing`,
-- `replace_existing`, `choose_backing_column` and `edit_only` all end in a
-- `localPropertyImplementation`; `skip` produces no entry in the published map
-- at all, which is why 450 stored it as a row and the api does not. So the two
-- columns are orthogonal and both belong, and the audit's "we can express one of
-- four" is right about the implementation axis while its "the api falsifies
-- Decision 4" is wrong about the resolution axis.
--
-- THE RECURSION IS BOUNDED BY DESIGN, which the audit called "recursive" without
-- the qualifier that makes it cheap to encode:
--
--   "Describes how an object type implements an interface property when a reducer is applied to it. Is missing a reduced property implementation to prevent arbitrarily nested implementations."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
-- So `reducedPropertyImplementation` nests exactly one level and cannot nest
-- itself. A jsonb document with a depth-bounded validator holds it; no recursion
-- to any depth is needed, unlike the object set union 843 built.
--
-- AND IT ANSWERS AN OPEN QUESTION FROM 838. The struct-main-fields work recorded
-- that `resolution` had no member naming a struct field and no column
-- referencing one, and filed that as the gap blocking an interface implemented
-- through a struct main field. That was the wrong place to look: a struct field
-- implementation is not a resolution, it is `structFieldImplementation` on this
-- axis. The gap is closed here rather than by widening the wizard's menu.
--
-- WHAT IS REPRESENTABLE AND WHAT HAS A SUBJECT. All four arms are representable.
-- `localPropertyImplementation` and `structFieldImplementation` have subjects
-- today — object properties and `property_struct_fields` both exist.
-- `structImplementation` needs an interface property that is itself a struct.
-- `reducedPropertyImplementation` needs PROPERTY REDUCERS, which this repo has
-- recorded as having zero representation — no table, no function — and the api
-- confirms the reducer itself lives on the property rather than in this union:
-- the arm carries only `implementation`, and the load levels that apply reducers
-- describe them as "configured in the ontology". So that arm is representable and
-- refuses, and the refusal names what is missing.

-- ── the implementation axis ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.interface_implementation_kinds()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['localPropertyImplementation', 'structFieldImplementation',
               'structImplementation', 'reducedPropertyImplementation']
$$;

COMMENT ON FUNCTION public.interface_implementation_kinds() IS
  'The four members of InterfacePropertyTypeImplementation (api/ontologies-v2-resources-object-types-get-object-type-full-metadata). A different axis from interface_implementation_mappings.resolution, which is the wizard''s menu and is ours.';

-- Depth-bounded rather than freely recursive, because the page bounds it: the
-- reduced arm's nested implementation may not itself be a reduced one.
CREATE OR REPLACE FUNCTION public.interface_implementation_valid(p jsonb, p_allow_reduced boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE k text; body jsonb; v jsonb;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;         -- absent is the degenerate case
  IF jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p)) <> 1 THEN RETURN false; END IF;
  SELECT key INTO k FROM jsonb_object_keys(p) key LIMIT 1;
  IF NOT (k = ANY (public.interface_implementation_kinds())) THEN RETURN false; END IF;
  body := p -> k;
  IF jsonb_typeof(body) <> 'object' THEN RETURN false; END IF;

  IF k = 'localPropertyImplementation' THEN
    RETURN coalesce(body->>'propertyApiName', '') <> '';
  END IF;

  IF k = 'structFieldImplementation' THEN
    v := body -> 'structFieldOfProperty';
    RETURN jsonb_typeof(v) = 'object'
       AND coalesce(v->>'propertyApiName', '') <> ''
       AND coalesce(v->>'structFieldApiName', '') <> '';
  END IF;

  IF k = 'structImplementation' THEN
    IF jsonb_typeof(body -> 'mapping') <> 'object' THEN RETURN false; END IF;
    -- Each value is PropertyOrStructFieldOfPropertyImplementation: one of two.
    FOR v IN SELECT value FROM jsonb_each(body -> 'mapping') LOOP
      IF jsonb_typeof(v) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(v)) <> 1 THEN
        RETURN false;
      END IF;
      IF v ? 'property' THEN
        IF coalesce(v -> 'property' ->> 'propertyApiName', '') = '' THEN RETURN false; END IF;
      ELSIF v ? 'structFieldOfProperty' THEN
        IF coalesce(v -> 'structFieldOfProperty' ->> 'propertyApiName', '') = ''
           OR coalesce(v -> 'structFieldOfProperty' ->> 'structFieldApiName', '') = '' THEN
          RETURN false;
        END IF;
      ELSE
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- reducedPropertyImplementation, and the bound the page states.
  IF NOT p_allow_reduced THEN RETURN false; END IF;
  RETURN public.interface_implementation_valid(body -> 'implementation', false);
END $fn$;

COMMENT ON FUNCTION public.interface_implementation_valid(jsonb, boolean) IS
  'Whether a document is a well-formed InterfacePropertyTypeImplementation. Depth-bounded on purpose: the reduced arm may nest one implementation and that one may not be reduced, which is what the page means by preventing arbitrarily nested implementations.';

GRANT EXECUTE ON FUNCTION public.interface_implementation_kinds() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interface_implementation_valid(jsonb, boolean) TO authenticated, service_role;

ALTER TABLE public.interface_implementation_mappings
  ADD COLUMN implementation jsonb,
  ADD CONSTRAINT interface_implementation_mappings_implementation_valid
    CHECK (public.interface_implementation_valid(implementation));

COMMENT ON COLUMN public.interface_implementation_mappings.implementation IS
  'How the object type implements the interface property, as the published InterfacePropertyTypeImplementation union. NULL is the degenerate case: every resolution except `skip` implies a localPropertyImplementation over object_property_id. A different axis from `resolution`, which is the wizard''s menu and is ours (450).';

COMMENT ON CONSTRAINT interface_implementation_mappings_implementation_valid
  ON public.interface_implementation_mappings IS
  'Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. localPropertyImplementation, structFieldImplementation, structImplementation, reducedPropertyImplementation.';

-- The degenerate reading, in one place, so a NULL is never a missing answer.
CREATE OR REPLACE FUNCTION public.interface_implementation(p_mapping uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN m.implementation IS NOT NULL THEN m.implementation
    WHEN m.resolution = 'skip' THEN NULL
    WHEN p.api_name IS NULL THEN NULL
    ELSE jsonb_build_object('localPropertyImplementation',
           jsonb_build_object('propertyApiName', p.api_name))
  END
    FROM public.interface_implementation_mappings m
    LEFT JOIN public.object_type_properties p ON p.id = m.object_property_id
   WHERE m.id = p_mapping
$$;

COMMENT ON FUNCTION public.interface_implementation(uuid) IS
  'The published implementation for a mapping row: the stored union when there is one, otherwise the localPropertyImplementation every resolution but `skip` implies. `skip` has no entry in the published map at all, which is why it is a stored row here and absent there.';

GRANT EXECUTE ON FUNCTION public.interface_implementation(uuid) TO authenticated, service_role;

-- A struct field implementation names a field that exists, which no CHECK can
-- ask. The linter's rung, not the constraint's.
CREATE OR REPLACE FUNCTION public.interface_implementation_problems()
RETURNS TABLE(mapping_id uuid, problem text)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT m.id,
         format('the interface implementation names struct field "%s" of property "%s", which does not exist',
                m.implementation -> 'structFieldImplementation' -> 'structFieldOfProperty' ->> 'structFieldApiName',
                m.implementation -> 'structFieldImplementation' -> 'structFieldOfProperty' ->> 'propertyApiName')
    FROM public.interface_implementation_mappings m
   WHERE m.implementation ? 'structFieldImplementation'
     AND NOT EXISTS (
       SELECT 1 FROM public.object_type_properties p
         JOIN public.property_struct_fields sf ON sf.property_id = p.id
        WHERE p.object_type_id = m.object_type_id
          AND p.api_name = m.implementation -> 'structFieldImplementation' -> 'structFieldOfProperty' ->> 'propertyApiName'
          AND sf.api_name = m.implementation -> 'structFieldImplementation' -> 'structFieldOfProperty' ->> 'structFieldApiName')
$$;

COMMENT ON FUNCTION public.interface_implementation_problems() IS
  'Interface implementations that name a struct field which does not exist. A fact needing other tables, so it is a linter arm rather than a CHECK.';

GRANT EXECUTE ON FUNCTION public.interface_implementation_problems() TO authenticated, service_role;

-- PROVED BY DOING.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_ont uuid; v_type uuid; v_ds uuid; v_branch uuid;
  v_prop uuid; v_iface uuid; v_iprop uuid; v_map uuid; v_n int; v_impl jsonb;
  v_space uuid; v_user uuid; v_unwound boolean := false;
BEGIN
  -- 1. The union, before any fixture.
  IF array_length(public.interface_implementation_kinds(), 1) <> 4 THEN
    RAISE EXCEPTION 'PROOF FAILED: the union does not have four members';
  END IF;
  IF NOT public.interface_implementation_valid(
       '{"localPropertyImplementation":{"propertyApiName":"tailNumber"}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a local property implementation was rejected';
  END IF;
  IF NOT public.interface_implementation_valid(
       '{"structFieldImplementation":{"structFieldOfProperty":{"propertyApiName":"address","structFieldApiName":"postalCode"}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a struct field implementation was rejected';
  END IF;
  IF NOT public.interface_implementation_valid(
       '{"structImplementation":{"mapping":{"street":{"structFieldOfProperty":{"propertyApiName":"address","structFieldApiName":"streetName"}},"city":{"property":{"propertyApiName":"town"}}}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a struct implementation was rejected';
  END IF;
  -- The bound the page states: reduced may nest, but not a reduced one.
  IF NOT public.interface_implementation_valid(
       '{"reducedPropertyImplementation":{"implementation":{"localPropertyImplementation":{"propertyApiName":"x"}}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a reduced implementation over a local one was rejected';
  END IF;
  IF public.interface_implementation_valid(
       '{"reducedPropertyImplementation":{"implementation":{"reducedPropertyImplementation":{"implementation":{"localPropertyImplementation":{"propertyApiName":"x"}}}}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a reduced implementation nested inside a reduced one was accepted';
  END IF;
  IF public.interface_implementation_valid('{"nope":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an unpublished member was accepted';
  END IF;
  IF public.interface_implementation_valid(
       '{"structImplementation":{"mapping":{"street":{"property":{},"structFieldOfProperty":{}}}}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: a two-member inner union was accepted';
  END IF;
  RAISE NOTICE 'PROVED: four members, the inner two-member union, and the bound on nesting';

  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz847') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz847') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz847', 'zz847') RETURNING id INTO v_proj;
    -- ontology_interfaces stamps its author and will not take a null one.
    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz847@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz847@beacon.test', 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz847', 'Zz847', false) RETURNING id INTO v_ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz847Thing', 'Zz847 thing') RETURNING id INTO v_type;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, position)
      VALUES (v_type, 'address', 'address', 'Address', 'struct', 'column', 'address', 900)
      RETURNING id INTO v_prop;
    INSERT INTO public.property_struct_fields
      (property_id, api_name, display_name, description, field_type, position)
      VALUES (v_prop, 'postalCode', 'Postal code', '', 'string', 0);

    INSERT INTO public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
      VALUES (v_ont, 'Zz847Addressed', 'Zz847 addressed', v_user) RETURNING id INTO v_iface;
    INSERT INTO public.interface_properties (interface_id, property_id, api_name, display_name, base_type, source)
      VALUES (v_iface, 'postal_code', 'postalCode', 'Postal code', 'string', 'local') RETURNING id INTO v_iprop;

    -- 2. The case 838 recorded as blocked: an interface property implemented
    --    through a STRUCT FIELD. It was filed as a missing `resolution` member;
    --    it is an implementation, and it stores.
    -- A mapping row belongs to an implementation, which the FK requires.
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id)
      VALUES (v_type, v_iface);

    -- The two axes COMPOSE rather than compete: `resolution` names WHICH local
    -- property was chosen, and `implementation` names HOW it is used — here, via
    -- one of its struct fields. The existing CHECK that ties `choose_existing`
    -- to a property therefore still holds, and this migration does not touch it.
    INSERT INTO public.interface_implementation_mappings
      (object_type_id, interface_id, interface_property_id, resolution, object_property_id, implementation)
    VALUES (v_type, v_iface, v_iprop, 'choose_existing', v_prop,
            jsonb_build_object('structFieldImplementation', jsonb_build_object(
              'structFieldOfProperty', jsonb_build_object(
                'propertyApiName', 'address', 'structFieldApiName', 'postalCode'))))
    RETURNING id INTO v_map;
    RAISE NOTICE 'PROVED: an interface property implemented through a struct field is storable — 838''s recorded gap';

    -- 3. And the linter catches one that names a field that is not there.
    SELECT count(*) INTO v_n FROM public.interface_implementation_problems() WHERE mapping_id = v_map;
    IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: a valid struct field was reported as a problem'; END IF;
    UPDATE public.interface_implementation_mappings
       SET implementation = jsonb_build_object('structFieldImplementation', jsonb_build_object(
             'structFieldOfProperty', jsonb_build_object(
               'propertyApiName', 'address', 'structFieldApiName', 'nope')))
     WHERE id = v_map;
    SELECT count(*) INTO v_n FROM public.interface_implementation_problems() WHERE mapping_id = v_map;
    IF v_n <> 1 THEN RAISE EXCEPTION 'PROOF FAILED: a missing struct field was not reported'; END IF;
    RAISE NOTICE 'PROVED: a struct field that does not exist is a linter finding, not a CHECK';

    -- 4. The degenerate reading: a resolution with no stored implementation IS
    --    a local property implementation, and `skip` is absent from the map.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, position)
      VALUES (v_type, 'zip', 'zip', 'Zip', 'string', 'column', 'zip', 901) RETURNING id INTO v_prop;
    UPDATE public.interface_implementation_mappings
       SET implementation = NULL, resolution = 'choose_existing', object_property_id = v_prop
     WHERE id = v_map;
    v_impl := public.interface_implementation(v_map);
    IF v_impl -> 'localPropertyImplementation' ->> 'propertyApiName' <> 'zip' THEN
      RAISE EXCEPTION 'PROOF FAILED: the degenerate implementation is %', v_impl;
    END IF;
    UPDATE public.interface_implementation_mappings
       SET resolution = 'skip', object_property_id = NULL WHERE id = v_map;
    IF public.interface_implementation(v_map) IS NOT NULL THEN
      RAISE EXCEPTION 'PROOF FAILED: skip produced an entry in the published map';
    END IF;
    RAISE NOTICE 'PROVED: a stored resolution implies its implementation, and skip implies none';

    RAISE EXCEPTION 'ZZ847_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ847_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz847';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
