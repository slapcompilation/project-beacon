-- 728 — a restricted view or a media set view survives the next save.
--
-- Found while building F11: mandatory controls require a restricted-view
-- backing, and an RV-backed object type could not be saved a SECOND time.
--
--   "Mandatory control properties must be mapped to a **marking column** on a
--    **restricted view.**"
--   — object-link-types/mandatory-control-properties.md
--
-- The mechanism. `ontology_resource_row` describes an object type's backing as
-- a list of {dataset_id, branch_id} pairs. `one_backing` (484) makes the three
-- kinds mutually exclusive, so a restricted view sets neither of those columns,
-- and neither does a media set view (585) — both round-trip as {null, null}.
-- `apply_object_type` then matches the live rows against that list with `=`;
-- NULL is never equal to NULL, so it DELETEs the real backing and INSERTs an
-- all-null row that `one_backing` and the organization guard then refuse.
--
-- Measured on the live database before this migration, each in a rolled-back
-- transaction, by re-saving a landed type with no `datasources` key:
--
--   plain dataset   — ok; the row, its primary_key_column and its allowed
--                     markings all survive, because the identity matches and
--                     neither the DELETE nor the INSERT fires
--   restricted view — Ontology:DatasourceInAnotherOrganization
--   media set view  — Ontology:DatasourceInAnotherOrganization
--
-- Every edit from the web takes that path: `saveObjectType` sends `datasources`
-- only for the wizard's create, so an edit resolves the list from the live row.
-- The backing is part of what defines a type — "specifying the metadata,
-- backing datasource, property mappings, and keys" (create-object-type.md) —
-- so describing it by the dataset alone was never the whole description.
--
-- The fix is that the description is complete and the comparison is NULL-aware.
-- Nothing else in either function moves. Both are patched from the live
-- definition rather than retyped.
--
-- Live exposure at the time of writing: one datasource row, dataset-backed; no
-- staged working-state change carries a `datasources` key. So no landed row and
-- no pending save changes meaning.

-- ── the description carries the whole identity ──────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text :=
$a$jsonb_build_object('datasources', coalesce(
           (SELECT jsonb_agg(jsonb_build_object('dataset_id', d.dataset_id,
                                                'branch_id', d.branch_id)
                             ORDER BY d.dataset_id)
              FROM public.object_type_datasources d WHERE d.object_type_id = p_id),
           '[]'::jsonb));$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'ontology_resource_row';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'resource-row anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$jsonb_build_object('datasources', coalesce(
           (SELECT jsonb_agg(jsonb_build_object('dataset_id', d.dataset_id,
                                                'branch_id', d.branch_id,
                                                'restricted_view_id', d.restricted_view_id,
                                                'media_set_rid', d.media_set_rid,
                                                'media_set_view_rid', d.media_set_view_rid)
                             -- One of the three is set, by one_backing, so this
                             -- orders every kind and not just the dataset one.
                             ORDER BY coalesce(d.dataset_id::text,
                                               d.restricted_view_id::text,
                                               d.media_set_view_rid))
              FROM public.object_type_datasources d WHERE d.object_type_id = p_id),
           '[]'::jsonb));$a$);

  EXECUTE src;
END $patch$;

-- ── the comparison is NULL-aware, and the insert restores what it matched ───

DO $patch$
DECLARE
  src text;
  n int;
  anchor text :=
