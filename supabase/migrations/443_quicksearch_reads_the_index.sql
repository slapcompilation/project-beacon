-- Quicksearch's object results come from the index, with the documented cap
-- and priority.
--
-- The web Quicksearch (phase 1b) is jump-to mode over loaded titles — which
-- covers apps, datasets and files, but not OBJECTS, because object instances
-- live in the `objects` schema behind the index and no client hook loads them.
-- The page is precise about how that search is scoped:
--
--   "Quicksearch does not search across all object instances in the platform.
--    Quicksearch is limited to search for instances on 250 object types,
--    prioritized by `Active` object types with `Prominent`, then `Normal`, and
--    then `Experimental` status (deprecated and hidden object types are not
--    searched on)."                              (getting-started/quicksearch)
--
--   "Search only on titles: Jump-to mode only searches on titles of apps,
--    resources, and objects."
--
-- An object's title is its title key (E1: the designation on a property), and
-- its indexed value lives in the type's index table (E2). So the search is:
-- pick up to 250 visible types in the documented priority order, and match the
-- query against each type's title column, titles only.
--
-- INFERENCE, marked: `promoted` post-dates this page and "inherit[s] similar
-- operational protections of the `active` status" with visibility forced
-- prominent — it sorts with active-prominent, first.
--
-- SECURITY DEFINER because the objects schema deliberately takes no grants
-- ("owned and controlled by Funnel"); visibility is enforced per type with
-- auth_in_ontology(), the same question indexed_objects() asks.

CREATE OR REPLACE FUNCTION public.search_objects(p_query text, p_limit int DEFAULT 8)
RETURNS TABLE (object_type_id uuid, object_type_label text, primary_key text, title text)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  matched int;
  remaining int := greatest(least(p_limit, 25), 0);
BEGIN
  IF btrim(coalesce(p_query, '')) = '' THEN RETURN; END IF;

  FOR t IN
    SELECT ot.id, ot.label, x.index_table,
           pt.property_id AS title_col, pk.property_id AS pk_col
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
     -- "prioritized by Active object types with Prominent, then Normal, and
     -- then Experimental" — promoted sorts first, as active's protected form.
     ORDER BY CASE
       WHEN ot.status = 'promoted' THEN 0
       WHEN ot.status = 'active' AND ot.visibility = 'prominent' THEN 0
       WHEN ot.status = 'active' THEN 1
       WHEN ot.status = 'experimental' THEN 2
       ELSE 3
     END, ot.created_at
     LIMIT 250
  LOOP
    EXIT WHEN remaining <= 0;
    RETURN QUERY EXECUTE format(
      'SELECT %L::uuid, %L::text, o.%I::text, o.%I::text
         FROM objects.%I o
        WHERE o.%I::text ILIKE %L
        LIMIT %s',
      t.id, t.label, t.pk_col, t.title_col, t.index_table,
      t.title_col, '%' || p_query || '%', remaining);
    GET DIAGNOSTICS matched = ROW_COUNT;
    remaining := remaining - matched;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.search_objects(text, int) IS
  'Jump-to object search: titles only, from the index, across up to 250 visible object types in the documented priority (promoted/active-prominent, active, experimental; deprecated and hidden excluded). Definer because the objects schema takes no grants; auth_in_ontology() gates every type.';

REVOKE ALL ON FUNCTION public.search_objects(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_objects(text, int) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; txn uuid; t uuid;
  usr uuid := gen_random_uuid(); before text; n int; ptbl text; fid uuid;
  x public.object_type_indexes;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('search-443') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws443@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws443@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS443');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws443', 'WS 443') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws443', 'WS443') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights443', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn,
    '[{"name":"flight_id","type":"STRING"},{"name":"callsign","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'flights.parquet', 2) RETURNING id INTO fid;
  UPDATE public.dataset_transactions
     SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;
  ptbl := public.dataset_materialize(ds, txn);
  EXECUTE format(
    'INSERT INTO datasets.%I (_file, flight_id, callsign) VALUES ($1,''F1'',''Sunrise 101''),($1,''F2'',''Nightowl 202'')',
    ptbl) USING fid;

  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(
      jsonb_build_object('property_id','flight_id','display_name','Flight Id','api_name','flightId',
        'base_type','string','source','column','backing_column','flight_id',
        'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();
  -- The callsign becomes the title on a second save, naming the datasource row
  -- that only now exists (the same two-step 440 and 442 use).
  PERFORM public.save_object_type(
    jsonb_build_object('id', t::text, 'api_name','Flight','label','Flight'),
    jsonb_build_array(
      jsonb_build_object('property_id','flight_id','display_name','Flight Id','api_name','flightId',
        'base_type','string','source','column','backing_column','flight_id',
        'is_primary_key',true,'required',true),
      jsonb_build_object('property_id','callsign','display_name','Callsign','api_name','callsign',
        'base_type','string','source','column','backing_column','callsign','is_title_key',true,
        'datasource_id', (SELECT id::text FROM public.object_type_datasources
                           WHERE object_type_id = t))));
  PERFORM public.save_working_state();
  x := public.index_object_type(t);
  IF x.status <> 'success' THEN RAISE EXCEPTION 'fixture index failed: %', x.error; END IF;

  -- 1. A title matches; the primary key rides along so the row is linkable.
  SELECT count(*) INTO n FROM public.search_objects('sunrise');
  IF n <> 1 THEN RAISE EXCEPTION 'expected one title match, got %', n; END IF;
  IF (SELECT s.primary_key FROM public.search_objects('sunrise') s) <> 'F1' THEN
    RAISE EXCEPTION 'the match did not carry its primary key';
  END IF;

  -- 2. Titles only: a primary-key value that is not the title does not match.
  SELECT count(*) INTO n FROM public.search_objects('F2');
  IF n <> 0 THEN RAISE EXCEPTION 'a non-title column matched — jump-to is titles only'; END IF;

  -- 3. "deprecated and hidden object types are not searched on".
  UPDATE public.object_types
     SET status='deprecated',
         deprecation_reason='done', deprecation_deadline=current_date + 30
   WHERE id = t;
  SELECT count(*) INTO n FROM public.search_objects('sunrise');
  IF n <> 0 THEN RAISE EXCEPTION 'a deprecated type was searched'; END IF;
  UPDATE public.object_types SET status='experimental' WHERE id = t;
  UPDATE public.object_types SET visibility='hidden' WHERE id = t;
  SELECT count(*) INTO n FROM public.search_objects('sunrise');
  IF n <> 0 THEN RAISE EXCEPTION 'a hidden type was searched'; END IF;
  UPDATE public.object_types SET visibility='normal' WHERE id = t;

  -- 4. Another organization sees nothing through it.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text,
      'app_metadata', json_build_object('role','admin','org_id', gen_random_uuid()))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.search_objects('sunrise');
  IF n <> 0 THEN RAISE EXCEPTION 'search leaked across ontology visibility'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '443: titles match from the index; deprecated, hidden and other orgs do not';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
