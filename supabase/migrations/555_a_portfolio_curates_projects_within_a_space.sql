-- Portfolios: curation over projects inside a space. Built from
-- `readings/portfolios-and-space-roles`, Decisions 4-9, approved by the
-- operator. 554 built the space roles this rests on.
--
-- ── CURATION, NOT SECURITY — THE ONE SENTENCE THAT SHAPES EVERYTHING ────────
--   "Portfolios allow users to organize Projects within a Space. Each
--    Portfolio contains many Projects, and each project belongs to a single
--    Portfolio. Any user with access to a Space can view its Portfolios, but
--    users still separately need permissions to view the Projects inside a
--    Portfolio."
--                                              (security/portfolios)
--
-- So a portfolio NEVER appears in an access predicate. Seeing the portfolio
-- does not imply seeing its contents, and the assertion at the bottom proves
-- that on real rows rather than trusting it — C1 made the same "organize,
-- never gate" claim about folders and it was FALSE for ours for months.
--
-- ── N:1, WHICH IS A COLUMN AND NOT A JOIN TABLE ─────────────────────────────
-- "each project belongs to a single Portfolio" is N:1, so membership is a
-- nullable column on the project. A join table would permit exactly the state
-- that sentence forbids, and would need its own uniqueness rule to forbid it
-- again. It also makes the documented move free:
--
--   "Since Projects can only belong to a single Portfolio, moving a Project to
--    another Portfolio will remove it from the first one."
--
-- an UPDATE, which cannot leave a project in two places.
--
-- The per-portfolio display name rides beside it for the same reason — the
-- membership is 1:1 with the project, so the rename has nowhere else to live:
--
--   "After selecting Projects to include in this Portfolio, users have the
--    option to change each Project's display name. This is an optional step."
--
-- ── WHAT MAY BE EDITED, AND WHAT MAY NEVER MOVE ────────────────────────────
--   "Administrators and curators can edit a Portfolio's metadata from the
--    Actions menu in the top right. Name, Description, and Logo are editable,
--    but Portfolios cannot move between Spaces after creation."
--
--   "Administrators and curators can also add Markdown documentation to a
--    portfolio. All users who can view the Portfolio can view this
--    documentation."
--
-- ── CURATORS ARE USERS *OR* GROUPS, FROM THE SCREENSHOT ─────────────────────
-- The prose says "These users"; the sidebar shows two GROUP entries and
-- invites either:
--
--   "Portfolio curators · Add a user or group… · Additional Portfolio Curators
--    · Hospital Curators"          (security/images/portfolio-curators.png)
--
--   "Normally, only users with the `Editor` role on a Space can manage the
--    contents of its Portfolios. To expand Portfolio curation permissions,
--    users with management access can open the sidebar on a Portfolio and edit
--    its list of Curators. These users will have the option to add or remove
--    Projects from this Portfolio, as well as edit its description and
--    documentation."
--
-- ── THE SPLIT BETWEEN THE TWO WORKFLOWS IS OURS, AND SAYS SO ───────────────
-- 554 seeded both published tokens — `manage_portfolios_within_the_space` and
-- `curate_portfolios_within_the_space` — from the expanded Contributor card.
-- No page and no screenshot says which of them creates a portfolio, and the
-- role that holds one holds both, so the boundary cannot be read off anything.
-- Checked, and NOT found, in the five pages the operator supplied:
-- `security/portfolios`, `object-permissioning/ontology-permissions`,
-- `getting-started/orientation-and-nav` and the two announcements.
--
-- INFERENCE, marked: **manage** creates a portfolio and edits its name and
-- logo; **curate** adds and removes projects and edits description and
-- documentation. That is the prose's own division between what administrators
-- do and what the Curators list confers, mapped onto the two token names. If a
-- page later contradicts it, only these predicates change — no table does.

-- ── the portfolio ───────────────────────────────────────────────────────────
CREATE TABLE public.portfolios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  description   text,
  -- "configure the Portfolio's thumbnail with an image or icon color". We have
  -- no media store, so the colour half only; the image half is recorded in the
  -- reading as deferred rather than half-built.
  icon_color    text CHECK (icon_color IS NULL OR icon_color ~ '^#[0-9a-fA-F]{6}$'),
  documentation text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- "Each Portfolio must have a Space and a unique name."
  UNIQUE (space_id, name)
);
COMMENT ON TABLE public.portfolios IS
  'Curation over the projects of one space. Never an access predicate: any user with access to a space can view its portfolios, but still needs permission to view the projects inside.';

CREATE INDEX portfolios_space ON public.portfolios (space_id);

-- "Portfolios cannot move between Spaces after creation."
CREATE OR REPLACE FUNCTION public.guard_portfolio_space()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    RAISE EXCEPTION 'Compass:PortfolioCannotChangeSpace — portfolios cannot move between spaces after creation';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_portfolio_space() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_portfolio_space
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.guard_portfolio_space();

