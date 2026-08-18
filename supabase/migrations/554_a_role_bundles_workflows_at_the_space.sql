-- Space permissions: a role is a bundle of workflows, granted to users or
-- groups — the same mechanism 540 built one level down, at the Organization.
-- Built from `readings/portfolios-and-space-roles`, whose Decisions block the
-- operator approved.
--
-- ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
-- Portfolios are gated on a space role and we had none: space access was
-- organization membership and nothing else. So the prerequisite is built first
-- and portfolios follow, rather than approximating the gate with org admin.
--
-- ── WHAT THE PAGE SAYS THE MODEL IS ─────────────────────────────────────────
--   "From the Space permissions page in Control Panel, you can set the roles
--    users have in the space. Each space comes with a set of default roles and
--    the ability to create custom roles for greater flexibility in managing
--    permissions. For each role, you can open the workflows dropdown menu to
--    view the permissions granted with the role."
--
--   "To create a custom role, select + New role in the top right of the page,
--    then select which workflows to include with this role."
--
--   "Users must have a role on the space and meet its access requirements to
--    create projects or manage space settings."
--                    (platform-security-management/manage-orgs-and-spaces)
--
-- ── THERE IS NO "EDITOR" ROLE ON A SPACE, AND THAT NEARLY BECAME SCHEMA ──────
-- `security/portfolios` gates creation on "the Editor role on a Space". No such
-- role exists. `space-permissions.png` publishes the three defaults —
-- Contributor, Project Templates Administrator, Space Administrator — and the
-- portfolio workflows sit on Contributor. "Editor" is prose shorthand for
-- whoever holds those workflows. Taking the word literally would have invented
-- a fourth role, which is the two-vocabularies trap in its usual shape.
--
-- ── THESE ARE NOT ROLE SETS, AND THE PROOF IS STRUCTURAL ────────────────────
-- `manage-roles` describes role sets — Organization-owned groups of roles that
-- a space points at, governing the roles usable on projects, folders and files
-- INSIDE the space. They are a different object:
--
--   "Currently, the three available contexts for role sets are the Project
--    context, Ontology context, and Marketplace Installation context."
--
-- No Space context. So the roles ON a space are the space's own, per the page
-- above, and that is why space_id NULL means "default, offered to every space"
-- exactly as organization_id NULL does in 540.
--
-- ── THE WORKFLOW TOKENS, AND WHAT IS DELIBERATELY ABSENT ────────────────────
-- Only what a screenshot publishes. `space-permissions.png` shows Contributor
-- expanded with all five of its workflows, so Contributor is COMPLETE:
--
--   "Contributor · Default role · Can create projects.
--    Grants 5 workflows · Hide details
--    Workflows
--      Create project
--      Curate portfolios within the space
--      Manage portfolios within the space
--      Manage value types
--      View value types"
--                (platform-security-management/images/space-permissions.png)
--
-- The other two cards are COLLAPSED — "Grants 1 workflow" and "Grants 61
-- workflows" — so they get their published names and descriptions and NO
-- workflow rows. That is 540's rule and 542's exception in one migration: a
-- role's contents are published one card at a time, wherever a page happens to
-- include an expanded one.
--
-- The contents are not merely unphotographed, they are not documentation at
-- all: `api/v2/admin-v2-resources/organizations-list-available-roles-organization`
-- returns each role with its `operations`, so the catalogue is served rather
-- than published. Inventing the other 62 would be inventing an API response.
--
-- Token spelling follows 542's `oversee_progress_in_upgrade_assistant` — a
-- snake_case slug of the published display name. OPEN, and recorded in the
-- reading rather than settled here: whether Foundry's own key is the display
-- name or the operation identifier (`service:action`). No mirrored page returns
-- operations for a non-organization role type, so this cannot be answered yet;
-- if it resolves to identifiers, both this table and 540's change together.

-- ── the roles ───────────────────────────────────────────────────────────────
CREATE TABLE public.space_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL means a default role: "Each space comes with a set of default roles".
  -- A custom role names its space, because it was created on that space's
  -- permissions page.
  space_id     uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  api_name     text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description  text,
  -- "Custom roles are 'frozen', meaning that new workflows added to default
  -- roles will not automatically apply to custom roles." Stored so the freeze
  -- is a fact about the row rather than a rule someone has to remember.
  frozen       boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, api_name),
  -- A default role is Palantir's and is never frozen; freezing describes a copy.
  CONSTRAINT space_roles_default_is_not_frozen
    CHECK (space_id IS NOT NULL OR NOT frozen)
);
COMMENT ON TABLE public.space_roles IS
  'A role on a space: a bundle of workflows granted to users or groups. space_id NULL is a default role available to every space; a custom role names its own. Not a role set — role sets are Organization-owned and have no Space context.';

