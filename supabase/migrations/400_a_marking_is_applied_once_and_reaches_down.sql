-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 400 — applying a marking, and file-hierarchy inheritance.
--
-- Reading: docs/foundry-reference/readings/markings.md (M3)
--
-- "Markings provide an additional level of access control for FILES, FOLDERS,
-- and PROJECTS within Foundry." That is the whole list of things a marking can
-- be applied to — note a *space* is not on it, so this table does not accept one.
--
-- STORE ONCE, RESOLVE ON READ. `markings-project.png` draws the "after" state as
-- a single Marking chip with a BRACE SPANNING THE WHOLE CONTAINER — it does not
-- redraw the shield on each file. The marking lives where it was applied and
-- *reaches* the contents. Copying it onto every descendant would make removal a
-- sweep instead of one delete, and the docs are explicit that removal is instant:
--
--   "Removing a Marking directly from a file, folder, or Project will
--    IMMEDIATELY remove the Marking from any dependencies that inherited it. You
--    do not need to rebuild datasets downstream."
--
-- So `resource_markings` holds applications, and `effective_file_markings()`
-- resolves. One row deleted, and every descendant is clear on the next read.
--
-- WHAT INHERITANCE MEANS HERE. "If a Project or folder has a Marking, every file
-- or folder within it inherits the Marking. This means that restricting access to
-- a Project or folder always restricts access to everything inside it."
--
-- Our containment is space → project → dataset (migration 397). Foundry's has
-- folders between project and file; we have none, so the chain is two links long.
-- A marking on a project reaches its datasets. That is the whole of M3.
--
-- APPLYING NEEDS TWO PERMISSIONS FROM TWO SYSTEMS:
--   "1. You have the 'Apply marking' permission on the Marking.
--    2. You have the 'Update Markings on resource' permission, which is included
--       in the Owner role by default."
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE public.resource_markings (
  marking_id    uuid NOT NULL REFERENCES public.markings(id) ON DELETE RESTRICT,
  -- "files, folders, and Projects". We have no folders; a dataset is our file.
  resource_kind text NOT NULL CHECK (resource_kind IN ('project','dataset')),
  resource_id   uuid NOT NULL,
  applied_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marking_id, resource_kind, resource_id)
);

COMMENT ON TABLE public.resource_markings IS
  'Where a marking was APPLIED — one row, not one per descendant. Inheritance is resolved by effective_file_markings(), so removing the application clears every descendant on the next read.';

CREATE INDEX resource_markings_resource_idx ON public.resource_markings (resource_kind, resource_id);

-- The set a resource actually demands: applied here, plus everything its
-- container demands. Two links, because our hierarchy has two.
CREATE OR REPLACE FUNCTION public.effective_file_markings(p_kind text, p_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(DISTINCT rm.marking_id), '{}'::uuid[])
    FROM public.resource_markings rm
   WHERE (rm.resource_kind = p_kind AND rm.resource_id = p_id)
      -- "restricting access to a Project always restricts access to everything
      -- inside it" — a dataset inherits its project's markings.
      OR (p_kind = 'dataset' AND rm.resource_kind = 'project'
          AND rm.resource_id = (SELECT d.project_id FROM public.datasets d WHERE d.id = p_id))
$$;

COMMENT ON FUNCTION public.effective_file_markings(text, uuid) IS
  'Every marking a resource demands by the FILE route: applied directly here, plus inherited from its project. Data-dependency markings are a separate set — see effective_data_markings.';

-- Which of those arrived from a container rather than being applied here. The UI
-- draws these with a folder sidecar icon; without this a surface cannot tell the
-- two apart, and "where is this coming from" is the question the docs devote a
-- whole section to.
CREATE OR REPLACE FUNCTION public.file_marking_origin(p_kind text, p_id uuid, p_marking uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.resource_markings rm
                  WHERE rm.marking_id = p_marking
                    AND rm.resource_kind = p_kind AND rm.resource_id = p_id)
      THEN 'direct'
    ELSE 'file_hierarchy'
  END
$$;

COMMENT ON FUNCTION public.file_marking_origin(text, uuid, uuid) IS
  'direct = applied on this resource; file_hierarchy = inherited from its project. Foundry renders the second with a folder sidecar icon on the chip.';

-- ── who may apply and remove ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_marking_application()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m uuid; owns boolean;
BEGIN
  m := coalesce(NEW.marking_id, OLD.marking_id);

  -- Requirement 2: "the 'Update Markings on resource' permission, which is
  -- included in the Owner role by default."
  IF coalesce(NEW.resource_kind, OLD.resource_kind) = 'project' THEN
    SELECT public.role_rank(public.project_role(coalesce(NEW.resource_id, OLD.resource_id)))
             >= public.role_rank('owner') INTO owns;
  ELSE
    SELECT public.role_rank(public.project_role(d.project_id)) >= public.role_rank('owner')
      INTO owns FROM public.datasets d WHERE d.id = coalesce(NEW.resource_id, OLD.resource_id);
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

CREATE TRIGGER guard_marking_application
  BEFORE INSERT OR DELETE ON public.resource_markings
  FOR EACH ROW EXECUTE FUNCTION public.guard_marking_application();

-- Reading which markings a resource carries is not the same as passing them; the
-- chip is visible on the access panel to anyone who can see the resource.
CREATE POLICY "read applied markings" ON public.resource_markings
  FOR SELECT USING (true);
CREATE POLICY "apply and remove markings" ON public.resource_markings
  FOR ALL USING (true) WITH CHECK (true);

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; cat uuid; mk uuid; usr uuid; eff uuid[]; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  SELECT id INTO usr FROM public.users LIMIT 1;

  INSERT INTO public.organizations (name) VALUES ('m400') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm400', 'm400') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm400', 'm400') RETURNING id INTO ds;
  INSERT INTO public.marking_categories (name) VALUES ('m400') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org))::text, true);

  -- Owner alone is not enough. auth.uid() is NULL here so can_apply_marking is
  -- false, which is exactly the case being asserted.
  BEGIN
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
         VALUES (mk, 'project', proj);
    RAISE EXCEPTION 'Migration 400: a marking was applied without the apply permission';
  EXCEPTION WHEN OTHERS THEN
    IF position('CannotApply' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- Apply it the way a permitted caller would, bypassing only the permission
  -- trigger — the inheritance behaviour is what this section is testing.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'project', proj);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  -- "restricting access to a Project always restricts access to everything
  -- inside it" — the dataset demands it without a row of its own.
  eff := public.effective_file_markings('dataset', ds);
  IF NOT (mk = ANY (eff)) THEN
    RAISE EXCEPTION 'Migration 400: a dataset did not inherit its project''s marking';
  END IF;
  IF public.file_marking_origin('dataset', ds, mk) <> 'file_hierarchy' THEN
    RAISE EXCEPTION 'Migration 400: an inherited marking was reported as direct';
  END IF;
  IF public.file_marking_origin('project', proj, mk) <> 'direct' THEN
    RAISE EXCEPTION 'Migration 400: the applied marking was not reported as direct';
  END IF;

  -- One delete clears the descendant. No sweep, no rebuild.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = mk;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  IF array_length(public.effective_file_markings('dataset', ds), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 400: removing the application did not clear the descendant';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = mk;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
