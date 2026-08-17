-- The array exclusion list was one short, and the missing entry is on a page
-- 448 never read.
--
-- 448 built the rule from `object-link-types/base-types`, which states the
-- exclusion as a pair:
--
--   "All base types may be used in arrays to represent multiple values for a
--    property, excluding the `Vector` and `Time series` types."
--
-- so it wrote NOT IN ('vector', 'time_series') and said as much in its comment.
--
-- `media-sets-advanced-formats/media-in-ontology` states a third, under
-- Considerations for use:
--
--   "Media reference lists are not supported as a property type on an object."
--
-- Both pages are current. Read together the base type page's list is incomplete
-- rather than wrong — the third exclusion is documented only on the media page,
-- which is where someone configuring media would be looking. Ours admitted
-- media reference arrays for 98 migrations.
--
-- The lesson is the one this repo keeps relearning: a rule stated as a closed
-- list on one page may be extended on another, and the narrower page wins.

BEGIN;

DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE array_element_type = 'media_reference';
  IF n > 0 THEN
    RAISE EXCEPTION '% property/properties already declare a media reference array', n;
  END IF;
END $do$;

ALTER TABLE public.object_type_properties DROP CONSTRAINT array_element_allowed;
ALTER TABLE public.object_type_properties
  ADD CONSTRAINT array_element_allowed
    -- "excluding the Vector and Time series types", and "Media reference lists
    -- are not supported as a property type on an object".
    CHECK (array_element_type IS NULL
           OR (array_element_type = ANY (public.property_base_types())
               AND array_element_type NOT IN ('vector', 'time_series', 'media_reference')));

COMMENT ON COLUMN public.object_type_properties.array_element_type IS
  'The base type of an array property''s elements. Required exactly when base_type is array; never array (no nesting), never vector, time_series or media_reference.';

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE ont uuid; org uuid; proj uuid; ds uuid; br uuid; t uuid; ok boolean;
BEGIN
  SELECT o.id INTO ont FROM public.ontologies o LIMIT 1;
  SELECT d.organization_id, d.project_id INTO org, proj
    FROM public.datasets d WHERE d.project_id IS NOT NULL LIMIT 1;
  IF ont IS NULL OR proj IS NULL THEN
    RAISE EXCEPTION '546: no ontology or project to build the fixture on';
  END IF;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'array_probe_546', 'Array probe 546') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name)
       VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.object_types (ontology_id, api_name, label)
       VALUES (ont, 'ArrayProbe546', 'Probe 546') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (t, ds, br);

  -- The one this migration is about.
  ok := false;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       array_element_type, backing_column)
    VALUES (t, 'shots', 'Shots', 'shots', 'array', 'media_reference', 'shots');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'a media reference list was accepted as a property type';
  END IF;

  -- The two 448 already refused still are.
  ok := false;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type,
       array_element_type, backing_column)
    VALUES (t, 'embeds', 'Embeds', 'embeds', 'array', 'vector', 'embeds');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a vector array was accepted'; END IF;

  -- And an ordinary array is untouched by any of this.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     array_element_type, backing_column)
  VALUES (t, 'tags', 'Tags', 'tags', 'array', 'string', 'tags');

  -- A single media reference is still a property; only the LIST is refused.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column)
  VALUES (t, 'poster', 'Poster', 'poster', 'media_reference', 'poster');

  RAISE NOTICE '546: a media reference list is not a property';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $do$;

COMMIT;
