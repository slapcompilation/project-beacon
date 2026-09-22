-- OSv2 refuses these values at index time, and the job reports which one.
--
-- `object-indexing/data-restrictions.md` is 45 lines and almost all of it is
-- unbuilt. 839 built the type-coherence bullet; 840 built the primary-key
-- paragraph. This builds the value restrictions, which are the page's longest
-- list and the part nothing here has ever asked.
--
--   "Object Storage v2 (OSv2) enforces data restrictions to ensure the quality of data going into the ontology, provide more deterministic behavior, and increase legibility across the platform. These restrictions are validated during indexing."
--   — object-indexing/data-restrictions.md
--
-- THE OUTCOME DIFFERS BY DATASOURCE KIND, and only one of the two has a subject
-- here:
--
--   "For object types backed by batch datasources, violations will cause indexing jobs to fail. For object types backed by streaming datasources, records that violate these restrictions are dropped."
--   — object-indexing/data-restrictions.md
--
-- Every datasource we can back an object type with is a batch one — 835
-- recorded streams as published and unrepresentable — so the failing arm is the
-- whole of what is buildable, and the dropping arm belongs to whoever builds
-- streams. Said here so it is not read as an omission.
--
-- WHAT IS BUILT, each with the sentence that decides it:
--
--   "OSv2 does not allow `NaN` or `±infinity` as property values."
--   "Empty strings are not allowed in OSv2; in OSv1, empty strings were silently converted to nulls."
--   "OSv2 does not allow properties with nested arrays."
--   "OSv2 does not allow properties with array data types to have null elements within the array."
--   — object-indexing/data-restrictions.md
--
-- and the two published size limits, which the page prints as a table:
--
--   "Properties exceeding these limits will cause indexing jobs to fail."
--   — object-indexing/data-restrictions.md
--
-- String properties 12 MB, Array properties 100,000 elements. **12 MB is read
-- as binary**, 12 * 1024 * 1024, because that is the more permissive of the two
-- readings and this repo's rule is not to be stricter than Foundry where the
-- page is silent.
--
-- WHAT IS ALREADY THERE, confirmed by asking rather than assumed — and worth
-- recording, because a reconciliation that only reports faults teaches nothing
-- about which decisions were sound:
--
--   * "`Lat, Long` should be a comma-separated string with no parentheses" —
--     `geopoint_valid` already refuses parentheses by construction (its regex
--     admits only digits, sign, point, spaces and one comma) and bounds the
--     pair to WGS 84. Nothing to build.
--   * The five types that cannot be primary keys — `primary_key_eligibility`
--     answers `no` for every one and for nothing it should allow (checked when
--     839 landed).
--   * "enforces data type coherence between datasource schema and object type
--     schema on every sync" — `property_column_coherent`, 839.
--   * A NESTED ARRAY CANNOT BE DECLARED: `array_not_nested` already refuses
--     `array_element_type = 'array'`. So the value-level check below is the
--     other half — a jsonb column whose *data* nests, which the declaration
--     cannot reach.
--
-- WHAT IS DELIBERATELY NOT BUILT:
--
--   * The base-type-change migration refusal ("A property could not be cast to
--     the new type"). It belongs with schema migrations, which are their own
--     page and their own unbuilt mechanism, and a refusal with no migration
--     path to refuse is a guard with no subject.
--   * "stricter validations on geopoint properties" — unquantified. There is
--     nothing to build from a sentence that names no rule.
--   * The `Not`-condition support in restricted view granular policies. It is a
--     policy capability, not a value restriction, and it is listed here only
--     because OSv2 is what enables it.
--   * ELEMENT-LEVEL restrictions inside an array. The page states the empty
--     string and NaN rules of PROPERTIES; it does not say an array's elements
--     are checked the same way, and inventing that would be stricter than the
--     page. Recorded as an open question, not answered by guessing.
--
-- WHERE THE RULE GOES, and why it stops one rung up. A CHECK on the index
-- table could hold "this value is legal" — it is a fact about one row. It
-- cannot hold the other half of the published requirement, which is that the
-- job says WHICH rule was broken: "indexing jobs will not succeed and will
-- report the underlying problem in the pipeline graph" (object-indexing/faq).
-- A constraint violation names a generated constraint. So this lands as a
-- validation pass in the indexer, the fifth beside value types, mandatory
-- controls and required properties, and it reads the same way they do.

-- ── the predicate ──────────────────────────────────────────────────────────
-- Null in, null out: an absent value is not a malformed one, which is the same
-- stance `geopoint_valid` takes in its first line.
CREATE OR REPLACE FUNCTION public.osv2_value_problem(
  p_base_type text, p_element_type text, p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    -- A real number that arrived as NaN or an infinity reaches jsonb as the
    -- STRING "NaN" / "Infinity" / "-Infinity", because JSON has no spelling for
    -- them. That is what the indexer's jsonb_build_object hands us, so that is
    -- what is asked for here.
    WHEN p_base_type IN ('float', 'double', 'decimal')
         AND (p_value #>> '{}') IN ('NaN', 'Infinity', '-Infinity')
      THEN 'NaN and ±infinity are not allowed as property values'
    WHEN p_base_type = 'string' AND (p_value #>> '{}') = ''
      THEN 'empty strings are not allowed'
    WHEN p_base_type = 'string'
         AND octet_length(p_value #>> '{}') > 12 * 1024 * 1024
      THEN 'a string property is limited to 12 MB'
    WHEN p_base_type = 'array' AND jsonb_typeof(p_value) = 'array' THEN
      CASE
        WHEN jsonb_array_length(p_value) > 100000
          THEN 'an array property is limited to 100,000 elements'
        WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p_value) e
                      WHERE jsonb_typeof(e) = 'array')
          THEN 'nested arrays are not allowed'
        WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p_value) e
                      WHERE jsonb_typeof(e) = 'null')
          THEN 'an array property may not have null elements'
        ELSE NULL
      END
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.osv2_value_problem(text, text, jsonb) IS
  'Why OSv2 would refuse this value at index time, or null if it would not — NaN and infinities, empty strings, the 12 MB string cap, the 100,000-element array cap, nested arrays and null array elements (object-indexing/data-restrictions).';

GRANT EXECUTE ON FUNCTION public.osv2_value_problem(text, text, jsonb) TO authenticated, service_role;

-- ── the indexer, patched in place ──────────────────────────────────────────
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'index_object_type';
  IF src IS NULL THEN RAISE EXCEPTION 'PATCH FAILED: index_object_type is not there'; END IF;

  out := replace(src,
$old$      -- Mandatory controls enforce at the storage level (727): a value
$old$,
$new$      -- OSv2's own data restrictions, validated during indexing. One SELECT
      -- rather than a loop: the first offending property fails the build, the
      -- way the value-type pass above does.
      SELECT format('property "%s" of object "%s": %s', rp.property_id, staged.pk,
                    public.osv2_value_problem(rp.base_type, rp.array_element_type,
                                              merged.properties -> rp.property_id))
        INTO bad
        FROM public.object_type_properties rp
       WHERE rp.object_type_id = p_object_type
         AND public.osv2_value_problem(rp.base_type, rp.array_element_type,
                                       merged.properties -> rp.property_id) IS NOT NULL
       LIMIT 1;
      IF bad IS NOT NULL THEN
        RAISE EXCEPTION '%', bad;
      END IF;

      -- Mandatory controls enforce at the storage level (727): a value
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the mandatory-controls anchor did not match'; END IF;
  src := out;

  EXECUTE src;
END $patch$;

-- PROVED BY DOING, by behaviour and not by name. Each restriction is given a
-- value that breaks it and the build is asked what it says.
DO $proof$
DECLARE
  v_org uuid; v_space uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_phys text;
  v_ont uuid; v_type uuid; v_otds uuid; v_user uuid; v_txn uuid; v_file uuid;
  v_build uuid; v_state text; v_err text; v_n int; v_problem text;
  v_unwound boolean := false;
BEGIN
  -- 1. The predicate itself, against every arm, before any fixture exists.
  IF public.osv2_value_problem('double', NULL, to_jsonb('NaN'::float8)) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: NaN passed';
  END IF;
  IF public.osv2_value_problem('double', NULL, to_jsonb('Infinity'::float8)) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: infinity passed';
  END IF;
  IF public.osv2_value_problem('double', NULL, to_jsonb('-Infinity'::float8)) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: negative infinity passed';
  END IF;
  IF public.osv2_value_problem('double', NULL, to_jsonb(1.5::float8)) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an ordinary double was refused';
  END IF;
  IF public.osv2_value_problem('string', NULL, '""'::jsonb) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: the empty string passed';
  END IF;
  IF public.osv2_value_problem('string', NULL, '"NaN"'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: a string property spelling "NaN" was refused — the rule is about real numbers';
  END IF;
  IF public.osv2_value_problem('array', 'string', '[["a"]]'::jsonb) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: a nested array passed';
  END IF;
  IF public.osv2_value_problem('array', 'string', '["a", null]'::jsonb) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: a null array element passed';
  END IF;
  IF public.osv2_value_problem('array', 'string', '["a", "b"]'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an ordinary array was refused';
  END IF;
  IF public.osv2_value_problem('string', NULL, 'null'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an absent value was called malformed';
  END IF;
  -- The two caps, at the boundary rather than in the middle: 100,000 elements
  -- is legal and 100,001 is not. The 12 MB string cap is asserted by its
  -- arithmetic rather than by allocating 12 MB twice in a migration.
  IF public.osv2_value_problem('array', 'string',
       (SELECT jsonb_agg('x'::text) FROM generate_series(1, 100000))) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: exactly 100,000 elements was refused';
  END IF;
  IF public.osv2_value_problem('array', 'string',
       (SELECT jsonb_agg('x'::text) FROM generate_series(1, 100001))) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: 100,001 elements passed';
  END IF;
  IF public.osv2_value_problem('string', NULL, to_jsonb(repeat('x', 12 * 1024 * 1024))) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: exactly 12 MB was refused';
  END IF;
  IF public.osv2_value_problem('string', NULL, to_jsonb(repeat('x', 12 * 1024 * 1024 + 1))) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: 12 MB plus one byte passed';
  END IF;
  RAISE NOTICE 'PROVED: every arm of the predicate answers, and the boundaries fall where the page puts them';

  -- 2. And the indexer actually asks it, which is the half a predicate nobody
  --    calls always passes.
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz841') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz841') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz841', 'zz841') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz841_ds', 'zz841_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz841@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz841@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_branch, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"pk","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 2) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
     WHERE id = v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    -- One good row and one whose note is the empty string.
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, note) VALUES ($1,''A'',''fine''),($1,''B'','''')', v_phys)
      USING v_file;

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz841', 'Zz841', false) RETURNING id INTO v_ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz841Thing', 'Zz841 thing') RETURNING id INTO v_type;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_type, v_ds, v_branch) RETURNING id INTO v_otds;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required, datasource_id)
    VALUES (v_type, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true, null),
           (v_type, 'note', 'note', 'Note', 'string', 'column', 'note', false, false, false, v_otds);

    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'FAILED' OR v_err NOT LIKE '%empty strings are not allowed%' THEN
      RAISE EXCEPTION 'PROOF FAILED: the empty string did not fail the build — % / %',
        v_state, coalesce(v_err, '(no error)');
    END IF;
    IF v_err NOT LIKE '%property "note" of object "B"%' THEN
      RAISE EXCEPTION 'PROOF FAILED: the job does not say which property of which object — %', v_err;
    END IF;
    RAISE NOTICE 'PROVED: the indexer asks, the build fails, and the job names the property and the object';

    -- 3. Repair the value and the same build completes, so the guard refuses a
    --    value rather than a shape.
    EXECUTE format('UPDATE datasets.%I SET note = ''also fine'' WHERE pk = ''B''', v_phys);
    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'COMPLETED' THEN
      RAISE EXCEPTION 'PROOF FAILED: the repaired build still fails — % / %', v_state, coalesce(v_err, '');
    END IF;
    RAISE NOTICE 'PROVED: the same build completes once the value is legal';

    RAISE EXCEPTION 'ZZ841_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ841_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz841';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
