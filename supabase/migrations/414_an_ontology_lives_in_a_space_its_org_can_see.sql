-- 414 — an ontology lives in a space its organization can actually see
--
-- Found by verifying 412 end-to-end as `authenticated` rather than trusting it:
-- the ontology was created, but reading back its space returned NULL. The space
-- was invisible to the caller, because a space is only visible through
-- `space_organizations` —
--
--   USING (EXISTS (SELECT 1 FROM space_organizations so
--                   WHERE so.space_id = spaces.id
--                     AND NOT (so.organization_id IS DISTINCT FROM auth_org_id())))
--
-- — and nothing had linked them. 412 let an ontology be created in a space its
-- own organization is not attached to: readable by nobody, and pointing at a
-- space that may serve entirely different tenants.
--
-- This is the fourth time this shape has appeared here — 395 (tenant check on
-- read but not write), 403 (markings on read but not write), 412 (this) — and
-- the fix is the same one that worked in 412: make it a COMPOSITE FOREIGN KEY
-- rather than a trigger. `space_organizations` is already keyed on exactly the
-- pair, so the rule becomes unstateable rather than restated.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.ontologies o
   WHERE NOT EXISTS (SELECT 1 FROM public.space_organizations so
                      WHERE so.space_id = o.space_id
                        AND so.organization_id = o.organization_id);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 414: % ontolog(ies) sit in a space their organization is not attached to. Attach them before this runs.', n;
  END IF;
END $$;

ALTER TABLE public.ontologies
  ADD CONSTRAINT ontologies_space_organization_fkey
  FOREIGN KEY (space_id, organization_id)
  REFERENCES public.space_organizations (space_id, organization_id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT ontologies_space_organization_fkey ON public.ontologies IS
  'An ontology''s organization must be one the space actually serves. Without this an ontology can be created in a space no one in that organization can see, because the spaces policy reads through space_organizations.';

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; other_org uuid; sp uuid; ont uuid;
  usr uuid := gen_random_uuid(); claims text; before text; visible int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '414@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m414') RETURNING id INTO org;
  INSERT INTO public.organizations (name) VALUES ('m414 other') RETURNING id INTO other_org;
  INSERT INTO public.spaces (name) VALUES ('m414 space') RETURNING id INTO sp;

  -- The hole, refused: the space serves nobody yet.
  BEGIN
    INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
         VALUES (sp, org, 'orphan', 'Orphan');
    RAISE EXCEPTION 'Migration 414: an ontology was created in a space with no organizations';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- And refused when the space serves a DIFFERENT organization.
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, other_org);
  BEGIN
    INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
         VALUES (sp, org, 'trespass', 'Trespass');
    RAISE EXCEPTION 'Migration 414: an ontology claimed a space belonging to another organization';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Attached, it works — and now the space is readable by the role that owns it.
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'prod', 'Production') RETURNING id INTO ont;

  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);

  -- The check the original verification actually failed. An ontology whose space
  -- the caller cannot read is an ontology with no path and no picker entry.
  SELECT count(*) INTO visible FROM public.spaces WHERE id = sp;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'Migration 414: the ontology''s space is still invisible to its own organization';
  END IF;

  IF (SELECT s.path FROM public.ontologies o JOIN public.spaces s ON s.id = o.space_id
       WHERE o.id = ont) IS NULL THEN
    RAISE EXCEPTION 'Migration 414: the ontology has no resolvable space path';
  END IF;

  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id IN (org, other_org);
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