CREATE UNIQUE INDEX space_roles_default_api_name
  ON public.space_roles (api_name) WHERE space_id IS NULL;
CREATE INDEX space_roles_space ON public.space_roles (space_id);

-- ── the workflows a role confers ────────────────────────────────────────────
CREATE TABLE public.space_role_workflows (
  role_id  uuid NOT NULL REFERENCES public.space_roles(id) ON DELETE CASCADE,
  workflow text NOT NULL CHECK (workflow ~ '^[a-z][a-z0-9_]*$'),
  PRIMARY KEY (role_id, workflow)
);
COMMENT ON TABLE public.space_role_workflows IS
  'The workflows a role confers. Seeded only from an expanded role card; a collapsed one contributes its name and nothing else.';

-- ── who holds a role ────────────────────────────────────────────────────────
CREATE TABLE public.space_role_grants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES public.space_roles(id) ON DELETE CASCADE,
  -- "Add a user or group…" on the Manage privileges rail — one or the other.
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id   uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT space_role_grants_one_principal
    CHECK ((user_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX space_role_grants_user
  ON public.space_role_grants (space_id, role_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX space_role_grants_group
  ON public.space_role_grants (space_id, role_id, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX space_role_grants_space ON public.space_role_grants (space_id);

-- A custom role may only be granted on the space that owns it.
CREATE OR REPLACE FUNCTION public.guard_space_role_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE owner_space uuid;
BEGIN
  SELECT r.space_id INTO owner_space FROM public.space_roles r WHERE r.id = NEW.role_id;
  IF owner_space IS NOT NULL AND owner_space <> NEW.space_id THEN
    RAISE EXCEPTION 'Permissions:RoleNotOnThisSpace — a custom space role belongs to the space it was created on';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_space_role_grant() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_space_role_grant
  BEFORE INSERT OR UPDATE ON public.space_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.guard_space_role_grant();

-- ── the predicate ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.space_workflows(p_space uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH held AS (
    SELECT g.role_id
      FROM public.space_role_grants g
     WHERE g.space_id = p_space
       AND (g.user_id = (SELECT auth.uid())
            OR g.group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[])))
  ),
  -- "Has full control over the space: security, project templates, and
  -- settings." Read as subsumption, the same way organization_administrator
  -- reads "Incorporate all workflows from other roles of that level" — and
  -- corroborated by the counts, since 61 dwarfs the other two cards' six.
  -- INFERENCE, marked: the space page states full control in prose rather than
  -- naming incorporation the way the organization page does.
  admin AS (
    SELECT EXISTS (
      SELECT 1 FROM held h JOIN public.space_roles r ON r.id = h.role_id
       WHERE r.api_name = 'space_administrator') AS is_admin
  )
  SELECT COALESCE(array_agg(DISTINCT w.workflow), '{}')
    FROM public.space_role_workflows w
    JOIN public.space_roles r ON r.id = w.role_id
   WHERE (r.space_id IS NULL OR r.space_id = p_space)
     AND (w.role_id IN (SELECT role_id FROM held)
          OR (SELECT is_admin FROM admin))
$fn$;
REVOKE ALL ON FUNCTION public.space_workflows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.space_workflows(uuid) TO authenticated;
COMMENT ON FUNCTION public.space_workflows(uuid) IS
  'The workflows the caller holds on one space, through roles granted to them or to a group they are in. A Space Administrator has full control over the space and so incorporates the rest.';

CREATE OR REPLACE FUNCTION public.has_space_workflow(p_space uuid, p_workflow text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT p_workflow = ANY (public.space_workflows(p_space))
$fn$;
REVOKE ALL ON FUNCTION public.has_space_workflow(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_space_workflow(uuid, text) TO authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.space_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_role_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_role_grants ENABLE ROW LEVEL SECURITY;

-- Default roles are the platform's vocabulary and are offered to every space;
-- a custom role is visible to members of the space that owns it.
CREATE POLICY "default roles are visible to everyone" ON public.space_roles
  FOR SELECT TO authenticated
  USING (
    space_id IS NULL
    OR EXISTS (SELECT 1 FROM public.space_organizations so
                WHERE so.space_id = space_roles.space_id
                  AND so.organization_id = (SELECT public.auth_org_id()))
  );

CREATE POLICY "a role's workflows are visible with the role" ON public.space_role_workflows
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.space_roles r WHERE r.id = space_role_workflows.role_id));

CREATE POLICY "space members see grants on their space" ON public.space_role_grants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.space_organizations so
                  WHERE so.space_id = space_role_grants.space_id
                    AND so.organization_id = (SELECT public.auth_org_id())));

-- Granting a role is itself a space-administration act.
CREATE POLICY "space administrators grant roles" ON public.space_role_grants
  FOR ALL TO authenticated
  USING (public.has_space_workflow(space_role_grants.space_id, 'manage_space_permissions'))
  WITH CHECK (public.has_space_workflow(space_role_grants.space_id, 'manage_space_permissions'));

GRANT SELECT ON public.space_roles, public.space_role_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_role_grants TO authenticated;

-- ── the three published default roles ───────────────────────────────────────
INSERT INTO public.space_roles (space_id, api_name, display_name, description) VALUES
  (NULL, 'contributor', 'Contributor', 'Can create projects.'),
  (NULL, 'project_templates_administrator', 'Project Templates Administrator',
   'Create, edit, and delete project templates.'),
  (NULL, 'space_administrator', 'Space Administrator',
   'Has full control over the space: security, project templates, and settings.');

-- Contributor's card is expanded in the screenshot, so its five are complete.
INSERT INTO public.space_role_workflows (role_id, workflow)
SELECT r.id, w.workflow
  FROM public.space_roles r
  CROSS JOIN (VALUES
    ('create_project'),
    ('curate_portfolios_within_the_space'),
    ('manage_portfolios_within_the_space'),
    ('manage_value_types'),
    ('view_value_types')
  ) AS w(workflow)
 WHERE r.space_id IS NULL AND r.api_name = 'contributor';

-- `manage_space_permissions` is the workflow the grant policy above tests, and
-- it is OURS rather than a published token: no card names the workflow that
-- lets someone grant roles. It is given to nobody, so only a Space
-- Administrator — who subsumes — can grant. Recorded here rather than invented
-- into a role's contents, the same way 540 left `view_group_membership` in no
-- default role.

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; sp uuid; org uuid; usr uuid; role_id uuid; got text[];
BEGIN
  -- The three defaults exist, and only Contributor carries workflows.
  SELECT count(*) INTO n FROM public.space_roles WHERE space_id IS NULL;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 default space roles, found %', n; END IF;

  SELECT count(*) INTO n
    FROM public.space_role_workflows w
    JOIN public.space_roles r ON r.id = w.role_id
   WHERE r.space_id IS NULL AND r.api_name <> 'contributor';
  IF n <> 0 THEN
    RAISE EXCEPTION '% workflow(s) invented for a role whose card is collapsed', n;
  END IF;

  SELECT count(*) INTO n
    FROM public.space_role_workflows w
    JOIN public.space_roles r ON r.id = w.role_id
   WHERE r.space_id IS NULL AND r.api_name = 'contributor';
  IF n <> 5 THEN RAISE EXCEPTION 'Contributor should carry its published 5, has %', n; END IF;

  -- The predicate answers for a real grant, as the real role. Built here
  -- rather than asserted structurally, because 514's lesson is that a text
  -- search over a function body proves the edit landed and nothing else.
  INSERT INTO public.organizations (name) VALUES ('caps554org') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('caps554space') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'caps554@beacon.test')
    RETURNING id INTO usr;

  SELECT id INTO role_id FROM public.space_roles
   WHERE space_id IS NULL AND api_name = 'contributor';
  INSERT INTO public.space_role_grants (space_id, role_id, user_id) VALUES (sp, role_id, usr);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  got := public.space_workflows(sp);
  IF NOT ('curate_portfolios_within_the_space' = ANY (got)) THEN
    RAISE EXCEPTION 'a Contributor does not hold the portfolio curation workflow: %', got;
  END IF;
  IF NOT public.has_space_workflow(sp, 'manage_portfolios_within_the_space') THEN
    RAISE EXCEPTION 'has_space_workflow disagrees with space_workflows';
  END IF;
  -- And it does not hand out what nobody was granted.
  IF public.has_space_workflow(sp, 'manage_space_permissions') THEN
    RAISE EXCEPTION 'a Contributor holds a workflow no role was given';
  END IF;

  -- A custom role of another space cannot be granted here.
  DECLARE other_sp uuid; other_role uuid; ok boolean := false;
  BEGIN
    INSERT INTO public.spaces (name) VALUES ('caps554other') RETURNING id INTO other_sp;
    INSERT INTO public.space_roles (space_id, api_name, display_name)
      VALUES (other_sp, 'custom_thing', 'Custom Thing') RETURNING id INTO other_role;
    BEGIN
      INSERT INTO public.space_role_grants (space_id, role_id, user_id)
        VALUES (sp, other_role, usr);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%RoleNotOnThisSpace%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'a custom role of another space was granted here';
    END IF;
  END;

  RAISE NOTICE '554: a role bundles workflows at the space';
END $do$;
