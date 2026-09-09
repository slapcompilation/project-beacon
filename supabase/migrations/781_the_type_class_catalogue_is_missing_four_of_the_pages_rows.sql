-- The type class catalogue is missing four of the page's rows.
--
-- Found while answering a different question — whether the `timeseries.*` type
-- classes are legacy or the slot-shaped half of Time series formatting. They
-- are neither, and that answer is recorded in readings/time-series.md. On the
-- way to it, the enumerating page was counted properly for the first time.

-- ── the false claim ────────────────────────────────────────────────────────
--
-- `ontology_type_classes_catalogue()`'s COMMENT says it holds what
-- object-link-types/metadata-typeclasses enumerates, "(17 vertex + 13
-- timeseries rows, two deprecated)". The vertex half is right — 17 on the page
-- plus the three link-direction classes graphs-display-options adds, which is
-- the 20 the function carries. The timeseries half is not: the page has
-- SEVENTEEN rows of kind `timeseries`, and the catalogue holds thirteen.
--
-- This is CLAUDE.md rule 7, which forbids claiming coverage that has not been
-- counted, and which names this exact failure twice before. A number in a
-- COMMENT is a falsifiable assertion, and 710's was false when written.

-- ── why it is not cosmetic ─────────────────────────────────────────────────
--
-- `guard_ontology_type_class()` raises `Ontology:UnknownTypeClass` for anything
-- the catalogue does not hold. So the four uncatalogued rows are not merely
-- undocumented here — they are REFUSED BY NAME, and three of them carry a blank
-- Deprecated column, which by the page's own legend is the value meaning
-- current and not even relocated to the Capabilities page.

--   "The **Deprecated** column indicates whether a type class is still supported."
--   — object-link-types/metadata-typeclasses.md

-- The four, with the column each carries:
--
--   timeseries_is_deprecated       Configure in Capabilities page
--   parent            (Relation)   blank
--   timeseries_is_value_inverted   blank
--   timeseries_depth_units         blank

--   "A Boolean property which, when set to `true` for a timeseries, will filter
--    it out of Object Explorer and Object View search results."
--   — object-link-types/metadata-typeclasses.md

--   "Describes the link between the timeseries object and each parent, similar
--    to `hierarchy.parent`."
--   — object-link-types/metadata-typeclasses.md

--   "When set to true, this boolean property will automatically invert the
--    y-axis values of a timeseries in Quiver, such that values ascend going
--    down."
--   — object-link-types/metadata-typeclasses.md

--   "Place on the property containing the depth units of complex series (depth
--    series, well completion series and fiber series)."
--   — object-link-types/metadata-typeclasses.md

-- Two traps in those four, both of which a hand-written list is likely to get
-- wrong and a parser is not:
--
--  1. `timeseries_is_deprecated` is NOT deprecated. Its NAME contains the word
--     and its Deprecated COLUMN says Configure in Capabilities page. 710
--     encodes that column, not the name.
--  2. `parent` is the only Relation in the timeseries family, and it is the
--     only one of the four whose `applies_to` is not 'property'. It is also the
--     only bare name — every sibling is prefixed `timeseries_`.

-- ── and the catalogue stops being hand-written ─────────────────────────────
--
-- Correcting the four would leave the next drift to be found by hand again.
-- CLAUDE.md already records the general form of the fix, from the base types:
-- `vocabulary.test.ts` parses that table instead of restating it, so that
-- particular mistake is refused mechanically. `typeClasses.test.ts` does the
-- same for this page — it reads every `vertex` and `timeseries` row out of the
-- markdown and compares name, target and deprecation against this function, so
-- a row added upstream fails CI rather than being silently refused at runtime.

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied.

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.ontology_type_classes_catalogue() WHERE kind = 'timeseries';
  IF n <> 13 THEN
    RAISE EXCEPTION 'expected the thirteen this corrects, found % — has another migration already touched it?', n;
  END IF;
  FOR n IN SELECT 1 FROM public.ontology_type_classes_catalogue()
            WHERE kind = 'timeseries' AND name IN
              ('timeseries_is_deprecated','parent','timeseries_is_value_inverted','timeseries_depth_units')
  LOOP
    RAISE EXCEPTION 'one of the four is already catalogued; this migration would duplicate it';
  END LOOP;
END $$;

