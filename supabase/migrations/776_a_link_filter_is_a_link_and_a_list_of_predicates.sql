-- A link filter is a link and a list of predicates.
--
-- Object Explorer's link filter has been presence only. Its own feature page
-- gives three kinds under one selected link:

--   "To search for objects that have a particular link, select the \"Has Link\"
--    option"
--   — object-explorer/filter-results.md

--   "To search for objects whose linked objects have a specific property,
--    select the relation in the left side of the search menu panel. From there,
--    choose a property type to filter."
--   — object-explorer/filter-results.md

-- This builds the second. The third — "Filter by <X>?", which opens a listogram
-- of specific far objects by title — is NOT built: the images put it above the
-- PROPERTIES header as a sibling of Has Link, and its listogram carries a
-- Keep/Exclude that `valuesFilter` has no token for. Folding it into a property
-- predicate on the primary key would model it as the thing the UI puts it
-- beside, so it waits for its own reading.
--
-- ── the shape is NESTED, and one page prints it ────────────────────────────

--   "To filter on linked object properties, select a link within the **Filter
--    on a link** section of the **Add filter...** dropdown."
--   — workshop/widgets-filter-list.md

--   "Once selected, click into the link config to add filter sections."
--   — workshop/widgets-filter-list.md

--   "The **Has Link** filter is unique to linked object filters and filters on
--    the presence of a link."
--   — workshop/widgets-filter-list.md

-- So a link holds MANY filter sections and presence is one MEMBER of that list,
-- not the element's single value. Workshop is a different product and settles
-- nothing about the Explorer's wire format on its own; it is the only page in
-- the corpus that prints the configuration shape, and the Explorer's own menu
-- agrees with it — under one selected link, a `Has X?` row, a `Filter by X?`
-- row, then a PROPERTIES header and the far type's properties.
--
-- The nesting earns its place twice over. `matchType` is a field of the
-- presenceFilter VALUE, so a flat element whose value is a numberRangeFilter
-- has nowhere to put it; nested, presence keeps its own member and its own
-- matchType. And several predicates can share one link, which `pivot_flights.png`
-- shows directly: two pills, both reading `Origin Airport > ...`.
--
-- ── the cap, and why it moves ──────────────────────────────────────────────

--   "You can have many *PROPERTY* filters, but only 1 *LINK* filter."
--   — object-explorer/generate-urls.md

-- That is the only sentence in the mirror that quantifies the filter list, and
-- `object_set_filters_valid` has enforced it literally. It cannot stay literal:
-- `charts_linked_property_charts.png` shows one exploration carrying
-- far-property filters over TWO DIFFERENT links (`Aircraft > Acquisition Date`
-- and `Airline > Total Miles`), and CLAUDE.md forbids being stricter than
-- Foundry. The sentence also sits on a URL-encoding page that disclaims itself:
-- "This example may be out of date". So the cap becomes what it can still mean
-- under the nested shape — **one link filter per link** — which refuses two
-- competing configs for the same relation and admits every state the
-- documentation depicts. Recorded as OUR reading of a sentence we could not
-- take literally, not as something a page says.
--
-- ── the predicate builder, lifted rather than copied ───────────────────────
--
-- A far predicate is the same predicate, bound to the far index. The twelve
-- emits in `object_set_where`'s value CASE all had the shape
-- `format('... o.%I ...', prop.property_id, ...)`, so the alias threads through
-- mechanically: `object_set_property_predicate(object_type, filter, alias)` is
-- that CASE with `o.%I` become `%s.%I` and `p_alias` inserted ahead of the
-- property, extracted from the live definition rather than retyped, and
-- `object_set_where` now calls it with 'o'. `derived_property_select` already
-- took an alias for the same reason.
--
-- The far predicate lands INSIDE the arm's EXISTS, beside 771's policy gate and
-- before the negation, so MUST_NOT_HAVE means *has no link to a far object
-- matching this* — and a far object the caller may not read still cannot be
-- inferred from either polarity.


