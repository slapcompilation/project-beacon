-- 688: Slate — applications, pages, widgets, variables, events, styles.
--
--   "**Slate** enables application developers (builders) to construct dynamic and responsive applications with a custom design using a drag-and-drop interface, reducing development time and cost."
--   — slate/overview.md
--
--   "Slate supports two types of applications: Integrated applications and public applications."
--   — slate/applications-types.md
--
-- SLATE IS NOT WORKSHOP, and the difference is structural rather than
-- stylistic. Workshop's data is the object layer by principle; Slate's is
-- queries against anything, including sources outside Foundry. Workshop
-- lays out nesting sections; Slate positions widgets on a canvas with a
-- container type. Sharing 685's tables would force one product's shape
-- onto the other, so this is its own resource.
--
-- THE NAMES ARE THE WIRING. An event pairs two identifiers:
--
--   "Choose `w_button.click` for the triggering event, and `q_query.run` for the triggered action, and select **Update** to persist your change. No JavaScript is necessary for this pairing."
--   — slate/concepts-events.md
--
-- and the namespace they share is ONE, not four:
--
--   "Shared variable names must be unique across all pages, widgets, events, queries, and functions."
--   — slate/concepts-variables.md
--
-- which is why slate_identifiers exists: a widget, a query, a function and
-- a shared variable cannot collide, and a unique index says so once rather
-- than four indexes each saying half of it. A page-local variable is
-- exempt — it "cannot name clash with an environment variable" and must be
-- unique only within its page.
--
-- The probe found the sharper version of that: once the prefix guard holds,
-- a query CANNOT take a widget's name, because their prefixes differ. The
-- naming convention IS the namespace separation, and the shared index
-- catches what remains — two things of the same kind. That is presumably
-- how the page can state the rule as flatly as it does.
--
-- The JSON escape hatch is Foundry's own design, not our shortcut:
--
--   "If the **Property** tab does not provide the setting you need, edit the widget's raw JSON configuration in this tab. Each widget starts with template code containing the most commonly used attributes, and fields changed in the **Property** tab also appear in the **JSON** tab."
--   — slate/navigation.md
--
-- Public applications are RECORDED, NOT BUILT. Their whole definition is an
-- isolation boundary — "Public Slate applications are not able to read data
-- and resources outside of the application itself" — plus an organization
-- permission we do not have; a half-built isolation is worse than none, so
-- the kind is stored and a guard refuses creating one until the boundary
-- exists.

-- ── the identifier namespace ────────────────────────────────────────────────

CREATE FUNCTION public.slate_identifier_prefixes()
RETURNS TABLE (kind text, prefix text, note text)
LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('widget',   'w_', 'A widget on the canvas or in the toolbar'),
    ('query',    'q_', 'A query the application runs for data'),
    ('variable', 'v_', 'A value stored across the application or one page'),
    ('function', 'f_', 'JavaScript logic, sandboxed away from the DOM')
  ) AS t(kind, prefix, note)
$$;
COMMENT ON FUNCTION public.slate_identifier_prefixes() IS
  'The four identifier kinds an event can name, with the prefixes the docs use throughout (w_button.click, q_query.run, v_doubleSelection.set). Shared names compete in one namespace across all four, which is why slate_identifiers holds them together.';

