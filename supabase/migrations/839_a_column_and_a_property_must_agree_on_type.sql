-- A column and a property must agree on type.
--
-- Item 42 of the parity queue, folded with item 48 — the same capability filed
-- once under Datasources and once under Indexing.
--
--   "OSv2 enforces data type coherence between datasource schema and object type schema on every sync. Incompatible data types for a property will cause the build to fail."
--   — object-indexing/data-restrictions.md
--
-- We already check that a backing column EXISTS in the schema; we never checked
-- that its type can become the property's. So a property could name a real
-- column of an incompatible type and nothing said so until the index build
-- produced whatever the cast produced.
--
-- THE RULE IS PUBLISHED. THE MAPPING IS NOT — and that distinction decides the
-- whole shape of this migration. I searched the mirror for column-to-base-type
-- statements and found exactly two: an attachment's column "must be a **String**"
-- (an **Array** when Allow multiple), and a geopoint is "stored as a
-- comma-separated string". There is no published table of which of the fifteen
-- dataset field types may back which of the twenty-two base types. Writing one
-- would be inventing structure, which is the mistake this repository exists to
-- avoid.
--
-- SO THE MAPPING IS DERIVED FROM OUR OWN BUILD, not from a table I made up.
-- `dataset_field_sql_type(field)` is what the dataset materialises a column as;
-- `property_column_type(base_type)` is what `index_object_type` declares the
-- property's column as. Coherence is whether the first can become the second,
-- which Postgres's own `pg_cast` answers. That is not a second opinion about
-- Foundry's rule — it is precisely the question the page says the BUILD asks,
-- asked of the same two functions the build uses.
--
-- IMPLICIT AND ASSIGNMENT CASTS ONLY. An explicit cast is the `::` a programmer
-- writes, and text-to-integer is one: it would let a STRING column back an
-- Integer property and fail per value at index time instead of per type at bind
-- time. The page puts the failure at the type, so the predicate does too.
--
-- IT FAILS OPEN, DELIBERATELY. Where either side does not resolve to a
-- Postgres type the answer is `true`, not `false`. A lint that cannot judge must
-- not accuse: CLAUDE.md's rule is not to be stricter than Foundry, and an
-- unjudgeable pair is not a published violation.
--
-- AND IT GOES ON THE LINT RUNG, NOT IN A CONSTRAINT. The dataset's schema can
-- change after the property was bound, with nobody editing the ontology — which
-- is `ontology_violations()`'s stated job, beside the column-PRESENCE arm that
-- already has exactly this shape for exactly this reason.
--
-- BUILDING IT FOUND AN INCOHERENCE IN OUR OWN MAP, which is the argument for
-- building it. `property_column_type` sends `attachment` through its ELSE branch
-- to `jsonb`, and `text` is not assignable to `jsonb`, so the very first thing
-- this predicate would have done is accuse every attachment property of a
-- violation. The published rule is the opposite:
--
--   "The corresponding column in the object-backing dataset must be a **String** and the edited object property must be of type **Attachment**."
--   — action-types/upload-attachments.md
--
-- An attachment property holds the attachment's rid, which is a string, so
-- `text` is the faithful column type. Corrected here rather than exempted,
-- because an exemption would preserve the wrong shape. Safe to correct: zero
-- properties of base type `attachment` exist, so no index table changes.

create or replace function public.property_column_type(p_base_type text)
returns text language sql immutable as $$
  SELECT CASE p_base_type
    WHEN 'string'    THEN 'text'
    WHEN 'boolean'   THEN 'boolean'
    WHEN 'byte'      THEN 'smallint'
    WHEN 'short'     THEN 'smallint'
    WHEN 'integer'   THEN 'integer'
    WHEN 'long'      THEN 'bigint'
    WHEN 'float'     THEN 'real'
    WHEN 'double'    THEN 'double precision'
    WHEN 'decimal'   THEN 'numeric'
    WHEN 'date'      THEN 'date'
    WHEN 'timestamp' THEN 'timestamptz'
    -- "The contents of a geopoint property should be a string"; a geoshape is
    -- "a GeoJSON Geometry string". Both were jsonb until 632.
    WHEN 'geopoint'  THEN 'text'
    WHEN 'geoshape'  THEN 'text'
    WHEN 'time_series' THEN 'text'
    WHEN 'geotemporal_series' THEN 'jsonb'
    -- An attachment property holds the attachment's rid, and its backing column
    -- "must be a String" (839). It reached jsonb through the ELSE until now.
    WHEN 'attachment' THEN 'text'
    ELSE 'jsonb'
  END
