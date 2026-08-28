-- 722 — ontology_role() answers, and the configuration gate becomes passable
-- (creation review F6.1, proven live during #893: guard_ontology_configuration
-- refused everyone, because ontology_role_grants has no seeder and no surface,
-- so the owner-only toggle was unflippable by anyone).
--
-- The docs' shape ties an ontology's grants to its space:
--
--   "A shared ontology is automatically created when a new shared space is
--    created. It holds the same organizations markings and role grants as
--    the shared space."
--   — ontologies/shared-ontologies.md
--
-- Our space roles are WORKFLOW bundles (554-556) with no mapping onto
-- viewer/editor/owner, and no workflow catalogue exists to define one — the
-- recorded standing gap. Until that catalogue lands, the operator chose the
-- BRIDGE (gate decision 2026-08-28): an explicit ontology_role_grants row
-- wins; absent one, an organization owner or admin of an org in the
-- ontology's space answers 'owner' — the platform's whole user vocabulary
-- today (users_role_check: owner|admin), composed the way every other gate
-- composes auth_role. SCOPE: the bridge dissolves when space-role
-- derivation is built; nothing else may grow on it.

CREATE OR REPLACE FUNCTION public.ontology_role(p_ontology uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT coalesce(
    (SELECT g.role FROM public.ontology_role_grants g
      WHERE g.ontology_id = p_ontology AND g.user_id = auth.uid()),
    (SELECT 'owner' FROM public.ontologies o
       JOIN public.space_organizations so ON so.space_id = o.space_id
       JOIN public.users u ON u.organization_id = so.organization_id
      WHERE o.id = p_ontology AND u.id = auth.uid()
        AND u.role IN ('owner', 'admin')
      LIMIT 1))
$function$;

COMMENT ON FUNCTION public.ontology_role(uuid) IS
  'An explicit grant wins; absent one, an organization owner/admin of an org in the ontology''s space answers owner — the 722 BRIDGE, standing in for the space-role derivation shared-ontologies describes until a workflow catalogue can map space roles onto viewer/editor/owner. The bridge dissolves then; nothing else may grow on it.';

-- ── PROVED BY DOING — the gate passes, the override overrides, self-clean ───

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; got text; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m722 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm722-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm722-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M722 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;

  -- The bridge: no explicit grant, org admin, in the space -> owner.
  SELECT public.ontology_role(ont) INTO got;
  IF got IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'the bridge did not answer owner (got %)', coalesce(got, 'NULL');
  END IF;

  -- The gate it unblocks, EXECUTED: the toggle 454 guards flips.
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  SELECT count(*) INTO n FROM public.ontologies
   WHERE id = ont AND require_resources_in_project = false;
  IF n <> 1 THEN RAISE EXCEPTION 'the toggle did not flip'; END IF;

  -- An explicit grant OVERRIDES the bridge, downward included.
  INSERT INTO public.ontology_role_grants (ontology_id, user_id, role)
  VALUES (ont, usr, 'viewer');
  SELECT public.ontology_role(ont) INTO got;
  IF got IS DISTINCT FROM 'viewer' THEN
    RAISE EXCEPTION 'the explicit grant did not override (got %)', coalesce(got, 'NULL');
  END IF;
  BEGIN
    UPDATE public.ontologies SET require_resources_in_project = true WHERE id = ont;
    RAISE EXCEPTION 'a viewer flipped the configuration';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%OwnerOnly%' THEN RAISE; END IF;
  END;

  -- An outsider (no grant, no org in the space) answers NULL.
  DELETE FROM public.ontology_role_grants WHERE ontology_id = ont;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'app_metadata',
      json_build_object('role', 'admin', 'org_id', gen_random_uuid()))::text, true);
  SELECT public.ontology_role(ont) INTO got;
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'an outsider got a role (%)', got;
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
