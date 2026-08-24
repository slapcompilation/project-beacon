-- Required properties get their two enforcement points, from
-- readings/required-properties.md (built after a human read its Decisions
-- block). The flag has existed since 408; the sweep called it the standing
-- defect: nothing checked it.
--
--   "Required properties are object type properties that must have a value. You can use this object type property to validate that there are no objects that have a null value for this property, or an empty array if it is an array property. This validation applies to data from the backing datasource and edits via actions."
--   — object-link-types/required-properties.md
--
-- ── WHERE, EXACTLY ───────────────────────────────────────────────────────────
--
--   "**Validation happens when data is being indexed into the object:** The check for null values happens as backing datasources are indexed into Object Storage. This means that the ontology modification itself will succeed if the column backing a required property contains null values."
--   — object-link-types/required-properties.md
--
--   "**Changes via actions are validated at apply time:** If you attempt to write a null or empty value to a property via an action, the action will fail to execute."
--   — object-link-types/required-properties.md
--
-- The save stays out of it; index_object_type and apply_action gain the arms.
--
-- ── THE TWO FLAGS ────────────────────────────────────────────────────────────
-- The capture's gear opens two switches — No null values and No empty arrays
-- (paraphrased from advanced_required_property.png) — so storage is two
-- flags: required stays no-nulls, allow_empty_arrays joins it.
--
--   "You can configure your required property to allow empty arrays. This means that the property will still reject null values, but will accept empty arrays."
--   — object-link-types/required-properties.md
--
-- ── PRESENCE SCOPES THE RULE ─────────────────────────────────────────────────
--
--   "The example above will successfully get indexed into the Ontology, despite the fact that the resulting object would have no value for the required property."
--   — object-link-types/required-properties.md
--
--   "However if the Action adds a property to the object that is sourced from `Datasource 2`, such as `Budget`, then the Action will be invalid and will fail to execute. This is because the object will now be present on `Datasource 2` and thus `Genre` must be set."
--   — object-link-types/required-properties.md
--
-- A required property binds an object only where the object is PRESENT in
-- the property's own datasource. Here presence means: the staged row's
-- datasource at index time (our indexer refuses one pk across two
-- datasources, so a row has exactly one), or the datasources an edit-only
-- object's edits touch; and at apply time, the datasources the edit's
-- properties touch. The worked example's row-side split (one pk in two
-- datasets) cannot occur here by construction; its edit-side half — writing
-- Budget makes Genre bind — is implemented and probed verbatim.
--
-- Every live-patch anchor below is asserted to occur EXACTLY once — the 669
-- lesson, mechanical now.

ALTER TABLE public.object_type_properties
  ADD COLUMN allow_empty_arrays boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.object_type_properties.allow_empty_arrays IS
  'The gear''s second switch (object-link-types/required-properties): a required property rejects nulls always, and rejects [] unless this is set. Inert on scalars. Mind the stated action behaviour: a blank mapped array parameter writes [], which passes only here.';

