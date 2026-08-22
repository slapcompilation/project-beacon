-- `struct` has been one of the twenty-two base types with nothing behind it: a
-- jsonb column taking any shape at all, and no way to say what fields the
-- struct has. Foundry gives it six pages.
--
--   "A **struct** is an Ontology property base type that allows users to create
--   schema-based properties with multiple fields."
--   — object-link-types/structs-overview.md
--
-- ── IT IS NOT A NAMED TYPE, AND THAT IS THE SHAPE QUESTION ──────────────────
-- The obvious build is a `struct_types` table that properties point at. That
-- would be wrong. `create-struct-type` walks the whole flow and never leaves
-- the property: select **Struct** from the Base type dropdown, choose a backing
-- column, then "In the **Struct fields** section, select **Add field**, then
-- **New field**", name it, "map a column from a datasource to the new struct
-- field". The fields belong to the PROPERTY.
--
-- So this is `object_type_properties` : `property_struct_fields`, the same
-- shape as a property's own `backing_column` one level down, and not a registry
-- of reusable named types. The test is whether ours is built the way theirs is,
-- not whether they have one.
--
-- ── THE TWELVE, ENUMERATED ──────────────────────────────────────────────────
--   "Only the following field types are currently supported:"
--   — object-link-types/structs-overview.md
--
-- BOOLEAN, BYTE, DATE, DECIMAL, DOUBLE, FLOAT, GEOPOINT, INTEGER, LONG, SHORT,
-- STRING, TIMESTAMP. Twelve of our twenty-two, lower-cased to the spelling
-- `property_base_types()` already uses for the same concepts — the set is the
-- page's, the casing is ours, and mixing the two is what 599 cost.
--
-- **Nesting is refused by the enumeration rather than by a rule.** "Structs
-- have a depth of one and cannot be nested" — and `struct` is not among the
-- twelve, so a struct field cannot be a struct. One list does both jobs.
--
-- ── THE MUST THAT IS A VIOLATION, NOT A REFUSAL ─────────────────────────────
--   "Structs must have at least 1 field."
--   — object-link-types/structs-overview.md
--
-- A refusal would make the property uncreatable: `create-struct-type` has you
-- pick the base type at step 3 and add the first field at step 5, so the
-- property exists before any field does. This is the media-source argument
-- exactly, and it lands in the same place — `ontology_violations()`, which
-- blocks a SAVE that introduces it rather than the INSERT that starts it.
--
-- ── WHAT IS NOT BUILT ───────────────────────────────────────────────────────
-- * **Struct field RIDs.** `struct-shared-properties` says fields carry them.
--   `object_type_properties` has no `rid` column at all, so giving fields one
--   would put them ahead of their own parent. Recorded, not invented.
-- * **Shared-property inheritance.** "Local struct property types backed by
--   shared property types will inherit shared property type fields" — needs the
--   inheritance to be computed, and shared properties are a phase of their own.
-- * **Main fields**, which the page marks Beta.
-- * **Automapping**, which is a button that fills in mappings a person could
--   type, not a rule.

CREATE OR REPLACE FUNCTION public.struct_field_types()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['boolean', 'byte', 'date', 'decimal', 'double', 'float',
               'geopoint', 'integer', 'long', 'short', 'string', 'timestamp']
$$;

COMMENT ON FUNCTION public.struct_field_types() IS
  'The twelve field types a struct may use (object-link-types/structs-overview). A subset of property_base_types(), and `struct` is deliberately absent: "Structs have a depth of one and cannot be nested".';

CREATE TABLE public.property_struct_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL
    REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  api_name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  field_type text NOT NULL,
  -- "map a column from a datasource to the new struct field" — nullable
  -- because the field is named before it is mapped.
  backing_column text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_struct_fields_type_check
    CHECK (field_type = ANY (public.struct_field_types())),
  CONSTRAINT property_struct_fields_api_name_check
    CHECK (api_name ~ '^[a-z][A-Za-z0-9]*$'),
  CONSTRAINT property_struct_fields_display_name_check
    CHECK (length(btrim(display_name)) > 0),
  UNIQUE (property_id, api_name)
);

