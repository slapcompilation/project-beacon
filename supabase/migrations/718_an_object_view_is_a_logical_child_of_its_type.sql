-- 718 — the Object View: a configured view as a logical child of its object
-- type, tabs as Workshop modules, and the standard view as the landing that
-- stores nothing (creation review F8; readings/object-views.md, whose §20
-- corrections and operator gate this build follows).
--
-- The two-view model:
--
--   "Foundry creates a standard Object View for all object types by default.
--    When you create a configured Object View, it becomes the default view
--    for users, though they can switch back to the standard Object View
--    through a toggle button packaged with the Object View."
--   — object-views/config-overview.md
--
-- The standard view is a pure function of the object type — no page anywhere
-- configures, persists, or scopes one, so NOTHING here stores it. The
-- operator's gate (2026-08-28) took the landing as standard-first and the
-- configured default as COMPUTED UNTIL FIRST EDIT: creating a type writes no
-- view rows; a row in object_views IS the detach moment —
--
--   "The default views will dynamically update to reflect changes made to
--    the object type, such as new properties or property renames, but once
--    an Object View is edited it becomes user-managed and all further
--    updates must be made manually."
--   — object-views/config-overview.md
--
-- Tabs are Workshop, and only Workshop:
--
--   "There are two types of tabs available to add to your Object View:
--    Managed Workshop, and Standalone Workshop modules."
--   — object-views/config-tabs.md
--
-- Placement and permissions:
--
--   "Object views and the Workshop modules that make up object view tabs and
--    panels are logical children of the parent object type."
--   — object-views/branching-object-views.md
--
-- so object_views carries no project, no RID and no ACL of its own: reads
-- compose auth_in_ontology through the type, writes compose
-- can_index_object_type — the same Editor-project-role predicate the
-- branching page's current-model paragraph describes (an object view has no
-- public API surface and no filesystem resource type either; the reading's
-- §20.9 verified the api/ null result). The tab id is immutable once made:
--
--   This value is generated on tab creation and cannot be edited
--   —   object-views/images/delete-tab-in-advanced-settings.png

CREATE TABLE public.object_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One configured view per type: the toggle is standard <-> configured, and
  -- the pages speak of THE configured view; per-audience variation is
  -- per-tab profiles (config-profiles), a recorded residual, not more views.
  object_type_id uuid NOT NULL UNIQUE
    REFERENCES public.object_types(id) ON DELETE CASCADE,
  -- Bumped on every save; the header's version chip. A versions table with
  -- restore is a recorded residual (config-versions).
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.object_views IS
  'The CONFIGURED Object View — a logical child of its object type, existing only once authored (a row is the detach moment; before it, the type renders its standard view, computed and stored nowhere). One per type; tabs below carry the content. 718.';

CREATE TABLE public.object_view_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL REFERENCES public.object_views(id) ON DELETE CASCADE,
  -- The stable identity the deep-link and YAML carry; immutable by trigger.
  tab_id text NOT NULL CHECK (tab_id ~ '^[a-z][a-z0-9-]*$'),
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL,
  module_id uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE RESTRICT,
  UNIQUE (view_id, tab_id)
);

ALTER TABLE public.object_view_tabs ADD CONSTRAINT object_view_tabs_kind_check
  CHECK (kind IN ('managed_workshop', 'standalone_workshop'));
COMMENT ON CONSTRAINT object_view_tabs_kind_check ON public.object_view_tabs IS
  'Values from object-views/config-tabs, whose enumerating sentence lists the two: Managed Workshop, and Standalone Workshop modules.';

COMMENT ON TABLE public.object_view_tabs IS
  'A configured view''s tabs, each a Workshop module — managed (built inside the view, not reusable) or standalone (an existing module). Single-tab views hide the tab strip on the surface. 718.';

CREATE INDEX object_view_tabs_view_idx ON public.object_view_tabs (view_id, position);

