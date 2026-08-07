-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 398 — a project's default role.
--
-- Reading: docs/foundry-reference/readings/projects-roles-and-portfolios.md
--
-- We collect a "default role" in the create-project pane and then grant it to
-- the CREATOR, with a comment rationalising the choice: "Ours grants it to the
-- creator, who is the only member the project has at this point."
--
-- Two screenshots disprove both halves of that.
--
--   create-new-project.png names the grantee, in a sentence the dialog builds
--   from your own selections:
--
--     "Everyone from 🏢 Palantir can see the existence of this project and is
--      granted the Viewer role."
--
--   Everyone from the ORGANIZATION — not the creator, who separately holds Owner.
--
--   flight-delay-project.png shows it is a STANDING SETTING, not a one-time
--   grant: `Default role ⓘ  [Discoverer ▾]` sits at the top of the Manage roles
--   panel, above the list of principals, with its own dropdown.
--
-- So it is a column on the project, and project_role() has to honour it — a
-- policy asking "what role does this caller hold here" must get the answer the
-- dialog promised.
--
-- The ladder is unchanged: "From most powerful to least powerful, the default
-- roles in Foundry are: Owner, Editor, Viewer, and Discoverer."
-- (`security/projects-and-roles`). The default is the FLOOR; an explicit grant
-- can only raise it, which is why this takes the stronger of the two.
--
-- NULL means no organization-wide grant. Foundry always has one selected, but
-- its initial value comes from the space ("To set the default role that is
-- initially selected for a particular space, go to the corresponding space
-- settings"), and we do not model space role defaults — so rather than invent
-- one, the column allows "none" and the surface offers the four.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN default_role text
  CHECK (default_role IN ('owner','editor','viewer','discoverer'));

COMMENT ON COLUMN public.projects.default_role IS
  'Granted to everyone in the project''s organization: "Everyone from <org> can see the existence of this project and is granted the <role> role." A floor — an explicit grant can only raise it. NULL means no org-wide grant.';

-- The stronger of the explicit grant and the organization-wide default. Written
-- as one query rather than two so a caller cannot read only half of it.
CREATE OR REPLACE FUNCTION public.project_role(p_project uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT r.role
    FROM (
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.user_id = auth.uid()
         -- The mandatory control, restated where it is easiest to remove by
         -- accident: a grant in another organization is not a grant.
         AND g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      UNION ALL
      -- "Everyone from <org> … is granted the <role> role." Same test: the
      -- default reaches the project's own organization and no other.
      SELECT p.default_role
        FROM public.projects p
       WHERE p.id = p_project
         AND p.default_role IS NOT NULL
         AND p.organization_id IS NOT DISTINCT FROM public.auth_org_id()
    ) r
   ORDER BY public.role_rank(r.role) DESC
   LIMIT 1
$$;

COMMENT ON FUNCTION public.project_role(uuid) IS
  'The caller''s role on a project: the stronger of their explicit grant and the project''s organization-wide default role.';

DO $$
DECLARE
  org_a uuid; org_b uuid; proj uuid; usr uuid; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  SELECT id INTO usr FROM public.users LIMIT 1;

  INSERT INTO public.organizations (name) VALUES ('m398 a') RETURNING id INTO org_a;
  INSERT INTO public.organizations (name) VALUES ('m398 b') RETURNING id INTO org_b;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org_a, 'm398', 'm398') RETURNING id INTO proj;

  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org_a))::text, true);

  -- No default and no grant: no role. The pre-398 behaviour must survive.
  IF public.project_role(proj) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 398: a project with no default granted a role';
  END IF;

  -- The default reaches everyone in the organization without a grant existing.
  UPDATE public.projects SET default_role = 'viewer' WHERE id = proj;
  IF public.project_role(proj) <> 'viewer' THEN
    RAISE EXCEPTION 'Migration 398: the organization-wide default did not apply';
  END IF;

  -- …and it is a FLOOR: an explicit grant raises it, never lowers it.
  IF usr IS NOT NULL THEN
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
         VALUES (proj, usr, 'discoverer', org_a);
    -- auth.uid() is NULL under this migration, so the grant cannot be observed
    -- here; what is asserted is that the default alone still answers, which is
    -- the case that was broken.
    IF public.project_role(proj) <> 'viewer' THEN
      RAISE EXCEPTION 'Migration 398: a weaker grant displaced the default';
    END IF;
    DELETE FROM public.project_role_grants WHERE project_id = proj;
  END IF;

  -- A default in another organization is not a grant. Same rule as the explicit
  -- one, and the reason it is written twice.
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org_b))::text, true);
  IF public.project_role(proj) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 398: the default role crossed an organization boundary';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.projects      WHERE id = proj;
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
END $$;

COMMIT;