COMMENT ON TABLE public.property_struct_fields IS
  'The fields of a struct property. They belong to the property, not to a named struct type: create-struct-type adds them in the Property editor and never leaves it.';

COMMENT ON CONSTRAINT property_struct_fields_type_check ON public.property_struct_fields IS
  'Values from object-link-types/structs-overview, lower-cased to the spelling property_base_types() uses for the same concepts.';

CREATE INDEX property_struct_fields_by_property
  ON public.property_struct_fields (property_id, position);

-- A field belongs to a struct property and to nothing else. A fact needing
-- another table, so it is a trigger rather than a CHECK.
CREATE OR REPLACE FUNCTION public.guard_struct_field()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_base text;
BEGIN
  SELECT base_type INTO v_base FROM public.object_type_properties
   WHERE id = NEW.property_id;
  IF v_base IS DISTINCT FROM 'struct' THEN
    RAISE EXCEPTION 'Ontology:NotAStructProperty — struct fields belong to a struct property, and this one is a %', coalesce(v_base, 'missing property')
      USING HINT = 'Set the property''s base type to struct first.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_struct_field
  BEFORE INSERT OR UPDATE OF property_id ON public.property_struct_fields
  FOR EACH ROW EXECUTE FUNCTION public.guard_struct_field();

-- Whoever may author the property may author its fields. The predicate CONTAINS
-- the read predicate rather than sitting beside it, so write implies read by
-- construction — which is the property 619 had to go back and prove for
-- can_write_dataset.
CREATE OR REPLACE FUNCTION public.can_author_struct_field(p_property uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = p_property
       AND public.auth_in_ontology(t.ontology_id)
       AND public.auth_member_of_ontology(t.ontology_id)
       AND ((SELECT public.auth_role()) = ANY (ARRAY['owner', 'admin'])
            OR public.has_resource_role('object_type', t.id, 'editor')))
$$;

COMMENT ON FUNCTION public.can_author_struct_field(uuid) IS
  'Who may edit a struct property''s fields: the object type''s authors. Contains the read predicate, so a writer can always read what it writes.';

-- 619's lesson applied at birth rather than retrofitted: the write policy is
-- scoped to the writes, so a SELECT never evaluates it, and its predicate
-- CONTAINS the read predicate so write still implies read by construction.
-- `object_type_properties` next door is still FOR ALL; this one starts right.
ALTER TABLE public.property_struct_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read struct fields of visible properties" ON public.property_struct_fields
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = property_struct_fields.property_id
       AND public.auth_in_ontology(t.ontology_id)));

CREATE POLICY "authors insert struct fields" ON public.property_struct_fields
  FOR INSERT WITH CHECK (public.can_author_struct_field(property_id));
CREATE POLICY "authors update struct fields" ON public.property_struct_fields
  FOR UPDATE USING (public.can_author_struct_field(property_id))
          WITH CHECK (public.can_author_struct_field(property_id));
