-- 419 — a branch is an overlay on main
--
-- Reading: mirror/global-branching/{overview,core-concepts,branch-security}
--          mirror/ontologies/branching-ontology
--          docs/ONTOLOGY-BUILD-MAP.md, phase D1
--
--   "branching allows you to fork your existing environment and work on
--    components of your end-to-end workflow in a contained branch."
--
--   "You can ONLY BRANCH FROM THE MAIN ONTOLOGY, also known as `main` branch."
--
-- ── HOW BRANCH STATE IS STORED, and why ──────────────────────────────────────
-- This was the open question, and two sentences settle it.
--
--   "Global Branching auto-resolves any non-conflicting changes during a rebase.
--    For true conflicts — WHERE THE SAME PROPERTY OF THE SAME RESOURCE WAS
--    EDITED ON BOTH `main` AND YOUR BRANCH — there is no automatic resolution."
--
--   "REMOVING A RESOURCE FROM A BRANCH RETURNS ITS STATE TO THE VERSION OF THE
--    RESOURCE ON THE `main` BRANCH."
--
-- So `main` is the base and a branch is an OVERLAY: a resource is either on the
-- branch carrying its changed fields, or not on it and therefore main's. And the
-- unit of conflict is the FIELD, not the resource — a whole-resource copy could
-- not tell a conflicting edit from a neighbouring one.
--
-- Each change row therefore carries TWO snapshots:
--
--   fields   the values this branch wants
--   base     the values those same fields had when the branch first touched them
--
-- That is a three-way merge, and it needs no changelog on main. A field
-- conflicts when main's value today differs from the base the branch recorded —
-- meaning somebody else moved it underneath. Everything else auto-resolves,
-- which is exactly what the page says happens.
--
-- ── AND ONE ASYMMETRY THAT WOULD HAVE BEEN GUESSED WRONG ─────────────────────
--   "creating or deleting Foundry resources on a branch WILL AFFECT `main`.
--    THIS DOES NOT APPLY TO ONTOLOGY RESOURCES: you can create, modify, or
--    delete entities on the branch WITHOUT AFFECTING the `main` branch."
--
-- Ours are ontology resources, so create and delete are branch-local too — which
-- is why `operation` is part of the overlay rather than a write to the table.

BEGIN;

CREATE TABLE public.ontology_branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id     uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,

  name            text NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9._/-]*$' AND name <> 'main'),
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  description     text NOT NULL DEFAULT '',

  -- "When a branch is created, its status is set to Active."
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','archived','merged')),

  -- "A branch that is automatically marked as inactive after a configurable
  --  period of NO ACTIVITY." Activity is a timestamp, so the rule is a query.
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  -- "since your last rebase — or since branch creation, if this is your first"
  last_rebased_at  timestamptz NOT NULL DEFAULT now(),

  rid             text GENERATED ALWAYS AS (public.rid_of('ontology', 'branch', id)) STORED,

  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (ontology_id, name),
  FOREIGN KEY (ontology_id, organization_id)
    REFERENCES public.ontologies (id, organization_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.ontology_branches IS
  'A fork of main. `main` itself is not a row — it is the base state in the resource tables, and a branch is an overlay on it. RID ri.ontology.main.branch.<uuid>, attested in the corpus.';
COMMENT ON COLUMN public.ontology_branches.name IS
  'Never "main": you can only branch FROM main, so main is not a branch you can create.';

-- ── the overlay ──────────────────────────────────────────────────────────────

CREATE TABLE public.branch_resource_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.ontology_branches(id) ON DELETE CASCADE,

  resource_kind text NOT NULL CHECK (resource_kind IN
    ('object_type','link_type','shared_property','interface','action_type','type_group')),
  resource_id   uuid NOT NULL,

  operation     text NOT NULL CHECK (operation IN ('created','modified','deleted')),
  -- What this branch wants each field to be.
  fields        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What those same fields were on main when the branch first touched them. The
  -- third leg of the merge; without it, "did somebody else move this?" is
  -- unanswerable without a changelog on main.
  base          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One overlay row per resource per branch. "Removing a resource from a branch
  -- returns its state to the version on main" — so removal is a DELETE here.
  UNIQUE (branch_id, resource_kind, resource_id),

  -- A created resource has no base to conflict against; a deleted one changes
  -- no fields.
  CHECK (operation <> 'created' OR base = '{}'::jsonb),
  CHECK (operation <> 'deleted' OR fields = '{}'::jsonb)
);

COMMENT ON TABLE public.branch_resource_changes IS
  'The overlay. `fields` is what the branch wants, `base` is what main held when the branch first touched those fields — the two together make a three-way merge, so a rebase can auto-resolve everything except a field both sides moved.';

