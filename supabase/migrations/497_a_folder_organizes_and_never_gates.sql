-- Compass slice C1: the tree.
--
-- "Within projects, resources can be organized into **folders** to provide
-- further structure and keep things clean."
-- (getting-started/projects-and-resources.md)
--
-- A folder carries NO permissions — Foundry deprecated the one setting that
-- made it a boundary ("Ignore inherited permissions", planned deprecation),
-- naming Projects and Markings as the replacement. So roles keep reaching
-- everything the project contains, and only MARKINGS flow through the
-- chain: the deprecation guide applies them "on the folder or file".
-- Move-out takes Owner ("Typically, only the resource Owner can move files
-- out of Projects", compass/move-and-share-resources.md). Trash is a
-- timestamp: restore "places it where it was before you deleted it and
-- returns previous permissions" (use-project-navigation-panel.md).

-- ── the folder ──────────────────────────────────────────────────────────────
CREATE TABLE public.folders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ri.compass.main.folder is attested — and identical to a project's form;
  -- 396 settled that the format alone does not distinguish them.
  rid              text GENERATED ALWAYS AS (public.rid_of('compass', 'folder', id)) STORED,
  organization_id  uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(btrim(name)) > 0),
  trashed_at       timestamptz,
  trashed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX folders_rid_key ON public.folders (rid);
CREATE INDEX folders_project_idx ON public.folders (project_id);
CREATE INDEX folders_parent_idx ON public.folders (parent_folder_id);
CREATE INDEX folders_trashed_by_idx ON public.folders (trashed_by);
CREATE INDEX folders_created_by_idx ON public.folders (created_by);
COMMENT ON TABLE public.folders IS
  'Further structure inside a project — organization only, never a permission boundary; markings flow through the chain, roles never change.';

CREATE OR REPLACE FUNCTION public.guard_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_folder_id IS NOT NULL THEN
    IF NEW.parent_folder_id = NEW.id THEN
      RAISE EXCEPTION 'Compass:FolderCycle — a folder cannot contain itself';
    END IF;
    IF (SELECT f.project_id FROM public.folders f WHERE f.id = NEW.parent_folder_id)
       IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'Compass:FolderCrossesProjects — a folder nests inside its own project';
    END IF;
    IF EXISTS (
      WITH RECURSIVE up AS (
        SELECT NEW.parent_folder_id AS fid, 1 AS depth
        UNION ALL
        SELECT f.parent_folder_id, up.depth + 1 FROM public.folders f
          JOIN up ON f.id = up.fid
         WHERE f.parent_folder_id IS NOT NULL AND up.depth < 100
      ) SELECT 1 FROM up WHERE fid = NEW.id
    ) THEN
      RAISE EXCEPTION 'Compass:FolderCycle — the parent already sits inside this folder';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_folder BEFORE INSERT OR UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.guard_folder();

-- In trash by the chain, at read time — never by cascading writes.
CREATE OR REPLACE FUNCTION public.folder_in_trash(p_folder uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT f.id, f.parent_folder_id, f.trashed_at FROM public.folders f WHERE f.id = p_folder
    UNION ALL
    SELECT f.id, f.parent_folder_id, f.trashed_at FROM public.folders f
      JOIN up ON f.id = up.parent_folder_id
  )
  SELECT COALESCE(bool_or(trashed_at IS NOT NULL), false) FROM up
$$;

-- ── placement: a column beside project_id, never a new generic table ────────
ALTER TABLE public.datasets
  ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN trashed_at timestamptz,
  ADD COLUMN trashed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.restricted_views
  ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN trashed_at timestamptz,
  ADD COLUMN trashed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.project_resources
  ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN trashed_at timestamptz,
  ADD COLUMN trashed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX datasets_folder_idx ON public.datasets (folder_id);
CREATE INDEX datasets_trashed_by_idx ON public.datasets (trashed_by);
CREATE INDEX restricted_views_folder_idx ON public.restricted_views (folder_id);
CREATE INDEX restricted_views_trashed_by_idx ON public.restricted_views (trashed_by);
CREATE INDEX project_resources_folder_idx ON public.project_resources (folder_id);
CREATE INDEX project_resources_trashed_by_idx ON public.project_resources (trashed_by);

-- The placement guard: the folder's project is the resource's project — and
-- the move-out gate: "Typically, only the resource Owner can move files out
-- of Projects."
CREATE OR REPLACE FUNCTION public.guard_placement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    IF auth.uid() IS NOT NULL
       AND NOT (public.auth_role() IN ('owner', 'admin')
                OR public.role_rank(public.project_role(OLD.project_id)) >= public.role_rank('owner')) THEN
      RAISE EXCEPTION 'Compass:OnlyOwnersMoveOut — moving a file out of a project takes the Owner role there';
    END IF;
    -- Landing in the new project means landing at its root unless the mover
    -- also picked a folder that lives there.
    IF NEW.folder_id IS NOT NULL AND
       (SELECT f.project_id FROM public.folders f WHERE f.id = NEW.folder_id)
       IS DISTINCT FROM NEW.project_id THEN
      NEW.folder_id := NULL;
    END IF;
  END IF;
  IF NEW.folder_id IS NOT NULL AND
     (SELECT f.project_id FROM public.folders f WHERE f.id = NEW.folder_id)
     IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'Compass:FolderInAnotherProject — a resource files into a folder of its own project';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_dataset_placement BEFORE INSERT OR UPDATE ON public.datasets
