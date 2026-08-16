-- Organization permissions: a role is a bundle of workflows, granted to users
-- or groups. DELIVERABLE-MAP §4, built from `readings/organization-permissions`.
--
-- ── WHY NOT THE THING THE PROSE DESCRIBES ───────────────────────────────────
-- `manage-groups` says the grant is a per-permission dropdown: add users and
-- groups to a list, then "use the dropdown box to enable the View group
-- membership option". The Organization permissions PAGE does not work that way,
-- and its own screenshot says why:
--
--   "This role replaces user and group administration permissions previously
--    granted via Manage membership in Platform settings."
--            (administration/images/permissions-organization-permissions.png)
--
-- Two mechanisms, one replacing the other. Building the dropdown would copy a
-- state the documentation calls temporary — the same mistake as Phonograph's
-- status scalar, which took sixteen migrations to undo.
--
-- ── WHAT THE PAGES SAY THE MODEL IS ─────────────────────────────────────────
--   "At each level, roles can be granted to users and/or groups. Each role
--    contains a number of workflows which correspond to capabilities or actions
--    that the people granted the role will be able to take."
--
--   "Each level has different roles, but within each level there is a role with
--    the highest level of permissions (Enrollment administrator and
--    Organization administrator, respectively)."
--
-- and that top role, in the page's own two bullets:
--
--   "Grant the ability to manage permissions for the enrollment/Organization,
--    and therefore the ability to grant other roles; and Incorporate all
--    workflows from other roles of that level."
--
--   "Custom roles are not shared across organizations, so different custom
--    roles can be defined for different organizations."
--
-- and the exception that keeps the subsumption honest:
--
--   "For now, application-specific roles are not incorporated in the
--    Organization administrator role and cannot be included in custom roles."
--                    (administration/enrollments-and-organizations-permissions)
--
-- ── THE WORKFLOW CATALOGUE IS ASSEMBLED, NOT DECLARED ───────────────────────
-- Foundry publishes no central role→workflow table. It states each mapping on
-- the page for the thing the workflow unlocks:
--
--   "a user needs the Manage application access workflow, which is granted by
--    the User experience administrator role"
--                              (administration/configure-application-access)
--
-- So the seed below is exactly the workflows a mirrored page names, and no
-- others. It grows when a page names another — which is the same rule as
-- "wanting an allowlist is the signal to index instead", arrived at from the
-- documentation's side rather than ours.
--
-- **`view_group_membership` is deliberately in NO default role.** Every page
-- that names it says where it is granted (Organization permissions) and none
-- says which role carries it. Organization administrator subsumes it, and a
-- custom role can contain it; inventing a default assignment would be the
-- invented citation this repository exists to avoid.
--
-- ── ENROLLMENT IS NOT MODELLED, DELIBERATELY ────────────────────────────────
-- "Permissions in Control Panel are managed at two different levels" and "The
-- levels are strictly independent." We have organizations and no enrollment
-- above them, so only the Organization level is built. Recorded rather than
-- half-built: an enrollment with one organization in it would be a shape, not a
-- reading.

-- ── the roles ───────────────────────────────────────────────────────────────
CREATE TABLE public.organization_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL means a default role, offered to every organization. A custom role
  -- names its own, because "custom roles are not shared across organizations".
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_name        text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  display_name    text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description     text,
  -- "application-specific roles are legacy standalone roles that are in the
  -- process of migrating to roles as described above" — and until they have,
  -- they sit outside the administrator's subsumption.
  application_specific boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name),
  CONSTRAINT organization_roles_custom_is_not_legacy
    CHECK (organization_id IS NULL OR NOT application_specific)
);
COMMENT ON TABLE public.organization_roles IS
  'A role at the Organization level: a bundle of workflows granted to users or groups. organization_id NULL is a default role available to every organization; a custom role names its own, because custom roles are not shared across organizations.';

CREATE UNIQUE INDEX organization_roles_default_api_name
  ON public.organization_roles (api_name) WHERE organization_id IS NULL;

-- ── the workflows a role confers ────────────────────────────────────────────
CREATE TABLE public.organization_role_workflows (
  role_id  uuid NOT NULL REFERENCES public.organization_roles(id) ON DELETE CASCADE,
  workflow text NOT NULL CHECK (workflow ~ '^[a-z][a-z0-9_]*$'),
  PRIMARY KEY (role_id, workflow)
);
COMMENT ON TABLE public.organization_role_workflows IS
  'The workflows a role confers. Each token traces to a mirrored page that names it at the point of use; there is no central catalogue to copy.';

