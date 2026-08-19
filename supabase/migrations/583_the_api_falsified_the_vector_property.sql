-- 581 was wrong in three ways, and the api corpus said so within an hour of
-- being mirrored.
--
-- CLAUDE.md has said for as long as it has existed that `api/` "publishes what
-- the prose omits… request and response schemas, field descriptions and
-- **enums**. It has falsified our CHECK constraints twice. Grep it before
-- inferring a value." It was not on disk when 581 was built. It is now, and the
-- first vocabulary checked against it was wrong.
--
-- `api/v2/ontologies-v2-resources/object-types-get-object-type` defines the
-- vector property:
--
--   `vector` · object
--     "Represents a fixed size vector of floats. These can be used for vector
--      similarity searches."
--     - `dimension` · integer · required   "The dimension of the vector."
--     - `supportsSearchWith` · list
--       - `VectorSimilarityFunction` · object · required
--         "The vector similarity function to support approximate nearest
--          neighbors search. Will result in an index specific for the function."
--         - `value` · enum
--           one of `COSINE_SIMILARITY`, `DOT_PRODUCT`, `EUCLIDEAN_DISTANCE`
--     - `embeddingModel` · union
--       - `lms` · object  "A model provided by Language Model Service."
--         - `value` · enum · required
--           one of `OPENAI_TEXT_EMBEDDING_ADA_002`, `TEXT_EMBEDDING_3_LARGE`,
--           `TEXT_EMBEDDING_3_SMALL`, `SNOWFLAKE_ARCTIC_EMBED_M`,
--           `INSTRUCTOR_LARGE`, `BGE_BASE_EN_V1_5`
--       - `foundryLiveDeployment` · object
--         - `rid` · string, `inputParamName` · string, `outputParamName` · string
--
-- ── THREE ERRORS ─────────────────────────────────────────────────────────
--
-- 1. **THREE similarity functions, not four.** 581 took four from
--    `similarityScoreV1` and marked the choice INFERENCE, because that is
--    Pipeline Builder's expression rather than the property's own vocabulary.
--    The inference was flagged and it was still wrong: `COSINE_DISTANCE` is a
--    batch expression's metric, not a property's. The flag did its job — it says
--    exactly where to look when a better source arrives — but a flagged
--    inference is still a guess.
--
-- 2. **`supportsSearchWith` is a LIST.** A property may support several
--    functions, and the spec says why: "Will result in an index specific for the
--    function." Each supported function is an index. 581 modelled one column, so
--    it could not express a property searchable two ways, and — worse — implied
--    that choosing a function is free rather than an indexing decision.
--
-- 3. **The property declares its EMBEDDING MODEL**, which 581 did not have at
--    all. This is the one that matters. 581's first Decision was "the ontology
--    stores the vector; it does not embed", and that is still true of
--    GENERATION — Pipeline Builder, a transform or a function produces the
--    vectors. But the property must still NAME the model, because a KNN query
--    embeds the query string and it has to use the same one. Storing the vectors
--    without recording what produced them makes every future query a guess.
--
-- ── AND THE ONE THING 581 GOT RIGHT FOR THE RIGHT REASON ─────────────────
-- `dimension · integer · required` confirms the column, and the reason 581 gave
-- for it — "the search vector must be the same size as the one used for
-- indexing" — is the same rule the api states by making it required.

BEGIN;

-- ── §1 the vocabularies, from the api rather than from an expression ─────
CREATE OR REPLACE FUNCTION public.vector_distance_functions()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  -- one of COSINE_SIMILARITY, DOT_PRODUCT, EUCLIDEAN_DISTANCE
  SELECT ARRAY['cosine_similarity','dot_product','euclidean_distance']
$fn$;
COMMENT ON FUNCTION public.vector_distance_functions() IS
  'The three similarity functions a vector property may support, from the api''s VectorSimilarityFunction enum. 581 carried four, taking cosine_distance from a Pipeline Builder expression — that was flagged inference and it was wrong.';

CREATE OR REPLACE FUNCTION public.vector_embedding_models()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['openai_text_embedding_ada_002','text_embedding_3_large',
               'text_embedding_3_small','snowflake_arctic_embed_m',
               'instructor_large','bge_base_en_v1_5']
$fn$;
COMMENT ON FUNCTION public.vector_embedding_models() IS
  'The six Language Model Service embedding models a vector property may name. The other arm of the union is a Foundry live deployment, which names a RID and its input and output parameters instead.';