CREATE INDEX idx_branch_changes_branch ON public.branch_resource_changes (branch_id);
CREATE INDEX idx_branch_changes_resource ON public.branch_resource_changes (resource_kind, resource_id);

-- Touching a branch is activity, which is what the inactivity clock reads.
CREATE OR REPLACE FUNCTION public.touch_branch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ontology_branches
     SET last_activity_at = now()
   WHERE id = coalesce(NEW.branch_id, OLD.branch_id);
  RETURN coalesce(NEW, OLD);
END $$;

CREATE TRIGGER touch_branch
  AFTER INSERT OR UPDATE OR DELETE ON public.branch_resource_changes
  FOR EACH ROW EXECUTE FUNCTION public.touch_branch();

-- ── the lifecycle ────────────────────────────────────────────────────────────
-- From the state diagram: Active <-> Inactive, both -> Archived, both -> Merged,
-- Archived -> Active by restore. "Merged branches are TERMINAL: they cannot be
-- restored, do not appear in the branch selector."

CREATE OR REPLACE FUNCTION public.guard_branch_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'merged' THEN
      RAISE EXCEPTION 'Branching:MergedIsTerminal — a merged branch cannot change state'
        USING HINT = 'Merged branches "cannot be restored, do not appear in the branch selector".';
    END IF;
    -- Archived goes back to Active by restore, and nowhere else directly.
    IF OLD.status = 'archived' AND NEW.status <> 'active' THEN
      RAISE EXCEPTION 'Branching:RestoreFirst — an archived branch is restored to active before anything else';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_branch_lifecycle
  BEFORE UPDATE ON public.ontology_branches
  FOR EACH ROW EXECUTE FUNCTION public.guard_branch_lifecycle();

-- ── the rebase question, as one query ────────────────────────────────────────
-- "For true conflicts — where the same property of the same resource was edited
--  on both main and your branch — there is no automatic resolution; you must
--  pick one version manually."
--
-- A field conflicts when the branch changed it AND main's value today differs
-- from the base the branch recorded. Anything else auto-resolves.

CREATE OR REPLACE FUNCTION public.branch_conflicts(p_branch uuid)
RETURNS TABLE (resource_kind text, resource_id uuid, field text,
               base_value jsonb, branch_value jsonb, main_value jsonb)
LANGUAGE plpgsql STABLE AS $$
DECLARE c record; k text; main_row jsonb;
BEGIN
  FOR c IN SELECT * FROM public.branch_resource_changes WHERE branch_id = p_branch
            AND operation = 'modified'
  LOOP
    -- Main's current state for this resource, as jsonb, whatever kind it is.
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1',
                   CASE c.resource_kind
                     WHEN 'object_type'     THEN 'object_types'
                     WHEN 'link_type'       THEN 'link_types'
                     WHEN 'shared_property' THEN 'shared_properties'
                     WHEN 'interface'       THEN 'ontology_interfaces'
                     WHEN 'action_type'     THEN 'action_types'
                     WHEN 'type_group'      THEN 'type_groups'
                   END)
      INTO main_row USING c.resource_id;

    IF main_row IS NULL THEN CONTINUE; END IF;   -- deleted on main; a different case

    FOR k IN SELECT jsonb_object_keys(c.fields)
    LOOP
      IF main_row -> k IS DISTINCT FROM c.base -> k THEN
        resource_kind := c.resource_kind;
        resource_id   := c.resource_id;
        field         := k;
        base_value    := c.base -> k;
        branch_value  := c.fields -> k;
        main_value    := main_row -> k;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.branch_conflicts(uuid) IS
  'Every field both this branch and main have moved since the branch recorded its base. Everything not listed auto-resolves on rebase, which is what Global Branching does.';

REVOKE ALL ON FUNCTION public.branch_conflicts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.branch_conflicts(uuid) TO authenticated;

-- ── roles ────────────────────────────────────────────────────────────────────
--   "Each branch must have at least one `Owner`. The user who creates a branch
--    is automatically assigned the `Owner` role."
--
--   "Branch roles control access to BRANCH MANAGEMENT ACTIONS ONLY and DO NOT
--    GRANT PERMISSIONS TO EDIT RESOURCES on the branch."

CREATE TABLE public.branch_roles (
  branch_id uuid NOT NULL REFERENCES public.ontology_branches(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('owner')),
  PRIMARY KEY (branch_id, user_id)
);

COMMENT ON TABLE public.branch_roles IS
  'Who may manage a branch — its metadata, roles, archive/restore, and proposals. NOT permission to edit the resources on it: "to modify resources, a user must have the appropriate permissions at the project or resource level".';