FOR EACH ROW EXECUTE FUNCTION public.guard_placement();
CREATE TRIGGER trg_guard_rv_placement BEFORE INSERT OR UPDATE ON public.restricted_views
FOR EACH ROW EXECUTE FUNCTION public.guard_placement();
CREATE TRIGGER trg_guard_resource_placement BEFORE INSERT OR UPDATE ON public.project_resources
FOR EACH ROW EXECUTE FUNCTION public.guard_placement();

-- ── markings flow through the chain ─────────────────────────────────────────
ALTER TABLE public.resource_markings DROP CONSTRAINT resource_markings_resource_kind_check;
ALTER TABLE public.resource_markings
  ADD CONSTRAINT resource_markings_resource_kind_check
  CHECK (resource_kind IN ('project', 'dataset', 'folder', 'restricted_view'));

-- Restated whole: the resolver every marking consumer calls. The walk now
-- runs resource → its folder chain → its project, for datasets, restricted
-- views and folders alike; a project's own markings stay direct-only.
CREATE OR REPLACE FUNCTION public.effective_file_markings(p_kind text, p_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH RECURSIVE chain AS (
    SELECT CASE p_kind
      WHEN 'dataset'         THEN (SELECT d.folder_id FROM public.datasets d WHERE d.id = p_id)
      WHEN 'restricted_view' THEN (SELECT v.folder_id FROM public.restricted_views v WHERE v.id = p_id)
      WHEN 'folder'          THEN (SELECT f.parent_folder_id FROM public.folders f WHERE f.id = p_id)
    END AS fid
    UNION ALL
    SELECT f.parent_folder_id FROM public.folders f
      JOIN chain c ON f.id = c.fid
  )
  SELECT coalesce(array_agg(DISTINCT rm.marking_id), '{}'::uuid[])
    FROM public.resource_markings rm
   WHERE (rm.resource_kind = p_kind AND rm.resource_id = p_id)
      OR (rm.resource_kind = 'folder'
          AND rm.resource_id IN (SELECT fid FROM chain WHERE fid IS NOT NULL))
      OR (rm.resource_kind = 'project' AND rm.resource_id = CASE p_kind
            WHEN 'dataset'         THEN (SELECT d.project_id FROM public.datasets d WHERE d.id = p_id)
            WHEN 'restricted_view' THEN (SELECT v.project_id FROM public.restricted_views v WHERE v.id = p_id)
            WHEN 'folder'          THEN (SELECT f.project_id FROM public.folders f WHERE f.id = p_id)
          END)
$$;

-- Restated whole from 401's live definition: the apply/remove gate learns to
-- resolve Owner for the two new kinds; nothing else changes.
CREATE OR REPLACE FUNCTION public.guard_marking_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE m uuid; owns boolean; kind text; res uuid;
BEGIN
  m := coalesce(NEW.marking_id, OLD.marking_id);
  kind := coalesce(NEW.resource_kind, OLD.resource_kind);
  res := coalesce(NEW.resource_id, OLD.resource_id);

  -- Requirement 2: "the 'Update Markings on resource' permission, which is
  -- included in the Owner role by default."
  IF kind = 'project' THEN
    SELECT public.role_rank(public.project_role(res)) >= public.role_rank('owner') INTO owns;
  ELSIF kind = 'folder' THEN
    SELECT public.role_rank(public.project_role(f.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.folders f WHERE f.id = res;
  ELSIF kind = 'restricted_view' THEN
    SELECT public.role_rank(public.project_role(v.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.restricted_views v WHERE v.id = res;
  ELSE
    SELECT public.role_rank(public.project_role(d.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.datasets d WHERE d.id = res;
  END IF;

  -- An org admin is the bootstrap, as everywhere else: someone has to be able to
  -- act before the first project role is granted.
  owns := coalesce(owns, false) OR public.auth_role() IN ('owner','admin');

  IF TG_OP = 'DELETE' THEN
    IF NOT (owns AND public.can_remove_marking(m)) THEN
      RAISE EXCEPTION 'Markings:CannotRemove — removing a marking needs the "remove" permission on it and Owner on the resource'
        USING HINT = 'An Owner role alone is not enough. That is the point of a mandatory control.';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT (owns AND public.can_apply_marking(m)) THEN
    RAISE EXCEPTION 'Markings:CannotApply — applying a marking needs the "apply" permission on it and Owner on the resource';
  END IF;
  RETURN NEW;
END $$;

-- ── folder visibility ───────────────────────────────────────────────────────
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
-- A folder shows to whoever the project shows to, through the same file
-- gate its contents use; editors shape the tree.
CREATE POLICY "project readers see folders" ON public.folders FOR SELECT
  USING (public.resource_file_access('folder', id, organization_id)
         AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors shape the tree" ON public.folders FOR ALL
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')))
  WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
              AND (public.auth_role() IN ('owner', 'admin')
                   OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid; proj2 uuid; fa uuid; fb uuid; ds uuid;
  cat uuid; mk uuid; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('folders-497') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f497a@beacon.test'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f497b@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (u1, 'f497a@beacon.test', 'admin', org),
    (u2, 'f497b@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('F497');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'f497', 'F497') RETURNING id INTO proj;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'f497b', 'F497 B') RETURNING id INTO proj2;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org), (proj2, u1, 'owner', org), (proj, u2, 'editor', org);

  -- 1. The tree: a folder, a subfolder, a dataset filed inside.
  INSERT INTO public.folders (project_id, name) VALUES (proj, 'Ops') RETURNING id INTO fa;
  INSERT INTO public.folders (project_id, parent_folder_id, name)
  VALUES (proj, fa, 'Reports') RETURNING id INTO fb;
  INSERT INTO public.datasets (organization_id, project_id, folder_id, api_name, name)
  VALUES (org, proj, fb, 'f497_ds', 'Filed') RETURNING id INTO ds;

  -- 2. Structure refusals: cycles, cross-project nesting, foreign placement.
  BEGIN
    UPDATE public.folders SET parent_folder_id = fb WHERE id = fa;
    RAISE EXCEPTION 'a folder cycle was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:FolderCycle%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.folders (project_id, parent_folder_id, name) VALUES (proj2, fa, 'Stray');
    RAISE EXCEPTION 'a folder nested across projects';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:FolderCrossesProjects%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.datasets (organization_id, project_id, folder_id, api_name, name)
    VALUES (org, proj2, fb, 'f497_stray', 'Stray');
    RAISE EXCEPTION 'a resource filed into another project''s folder';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:FolderInAnotherProject%' THEN RAISE; END IF;
  END;

  -- 3. A marking on the ancestor folder reaches the dataset through the
  --    chain, and gates a non-member's file access.
  RESET ROLE;
  INSERT INTO public.marking_categories (name, category_type, organization_id)
  VALUES ('F497', 'conjunctive', org) RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'F497 Restricted') RETURNING id INTO mk;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (mk, u1, 'apply');
  -- The applier keeps SIGHT through membership — 399: a permission holder
  -- can classify data they cannot read, and an owner who forgets their own
  -- membership goes blind to the file they just marked (the fixture's first
  -- draft proved it: every later step no-opped silently).
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u1);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id) VALUES (mk, 'folder', fa);
  IF NOT (public.effective_file_markings('dataset', ds) @> ARRAY[mk]) THEN
    RAISE EXCEPTION 'the folder marking should reach the dataset through the chain';
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  SELECT count(*) INTO n FROM public.datasets WHERE id = ds;
  IF n <> 0 THEN RAISE EXCEPTION 'a non-member of the folder marking still saw the dataset'; END IF;
  RESET ROLE;
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u2);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.datasets WHERE id = ds;
  IF n <> 1 THEN RAISE EXCEPTION 'a marking member should see the filed dataset'; END IF;

  -- 4. Move-out takes Owner: the editor is refused, the owner passes, and
  --    the foreign folder placement clears to the new project's root.
  BEGIN
    UPDATE public.datasets SET project_id = proj2 WHERE id = ds;
    RAISE EXCEPTION 'an editor moved a file out of the project';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:OnlyOwnersMoveOut%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  UPDATE public.datasets SET project_id = proj2 WHERE id = ds;
  IF (SELECT folder_id FROM public.datasets WHERE id = ds) IS NOT NULL THEN
    RAISE EXCEPTION 'a cross-project move should land at the new root';
  END IF;
  UPDATE public.datasets SET project_id = proj, folder_id = fb WHERE id = ds;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'move-back matched % rows', n; END IF;

  -- 5. Trash by the chain: trashing the ancestor folder puts the dataset in
  --    trash at read time; restore is in place.
  UPDATE public.folders SET trashed_at = clock_timestamp(), trashed_by = u1 WHERE id = fa;
  IF NOT public.folder_in_trash(fb) THEN
    RAISE EXCEPTION 'a subfolder of a trashed folder is in trash by the chain';
  END IF;
  UPDATE public.folders SET trashed_at = NULL, trashed_by = NULL WHERE id = fa;
  IF public.folder_in_trash(fb) THEN
    RAISE EXCEPTION 'restore should lift the chain immediately';
  END IF;
  IF (SELECT folder_id FROM public.datasets WHERE id = ds) IS DISTINCT FROM fb THEN
    RAISE EXCEPTION 'restore must not move anything';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '497: a folder organizes and never gates; markings flow through the chain';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
