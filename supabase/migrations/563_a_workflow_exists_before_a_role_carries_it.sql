-- A workflow only existed here as a row attaching it to a role, so a workflow
-- nobody's role carried did not exist at all. Two live policies test one.
--
-- ── THE TWO DEAD POLICIES ───────────────────────────────────────────────────
-- Found by §4's reading (`readings/access-model-and-permission-vocabulary` §5),
-- and both verified by running the predicate as the strongest role that exists:
--
--   * `groups.view group membership reaches across organizations` tests
--     `view_group_membership`. An `organization_administrator` — the role that
--     "Incorporate[s] all workflows from other roles of that level" — holds
--     five workflows and not that one.
--   * `space_role_grants.space administrators grant roles` tests
--     `manage_space_permissions`. A `space_administrator` holds Contributor's
--     five and not that one.
--
-- **554's header is wrong and this corrects it.** It said
-- `manage_space_permissions` "sits in no role and only a subsuming
-- administrator holds it". Subsumption redistributes workflows some role
-- already carries; it cannot conjure one that appears nowhere. So nobody holds
-- it and the policy can never grant. Same shape as 540's, which was the more
-- defensible mistake — 540 declined to invent a role assignment no page states,
-- and that was right.
--
-- ── WHY A CATALOGUE, RATHER THAN SEEDING THEM INTO SOME ROLE ────────────────
-- In Foundry a workflow exists independently of any role, and building a role
-- is choosing from a list of them:
--
--   "In addition to the default roles, Enrollment administrators and
--    Organization administrators can define custom roles in Control Panel by
--    selecting individual workflows."
--            (administration/enrollments-and-organizations-permissions)
--
-- The Space permissions screenshot shows the same affordance one scope over — a
-- `Filter roles and workflows…` box beside `+ New role`, which only means
-- something over a list. Seeding the two orphans into a default role would
-- require picking a role no page assigns them to, which is exactly what 540
-- refused; the catalogue is what the page actually describes.
--
-- ── WHAT THIS CHANGES, AND WHAT IT DOES NOT ────────────────────────────────
-- No grant changes. Every existing role keeps exactly the workflows it had, and
-- the two orphaned tokens are still carried by nobody — the catalogue makes
-- them SELECTABLE, not held. What becomes possible is the mechanism the page
-- describes: an operator composes a custom role containing one, and only then
-- does the policy behind it come alive. That keeps 540's refusal intact rather
-- than overturning it.
--
-- The foreign keys are the second half: a role could previously be given any
-- string matching `^[a-z][a-z0-9_]*$`, so a typo was a silently ungranted
-- permission. Now an unknown workflow is refused.

BEGIN;