-- The seven value kinds, factored out so the nested members are checked by the
-- same rule as the top-level ones rather than by a second copy of it.
CREATE OR REPLACE FUNCTION public.object_set_value_filter_valid(v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT v IS NOT NULL AND CASE v->>'type'
    WHEN 'textFilter'              THEN v->>'text' IS NOT NULL
    WHEN 'valuesFilter'            THEN jsonb_typeof(v->'values') = 'array'
    WHEN 'dateRangeFilter'         THEN jsonb_typeof(v->'dateRangeFilter') = 'object'
    WHEN 'numberRangeFilter'       THEN v->'min' IS NOT NULL OR v->'max' IS NOT NULL
    WHEN 'relativeDateFilter'      THEN v->'sinceDaysAgo' IS NOT NULL OR v->'untilDaysAgo' IS NOT NULL
    WHEN 'timestampRangeFilter'    THEN v->'startMillis' IS NOT NULL OR v->'endMillis' IS NOT NULL
    WHEN 'relativeTimestampFilter' THEN v->'sinceMillisAgo' IS NOT NULL OR v->'untilMillisAgo' IS NOT NULL
    ELSE false
  END
$fn$;

COMMENT ON FUNCTION public.object_set_value_filter_valid(jsonb) IS
  'Whether a filter VALUE is one of the seven kinds generate-urls.md prints, with the field that kind requires. Split out by 776 so a nested far-property member and a top-level property filter are judged by one rule.';

-- ── 1. the predicate, bound to whichever alias is asked for ────────────────

CREATE OR REPLACE FUNCTION public.object_set_property_predicate(
  p_object_type uuid, p_filter jsonb, p_alias text DEFAULT 'o')
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  e jsonb := p_filter; v jsonb; prop record;
  frag text; parts text[] := '{}'; tok text; vals text[];
BEGIN
  v := e->'value';

  SELECT p.property_id, p.base_type, p.visibility, p.searchable, p.source
    INTO prop
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND (p.api_name = e->>'propertyType' OR p.property_id = e->>'propertyType');
  IF prop IS NULL THEN
    RAISE EXCEPTION 'Ontology:PropertyNotFound — % is not a property of this object type', e->>'propertyType';
  END IF;
  IF prop.visibility = 'hidden' THEN
    RAISE EXCEPTION 'Ontology:PropertyIsHidden — hidden properties do not appear anywhere in Object Explorer';
  END IF;
  IF prop.source = 'linked_objects' THEN
    RAISE EXCEPTION 'Ontology:DerivedPropertyNotComputable — % is derived from linked objects, and filtering, sorting or aggregating by its computed value is not built', e->>'propertyType';
  END IF;

  CASE v->>'type'
    WHEN 'textFilter' THEN
      -- "Matches objects where the property contains all search tokens."
      IF NOT prop.searchable THEN
        RAISE EXCEPTION 'Ontology:PropertyNotSearchable — the Searchable render hint is not enabled on %', e->>'propertyType';
      END IF;
      frag := 'true';
      FOREACH tok IN ARRAY regexp_split_to_array(btrim(v->>'text'), '\s+') LOOP
        CONTINUE WHEN tok = '';
        frag := frag || format(' AND %s.%I::text ILIKE %L',
          p_alias, prop.property_id, '%' || replace(replace(tok, '_', '\_'), '%', '\%') || '%');
      END LOOP;
      parts := parts || ('(' || frag || ')');
    WHEN 'valuesFilter' THEN
      SELECT array_agg(x) INTO vals FROM jsonb_array_elements_text(v->'values') x;
      parts := parts || format('(%s.%I::text = ANY (%L::text[]))', p_alias, prop.property_id, vals);
    WHEN 'numberRangeFilter' THEN
      frag := 'true';
      IF v->'min' IS NOT NULL THEN frag := frag || format(' AND %s.%I >= %s', p_alias, prop.property_id, (v->>'min')::numeric); END IF;
      IF v->'max' IS NOT NULL THEN frag := frag || format(' AND %s.%I <= %s', p_alias, prop.property_id, (v->>'max')::numeric); END IF;
      parts := parts || ('(' || frag || ')');
    WHEN 'dateRangeFilter' THEN
      frag := 'true';
      IF v->'dateRangeFilter'->>'start' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I >= %L::date', p_alias, prop.property_id, (v->'dateRangeFilter'->>'start')::date);
      END IF;
      IF v->'dateRangeFilter'->>'end' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I <= %L::date', p_alias, prop.property_id, (v->'dateRangeFilter'->>'end')::date);
      END IF;
      parts := parts || ('(' || frag || ')');
    WHEN 'relativeDateFilter' THEN
      frag := 'true';
      IF v->'sinceDaysAgo' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I >= current_date - %s', p_alias, prop.property_id, (v->>'sinceDaysAgo')::int);
      END IF;
      IF v->'untilDaysAgo' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I <= current_date - %s', p_alias, prop.property_id, (v->>'untilDaysAgo')::int);
      END IF;
      parts := parts || ('(' || frag || ')');
    WHEN 'timestampRangeFilter' THEN
      frag := 'true';
      IF v->'startMillis' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I >= to_timestamp(%s / 1000.0)', p_alias, prop.property_id, (v->>'startMillis')::numeric);
      END IF;
      IF v->'endMillis' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I <= to_timestamp(%s / 1000.0)', p_alias, prop.property_id, (v->>'endMillis')::numeric);
      END IF;
      parts := parts || ('(' || frag || ')');
    WHEN 'relativeTimestampFilter' THEN
      frag := 'true';
      IF v->'sinceMillisAgo' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I >= now() - make_interval(secs => %s / 1000.0)', p_alias, prop.property_id, (v->>'sinceMillisAgo')::numeric);
      END IF;
      IF v->'untilMillisAgo' IS NOT NULL THEN
        frag := frag || format(' AND %s.%I <= now() - make_interval(secs => %s / 1000.0)', p_alias, prop.property_id, (v->>'untilMillisAgo')::numeric);
      END IF;
      parts := parts || ('(' || frag || ')');
  END CASE;

  RETURN array_to_string(parts, ' AND ');
END $fn$;

COMMENT ON FUNCTION public.object_set_property_predicate(uuid, jsonb, text) IS
  'One propertyFilter compiled to SQL, bound to the given alias. Lifted out of object_set_where by 776 so a far-property link filter can bind it to the far index; the subject arm calls it with "o". The value kinds are generate-urls.md''s, unchanged.';

REVOKE ALL ON FUNCTION public.object_set_property_predicate(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_set_property_predicate(uuid, jsonb, text)
  TO authenticated, service_role;

-- ── 2. the subject arm calls it, and the link arms gain the far predicates ──

DO $mig$
DECLARE src text; a text; b text; i int; j int; n int;
BEGIN
  src := replace(pg_get_functiondef('public.object_set_where(uuid,jsonb)'::regprocedure), chr(13), '');

  -- Cut the property arm's body by POSITION between two unique markers, so the
  -- doubled newlines 484 left in this function cannot break the anchor.
  a := 'SELECT p.property_id, p.base_type, p.visibility, p.searchable, p.source';
  b := 'END CASE;';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION 'expected the property lookup exactly once';
  END IF;
  IF (length(src) - length(replace(src, b, ''))) / length(b) <> 1 THEN
    RAISE EXCEPTION 'expected one END CASE';
  END IF;
  i := position(a in src);
  j := position(b in src);
  IF j <= i THEN RAISE EXCEPTION 'the CASE does not follow the lookup'; END IF;
  src := left(src, i - 1)
      || 'parts := parts || public.object_set_property_predicate(p_object_type, e, ''o'');'
      || substr(src, j + length(b));

  -- The far predicates go where 771's gate goes: inside the EXISTS, before the
  -- negation. The matchType line is the same three-times-two-indentations
  -- anchor 771 spliced, so the same newline anchoring applies.
  a := chr(10) || '        IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;';
  b := chr(10) || '      IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 2 THEN RAISE EXCEPTION 'expected the eight-space matchType line twice, found %', n; END IF;
  n := (length(src) - length(replace(src, b, ''))) / length(b);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the six-space matchType line once, found %', n; END IF;

  src := replace(src, a, chr(10) || '        ' || $blk$FOR fe IN SELECT * FROM jsonb_array_elements(coalesce(e->'filters', '[]'::jsonb)) LOOP
          IF fe->>'type' = 'propertyFilter' THEN
            far_pred := public.object_set_property_predicate(far_t, fe, 'x');
            IF coalesce(far_pred, '') <> '' THEN
              cond := left(cond, length(cond) - 1) || ' AND ' || far_pred || ')';
            END IF;
          ELSIF fe->>'type' = 'presenceFilter' AND fe->>'matchType' = 'MUST_NOT_HAVE' THEN
            far_neg := true;
          END IF;
        END LOOP;
        IF far_neg THEN cond := 'NOT ' || cond; far_neg := false; END IF;$blk$ || substr(a, 2));

  src := replace(src, b, chr(10) || '      ' || $blk$FOR fe IN SELECT * FROM jsonb_array_elements(coalesce(e->'filters', '[]'::jsonb)) LOOP
        IF fe->>'type' = 'propertyFilter' THEN
          far_pred := public.object_set_property_predicate(far_t, fe, 'x');
          IF coalesce(far_pred, '') <> '' THEN
            cond := left(cond, length(cond) - 1) || ' AND ' || far_pred || ')';
          END IF;
        ELSIF fe->>'type' = 'presenceFilter' AND fe->>'matchType' = 'MUST_NOT_HAVE' THEN
          far_neg := true;
        END IF;
      END LOOP;
      IF far_neg THEN cond := 'NOT ' || cond; far_neg := false; END IF;$blk$ || substr(b, 2));

  src := regexp_replace(src, 'DECLARE', 'DECLARE fe jsonb; far_pred text; far_neg boolean := false;', 1, 1);
  EXECUTE src;
END $mig$;

-- ── 3. the grammar the validator will accept ───────────────────────────────

CREATE OR REPLACE FUNCTION public.object_set_filters_valid(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE e jsonb; v jsonb; fe jsonb; links text[] := '{}'; lt text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    v := e->'value';
    IF e->>'type' = 'propertyFilter' THEN
      IF e->>'propertyType' IS NULL OR v IS NULL THEN RETURN false; END IF;
      IF NOT public.object_set_value_filter_valid(v) THEN RETURN false; END IF;
    ELSIF e->>'type' = 'linkFilter' THEN
      lt := e->>'linkType';
      IF lt IS NULL THEN RETURN false; END IF;
      -- "only 1 LINK filter" is taken as one filter PER LINK: the pages show an
      -- exploration filtering two different links at once, so a literal cap of
      -- one would refuse a documented state.
      IF lt = ANY (links) THEN RETURN false; END IF;
      links := links || lt;

      IF e ? 'filters' THEN
        -- The nested form: a link config holding filter sections.
        IF jsonb_typeof(e->'filters') <> 'array' OR jsonb_array_length(e->'filters') = 0 THEN
          RETURN false;
        END IF;
        FOR fe IN SELECT * FROM jsonb_array_elements(e->'filters') LOOP
          IF jsonb_typeof(fe) <> 'object' THEN RETURN false; END IF;
          IF fe->>'type' = 'presenceFilter' THEN
            IF fe->>'matchType' NOT IN ('MUST_HAVE','MUST_NOT_HAVE') THEN RETURN false; END IF;
          ELSIF fe->>'type' = 'propertyFilter' THEN
            IF fe->>'propertyType' IS NULL
               OR NOT public.object_set_value_filter_valid(fe->'value') THEN RETURN false; END IF;
          ELSE
            RETURN false;
          END IF;
        END LOOP;
      ELSE
        -- The flat form generate-urls prints, which saved explorations use.
        IF v->>'type' IS DISTINCT FROM 'presenceFilter'
           OR v->>'matchType' NOT IN ('MUST_HAVE','MUST_NOT_HAVE') THEN RETURN false; END IF;
      END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END $fn$;

COMMENT ON FUNCTION public.object_set_filters_valid(jsonb) IS
  'The filter grammar generate-urls.md prints, widened by 776: a linkFilter carries either the flat presenceFilter value that page shows, or a nested "filters" list whose members are presenceFilter and propertyFilter — the link config workshop/widgets-filter-list.md describes. "only 1 LINK filter" is read as one per LINK, because the captures show one exploration filtering two different links.';