CREATE POLICY "authors delete struct fields" ON public.property_struct_fields
  FOR DELETE USING (public.can_author_struct_field(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_struct_fields TO authenticated;

-- "Structs must have at least 1 field." A named problem function joined into
-- the union, which is the shape media_property_problems() already established —
-- ontology_violations() is a composition, not a body to patch.
CREATE OR REPLACE FUNCTION public.struct_property_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $$
  SELECT t.api_name, 'property', p.property_id,
         'A struct property must have at least one field.'
    FROM public.object_type_properties p
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE p.base_type = 'struct'
     AND NOT EXISTS (SELECT 1 FROM public.property_struct_fields f
                      WHERE f.property_id = p.id)
$$;

COMMENT ON FUNCTION public.struct_property_problems() IS
  '"Structs must have at least 1 field" (object-link-types/structs-overview). A violation rather than a refusal: create-struct-type picks the base type at step 3 and adds the first field at step 5.';

-- Retyped rather than patched, because it is a nine-line composition held
-- verbatim and adding a line to a UNION is not the kind of edit that invents a
-- helper. Every existing arm is unchanged.
CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $function$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
  UNION ALL
  SELECT * FROM public.media_property_problems()
  UNION ALL
  SELECT * FROM public.datasource_mapping_problems()
  UNION ALL
  SELECT * FROM public.struct_property_problems()
$function$;

-- Both directions on every rule, and the violation arm is made to FIRE and then
-- to fall silent — an arm nobody has seen fire is not a guard.
DO $$
DECLARE
  v_ont uuid; v_ot uuid; v_struct uuid; v_plain uuid; v_err text; v_n int;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'no ontology: 633 cannot prove its own rules';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Struct633', 'Struct 633') RETURNING id INTO v_ot;
    -- source='column' with a backing column, which is what create-struct-type
    -- has you pick at step 4 before adding any field.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, position,
       source, backing_column)
    VALUES (v_ot, 'addr', 'Address', 'addr', 'struct', 0, 'column', 'addr')
    RETURNING id INTO v_struct;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, position,
       source, backing_column)
    VALUES (v_ot, 'name', 'Name', 'name', 'string', 1, 'column', 'name')
    RETURNING id INTO v_plain;

    -- (1) the MUST fires while the struct property has no fields
    SELECT count(*) INTO v_n FROM public.struct_property_problems()
     WHERE subject = 'addr';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'a fieldless struct property produced % violation(s), expected 1', v_n;
    END IF;
    -- and it reaches the linter the save path actually reads
    IF NOT EXISTS (SELECT 1 FROM public.ontology_violations() v WHERE v.subject = 'addr') THEN
      RAISE EXCEPTION 'struct_property_problems is not wired into ontology_violations';
    END IF;

    -- (2) a field on a NON-struct property is refused by name
    v_err := NULL;
    BEGIN
      INSERT INTO public.property_struct_fields
        (property_id, api_name, display_name, field_type)
      VALUES (v_plain, 'street', 'Street', 'string');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE 'Ontology:NotAStructProperty%' THEN
      RAISE EXCEPTION 'a string property accepted a struct field (%)', coalesce(v_err, 'no error');
    END IF;

    -- (3) nesting is refused by the enumeration rather than by a rule
    v_err := NULL;
    BEGIN
      INSERT INTO public.property_struct_fields
        (property_id, api_name, display_name, field_type)
      VALUES (v_struct, 'nested', 'Nested', 'struct');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL THEN
      RAISE EXCEPTION 'a struct field of type struct was accepted; depth is one';
    END IF;
    -- a base type that exists but is not among the twelve is refused too
    v_err := NULL;
    BEGIN
      INSERT INTO public.property_struct_fields
        (property_id, api_name, display_name, field_type)
      VALUES (v_struct, 'media', 'Media', 'media_reference');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL THEN
      RAISE EXCEPTION 'media_reference was accepted as a struct field type';
    END IF;

    -- (4) the twelve ARE accepted, so the CHECK is not blanket
    INSERT INTO public.property_struct_fields
      (property_id, api_name, display_name, field_type, position)
    VALUES (v_struct, 'street', 'Street', 'string', 0),
           (v_struct, 'postalCode', 'Postal code', 'string', 1),
           (v_struct, 'located', 'Located', 'geopoint', 2);

    -- (5) and the violation falls silent once a field exists
    SELECT count(*) INTO v_n FROM public.struct_property_problems()
     WHERE subject = 'addr';
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'the struct property still violates after % field(s) were added', 3;
    END IF;

    -- (6) every one of the twelve is a real base type, so the subset is a
    -- subset rather than a second vocabulary
    SELECT count(*) INTO v_n FROM unnest(public.struct_field_types()) f
     WHERE NOT (f = ANY (public.property_base_types()));
    IF v_n <> 0 THEN
      RAISE EXCEPTION '% struct field type(s) are not property base types', v_n;
    END IF;
    IF 'struct' = ANY (public.struct_field_types()) THEN
      RAISE EXCEPTION 'struct is among its own field types; depth is one';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '633 proved: the MUST fires and then falls silent, non-struct and nested fields refused, the twelve accepted, and all twelve are real base types';
  END;
END $$;