CREATE OR REPLACE FUNCTION public.assign_branch_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by_user_id IS NOT NULL THEN
    INSERT INTO public.branch_roles (branch_id, user_id, role)
    VALUES (NEW.id, NEW.created_by_user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER assign_branch_owner
  AFTER INSERT ON public.ontology_branches
  FOR EACH ROW EXECUTE FUNCTION public.assign_branch_owner();

-- "Each branch must have at least one Owner."
CREATE OR REPLACE FUNCTION public.guard_last_branch_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only while the branch is still there. Deleting a branch cascades to its
  -- roles, and a rule about a branch that no longer exists would make branches
  -- undeletable — which the first version of this did.
  IF NOT EXISTS (SELECT 1 FROM public.ontology_branches WHERE id = OLD.branch_id) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branch_roles
                  WHERE branch_id = OLD.branch_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Branching:BranchNeedsAnOwner — each branch must have at least one Owner';
  END IF;
  RETURN OLD;
END $$;

CREATE CONSTRAINT TRIGGER guard_last_branch_owner
  AFTER DELETE ON public.branch_roles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_branch_owner();

-- ── access ───────────────────────────────────────────────────────────────────

ALTER TABLE public.ontology_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_resource_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_branch(p_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ontology_branches b
                  WHERE b.id = p_branch
                    AND b.organization_id IS NOT DISTINCT FROM public.auth_org_id())
$$;

CREATE OR REPLACE FUNCTION public.can_manage_branch(p_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Owner, or a space administrator: "Administrators of the space that a branch
  -- belongs to have the same permissions as the Owner role."
  SELECT public.can_see_branch(p_branch)
     AND (public.auth_role() IN ('owner','admin')
          OR EXISTS (SELECT 1 FROM public.branch_roles r
                      WHERE r.branch_id = p_branch AND r.user_id = auth.uid()))
$$;

REVOKE ALL ON FUNCTION public.can_see_branch(uuid)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_branch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_branch(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_branch(uuid) TO authenticated;

CREATE POLICY "read branches in scope" ON public.ontology_branches
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "members create branches" ON public.ontology_branches
  FOR INSERT WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "owners manage branches" ON public.ontology_branches
  FOR UPDATE USING (public.can_manage_branch(id));
CREATE POLICY "owners delete branches" ON public.ontology_branches
  FOR DELETE USING (public.can_manage_branch(id));

CREATE POLICY "read changes on visible branches" ON public.branch_resource_changes
  FOR SELECT USING (public.can_see_branch(branch_id));
-- Deliberately NOT can_manage_branch: editing a resource on a branch is a
-- resource permission, not a branch one. The branch being visible is the branch
-- half; the resource's own policy is the other, and it still applies.
CREATE POLICY "write changes on visible branches" ON public.branch_resource_changes
  FOR ALL USING (public.can_see_branch(branch_id))
  WITH CHECK (public.can_see_branch(branch_id));

CREATE POLICY "read branch roles" ON public.branch_roles
  FOR SELECT USING (public.can_see_branch(branch_id));
CREATE POLICY "owners manage branch roles" ON public.branch_roles
  FOR ALL USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ontology_branches       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_resource_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_roles            TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; b uuid; b2 uuid;
  usr uuid := gen_random_uuid(); claims text; before text; n int; r record;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '419@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m419') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m419') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm419', 'm419') RETURNING id INTO ont;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label, description)
       VALUES (org, ont, 'Employee', 'Employee', 'People who work here') RETURNING id INTO t;

  INSERT INTO public.ontology_branches (ontology_id, organization_id, name, title, created_by_user_id)
       VALUES (ont, org, 'add-office', 'Add the Office type', usr) RETURNING id INTO b;

  IF (SELECT rid FROM public.ontology_branches WHERE id = b)
     <> 'ri.ontology.main.branch.' || b::text THEN
    RAISE EXCEPTION 'Migration 419: the branch RID is not the attested form';
  END IF;

  -- "The user who creates a branch is automatically assigned the Owner role."
  IF NOT EXISTS (SELECT 1 FROM public.branch_roles
                  WHERE branch_id = b AND user_id = usr AND role = 'owner') THEN
    RAISE EXCEPTION 'Migration 419: the creator was not made an owner';
  END IF;

  -- "You can only branch from the main ontology" — so nothing may be called main.
  BEGIN
    INSERT INTO public.ontology_branches (ontology_id, organization_id, name, title)
         VALUES (ont, org, 'main', 'Main');
    RAISE EXCEPTION 'Migration 419: a branch was named main';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- The overlay: this branch renames Employee and rewrites its description,
  -- recording what main held at the time.
  INSERT INTO public.branch_resource_changes
    (branch_id, resource_kind, resource_id, operation, fields, base)
  VALUES (b, 'object_type', t, 'modified',
          '{"label":"Team member","description":"People who work here"}'::jsonb,
          '{"label":"Employee","description":"People who work here"}'::jsonb);

  -- Nothing has moved on main, so nothing conflicts.
  SELECT count(*) INTO n FROM public.branch_conflicts(b);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 419: a quiet branch reported % conflict(s)', n;
  END IF;

  -- Somebody edits the SAME field on main. That is the conflict the page
  -- describes, and only that field should be reported.
  UPDATE public.object_types SET label = 'Staff member' WHERE id = t;
  SELECT count(*) INTO n FROM public.branch_conflicts(b);
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 419: expected exactly one conflicting field, got %', n;
  END IF;
  SELECT * INTO r FROM public.branch_conflicts(b);
  IF r.field <> 'label' THEN
    RAISE EXCEPTION 'Migration 419: the conflict names field "%", expected label', r.field;
  END IF;
  IF r.main_value <> '"Staff member"'::jsonb OR r.branch_value <> '"Team member"'::jsonb THEN
    RAISE EXCEPTION 'Migration 419: the conflict does not carry both sides';
  END IF;

  -- A field main moved that the branch never touched is NOT a conflict —
  -- "auto-resolves any non-conflicting changes".
  UPDATE public.object_types SET icon = 'people' WHERE id = t;
  SELECT count(*) INTO n FROM public.branch_conflicts(b);
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 419: an untouched field was reported as a conflict (now %)', n;
  END IF;

  -- "Removing a resource from a branch returns its state to the version on main."
  DELETE FROM public.branch_resource_changes WHERE branch_id = b AND resource_id = t;
  SELECT count(*) INTO n FROM public.branch_conflicts(b);
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 419: removing the resource left % conflict(s)', n;
  END IF;

  -- Lifecycle. Merged is terminal; archived restores to active first.
  UPDATE public.ontology_branches SET status = 'archived' WHERE id = b;
  BEGIN
    UPDATE public.ontology_branches SET status = 'merged' WHERE id = b;
    RAISE EXCEPTION 'Migration 419: an archived branch went straight to merged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:RestoreFirst%' THEN RAISE; END IF;
  END;
  UPDATE public.ontology_branches SET status = 'active' WHERE id = b;
  UPDATE public.ontology_branches SET status = 'merged' WHERE id = b;
  BEGIN
    UPDATE public.ontology_branches SET status = 'active' WHERE id = b;
    RAISE EXCEPTION 'Migration 419: a merged branch was reopened';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:MergedIsTerminal%' THEN RAISE; END IF;
  END;

  -- Activity is recorded, which is what the inactivity clock reads.
  INSERT INTO public.ontology_branches (ontology_id, organization_id, name, title, created_by_user_id)
       VALUES (ont, org, 'second', 'Second', usr) RETURNING id INTO b2;
  UPDATE public.ontology_branches SET last_activity_at = now() - interval '40 days' WHERE id = b2;
  INSERT INTO public.branch_resource_changes
    (branch_id, resource_kind, resource_id, operation, fields, base)
  VALUES (b2, 'object_type', t, 'modified', '{"icon":"cube"}'::jsonb, '{"icon":"people"}'::jsonb);
  IF (SELECT last_activity_at FROM public.ontology_branches WHERE id = b2) < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'Migration 419: touching a branch did not record activity';
  END IF;

  -- "Each branch must have at least one Owner." The check is DEFERRED so an
  -- owner handover — delete then insert — is legal inside one transaction. That
  -- also means it does not fire until commit, so the assertion has to ask for it
  -- immediately. The first version of this test deleted the row and declared
  -- failure before the constraint had run at all.
  BEGIN
    SET CONSTRAINTS public.guard_last_branch_owner IMMEDIATE;
    DELETE FROM public.branch_roles WHERE branch_id = b2;
    RAISE EXCEPTION 'Migration 419: a branch was left with no owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Branching:BranchNeedsAnOwner%' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS public.guard_last_branch_owner DEFERRED;

  -- And a handover is still legal, which is what deferring buys.
  DECLARE usr2 uuid := gen_random_uuid();
  BEGIN
    INSERT INTO auth.users (id, email) VALUES (usr2, '419b@beacon.test');
    DELETE FROM public.branch_roles WHERE branch_id = b2;
    INSERT INTO public.branch_roles (branch_id, user_id, role) VALUES (b2, usr2, 'owner');
  END;

  -- Visible to the role the product runs as.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);
  IF (SELECT count(*) FROM public.ontology_branches WHERE ontology_id = ont) <> 2 THEN
    RAISE EXCEPTION 'Migration 419: authenticated cannot read its own branches';
  END IF;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.branch_resource_changes WHERE branch_id IN (b, b2);
  DELETE FROM public.branch_roles WHERE branch_id IN (b, b2);
  DELETE FROM public.ontology_branches WHERE ontology_id = ont;
  DELETE FROM public.object_types WHERE ontology_id = ont;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
