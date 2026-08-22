-- The Vector base type is offered in the property picker and a property using
-- it cannot be saved. Found by pulling an unread column and following it back
-- to its writer.
--
-- PROVED BY CONTRAST before touching anything. Two calls to
-- `apply_object_type`, identical but for one property:
--
--   a string primary key alone            SUCCEEDED
--   the same, plus one vector property     violates vector_declares_its_dimension
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- `apply_object_type` writes properties with an EXPLICIT column list, and three
-- vector-relevant columns are not in it:
--
--   `vector_dimension` — required by `vector_declares_its_dimension`, which is
--   an equality: a vector has one and nothing else does. Never inserted, so a
--   vector property fails on the way in. This is the one the probe hit.
--
--   `searchable`, `sortable`, `selectable` — DEFAULT true, while
--   `vector_takes_no_query_hints` requires all three false for a vector. Even
--   with a dimension the insert would have failed on the next constraint.
--
-- So the base type has been unusable since 408 put it in the vocabulary, and
-- nothing noticed because nothing tried: `PROPERTY_TYPES` offers Vector with
-- help text, and no test creates one.
--
-- ── WHY THE FLAGS ARE FORCED RATHER THAN PASSED ─────────────────────────────
-- The payload could carry the three hints, and then a caller sending
-- `searchable: true` on a vector would get a constraint error instead of a
-- property. The constraint is not a preference — a vector is not a thing you
-- filter or sort by, which is what `vector_takes_no_query_hints` says — so the
-- writer settles it rather than asking. Non-vector properties keep the
-- defaults they have always had, because the payload has never carried these
-- and inventing three new payload keys is a wider change than the bug.
--
-- ── HOW IT WAS FOUND, because the route matters more than the fix ───────────
-- The unread-column sweep listed `vector_embedding_kind` and its four siblings
-- as reachable from no screen. Building that surface meant asking what writes
-- the property row, which meant reading `apply_object_type`'s column list,
-- which is where the absence is visible. **An unread column was a thread to a
-- broken feature, not to a missing panel** — the sweep's own recorded lesson,
-- arriving a second time.

DO $$
DECLARE d text; p text; n int;
BEGIN
  d := pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure);
  IF position('vector_dimension' in d) > 0 THEN
    RAISE NOTICE 'apply_object_type already carries the vector columns';
    RETURN;
  END IF;
  p := d;

  -- (1) the column list
  n := length(p);
  p := replace(p,
    '    derived_aggregation, derived_from_property_id, derived_limit)',
    '    derived_aggregation, derived_from_property_id, derived_limit,' || chr(10) ||
    '    vector_dimension, searchable, sortable, selectable)');
  IF length(p) = n THEN RAISE EXCEPTION '635: the property column list is not where it was'; END IF;

  -- (2) the values
  n := length(p);
  p := replace(p,
    '    nullif(e->>''derived_limit'', '''')::integer' || chr(10) ||
    '  FROM jsonb_array_elements(p_properties) WITH ORDINALITY AS a(e, ord)',
    '    nullif(e->>''derived_limit'', '''')::integer,' || chr(10) ||
    '    nullif(e->>''vector_dimension'', '''')::integer,' || chr(10) ||
    '    -- "vector_takes_no_query_hints": a vector is not filtered, sorted or' || chr(10) ||
    '    -- selected on, so the writer settles the three rather than asking.' || chr(10) ||
    '    (e->>''base_type'') IS DISTINCT FROM ''vector'',' || chr(10) ||
    '    (e->>''base_type'') IS DISTINCT FROM ''vector'',' || chr(10) ||
    '    (e->>''base_type'') IS DISTINCT FROM ''vector''' || chr(10) ||
    '  FROM jsonb_array_elements(p_properties) WITH ORDINALITY AS a(e, ord)');
  IF length(p) = n THEN RAISE EXCEPTION '635: the property value list is not where it was'; END IF;

  -- (3) and the upsert, so an edit keeps them in step
  n := length(p);
  p := replace(p,
    '    derived_limit            = EXCLUDED.derived_limit;',
    '    derived_limit            = EXCLUDED.derived_limit,' || chr(10) ||
    '    vector_dimension         = EXCLUDED.vector_dimension,' || chr(10) ||
    '    searchable               = EXCLUDED.searchable,' || chr(10) ||
    '    sortable                 = EXCLUDED.sortable,' || chr(10) ||
    '    selectable               = EXCLUDED.selectable;');
  IF length(p) = n THEN RAISE EXCEPTION '635: the upsert SET list is not where it was'; END IF;

  EXECUTE p;
  RAISE NOTICE 'apply_object_type now carries a vector property''s dimension and clears its query hints';
