-- 685: Workshop — modules, layout, widgets, variables, events.
--
-- The first of the eleven applications on Foundry's Home that we lacked,
-- and the one everything already built feeds:
--
--   "Workshop reduces the barrier to entry for application builders by using the Object layer as the primary building block. All data in a Workshop Application is read from the Object Data Layer, allowing application creators to take advantage of rich characteristics such as links between object types."
--   — workshop/overview.md
--
-- A module is a COMPASS resource, permissioned by the project it sits in:
--
--   "To create a new module, open **Projects & Files** from the left workspace navigation panel, then find your desired Project or folder. Once there, select **New > Workshop module** in the top right to create a new module within the current Project or folder. The new module will inherit the permission of the Project or folder in which it is created."
--   — workshop/getting-started.md
--
--   "By default, users need the Viewer role to open a Workshop module, and the Editor role to edit it."
--   — workshop/concepts-permissions.md
--
-- so the policies are the project-resource shape restricted_views already
-- uses, with EDITOR as the write floor rather than owner — the page names
-- the role, so we do not invent a stricter one.
--
-- THE LAYOUT TREE IS ROWS. Sections nest:
--
--   "Sections are the components of each page and overlay that allow module builders to subdivide the user interface. Each section is configured to contain one or more widgets, or a layout, which itself may contain one or more sections."
--   — workshop/concepts-layouts.md
--
-- A jsonb blob would make that tree unqueryable and its six layouts
-- unconstrainable. Widget CONFIGURATION is jsonb, and that is Foundry's
-- own shape rather than our shortcut:
--
--   "The **Raw Widget Configuration** displays how the current widget’s setup is stored in JSON and offers advanced module builders the option to quickly view, edit, or copy this configuration in its raw format."
--   — workshop/concepts-widgets.md
--
-- EVENT ORDER IS THE SEMANTICS, and Foundry states its own limitation:
--
--   "Events in Workshop execute sequentially in their configured order. To reorder two or more events on a widget, drag the event cards up or down in the configuration panel. Events do not wait for dependent computations from previous events to finish before executing."
--   — workshop/concepts-events.md
--
-- so events are ordered rows, and our engine is not more correct than
-- theirs — the page admits Workshop "does not support forcing events to
-- wait for all downstream updates to complete".
--
-- SIX WIDGET KINDS, NOT SIXTY-TWO. The section's 62 widget pages are a
-- catalogue; the six here carry the getting-started walkthrough end to
-- end, so the foundation is provable rather than plausible. The rest are
-- INDEXED by workshop_widget_kinds() with built = false — the rule that
-- wanting an allowlist is the signal to index instead.

-- ── the vocabularies, as functions so they can carry their own notes ────────

