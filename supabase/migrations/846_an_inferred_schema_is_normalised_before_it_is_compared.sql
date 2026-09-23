-- An inferred schema is normalised before it is compared.
--
-- The second forward correction to 844, and the same root cause as 845 seen
-- from another angle: 844 completed STORED schemas to the published shape and
-- left every COMPUTED one alone, so the two stopped being comparable.
--
-- `upload_file_to_dataset` infers a schema from a CSV header and compares it
-- against the schema already in the view, twice:
--
--     IF existing_fields IS DISTINCT FROM fields THEN
--     IF kind <> 'SNAPSHOT' AND view_fields IS NOT NULL AND view_fields IS DISTINCT FROM fields THEN
--
-- After 844 the stored side carries `nullable` and the inferred side does not,
-- so re-uploading a file with an IDENTICAL schema raised
-- `Datasets:UploadSchemaDiffers`. The platform suite caught it on the run after
-- the apply, in the `ingestion.test.ts` case that re-uploads a filename it has
-- seen with the same schema — which is the case the refusal exists to let
-- through.
--
-- ONE RULE, IN ONE PLACE. 844's trigger looped the normaliser inline over the
-- field array; that loop is now `dataset_schema_normalised`, and both the
-- trigger and the upload path call it. A second copy of a normalisation rule is
-- how the two sides drift apart again, which is the defect this migration is.
--
-- The lesson worth keeping: a normalising write path changes what EQUALITY
-- means. Every comparison against stored data has to normalise the other side,
-- and the two sites here were the only ones — `evaluate_health_check` compares
-- field NAMES and is unaffected, checked rather than assumed.

CREATE OR REPLACE FUNCTION public.dataset_schema_normalised(p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE out jsonb; f jsonb;
BEGIN
  IF jsonb_typeof(p_fields) <> 'array' THEN RETURN p_fields; END IF;
  out := '[]'::jsonb;
  FOR f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    out := out || jsonb_build_array(public.dataset_field_normalised(f));
  END LOOP;
  RETURN out;
END $fn$;

COMMENT ON FUNCTION public.dataset_schema_normalised(jsonb) IS
  'A whole field list completed to the published shape. The one rule: the write trigger and every comparison against stored schemas call this, because a normalising write path changes what equality means.';

GRANT EXECUTE ON FUNCTION public.dataset_schema_normalised(jsonb) TO authenticated, service_role;

-- The trigger stops carrying its own copy of the loop.
CREATE OR REPLACE FUNCTION public.normalise_dataset_schema()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  NEW.fields := public.dataset_schema_normalised(NEW.fields);
  -- CSV parser options are the CSV reader's (845). Stamped only over the
  -- DEFAULT, so a caller that names a reader is checked rather than contradicted.
  IF NEW.parser_params IS NOT NULL AND NEW.dataframe_reader = 'PARQUET' THEN
    NEW.dataframe_reader := 'CSV';
  END IF;
  RETURN NEW;
END $fn$;

-- ── the upload path compares like with like ────────────────────────────────
-- Patched from the live definition, line endings normalised first because
-- pg_get_functiondef output is not uniformly newline-delimited here.
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'upload_file_to_dataset';
  IF src IS NULL THEN RAISE EXCEPTION 'PATCH FAILED: upload_file_to_dataset is not there'; END IF;
  src := replace(src, E'\r\n', E'\n');

  -- Normalised at the moment it becomes a schema, so both comparisons below it
  -- and the INSERT under it all see the same document.
  out := replace(src,
$old$  IF public.dataset_schema_valid(fields) IS NOT TRUE THEN
$old$,
$new$  -- 844 completes a STORED schema to the published shape, so an inferred one
  -- must be completed too or it can never compare equal to what is already in
  -- the view. Same rule, one function.
  fields := public.dataset_schema_normalised(fields);
  IF public.dataset_schema_valid(fields) IS NOT TRUE THEN
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the inference block did not match'; END IF;
  EXECUTE out;
END $patch$;

-- PROVED BY DOING: the exact case that broke — the same file, the same schema,
-- uploaded twice.
DO $proof$
DECLARE
  v_org uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_user uuid;
  v_n int; v_unwound boolean := false; v_csv text;
BEGIN
  -- The normaliser is idempotent, which is what makes it safe to apply to both
  -- sides of a comparison.
  IF public.dataset_schema_normalised(public.dataset_schema_normalised(
       '[{"name":"a","type":"STRING"}]'::jsonb))
     <> public.dataset_schema_normalised('[{"name":"a","type":"STRING"}]'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: the normaliser is not idempotent';
  END IF;
  RAISE NOTICE 'PROVED: normalising twice is normalising once';

  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz846') RETURNING id INTO v_org;
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz846', 'zz846') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz846_ds', 'zz846_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz846@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz846@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    v_csv := 'name,seats' || E'\n' || 'ATR,48' || E'\n' || 'Dash,72';
    PERFORM public.upload_file_to_dataset(v_ds, 'craft.csv', v_csv, 'master', NULL, NULL);
    -- The same file, the same schema, a second time. This is the case the
    -- refusal is meant to let through, and the one 844 broke.
    PERFORM public.upload_file_to_dataset(v_ds, 'craft.csv', v_csv, 'master', NULL, NULL);
    RAISE NOTICE 'PROVED: re-uploading a file with the same schema is allowed again';

    -- And the refusal still fires when the schema really does differ.
    BEGIN
      PERFORM public.upload_file_to_dataset(
        v_ds, 'craft.csv', 'name,seats,range' || E'\n' || 'ATR,48,900', 'master', NULL, NULL);
      RAISE EXCEPTION 'PROOF FAILED: a genuinely different schema was accepted';
    EXCEPTION WHEN others THEN
      IF SQLERRM NOT LIKE '%UploadSchemaDiffers%' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'PROVED: a genuinely different schema is still refused';

    -- And what landed carries the published shape.
    SELECT count(*) INTO v_n FROM public.dataset_schemas s, jsonb_array_elements(s.fields) fl
     WHERE s.dataset_id = v_ds AND NOT (fl ? 'nullable');
    IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % uploaded field(s) lack nullable', v_n; END IF;
    RAISE NOTICE 'PROVED: an uploaded schema is stored in the published shape';

    RAISE EXCEPTION 'ZZ846_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ846_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz846';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