-- ── who holds a role ────────────────────────────────────────────────────────
CREATE TABLE public.organization_role_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES public.organization_roles(id) ON DELETE CASCADE,
  -- "roles can be granted to users and/or groups" — one or the other, never both.
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id        uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  granted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_role_grants_one_principal
    CHECK ((user_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX organization_role_grants_user
  ON public.organization_role_grants (organization_id, role_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX organization_role_grants_group
  ON public.organization_role_grants (organization_id, role_id, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX organization_role_grants_org ON public.organization_role_grants (organization_id);

-- A custom role may only be granted in the organization that owns it.
CREATE OR REPLACE FUNCTION public.guard_organization_role_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE owner_org uuid;
BEGIN
  SELECT r.organization_id INTO owner_org FROM public.organization_roles r WHERE r.id = NEW.role_id;
  IF owner_org IS NOT NULL AND owner_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Permissions:RoleNotInThisOrganization — custom roles are not shared across organizations';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER guard_organization_role_grant
  BEFORE INSERT OR UPDATE ON public.organization_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.guard_organization_role_grant();

-- ── the predicate ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_workflows(p_organization uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  -- Every workflow the caller holds in one organization, whether the role
  -- reached them directly or through a group they are in.
  WITH held AS (
    SELECT g.role_id
      FROM public.organization_role_grants g
     WHERE g.organization_id = p_organization
       AND (g.user_id = (SELECT auth.uid())
            OR g.group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[])))
  ),
  -- "Incorporate all workflows from other roles of that level" — the
  -- administrator holds every workflow except the legacy application-specific
  -- ones, which the page says are not incorporated.
  admin AS (
    SELECT EXISTS (
      SELECT 1 FROM held h JOIN public.organization_roles r ON r.id = h.role_id
       WHERE r.api_name = 'organization_administrator') AS is_admin
  )
  SELECT COALESCE(array_agg(DISTINCT w.workflow), '{}')
    FROM public.organization_role_workflows w
    JOIN public.organization_roles r ON r.id = w.role_id
   WHERE (r.organization_id IS NULL OR r.organization_id = p_organization)
     AND (w.role_id IN (SELECT role_id FROM held)
          OR ((SELECT is_admin FROM admin) AND NOT r.application_specific))
$fn$;
REVOKE ALL ON FUNCTION public.org_workflows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_workflows(uuid) TO authenticated;
COMMENT ON FUNCTION public.org_workflows(uuid) IS
  'The workflows the caller holds in one organization, through roles granted to them or to a group they are in. An Organization administrator incorporates all workflows except the legacy application-specific ones.';

CREATE OR REPLACE FUNCTION public.has_org_workflow(p_organization uuid, p_workflow text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT p_workflow = ANY (COALESCE((SELECT public.org_workflows(p_organization)), '{}'))
$fn$;
REVOKE ALL ON FUNCTION public.has_org_workflow(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_workflow(uuid, text) TO authenticated;

-- ── RLS: the tables describe who may see and change them ────────────────────
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_role_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_role_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "default roles are visible to everyone" ON public.organization_roles
  FOR SELECT USING (organization_id IS NULL
                    OR NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id())));
CREATE POLICY "a role's workflows are visible with the role" ON public.organization_role_workflows
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_roles r WHERE r.id = role_id));
CREATE POLICY "org members see grants in their organization" ON public.organization_role_grants
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id())));

-- Granting a role takes the workflow that grants roles, which the page ties to
-- the administrator: it "grant[s] the ability to manage permissions for the
-- enrollment/Organization, and therefore the ability to grant other roles".
CREATE POLICY "permission managers grant roles" ON public.organization_role_grants
  FOR ALL USING (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND (SELECT public.has_org_workflow(organization_id, 'manage_organization_permissions')))
  WITH CHECK (
    NOT (organization_id IS DISTINCT FROM (SELECT public.auth_org_id()))
    AND (SELECT public.has_org_workflow(organization_id, 'manage_organization_permissions')));

