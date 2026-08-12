-- The OpenSearch documents are shared across callers; a restricted view's
-- rows are per-caller. 484 already keeps such types out of the query scope
-- (search_visible_types); this keeps their documents from ever leaving
-- Postgres at all. Restated whole from 478; the change is the early return.
CREATE OR REPLACE FUNCTION public.search_index_payload(p_object_type uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbl text; docs jsonb; mappings jsonb; pk_prop text;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Ontology:ServiceRoleOnly — the index payload is the whole table';
  END IF;

  SELECT x.index_table INTO tbl
    FROM public.object_type_indexes x
   WHERE x.object_type_id = p_object_type AND x.status = 'success';
  IF tbl IS NULL THEN RETURN NULL; END IF;

  -- A restricted-view-backed type's rows are policy-gated per caller; the
  -- shared index cannot hold them. NULL is "nothing to push", which the
  -- search-index function already answers with indexed: 0.
  IF EXISTS (SELECT 1 FROM public.object_type_datasources d
              WHERE d.object_type_id = p_object_type AND d.restricted_view_id IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  SELECT p.property_id INTO pk_prop
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;

  -- One field per property. A string is a text field with its analyzer, plus
  -- a keyword subfield when sorting or aggregation needs the raw term — the
  -- documented "adds raw index". not_analyzed IS the keyword field. An
  -- unsearchable property is stored but not indexed. Hidden properties are
  -- not indexed at all — they appear nowhere in Object Explorer.
  SELECT jsonb_object_agg(p.property_id,
    CASE
      WHEN p.base_type = 'string' AND NOT p.searchable THEN
        jsonb_build_object('type', 'keyword', 'index', false)
      WHEN p.base_type = 'string' AND p.analyzer = 'not_analyzed' THEN
        jsonb_build_object('type', 'keyword')
      WHEN p.base_type = 'string' THEN
        jsonb_build_object('type', 'text',
          'analyzer', public.opensearch_analyzer(p.analyzer))
        || CASE WHEN p.sortable OR p.selectable
             THEN jsonb_build_object('fields', jsonb_build_object('keyword',
                    jsonb_build_object('type', 'keyword', 'ignore_above', 1024)))
             ELSE '{}'::jsonb END
      WHEN p.base_type IN ('byte','short') THEN jsonb_build_object('type', 'short')
      WHEN p.base_type = 'integer' THEN jsonb_build_object('type', 'integer')
      WHEN p.base_type = 'long'    THEN jsonb_build_object('type', 'long')
      WHEN p.base_type = 'float'   THEN jsonb_build_object('type', 'float')
      WHEN p.base_type IN ('double','decimal','number') THEN jsonb_build_object('type', 'double')
      WHEN p.base_type = 'boolean' THEN jsonb_build_object('type', 'boolean')
      WHEN p.base_type = 'date'    THEN jsonb_build_object('type', 'date')
      WHEN p.base_type = 'timestamp' THEN jsonb_build_object('type', 'date')
      ELSE jsonb_build_object('type', 'object', 'enabled', false)
    END)
    INTO mappings
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.visibility <> 'hidden';

  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(o)), ''[]''::jsonb) FROM objects.%I o', tbl)
    INTO docs;

  RETURN jsonb_build_object(
    'index', tbl,
    'primary_key', pk_prop,
    'mappings', jsonb_build_object('properties', mappings),
    'documents', docs);
END $$;
