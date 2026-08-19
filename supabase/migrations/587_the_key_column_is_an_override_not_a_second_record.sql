-- 586 added `primary_key_column` and asked the wrong question of it.
--
-- Its first linter arm reported a datasource whose object type's primary key
-- property did not point at it. But 408 decided the opposite, on the same
-- sentence 586 was built from:
--
--   'Which backing datasource this property comes from. NULL on the primary
--    key, which "must exist in every input datasource"; NULL also when
--    source = user_input.'
--    — the comment on object_type_properties.datasource_id, migration 408
--
-- The primary key property points at NO datasource precisely because it belongs
-- to all of them. So "which datasource does the key property name" has no
-- answer by construction, and 586's arm fired on the only real object type in
-- the ontology.
--
-- The correction makes the column what the page actually describes. The primary
-- key property names a column; every backing datasource is expected to have a
-- column of that name; the helper exists because one of them might spell it
-- differently:
--
--   "The Map primary key helper will appear and prompt you for a column with
--    values matching the primary key of the object type."
--   — object-permissioning/multi-datasource-objects.md
--
-- So `primary_key_column` is an OVERRIDE, and the effective key column of a
-- datasource is COALESCE(its own, the primary key property's backing column).
--
-- That turns the second arm into the rule itself — "the primary key property
-- ... must exist in every input datasource to join all datasources" — checked
-- against each datasource's live schema rather than asserted.

COMMENT ON COLUMN public.object_type_datasources.primary_key_column IS
  'The column in this datasource holding the object type''s primary key, when it '
  'is not spelled the way the primary key property spells it. NULL means the '
  'property''s own backing column, which every input datasource is expected to have.';

CREATE OR REPLACE FUNCTION public.datasource_mapping_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  -- The effective key of every datasource synced to object storage, and the
  -- fields the thing it reads actually has.
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
  -- new fields to the newly added dataset." Until that happens the datasource
  -- backs nothing, which is the state the second screenshot is in.
  SELECT t.api_name, 'datasource', d.id::text,
         'Backing datasource maps no properties; add fields from it in the Properties section'
    FROM public.object_type_datasources d
    JOIN public.object_types t ON t.id = d.object_type_id
   WHERE NOT EXISTS (SELECT 1 FROM public.object_type_properties p WHERE p.datasource_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m WHERE m.datasource_id = d.id)
$fn$;

-- A datasource with no schema yet is not a violation — nothing has been written
-- to the dataset, so there is no column list to be missing from. That is why
-- the second arm requires a non-empty field list rather than treating an
-- unwritten dataset as a broken join.

DO $$
DECLARE n int;
BEGIN
  -- The arm that fired on the only real object type must not fire any more:
  -- its primary key property names tail_number and its datasource inherits it.
  SELECT count(*) INTO n FROM public.datasource_mapping_problems()
   WHERE problem LIKE '%no primary key column%';
  IF n > 0 THEN
    RAISE EXCEPTION '586''s arm still fires on % datasource(s) whose key property names a column', n;
  END IF;
END $$;
