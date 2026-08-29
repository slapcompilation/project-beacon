-- 734 — an edit carries what a create carries.
--
-- `apply_object_type` upserts properties. Its INSERT list names twenty-seven
-- columns; its `ON CONFLICT ... DO UPDATE SET` list names twenty-four. The three
-- it drops are `format_rules`, `value_formatting` and `allow_empty_arrays`, so
-- each of them lands when a property is CREATED and is silently kept at its old
-- value on every later save.
--
-- Measured on the live database before this migration, in a rolled-back
-- transaction, by saving a property and then saving it again with formatting:
--
--   EDIT carries format_rules?      false — got []
--   EDIT carries value_formatting?  false — got null
--   base type -> marking:           refused, marking_property_admits_empty
--
-- Each of the three is on a path a page documents.
--
-- Formatting is a documented EDIT, and a bulk one:
--
--   "Adding/removing value formatting."
--   — object-link-types/edit-properties.md
--
-- listed there among the things you may change on properties that already
-- exist. 673 built the engine and its own probe called `apply_object_type`
-- twice — but its second call introduced NEW properties, so it exercised only
-- the branch that works. That is the familiar failure one level in: the probe
-- did call the path, just not the arm.
--
-- And `allow_empty_arrays` is worse than kept, because 729 gave it a CHECK. The
-- page's documented way to add a mandatory control to a type that already has
-- edits is three steps, and the third is:
--
--   "Change the property's base type to **Mandatory Control**."
--   — object-link-types/mandatory-control-properties.md
--
-- On an existing property the base type moved and `allow_empty_arrays` did not,
-- so 729's `marking_property_admits_empty` refused the save. 729 settled the
-- flag in the writer precisely so a caller could not produce that state, and
-- the settling only ever reached the INSERT. The page's own workaround was
-- unusable for as long as 729 has been applied, which is a few hours.
--
-- Nothing else in the function moves; it is patched from its live definition.
-- Live exposure: five property rows, none carrying a rule or a formatter.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := '    selectable               = EXCLUDED.selectable';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'upsert anchor found % times', n; END IF;

  src := replace(src, anchor,
'    selectable               = EXCLUDED.selectable,
    -- The three a create carried and an edit dropped (734). allow_empty_arrays
    -- is the writer''s own settled value, so leaving it behind made 729''s CHECK
    -- refuse the base-type change the page documents.
    format_rules             = EXCLUDED.format_rules,
    value_formatting         = EXCLUDED.value_formatting,
    allow_empty_arrays       = EXCLUDED.allow_empty_arrays');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — all three, on the arm that was missing ───────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  rv uuid; t uuid; src_id uuid; rvsrc uuid; n int; fr jsonb; vf jsonb; aea boolean;
  pk_prop jsonb := jsonb_build_object('property_id','pk','display_name','Id',
    'api_name','id','base_type','string','source','column','backing_column','pk',
    'is_primary_key',true,'is_title_key',true,'required',true);
  rules jsonb := '[{"kind":"always_true","formatting":{"type":"intent","intent":"warning"}}]'::jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m734 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm734-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm734-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M734 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm734p', 'm734 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm734ds', 'm734ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},
                     {"name":"note","type":"ARRAY","arraySubType":{"type":"STRING"}},
                     {"name":"owner_id","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  SELECT public.save_object_type(
    jsonb_build_object('api_name','M734Thing','label','M734 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(pk_prop)) INTO t;
  PERFORM public.save_working_state();
  SELECT id INTO src_id FROM public.object_type_datasources WHERE object_type_id = t;

  -- `note` is created plain, so the formatting arrives on an EDIT of a property
  -- that already exists — the arm 673's probe never took.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M734Thing','label','M734 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, jsonb_build_object(
      'property_id','note','display_name','Note','api_name','note','base_type','string',
      'source','column','backing_column','note','datasource_id',src_id)));
  PERFORM public.save_working_state();

  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M734Thing','label','M734 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, jsonb_build_object(
      'property_id','note','display_name','Note','api_name','note','base_type','string',
      'source','column','backing_column','note','datasource_id',src_id,
      'format_rules',rules,'value_formatting','{"kind":"user"}'::jsonb)));
  PERFORM public.save_working_state();

  SELECT format_rules, value_formatting INTO fr, vf
    FROM public.object_type_properties WHERE object_type_id = t AND property_id = 'note';
  IF fr = '[]'::jsonb THEN RAISE EXCEPTION 'an edit did not carry format_rules'; END IF;
  IF vf IS NULL THEN RAISE EXCEPTION 'an edit did not carry value_formatting'; END IF;

  -- And an edit can take them away again, which "Adding/removing" needs.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M734Thing','label','M734 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, jsonb_build_object(
      'property_id','note','display_name','Note','api_name','note','base_type','string',
      'source','column','backing_column','note','datasource_id',src_id)));
  PERFORM public.save_working_state();
  SELECT format_rules, value_formatting INTO fr, vf
    FROM public.object_type_properties WHERE object_type_id = t AND property_id = 'note';
  IF fr <> '[]'::jsonb OR vf IS NOT NULL THEN
    RAISE EXCEPTION 'an edit could not remove the formatting';
  END IF;

  -- The page's three-step workaround, whose third step 729 had made impossible.
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm734rv', 'm734rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;
  DELETE FROM public.object_type_properties WHERE object_type_id = t AND property_id = 'note';
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id, allowed_markings)
  VALUES (t, rv, '{}'::uuid[]) RETURNING id INTO rvsrc;

  -- Step 1: a nullable string array property.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M734Thing','label','M734 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, jsonb_build_object(
      'property_id','note','display_name','Note','api_name','note','base_type','array',
      'array_element_type','string','source','column','backing_column','note',
      'datasource_id',rvsrc)));
  PERFORM public.save_working_state();

  -- Step 3: change its base type to the mandatory control.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M734Thing','label','M734 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, jsonb_build_object(
      'property_id','note','display_name','Note','api_name','note','base_type','marking',
      'source','column','backing_column','note','datasource_id',rvsrc,
      'required',true,'visibility','hidden')));
  PERFORM public.save_working_state();

  SELECT allow_empty_arrays INTO aea FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'note';
  IF NOT aea THEN
    RAISE EXCEPTION 'the writer did not settle allow_empty_arrays on the edit';
  END IF;
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'note' AND base_type = 'marking';
  IF n <> 1 THEN RAISE EXCEPTION 'the base type did not become a mandatory control'; END IF;

  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  -- The type cascades to its properties AND its datasources; deleting the
  -- datasources first meets the marking property's own foreign key.
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
