-- 723 — the save path carries the value-type binding (creation review,
-- F6.3).
--
--   "To assign a value type to a property, select the value type from the
--    dropdown menu during property configuration."
--   — object-link-types/use-value-type.md
--
-- The engine has been whole since 452: object_type_properties.value_type_id,
-- value_conforms enforced at index time with the authored failure message —
-- and unreachable, because apply_object_type's property upsert never carried
-- the column, so no save could bind one. The census's named defect shape: an
-- engine nothing reaches. The dropdown lands in the property editor with
-- this migration's arc; here the upsert learns the column, in its three
-- places (insert list, select list, conflict update), live-patched with
-- anchors so nothing else moves.

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, 'shared_property_id, required, allow_empty_arrays,', ''))) /
       length('shared_property_id, required, allow_empty_arrays,');
  IF n <> 1 THEN RAISE EXCEPTION 'insert-list anchor found % times', n; END IF;
  src := replace(src,
    'shared_property_id, required, allow_empty_arrays,',
    'shared_property_id, value_type_id, required, allow_empty_arrays,');

  n := (length(src) - length(replace(src, 'nullif(e->>''shared_property_id'', '''')::uuid,', ''))) /
       length('nullif(e->>''shared_property_id'', '''')::uuid,');
  IF n <> 1 THEN RAISE EXCEPTION 'select-list anchor found % times', n; END IF;
  src := replace(src,
    'nullif(e->>''shared_property_id'', '''')::uuid,',
    'nullif(e->>''shared_property_id'', '''')::uuid,
    nullif(e->>''value_type_id'', '''')::uuid,');

  n := (length(src) - length(replace(src, 'shared_property_id = EXCLUDED.shared_property_id,', ''))) /
       length('shared_property_id = EXCLUDED.shared_property_id,');
  IF n <> 1 THEN RAISE EXCEPTION 'conflict-update anchor found % times', n; END IF;
  src := replace(src,
    'shared_property_id = EXCLUDED.shared_property_id,',
    'shared_property_id = EXCLUDED.shared_property_id,
    value_type_id      = EXCLUDED.value_type_id,');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — a binding rides the front door and lands ──────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; vt uuid; ot uuid; got uuid;
  proj uuid; ds uuid; br uuid; txn uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m723 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm723-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm723-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M723 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.value_types (space_id, api_name, display_name, base_type)
  VALUES (space, 'm723_code', 'M723 code', 'string') RETURNING id INTO vt;

  -- The wizard's own sequence, whole: dataset first, staged inline, saved.
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm723_probe', 'm723 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm723_ds', 'm723_ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M723Thing', 'label', 'M723 thing', 'ontology_id', ont,
      'project_id', proj,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(jsonb_build_object(
      'property_id', 'pk', 'display_name', 'Id', 'api_name', 'id',
      'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
      'is_primary_key', true, 'is_title_key', true, 'required', true,
      'value_type_id', vt))) INTO ot;
  PERFORM public.save_working_state();

  SELECT value_type_id INTO got FROM public.object_type_properties
   WHERE object_type_id = ot AND property_id = 'pk';
  IF got IS DISTINCT FROM vt THEN
    RAISE EXCEPTION 'the binding did not land (got %)', coalesce(got::text, 'NULL');
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.job_specs WHERE output_object_type_id = ot;
  DELETE FROM public.value_types WHERE id = vt;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