CREATE FUNCTION public.workshop_widget_kinds()
RETURNS TABLE (kind text, label text, category text, built boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- category is the PICKER's own set (workshop/images/widget_picker.png):
  -- Properties and links, Visualize, Filter, Writeback, Foundry apps.
  -- The prose groups the docs differently; the picker is the drawn surface.
  SELECT * FROM (VALUES
    ('object_table',  'Object table',  'properties_and_links', true,
     'Display objects data in a tabular format and allows for cell-level inline editing'),
    ('object_view',   'Object view',   'properties_and_links', true,
     'Shows the object view of a single object'),
    ('filter_list',   'Filter list',   'filter',               true,
     'Visualize a high-level summary of objects data to allow filtering'),
    ('button_group',  'Button group',  'writeback',            true,
     'Embed one or more buttons that can trigger Actions, Workshop Events, URLs to be opened'),
    ('metric_card',   'Metric card',   'visualize',            true,
     'Render a card to highlight key metrics or statistics'),
    ('markdown',      'Markdown',      'properties_and_links', true,
     'Render markdown text, optionally interpolating variables'),
    ('chart_xy',      'Chart: XY',     'visualize',            false,
     'Visualize objects data as a bar, line, or scatter chart — widgets-chart, unbuilt'),
    ('map',           'Map',           'visualize',            false,
     'Visualize objects data on a map — widgets-map, unbuilt'),
    ('object_list',   'Object list',   'properties_and_links', false,
     'widgets-object-list, unbuilt'),
    ('property_list', 'Property list', 'properties_and_links', false,
     'widgets-property-list, unbuilt'),
    ('tabs',          'Tabs',          'foundry_apps',         false,
     'widgets-tabs, unbuilt — the Tabs widget derives its selection from Switch-to-page events'),
    ('text_input',    'Text input',    'writeback',            false,
     'widgets-text-input, unbuilt')
  ) AS t(kind, label, category, built, note)
$$;
COMMENT ON FUNCTION public.workshop_widget_kinds() IS
  'The widget catalogue as an index rather than an allowlist: six built, and the rest recorded with the page that would build them. Categories are the picker''s own (workshop/images/widget_picker.png), which differ from the five groupings the prose uses. The section holds 62 widget pages; this names the ones an arc has reached.';

CREATE FUNCTION public.workshop_event_kinds()
RETURNS TABLE (kind text, family text, note text)
LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('open_overlay',      'layers',       'Open the overlay specified in the event name'),
    ('close_overlay',     'layers',       'Close the overlay specified in the event name'),
    ('switch_to_page',    'layout',       'Switch to the chosen page'),
    ('expand_section',    'layout',       'Expand the section specified in the event name'),
    ('collapse_section',  'layout',       'Collapse the section specified in the event name'),
    ('toggle_section',    'layout',       'Expand the section if collapsed, collapse it if expanded'),
    ('reset_variable',    'variables',    'Set the variable to the value configured in its definition'),
    ('recompute_variable','variables',    'Recompute the variable from its inputs and definition'),
    ('set_variable_value','variables',    'Assign the source variable''s current value to the target'),
    ('open_object_view',  'applications', 'Open an Object view'),
    ('open_object_explorer','applications','Open Object Explorer')
  ) AS t(kind, family, note)
$$;
COMMENT ON FUNCTION public.workshop_event_kinds() IS
  'The event families workshop/concepts-events enumerates, minus the ones with nothing to reach: the AIP Assist family and Stream-LLM-response (no LLM binding exists here), and the Quiver and Notepad application events (those products are not built). Switch-to-tab arrives with the Tabs widget.';

-- ── the module, a project resource ──────────────────────────────────────────

CREATE TABLE public.workshop_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('workshop', 'module', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  -- the header is module-wide and persists across pages, so it lives here
  header_visible  boolean NOT NULL DEFAULT true,
  header_title    text,
  header_icon     text,
  header_icon_color text CHECK (header_icon_color IS NULL
                                OR header_icon_color ~ '^#[0-9A-Fa-f]{6}$'),
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workshop_modules_rid_key ON public.workshop_modules (rid);
CREATE INDEX workshop_modules_project_idx ON public.workshop_modules (project_id);
CREATE INDEX workshop_modules_folder_idx ON public.workshop_modules (folder_id);
CREATE INDEX workshop_modules_org_idx ON public.workshop_modules (organization_id);
CREATE INDEX workshop_modules_created_by_idx ON public.workshop_modules (created_by);
COMMENT ON TABLE public.workshop_modules IS
  'A Workshop application (workshop/overview). A Compass resource in a project, inheriting its permissions — Viewer opens, Editor edits (workshop/concepts-permissions). The header lives here because it is module-wide: "Only the module header will persist between pages".';

-- ── pages, sections, overlays ───────────────────────────────────────────────

CREATE TABLE public.workshop_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  is_default boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0
);
CREATE INDEX workshop_pages_module_idx ON public.workshop_pages (module_id);
-- the Layout panel marks exactly one page (DEFAULT)
CREATE UNIQUE INDEX workshop_pages_one_default
  ON public.workshop_pages (module_id) WHERE is_default;
COMMENT ON TABLE public.workshop_pages IS
  'A page of a module — "Each page is a blank canvas on which a module builder can configure a unique set of widgets to support the targeted workflow" (workshop/concepts-layouts). One per module is marked default, as the Layout panel draws it (workshop/images/add_page.png).';

