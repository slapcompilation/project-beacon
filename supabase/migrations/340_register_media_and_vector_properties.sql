-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 340 — the two new base types stop being available and start being used.
--
-- 339 added `media_reference` and `vector` to the vocabulary. Nothing carried
-- them, so the ontology still described a PDF as a text column and could not see
-- an embedding at all:
--
--   document.storage_path  registered as `text` — a path string, not a pointer
--                          to a file, so nothing downstream knows it can be
--                          opened or rendered.
--   chunk.embedding        NOT REGISTERED. The column is pgvector and the
--                          ontology had no property for it, which is why
--                          `builtin_property_drift()` reported zero — it only
--                          checks properties that exist.
--
-- BUILTIN_PROPERTY_DRIFT HAS TO LEARN THE RULE FIRST, or this registration is
-- itself drift. It derives the expected base type from the column type, so
-- `storage_path` would read as `text` and the refinement would look like damage.
--
-- Foundry's own compatibility rule is the one to copy: "Base types are related to
-- the underlying column type and MUST MATCH the column type in order to be
-- applied on an object type" (create-shared-property). So an advanced type is a
-- permitted REFINEMENT over a compatible column, not a free choice:
--
--   media_reference  over a text column     — the reference is stored as a path
--   vector           over a pgvector column — udt_name = 'vector'
--
-- Anything else still drifts. Registering `size_bytes` as a media reference is
-- as wrong as it was before.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.builtin_property_drift()
RETURNS TABLE (api_name text, property_key text, problem text)
LANGUAGE sql STABLE AS $$
  SELECT t.api_name, p->>'key',
         CASE WHEN c.column_name IS NULL THEN 'column no longer exists'
              ELSE 'column type changed to ' || c.data_type END
  FROM public.object_types t
  CROSS JOIN LATERAL jsonb_array_elements(t.properties) p
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = t.source_table AND c.column_name = p->>'key'
  WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL
    AND (
      c.column_name IS NULL
      OR NOT (
        -- The default mapping: a column type implies a base type.
        (p->>'type') = CASE
           WHEN c.data_type IN ('integer','bigint','smallint','numeric','real','double precision') THEN 'number'
           WHEN c.data_type = 'boolean' THEN 'boolean'
           WHEN c.data_type LIKE 'timestamp%' OR c.data_type = 'date' THEN 'date'
           ELSE 'text' END
        -- Foundry's advanced types, each valid over exactly the column that can
        -- hold it. A refinement, never a free choice.
        OR (p->>'type' = 'media_reference' AND c.data_type = 'text')
        OR (p->>'type' = 'vector'          AND c.udt_name  = 'vector')
      )
    )
  UNION ALL
  SELECT t.api_name, t.title_key, 'title_key is not a property of this type'
  FROM public.object_types t
  WHERE t.kind = 'builtin' AND t.title_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(t.properties) p WHERE p->>'key' = t.title_key
    );
$$;

COMMENT ON FUNCTION public.builtin_property_drift() IS
  'Rows = drift between a built-in registration and its backing table. A column type implies a base type; media_reference and vector are permitted refinements over text and pgvector respectively, per Foundry''s rule that a base type must match the underlying column.';

-- ── The registrations ───────────────────────────────────────────────────────

-- A document's file becomes a pointer the ontology understands.
UPDATE public.object_types
   SET properties = (
     SELECT jsonb_agg(
       CASE WHEN p->>'key' = 'storage_path'
            THEN jsonb_set(p, '{type}', '"media_reference"')
            ELSE p END ORDER BY ord)
     FROM jsonb_array_elements(properties) WITH ORDINALITY AS e(p, ord))
 WHERE kind = 'builtin' AND api_name = 'document'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(properties) p WHERE p->>'key' = 'storage_path');

-- A chunk's embedding becomes visible to the ontology at all.
UPDATE public.object_types
   SET properties = properties || jsonb_build_array(jsonb_build_object(
         'key', 'embedding', 'label', 'Embedding', 'type', 'vector', 'required', false))
 WHERE kind = 'builtin' AND api_name = 'chunk'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(properties) p WHERE p->>'key' = 'embedding');

DO $$
DECLARE n int; t text;
BEGIN
  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 340: % drift row(s) after registering the new types', n;
  END IF;

  SELECT p->>'type' INTO t FROM object_types o, jsonb_array_elements(o.properties) p
   WHERE o.api_name = 'document' AND p->>'key' = 'storage_path' LIMIT 1;
  IF t <> 'media_reference' THEN
    RAISE EXCEPTION 'Migration 340: storage_path is registered as %, not media_reference', t;
  END IF;

  SELECT p->>'type' INTO t FROM object_types o, jsonb_array_elements(o.properties) p
   WHERE o.api_name = 'chunk' AND p->>'key' = 'embedding' LIMIT 1;
  IF t IS DISTINCT FROM 'vector' THEN
    RAISE EXCEPTION 'Migration 340: chunk.embedding is registered as %, not vector', coalesce(t, 'nothing');
  END IF;

  -- The rule still refuses an incompatible refinement.
  IF NOT EXISTS (
    SELECT 1 FROM object_types o, jsonb_array_elements(o.properties) p
     WHERE o.api_name = 'document' AND p->>'key' = 'size_bytes') THEN
    RAISE NOTICE 'Migration 340: no size_bytes property to counter-check against';
  END IF;
END $$;

COMMIT;
