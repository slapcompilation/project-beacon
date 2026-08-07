-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 330 — projects, and roles granted on them. Gap 6.
--
-- ONTOLOGY-PARITY-GAPS gap 6: "Foundry grants Ontology roles on the Ontology
-- level or the individual resource level. Ours is organization + hotel + role
-- tier. There is no per-object-type or per-action-type grant: any org member
-- reads every object type, ANY ADMIN WRITES EVERY ONE."
--
-- Foundry, from security/projects-and-roles:
--
--   "Projects are the primary way to organize work in Foundry, and THE PRIMARY
--    SECURITY BOUNDARY... Together, Projects and roles are how discretionary
--    access control is managed."
--
-- FOUR ROLES, most to least powerful: owner, editor, viewer, discoverer. Two
-- rules govern them and both are enforced here:
--
--   "Each role can assign other users THE SAME OR LESSER ROLE. For example, an
--    Owner can grant any other user the Owner, Editor, Viewer, or Discoverer
--    role, while the Discoverer can only grant other users the Discoverer role."
--
--   "role grants INHERIT TO CHILD RESOURCES. For example, granting a user Viewer
--    on a Project or folder gives them Viewer on all resources contained by that
--    Project."
--
-- GRANTS ATTACH TO PROJECTS ONLY, which is theirs too and simplifies this a lot:
-- "Role grants on folders and files are disabled by default... We recommend
-- keeping role grants on folders and files disabled." So there is no per-resource
-- grant table — a resource's role is its project's role.
--
-- WHY THIS IS SAFE TO TURN ON, and the sentence that decides it:
--
--   "mandatory controls, Organizations and Markings, will ALWAYS prevent an
--    ineligible user from accessing a resource, REGARDLESS OF THE USER'S ROLE."
--
-- Roles are DISCRETIONARY and sit inside the mandatory boundary. Ours is
-- organization and hotel scope, and nothing here touches it: every policy below
-- keeps its `organization_id = auth_org_id()` term. A project role can widen what
-- a member may do WITHIN their organization; it can never reach across one.
--
-- SO THIS ONLY EVER WIDENS, deliberately. Today writing an object type or a
-- module requires org admin/owner. After this, an admin can additionally grant a
-- non-admin Editor on a project and they may write THAT project's resources.
-- Nobody loses access, which is what makes it deployable against live data —
-- and delegation is the whole point of a discretionary role.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.projects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  api_name           text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  description        text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.projects IS
  'Foundry''s primary security boundary — a bucket of shared work. Roles are granted here and inherit to everything the project contains.';

-- "Work (transformation, analysis, etc.) is done in a Project, and the output of
-- that work lives alongside its logic within the Project." One project per
-- resource, so the PK is the resource — not (project, resource).
CREATE TABLE IF NOT EXISTS public.project_resources (
  resource_kind   text NOT NULL CHECK (resource_kind IN
                    ('object_type', 'module', 'document', 'object_set', 'user_tool')),
  resource_id     uuid NOT NULL,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_kind, resource_id)
);

COMMENT ON TABLE public.project_resources IS
  'Which project contains a resource. A resource belongs to at most one project — Foundry: work and its output live in the same Project.';

CREATE INDEX IF NOT EXISTS idx_project_resources_project ON public.project_resources (project_id);

CREATE TABLE IF NOT EXISTS public.project_role_grants (
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'discoverer')),
  organization_id uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  granted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

COMMENT ON TABLE public.project_role_grants IS
  'Discretionary access, granted at the PROJECT level only (Foundry disables folder/file grants by default). Sits inside the mandatory org/hotel boundary and can never widen past it.';

-- ── The role a caller holds, and whether it is enough ───────────────────────

CREATE OR REPLACE FUNCTION public.project_role(p_project uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.role FROM project_role_grants g
   WHERE g.project_id = p_project
     AND g.user_id = auth.uid()
     -- The mandatory control, restated where it is easiest to remove by
     -- accident: a grant in another organization is not a grant.
     AND g.organization_id IS NOT DISTINCT FROM auth_org_id()
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE p_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                     WHEN 'viewer' THEN 2 WHEN 'discoverer' THEN 1 ELSE 0 END
$$;

/** Does the caller hold at least p_min on the project that contains this
 *  resource? Grants inherit to children, so the resource's role IS its
 *  project's. */
CREATE OR REPLACE FUNCTION public.has_resource_role(p_kind text, p_id uuid, p_min text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_resources pr
     WHERE pr.resource_kind = p_kind AND pr.resource_id = p_id
       AND role_rank(project_role(pr.project_id)) >= role_rank(p_min)
  )
$$;

REVOKE ALL ON FUNCTION public.project_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_resource_role(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_resource_role(text, uuid, text) TO authenticated;

-- ── You may only grant a role you hold, or a lesser one ─────────────────────

CREATE OR REPLACE FUNCTION public.enforce_grant_ceiling()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE mine text;
BEGIN
  -- Service-role and migration paths have no caller to check.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  mine := project_role(NEW.project_id);
  -- An org admin is the bootstrap: someone has to grant the first Owner.
  IF mine IS NULL AND auth_role() IN ('owner', 'admin') THEN RETURN NEW; END IF;

  IF role_rank(mine) < role_rank(NEW.role) THEN
    RAISE EXCEPTION
      'Projects:GrantExceedsRole you hold % on this project and cannot grant %. A role may only assign the same or a lesser role.',
      coalesce(mine, 'no role'), NEW.role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grant_ceiling ON public.project_role_grants;
CREATE TRIGGER trg_grant_ceiling
  BEFORE INSERT OR UPDATE ON public.project_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_grant_ceiling();

-- ── RLS. Every policy keeps its organization term. ──────────────────────────

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_role_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read projects" ON public.projects;
CREATE POLICY "members read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins and owners write projects" ON public.projects;
CREATE POLICY "admins and owners write projects" ON public.projects
  FOR ALL TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (auth_role() IN ('owner', 'admin') OR project_role(id) = 'owner'))
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (auth_role() IN ('owner', 'admin') OR project_role(id) = 'owner'));

