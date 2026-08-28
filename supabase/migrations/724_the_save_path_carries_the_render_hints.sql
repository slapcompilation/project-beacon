-- 724 — the save path carries the render hints (creation review, F6.4).
--
--   "You can select and deselect render hints in the properties pane of the
--    property editor (see image below)."
--   — object-link-types/metadata-render-hints.md
--
-- The three built hints (searchable, sortable, selectable — 475) have real
-- consumers and the dependency CHECK, but no save could ever set them:
-- apply_object_type SETTLED all three from the base type on every upsert
-- ("the writer settles the three rather than asking"), so a toggle would
-- have been overwritten on the next save even if a surface had existed.
-- The writer now asks first: a caller-provided value wins, the vector rule
-- stays the default for payloads that do not speak. The property pane's
-- toggles land with this migration's arc; hints_need_searchable (475)
-- continues to refuse a dependent hint without its parent, now reachable
-- through the front door for the first time.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := '    (e->>''base_type'') IS DISTINCT FROM ''vector'',
    (e->>''base_type'') IS DISTINCT FROM ''vector'',
    (e->>''base_type'') IS DISTINCT FROM ''vector''';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'hint-block anchor found % times', n; END IF;
  src := replace(src, anchor,
'    coalesce((e->>''searchable'')::boolean, (e->>''base_type'') IS DISTINCT FROM ''vector''),
    coalesce((e->>''sortable'')::boolean, (e->>''base_type'') IS DISTINCT FROM ''vector''),
    coalesce((e->>''selectable'')::boolean, (e->>''base_type'') IS DISTINCT FROM ''vector'')');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — hints ride the front door; the dependency refuses ─────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; ot uuid;
  proj uuid; ds uuid; br uuid; txn uuid; r record;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m724 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm724-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm724-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M724 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm724_probe', 'm724 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm724_ds', 'm724_ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  -- Create with the key alone; the unspoken payload keeps the old default.
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M724Thing', 'label', 'M724 thing', 'ontology_id', ont,
      'project_id', proj,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(jsonb_build_object(
      'property_id', 'pk', 'display_name', 'Id', 'api_name', 'id',
      'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
      'is_primary_key', true, 'is_title_key', true, 'required', true))) INTO ot;
  PERFORM public.save_working_state();
  SELECT searchable, sortable, selectable INTO r
    FROM public.object_type_properties WHERE object_type_id = ot AND property_id = 'pk';
  IF NOT (r.searchable AND r.sortable AND r.selectable) THEN
    RAISE EXCEPTION 'the unspoken default moved: % % %', r.searchable, r.sortable, r.selectable;
  END IF;

  -- The edit flow adds a property with CHOSEN hints, against the landed
  -- datasource — the toggles' own path.
  PERFORM public.save_object_type(
    jsonb_build_object('id', ot, 'api_name', 'M724Thing', 'label', 'M724 thing', 'ontology_id', ont),
    jsonb_build_array(
      jsonb_build_object(
        'property_id', 'pk', 'display_name', 'Id', 'api_name', 'id',
        'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
        'is_primary_key', true, 'is_title_key', true, 'required', true),
      jsonb_build_object(
        'property_id', 'note', 'display_name', 'Note', 'api_name', 'note',
        'base_type', 'string', 'source', 'column', 'backing_column', 'note',
        'datasource_id', (SELECT id FROM public.object_type_datasources
                           WHERE object_type_id = ot),
        'required', false, 'position', 1,
        'searchable', false, 'sortable', false, 'selectable', false)));
  PERFORM public.save_working_state();
  SELECT searchable, sortable, selectable INTO r
    FROM public.object_type_properties WHERE object_type_id = ot AND property_id = 'note';
  IF r.searchable OR r.sortable OR r.selectable THEN
    RAISE EXCEPTION 'the chosen hints did not land: % % %', r.searchable, r.sortable, r.selectable;
  END IF;

  -- The dependency rule, met through the front door: sortable without
  -- searchable refuses at the save.
  PERFORM public.save_object_type(
    jsonb_build_object('id', ot, 'api_name', 'M724Thing', 'label', 'M724 thing', 'ontology_id', ont),
    jsonb_build_array(jsonb_build_object(
      'property_id', 'note', 'display_name', 'Note', 'api_name', 'note',
      'base_type', 'string', 'source', 'column', 'backing_column', 'note',
      'datasource_id', (SELECT id FROM public.object_type_datasources
                         WHERE object_type_id = ot),
      'required', false, 'position', 1,
      'searchable', false, 'sortable', true, 'selectable', false)));
  BEGIN
    PERFORM public.save_working_state();
    RAISE EXCEPTION 'a dependent hint without its parent was accepted';
  EXCEPTION WHEN check_violation THEN
    PERFORM public.discard_working_state();
  END;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.job_specs WHERE output_object_type_id = ot;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
