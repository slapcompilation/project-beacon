-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 397 — spaces, and the first element of every resource path.
--
-- Reading: docs/foundry-reference/readings/spaces-and-the-resource-path.md
--
-- We render a dataset's Location as `/<project>/<dataset>`. Foundry's is
-- `space/project/sub-folder/my-file` (`security/orgs-and-spaces`) — the first
-- element is missing, and there was no space to put there.
--
-- `space-settings.png` shows the whole space settings page: two cards, and this
-- migration is both of them.
--
--   Space details        Name (editable) · Path (GREYED) · Description (optional)
--   Access requirements  "To access this space, users must be a member of at
--                        least one of the selected organizations below.
--                        Additional requirements may need to be met for project
--                        access."
--
-- THE PATH. Shown as `/Test Space-5adf6d`. Three things follow from the pixels:
--   • the display name survives verbatim, space character and all — not a slug
--   • six hex characters are appended, so two spaces may share a name
--   • the field is greyed while Name above it is not, so a rename must NOT move
--     every resource in the space. It is captured at insert, never derived.
--
-- WHAT IS NOT HERE, on purpose:
--   • Space roles. `space-permissions.png` shows them as WORKFLOW BUNDLES —
--     Contributor grants 5 named workflows, Space Administrator grants 61 — not
--     a rank ladder like project roles. Different mechanism, different page, and
--     there are no workflows to bundle yet.
--   • Projects holding a SUBSET of the space's organizations. Foundry's take
--     "any subset"; ours take exactly one. A set of size one is a valid subset,
--     so this is a narrowing rather than a wrong shape, and widening it would
--     rewrite every RLS policy for a benefit that needs cross-org collaboration.
--   • Deletion policy, Filesystem, Usage account, Resource queue, Role set,
--     Maven identifier, Owned/Shared, project templates, inherited role
--     contexts. Each belongs to a system we do not have.
--   • A RID. No space RID appears anywhere in the mirror.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE public.spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  -- Set by the trigger below and refused thereafter — the greyed field.
  path        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.spaces IS
  'A high-level container of projects, restricted by a set of organizations. "Most organizations will only need a single space, inside which all projects will be created."';
COMMENT ON COLUMN public.spaces.path IS
  'The first element of every resource path below this space: /<Name>-<6 hex>, as Control Panel shows it. Immutable — renaming a space must not move its contents.';

-- "To access this space, users must be a member of at least one of the selected
-- organizations below." A set, not a column: a space may be shared between
-- organizations, which is the entire reason spaces exist.
CREATE TABLE public.space_organizations (
  space_id        uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, organization_id)
);

COMMENT ON TABLE public.space_organizations IS
  'The space''s access requirements. Membership of at least one grants access to the space; the project inside it may still demand more.';

CREATE OR REPLACE FUNCTION public.set_space_path()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- The name verbatim — `/Test Space-5adf6d` keeps its space character — plus
    -- six hex from the row's own id, so two spaces may share a name.
    NEW.path := '/' || btrim(NEW.name) || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
    RETURN NEW;
  END IF;
  IF NEW.path IS DISTINCT FROM OLD.path THEN
    RAISE EXCEPTION 'Compass:SpacePathIsImmutable — a space path is fixed at creation; renaming a space must not move everything inside it'
      USING HINT = 'Change the name instead. The path keeps its original value, which is what the greyed field in Control Panel means.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER set_space_path
  BEFORE INSERT OR UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_space_path();

-- A project lives in a space. Nullable for now: projects predate spaces and the
-- surface has to be able to create the first space before it can require one.
ALTER TABLE public.projects
  ADD COLUMN space_id uuid REFERENCES public.spaces(id) ON DELETE RESTRICT;

CREATE INDEX projects_space_idx ON public.projects (space_id);

COMMENT ON COLUMN public.projects.space_id IS
  'The space this project lives in. Its path is the first element of every resource location below it.';

-- The Location string, in one place. Foundry: "The file path of a Foundry
-- resource… indicates the space as the first element of the path: for example,
-- space/project/sub-folder/my-file."
CREATE OR REPLACE FUNCTION public.resource_location(p_project uuid, p_name text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(s.path, '') || '/' || p.api_name || '/' || p_name
    FROM public.projects p
    LEFT JOIN public.spaces s ON s.id = p.space_id
   WHERE p.id = p_project
$$;

COMMENT ON FUNCTION public.resource_location(uuid, text) IS
  'A resource''s filepath: /<space path>/<project>/<name>. Falls back to /<project>/<name> while a project has no space, which is the pre-397 shape.';

-- Read is org scope through the membership set; write is an org admin. There is
-- no space role model yet (see the header), so this deliberately does not invent
-- one — an org admin manages their own spaces and nothing finer.
CREATE POLICY "members read their spaces" ON public.spaces
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = spaces.id
       AND so.organization_id IS NOT DISTINCT FROM public.auth_org_id()));

CREATE POLICY "admins write their spaces" ON public.spaces
  FOR ALL
  USING (public.auth_role() IN ('owner','admin') AND EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = spaces.id
       AND so.organization_id IS NOT DISTINCT FROM public.auth_org_id()))
  WITH CHECK (public.auth_role() IN ('owner','admin'));

CREATE POLICY "members read space organizations" ON public.space_organizations
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM public.auth_org_id());

CREATE POLICY "admins write space organizations" ON public.space_organizations
  FOR ALL
  USING (public.auth_role() IN ('owner','admin')
         AND organization_id IS NOT DISTINCT FROM public.auth_org_id())
  WITH CHECK (public.auth_role() IN ('owner','admin')
         AND organization_id IS NOT DISTINCT FROM public.auth_org_id());

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; p text; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m397') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('Test Space') RETURNING id, path INTO sp, p;

  -- `/Test Space-5adf6d`: leading slash, name verbatim including the space
  -- character, six hex. A slugged path would be a different product.
  IF p !~ '^/Test Space-[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'Migration 397: path is % — expected /Test Space-<6 hex>', p;
  END IF;

  -- The greyed field, enforced.
  BEGIN
    UPDATE public.spaces SET path = '/hijacked' WHERE id = sp;
    RAISE EXCEPTION 'Migration 397: the space path was editable';
  EXCEPTION WHEN OTHERS THEN
    IF position('SpacePathIsImmutable' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- Renaming keeps the path, which is the whole reason it is captured.
  UPDATE public.spaces SET name = 'Renamed' WHERE id = sp;
  IF (SELECT path FROM public.spaces WHERE id = sp) <> p THEN
    RAISE EXCEPTION 'Migration 397: renaming a space moved its contents';
  END IF;

  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.projects (organization_id, api_name, name, space_id)
       VALUES (org, 'm397', 'm397', sp) RETURNING id INTO proj;

  IF public.resource_location(proj, 'airlines') <> p || '/m397/airlines' THEN
    RAISE EXCEPTION 'Migration 397: location is %, expected %',
      public.resource_location(proj, 'airlines'), p || '/m397/airlines';
  END IF;

  -- A project with no space still resolves, or every existing row breaks.
  UPDATE public.projects SET space_id = NULL WHERE id = proj;
  IF public.resource_location(proj, 'airlines') <> '/m397/airlines' THEN
    RAISE EXCEPTION 'Migration 397: a space-less project lost its location';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.projects      WHERE id = proj;
  DELETE FROM public.spaces        WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
END $$;

COMMIT;