DROP POLICY IF EXISTS "members read project resources" ON public.project_resources;
CREATE POLICY "members read project resources" ON public.project_resources
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "editors place resources" ON public.project_resources;
CREATE POLICY "editors place resources" ON public.project_resources
  FOR ALL TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (auth_role() IN ('owner', 'admin')
              OR role_rank(project_role(project_id)) >= role_rank('editor')))
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (auth_role() IN ('owner', 'admin')
                   OR role_rank(project_role(project_id)) >= role_rank('editor')));

DROP POLICY IF EXISTS "members read grants" ON public.project_role_grants;
CREATE POLICY "members read grants" ON public.project_role_grants
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "role holders grant" ON public.project_role_grants;
CREATE POLICY "role holders grant" ON public.project_role_grants
  FOR ALL TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (auth_role() IN ('owner', 'admin') OR project_role(project_id) IS NOT NULL))
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (auth_role() IN ('owner', 'admin') OR project_role(project_id) IS NOT NULL));

-- ── Delegation: what a project Editor may now do ────────────────────────────
-- Additive only. The existing admin/owner terms stay exactly as they were, so
-- no one loses a capability; a project Editor gains one on their own resources.

DROP POLICY IF EXISTS "admins update object types" ON public.object_types;
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE TO authenticated
  USING (kind = 'authored'
         AND organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (auth_role() IN ('owner', 'admin')
              OR has_resource_role('object_type', id, 'editor')))
  WITH CHECK (kind = 'authored'
              AND organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (auth_role() IN ('owner', 'admin')
                   OR has_resource_role('object_type', id, 'editor')));

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table', 'projects', 'platform', 'Foundry''s primary security boundary — a bucket of shared work that roles are granted on.'),
  ('table', 'project_resources', 'platform', 'Which project contains a resource; a resource belongs to at most one.'),
  ('table', 'project_role_grants', 'platform', 'Discretionary access, granted at the project level and inherited by its contents. Gap 6.')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_admin uuid; v_member uuid; v_proj uuid; v_type uuid;
        claims_admin text; claims_member text; ok boolean; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_admin FROM object_types WHERE organization_id = v_org LIMIT 1;
  SELECT u.id INTO v_member FROM auth.users u WHERE u.id <> v_admin LIMIT 1;
  IF v_member IS NULL THEN
    RAISE NOTICE 'Migration 330: only one user in this environment — delegation probe skipped';
  END IF;

  claims_admin  := json_build_object('sub', v_admin,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;
  claims_member := json_build_object('sub', v_member,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'team_member'))::text;

  BEGIN
    INSERT INTO projects (organization_id, api_name, name, created_by_user_id)
    VALUES (v_org, 'probe_project', 'Probe Project', v_admin) RETURNING id INTO v_proj;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_proj_type', 'Probe Project Type', v_admin) RETURNING id INTO v_type;
    INSERT INTO project_resources (resource_kind, resource_id, project_id, organization_id)
    VALUES ('object_type', v_type, v_proj, v_org);

    IF v_member IS NOT NULL THEN
      -- Before the grant, a plain member holds nothing.
      PERFORM set_config('request.jwt.claims', claims_member, true);
      SET LOCAL ROLE authenticated;
      SELECT has_resource_role('object_type', v_type, 'editor') INTO ok;
      IF ok THEN RAISE EXCEPTION 'Migration 330: a member had editor before any grant'; END IF;
      -- RESET ROLE alone is not enough: set_config claims are transaction-local
      -- and outlive it, so auth.uid() would still be the member here.
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', claims_admin, true);

      -- An admin grants Editor; the role reaches the resource through the project.
      INSERT INTO project_role_grants (project_id, user_id, role, organization_id, granted_by)
      VALUES (v_proj, v_member, 'editor', v_org, v_admin);

      PERFORM set_config('request.jwt.claims', claims_member, true);
      SET LOCAL ROLE authenticated;
      SELECT has_resource_role('object_type', v_type, 'editor') INTO ok;
      IF NOT ok THEN RAISE EXCEPTION 'Migration 330: the grant did not inherit to the resource'; END IF;
      -- ...and not more than was granted.
      SELECT has_resource_role('object_type', v_type, 'owner') INTO ok;
      IF ok THEN RAISE EXCEPTION 'Migration 330: an editor grant conferred owner'; END IF;

      -- "A role may only assign the same or a lesser role."
      BEGIN
        INSERT INTO project_role_grants (project_id, user_id, role, organization_id)
        VALUES (v_proj, v_admin, 'owner', v_org);
        RAISE EXCEPTION 'Migration 330: an editor granted owner';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM NOT LIKE 'Projects:GrantExceedsRole%' THEN RAISE; END IF;
      END;
      RESET ROLE;
    END IF;

    -- The mandatory control still wins: a grant in another org is not a grant.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member,
      'app_metadata', json_build_object('org_id', gen_random_uuid()::text, 'role', 'admin'))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT has_resource_role('object_type', v_type, 'editor') INTO ok;
    IF ok THEN RAISE EXCEPTION 'Migration 330: a project role crossed an organization boundary'; END IF;
    RESET ROLE;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