-- ── the four rows, spliced rather than retyped ─────────────────────────────
--
-- The list is thirty-three rows long and every one of them is load-bearing, so
-- the tail is anchored on and extended. Retyping it is how a row disappears.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_type_classes_catalogue()'::regprocedure), chr(13), '');

  a := '    (''timeseries'', ''event_linked_series_id'', ''property'', false, false)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the list to end on event_linked_series_id once, found %', n; END IF;

  EXECUTE replace(src, a, a || ',
    -- the four the count missed. `timeseries_is_deprecated` carries the
    -- Capabilities marker, not the Deprecated token — the column decides, not
    -- the name — and `parent` is the family''s only Relation.
    (''timeseries'', ''timeseries_is_deprecated'',     ''property'', false, false),
    (''timeseries'', ''parent'',                       ''relation'', false, false),
    (''timeseries'', ''timeseries_is_value_inverted'', ''property'', false, false),
    (''timeseries'', ''timeseries_depth_units'',       ''property'', false, false)');
END $mig$;

COMMENT ON FUNCTION public.ontology_type_classes_catalogue() IS
  'The vertex and timeseries type classes object-link-types/metadata-typeclasses enumerates — 17 vertex rows and 17 timeseries rows, three deprecated — plus the three link-direction classes vertex/graphs-display-options defines on link types. 710 said 13 timeseries rows and held 13; the page had 17, so four were refused by name until 781. applies_to is the table''s own Property/Relation column and deprecated is its Deprecated column, which is why timeseries_is_deprecated is not deprecated. parameterised rows take a dot suffix (event_intent.danger). typeClasses.test.ts parses the page and compares, so the next upstream row fails CI rather than this comment going stale again. Kinds the page carries that no application here consumes yet (hubble, schedules, …) refuse until catalogued deliberately.';

-- ── PROVED BY DOING, part two: the four are now assignable ─────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid; ot uuid; ot2 uuid; pk uuid; lk uuid; n int; msg text;
BEGIN
  SELECT count(*) INTO n FROM public.ontology_type_classes_catalogue() WHERE kind = 'timeseries';
  IF n <> 17 THEN RAISE EXCEPTION 'the page has seventeen timeseries rows; the catalogue holds %', n; END IF;

  -- the column decides, not the name
  IF (SELECT deprecated FROM public.ontology_type_classes_catalogue()
       WHERE kind = 'timeseries' AND name = 'timeseries_is_deprecated') THEN
    RAISE EXCEPTION 'timeseries_is_deprecated carries the Capabilities marker, not the Deprecated token';
  END IF;
  IF (SELECT applies_to FROM public.ontology_type_classes_catalogue()
       WHERE kind = 'timeseries' AND name = 'parent') <> 'relation' THEN
    RAISE EXCEPTION 'parent is the timeseries family''s only Relation';
  END IF;

  INSERT INTO public.organizations (name) VALUES ('m781 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm781-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm781-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M781 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm781p', 'm781 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm781_rows', 'Rows') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M781Series', 'Series') RETURNING id INTO ot;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (ot, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (ot, 'sid', 'Sid', 'sid', 'string', 'column', 'sid', true, true, true) RETURNING id INTO pk;

  -- All three blank-column rows are now assignable. Before this migration each
  -- raised Ontology:UnknownTypeClass.
  INSERT INTO public.ontology_type_classes (property_id, kind, name)
  VALUES (pk, 'timeseries', 'timeseries_is_value_inverted'),
         (pk, 'timeseries', 'timeseries_depth_units'),
         (pk, 'timeseries', 'timeseries_is_deprecated');
  SELECT count(*) INTO n FROM public.ontology_type_classes WHERE property_id = pk;
  IF n <> 3 THEN RAISE EXCEPTION 'expected three assignments, got %', n; END IF;

  -- `parent` is a Relation, so a property may not wear it and a link type may.
  BEGIN
    INSERT INTO public.ontology_type_classes (property_id, kind, name)
    VALUES (pk, 'timeseries', 'parent');
    RAISE EXCEPTION 'a Relation type class was accepted on a property';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:TypeClassOnWrongTarget%' THEN RAISE; END IF;
  END;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M781Root', 'Root') RETURNING id INTO ot2;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, ot, ot2, 'm781-parent', 'Parent', 'many_to_one', 'foreign_key', 'sid')
  RETURNING id INTO lk;
  INSERT INTO public.ontology_type_classes (link_type_id, kind, name)
  VALUES (lk, 'timeseries', 'parent');

  -- and a name the page does not carry is still refused
  BEGIN
    INSERT INTO public.ontology_type_classes (property_id, kind, name)
    VALUES (pk, 'timeseries', 'timeseries_invented');
    RAISE EXCEPTION 'an uncatalogued name was accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    IF msg NOT LIKE 'Ontology:UnknownTypeClass%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION USING errcode = 'P0781', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0781' THEN
  NULL;
END $$;