-- ── §4's payoff: seeing groups you are not an org member of ─────────────────
--   "You will only be able to view groups for which you have `View group
--    membership` permission on the group's Organization."
--                                 (platform-security-management/manage-groups)
--
-- A PERMISSIVE policy beside the existing two, never a rewrite of them: the org
-- member and guest arms keep their own meaning, and this adds the third the
-- page describes. Composing rather than restating is the rule that kept
-- auth_org_id() from being rewritten into forty places.
CREATE POLICY "view group membership reaches across organizations" ON public.groups
  FOR SELECT USING ((SELECT public.has_org_workflow(organization_id, 'view_group_membership')));

GRANT SELECT ON public.organization_roles, public.organization_role_workflows,
                public.organization_role_grants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organization_role_grants TO authenticated;

-- ── the seed: only what a mirrored page names ───────────────────────────────
INSERT INTO public.organization_roles (organization_id, api_name, display_name, description) VALUES
  (NULL, 'organization_administrator', 'Organization administrator',
   'Manages permissions for the Organization, and incorporates all workflows from other roles of that level.'),
  (NULL, 'user_experience_administrator', 'User experience administrator',
   'Manage the Foundry experience for members in this organization.'),
  (NULL, 'users_and_groups_administrator', 'Users and groups administrator',
   'Manage users and groups in the organization.'),
  (NULL, 'data_governance_officer', 'Data governance officer',
   'Named by the Auth Chooser preset workflow as an alternative to the Organization administrator.'),
  (NULL, 'technical_compliance_officer', 'Technical Compliance Officer',
   'Each Organization should have at least one. Defaults to the Organization administrator when unassigned.');

INSERT INTO public.organization_role_workflows (role_id, workflow)
SELECT r.id, w.workflow
  FROM public.organization_roles r
  JOIN (VALUES
    -- "a user needs the Manage application access workflow, which is granted by
    --  the User experience administrator role" (configure-application-access)
    ('user_experience_administrator', 'manage_application_access'),
    -- the same page's sibling sentence, for the platform version setting
    ('user_experience_administrator', 'manage_platform_version'),
    -- "Manage Auth Chooser Enterprise Presets workflow as part of either the
    --  Data governance officer or Organization administrator"
    ('data_governance_officer', 'manage_auth_chooser_enterprise_presets'),
    -- the administrator's own defining capability, from the two bullets above
    ('organization_administrator', 'manage_organization_permissions')
  ) AS w(role, workflow) ON w.role = r.api_name
 WHERE r.organization_id IS NULL;

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE org uuid; org2 uuid; usr uuid; grp uuid; role_admin uuid; role_ux uuid; custom uuid; n int;
BEGIN
  IF (SELECT count(*) FROM public.organization_roles WHERE organization_id IS NULL) <> 5 THEN
    RAISE EXCEPTION 'the default roles are not the five the pages name';
  END IF;

  BEGIN
    SELECT o.id INTO org FROM public.organizations o LIMIT 1;
    INSERT INTO public.organizations (name) VALUES ('probe-540-other') RETURNING id INTO org2;
    SELECT id INTO role_admin FROM public.organization_roles WHERE api_name = 'organization_administrator';
    SELECT id INTO role_ux FROM public.organization_roles WHERE api_name = 'user_experience_administrator';

    -- A custom role belongs to one organization and may not be granted in another.
    INSERT INTO public.organization_roles (organization_id, api_name, display_name)
    VALUES (org, 'usage_metrics_viewer', 'Usage Metrics Viewer') RETURNING id INTO custom;
    BEGIN
      INSERT INTO public.organization_role_grants (organization_id, role_id, user_id)
      VALUES (org2, custom, NULL);
      RAISE EXCEPTION 'a custom role was granted outside its organization';
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm NOT LIKE '%RoleNotInThisOrganization%' AND sqlerrm NOT LIKE '%one_principal%' THEN RAISE; END IF;
    END;

    -- A grant names a user or a group, never both and never neither.
    BEGIN
      INSERT INTO public.organization_role_grants (organization_id, role_id) VALUES (org, role_ux);
      RAISE EXCEPTION 'a grant with no principal was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm NOT LIKE '%one_principal%' THEN RAISE; END IF;
    END;

    -- The administrator incorporates the other roles' workflows without
    -- holding them directly.
    SELECT count(*) INTO n FROM public.organization_role_workflows w
      JOIN public.organization_roles r ON r.id = w.role_id
     WHERE r.api_name = 'organization_administrator';
    IF n <> 1 THEN
      RAISE EXCEPTION 'the administrator role carries % workflows of its own, expected 1', n;
    END IF;

    RAISE EXCEPTION 'probe-540-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '540: a role bundles workflows, and is granted at the organization';
END $do$;