CREATE TABLE public.workshop_overlays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  kind       text NOT NULL DEFAULT 'modal'
             CONSTRAINT workshop_overlays_kind_check
             CHECK (kind = ANY (ARRAY['drawer', 'modal'])),
  -- drawers only: which side they slide from
  side       text CHECK (side IS NULL OR side = ANY (ARRAY['left', 'right'])),
  size       integer CHECK (size IS NULL OR size > 0),
  show_header boolean NOT NULL DEFAULT true,
  title      text,
  icon       text,
  close_on_backdrop_click boolean NOT NULL DEFAULT true,
  backdrop   boolean NOT NULL DEFAULT true,
  CHECK (kind = 'drawer' OR side IS NULL)
);
CREATE INDEX workshop_overlays_module_idx ON public.workshop_overlays (module_id);
COMMENT ON CONSTRAINT workshop_overlays_kind_check ON public.workshop_overlays IS
  'Values from workshop/concepts-layouts: "Currently, Workshop supports two overlay types: drawers and modals." Drawers take a Position (left or right) and a Size; modals take Size alone, which is why side is refused on a modal.';

CREATE TABLE public.workshop_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  -- a section belongs to a page, an overlay, or another section: exactly one
  page_id    uuid REFERENCES public.workshop_pages(id) ON DELETE CASCADE,
  overlay_id uuid REFERENCES public.workshop_overlays(id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES public.workshop_sections(id) ON DELETE CASCADE,
  layout     text NOT NULL DEFAULT 'rows'
             CONSTRAINT workshop_sections_layout_check
             CHECK (layout = ANY (ARRAY['columns', 'rows', 'tabs', 'flow', 'toolbar', 'loop'])),
  position   integer NOT NULL DEFAULT 0,
  show_header boolean NOT NULL DEFAULT false,
  title      text,
  icon       text,
  collapsible boolean NOT NULL DEFAULT false,
  collapsed   boolean NOT NULL DEFAULT false,
  -- Auto (max) / Absolute / Flex, the Display tab's three
  width_mode  text NOT NULL DEFAULT 'auto'
              CHECK (width_mode = ANY (ARRAY['auto', 'absolute', 'flex'])),
  width_value integer CHECK (width_value IS NULL OR width_value > 0),
  CONSTRAINT workshop_sections_one_parent
    CHECK (num_nonnulls(page_id, overlay_id, parent_id) = 1)
);
CREATE INDEX workshop_sections_module_idx ON public.workshop_sections (module_id);
CREATE INDEX workshop_sections_page_idx ON public.workshop_sections (page_id);
CREATE INDEX workshop_sections_overlay_idx ON public.workshop_sections (overlay_id);
CREATE INDEX workshop_sections_parent_idx ON public.workshop_sections (parent_id);
COMMENT ON CONSTRAINT workshop_sections_layout_check ON public.workshop_sections IS
  'Values from workshop/concepts-layouts, which enumerates the six supported Layout options: Columns, Rows, Tabs, Flow, Toolbar, Loop. The layout selector draws the same six in the same order (workshop/images/layout_selector.png).';
COMMENT ON TABLE public.workshop_sections IS
  'The layout tree as rows rather than a blob: a section hangs off a page, an overlay, or another section, because a section "may contain one or more sections" (workshop/concepts-layouts).';

-- ── variables ───────────────────────────────────────────────────────────────

CREATE TABLE public.workshop_variables (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  value_type text NOT NULL
             CONSTRAINT workshop_variables_value_type_check
             CHECK (value_type = ANY (ARRAY['array', 'boolean', 'date', 'geopoint',
               'geoshape', 'numeric', 'object_set', 'object_set_filter', 'string',
               'struct', 'timestamp', 'time_series_set'])),
  definition_type text NOT NULL DEFAULT 'static'
             CONSTRAINT workshop_variables_definition_type_check
             CHECK (definition_type = ANY (ARRAY['static', 'function',
               'object_set_aggregation', 'object_property', 'object_set_definition',
               'variable_transformation'])),
  -- Automatic / Only when triggered by an event / On module load, and when
  -- triggered by an event. Deliberately UNDECLARED: the third token's page
  -- form carries a comma, which no word-form of a snake_case value matches,
  -- and a declaration the suite cannot verify is worse than none.
  recompute  text NOT NULL DEFAULT 'automatic'
             CHECK (recompute = ANY (ARRAY['automatic', 'on_event', 'on_load_and_event'])),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  position   integer NOT NULL DEFAULT 0
);
CREATE INDEX workshop_variables_module_idx ON public.workshop_variables (module_id);
-- "Matching is case-insensitive, so `MyVar` and `myvar` are duplicates."
CREATE UNIQUE INDEX workshop_variables_name_key
  ON public.workshop_variables (module_id, lower(name));