$$;

-- Whether a dataset column can become this property's column.
create or replace function public.property_column_coherent(p_base_type text, p_field jsonb)
returns boolean language sql stable
set search_path to 'public', 'pg_temp' as $$
  WITH t AS (
    SELECT to_regtype(public.dataset_field_sql_type(p_field)) AS src,
           to_regtype(public.property_column_type(p_base_type)) AS tgt
  )
  SELECT
    -- Cannot judge, so does not accuse.
    t.src IS NULL OR t.tgt IS NULL
    OR t.src = t.tgt
    OR EXISTS (SELECT 1 FROM pg_cast c
                WHERE c.castsource = t.src AND c.casttarget = t.tgt
                  AND c.castcontext IN ('i', 'a'))
    FROM t
$$;

comment on function public.property_column_coherent(text, jsonb) is
  'Whether a dataset column''s type can become a property''s. OSv2 enforces data type coherence between datasource schema and object type schema on every sync (object-indexing/data-restrictions). The mapping is not published, so it is derived from the two functions the index build itself uses — dataset_field_sql_type and property_column_type — and decided by pg_cast at implicit or assignment context. It answers true when either side does not resolve, because a lint that cannot judge must not accuse.';

-- The arm, spliced in beside the column-PRESENCE arm it complements. The anchor
-- is kept whole inside the replacement rather than retyped away from it.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.ontology_violations_core()'::regprocedure);
  IF src LIKE '%property_column_coherent%' THEN
    RAISE EXCEPTION 'PATCH FAILED: the coherence arm is already present';
  END IF;

  out := replace(src,
    '     AND NOT EXISTS (' || E'\n' ||
    '       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f' || E'\n' ||
    '        WHERE f ->> ''name'' = pr.backing_column)',
    '     AND NOT EXISTS (' || E'\n' ||
    '       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f' || E'\n' ||
    '        WHERE f ->> ''name'' = pr.backing_column)' || E'\n' || E'\n' ||
    '  UNION ALL' || E'\n' || E'\n' ||
    '  -- "OSv2 enforces data type coherence between datasource schema and object' || E'\n' ||
    '  -- type schema on every sync." The column is present; its type cannot' || E'\n' ||
    '  -- become the property''s (839).' || E'\n' ||
    '  SELECT t.api_name, ''property'', pr.property_id,' || E'\n' ||
    '         format(''Backing column "%s" is %s, which cannot become %s for a %s property'',' || E'\n' ||
    '                pr.backing_column, f ->> ''type'',' || E'\n' ||
    '                public.property_column_type(pr.base_type), pr.base_type)' || E'\n' ||
    '    FROM public.object_type_properties pr' || E'\n' ||
    '    JOIN public.object_types t ON t.id = pr.object_type_id' || E'\n' ||
    '    JOIN public.object_type_datasources ds ON ds.id = pr.datasource_id' || E'\n' ||
    '   CROSS JOIN LATERAL jsonb_array_elements(' || E'\n' ||
    '     coalesce(public.dataset_branch_schema(ds.branch_id), ''[]''::jsonb)) f' || E'\n' ||
    '   WHERE pr.source = ''column''' || E'\n' ||
    '     AND f ->> ''name'' = pr.backing_column' || E'\n' ||
    '     AND NOT public.property_column_coherent(pr.base_type, f)');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the presence-arm anchor did not match'; END IF;
  EXECUTE out;

  IF pg_get_functiondef('public.ontology_violations_core()'::regprocedure)
     NOT LIKE '%property_column_coherent%' THEN
    RAISE EXCEPTION 'PATCH FAILED: the arm did not land';
  END IF;
  RAISE NOTICE 'PATCHED: the linter asks whether a column can become its property';
END $patch$;