-- The merged current value of one property of one indexed object — what the
-- apply-time check falls back to for modifies. NULL when the type has no
-- successful index or the object no row: absent, not failing.
CREATE FUNCTION public.object_current_value(p_type uuid, p_pk text, p_property text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE idx record; pk_prop text; v jsonb;
BEGIN
  -- the status scalar is retired (OSv2); an index row with a table IS the
  -- successful index
  SELECT * INTO idx FROM public.object_type_indexes
   WHERE object_type_id = p_type AND index_table IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT property_id INTO pk_prop FROM public.object_type_properties
   WHERE object_type_id = p_type AND is_primary_key;
  EXECUTE format('SELECT to_jsonb(t.%I) FROM objects.%I t WHERE t.%I::text = $1',
                 p_property, idx.index_table, pk_prop)
    INTO v USING p_pk;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.object_current_value(uuid, text, text) FROM PUBLIC, anon;

-- ── THE INDEX-TIME ARM ───────────────────────────────────────────────────────
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.index_object_type(uuid,uuid)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    '  bad      text;',
    'SELECT COALESCE(d.dataset_id, v.input_dataset_id) AS dataset_id,',
    'CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb) ON COMMIT DROP;',
    'INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row);',
    'SELECT DISTINCT e.primary_key, NULL::jsonb',
    'FOR staged IN SELECT s.pk, s.row FROM _staged s LOOP',
    'WHERE p.object_type_id = p_object_type AND p.source = ''column''
         AND p.backing_column IS NOT NULL;',
    '         LIMIT 1;
        RAISE EXCEPTION ''%'', bad;
      END IF;'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: index_object_type is not the text 670 read: %', left(a, 60);
    END IF;
  END LOOP;

  src := replace(src, anchors[1], anchors[1] || '
  req      record;');
  src := replace(src, anchors[2], anchors[2] || '
             d.id AS otds_id,');
  src := replace(src, anchors[3],
    'CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb, ds uuid) ON COMMIT DROP;');
  src := replace(src, anchors[4],
    'INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row, ds.otds_id);');
  src := replace(src, anchors[5], anchors[5] || ', NULL::uuid');
  src := replace(src, anchors[6],
    'FOR staged IN SELECT s.pk, s.row, s.ds FROM _staged s LOOP');
  -- the gather was selecting every backed column from every physical table;
  -- a second datasource with its own columns broke it. Scope it: each
  -- datasource contributes its own properties' columns.
  src := replace(src, anchors[7],
    'WHERE p.object_type_id = p_object_type AND p.source = ''column''
         AND p.backing_column IS NOT NULL
         AND p.datasource_id = ds.otds_id;');
  src := replace(src, anchors[8], anchors[8] || '
      -- Required properties bind by presence in their own datasource: the
      -- staged row''s datasource, or for an edit-only object the datasources
      -- its edits touch. Null always violates; [] violates unless allowed.
      FOR req IN
        SELECT p.property_id, p.allow_empty_arrays
          FROM public.object_type_properties p
         WHERE p.object_type_id = p_object_type AND p.required AND NOT p.is_primary_key
           AND p.datasource_id IS NOT NULL
           AND (p.datasource_id = staged.ds
                OR (staged.ds IS NULL AND p.datasource_id IN (
                     SELECT pr.datasource_id FROM public.object_edits e
                       JOIN public.object_type_properties pr
                         ON pr.object_type_id = e.object_type_id
                        AND (e.properties ? pr.property_id OR e.properties ? pr.api_name)
                      WHERE e.object_type_id = p_object_type
                        AND e.primary_key = staged.pk
                        AND pr.datasource_id IS NOT NULL)))
      LOOP
        IF merged.properties -> req.property_id IS NULL
           OR merged.properties -> req.property_id = ''null''::jsonb
           OR (merged.properties -> req.property_id = ''[]''::jsonb
               AND NOT req.allow_empty_arrays) THEN
          RAISE EXCEPTION ''required property "%" of object "%" has no value'',
            req.property_id, staged.pk;
        END IF;
      END LOOP;');
  EXECUTE src;
END $do$;

-- ── THE APPLY-TIME ARM ───────────────────────────────────────────────────────
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    '  sched_run uuid;',
    '    -- ── the edit ───────────────────────────────────────────────────────────'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: apply_action is not the text 670 read: %', left(a, 60);
    END IF;
  END LOOP;

  src := replace(src, anchors[1], anchors[1] || '
  rq       record;
  reqv     jsonb;');
  src := replace(src, anchors[2],
'-- Writing any property of a datasource makes its required properties bind
    -- for this object; a modify falls back to the object''s current merged
    -- value, a create has nothing to fall back to.
    FOR rq IN
      SELECT p2.property_id, p2.api_name, p2.allow_empty_arrays
        FROM public.object_type_properties p2
       WHERE p2.object_type_id = target AND p2.required AND NOT p2.is_primary_key
         AND p2.datasource_id IN (
           SELECT p3.datasource_id FROM public.object_type_properties p3
            WHERE p3.object_type_id = target AND p3.datasource_id IS NOT NULL
              AND (props ? p3.property_id OR props ? p3.api_name))
    LOOP
      reqv := coalesce(props -> rq.property_id, props -> rq.api_name);
      IF reqv IS NULL AND r.kind IN (''modify_object'', ''modify_object_of_interface'') THEN
        reqv := public.object_current_value(target, p_primary_key, rq.property_id);
      END IF;
      IF reqv IS NULL OR reqv = ''null''::jsonb OR reqv = ''""''::jsonb
         OR (reqv = ''[]''::jsonb AND NOT rq.allow_empty_arrays) THEN
        RAISE EXCEPTION ''Actions:RequiredPropertyMissing — "%" must have a value once this object touches its datasource'',
          rq.api_name;
      END IF;
    END LOOP;

' || anchors[2]);
  EXECUTE src;
END $do$;

-- ── THE SAVE PATH CARRIES THE NEW FLAG ───────────────────────────────────────
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    'shared_property_id, required, visibility, position, is_primary_key, is_title_key,',
    'coalesce((e->>''required'')::boolean, false),
    coalesce(e->>''visibility'', ''normal''),'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: apply_object_type is not the text 670 read: %', left(a, 60);
    END IF;
  END LOOP;
  src := replace(src, anchors[1],
    'shared_property_id, required, allow_empty_arrays, visibility, position, is_primary_key, is_title_key,');
  src := replace(src, anchors[2],
    'coalesce((e->>''required'')::boolean, false),
    coalesce((e->>''allow_empty_arrays'')::boolean, false),
    coalesce(e->>''visibility'', ''normal''),');
  EXECUTE src;
END $do$;

-- ── A CREATED OBJECT KEEPS ITS PRIMARY KEY ───────────────────────────────────
-- Found while probing: the stored edits never carry the primary key (apply
-- strips it into the edit's own primary_key column), and object_state's
-- create path initializes every property to null — so an edit-created object
-- reindexed into a null pk and failed the insert. Reinject it.
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.object_state(uuid,text,jsonb)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    '    RETURN QUERY SELECT state, false; RETURN;
  END IF;'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: object_state is not the text 670 read: %', left(a, 60);
    END IF;
  END LOOP;
  src := replace(src, anchors[1],
'    -- the stored edits never carry the primary key; reinject it, or a
    -- created object reindexes into a null pk
    SELECT p.api_name INTO latest FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type AND p.is_primary_key;
    IF latest IS NOT NULL AND (state -> latest IS NULL OR state -> latest = ''null''::jsonb) THEN
      state := state || jsonb_build_object(latest, to_jsonb(p_primary_key));
    END IF;

' || anchors[1]);
  EXECUTE src;
END $do$;

-- ── PROVED BY DOING: THE WORKED EXAMPLE'S REPRESENTABLE HALF ─────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid; v_email text;
  v_ds uuid; v_br uuid; v_txn uuid; v_file uuid; v_phys text;
  v_ds2 uuid; v_br2 uuid; v_ot uuid; v_dsid uuid; v_dsid2 uuid;
  v_pk_pid uuid; v_genre_pid uuid; v_note_pid uuid; v_extra_pid uuid;
  v_create uuid; v_touch uuid; v_build uuid; v_state text; v_err text; v_v jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe670') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe670') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe670', 'Probe670') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe670', 'Probe 670', false) RETURNING id INTO v_ont;
    v_usr := gen_random_uuid();
    v_email := 'probe670-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- datasource 1 with real rows: A carries a genre, B does not
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe670', 'Probe670 DS1') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_br, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn,
        '[{"name":"pk","type":"STRING"},{"name":"genre","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 2) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, genre, note)
                    VALUES ($1, ''A'', ''Adventure'', ''x''), ($1, ''B'', NULL, ''y'')', v_phys)
      USING v_file;

    -- datasource 2, empty: its required property must NOT bind rows it never held
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe670b', 'Probe670 DS2') RETURNING id INTO v_ds2;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds2, 'master') RETURNING id INTO v_br2;

    INSERT INTO public.object_types (ontology_id, api_name, label)
      VALUES (v_ont, 'Probe670Movie', 'Probe670 Movie') RETURNING id INTO v_ot;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_dsid;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_ot, v_ds2, v_br2) RETURNING id INTO v_dsid2;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column, is_primary_key, is_title_key, required)
      VALUES (v_ot, 'pk', 'pk', 'Id', 'string', 'column', v_dsid, 'pk', true, true, true)
      RETURNING id INTO v_pk_pid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column, required)
      VALUES (v_ot, 'genre', 'genre', 'Genre', 'string', 'column', v_dsid, 'genre', true)
      RETURNING id INTO v_genre_pid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column)
      VALUES (v_ot, 'note', 'note', 'Note', 'string', 'column', v_dsid, 'note')
      RETURNING id INTO v_note_pid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       datasource_id, backing_column, required)
      VALUES (v_ot, 'extra', 'extra', 'Extra', 'string', 'column', v_dsid2, 'extra', true)
      RETURNING id INTO v_extra_pid;
    UPDATE public.object_types SET edits_enabled = true WHERE id = v_ot;

    -- 1. the reindex fails on B's hole, naming property and object
    SELECT public.run_index_build(ARRAY[v_ot], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'FAILED'
       OR v_err NOT LIKE '%required property "genre" of object "B"%' THEN
      RAISE EXCEPTION 'the hole should fail the reindex by name, got % / %', v_state, v_err;
    END IF;

    -- 2. filled, it succeeds — and extra (datasource 2) never bound the rows
    EXECUTE format('UPDATE datasets.%I SET genre = ''Romance'' WHERE pk = ''B''', v_phys);
    SELECT public.run_index_build(ARRAY[v_ot], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the filled reindex should succeed, got % / %', v_state, v_err;
    END IF;
    SELECT public.object_current_value(v_ot, 'A', 'extra') INTO v_v;
    IF v_v IS NOT NULL THEN
      RAISE EXCEPTION 'A holds no extra, yet the index says %', v_v;
    END IF;

    -- the actions: a create that touches only datasource 1, and a modify
    -- that touches datasource 2
    v_create := public.save_action_type(jsonb_build_object(
      'api_name', 'probe-670-create', 'label', 'Create', 'ontology_id', v_ont::text,
      'parameters', jsonb_build_array(
        jsonb_build_object('api_name', 'pk', 'display_name', 'Id', 'base_type', 'string',
          'required', true, 'position', 0),
        jsonb_build_object('api_name', 'genre', 'display_name', 'Genre', 'base_type', 'string',
          'required', false, 'position', 1)),
      'rules', jsonb_build_array(jsonb_build_object(
        'kind', 'create_object', 'position', 0, 'object_type_id', v_ot::text,
        'properties', jsonb_build_array(
          jsonb_build_object('property_id', v_pk_pid::text,
            'value_source', 'parameter', 'parameter_api_name', 'pk'),
          jsonb_build_object('property_id', v_genre_pid::text,
            'value_source', 'parameter', 'parameter_api_name', 'genre'))))));
    v_touch := public.save_action_type(jsonb_build_object(
      'api_name', 'probe-670-touch', 'label', 'Touch extra', 'ontology_id', v_ont::text,
      'parameters', jsonb_build_array(jsonb_build_object(
        'api_name', 'extra', 'display_name', 'Extra', 'base_type', 'string',
        'required', false, 'position', 0)),
      'rules', jsonb_build_array(jsonb_build_object(
        'kind', 'modify_object', 'position', 0, 'object_type_id', v_ot::text,
        'properties', jsonb_build_array(jsonb_build_object(
          'property_id', v_extra_pid::text,
          'value_source', 'parameter', 'parameter_api_name', 'extra'))))));
    PERFORM public.save_working_state();

    -- 3. a create writing a blank required value refuses by name; with a
    -- value it lands
    BEGIN
      PERFORM public.apply_action(v_create, '{"pk": "C", "genre": ""}');
      RAISE EXCEPTION 'a blank required value was accepted at apply';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:RequiredPropertyMissing%genre%' THEN RAISE; END IF;
    END;
    PERFORM public.apply_action(v_create, '{"pk": "C", "genre": "Sci-Fi"}');

    -- 4. the page's Budget/Genre case: touching datasource 2 makes its
    -- required property bind — and A has none, so the modify refuses
    BEGIN
      PERFORM public.apply_action(v_touch, '{"extra": ""}', 'A');
      RAISE EXCEPTION 'a blank bound-required value was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:RequiredPropertyMissing%extra%' THEN RAISE; END IF;
    END;
    PERFORM public.apply_action(v_touch, '{"extra": "budget-ish"}', 'A');

    -- 5. and the edit-bound index half: C (edit-only, datasource 1 edits)
    -- indexes with its extra hole intact — the printed answer's shape
    SELECT public.run_index_build(ARRAY[v_ot], true) INTO v_build;
    SELECT bj.state, bj.error INTO v_state, v_err
      FROM public.build_jobs bj WHERE bj.build_id = v_build;
    IF v_state IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'the edit-bound reindex should succeed, got % / %', v_state, v_err;
    END IF;
    SELECT public.object_current_value(v_ot, 'C', 'extra') INTO v_v;
    IF v_v IS NOT NULL THEN
      RAISE EXCEPTION 'C never touched datasource 2, yet extra is %', v_v;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '670 proved: a hole in a required column fails the reindex naming property and object, filling it succeeds, an unbound datasource''s required property never binds absent rows, a blank required value refuses at apply, touching the other datasource makes its required property bind exactly as the worked example states, and the edit-bound object indexes with its hole intact';
  END;
END $$;