CREATE TABLE public.slate_apps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('slate', 'app', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  kind            text NOT NULL DEFAULT 'integrated'
                  CONSTRAINT slate_apps_kind_check
                  CHECK (kind = ANY (ARRAY['integrated', 'public'])),
  -- "Each Slate application has exactly one local stylesheet which can be
  -- referenced from across the application."
  stylesheet      text NOT NULL DEFAULT '',
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX slate_apps_rid_key ON public.slate_apps (rid);
CREATE INDEX slate_apps_project_idx ON public.slate_apps (project_id);
CREATE INDEX slate_apps_folder_idx ON public.slate_apps (folder_id);
CREATE INDEX slate_apps_org_idx ON public.slate_apps (organization_id);
CREATE INDEX slate_apps_created_by_idx ON public.slate_apps (created_by);
COMMENT ON TABLE public.slate_apps IS
  'A Slate application (slate/overview): widgets on a canvas, wired by named events, drawing data from queries rather than from the object layer by principle. A project resource, with exactly one local stylesheet.';
COMMENT ON CONSTRAINT slate_apps_kind_check ON public.slate_apps IS
  'Values from slate/applications-types: "Slate supports two types of applications: Integrated applications and public applications." Public is stored but refused until its isolation boundary is built.';
COMMENT ON COLUMN public.slate_apps.stylesheet IS
  'The application''s single local stylesheet — "Each Slate application has exactly one local stylesheet which can be referenced from across the application" (slate/concepts-styles). Really LESS upstream; we store the text and do not compile it.';

CREATE TABLE public.slate_pages (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id   uuid NOT NULL REFERENCES public.slate_apps(id) ON DELETE CASCADE,
  name     text NOT NULL CHECK (length(btrim(name)) > 0),
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX slate_pages_app_idx ON public.slate_pages (app_id);
-- a page's name reaches the URL, so it is unique per application
CREATE UNIQUE INDEX slate_pages_name_key ON public.slate_pages (app_id, lower(name));
COMMENT ON TABLE public.slate_pages IS
  'A page of a Slate application — a scope boundary, not just a screen: pages split "UI, logic, and resources ... providing isolated scope for each page that loads separately" (slate/applications-pages), which is why variables have a page scope at all.';

-- One row per named thing in an application. The uniqueness rule the
-- variables page states lives here, once.
CREATE TABLE public.slate_identifiers (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id  uuid NOT NULL REFERENCES public.slate_apps(id) ON DELETE CASCADE,
  kind    text NOT NULL,
  name    text NOT NULL CHECK (name ~ '^[a-z]_[A-Za-z0-9_]+$'),
  -- NULL for a shared identifier; a page for a page-local variable
  page_id uuid REFERENCES public.slate_pages(id) ON DELETE CASCADE
);
CREATE INDEX slate_identifiers_app_idx ON public.slate_identifiers (app_id);
CREATE INDEX slate_identifiers_page_idx ON public.slate_identifiers (page_id);
-- "Shared variable names must be unique across all pages, widgets, events,
-- queries, and functions" — one namespace for everything not page-local.
CREATE UNIQUE INDEX slate_identifiers_shared_key
  ON public.slate_identifiers (app_id, lower(name)) WHERE page_id IS NULL;
-- "Local variables names must be unique within the page"
CREATE UNIQUE INDEX slate_identifiers_local_key
  ON public.slate_identifiers (page_id, lower(name)) WHERE page_id IS NOT NULL;
COMMENT ON TABLE public.slate_identifiers IS
  'Every named thing in a Slate application — widget, query, variable or function — in ONE namespace, because "Shared variable names must be unique across all pages, widgets, events, queries, and functions" (slate/concepts-variables). Page-local variables are the exception and are unique within their page instead.';

CREATE FUNCTION public.guard_identifier_prefix()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE want text;
BEGIN
  SELECT p.prefix INTO want FROM public.slate_identifier_prefixes() p WHERE p.kind = NEW.kind;
  IF want IS NULL THEN
    RAISE EXCEPTION 'Slate:UnknownIdentifierKind — % is not a Slate identifier kind', NEW.kind;
  END IF;
  IF left(NEW.name, length(want)) <> want THEN
    RAISE EXCEPTION 'Slate:WrongPrefix — a % is named %…, not "%"', NEW.kind, want, NEW.name;
  END IF;
  IF NEW.page_id IS NOT NULL AND NEW.kind <> 'variable' THEN
    RAISE EXCEPTION 'Slate:OnlyVariablesArePageLocal — a % belongs to the application, not one page', NEW.kind;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_identifier_prefix
  BEFORE INSERT OR UPDATE ON public.slate_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.guard_identifier_prefix();

-- ── widgets: a tree on a canvas ─────────────────────────────────────────────

CREATE TABLE public.slate_widgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        uuid NOT NULL REFERENCES public.slate_apps(id) ON DELETE CASCADE,
  page_id       uuid NOT NULL REFERENCES public.slate_pages(id) ON DELETE CASCADE,
  identifier_id uuid NOT NULL UNIQUE REFERENCES public.slate_identifiers(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES public.slate_widgets(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  -- the CONTAINER TYPE dropdown's five, with Split carrying its axis
  container_type text
                CONSTRAINT slate_widgets_container_type_check
                CHECK (container_type IS NULL OR container_type = ANY
                  (ARRAY['basic', 'flex', 'repeating', 'split', 'tabbed'])),
  split_axis    text CHECK (split_axis IS NULL
                            OR split_axis = ANY (ARRAY['horizontally', 'vertically'])),
  -- the Layout tab
  x integer, y integer, width integer, height integer,
  -- the Styles input and Additional Classes, per widget
  styles            text NOT NULL DEFAULT '',
  additional_classes text NOT NULL DEFAULT '',
  -- the JSON tab, which the page documents as the intended overflow
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (split_axis IS NULL OR container_type = 'split')
);
CREATE INDEX slate_widgets_app_idx ON public.slate_widgets (app_id);
CREATE INDEX slate_widgets_page_idx ON public.slate_widgets (page_id);
CREATE INDEX slate_widgets_parent_idx ON public.slate_widgets (parent_id);
COMMENT ON TABLE public.slate_widgets IS
  'A widget on a Slate page, in a tree under its container. Its raw JSON is the JSON tab Foundry itself documents as the overflow for anything the Property tab lacks (slate/navigation), not a shortcut around columns.';
COMMENT ON CONSTRAINT slate_widgets_container_type_check ON public.slate_widgets IS
  'Values from the CONTAINER TYPE dropdown the editor draws — basic, flex, repeating, split, tabbed (slate/images/slate-ui-annotated.png). The widgets-container page lists the category as seven by splitting Split along its axis and counting Dialog, which is a container widget rather than a container type; split_axis carries that axis here.';

CREATE FUNCTION public.slate_widget_kinds()
RETURNS TABLE (kind text, label text, category text, built boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- categories are the eight the section's widget pages carry
  SELECT * FROM (VALUES
    ('container', 'Container', 'container', true,  'Holds other widgets; its container type decides how'),
    ('text',      'Text',      'text',      true,  'Text and HTML, templated with Handlebars'),
    ('button',    'Button',    'control',   true,  'A control that raises a click event'),
    ('input',     'Input Box', 'control',   true,  'A single-line value the user types'),
    ('dropdown',  'Dropdown',  'control',   true,  'A value the user picks from a list'),
    ('table',     'Table',     'visualization', true, 'Rows and columns from a query'),
    ('card',      'Card',      'text',      false, 'widgets-text, unbuilt'),
    ('list',      'List',      'text',      false, 'widgets-text, unbuilt'),
    ('image',     'Image',     'text',      false, 'widgets-text, unbuilt'),
    ('chart',     'Chart',     'chart',     false, 'widgets-chart, unbuilt'),
    ('map',       'Map',       'visualization', false, 'widgets-visualization, unbuilt'),
    ('graph',     'Graph',     'visualization', false, 'widgets-visualization, unbuilt'),
    ('date_picker','Date Picker','time',    false, 'widgets-time, unbuilt'),
    ('object_card','Object Card','platform', false, 'widgets-platform, unbuilt'),
    ('iframe',    'Iframe',    'advanced',  false, 'widgets-advanced, unbuilt')
  ) AS t(kind, label, category, built, note)
$$;
COMMENT ON FUNCTION public.slate_widget_kinds() IS
  'The Slate widget catalogue as an index rather than an allowlist: six built, the rest recorded against the widget page that documents each. The section carries roughly forty widgets across eight category pages; this names the ones an arc has reached.';

CREATE FUNCTION public.guard_slate_widget()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k record;
BEGIN
  SELECT * INTO k FROM public.slate_widget_kinds() w WHERE w.kind = NEW.kind;
  IF k.kind IS NULL THEN
    RAISE EXCEPTION 'Slate:UnknownWidgetKind — % is not a widget kind', NEW.kind;
  END IF;
  IF NOT k.built THEN
    RAISE EXCEPTION 'Slate:WidgetNotBuilt — the % widget is catalogued but not built: %', k.label, k.note;
  END IF;
  IF NEW.kind = 'container' AND NEW.container_type IS NULL THEN
    RAISE EXCEPTION 'Slate:ContainerNeedsType — a container names one of the five container types';
  END IF;
  IF NEW.kind <> 'container' AND NEW.container_type IS NOT NULL THEN
    RAISE EXCEPTION 'Slate:NotAContainer — only a container carries a container type';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_slate_widget
  BEFORE INSERT OR UPDATE ON public.slate_widgets
  FOR EACH ROW EXECUTE FUNCTION public.guard_slate_widget();

-- ── variables ───────────────────────────────────────────────────────────────

CREATE TABLE public.slate_variables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        uuid NOT NULL REFERENCES public.slate_apps(id) ON DELETE CASCADE,
  identifier_id uuid NOT NULL UNIQUE REFERENCES public.slate_identifiers(id) ON DELETE CASCADE,
  value_type    text NOT NULL
                CONSTRAINT slate_variables_value_type_check
                CHECK (value_type = ANY
                  (ARRAY['Number', 'String', 'Boolean', 'Array', 'Object', 'Null'])),
  default_value jsonb NOT NULL DEFAULT 'null'::jsonb
);
CREATE INDEX slate_variables_app_idx ON public.slate_variables (app_id);
COMMENT ON TABLE public.slate_variables IS
  'A value stored across a Slate application or one of its pages. Values "do not persist across page loads" (slate/concepts-variables), so only the default is stored; scope lives on the identifier.';
COMMENT ON CONSTRAINT slate_variables_value_type_check ON public.slate_variables IS
  'Values from slate/concepts-variables: "The valid types for variables are `Number`, `String`, `Boolean`, `Array`, `Object`, and `Null`." Kept in the page''s own casing, as wire vocabulary.';

-- ── events: one identifier's event drives another's action ──────────────────

CREATE TABLE public.slate_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id              uuid NOT NULL REFERENCES public.slate_apps(id) ON DELETE CASCADE,
  event_identifier_id uuid NOT NULL REFERENCES public.slate_identifiers(id) ON DELETE CASCADE,
  event_name          text NOT NULL CHECK (length(btrim(event_name)) > 0),
  action_identifier_id uuid NOT NULL REFERENCES public.slate_identifiers(id) ON DELETE CASCADE,
  action_name         text NOT NULL CHECK (length(btrim(action_name)) > 0),
  -- "You can also define custom logic for events using Handlebar references
  -- and JavaScript"; no JavaScript is necessary for a plain pairing.
  body                text NOT NULL DEFAULT '',
  position            integer NOT NULL DEFAULT 0
);
CREATE INDEX slate_events_app_idx ON public.slate_events (app_id);
CREATE INDEX slate_events_event_idx ON public.slate_events (event_identifier_id);
CREATE INDEX slate_events_action_idx ON public.slate_events (action_identifier_id);
COMMENT ON TABLE public.slate_events IS
  'An event/action pair as the panel draws it: w_button.click drives q_query.run, with optional JavaScript between (slate/concepts-events, slate/images/events-panel.png). Both halves are identifiers, so a rename cannot silently break a wiring.';

CREATE FUNCTION public.guard_slate_event()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a uuid; b uuid;
BEGIN
  SELECT i.app_id INTO a FROM public.slate_identifiers i WHERE i.id = NEW.event_identifier_id;
  SELECT i.app_id INTO b FROM public.slate_identifiers i WHERE i.id = NEW.action_identifier_id;
  IF a IS DISTINCT FROM NEW.app_id OR b IS DISTINCT FROM NEW.app_id THEN
    RAISE EXCEPTION 'Slate:WiringCrossesApps — an event wires two identifiers of the same application';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_slate_event
  BEFORE INSERT OR UPDATE ON public.slate_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_slate_event();

-- Public applications are refused until their isolation boundary exists.
CREATE FUNCTION public.guard_public_slate_app()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'public' THEN
    RAISE EXCEPTION 'Slate:PublicAppsNotBuilt — a public application may not read objects, datasets, actions or files, and that isolation is not built here; the kind is recorded so the boundary can be added before it is offered';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_public_slate_app
  BEFORE INSERT OR UPDATE OF kind ON public.slate_apps
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_slate_app();

-- ── permissions: the project resource shape, Editor edits ───────────────────

ALTER TABLE public.slate_apps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slate_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slate_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slate_widgets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slate_variables   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slate_events      ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_open_slate_app(p_app uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.slate_apps a
                  WHERE a.id = p_app
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(a.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_slate_app(p_app uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.slate_apps a
                  WHERE a.id = p_app
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(a.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_open_slate_app(uuid) IS
  'Integrated applications "are published to Foundry users within your Organization and can be viewed or edited based on user permissions" (slate/applications-types) — so a project role opens one, composed by every child table.';
COMMENT ON FUNCTION public.can_edit_slate_app(uuid) IS
  'Editor edits a Slate application, the same floor a Workshop module uses.';

CREATE POLICY "project members open slate apps" ON public.slate_apps
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author slate apps" ON public.slate_apps
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "open the app to read its pages" ON public.slate_pages
  FOR SELECT USING ((SELECT public.can_open_slate_app(app_id)));
CREATE POLICY "edit the app to author its pages" ON public.slate_pages
  FOR ALL USING ((SELECT public.can_edit_slate_app(app_id)))
          WITH CHECK ((SELECT public.can_edit_slate_app(app_id)));

CREATE POLICY "open the app to read its identifiers" ON public.slate_identifiers
  FOR SELECT USING ((SELECT public.can_open_slate_app(app_id)));
CREATE POLICY "edit the app to author its identifiers" ON public.slate_identifiers
  FOR ALL USING ((SELECT public.can_edit_slate_app(app_id)))
          WITH CHECK ((SELECT public.can_edit_slate_app(app_id)));

CREATE POLICY "open the app to read its widgets" ON public.slate_widgets
  FOR SELECT USING ((SELECT public.can_open_slate_app(app_id)));
CREATE POLICY "edit the app to author its widgets" ON public.slate_widgets
  FOR ALL USING ((SELECT public.can_edit_slate_app(app_id)))
          WITH CHECK ((SELECT public.can_edit_slate_app(app_id)));

CREATE POLICY "open the app to read its variables" ON public.slate_variables
  FOR SELECT USING ((SELECT public.can_open_slate_app(app_id)));
CREATE POLICY "edit the app to author its variables" ON public.slate_variables
  FOR ALL USING ((SELECT public.can_edit_slate_app(app_id)))
          WITH CHECK ((SELECT public.can_edit_slate_app(app_id)));

CREATE POLICY "open the app to read its events" ON public.slate_events
  FOR SELECT USING ((SELECT public.can_open_slate_app(app_id)));
CREATE POLICY "edit the app to author its events" ON public.slate_events
  FOR ALL USING ((SELECT public.can_edit_slate_app(app_id)))
          WITH CHECK ((SELECT public.can_edit_slate_app(app_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_apps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_identifiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_widgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_variables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_events TO authenticated;

-- ── creating an application, with the document a new one has ────────────────

CREATE FUNCTION public.create_slate_app(
  p_project uuid, p_name text, p_folder uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE a uuid; pg uuid; ident uuid;
BEGIN
  INSERT INTO public.slate_apps (project_id, folder_id, name)
  VALUES (p_project, p_folder, p_name) RETURNING id INTO a;
  INSERT INTO public.slate_pages (app_id, name, position)
  VALUES (a, 'Home', 0) RETURNING id INTO pg;
  -- the widget list is rooted at a document container, as the editor draws
  INSERT INTO public.slate_identifiers (app_id, kind, name)
  VALUES (a, 'widget', 'w_document') RETURNING id INTO ident;
  INSERT INTO public.slate_widgets (app_id, page_id, identifier_id, kind, container_type)
  VALUES (a, pg, ident, 'container', 'basic');
  RETURN a;
END $$;
COMMENT ON FUNCTION public.create_slate_app(uuid, text, uuid) IS
  'Creates a Slate application with the document a new one starts from: one page rooted at a w_document container, as the widget list draws it (slate/images/slate-ui-annotated.png). INVOKER, so the application''s own policy decides who may.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid; pg uuid; pg2 uuid; root uuid;
  i_w uuid; i_q uuid; i_v uuid; n integer;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('slate-688') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('slate-688') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slate688a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slate688b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'slate688a@beacon.test', 'admin', org),
      (u2, 'slate688b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'slate_688', 'Slate 688') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- 1. A new application starts as the editor draws it.
    SELECT public.create_slate_app(proj, 'Slate Example') INTO a;
    SELECT id INTO pg FROM public.slate_pages WHERE app_id = a;
    SELECT count(*) INTO n FROM public.slate_widgets w
      JOIN public.slate_identifiers i ON i.id = w.identifier_id
     WHERE w.app_id = a AND i.name = 'w_document' AND w.container_type = 'basic';
    IF n <> 1 THEN RAISE EXCEPTION 'a new app should be rooted at a w_document container'; END IF;
    IF (SELECT s.rid FROM public.slate_apps s WHERE s.id = a) NOT LIKE 'ri.slate.main.app.%' THEN
      RAISE EXCEPTION 'the app rid does not follow the grammar';
    END IF;

    -- 2. One namespace, case-insensitively. Note what the probe found: with
    --    the prefix guard in place a query can never take a WIDGET's name,
    --    because the prefixes differ — the convention IS the separation, and
    --    the index catches the collisions that remain, same-kind ones.
    INSERT INTO public.slate_identifiers (app_id, kind, name)
    VALUES (a, 'query', 'q_orders') RETURNING id INTO i_q;
    BEGIN
      INSERT INTO public.slate_identifiers (app_id, kind, name) VALUES (a, 'query', 'q_ORDERS');
      RAISE EXCEPTION 'a duplicate shared name was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 3. The prefix must match the kind.
    BEGIN
      INSERT INTO public.slate_identifiers (app_id, kind, name) VALUES (a, 'query', 'v_wrong');
      RAISE EXCEPTION 'a query took the variable prefix';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Slate:WrongPrefix%' THEN RAISE; END IF;
    END;

    -- 4. Only variables are page-local, and a local name is unique per page.
    INSERT INTO public.slate_pages (app_id, name, position) VALUES (a, 'Second', 1)
    RETURNING id INTO pg2;
    INSERT INTO public.slate_identifiers (app_id, kind, name, page_id)
    VALUES (a, 'variable', 'v_local', pg) RETURNING id INTO i_v;
    -- the same local name on another page is fine
    INSERT INTO public.slate_identifiers (app_id, kind, name, page_id)
    VALUES (a, 'variable', 'v_local', pg2);
    BEGIN
      INSERT INTO public.slate_identifiers (app_id, kind, name, page_id)
      VALUES (a, 'widget', 'w_pageLocal', pg);
      RAISE EXCEPTION 'a widget was made page-local';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Slate:OnlyVariablesArePageLocal%' THEN RAISE; END IF;
    END;

    -- 5. Container rules: a container names a type, a non-container may not.
    SELECT w.id INTO root FROM public.slate_widgets w
      JOIN public.slate_identifiers i ON i.id = w.identifier_id
     WHERE w.app_id = a AND i.name = 'w_document';
    INSERT INTO public.slate_identifiers (app_id, kind, name) VALUES (a, 'widget', 'w_button1')
    RETURNING id INTO i_w;
    INSERT INTO public.slate_widgets (app_id, page_id, identifier_id, parent_id, kind)
    VALUES (a, pg, i_w, root, 'button');
    BEGIN
      INSERT INTO public.slate_identifiers (app_id, kind, name) VALUES (a, 'widget', 'w_bad');
      INSERT INTO public.slate_widgets (app_id, page_id, identifier_id, kind, container_type)
      VALUES (a, pg, (SELECT id FROM public.slate_identifiers WHERE app_id = a AND name = 'w_bad'),
              'button', 'flex');
      RAISE EXCEPTION 'a button carried a container type';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Slate:NotAContainer%' THEN RAISE; END IF;
    END;

    -- 6. A catalogued-but-unbuilt kind refuses by name.
    BEGIN
      INSERT INTO public.slate_identifiers (app_id, kind, name) VALUES (a, 'widget', 'w_map1');
      INSERT INTO public.slate_widgets (app_id, page_id, identifier_id, kind)
      VALUES (a, pg, (SELECT id FROM public.slate_identifiers WHERE app_id = a AND name = 'w_map1'), 'map');
      RAISE EXCEPTION 'an unbuilt widget kind was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Slate:WidgetNotBuilt%' THEN RAISE; END IF;
    END;

    -- 7. Split carries an axis; nothing else may.
    UPDATE public.slate_widgets SET container_type = 'split', split_axis = 'horizontally'
     WHERE id = root;
    BEGIN
      UPDATE public.slate_widgets SET container_type = 'tabbed' WHERE id = root;
      RAISE EXCEPTION 'a tabbed container kept a split axis';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.slate_widgets SET container_type = 'basic', split_axis = NULL WHERE id = root;

    -- 8. An event wires two identifiers of the same application.
    INSERT INTO public.slate_events (app_id, event_identifier_id, event_name,
                                     action_identifier_id, action_name)
    VALUES (a, i_w, 'click', i_q, 'run');
    SELECT count(*) INTO n FROM public.slate_events WHERE app_id = a;
    IF n <> 1 THEN RAISE EXCEPTION 'the wiring did not land'; END IF;

    -- 9. Public applications are refused, by name and with the reason.
    BEGIN
      UPDATE public.slate_apps SET kind = 'public' WHERE id = a;
      RAISE EXCEPTION 'a public application was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Slate:PublicAppsNotBuilt%' THEN RAISE; END IF;
    END;

    -- 10. Viewer opens, only Editor edits.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
    IF public.can_open_slate_app(a) THEN
      RAISE EXCEPTION 'someone with no project role opened the app';
    END IF;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u2, 'viewer', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
    IF NOT public.can_open_slate_app(a) THEN RAISE EXCEPTION 'a viewer could not open'; END IF;
    IF public.can_edit_slate_app(a) THEN RAISE EXCEPTION 'a viewer could edit'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '688 proved: a new app is rooted at a w_document container with a slate RID, the shared namespace refuses a same-kind name differing only in case (a cross-kind clash being impossible once prefixes hold), a prefix must match its kind, only variables are page-local and repeat across pages, a container names a type while a button may not, an unbuilt kind refuses by name, split alone carries an axis, an event wires two identifiers of one app, a public application is refused with its reason, and Viewer opens where only Editor edits';
  END;
END $$;
