-- A struct field can be a main field.
--
-- Item 19 of the parity queue. `property_struct_fields` already carries the
-- fields and their order; what it has no way to say is which of them are the
-- struct's core value and which are metadata about how that value was obtained.
--
--   "For example, an `Address` struct may contain fields capturing `streetName` and `postalCode` as its main values, while other fields like `collectionDate` and `collectorName` represent metadata that describe how the `Address` was obtained."
--   — object-link-types/struct-main-fields.md
--
-- BETA, AND SAID SO BY ITS OWN PAGE. The heading is `Struct main fields [Beta]`
-- and the callout reads "Functionality may change during active development".
-- That is not a reason to skip it — beta is the newest generation, not an
-- obsolete one, and CLAUDE.md's rule is to build the latest — but it IS a reason
-- for the next reader to know the shape may move under them.
--
-- IT IS A SET WITH AN ORDER, NOT A DESIGNATION:
--
--   "You can designate multiple main fields and reorder them for clarity by clicking and dragging a field's panel."
--   — object-link-types/struct-main-fields.md
--
-- So a boolean per field, not a `main_field_id` on the property. The ordering is
-- already here: `position` orders the fields, and the page reorders main fields
-- within that same list rather than keeping a second order beside it.
--
-- WHAT THE PAGE GOES OUT OF ITS WAY TO SAY IS UNCHANGED, which is what keeps
-- this migration small:
--
--   "No, main fields only affect how Foundry displays data and implements interfaces. The underlying struct contains all fields with full fidelity, so all fields remain queryable and accessible."
--   — object-link-types/struct-main-fields.md
--
--   "**Query behavior:** Queries operate on all struct fields, not just main fields. You can search and filter based on any field in the struct."
--   — object-link-types/struct-main-fields.md
--
-- So nothing in the index, the readers, the filter grammar or the projection
-- moves. A migration that touched any of those would be building something the
-- page denies. This adds one column and one guard, and that is the whole feature
-- on the storage side.
--
-- AND IT DOES NOT GATE INTERFACE MAPPING, which is the trap sitting next to it:
--
--   "No. You can map any struct field to an interface property regardless of whether it is designated as a main field. Main fields simply provide a visual indicator in the interface picker and affect how applications display the struct in compact views."
--   — object-link-types/struct-main-fields.md
--
-- Mapping a struct FIELD to an interface property is a separate unbuilt item and
-- stays that way. Nothing here may be read as a prerequisite for it.
--
-- STILL OPEN, and recorded rather than quietly assumed: whether
-- `property_struct_fields.backing_column` — one column per field — encodes the
-- api's `PropertyTypeMappingInfo.struct`, which is ONE struct column plus a map
-- from backing field name to ontology apiName. 836's reconciliation raised it and
-- this migration does not settle it, because main fields are explicitly not a
-- storage concern.

alter table public.property_struct_fields
  add column is_main_field boolean not null default false;

comment on column public.property_struct_fields.is_main_field is
  'Whether this field is one of the struct''s core values rather than supplementary metadata (object-link-types/struct-main-fields, Beta). Display and interface-picker only: all fields remain stored, queryable and mappable.';

-- A struct that designates nothing is the ordinary case and stays legal — the
-- page's own example has a struct with main fields and one without. What is not
-- legal is a designation that names a field of a property that is not a struct,
-- which the table already prevents by construction, so the only guard worth
-- having is the one the page implies by reordering WITHIN the field list: a
-- main field is ordered by `position` like any other, so there is no second
-- ordering to keep consistent.
--
-- PROVED BY DOING. property_struct_fields holds zero rows, so the proof builds
-- its own struct property and unwinds it.
DO $$
DECLARE
  v_ot uuid; v_prop uuid; v_n int; v_mains text; v_unwound boolean := false;
BEGIN
  SELECT id INTO v_ot FROM public.object_types ORDER BY created_at LIMIT 1;
  IF v_ot IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no object type'; END IF;

  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, backing_column, position)
      VALUES (v_ot, 'zz838_address', 'zz838Address', 'Zz838 Address', 'struct', 'column', 'address', 999)
      RETURNING id INTO v_prop;

    -- The page's own example: streetName and postalCode are the main values,
    -- collectionDate and collectorName describe how the value was obtained.
    INSERT INTO public.property_struct_fields
      (property_id, api_name, display_name, description, field_type, position, is_main_field)
    VALUES
      (v_prop, 'streetName',     'Street name',     '', 'string', 0, true),
      (v_prop, 'postalCode',     'Postal code',     '', 'string', 1, true),
      (v_prop, 'collectionDate', 'Collection date', '', 'date',   2, false),
      (v_prop, 'collectorName',  'Collector name',  '', 'string', 3, false);

    -- 1. Multiple main fields, which is what makes this a set and not a pointer.
    SELECT count(*) INTO v_n FROM public.property_struct_fields
     WHERE property_id = v_prop AND is_main_field;
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: % main field(s), expected 2', v_n; END IF;

    -- 2. And they come back in the field list's own order, because the page
    --    reorders them within that list rather than beside it.
    SELECT string_agg(api_name, ',' ORDER BY position) INTO v_mains
      FROM public.property_struct_fields WHERE property_id = v_prop AND is_main_field;
    IF v_mains <> 'streetName,postalCode' THEN
      RAISE EXCEPTION 'PROOF FAILED: main fields ordered as %', v_mains;
    END IF;
    RAISE NOTICE 'PROVED: a struct designates multiple main fields, ordered by the field list — %', v_mains;

    -- 3. Designating nothing stays legal: the default is false and a struct with
    --    no main field is the ordinary case, not an invalid one.
    UPDATE public.property_struct_fields SET is_main_field = false WHERE property_id = v_prop;
    SELECT count(*) INTO v_n FROM public.property_struct_fields
     WHERE property_id = v_prop AND is_main_field;
    IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: main fields survived being cleared'; END IF;
    RAISE NOTICE 'PROVED: a struct with no main field is legal';

    -- 4. Every field is still there. "The underlying struct contains all fields
    --    with full fidelity" — the claim this migration must not break.
    SELECT count(*) INTO v_n FROM public.property_struct_fields WHERE property_id = v_prop;
    IF v_n <> 4 THEN RAISE EXCEPTION 'PROOF FAILED: % fields survive, expected 4', v_n; END IF;
    RAISE NOTICE 'PROVED: all four fields remain, main or not';

    RAISE EXCEPTION 'ZZ838_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ838_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  SELECT count(*) INTO v_n FROM public.object_type_properties WHERE property_id = 'zz838_address';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture property survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $$;