$a$DELETE FROM public.object_type_datasources d
   WHERE d.object_type_id = t
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_datasources) e
                      WHERE (e->>'dataset_id')::uuid = d.dataset_id
                        AND (e->>'branch_id')::uuid  = d.branch_id);

  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  SELECT t, (e->>'dataset_id')::uuid, (e->>'branch_id')::uuid
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_type_datasources d
      WHERE d.dataset_id = (e->>'dataset_id')::uuid
        AND d.branch_id  = (e->>'branch_id')::uuid);$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply anchor found % times', n; END IF;

  src := replace(src, anchor,
$a$-- A backing is identified by whichever of the three kinds it is, compared
  -- NULL-aware: `=` reads every restricted view and every media set view as a
  -- row nobody asked for, which is how it deleted them (728).
  DELETE FROM public.object_type_datasources d
   WHERE d.object_type_id = t
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_datasources) e
                      WHERE nullif(e->>'dataset_id','')::uuid IS NOT DISTINCT FROM d.dataset_id
                        AND nullif(e->>'branch_id','')::uuid  IS NOT DISTINCT FROM d.branch_id
                        AND nullif(e->>'restricted_view_id','')::uuid IS NOT DISTINCT FROM d.restricted_view_id
                        AND nullif(e->>'media_set_view_rid','') IS NOT DISTINCT FROM d.media_set_view_rid);

  -- The NOT EXISTS is deliberately not scoped to this type: a datasource backs
  -- one object type, so one already spoken for is not taken from it.
  INSERT INTO public.object_type_datasources (
    object_type_id, dataset_id, branch_id,
    restricted_view_id, media_set_rid, media_set_view_rid)
  SELECT t, nullif(e->>'dataset_id','')::uuid, nullif(e->>'branch_id','')::uuid,
         nullif(e->>'restricted_view_id','')::uuid,
         nullif(e->>'media_set_rid',''), nullif(e->>'media_set_view_rid','')
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_type_datasources d
      WHERE d.dataset_id IS NOT DISTINCT FROM nullif(e->>'dataset_id','')::uuid
        AND d.branch_id  IS NOT DISTINCT FROM nullif(e->>'branch_id','')::uuid
        AND d.restricted_view_id IS NOT DISTINCT FROM nullif(e->>'restricted_view_id','')::uuid
        AND d.media_set_view_rid IS NOT DISTINCT FROM nullif(e->>'media_set_view_rid',''));$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — each backing kind re-saved, through the front door ────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  ds uuid; br uuid; ds2 uuid; br2 uuid; txn uuid;
  rv uuid; t uuid; t2 uuid; src_id uuid; n int; pkcol text;
  props jsonb := jsonb_build_array(jsonb_build_object(
    'property_id','pk','display_name','Id','api_name','id','base_type','string',
    'source','column','backing_column','pk','is_primary_key',true,
    'is_title_key',true,'required',true));
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m728 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm728-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm728-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M728 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm728p', 'm728 probe') RETURNING id INTO proj;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm728ds', 'm728ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"owner_id","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm728rv', 'm728rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;

  -- A type created the way the wizard creates one, then backed by the view.
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M728Rv','label','M728 rv','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))), props) INTO t;
  PERFORM public.save_working_state();
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
  VALUES (t, rv) RETURNING id INTO src_id;

  -- The edit that used to destroy it: no `datasources` key, so the list is
  -- resolved from the live row.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M728Rv','label','M728 renamed',
      'ontology_id',ont), NULL);
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND id = src_id AND restricted_view_id = rv;
  IF n <> 1 THEN RAISE EXCEPTION 'the restricted view did not survive the save (%)', n; END IF;
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'the save left % datasources, not 1', n; END IF;

  -- A media set view, which sets neither dataset nor branch either.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm728ds2', 'm728ds2') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds2, br2, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds2, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  SELECT public.save_object_type(
    jsonb_build_object('api_name','M728Media','label','M728 media','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds2,'branch_id',br2))), props) INTO t2;
  PERFORM public.save_working_state();
  -- The dataset keeps the type valid; the media set view joins it, the way a
  -- media reference property is backed.
  INSERT INTO public.object_type_datasources
    (object_type_id, media_set_rid, media_set_view_rid)
  VALUES (t2, 'ri.mio.main.media-set.m728', 'ri.mio.main.view.m728');
  -- The per-datasource columns a delete-and-recreate would silently drop.
  UPDATE public.object_type_datasources SET primary_key_column = 'pk'
   WHERE object_type_id = t2 AND dataset_id = ds2;

  PERFORM public.save_object_type(
    jsonb_build_object('id',t2,'api_name','M728Media','label','M728 media renamed',
      'ontology_id',ont), NULL);
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t2 AND media_set_view_rid = 'ri.mio.main.view.m728';
  IF n <> 1 THEN RAISE EXCEPTION 'the media set view did not survive the save (%)', n; END IF;
  SELECT primary_key_column INTO pkcol FROM public.object_type_datasources
   WHERE object_type_id = t2 AND dataset_id = ds2;
  IF pkcol IS DISTINCT FROM 'pk' THEN
    RAISE EXCEPTION 'the dataset row was recreated — primary_key_column is %', pkcol;
  END IF;

  -- A backing genuinely REMOVED still goes: the list is the instruction.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t2,'api_name','M728Media','label','M728 media',
      'ontology_id',ont,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds2,'branch_id',br2))), NULL);
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t2;
  IF n <> 1 THEN RAISE EXCEPTION 'dropping the media view left % rows, not 1', n; END IF;

  DELETE FROM public.object_type_datasources WHERE object_type_id IN (t, t2);
  DELETE FROM public.job_specs WHERE output_object_type_id IN (t, t2);
  DELETE FROM public.object_types WHERE id IN (t, t2);
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE id IN (ds, ds2);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