CREATE TABLE public.workflows (
  api_name     text PRIMARY KEY CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  -- The level whose roles may carry it. "Permissions in Control Panel are
  -- managed at two different levels" — and spaces have their own page besides.
  scope        text NOT NULL CHECK (scope IN ('organization', 'space')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description  text,
  -- False for a token we introduced because a policy needed one and no page
  -- names it. Kept visible rather than blended in, so the invented ones stay
  -- countable.
  published    boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE public.workflows IS
  'The workflows a role may be given, existing independently of any role — the list a custom role is composed from. A row here is selectable, not held.';

INSERT INTO public.workflows (api_name, scope, display_name, description, published) VALUES
  -- Organization level. Each traces to the page that named it, per 540 and 542.
  ('manage_application_access', 'organization', 'Manage application access',
   'Granted by the User experience administrator role.', true),
  ('manage_organization_permissions', 'organization', 'Manage organization permissions',
   'Grants the ability to manage permissions for the Organization, and therefore to grant other roles.', true),
  ('manage_platform_version', 'organization', 'Manage platform version', NULL, true),
  ('manage_auth_chooser_enterprise_presets', 'organization', 'Manage authentication chooser enterprise presets', NULL, true),
  ('oversee_progress_in_upgrade_assistant', 'organization', 'Oversee progress in Upgrade assistant',
   'Designates a Maintenance Operator.', true),
  -- The first orphan. "You will only be able to view groups for which you have
  -- View group membership permission on the group's Organization."
  ('view_group_membership', 'organization', 'View group membership',
   'Widens which organizationsّ groups the holder can see. Carried by no default role: no page states which role grants it, so it is composed into a custom role.', true),

  -- Space level. The five come from the expanded Contributor card in
  -- platform-security-management/images/space-permissions.png.
  ('create_project', 'space', 'Create project', NULL, true),
  ('curate_portfolios_within_the_space', 'space', 'Curate portfolios within the space', NULL, true),
  ('manage_portfolios_within_the_space', 'space', 'Manage portfolios within the space', NULL, true),
  ('manage_value_types', 'space', 'Manage value types', NULL, true),
  ('view_value_types', 'space', 'View value types', NULL, true),
  -- The second orphan, and ours: no card names the workflow that lets someone
  -- grant space roles, so 554 minted the token. Marked unpublished.
  ('manage_space_permissions', 'space', 'Manage space permissions',
   'Grant roles on a space. OURS, not published: no role card names the workflow that confers granting.', false);

-- ── the catalogue becomes the authority ─────────────────────────────────────
ALTER TABLE public.organization_role_workflows
  ADD CONSTRAINT organization_role_workflows_known
  FOREIGN KEY (workflow) REFERENCES public.workflows(api_name) ON UPDATE CASCADE;
ALTER TABLE public.space_role_workflows
  ADD CONSTRAINT space_role_workflows_known
  FOREIGN KEY (workflow) REFERENCES public.workflows(api_name) ON UPDATE CASCADE;

-- A level may only carry its own workflows.
CREATE OR REPLACE FUNCTION public.guard_workflow_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE want text := TG_ARGV[0]; got text;
BEGIN
  SELECT w.scope INTO got FROM public.workflows w WHERE w.api_name = NEW.workflow;
  -- The trigger fires before the foreign key, so it has to name the unknown
  -- case itself; otherwise a typo is reported as a scope error, which sends
  -- the reader looking for the wrong thing.
  IF got IS NULL THEN
    RAISE EXCEPTION 'Permissions:UnknownWorkflow — % is not in the workflow catalogue', NEW.workflow
      USING HINT = 'A workflow must be catalogued before a role can carry it. Add it with the page that names it.';
  END IF;
  IF got <> want THEN
    RAISE EXCEPTION 'Permissions:WorkflowWrongScope — % is a % workflow and cannot be carried by a % role',
      NEW.workflow, got, want;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_workflow_scope() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_workflow_scope BEFORE INSERT OR UPDATE ON public.organization_role_workflows
  FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_scope('organization');
CREATE TRIGGER guard_workflow_scope BEFORE INSERT OR UPDATE ON public.space_role_workflows
  FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_scope('space');

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "the workflow catalogue is platform vocabulary" ON public.workflows
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.workflows TO authenticated;

-- ── assertions, which execute the path and insert nothing durable ───────────
DO $do$
DECLARE n int; role_id uuid; ok boolean;
BEGIN
  -- Every workflow any role carries is now in the catalogue — the FK proves it
  -- landed, but say the count out loud so a future reader sees the shape.
  SELECT count(*) INTO n FROM public.workflows;
  IF n <> 12 THEN RAISE EXCEPTION 'expected 12 catalogued workflows, found %', n; END IF;

  -- The two orphans are catalogued and still held by nobody. Both halves
  -- matter: selectable, not granted.
  SELECT count(*) INTO n FROM public.workflows
   WHERE api_name IN ('view_group_membership', 'manage_space_permissions');
  IF n <> 2 THEN RAISE EXCEPTION 'the two orphaned tokens are not both catalogued'; END IF;

  SELECT count(*) INTO n FROM public.organization_role_workflows
   WHERE workflow = 'view_group_membership';
  IF n <> 0 THEN RAISE EXCEPTION 'view_group_membership was granted, which was not the deal'; END IF;
  SELECT count(*) INTO n FROM public.space_role_workflows
   WHERE workflow = 'manage_space_permissions';
  IF n <> 0 THEN RAISE EXCEPTION 'manage_space_permissions was granted, which was not the deal'; END IF;

  -- An unknown workflow is refused where any string used to pass.
  SELECT id INTO role_id FROM public.organization_roles
   WHERE organization_id IS NULL AND api_name = 'organization_administrator';
  ok := false;
  BEGIN
    INSERT INTO public.organization_role_workflows (role_id, workflow)
    VALUES (role_id, 'manage_platfrom_version');   -- a plausible typo
  EXCEPTION WHEN OTHERS THEN
    -- The trigger reaches it before the foreign key does, and says the useful
    -- thing rather than the structural one.
    IF sqlerrm LIKE '%UnknownWorkflow%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a misspelled workflow was accepted'; END IF;

  -- And a space workflow cannot be carried by an organization role.
  ok := false;
  BEGIN
    INSERT INTO public.organization_role_workflows (role_id, workflow)
    VALUES (role_id, 'create_project');
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm LIKE '%WorkflowWrongScope%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'an organization role took a space workflow'; END IF;

  -- The composition route works: a custom role may now contain the orphan,
  -- which is the whole point. Unwound immediately.
  BEGIN
    DECLARE custom uuid; org uuid;
    BEGIN
      INSERT INTO public.organizations (name) VALUES ('probe563') RETURNING id INTO org;
      INSERT INTO public.organization_roles (organization_id, api_name, display_name)
        VALUES (org, 'group_watcher', 'Group Watcher') RETURNING id INTO custom;
      INSERT INTO public.organization_role_workflows (role_id, workflow)
        VALUES (custom, 'view_group_membership');
      RAISE EXCEPTION 'probe563:done';
    END;
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe563:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe563';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '563: a workflow exists before a role carries it';
END $do$;

COMMIT;