-- ── §2 supportsSearchWith is a list, and each entry is an index ──────────
CREATE TABLE public.object_type_vector_searches (
  property_id uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  similarity_function text NOT NULL
    CHECK (similarity_function = ANY (public.vector_distance_functions())),
  PRIMARY KEY (property_id, similarity_function)
);
COMMENT ON TABLE public.object_type_vector_searches IS
  'Which similarity functions a vector property supports. A list, not a choice: "Will result in an index specific for the function", so each row is an index the property pays for.';

CREATE OR REPLACE FUNCTION public.guard_vector_search()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE bt text;
BEGIN
  SELECT base_type INTO bt FROM public.object_type_properties WHERE id = NEW.property_id;
  IF bt IS DISTINCT FROM 'vector' THEN
    RAISE EXCEPTION 'Ontology:SearchFunctionOnNonVector — only a vector property supports a similarity function';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER vector_search_belongs_to_a_vector
  BEFORE INSERT OR UPDATE ON public.object_type_vector_searches
  FOR EACH ROW EXECUTE FUNCTION public.guard_vector_search();

ALTER TABLE public.object_type_vector_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read vector searches in scope" ON public.object_type_vector_searches
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = object_type_vector_searches.property_id
       AND (select public.auth_in_ontology(t.ontology_id))));