END $$;

-- The same contrast the bug was found by, now the other way round, plus the
-- second constraint the first one was hiding.
DO $$
DECLARE v_ont uuid; v_err text; v_dim int; v_search boolean;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'no ontology: 635 cannot prove its own fix';
    END IF;

    -- (1) a vector property saves at all, which it could not before
    PERFORM public.apply_object_type(
      jsonb_build_object('ontology_id', v_ont, 'api_name', 'Vec635', 'label', 'Vec 635'),
      jsonb_build_array(
        jsonb_build_object('property_id','id','display_name','Id','api_name','id',
          'base_type','string','is_primary_key',true,'required',true,
          'source','column','backing_column','id'),
        jsonb_build_object('property_id','emb','display_name','Embedding','api_name','emb',
          'base_type','vector','vector_dimension',1536,
          'source','column','backing_column','emb')),
      '[]'::jsonb);

    SELECT vector_dimension, searchable INTO v_dim, v_search
      FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE t.api_name = 'Vec635' AND p.property_id = 'emb';
    IF v_dim <> 1536 THEN
      RAISE EXCEPTION 'the dimension did not survive the save (% found)', coalesce(v_dim, -1);
    END IF;
    -- the second constraint, which the first was hiding
    IF v_search THEN
      RAISE EXCEPTION 'a vector property came back searchable';
    END IF;

    -- (2) a vector WITHOUT a dimension is still refused, so the fix did not
    -- become a way round the constraint
    v_err := NULL;
    BEGIN
      PERFORM public.apply_object_type(
        jsonb_build_object('ontology_id', v_ont, 'api_name', 'Vec635b', 'label', 'Vec 635b'),
        jsonb_build_array(
          jsonb_build_object('property_id','id','display_name','Id','api_name','id',
            'base_type','string','is_primary_key',true,'required',true,
            'source','column','backing_column','id'),
          jsonb_build_object('property_id','emb','display_name','Embedding','api_name','emb',
            'base_type','vector','source','column','backing_column','emb')),
        '[]'::jsonb);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    IF v_err IS NULL OR v_err NOT LIKE '%vector_declares_its_dimension%' THEN
      RAISE EXCEPTION 'a dimensionless vector was accepted (%)', coalesce(v_err, 'no error');
    END IF;

    -- (3) and a NON-vector property keeps the query hints it has always had
    PERFORM public.apply_object_type(
      jsonb_build_object('ontology_id', v_ont, 'api_name', 'Vec635c', 'label', 'Vec 635c'),
      jsonb_build_array(jsonb_build_object('property_id','id','display_name','Id',
        'api_name','id','base_type','string','is_primary_key',true,'required',true,
        'source','column','backing_column','id')),
      '[]'::jsonb);
    SELECT searchable INTO v_search FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE t.api_name = 'Vec635c' AND p.property_id = 'id';
    IF NOT v_search THEN
      RAISE EXCEPTION 'a string property lost its searchable default';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '635 proved: a vector saves with its dimension and no query hints, a dimensionless one is still refused, and a string keeps its defaults';
  END;
END $$;
