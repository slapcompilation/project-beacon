-- 586's third arm reported a backing datasource that maps no properties. It
-- fired on almost every object type in the platform suite, and it was right
-- about the rows and wrong about what they mean.
--
-- `object_type_properties.datasource_id` is nullable, and 545 backfilled it
-- "only where the choice is unambiguous: the page makes it a user's choice when
-- a type has several datasources, so we never guess between them." The
-- converse is what 586 missed: when a type has ONE datasource there is no
-- choice to record, so a null is not a missing answer — it is the only answer.
--
-- The page's rule is about the plural case throughout:
--
--   "A join-like MDO case where distinct subsets of properties for an object
--    type can be integrated from different datasources."
--
--   "This means that a specific property of an object type must come from
--    one—and only one—of the input datasources"
--
--   — object-permissioning/multi-datasource-objects.md
--
-- and so are the screenshots. `multi-datasource-objects-add-new-datasource.png`
-- shows one backing datasource and a green tick on the object type;
-- `multi-datasource-objects-backing-datasources.png` shows two and a red error.
-- The error arrives WITH the second datasource, which is the moment a property
-- has something to choose between.
--
-- This also matters more than a linter's accuracy usually does, because
-- `ontology_violations()` is not only read by a linter: `save_working_state`
-- refuses a save that INTRODUCES a violation (426). An arm written too wide
-- does not merely produce noise — it blocks the save.

CREATE OR REPLACE FUNCTION public.datasource_mapping_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  WITH ds AS (
    SELECT d.id, d.object_type_id, t.api_name,
           COALESCE(d.primary_key_column,
                    (SELECT p.backing_column FROM public.object_type_properties p
                      WHERE p.object_type_id = d.object_type_id AND p.is_primary_key)) AS key_column,
           coalesce(CASE WHEN d.dataset_id IS NOT NULL THEN public.dataset_branch_schema(d.branch_id)
                         ELSE public.dataset_current_fields(
                           (SELECT v.input_dataset_id FROM public.restricted_views v
                             WHERE v.id = d.restricted_view_id)) END, '[]'::jsonb) AS fields
      FROM public.object_type_datasources d
      JOIN public.object_types t ON t.id = d.object_type_id
     WHERE d.media_set_rid IS NULL
  )
  SELECT ds.api_name, 'datasource', ds.id::text,
         'Backing datasource has no primary key column; the object type''s primary key property names none either'
    FROM ds WHERE ds.key_column IS NULL

  UNION ALL

  -- "the primary key property, which must exist in every input datasource to
  -- join all datasources". This is that sentence, asked of the schema — and it
  -- goes stale on its own, because the dataset can drop the column without
  -- anyone editing the ontology.
  SELECT ds.api_name, 'datasource', ds.id::text,
         format('Primary key column %L is not in this backing datasource; the key must exist in every input datasource to join them', ds.key_column)
    FROM ds
   WHERE ds.key_column IS NOT NULL
     AND jsonb_array_length(ds.fields) > 0
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ds.fields) f
                      WHERE f ->> 'name' = ds.key_column)

  UNION ALL

  -- "Navigate to the Properties metadata section from the left sidebar to add
  -- new fields to the newly added dataset." Only asked once a type has more
  -- than one datasource, because that is when a property's silence about which
  -- one it came from stops being an answer.
  SELECT t.api_name, 'datasource', d.id::text,
         'Backing datasource maps no properties; add fields from it in the Properties section'
    FROM public.object_type_datasources d
    JOIN public.object_types t ON t.id = d.object_type_id
   WHERE (SELECT count(*) FROM public.object_type_datasources x
           WHERE x.object_type_id = d.object_type_id) > 1
     AND NOT EXISTS (SELECT 1 FROM public.object_type_properties p WHERE p.datasource_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m WHERE m.datasource_id = d.id)
$fn$;

DO $$
DECLARE n int;
BEGIN
  -- Every object type with exactly one datasource is now silent on this arm,
  -- which is the whole correction.
  SELECT count(*) INTO n
    FROM public.datasource_mapping_problems() p
    JOIN public.object_types t ON t.api_name = p.object_type
   WHERE p.problem LIKE '%maps no properties%'
     AND (SELECT count(*) FROM public.object_type_datasources d
           WHERE d.object_type_id = t.id) = 1;
  IF n > 0 THEN
    RAISE EXCEPTION 'the arm still fires on % single-datasource object type(s)', n;
  END IF;
END $$;
