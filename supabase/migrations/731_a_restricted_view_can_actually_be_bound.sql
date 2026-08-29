-- 731 — a restricted view can actually be bound.
--
-- Measured as `authenticated` against the live database, in a rolled-back
-- transaction, by a real user with the owner role on the project:
--
--   delete the dataset backing   — ok
--   attach the restricted view   — new row violates row-level security policy
--   attach a media set view      — new row violates row-level security policy
--
-- 405 wrote one write policy for this table and nothing has replaced it:
--
--   FOR ALL USING (can_write_dataset(dataset_id))
--        WITH CHECK (can_write_dataset(dataset_id))
--
-- `one_backing` (484, widened by 585) forces `dataset_id IS NULL` on every
-- restricted-view row and every media-set row, and `can_write_dataset(NULL)` is
-- `false` rather than NULL — both halves of it are EXISTS. So the policy was
-- false for exactly the two backing kinds it did not know about, and the
-- Datasources tab's "restricted view" and "media set view" branches have never
-- worked for anybody who was not the database owner. Live rows: one, a dataset.
-- That is not a coincidence.
--
-- It stayed invisible because every proof of those two kinds — 484's and 585's
-- assertions, `restrictedViews.test.ts`, the migration probes — writes the row
-- as the owner, and the owner bypasses RLS. CLAUDE.md names this exact failure;
-- this migration's own probe therefore runs as `authenticated`.
--
-- The rule the policy was reaching for is that a binding needs BOTH ends: the
-- caller may edit this object type, and may use the resource being bound.
--
--   "permissions of the objects of a type are determined by the location of
--    their backing datasources"
--   — object-link-types/create-object-type.md
--
-- so the resource end is not a formality. Per kind:
--
--   dataset         — `can_write_dataset`, unchanged, which already carries
--                     both ends for that kind
--   restricted view — `can_index_object_type` (716's editor gate, already the
--                     one this table's own index specs use) AND visibility of
--                     the view. `restricted_views` carries its own policies, so
--                     an EXISTS against it IS the caller's own visibility; no
--                     second copy of that rule is written here
--   media set view  — a RID naming something this platform does not hold, so
--                     the object type is the only end there is to gate
--
-- And the FOR ALL is split into INSERT / UPDATE / DELETE, because a FOR ALL
-- write policy is also evaluated on every SELECT (619's lesson) — the read
-- policy already answers that question and is cheaper.

CREATE FUNCTION public.datasource_binding_allowed(
  p_type uuid, p_dataset uuid, p_restricted_view uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT CASE
    WHEN p_dataset IS NOT NULL THEN public.can_write_dataset(p_dataset)
    WHEN p_restricted_view IS NOT NULL THEN
      public.can_index_object_type(p_type)
      AND EXISTS (SELECT 1 FROM public.restricted_views rv WHERE rv.id = p_restricted_view)
    ELSE public.can_index_object_type(p_type)
  END
$fn$;

COMMENT ON FUNCTION public.datasource_binding_allowed(uuid, uuid, uuid) IS
  'May the caller bind this backing to this object type: the dataset gate for a dataset, the editor gate plus the view''s own visibility for a restricted view, the editor gate alone for a media set view whose resource lives elsewhere. INVOKER on purpose — the EXISTS is meant to see what the caller sees. 731.';

DROP POLICY "bind datasources you can write" ON public.object_type_datasources;

CREATE POLICY "bind datasources you can write" ON public.object_type_datasources
  FOR INSERT WITH CHECK (
    public.datasource_binding_allowed(object_type_id, dataset_id, restricted_view_id));

CREATE POLICY "rebind datasources you can write" ON public.object_type_datasources
  FOR UPDATE USING (
    public.datasource_binding_allowed(object_type_id, dataset_id, restricted_view_id))
  WITH CHECK (
    public.datasource_binding_allowed(object_type_id, dataset_id, restricted_view_id));

CREATE POLICY "unbind datasources you can write" ON public.object_type_datasources
  FOR DELETE USING (
    public.datasource_binding_allowed(object_type_id, dataset_id, restricted_view_id));

-- ── PROVED BY DOING — as `authenticated`, which is the whole point ──────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  rv uuid; t uuid; n int; stranger uuid; other_org uuid; ok boolean;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m731 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm731-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm731-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M731 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm731p', 'm731 probe') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm731ds', 'm731ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"},{"name":"owner_id","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm731rv', 'm731rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;

  SELECT public.save_object_type(
    jsonb_build_object('api_name','M731Thing','label','M731 thing','ontology_id',ont,
      'project_id',proj,'datasources',jsonb_build_array(
        jsonb_build_object('dataset_id',ds,'branch_id',br))),
    jsonb_build_array(jsonb_build_object(
      'property_id','pk','display_name','Id','api_name','id','base_type','string',
      'source','column','backing_column','pk','is_primary_key',true,
      'is_title_key',true,'required',true))) INTO t;
  PERFORM public.save_working_state();

  SET LOCAL ROLE authenticated;

  -- The swap the Datasources tab performs, both halves of it.
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
  VALUES (t, rv);
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND restricted_view_id = rv;
  IF n <> 1 THEN RAISE EXCEPTION 'authenticated could not bind the restricted view'; END IF;

  -- The per-datasource columns the tab writes next, on that same row.
  UPDATE public.object_type_datasources SET allowed_markings = '{}'::uuid[]
   WHERE object_type_id = t AND restricted_view_id = rv;
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND allowed_markings IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'authenticated could not declare the allowed markings'; END IF;

  -- Unbinding it is the DELETE arm, and a restricted view backs alone, so the
  -- media kind is proved on the same type once the view is off it.
  DELETE FROM public.object_type_datasources
   WHERE object_type_id = t AND restricted_view_id = rv;
  SELECT count(*) INTO n FROM public.object_type_datasources WHERE object_type_id = t;
  IF n <> 0 THEN RAISE EXCEPTION 'authenticated could not unbind the restricted view'; END IF;

  -- A media set view, whose resource is a RID and not a row here.
  INSERT INTO public.object_type_datasources
    (object_type_id, media_set_rid, media_set_view_rid)
  VALUES (t, 'ri.mio.main.media-set.m731', 'ri.mio.main.view.m731');
  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = t AND media_set_view_rid IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'authenticated could not bind the media set view'; END IF;

  RESET ROLE;

  -- And it is a gate, not an opening. The half this migration ADDS is the
  -- resource end, so that is the half proved: a caller who cannot see the
  -- restricted view cannot bind it, even though the object-type end would let
  -- them. (`users.role` is owner-or-admin only, so "a user with no role" is not
  -- expressible here — the org boundary is.)
  stranger := gen_random_uuid();
  INSERT INTO public.organizations (name) VALUES ('m731 other') RETURNING id INTO other_org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm731s-' || stranger || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', stranger, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', other_org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (stranger, 'm731s-' || stranger || '@beacon.test', 'admin', other_org);
  SET LOCAL ROLE authenticated;
  SELECT public.datasource_binding_allowed(t, NULL, rv) INTO ok;
  RESET ROLE;
  IF ok THEN RAISE EXCEPTION 'a caller who cannot see the view was allowed to bind it'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  DELETE FROM public.object_type_datasources WHERE object_type_id = t;
  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.project_role_grants WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id IN (usr, stranger);
  DELETE FROM auth.users WHERE id IN (usr, stranger);
  DELETE FROM public.organizations WHERE id IN (org, other_org);
END $$;
