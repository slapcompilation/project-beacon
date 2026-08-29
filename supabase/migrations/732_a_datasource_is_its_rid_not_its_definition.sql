-- 732 — a datasource is its rid, not its definition.
--
-- 728 made the save stop destroying restricted-view and media-set backings by
-- comparing every column of the backing NULL-aware. That fixed the symptom and
-- kept the modelling error underneath it, which the adversary pass named and
-- the api settles:
--
--   "Randomly generated identifier for an object type's datasource."
--   — api/ontologies-v2-resources-object-types-get-object-type.md
--
--   "The definition of an object type datasource, identifying the kind of
--    Foundry resource that backs the object type."
--   — api/ontologies-v2-resources-object-types-get-object-type.md
--
-- A datasource HAS an identity — a `rid` — and separately HAS a `definition`
-- naming the resource behind it. `object_type_datasources.id` is that rid. So
-- matching a saved datasource by its definition, as both 598 and 728 do, says
-- that changing what backs a datasource destroys it and creates another one.
-- Three consequences, each measured on the live database before this migration,
-- by re-saving with a changed backing:
--
--   1. Every per-datasource column resets, because the row is new: 586's
--      `primary_key_column`, 422's `conflict_resolution` and
--      `timestamp_property_id`, and — since last week — 727's `allowed_markings`
--      and `allowed_organizations`. NULL there means "undeclared", so the
--      linter then refuses a save the user did not think concerned markings.
--   2. `media_set_rid` could not be corrected at all. 728 emits it and inserts
--      it but compares only `media_set_view_rid`, so a payload naming the right
--      set matched the row holding the wrong one and nothing happened, silently.
--   3. `object_type_media_sources` rows cascade away with the deleted row, and
--      nothing in the payload can put them back.
--
-- Keyed on the rid instead: an entry the caller has seen before carries it, and
-- its definition is UPDATED in place, so the row — and everything hanging off
-- it — survives. An entry with no rid is a new binding, matched by definition
-- the way it was, because that is all a create can say.
--
-- What this does NOT fix, so it is not mistaken for done: a property bound to a
-- datasource still has `ON DELETE RESTRICT` (408), so genuinely REMOVING a
-- backing that properties still name fails with a raw foreign-key error rather
-- than a namespaced one. Recorded, unbuilt. And there is still no unique index
-- on `restricted_view_id` or `media_set_view_rid`, so binding a view another
-- type already holds is skipped silently where a dataset would raise
-- `Phonograph2:DatasetAndBranchAlreadyRegistered` — recorded, unbuilt, and it
-- needs the page that says whether sharing one is legal at all.
--
-- Live rows: one, a dataset. No staged change carries a `datasources` key.

-- ── the description carries the identity ────────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$jsonb_build_object('dataset_id', d.dataset_id,
                                                'branch_id', d.branch_id,
                                                'restricted_view_id', d.restricted_view_id,
                                                'media_set_rid', d.media_set_rid,
                                                'media_set_view_rid', d.media_set_view_rid)
                             -- One of the three is set, by one_backing, so this
                             -- orders every kind and not just the dataset one.
                             ORDER BY coalesce(d.dataset_id::text,
                                               d.restricted_view_id::text,
                                               d.media_set_view_rid)$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'ontology_resource_row';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'resource-row anchor found % times', n; END IF;

  src := replace(src, anchor,
    $a$jsonb_build_object('rid', d.id,
                                                'dataset_id', d.dataset_id,
                                                'branch_id', d.branch_id,
                                                'restricted_view_id', d.restricted_view_id,
                                                'media_set_rid', d.media_set_rid,
                                                'media_set_view_rid', d.media_set_view_rid)
                             -- The rid is the identity and is always set, so
                             -- unlike 728's coalesce this is a total order.
                             ORDER BY d.id$a$);

  EXECUTE src;
END $patch$;