-- ── membership, as a column because the relationship is N:1 ─────────────────
ALTER TABLE public.projects
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  ADD COLUMN portfolio_display_name text;
CREATE INDEX projects_portfolio ON public.projects (portfolio_id) WHERE portfolio_id IS NOT NULL;
COMMENT ON COLUMN public.projects.portfolio_id IS
  'The one portfolio this project belongs to, or none. A column rather than a join table because a project belongs to a single portfolio; moving it is an UPDATE that cannot leave it in two.';
COMMENT ON COLUMN public.projects.portfolio_display_name IS
  'An optional name for this project as shown inside its portfolio.';

-- A portfolio may only hold projects of its own space: "administrators can
-- populate it with Projects from the same Space using the Add Projects dialog".
CREATE OR REPLACE FUNCTION public.guard_portfolio_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE pf_space uuid;
BEGIN
  IF NEW.portfolio_id IS NULL THEN
    -- Leaving a portfolio drops the name that only made sense inside it.
    NEW.portfolio_display_name := NULL;
    RETURN NEW;
  END IF;
  SELECT p.space_id INTO pf_space FROM public.portfolios p WHERE p.id = NEW.portfolio_id;
  IF pf_space IS DISTINCT FROM NEW.space_id THEN
    RAISE EXCEPTION 'Compass:PortfolioSpaceMismatch — a portfolio holds projects of its own space only';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_portfolio_membership() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_portfolio_membership
  BEFORE INSERT OR UPDATE OF portfolio_id, space_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_portfolio_membership();

-- ── curators, user or group ─────────────────────────────────────────────────
CREATE TABLE public.portfolio_curators (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  added_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_curators_one_principal
    CHECK ((user_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX portfolio_curators_user
  ON public.portfolio_curators (portfolio_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX portfolio_curators_group
  ON public.portfolio_curators (portfolio_id, group_id) WHERE group_id IS NOT NULL;

-- ── the two predicates ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_curate_portfolio(p_portfolio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  -- The space workflow, OR this portfolio's own Curators list — which exists
  -- precisely "to expand Portfolio curation permissions".
  SELECT EXISTS (
    SELECT 1 FROM public.portfolios p
     WHERE p.id = p_portfolio
       AND public.has_space_workflow(p.space_id, 'curate_portfolios_within_the_space'))
      OR EXISTS (
    SELECT 1 FROM public.portfolio_curators c
     WHERE c.portfolio_id = p_portfolio
       AND (c.user_id = (SELECT auth.uid())
            OR c.group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[]))))
$fn$;
REVOKE ALL ON FUNCTION public.can_curate_portfolio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_curate_portfolio(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_portfolio(p_portfolio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  -- Management is the space workflow only: the Curators list confers curation,
  -- never administration.
  SELECT EXISTS (
    SELECT 1 FROM public.portfolios p
     WHERE p.id = p_portfolio
       AND public.has_space_workflow(p.space_id, 'manage_portfolios_within_the_space'))
$fn$;
REVOKE ALL ON FUNCTION public.can_manage_portfolio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_portfolio(uuid) TO authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_curators ENABLE ROW LEVEL SECURITY;

-- "Any user with access to a Space can view its Portfolios" — space access and
-- nothing narrower. The projects inside keep their own policies untouched,
-- which is the whole point.
CREATE POLICY "space members read portfolios" ON public.portfolios
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.space_organizations so
                  WHERE so.space_id = portfolios.space_id
                    AND so.organization_id = (SELECT public.auth_org_id())));

CREATE POLICY "managers create portfolios" ON public.portfolios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_space_workflow(space_id, 'manage_portfolios_within_the_space'));

-- Editing metadata is open to both, per "Administrators and curators can edit
-- a Portfolio's metadata".
CREATE POLICY "managers and curators edit portfolios" ON public.portfolios
  FOR UPDATE TO authenticated
  USING (public.can_manage_portfolio(id) OR public.can_curate_portfolio(id))
  WITH CHECK (public.can_manage_portfolio(id) OR public.can_curate_portfolio(id));

CREATE POLICY "managers delete portfolios" ON public.portfolios
  FOR DELETE TO authenticated
  USING (public.can_manage_portfolio(id));

CREATE POLICY "space members read curators" ON public.portfolio_curators
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.portfolios p
                  JOIN public.space_organizations so ON so.space_id = p.space_id
                 WHERE p.id = portfolio_curators.portfolio_id
                   AND so.organization_id = (SELECT public.auth_org_id())));

