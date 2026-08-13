-- The function runtime's client says `client(Aircraft)`, not a uuid — an
-- object type is a value with an api name, which is the whole point of the
-- generated bindings. The exploration readers (475) take ids, so these two
-- resolve the name and delegate; every gate they already carry still holds,
-- including the restricted-view policy (484).
CREATE OR REPLACE FUNCTION public.evaluate_object_set_by_api_name(
  p_ontology uuid, p_api_name text,
  p_filters jsonb DEFAULT '[]'::jsonb, p_limit int DEFAULT 100)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  SELECT id INTO t FROM public.object_types
   WHERE ontology_id = p_ontology AND api_name = p_api_name;
  IF t IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_api_name;
  END IF;
  RETURN QUERY SELECT * FROM public.evaluate_object_set(t, p_filters, '[]'::jsonb, p_limit, 0);
END $$;

CREATE OR REPLACE FUNCTION public.count_object_set_by_api_name(
  p_ontology uuid, p_api_name text, p_filters jsonb DEFAULT '[]'::jsonb)
RETURNS bigint LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  SELECT id INTO t FROM public.object_types
   WHERE ontology_id = p_ontology AND api_name = p_api_name;
  IF t IS NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_api_name;
  END IF;
  RETURN public.count_object_set(t, p_filters);
END $$;

COMMENT ON FUNCTION public.evaluate_object_set_by_api_name(uuid, text, jsonb, int) IS
  'The exploration reader addressed the way the generated client addresses it: by api name. Every gate the id form carries still applies.';
