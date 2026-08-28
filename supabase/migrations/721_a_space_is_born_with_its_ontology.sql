-- 721 — creating a space creates its ontology, in the same operation
-- (creation review, F5).
--
--   "An ontology is mapped 1:1 with a space. When a new space is created, a
--    corresponding ontology with the same name is simultaneously created
--    with the same organization markings as the space."
--   — ontologies/ontologies-overview.md
--
--   "A shared ontology is automatically created when a new shared space is
--    created. It holds the same organizations markings and role grants as
--    the shared space."
--   — ontologies/shared-ontologies.md
--
-- Ours inverted it: create_space (424) wrote spaces + space_organizations
-- and stopped, the ontology arriving as a separate insert from the OMA
-- picker — so a space created any other way never got one, and 424's own
-- assertion designed the ontology-less space in as a normal state. That
-- state is superseded: the picker's create flow remains for any legacy bare
-- space (production holds none — 1 space, 1 ontology, 0 bare, measured at
-- landing), but every space born through create_space now arrives with its
-- ontology, same name, same organization list by construction (the
-- organizations of an ontology ARE its space's list, 441).
--
-- The api_name derives from the space name; ontologies.api_name is globally
-- UNIQUE (441), so a collision takes a short suffix rather than failing the
-- space.

CREATE OR REPLACE FUNCTION public.create_space(p_name text, p_description text DEFAULT ''::text)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_space uuid := gen_random_uuid();
  v_org   uuid := public.auth_org_id();
  v_slug  text;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Compass:NoOrganization — a space is created for an organization and this session has none'
      USING HINT = 'The organizations a space serves are chosen when it is created; there is nothing to choose from without a session organization.';
  END IF;

  INSERT INTO public.spaces (id, name, description)
  VALUES (v_space, p_name, coalesce(p_description, ''));

  -- The access requirement, in the same statement's transaction. Membership of
  -- at least one organization is what grants access to the space at all.
  INSERT INTO public.space_organizations (space_id, organization_id)
  VALUES (v_space, v_org);

  -- "a corresponding ontology with the same name is simultaneously created":
  -- same name, same space, and therefore the same organization list.
  v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '_', 'g');
  v_slug := regexp_replace(v_slug, '^_+|_+$', '', 'g');
  IF v_slug !~ '^[a-z][a-z0-9_]*$' THEN v_slug := 'ontology'; END IF;
  IF EXISTS (SELECT 1 FROM public.ontologies o WHERE o.api_name = v_slug) THEN
    v_slug := v_slug || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (v_space, v_slug, p_name);

  RETURN v_space;
END $function$;

COMMENT ON FUNCTION public.create_space(text, text) IS
  'One operation makes the space usable: the row, its organization, and — since 721 — its ontology, simultaneously and with the same name, the way ontologies-overview describes. 424''s ontology-less space is a legacy state the picker still tolerates, not one this function produces.';

-- ── PROVED BY DOING — the born-together pair, and the collision suffix ──────

DO $$
DECLARE
  org uuid; usr uuid; sp1 uuid; sp2 uuid; o1 record; o2 record; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m721 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm721-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm721-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M721 Probe Space') INTO sp1;
  SELECT * INTO o1 FROM public.ontologies WHERE space_id = sp1;
  IF o1 IS NULL THEN RAISE EXCEPTION 'the space was born without its ontology'; END IF;
  IF o1.label <> 'M721 Probe Space' THEN
    RAISE EXCEPTION 'the ontology did not take the space''s name: %', o1.label;
  END IF;
  IF o1.api_name <> 'm721_probe_space' THEN
    RAISE EXCEPTION 'unexpected api_name %', o1.api_name;
  END IF;

  -- The same name again: the ontology still lands, suffixed, and the space
  -- is never the casualty of an api_name collision.
  SELECT public.create_space('M721 Probe Space') INTO sp2;
  SELECT * INTO o2 FROM public.ontologies WHERE space_id = sp2;
  IF o2 IS NULL THEN RAISE EXCEPTION 'the colliding space was born without its ontology'; END IF;
  IF o2.api_name !~ '^m721_probe_space_[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'collision suffix missing: %', o2.api_name;
  END IF;

  -- One ontology per space still holds (412's UNIQUE untouched).
  SELECT count(*) INTO n FROM public.ontologies WHERE space_id IN (sp1, sp2);
  IF n <> 2 THEN RAISE EXCEPTION 'expected exactly one ontology per space, found % across two', n; END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.ontologies WHERE space_id IN (sp1, sp2);
  DELETE FROM public.space_organizations WHERE space_id IN (sp1, sp2);
  DELETE FROM public.spaces WHERE id IN (sp1, sp2);
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