COMMENT ON CONSTRAINT workshop_variables_value_type_check ON public.workshop_variables IS
  'Values from workshop/concepts-variables, whose Variable types section enumerates all twelve: Array, Boolean, Date, GeoPoint, GeoShape, Numeric, Object set, Object set filter, String, Struct, Timestamp, Time series set.';
COMMENT ON CONSTRAINT workshop_variables_definition_type_check ON public.workshop_variables IS
  'Values from workshop/concepts-variables: the variable definition type dropdown offers Static, Function, Object set aggregation, Object property, Object set definition, and Variable transformation.';

-- ── widgets ─────────────────────────────────────────────────────────────────

CREATE TABLE public.workshop_widgets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  -- a widget sits in a section, or in the module header
  section_id uuid REFERENCES public.workshop_sections(id) ON DELETE CASCADE,
  in_header  boolean NOT NULL DEFAULT false,
  kind       text NOT NULL,
  name       text NOT NULL CHECK (length(btrim(name)) > 0),
  position   integer NOT NULL DEFAULT 0,
  -- the Display tab's sizing
  size_mode  text NOT NULL DEFAULT 'auto'
             CHECK (size_mode = ANY (ARRAY['auto', 'absolute', 'flex'])),
  size_value integer CHECK (size_value IS NULL OR size_value > 0),
  -- "how the current widget's setup is stored in JSON" — Foundry's shape
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT workshop_widgets_somewhere
    CHECK (in_header = (section_id IS NULL))
);
CREATE INDEX workshop_widgets_module_idx ON public.workshop_widgets (module_id);
CREATE INDEX workshop_widgets_section_idx ON public.workshop_widgets (section_id);
COMMENT ON COLUMN public.workshop_widgets.config IS
  'The widget''s setup, as JSON — the shape Foundry itself stores and exposes as Raw Widget Configuration (workshop/concepts-widgets), not a shortcut around columns.';

-- a widget's kind must be one the catalogue has actually built
CREATE FUNCTION public.guard_widget_kind()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM public.workshop_widget_kinds() w WHERE w.kind = NEW.kind;
  IF k.kind IS NULL THEN
    RAISE EXCEPTION 'Workshop:UnknownWidgetKind — % is not a widget kind', NEW.kind;
  END IF;
  IF NOT k.built THEN
    RAISE EXCEPTION 'Workshop:WidgetNotBuilt — the % widget is catalogued but not built: %',
      k.label, k.note;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_widget_kind
  BEFORE INSERT OR UPDATE OF kind ON public.workshop_widgets
  FOR EACH ROW EXECUTE FUNCTION public.guard_widget_kind();

-- ── events ──────────────────────────────────────────────────────────────────

