-- 726 — an interface is searchable by default (creation review F6.8's
-- engine half; the fault 450 shipped and the object-views adversary pass
-- re-flagged).
--
--   "Searchable: A boolean value that specifies whether the interface is
--    searchable. Searchable interfaces enable users to load or search all
--    objects of the interface at once. Searchable interfaces are limited to
--    50 implementing object types, whereas non-searchable interfaces are
--    limited to 1,000. By default, the `Facility` interface will be
--    searchable."
--   — interfaces/interface-metadata.md
--
-- 450 defaulted the column FALSE with no stated reason, and apply_interface
-- coalesced an unspoken payload to false the same way — the page's default,
-- inverted, twice. Zero interface rows exist live, so nothing standing
-- changes meaning. The metadata surface (icon, description, searchable,
-- status) lands with this migration's arc.

ALTER TABLE public.ontology_interfaces ALTER COLUMN searchable SET DEFAULT true;

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_interface';

  n := (length(src) - length(replace(src, 'coalesce((p_interface->>''searchable'')::boolean, false)', ''))) /
       length('coalesce((p_interface->>''searchable'')::boolean, false)');
  IF n <> 1 THEN RAISE EXCEPTION 'searchable anchor found % times', n; END IF;
  src := replace(src,
    'coalesce((p_interface->>''searchable'')::boolean, false)',
    'coalesce((p_interface->>''searchable'')::boolean, true)');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — an unspoken interface lands searchable ────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; iface uuid; got boolean;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m726 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm726-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm726-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M726 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;

  SELECT public.save_interface(jsonb_build_object(
    'api_name', 'M726Face', 'label', 'M726 face', 'ontology_id', ont,
    'properties', '[]'::jsonb)) INTO iface;
  PERFORM public.save_working_state();
  SELECT searchable INTO got FROM public.ontology_interfaces WHERE id = iface;
  IF NOT got THEN
    RAISE EXCEPTION 'an unspoken interface landed non-searchable';
  END IF;

  -- Spoken false still lands false — the toggle's own path.
  PERFORM public.save_interface(jsonb_build_object(
    'id', iface, 'api_name', 'M726Face', 'label', 'M726 face', 'ontology_id', ont,
    'searchable', false, 'properties', '[]'::jsonb));
  PERFORM public.save_working_state();
  SELECT searchable INTO got FROM public.ontology_interfaces WHERE id = iface;
  IF got THEN
    RAISE EXCEPTION 'a spoken false did not land';
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.ontology_interfaces WHERE id = iface;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