CREATE POLICY "admins author vector searches" ON public.object_type_vector_searches
  FOR ALL USING ((select public.auth_role()) = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = object_type_vector_searches.property_id
       AND (select public.auth_member_of_ontology(t.ontology_id))))
  WITH CHECK ((select public.auth_role()) = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_vector_searches TO authenticated;

-- ── §3 the embedding model, the half 581 did not have ───────────────────
ALTER TABLE public.object_type_properties
  ADD COLUMN vector_embedding_kind text
    CHECK (vector_embedding_kind IS NULL
           OR vector_embedding_kind IN ('lms', 'foundry_live_deployment')),
  ADD COLUMN vector_embedding_model text,
  ADD COLUMN vector_deployment_rid text,
  ADD COLUMN vector_deployment_input_param text,
  ADD COLUMN vector_deployment_output_param text;

ALTER TABLE public.object_type_properties
  -- Only a vector names a model at all.
  ADD CONSTRAINT vector_embedding_only_on_vector CHECK (
    base_type = 'vector' OR vector_embedding_kind IS NULL),
  -- The union: one arm's fields, never the other's.
  ADD CONSTRAINT vector_embedding_arms CHECK (
    (vector_embedding_kind IS NULL
       AND vector_embedding_model IS NULL AND vector_deployment_rid IS NULL)
    OR (vector_embedding_kind = 'lms'
       AND vector_embedding_model = ANY (public.vector_embedding_models())
       AND vector_deployment_rid IS NULL
       AND vector_deployment_input_param IS NULL
       AND vector_deployment_output_param IS NULL)
    OR (vector_embedding_kind = 'foundry_live_deployment'
       AND vector_embedding_model IS NULL
       AND vector_deployment_rid IS NOT NULL));

COMMENT ON COLUMN public.object_type_properties.vector_embedding_kind IS
  'Which arm of the embeddingModel union: a Language Model Service model, or a Foundry live deployment. Null when the property does not record what produced its vectors — the api leaves embeddingModel optional.';
COMMENT ON COLUMN public.object_type_properties.vector_deployment_rid IS
  'ri.foundry-ml-live.main.live-deployment.<uuid>, with the input and output parameter names beside it — the query string goes into one and the vector comes out of the other.';

-- 581's single-function column is superseded by the list. Kept nullable and
-- unused rather than dropped: nothing has written one (zero vector properties
-- exist), but dropping a column another migration created is not something to
-- do casually while its assertions still reference it.
COMMENT ON COLUMN public.object_type_properties.vector_distance_function IS
  'SUPERSEDED by object_type_vector_searches (583). The api makes supportsSearchWith a LIST, because each supported function is its own index; a single column could not say so.';

-- ── §4 the query asks for a function the property actually supports ─────
CREATE OR REPLACE FUNCTION public.object_type_nearest(
  p_object_type uuid, p_property text, p_query real[], p_k integer,
  p_function text DEFAULT 'cosine_similarity')
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

  IF p_k IS NULL OR p_k <= 0 OR p_k > 100 THEN
    RAISE EXCEPTION 'Ontology:KValueOutOfRange — k must satisfy 0 < k <= 100, got %', p_k;
  END IF;

  IF coalesce(cardinality(p_query), 0) <> prop.vector_dimension THEN
    RAISE EXCEPTION 'Ontology:VectorDimensionMismatch — this property indexes % dimensions, the query has %',
      prop.vector_dimension, coalesce(cardinality(p_query), 0);
  END IF;

  -- New in 583: "Will result in an index specific for the function", so asking
  -- for one the property does not support is asking for an index that does not
  -- exist.
  IF NOT EXISTS (SELECT 1 FROM public.object_type_vector_searches v
                  WHERE v.property_id = prop.id AND v.similarity_function = p_function) THEN
    RAISE EXCEPTION 'Ontology:SimilarityFunctionNotSupported — % does not support %', p_property, p_function
      USING HINT = 'Each supported function is a separate index; add it to the property first.';
  END IF;

  SELECT * INTO idx FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  IF idx.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotIndexed — KNN is only supported on an indexed object type';
  END IF;

  tbl := public.object_table_name(p_object_type);
  op := public.vector_distance_operator(p_function);

  RETURN QUERY EXECUTE format(
    'SELECT %I::text, (%I %s $1::vector)::double precision AS d
       FROM objects.%I WHERE %I IS NOT NULL ORDER BY d LIMIT $2',
    public.object_primary_key_column(p_object_type), prop.backing_column, op,
    tbl, prop.backing_column)
  USING p_query, p_k;
END $fn$;

-- ── assertions ───────────────────────────────────────────────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ot uuid; media uuid; n int; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe583') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe583') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe583', 'Probe583') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe583', 'Probe583', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Doc', 'Doc') RETURNING id INTO ot;

    -- Three, and cosine_distance is gone.
    IF cardinality(public.vector_distance_functions()) <> 3 THEN
      RAISE EXCEPTION 'expected three similarity functions, found %',
        cardinality(public.vector_distance_functions());
    END IF;
    IF 'cosine_distance' = ANY (public.vector_distance_functions()) THEN
      RAISE EXCEPTION 'cosine_distance survived, and the api does not publish it';
    END IF;
    IF cardinality(public.vector_embedding_models()) <> 6 THEN
      RAISE EXCEPTION 'expected six LMS embedding models'; END IF;

    -- A vector property naming an LMS model.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column,
       vector_dimension, vector_distance_function, vector_embedding_kind,
       vector_embedding_model, searchable, sortable, selectable)
      VALUES (ot, 'embedding', 'embedding', 'Embedding', 'vector', 'embedding',
              1536, 'cosine_similarity', 'lms', 'openai_text_embedding_ada_002',
              false, false, false)
      RETURNING id INTO media;

    -- The union holds: an LMS property may not also name a deployment.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties
         SET vector_deployment_rid = 'ri.foundry-ml-live.main.live-deployment.x'
       WHERE id = media;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an LMS model also named a live deployment'; END IF;

    -- And an unpublished model is refused.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties SET vector_embedding_model = 'gpt-9'
       WHERE id = media;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an unpublished embedding model was accepted'; END IF;

    -- supportsSearchWith is a LIST: two functions, two indexes.
    INSERT INTO public.object_type_vector_searches (property_id, similarity_function)
      VALUES (media, 'cosine_similarity'), (media, 'euclidean_distance');
    SELECT count(*) INTO n FROM public.object_type_vector_searches WHERE property_id = media;
    IF n <> 2 THEN RAISE EXCEPTION 'a property could not support two functions'; END IF;

    ok := false;
    BEGIN
      INSERT INTO public.object_type_vector_searches (property_id, similarity_function)
        VALUES (media, 'cosine_distance');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'cosine_distance was accepted as a search function'; END IF;

    -- The query refuses a function the property does not support.
    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding',
        array_fill(0::real, ARRAY[1536]), 5, 'dot_product');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%SimilarityFunctionNotSupported%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an unsupported similarity function was queried'; END IF;

    -- A supported one gets past that check and fails on indexing instead,
    -- which proves the order of the gates.
    ok := false;
    BEGIN
      PERFORM public.object_type_nearest(ot, 'embedding',
        array_fill(0::real, ARRAY[1536]), 5, 'cosine_similarity');
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ObjectTypeNotIndexed%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a supported function did not reach the index check'; END IF;

    -- A search function may not attach to a non-vector property.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'title', 'title', 'Title', 'string', 'title');
    ok := false;
    BEGIN
      INSERT INTO public.object_type_vector_searches (property_id, similarity_function)
        SELECT id, 'cosine_similarity' FROM public.object_type_properties
         WHERE object_type_id = ot AND property_id = 'title';
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%SearchFunctionOnNonVector%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a string property supported a similarity function'; END IF;

    RAISE EXCEPTION 'probe583:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe583:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe583';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '583: the api falsified the vector property';
END $do$;

COMMIT;