CREATE TABLE public.workshop_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id  uuid NOT NULL REFERENCES public.workshop_widgets(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  -- order IS the semantics: "Events in Workshop execute sequentially in
  -- their configured order"
  position   integer NOT NULL DEFAULT 0,
  -- what the event acts on, by kind: a page, section, overlay or variable
  page_id    uuid REFERENCES public.workshop_pages(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.workshop_sections(id) ON DELETE CASCADE,
  overlay_id uuid REFERENCES public.workshop_overlays(id) ON DELETE CASCADE,
  variable_id uuid REFERENCES public.workshop_variables(id) ON DELETE CASCADE,
  source_variable_id uuid REFERENCES public.workshop_variables(id) ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX workshop_events_widget_idx ON public.workshop_events (widget_id, position);
CREATE INDEX workshop_events_page_idx ON public.workshop_events (page_id);
CREATE INDEX workshop_events_section_idx ON public.workshop_events (section_id);
CREATE INDEX workshop_events_overlay_idx ON public.workshop_events (overlay_id);
CREATE INDEX workshop_events_variable_idx ON public.workshop_events (variable_id);
CREATE INDEX workshop_events_source_variable_idx ON public.workshop_events (source_variable_id);

CREATE FUNCTION public.guard_event_target()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fam text;
BEGIN
  SELECT e.family INTO fam FROM public.workshop_event_kinds() e WHERE e.kind = NEW.kind;
  IF fam IS NULL THEN
    RAISE EXCEPTION 'Workshop:UnknownEventKind — % is not an event kind', NEW.kind;
  END IF;
  IF fam = 'layers' AND NEW.overlay_id IS NULL THEN
    RAISE EXCEPTION 'Workshop:EventNeedsTarget — a % event names the overlay it opens or closes', NEW.kind;
  END IF;
  IF NEW.kind = 'switch_to_page' AND NEW.page_id IS NULL THEN
    RAISE EXCEPTION 'Workshop:EventNeedsTarget — a switch_to_page event names its page';
  END IF;
  IF NEW.kind IN ('expand_section', 'collapse_section', 'toggle_section')
     AND NEW.section_id IS NULL THEN
    RAISE EXCEPTION 'Workshop:EventNeedsTarget — a % event names its section', NEW.kind;
  END IF;
  IF fam = 'variables' AND NEW.variable_id IS NULL THEN
    RAISE EXCEPTION 'Workshop:EventNeedsTarget — a % event names its variable', NEW.kind;
  END IF;
  IF NEW.kind = 'set_variable_value' AND NEW.source_variable_id IS NULL THEN
    RAISE EXCEPTION 'Workshop:EventNeedsTarget — set_variable_value names a source variable to copy from';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_event_target
  BEFORE INSERT OR UPDATE ON public.workshop_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_target();

-- ── permissions: the project resource shape, Editor as the write floor ──────

ALTER TABLE public.workshop_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_pages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_overlays  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_widgets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_events    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members open modules" ON public.workshop_modules
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author modules" ON public.workshop_modules
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

-- Everything inside a module is reached through the module, so one helper
-- answers for all six children rather than six restatements of the same rule.
CREATE FUNCTION public.can_open_module(p_module uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.workshop_modules m
                  WHERE m.id = p_module
                    AND m.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(m.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_module(p_module uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.workshop_modules m
                  WHERE m.id = p_module
                    AND m.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(m.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_open_module(uuid) IS
  'Viewer opens a module (workshop/concepts-permissions). Composed by every child table so the rule lives once.';
COMMENT ON FUNCTION public.can_edit_module(uuid) IS
  'Editor edits a module — the role the page names, not a stricter one we invented (workshop/concepts-permissions).';

CREATE POLICY "open the module to read its pages" ON public.workshop_pages
  FOR SELECT USING ((SELECT public.can_open_module(module_id)));
CREATE POLICY "edit the module to author its pages" ON public.workshop_pages
  FOR ALL USING ((SELECT public.can_edit_module(module_id)))
          WITH CHECK ((SELECT public.can_edit_module(module_id)));

CREATE POLICY "open the module to read its overlays" ON public.workshop_overlays
  FOR SELECT USING ((SELECT public.can_open_module(module_id)));
CREATE POLICY "edit the module to author its overlays" ON public.workshop_overlays
  FOR ALL USING ((SELECT public.can_edit_module(module_id)))
          WITH CHECK ((SELECT public.can_edit_module(module_id)));

CREATE POLICY "open the module to read its sections" ON public.workshop_sections
  FOR SELECT USING ((SELECT public.can_open_module(module_id)));
CREATE POLICY "edit the module to author its sections" ON public.workshop_sections
  FOR ALL USING ((SELECT public.can_edit_module(module_id)))
          WITH CHECK ((SELECT public.can_edit_module(module_id)));

CREATE POLICY "open the module to read its variables" ON public.workshop_variables
  FOR SELECT USING ((SELECT public.can_open_module(module_id)));
CREATE POLICY "edit the module to author its variables" ON public.workshop_variables
  FOR ALL USING ((SELECT public.can_edit_module(module_id)))
          WITH CHECK ((SELECT public.can_edit_module(module_id)));

CREATE POLICY "open the module to read its widgets" ON public.workshop_widgets
  FOR SELECT USING ((SELECT public.can_open_module(module_id)));
CREATE POLICY "edit the module to author its widgets" ON public.workshop_widgets
  FOR ALL USING ((SELECT public.can_edit_module(module_id)))
          WITH CHECK ((SELECT public.can_edit_module(module_id)));

CREATE POLICY "open the module to read its events" ON public.workshop_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workshop_widgets w
                             WHERE w.id = widget_id
                               AND public.can_open_module(w.module_id)));
CREATE POLICY "edit the module to author its events" ON public.workshop_events
  FOR ALL USING (EXISTS (SELECT 1 FROM public.workshop_widgets w
                          WHERE w.id = widget_id
                            AND public.can_edit_module(w.module_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workshop_widgets w
                       WHERE w.id = widget_id
                         AND public.can_edit_module(w.module_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_overlays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_variables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_widgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_events TO authenticated;

-- ── creating a module gives it the page a new module has ────────────────────
-- "the default, unconfigured page that is initialized with two vertically
-- divided sections beneath the module-wide header"
-- (workshop/images/configure_new_page.png)

CREATE FUNCTION public.create_workshop_module(
  p_project uuid, p_name text, p_folder uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE m uuid; pg uuid; root uuid;
BEGIN
  INSERT INTO public.workshop_modules (project_id, folder_id, name)
  VALUES (p_project, p_folder, p_name) RETURNING id INTO m;
  INSERT INTO public.workshop_pages (module_id, name, is_default, position)
  VALUES (m, 'Page', true, 0) RETURNING id INTO pg;
  INSERT INTO public.workshop_sections (module_id, page_id, layout, position)
  VALUES (m, pg, 'columns', 0) RETURNING id INTO root;
  INSERT INTO public.workshop_sections (module_id, parent_id, layout, position)
  VALUES (m, root, 'rows', 0), (m, root, 'rows', 1);
  RETURN m;
END $$;
COMMENT ON FUNCTION public.create_workshop_module(uuid, text, uuid) IS
  'Creates a module with the page a new one starts with: two vertically divided sections under the module header (workshop/images/configure_new_page.png). INVOKER, so the module''s own policy decides who may.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; m uuid; pg uuid; ov uuid; sec uuid; w uuid;
  v1 uuid; v2 uuid; n integer;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ws-685') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ws-685') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws685a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws685b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'ws685a@beacon.test', 'admin', org),
      (u2, 'ws685b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ws_685', 'Workshop 685') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- 1. A new module starts as the capture draws it.
    SELECT public.create_workshop_module(proj, 'Flight Alert Inbox') INTO m;
    SELECT count(*) INTO n FROM public.workshop_pages WHERE module_id = m AND is_default;
    IF n <> 1 THEN RAISE EXCEPTION 'a new module should have one default page, got %', n; END IF;
    SELECT count(*) INTO n FROM public.workshop_sections s
      JOIN public.workshop_sections p ON p.id = s.parent_id
     WHERE s.module_id = m;
    IF n <> 2 THEN RAISE EXCEPTION 'a new page should start with two divided sections, got %', n; END IF;
    IF (SELECT mm.rid FROM public.workshop_modules mm WHERE mm.id = m)
       NOT LIKE 'ri.workshop.main.module.%' THEN
      RAISE EXCEPTION 'the module rid does not follow the grammar';
    END IF;

    -- 2. A second default page is refused.
    BEGIN
      INSERT INTO public.workshop_pages (module_id, name, is_default) VALUES (m, 'Second', true);
      RAISE EXCEPTION 'two default pages were accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 3. A section hangs off exactly one parent.
    SELECT id INTO pg FROM public.workshop_pages WHERE module_id = m;
    SELECT id INTO sec FROM public.workshop_sections
     WHERE module_id = m AND parent_id IS NOT NULL LIMIT 1;
    BEGIN
      INSERT INTO public.workshop_sections (module_id, page_id, parent_id, layout)
      VALUES (m, pg, sec, 'rows');
      RAISE EXCEPTION 'a section took two parents';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 4. The six layouts, and only those.
    UPDATE public.workshop_sections SET layout = 'toolbar' WHERE id = sec;
    BEGIN
      UPDATE public.workshop_sections SET layout = 'grid' WHERE id = sec;
      RAISE EXCEPTION 'a seventh layout was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.workshop_sections SET layout = 'rows' WHERE id = sec;

    -- 5. A built widget lands; a catalogued-but-unbuilt one refuses by name.
    INSERT INTO public.workshop_widgets (module_id, section_id, kind, name)
    VALUES (m, sec, 'object_table', 'Object table 1') RETURNING id INTO w;
    BEGIN
      INSERT INTO public.workshop_widgets (module_id, section_id, kind, name)
      VALUES (m, sec, 'map', 'Map 1');
      RAISE EXCEPTION 'an unbuilt widget kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:WidgetNotBuilt%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.workshop_widgets (module_id, section_id, kind, name)
      VALUES (m, sec, 'invented', 'Nope');
      RAISE EXCEPTION 'an unknown widget kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:UnknownWidgetKind%' THEN RAISE; END IF;
    END;

    -- 6. A widget is in a section or in the header, never both or neither.
    BEGIN
      INSERT INTO public.workshop_widgets (module_id, section_id, in_header, kind, name)
      VALUES (m, sec, true, 'button_group', 'Both');
      RAISE EXCEPTION 'a widget was in a section and the header at once';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.workshop_widgets (module_id, in_header, kind, name)
    VALUES (m, true, 'button_group', 'Header buttons');

    -- 7. Variable names are unique case-insensitively.
    INSERT INTO public.workshop_variables (module_id, name, value_type, definition_type)
    VALUES (m, 'Object table 1 Object set', 'object_set', 'object_set_definition')
    RETURNING id INTO v1;
    INSERT INTO public.workshop_variables (module_id, name, value_type, definition_type)
    VALUES (m, 'Filter list 1 Filter output', 'object_set_filter', 'static')
    RETURNING id INTO v2;
    BEGIN
      INSERT INTO public.workshop_variables (module_id, name, value_type)
      VALUES (m, 'object table 1 object set', 'string');
      RAISE EXCEPTION 'a case-insensitive duplicate name was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.workshop_variables (module_id, name, value_type)
      VALUES (m, 'Invented', 'colour');
      RAISE EXCEPTION 'a thirteenth variable type was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 8. An event names what it acts on.
    INSERT INTO public.workshop_overlays (module_id, name, kind, side, size)
    VALUES (m, 'Details', 'drawer', 'right', 500) RETURNING id INTO ov;
    BEGIN
      INSERT INTO public.workshop_overlays (module_id, name, kind, side)
      VALUES (m, 'Bad modal', 'modal', 'left');
      RAISE EXCEPTION 'a modal took a side';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.workshop_events (widget_id, kind, overlay_id, position)
    VALUES (w, 'open_overlay', ov, 0);
    BEGIN
      INSERT INTO public.workshop_events (widget_id, kind, position)
      VALUES (w, 'close_overlay', 1);
      RAISE EXCEPTION 'a layers event named no overlay';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:EventNeedsTarget%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.workshop_events (widget_id, kind, variable_id, position)
      VALUES (w, 'set_variable_value', v1, 1);
      RAISE EXCEPTION 'set_variable_value named no source';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:EventNeedsTarget%' THEN RAISE; END IF;
    END;
    INSERT INTO public.workshop_events (widget_id, kind, variable_id, source_variable_id, position)
    VALUES (w, 'set_variable_value', v1, v2, 1);
    BEGIN
      INSERT INTO public.workshop_events (widget_id, kind, position)
      VALUES (w, 'send_to_aip_assist', 2);
      RAISE EXCEPTION 'an excluded event family was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:UnknownEventKind%' THEN RAISE; END IF;
    END;

    -- 9. The catalogue indexes more than it builds.
    SELECT count(*) INTO n FROM public.workshop_widget_kinds() WHERE built;
    IF n <> 6 THEN RAISE EXCEPTION 'six widget kinds should be built, got %', n; END IF;
    SELECT count(*) INTO n FROM public.workshop_widget_kinds();
    IF n <= 6 THEN RAISE EXCEPTION 'the catalogue should record more than it builds'; END IF;

    -- 10. Viewer opens, Editor edits — and a stranger sees nothing.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
    IF public.can_open_module(m) THEN
      RAISE EXCEPTION 'someone with no project role opened the module';
    END IF;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u2, 'viewer', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
    IF NOT public.can_open_module(m) THEN
      RAISE EXCEPTION 'a viewer could not open the module';
    END IF;
    IF public.can_edit_module(m) THEN
      RAISE EXCEPTION 'a viewer could edit the module';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '685 proved: a new module opens with one default page over two divided sections and a workshop RID, a second default is refused, a section takes exactly one parent, the six layouts hold, a built widget lands while catalogued-but-unbuilt and unknown kinds refuse by name, a widget is in a section xor the header, variable names collide case-insensitively, every event family names its target, the catalogue records more than it builds, and Viewer opens where only Editor edits';
  END;
END $$;