-- PROVED BY DOING, and by EXECUTING the linter rather than checking it exists.
DO $$
DECLARE
  v_ot uuid; v_ds uuid; v_branch uuid; v_txn uuid; v_prop uuid;
  v_n int; v_problem text; v_unwound boolean := false;
BEGIN
  SELECT d.object_type_id, d.id, d.branch_id INTO v_ot, v_ds, v_branch
    FROM public.object_type_datasources d WHERE d.dataset_id IS NOT NULL LIMIT 1;
  IF v_ot IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no dataset-backed datasource'; END IF;

  -- 0. The pairs the platform already holds are coherent — this must not start
  --    accusing what has been building fine.
  SELECT count(*) INTO v_n FROM public.ontology_violations_core()
   WHERE problem LIKE '%cannot become%';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % existing propert(ies) accused on day one', v_n;
  END IF;
  RAISE NOTICE 'PROVED: no existing property is accused';

  -- 1. The predicate itself, on pairs whose answer the pages give.
  IF NOT public.property_column_coherent('string', '{"type":"STRING"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: STRING cannot back a string property';
  END IF;
  IF NOT public.property_column_coherent('attachment', '{"type":"STRING"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: an attachment column must be a String and is refused';
  END IF;
  IF NOT public.property_column_coherent('geopoint', '{"type":"STRING"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: a geopoint is stored as a string and is refused';
  END IF;
  IF NOT public.property_column_coherent('double', '{"type":"INTEGER"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: INTEGER widens to double and is refused';
  END IF;
  RAISE NOTICE 'PROVED: the published pairs are coherent, including attachment';

  -- 2. And it refuses the shape the page is about: a column whose type cannot
  --    become the property's without a cast a programmer would have to write.
  IF public.property_column_coherent('integer', '{"type":"STRING"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: a STRING column backs an integer property';
  END IF;
  IF public.property_column_coherent('timestamp', '{"type":"BOOLEAN"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: a BOOLEAN column backs a timestamp property';
  END IF;
  RAISE NOTICE 'PROVED: an incompatible column is refused';

  -- 3. It fails OPEN where it cannot judge.
  IF NOT public.property_column_coherent('string', '{"type":"NOT_A_TYPE"}'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: an unjudgeable field was accused';
  END IF;
  RAISE NOTICE 'PROVED: an unjudgeable pair is not accused';

  -- 4. THE LINTER ACTUALLY REPORTS IT. Bind a real property to a real column of
  --    the wrong type and read the linter's own output.
  BEGIN
    SELECT id INTO v_txn FROM public.dataset_transactions
     WHERE branch_id = v_branch AND status = 'COMMITTED' ORDER BY committed_at DESC LIMIT 1;
    IF v_txn IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no committed transaction'; END IF;

    -- A transaction carries ONE schema, so the fixture appends a field to the
    -- existing row rather than adding a second; the unwind puts it back.
    UPDATE public.dataset_schemas
       SET fields = fields || jsonb_build_array(jsonb_build_object('name','zz839_flag','type','BOOLEAN'))
     WHERE transaction_id = v_txn;

    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column, position)
      VALUES (v_ot, 'zz839_when', 'zz839When', 'Zz839 When', 'timestamp', 'column',
              v_ds, 'zz839_flag', 998)
      RETURNING id INTO v_prop;

    SELECT count(*), max(problem) INTO v_n, v_problem
      FROM public.ontology_violations_core()
     WHERE subject = 'zz839_when' AND problem LIKE '%cannot become%';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'PROOF FAILED: the linter reported % violation(s) for a BOOLEAN column on a timestamp property', v_n;
    END IF;
    RAISE NOTICE 'PROVED: the linter reports it — %', v_problem;

    RAISE EXCEPTION 'ZZ839_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ839_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  SELECT count(*) INTO v_n FROM public.object_type_properties WHERE property_id = 'zz839_when';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture property survived'; END IF;
  SELECT count(*) INTO v_n FROM public.ontology_violations_core() WHERE problem LIKE '%cannot become%';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % accusation(s) survived the unwind', v_n; END IF;
  RAISE NOTICE 'PROVED: fixture unwound, nothing accused';
END $$;
