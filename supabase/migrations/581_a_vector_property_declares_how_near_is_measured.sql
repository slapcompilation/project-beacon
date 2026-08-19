-- Phase F1, the last item in the ontology build map.
--
-- ── THE ONTOLOGY STORES THE VECTOR; IT DOES NOT EMBED ────────────────────
-- The workflow page is a sequence and only its middle step is ours:
--
--   "To begin, you need to generate embeddings and store them in an object type
--    with a `vector` type."
--
-- Generation is named three ways and none of them is the ontology — Pipeline
-- Builder's Text to Embeddings expression, a Python transform, or a function
-- calling a model at query time. Building an embedding call here would invent a
-- fourth route and put a model dependency inside the schema.
--
-- ── THE DISTANCE FUNCTION BELONGS TO THE PROPERTY ────────────────────────
-- The first draft of the reading proposed picking cosine platform-wide and
-- marking it inference. That had the wrong SHAPE, and one comment in
-- `using-custom-models-to-create-a-semantic-search-workflow` says why:
--
--   "The computation of the distance function depends on the distance function
--    defined for the embedding property. Here we assume it's cosine similarity,
--    which can be computed with a simple vector dot product if the embedding
--    model produces normalized vectors."
--
-- **"defined for the embedding property"** — it is part of the property's
-- definition, as `array_element_type` is. So it is a column.
--
-- The four values come from `pb-functions-expression/similarityScoreV1`, the
-- expression that computes the same thing in a pipeline:
--
--   "Similarity metric: … Enum<Cosine Distance, Cosine Similarity, Dot Product,
--    Euclidean Distance>"
--
-- INFERENCE, and marked as one: that enum is Pipeline Builder's, not the
-- ontology property's. No page prints the property's own vocabulary. Taking
-- these four is the closest published thing to it.
--
-- The same page's examples settle empirically what its comment claims. Cosine
-- similarity of two Ada embeddings gives 0.7814455755180517; dot product of the
-- same pair gives 0.7814455030932973 — near-identical, because Ada normalises,
-- but NOT equal. So the two are not interchangeable even for the model the
-- worked example uses, which is the argument for storing the choice rather than
-- assuming it.
--
-- ── TWO RULES THAT ARE PROPERTY RULES, NOT QUERY RULES ───────────────────
-- `object-link-types/property-metadata`, under limited support:
--
--   "Vectors can only be queried by KNN."
--   "The max vector dimension is 2048."
--
-- The first is absolute: no ordinary filter, and the render hints
-- (searchable/sortable/selectable) mean nothing for a vector. The second sits
-- in the property list rather than only in the KNN callout, so enforcing it at
-- declaration is the documented reading rather than a strict choice.
--
-- ── AND THE QUERY'S OWN FOUR LIMITS ─────────────────────────────────────
--   "KNN is only supported on object types indexed into OSv2. The k value is
--    limited to the range 0 < K <= 100. Also, the search vector must be the same
--    size as the one used for indexing and has a 2048 dimension limit. An error
--    will be thrown if any of these limits are exceeded."
--
-- "An error will be thrown" is the documented behaviour, so silence would be
-- the divergence. Worth noting the one place Foundry does the opposite:
-- `similarityScoreV1` returns null for mismatched lengths rather than raising.
-- That is the batch expression; this is the query path.

BEGIN;

-- ── §1 the vocabulary ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vector_distance_functions()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['cosine_similarity','cosine_distance','dot_product','euclidean_distance']
$fn$;
COMMENT ON FUNCTION public.vector_distance_functions() IS
  'The four similarity metrics Foundry publishes for embedding comparison. INFERENCE: the enum is printed by the Pipeline Builder expression similarityScoreV1, not by the ontology property page, which never names the property''s own vocabulary.';