-- The tab id cannot change once made (the capture's own words, above).
CREATE FUNCTION public.guard_object_view_tab() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.tab_id IS DISTINCT FROM OLD.tab_id THEN
    RAISE EXCEPTION 'ObjectViews:TabIdIsFixed — a tab id is generated on creation and cannot be edited';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER guard_object_view_tab BEFORE UPDATE ON public.object_view_tabs
FOR EACH ROW EXECUTE FUNCTION public.guard_object_view_tab();

-- Every save bumps the view's version, whichever table carried the edit.
CREATE FUNCTION public.bump_object_view_version() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v uuid;
BEGIN
  v := coalesce(NEW.view_id, OLD.view_id);
  UPDATE public.object_views SET version = version + 1, updated_at = now() WHERE id = v;
  RETURN coalesce(NEW, OLD);
END $fn$;
CREATE TRIGGER bump_object_view_version
AFTER INSERT OR UPDATE OR DELETE ON public.object_view_tabs
FOR EACH ROW EXECUTE FUNCTION public.bump_object_view_version();

-- The landing resolver: the configured view's id, or NULL meaning "render
-- the standard view" — the operator's standard-first decision, and the
-- toggle sentence's shape.
CREATE FUNCTION public.object_view_for(p_object_type uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT v.id FROM public.object_views v WHERE v.object_type_id = p_object_type
$fn$;
COMMENT ON FUNCTION public.object_view_for(uuid) IS
  'NULL means the standard view: computed from the type, stored nowhere. A row means a configured view exists and is the default, with the standard view one toggle away. 718.';

-- ── RLS: no ACL of its own — the type''s access, composed ───────────────────

ALTER TABLE public.object_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_view_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views follow the type's ontology" ON public.object_views
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types ot
     WHERE ot.id = object_type_id AND public.auth_in_ontology(ot.ontology_id)));
CREATE POLICY "the type's editors author its view" ON public.object_views
  FOR ALL USING (public.can_index_object_type(object_type_id))
  WITH CHECK (public.can_index_object_type(object_type_id));

CREATE POLICY "tabs follow their view" ON public.object_view_tabs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_views v JOIN public.object_types ot ON ot.id = v.object_type_id
     WHERE v.id = view_id AND public.auth_in_ontology(ot.ontology_id)));
CREATE POLICY "the type's editors author its tabs" ON public.object_view_tabs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.object_views v
     WHERE v.id = view_id AND public.can_index_object_type(v.object_type_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.object_views v
     WHERE v.id = view_id AND public.can_index_object_type(v.object_type_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_views, public.object_view_tabs TO authenticated;

-- ── PROVED BY DOING — resolver, detach, immutability, cascade; self-clean ───

DO $$
DECLARE
  org uuid; space uuid; proj uuid; ont uuid; ot uuid; v uuid; tab uuid;
  mod uuid; got uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m718 probe') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m718 probe') RETURNING id INTO space;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (space, org);
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm718_probe', 'm718 probe') RETURNING id INTO proj;
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (space, 'm718_probe', 'M718', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M718Thing', 'M718 thing') RETURNING id INTO ot;

  -- Standard-first: a new type resolves to NO configured view.
  SELECT public.object_view_for(ot) INTO got;
  IF got IS NOT NULL THEN
    RAISE EXCEPTION 'a new type resolved to a configured view: %', got;
  END IF;

  -- The detach moment: authoring writes the first rows.
  INSERT INTO public.workshop_modules (organization_id, project_id, name)
  VALUES (org, proj, 'M718 overview module') RETURNING id INTO mod;
  INSERT INTO public.object_views (object_type_id) VALUES (ot) RETURNING id INTO v;
  INSERT INTO public.object_view_tabs (view_id, tab_id, title, position, kind, module_id)
  VALUES (v, 'overview', 'Overview', 0, 'managed_workshop', mod) RETURNING id INTO tab;
  SELECT public.object_view_for(ot) INTO got;
  IF got IS DISTINCT FROM v THEN
    RAISE EXCEPTION 'the authored view did not become the default';
  END IF;
  SELECT version INTO n FROM public.object_views WHERE id = v;
  IF n <> 2 THEN
    RAISE EXCEPTION 'the tab insert did not bump the version (v=%)', n;
  END IF;

  -- The tab id is fixed.
  BEGIN
    UPDATE public.object_view_tabs SET tab_id = 'renamed' WHERE id = tab;
    RAISE EXCEPTION 'a tab id rename was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm NOT LIKE '%TabIdIsFixed%' THEN RAISE; END IF;
  END;

  -- A second configured view for the same type is refused.
  BEGIN
    INSERT INTO public.object_views (object_type_id) VALUES (ot);
    RAISE EXCEPTION 'a second view per type was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Logical child: deleting the type takes the view and its tabs with it.
  DELETE FROM public.object_types WHERE id = ot;
  SELECT count(*) INTO n FROM public.object_views WHERE id = v;
  IF n <> 0 THEN RAISE EXCEPTION 'the view outlived its type'; END IF;
  SELECT count(*) INTO n FROM public.object_view_tabs WHERE view_id = v;
  IF n <> 0 THEN RAISE EXCEPTION 'a tab outlived its view'; END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.workshop_modules WHERE id = mod;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.organizations WHERE id = org;
END $$;
