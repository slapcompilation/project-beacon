-- 735 — an absent key is not an instruction to erase.
--
-- 734 added three columns to `apply_object_type`'s property upsert so that an
-- EDIT would carry what a CREATE carries. It carried them unconditionally:
--
--   format_rules             = EXCLUDED.format_rules,
--   value_formatting         = EXCLUDED.value_formatting,
--   allow_empty_arrays       = EXCLUDED.allow_empty_arrays
--
-- and EXCLUDED, for a key the payload does not mention, is the INSERT list's
-- DEFAULT rather than the value already stored — `coalesce(e->'format_rules',
-- '[]')` and `nullif(e->'value_formatting', 'null')`. The web sends neither
-- key: `propertyToRow` emits thirty-six fields and none of them is a formatter.
--
-- So 734 turned a silent KEEP into a silent DESTROY. Measured on the live
-- database in a rolled-back transaction, authoring a rule and then renaming the
-- property the way the Object types page renames one:
--
--   after authoring:  rules=[{"kind":"always_true",...}] formatter={"kind":"user"}
--   after a rename:   rules=[]                            formatter=null
--
-- Nothing has been lost, because no property row carries a rule or a formatter
-- yet — 734's own header measured that and it is still true. It becomes data
-- loss the moment anything authors one, which is the next slice of this work.
-- So it closes first, and it closes in the engine rather than in the caller:
-- the web is one caller, and the next one would meet the same trap.
--
-- The rule is the one 725 already uses for the metadata trio — absent means
-- unchanged — and the reason it has to be written into the INSERT list rather
-- than the DO UPDATE list is that `ON CONFLICT DO UPDATE` cannot see `e`. So
-- each of the three computes the EXISTING value when its key is absent, and
-- the unconditional assignment 734 wrote then writes back what was already
-- there.
--
-- The marking arm keeps precedence over both, because 729 settles that flag for
-- the writer rather than the caller and an edit must not be able to unsettle it.

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$    CASE WHEN e->>'base_type' = 'marking' THEN true
         ELSE coalesce((e->>'allow_empty_arrays')::boolean, false) END,
    coalesce(e->'format_rules', '[]'::jsonb),
    nullif(e->'value_formatting', 'null'::jsonb),$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'formatting anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$    -- Absent means unchanged (735). EXCLUDED cannot see `e`, so the
    -- preservation is computed here and the DO UPDATE writes it back.
    CASE WHEN e->>'base_type' = 'marking' THEN true
         WHEN e ? 'allow_empty_arrays' THEN coalesce((e->>'allow_empty_arrays')::boolean, false)
         ELSE coalesce((SELECT old.allow_empty_arrays
                          FROM public.object_type_properties old
                         WHERE old.object_type_id = t
                           AND old.property_id = e->>'property_id'), false) END,
    CASE WHEN e ? 'format_rules' THEN coalesce(e->'format_rules', '[]'::jsonb)
         ELSE coalesce((SELECT old.format_rules
                          FROM public.object_type_properties old
                         WHERE old.object_type_id = t
                           AND old.property_id = e->>'property_id'), '[]'::jsonb) END,
    CASE WHEN e ? 'value_formatting' THEN nullif(e->'value_formatting', 'null'::jsonb)
         ELSE (SELECT old.value_formatting
                 FROM public.object_type_properties old
                WHERE old.object_type_id = t
                  AND old.property_id = e->>'property_id') END,$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the rename that erased it, and the erase that is meant ─

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  t uuid; src_id uuid; fr jsonb; vf jsonb; aea boolean;
  pk_prop jsonb := jsonb_build_object('property_id','pk','display_name','Id',
    'api_name','id','base_type','string','source','column','backing_column','pk',
    'is_primary_key',true,'is_title_key',true,'required',true);
  rules jsonb := '[{"kind":"always_true","formatting":{"type":"intent","intent":"warning"}}]'::jsonb;
  note jsonb;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m735 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm735-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm735-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M735 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm735p', 'm735 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm735ds', 'm735ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"note","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  SELECT public.save_object_type(
    jsonb_build_object('api_name','M735Thing','label','M735 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(pk_prop)) INTO t;
  PERFORM public.save_working_state();
  SELECT id INTO src_id FROM public.object_type_datasources WHERE object_type_id = t;

  note := jsonb_build_object('property_id','note','display_name','Note','api_name','note',
    'base_type','string','source','column','backing_column','note','datasource_id',src_id);

  -- Authored, the way a formatting card will author it.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M735Thing','label','M735 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, note
      || jsonb_build_object('format_rules', rules, 'value_formatting', '{"kind":"user"}'::jsonb)));
  PERFORM public.save_working_state();

  -- Renamed, the way the Object types page renames it: neither key is sent.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M735Thing','label','M735 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, note || jsonb_build_object('display_name','Note renamed')));
  PERFORM public.save_working_state();

  SELECT format_rules, value_formatting INTO fr, vf
    FROM public.object_type_properties WHERE object_type_id = t AND property_id = 'note';
  IF fr = '[]'::jsonb THEN RAISE EXCEPTION 'a rename erased the format rules'; END IF;
  IF vf IS NULL THEN RAISE EXCEPTION 'a rename erased the value formatting'; END IF;
  IF (SELECT display_name FROM public.object_type_properties
       WHERE object_type_id = t AND property_id = 'note') <> 'Note renamed' THEN
    RAISE EXCEPTION 'the rename itself did not land';
  END IF;

  -- A SPOKEN empty still clears, because removing formatting is a real edit:
  -- "Adding/removing value formatting" (edit-properties).
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M735Thing','label','M735 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, note
      || jsonb_build_object('format_rules', '[]'::jsonb, 'value_formatting', 'null'::jsonb)));
  PERFORM public.save_working_state();
  SELECT format_rules, value_formatting INTO fr, vf
    FROM public.object_type_properties WHERE object_type_id = t AND property_id = 'note';
  IF fr <> '[]'::jsonb OR vf IS NOT NULL THEN
    RAISE EXCEPTION 'a spoken empty did not clear the formatting';
  END IF;

  -- And the marking arm still outranks the preserved value.
  UPDATE public.object_type_properties SET allow_empty_arrays = false
   WHERE object_type_id = t AND property_id = 'pk';
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M735Thing','label','M735 thing','ontology_id',ont),
    jsonb_build_array(pk_prop, note || jsonb_build_object('display_name','Note again')));
  PERFORM public.save_working_state();
  SELECT allow_empty_arrays INTO aea FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'note';
  IF aea THEN RAISE EXCEPTION 'a plain property was given the marking flag'; END IF;

  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
