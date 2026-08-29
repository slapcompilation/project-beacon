-- 729 — a mandatory control admits the empty array.
--
-- 727 made a marking property required and stopped there. The page permits one
-- value that "required" would otherwise refuse, and says so in the same
-- sentence:
--
--   "**Mandatory control properties must be required.** ... All mandatory
--    control properties must not be null. However, markings and organization
--    values can be set to an empty array. In such cases, all users will meet
--    the marking requirements and be able to view the row."
--   — object-link-types/mandatory-control-properties.md
--
-- `index_object_type` refuses a required property whose value is `[]` unless
-- the property allows empty arrays, and `allow_empty_arrays` defaults to false.
-- So after 727 an empty marking — the page's own "all users may view this row"
-- — failed the build. That is being stricter than Foundry, which the house rule
-- forbids, and it is the value a row carries when nothing restricts it, so it
-- is not a corner case.
--
-- That the value is an ARRAY at all is the page's, twice: the empty-array
-- sentence above, and the documented way to add one to an edit-only type —
--
--   "Add a nullable string array property."
--   — object-link-types/mandatory-control-properties.md
--
-- the first step of the three the page gives for adding one to an edit-only
-- type, the last of which is "Change the property's base type to **Mandatory
-- Control**." — so what a mandatory control holds is a string array,
--
-- which is why `marking_value_allowed` (727) reads the value as an array and
-- refuses anything else.
--
-- Placed on two rungs, because neither alone is enough: the writer settles the
-- flag so the wizard cannot produce a type its own linter refuses (724's
-- precedent, where the writer settles a vector's render hints), and the CHECK
-- makes the fact true of every row however it got there.

-- ── the writer settles it ───────────────────────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := 'coalesce((e->>''allow_empty_arrays'')::boolean, false),';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'allow-empty anchor found % times', n; END IF;

  src := replace(src, anchor,
    '-- An empty mandatory control is the page''s own all-users-meet-the-marking
    -- -requirements case, so the caller does not get to refuse it (729).
    CASE WHEN e->>''base_type'' = ''marking'' THEN true
         ELSE coalesce((e->>''allow_empty_arrays'')::boolean, false) END,');

  EXECUTE src;
END $patch$;

-- ── and the row carries the fact ────────────────────────────────────────────

UPDATE public.object_type_properties
   SET allow_empty_arrays = true
 WHERE base_type = 'marking' AND NOT allow_empty_arrays;

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT marking_property_admits_empty CHECK (
    base_type IS DISTINCT FROM 'marking' OR allow_empty_arrays);
COMMENT ON CONSTRAINT marking_property_admits_empty ON public.object_type_properties IS
  'A mandatory control is required but its empty array is legal — "markings and organization values can be set to an empty array" (mandatory-control-properties). Paired with marking_property_is_required (727): together they say not-null, but empty is a value. A composite rule, not a value set.';

-- ── PROVED BY DOING — an empty marking indexes, a foreign one does not ──────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  ds uuid; br uuid; txn uuid; file uuid; phys text; rv uuid;
  t uuid; dsrc uuid; mk uuid := gen_random_uuid(); n int; b uuid; st text; err text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m729 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm729-' || usr || '@beacon.test');
  -- The claims move to this user BEFORE the public.users row, because
  -- provision_personal_project() stamps auth.uid() on the project it creates,
  -- and request.jwt.claims is transaction-scoped: left pointing at an earlier
  -- migration's cleaned-up probe user, that project fails its foreign key.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm729-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M729 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm729p', 'm729 probe') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm729ds', 'm729ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  -- "Add a nullable string array property" — the marking column is an array.
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},
                     {"name":"ctrl","type":"ARRAY","arraySubType":{"type":"STRING"}},
                     {"name":"owner_id","type":"STRING"}]'::jsonb);
  INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
  VALUES (ds, txn, 'rows.parquet', 2) RETURNING id INTO file;
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.dataset_materialize(ds, txn) INTO phys;
  -- One row carries the allowed marking, one carries the page's empty array.
  EXECUTE format('INSERT INTO datasets.%I (_file, pk, ctrl, owner_id) VALUES ($1,''R1'',$2,$3), ($1,''R2'',$4,$3)', phys)
    USING file, ARRAY[mk::text], usr::text, '{}'::text[];

  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm729rv', 'm729rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;

  SELECT public.save_object_type(
    jsonb_build_object('api_name','M729Thing','label','M729 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(jsonb_build_object(
      'property_id','pk','display_name','Id','api_name','id','base_type','string',
      'source','column','backing_column','pk','is_primary_key',true,
      'is_title_key',true,'required',true))) INTO t;
  PERFORM public.save_working_state();

  -- The backing becomes the restricted view the control requires (728 keeps it).
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id, allowed_markings)
  VALUES (t, rv, ARRAY[mk]) RETURNING id INTO dsrc;

  -- The caller says nothing about empty arrays; the writer settles it.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M729Thing','label','M729 thing','ontology_id',ont),
    jsonb_build_array(
      jsonb_build_object('property_id','pk','display_name','Id','api_name','id',
        'base_type','string','source','column','backing_column','pk',
        'is_primary_key',true,'is_title_key',true,'required',true),
      jsonb_build_object('property_id','ctrl','display_name','Control','api_name','ctrl',
        'base_type','marking','source','column','backing_column','ctrl',
        'datasource_id',dsrc,'required',true,'visibility','hidden')));
  PERFORM public.save_working_state();

  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'ctrl' AND allow_empty_arrays;
  IF n <> 1 THEN RAISE EXCEPTION 'the writer did not settle allow_empty_arrays'; END IF;

  -- The empty array indexes rather than failing the build.
  SELECT public.run_index_build(ARRAY[t]::uuid[], true) INTO b;
  SELECT state, error INTO st, err FROM public.build_jobs WHERE build_id = b;
  IF st <> 'COMPLETED' THEN
    RAISE EXCEPTION 'an empty mandatory control failed the build: %', coalesce(err, '(no error)');
  END IF;
  SELECT object_count INTO n FROM public.object_type_indexes WHERE object_type_id = t;
  IF n <> 2 THEN RAISE EXCEPTION 'indexed % objects, not 2', n; END IF;

  -- And the CHECK refuses a marking property told to refuse the empty array.
  BEGIN
    UPDATE public.object_type_properties SET allow_empty_arrays = false
     WHERE object_type_id = t AND property_id = 'ctrl';
    RAISE EXCEPTION 'a marking property was allowed to refuse the empty array';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  EXECUTE format('DROP TABLE IF EXISTS objects.%I',
    (SELECT 'ot_' || replace(t::text, '-', '')));
  DELETE FROM public.object_type_indexes WHERE object_type_id = t;
  DELETE FROM public.build_jobs WHERE output_object_type_id = t;
  DELETE FROM public.builds WHERE id = b;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  -- The type cascades to its properties AND its datasources; deleting the
  -- datasources first meets the property's own foreign key.
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
