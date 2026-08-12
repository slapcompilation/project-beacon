-- The OpenSearch half of Decision 5 (readings/object-explorer.md, amended to
-- OpenSearch on Aiven by the operator 2026-08-12). The engine names in the
-- docs are Lucene's: understanding-text-search.md links the StandardAnalyzer
-- javadoc, its analyzer table is Elasticsearch vocabulary, and "two columns
-- will be counted toward the total number of columns indexed"
-- (metadata-render-hints.md) is a multi-field — a text field with a keyword
-- subfield. This migration builds exactly that mapping, in SQL, where the
-- property declarations live.
--
-- The seam: Postgres stays the source of truth and the search cluster is a
-- derived, disposable artifact — the same standing 442 gave the objects
-- schema. One RPC hands an edge function everything it needs to (re)build one
-- type's search index: the index name, the mappings, the documents. A second
-- RPC answers "which types may this caller search", which is 443's priority
-- query shared with the query-side edge function.
--
-- Analyzer names map to OpenSearch's: standard, simple, whitespace pass
-- through; not_analyzed becomes a keyword field (its pre-5.x meaning);
-- english, french, german, arabic are built-in language analyzers. Japanese
-- and Korean map to the kuromoji and nori plugin analyzers Aiven ships, and
-- combined_arabic_english falls back to arabic — the last three are
-- approximations, marked here, not documented equivalences.

CREATE OR REPLACE FUNCTION public.opensearch_analyzer(p_analyzer text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_analyzer
    WHEN 'japanese' THEN 'kuromoji'
    WHEN 'korean' THEN 'nori'
    WHEN 'combined_arabic_english' THEN 'arabic'
    ELSE p_analyzer
  END
$$;

-- Everything one rebuild needs. Service-role only: the payload carries every
-- row of the type's index table, so it must never answer an ordinary caller.
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

REVOKE ALL ON FUNCTION public.search_index_payload(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.search_index_payload(uuid) TO service_role;

COMMENT ON FUNCTION public.search_index_payload(uuid) IS
  'Everything one OpenSearch rebuild needs — index name, mappings from the render hints and analyzers, every document. Service role only; the search-index edge function is its one caller.';

-- The query side's scope: which types may this caller search, in 443's
-- documented priority order, with what the hit list needs to render.
CREATE OR REPLACE FUNCTION public.search_visible_types()
RETURNS TABLE (object_type_id uuid, object_type_label text,
               index_table text, title_property text, primary_key_property text)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ot.id, ot.label, x.index_table, pt.property_id, pk.property_id
    FROM public.object_types ot
    JOIN public.object_type_indexes x
      ON x.object_type_id = ot.id AND x.status = 'success'
    JOIN public.object_type_properties pt
      ON pt.object_type_id = ot.id AND pt.is_title_key
    JOIN public.object_type_properties pk
      ON pk.object_type_id = ot.id AND pk.is_primary_key
   WHERE ot.status <> 'deprecated'
     AND ot.visibility <> 'hidden'
     AND public.auth_in_ontology(ot.ontology_id)
   ORDER BY CASE
     WHEN ot.status = 'promoted' THEN 0
     WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0
     WHEN ot.status = 'active' THEN 1
     WHEN ot.status = 'experimental' THEN 2
     ELSE 3
   END, ot.created_at
   LIMIT 250
$$;

REVOKE ALL ON FUNCTION public.search_visible_types() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_visible_types() TO authenticated;

COMMENT ON FUNCTION public.search_visible_types() IS
  'The caller''s searchable types in quicksearch''s documented priority order (443) — the query-side edge function''s scope, evaluated with the caller''s own claims.';

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid;
  ds uuid; br uuid; txn uuid; fid uuid; ptbl text;
  t uuid; usr uuid := gen_random_uuid(); before text; x public.object_type_indexes;
  payload jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('os-478') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws478@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws478@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS478');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ws478', 'WS 478', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws478', 'WS478') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'notes478', 'notes') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"note_id","type":"STRING"},{"name":"body","type":"STRING"},{"name":"secret","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'notes.parquet', 1) RETURNING id INTO fid;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format('INSERT INTO datasets.%I (_file, note_id, body, secret) VALUES ($1,''N1'',''hello world'',''s1'')', ptbl)
    USING fid;

  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Note478', 'Note') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id) VALUES (t, ds, br);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, required, is_primary_key, is_title_key, analyzer)
  VALUES (t, 'note_id', 'Note Id', 'noteId', 'string', 'note_id', true, true, true, 'not_analyzed');
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, datasource_id, required, sortable, selectable)
  SELECT t, 'body', 'Body', 'body', 'string', 'body', d.id, false, true, true
    FROM public.object_type_datasources d WHERE d.object_type_id = t;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type,
     backing_column, datasource_id, required, visibility)
  SELECT t, 'secret', 'Secret', 'secret', 'string', 'secret', d.id, false, 'hidden'
    FROM public.object_type_datasources d WHERE d.object_type_id = t;
  SET LOCAL ROLE authenticated;

  x := public.index_object_type(t);
  IF x.status <> 'success' THEN RAISE EXCEPTION 'index failed: %', x.error; END IF;

  -- 1. An ordinary caller may not lift the payload — the grant refuses before
  --    the claims check even runs.
  BEGIN
    payload := public.search_index_payload(t);
    RAISE EXCEPTION 'an authenticated caller read the index payload';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 2. The service role gets the whole shape: keyword pk, analyzed body with
  --    its raw subfield, and the hidden property nowhere. (RESET ROLE stands
  --    in for the service connection; the claims check is the gate proven.)
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('role','service_role')::text, true);
  payload := public.search_index_payload(t);
  SET LOCAL ROLE authenticated;
  IF payload->>'primary_key' <> 'note_id'
     OR payload->'mappings'->'properties'->'note_id'->>'type' <> 'keyword'
     OR payload->'mappings'->'properties'->'body'->>'analyzer' <> 'standard'
     OR payload->'mappings'->'properties'->'body'->'fields'->'keyword'->>'type' <> 'keyword'
     OR payload->'mappings'->'properties' ? 'secret'
     OR jsonb_array_length(payload->'documents') <> 1 THEN
    RAISE EXCEPTION 'the payload shape is wrong: %', payload->'mappings';
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  -- 3. The visible-types scope answers with the caller's claims.
  IF NOT EXISTS (SELECT 1 FROM public.search_visible_types() v WHERE v.object_type_id = t) THEN
    RAISE EXCEPTION 'the searchable scope is missing the indexed type';
  END IF;

  -- 4. The analyzer approximations are the recorded three, and only those.
  IF public.opensearch_analyzer('standard') <> 'standard'
     OR public.opensearch_analyzer('japanese') <> 'kuromoji'
     OR public.opensearch_analyzer('korean') <> 'nori'
     OR public.opensearch_analyzer('combined_arabic_english') <> 'arabic' THEN
    RAISE EXCEPTION 'the analyzer mapping drifted';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '478: the payload is service-role only, hidden stays hidden, hints become multi-fields';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