-- ── the save keeps the row and moves the definition ─────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := $a$-- A backing is identified by whichever of the three kinds it is, compared
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
        AND d.media_set_view_rid IS NOT DISTINCT FROM nullif(e->>'media_set_view_rid',''));$a$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply anchor found % times', n; END IF;

  src := replace(src, anchor, $a$-- A datasource is its rid; the backing is its definition. An entry the
  -- caller has seen before carries the rid, so the row stays and the
  -- definition moves — which is what keeps primary_key_column, the allowed
  -- markings and the media bindings across a change of backing (732).
  DELETE FROM public.object_type_datasources d
   WHERE d.object_type_id = t
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_datasources) e
        WHERE CASE WHEN nullif(e->>'rid','') IS NOT NULL
                   THEN (e->>'rid')::uuid = d.id
                   ELSE nullif(e->>'dataset_id','')::uuid IS NOT DISTINCT FROM d.dataset_id
                    AND nullif(e->>'branch_id','')::uuid  IS NOT DISTINCT FROM d.branch_id
                    AND nullif(e->>'restricted_view_id','')::uuid IS NOT DISTINCT FROM d.restricted_view_id
                    AND nullif(e->>'media_set_view_rid','') IS NOT DISTINCT FROM d.media_set_view_rid
              END);

  -- A rid the caller still names keeps its row and takes the new definition.
  UPDATE public.object_type_datasources d
     SET dataset_id         = nullif(e->>'dataset_id','')::uuid,
         branch_id          = nullif(e->>'branch_id','')::uuid,
         restricted_view_id = nullif(e->>'restricted_view_id','')::uuid,
         media_set_rid      = nullif(e->>'media_set_rid',''),
         media_set_view_rid = nullif(e->>'media_set_view_rid','')
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE d.object_type_id = t
     AND nullif(e->>'rid','') IS NOT NULL
     AND d.id = (e->>'rid')::uuid
     AND (d.dataset_id         IS DISTINCT FROM nullif(e->>'dataset_id','')::uuid
       OR d.branch_id          IS DISTINCT FROM nullif(e->>'branch_id','')::uuid
       OR d.restricted_view_id IS DISTINCT FROM nullif(e->>'restricted_view_id','')::uuid
       OR d.media_set_rid      IS DISTINCT FROM nullif(e->>'media_set_rid','')
       OR d.media_set_view_rid IS DISTINCT FROM nullif(e->>'media_set_view_rid',''));

  -- What is left is new. The NOT EXISTS is deliberately not scoped to this
  -- type: a datasource backs one object type, so one already spoken for is not
  -- taken from it.
  INSERT INTO public.object_type_datasources (
    id, object_type_id, dataset_id, branch_id,
    restricted_view_id, media_set_rid, media_set_view_rid)
  SELECT coalesce(nullif(e->>'rid','')::uuid, gen_random_uuid()),
         t, nullif(e->>'dataset_id','')::uuid, nullif(e->>'branch_id','')::uuid,
         nullif(e->>'restricted_view_id','')::uuid,
         nullif(e->>'media_set_rid',''), nullif(e->>'media_set_view_rid','')
    FROM jsonb_array_elements(coalesce(p_datasources, '[]'::jsonb)) e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_type_datasources d
      WHERE CASE WHEN nullif(e->>'rid','') IS NOT NULL
                 THEN d.id = (e->>'rid')::uuid
                 ELSE d.dataset_id IS NOT DISTINCT FROM nullif(e->>'dataset_id','')::uuid
                  AND d.branch_id  IS NOT DISTINCT FROM nullif(e->>'branch_id','')::uuid
                  AND d.restricted_view_id IS NOT DISTINCT FROM nullif(e->>'restricted_view_id','')::uuid
                  AND d.media_set_view_rid IS NOT DISTINCT FROM nullif(e->>'media_set_view_rid','')
            END);$a$);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the row survives its definition changing ──────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  ds uuid; br uuid; br2 uuid; ds2 uuid; br3 uuid; txn uuid;
  t uuid; src_id uuid; n int; pkcol text; msr text;
  props jsonb := jsonb_build_array(jsonb_build_object(
    'property_id','pk','display_name','Id','api_name','id','base_type','string',
    'source','column','backing_column','pk','is_primary_key',true,
    'is_title_key',true,'required',true));
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m732 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm732-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm732-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M732 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm732p', 'm732 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm732ds', 'm732ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'develop') RETURNING id INTO br2;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  SELECT public.save_object_type(
    jsonb_build_object('api_name','M732Thing','label','M732 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))), props) INTO t;
  PERFORM public.save_working_state();
  SELECT id INTO src_id FROM public.object_type_datasources WHERE object_type_id = t;
  UPDATE public.object_type_datasources
     SET primary_key_column = 'pk', allowed_markings = '{}'::uuid[]
   WHERE id = src_id;

  -- The change that used to destroy the row: same datasource, other branch.
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M732Thing','label','M732 thing',
      'ontology_id',ont,'datasources',jsonb_build_array(
        jsonb_build_object('rid',src_id,'dataset_id',ds,'branch_id',br2))), NULL);
  PERFORM public.save_working_state();

  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND id = src_id AND branch_id = br2;
  IF n <> 1 THEN RAISE EXCEPTION 'the rid did not survive its branch changing (%)', n; END IF;
  SELECT primary_key_column INTO pkcol FROM public.object_type_datasources WHERE id = src_id;
  IF pkcol IS DISTINCT FROM 'pk' THEN
    RAISE EXCEPTION 'primary_key_column was lost to the change: %', pkcol;
  END IF;
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE id = src_id AND allowed_markings IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'the allowed markings were lost to the change'; END IF;

  -- A media set view corrected in place — 728 could not, because it compared
  -- only the view rid.
  UPDATE public.object_type_datasources
     SET dataset_id = NULL, branch_id = NULL, primary_key_column = NULL,
         media_set_rid = 'ri.mio.main.media-set.wrong',
         media_set_view_rid = 'ri.mio.main.view.m732'
   WHERE id = src_id;
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M732Thing','label','M732 thing',
      'ontology_id',ont,'datasources',jsonb_build_array(
        jsonb_build_object('rid',src_id,'media_set_rid','ri.mio.main.media-set.right',
                           'media_set_view_rid','ri.mio.main.view.m732'))), NULL);
  PERFORM public.save_working_state();
  SELECT media_set_rid INTO msr FROM public.object_type_datasources WHERE id = src_id;
  IF msr <> 'ri.mio.main.media-set.right' THEN
    RAISE EXCEPTION 'the media set rid was not corrected: %', msr;
  END IF;

  -- An entry with no rid is still a new binding, which is all a create can say.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm732ds2', 'm732ds2') RETURNING id INTO ds2;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br3;
  PERFORM public.save_object_type(
    jsonb_build_object('id',t,'api_name','M732Thing','label','M732 thing',
      'ontology_id',ont,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds2,'branch_id',br3))), NULL);
  PERFORM public.save_working_state();
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t;
  IF n <> 1 THEN RAISE EXCEPTION 'the ridless entry did not replace the set (%)', n; END IF;
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND dataset_id = ds2 AND branch_id = br3;
  IF n <> 1 THEN RAISE EXCEPTION 'the ridless entry did not land'; END IF;

  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id IN (ds, ds2);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