-- "users with management access can open the sidebar on a Portfolio and edit
-- its list of Curators" — management, not curation. A curator cannot appoint.
CREATE POLICY "managers appoint curators" ON public.portfolio_curators
  FOR ALL TO authenticated
  USING (public.can_manage_portfolio(portfolio_id))
  WITH CHECK (public.can_manage_portfolio(portfolio_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios, public.portfolio_curators TO authenticated;

-- ── the catalog: a view over what member projects have promoted ─────────────
--   "Resources that have been pinned in a project appear in the catalog for a
--    portfolio grouped by project or resource type."
-- A view, because both halves already exist: project membership above, and
-- `projects.promoted` from C2. Nothing new is stored.
CREATE OR REPLACE FUNCTION public.portfolio_catalog(p_portfolio uuid)
RETURNS TABLE (project_id uuid, project_name text, resource_kind text, resource_id uuid)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT p.id, coalesce(p.portfolio_display_name, p.name), r.resource_kind, r.resource_id
    FROM public.projects p
    JOIN public.project_resources r ON r.project_id = p.id
   WHERE p.portfolio_id = p_portfolio
     AND r.trashed_at IS NULL
   ORDER BY p.name, r.resource_kind
$fn$;
REVOKE ALL ON FUNCTION public.portfolio_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portfolio_catalog(uuid) TO authenticated;
COMMENT ON FUNCTION public.portfolio_catalog(uuid) IS
  'Resources of the portfolio''s member projects. SECURITY INVOKER on purpose: the caller sees only the projects and resources their own grants allow, which is what keeps a portfolio curation rather than access.';

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE
  org uuid; org2 uuid; sp uuid; other_sp uuid; pf uuid; pf2 uuid;
  proj uuid; proj_other uuid; proj_hidden uuid; usr uuid; n int; ok boolean;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('pf555org') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('pf555space') RETURNING id INTO sp;
  INSERT INTO public.spaces (name) VALUES ('pf555other') RETURNING id INTO other_sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'pf555@beacon.test') RETURNING id INTO usr;

  INSERT INTO public.portfolios (space_id, name) VALUES (sp, 'Hospital Operations') RETURNING id INTO pf;
  INSERT INTO public.portfolios (space_id, name) VALUES (sp, 'Second') RETURNING id INTO pf2;

  INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'pf555a', 'A') RETURNING id INTO proj;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, other_sp, 'pf555b', 'B') RETURNING id INTO proj_other;

  -- A portfolio cannot leave its space.
  ok := false;
  BEGIN
    UPDATE public.portfolios SET space_id = other_sp WHERE id = pf;
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%PortfolioCannotChangeSpace%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a portfolio moved between spaces'; END IF;

  -- A portfolio holds only its own space's projects.
  ok := false;
  BEGIN
    UPDATE public.projects SET portfolio_id = pf WHERE id = proj_other;
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%PortfolioSpaceMismatch%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a portfolio took a project from another space'; END IF;

  -- Moving between portfolios removes from the first, by construction.
  UPDATE public.projects SET portfolio_id = pf, portfolio_display_name = 'Renamed' WHERE id = proj;
  UPDATE public.projects SET portfolio_id = pf2 WHERE id = proj;
  SELECT count(*) INTO n FROM public.projects WHERE portfolio_id = pf;
  IF n <> 0 THEN RAISE EXCEPTION 'a project stayed in its first portfolio'; END IF;

  -- Leaving a portfolio drops the name that only existed inside one.
  UPDATE public.projects SET portfolio_id = NULL WHERE id = proj;
  SELECT count(*) INTO n FROM public.projects
   WHERE id = proj AND portfolio_display_name IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'a portfolio display name outlived its portfolio'; END IF;

  -- THE ONE THAT MATTERS: a portfolio is not an access predicate. The caller
  -- sees the portfolio and still cannot see a project inside it. Executed as
  -- `authenticated`, since RLS is the subject and the owner is exempt from it.
  --
  -- Isolating this took two corrections, both worth recording because each was
  -- a test that would have "passed" while proving nothing:
  --
  --   1. The first caller was an org admin, and `admins and owners write
  --      projects` is a FOR ALL policy — so it admits SELECT too.
  --   2. The second was a plain member of the SAME organization, and project
  --      visibility here is `resource_file_access`: organization plus markings,
  --      and NOT role grants. A same-org member can read any project of that
  --      org, so "has no grant on" was never the thing making it invisible.
  --
  -- So the hidden project belongs to a SECOND organization that the space also
  -- serves. The caller can reach the space (hence the portfolio) and cannot
  -- reach that organization's projects — leaving portfolio membership as the
  -- only thing that could expose it, which is exactly the claim under test.
  INSERT INTO public.organizations (name) VALUES ('pf555org2') RETURNING id INTO org2;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org2);
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org2, sp, 'pf555hidden', 'Hidden') RETURNING id INTO proj_hidden;
  UPDATE public.projects SET portfolio_id = pf2 WHERE id = proj_hidden;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'team_member', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.portfolios WHERE id = pf2;
  IF n <> 1 THEN
    RESET ROLE;
    RAISE EXCEPTION 'a space member could not see a portfolio of their space';
  END IF;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj_hidden;
  IF n <> 0 THEN
    RESET ROLE;
    RAISE EXCEPTION 'membership of a visible portfolio exposed another organization''s project';
  END IF;
  -- And the catalog inherits the same refusal, because it is SECURITY INVOKER.
  SELECT count(*) INTO n FROM public.portfolio_catalog(pf2);
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'the catalog exposed resources of a project the caller cannot see';
  END IF;

  RAISE NOTICE '555: a portfolio curates projects within a space';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;