-- pgvector's operator for each. Cosine similarity is 1 - cosine distance, so
-- both order identically and only the reported number differs.
CREATE OR REPLACE FUNCTION public.vector_distance_operator(p_fn text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_fn
    WHEN 'cosine_similarity'   THEN '<=>'
    WHEN 'cosine_distance'     THEN '<=>'
    WHEN 'dot_product'         THEN '<#>'
    WHEN 'euclidean_distance'  THEN '<->'
  END
$fn$;

-- ── §2 the property declares its dimension and its measure ──────────────
ALTER TABLE public.object_type_properties
  ADD COLUMN vector_dimension integer,
  ADD COLUMN vector_distance_function text;

ALTER TABLE public.object_type_properties
  -- "The max vector dimension is 2048."
  ADD CONSTRAINT vector_declares_its_dimension CHECK (
    (base_type = 'vector') = (vector_dimension IS NOT NULL)),
  ADD CONSTRAINT vector_dimension_within_limit CHECK (
    vector_dimension IS NULL OR (vector_dimension > 0 AND vector_dimension <= 2048)),
  -- "the distance function defined for the embedding property"
  ADD CONSTRAINT vector_declares_its_distance CHECK (
    (base_type = 'vector') = (vector_distance_function IS NOT NULL)),
  ADD CONSTRAINT vector_distance_is_published CHECK (
    vector_distance_function IS NULL
    OR vector_distance_function = ANY (public.vector_distance_functions())),
  -- "Vectors can only be queried by KNN" — so the hints that describe ordinary
  -- querying may not be set on one.
  ADD CONSTRAINT vector_takes_no_query_hints CHECK (
    base_type <> 'vector' OR (NOT searchable AND NOT sortable AND NOT selectable));

COMMENT ON COLUMN public.object_type_properties.vector_dimension IS
  'How many numbers the embedding has. Required for a vector and capped at the published 2048 — a query vector must be "the same size as the one used for indexing", so there has to be a declared size to match.';
COMMENT ON COLUMN public.object_type_properties.vector_distance_function IS
  'How nearness is measured for THIS property: the distance function depends on the one defined for the embedding property, not on a platform default.';

-- ── §3 the query, with the four limits it is documented to enforce ───────
CREATE OR REPLACE FUNCTION public.object_type_nearest(
  p_object_type uuid, p_property text, p_query real[], p_k integer)
RETURNS TABLE (object_key text, distance double precision)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE prop record; tbl text; op text; idx record;
BEGIN
  SELECT * INTO prop FROM public.object_type_properties
   WHERE object_type_id = p_object_type AND property_id = p_property;
  IF prop.id IS NULL OR prop.base_type <> 'vector' THEN
    RAISE EXCEPTION 'Ontology:NotAVectorProperty — % is not an embedding property', p_property
      USING HINT = 'Vectors can only be queried by KNN, and only a vector property can be.';
  END IF;

  -- "The k value is limited to the range 0 < K <= 100."
  IF p_k IS NULL OR p_k <= 0 OR p_k > 100 THEN
    RAISE EXCEPTION 'Ontology:KValueOutOfRange — k must satisfy 0 < k <= 100, got %', p_k;
  END IF;

  -- "the search vector must be the same size as the one used for indexing"
  IF coalesce(cardinality(p_query), 0) <> prop.vector_dimension THEN
    RAISE EXCEPTION 'Ontology:VectorDimensionMismatch — this property indexes % dimensions, the query has %',
      prop.vector_dimension, coalesce(cardinality(p_query), 0);
  END IF;

  -- "KNN is only supported on object types indexed into OSv2."
  SELECT * INTO idx FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  IF idx.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotIndexed — KNN is only supported on an indexed object type';
  END IF;

  tbl := public.object_table_name(p_object_type);
  op := public.vector_distance_operator(prop.vector_distance_function);

  RETURN QUERY EXECUTE format(
    'SELECT %I::text, (%I %s $1::vector)::double precision AS d
       FROM objects.%I WHERE %I IS NOT NULL ORDER BY d LIMIT $2',
    public.object_primary_key_column(p_object_type), prop.backing_column, op,
    tbl, prop.backing_column)
  USING p_query, p_k;
END $fn$;

COMMENT ON FUNCTION public.object_type_nearest(uuid, text, real[], integer) IS
  'The k nearest objects by embedding. Enforces the four published KNN limits and raises on each, because "An error will be thrown if any of these limits are exceeded" is the documented behaviour — the batch similarity expression returns null instead, but that is a different surface.';

-- ── assertions ───────────────────────────────────────────────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ot uuid; n int; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe581') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe581') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe581', 'Probe581') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe581', 'Probe581', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Doc', 'Doc') RETURNING id INTO ot;

    -- Four published metrics, each with a pgvector operator.
    SELECT cardinality(public.vector_distance_functions()) INTO n;
    IF n <> 4 THEN RAISE EXCEPTION 'expected four distance functions, found %', n; END IF;
    IF EXISTS (SELECT 1 FROM unnest(public.vector_distance_functions()) f
                WHERE public.vector_distance_operator(f) IS NULL) THEN
      RAISE EXCEPTION 'a published distance function has no operator';
    END IF;

    -- A vector must declare both, and a non-vector may declare neither.
    ok := false;
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, backing_column)
        VALUES (ot, 'embedding', 'embedding', 'Embedding', 'vector', 'embedding');  -- no dimension
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a vector property declared no dimension'; END IF;

    ok := false;
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, backing_column, vector_dimension)
        VALUES (ot, 'e2', 'e2', 'E2', 'vector', 'e2', 1536);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a vector property declared no distance function'; END IF;

    -- "The max vector dimension is 2048."
    ok := false;
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, backing_column,
         vector_dimension, vector_distance_function)
        VALUES (ot, 'e3', 'e3', 'E3', 'vector', 'e3', 2049, 'cosine_similarity');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION '2049 dimensions were accepted past the published cap'; END IF;

    -- The real one lands.
    -- The three hints go off explicitly: `searchable` defaults true, and a
    -- vector may carry none of them. That is the constraint doing its job on
    -- the very first vector property anyone writes.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column,
       vector_dimension, vector_distance_function, searchable, sortable, selectable)
      VALUES (ot, 'embedding', 'embedding', 'Embedding', 'vector', 'embedding',
              1536, 'cosine_similarity', false, false, false);

    -- "Vectors can only be queried by KNN" — the hints that describe ordinary
    -- querying are refused on one.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties SET searchable = true
       WHERE object_type_id = ot AND property_id = 'embedding';
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a vector property was made searchable'; END IF;

    -- And a non-vector may not claim a dimension.
    ok := false;
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type, backing_column, vector_dimension)
        VALUES (ot, 'title', 'title', 'Title', 'string', 'title', 8);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a string property declared a vector dimension'; END IF;

    -- ── the query's limits, each raised by name ─────────────────────────
    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding', array_fill(0::real, ARRAY[1536]), 0);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%KValueOutOfRange%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'k = 0 was accepted'; END IF;

    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding', array_fill(0::real, ARRAY[1536]), 101);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%KValueOutOfRange%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'k = 101 was accepted past the published cap'; END IF;

    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding', array_fill(0::real, ARRAY[8]), 5);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%VectorDimensionMismatch%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a query vector of the wrong size was accepted'; END IF;

    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'title', array_fill(0::real, ARRAY[1536]), 5);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%NotAVectorProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'KNN ran against a non-vector property'; END IF;

    -- "KNN is only supported on object types indexed into OSv2."
    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding', array_fill(0::real, ARRAY[1536]), 5);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ObjectTypeNotIndexed%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'KNN ran against an unindexed object type'; END IF;

    RAISE EXCEPTION 'probe581:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe581:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe581';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '581: a vector property declares how near is measured';
END $do$;

COMMIT;
