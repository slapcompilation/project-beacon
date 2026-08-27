-- 704: Contour parameters, and the analysis's one dashboard.
--
-- PARAMETERS are analysis-level typed values referenced `$name`:
--
--   "The supported types are **Date**, **String**, and **Number**."
--   — contour/analysis-parameterize.md
--
--   "To enable a parameter to take multiple values simultaneously, toggle **Allow multiple values** in the parameter settings. This option is available for **String** and **Number** parameters but not for **Date** parameters."
--   — contour/analysis-parameterize.md
--
-- A parameter carries a default (the page's Item example defaults to
-- Sandwich) and optionally suggested values — a manual list or a linked
-- dataset column capped at 1000. Overrides are SESSION-LOCAL — "Overriding a
-- parameter value will persist until you refresh the page, and will not
-- affect what that other users see" — so no override state lives here; the
-- surface holds it, and the compiler (705) reads only defaults.
--
-- THE DASHBOARD is one per analysis and it is a STRUCTURE, not a resource:
--
--   "Each Contour analysis is associated with one Contour dashboard. To add a board to the dashboard, click the **Add to dashboard** button on the top right of the board."
--   — contour/dashboards-getting-started.md
--
--   "You can organize your dashboard into tabs. Tabs can be renamed or dragged into a different order. Boards and text can be dragged from one tab to another."
--   — contour/dashboards-getting-started.md
--
--   "Note that rows can only consist of a single item type - you cannot have a row with both boards and text boxes."
--   — contour/dashboards-getting-started.md
--
-- and "You can add up to three boards per row". The filesystem API
-- enumerates CONTOUR_ANALYSIS and no CONTOUR_DASHBOARD (the adversary pass's
-- find), so the dashboard's name sits on the analysis (703) and the tabs and
-- items hang off it here. Which boards may be promoted:
--
--   "You can add all Visualize boards to a dashboard, excluding the Text and Map boards."
--   — contour/dashboards-getting-started.md
--
-- — the catalogue's visualize flag, composed, with map refused by name.

-- ── parameters ──────────────────────────────────────────────────────────────

CREATE TABLE public.contour_parameters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   uuid NOT NULL REFERENCES public.contour_analyses(id) ON DELETE CASCADE,
  -- the `$name` reference; unique per analysis because a reference names one
  name          text NOT NULL CHECK (name ~ '^[A-Za-z][A-Za-z0-9_]*$'),
  param_type    text NOT NULL
                  CONSTRAINT contour_parameters_type_check
                  CHECK (param_type = ANY (ARRAY['Date', 'String', 'Number'])),
  multi_value   boolean NOT NULL DEFAULT false,
  -- the compiled job reads this; session overrides never reach the server
  default_value jsonb,
  -- suggested values: {"values": [...]} manual, or
  -- {"dataset_id": …, "column": …} linked (capped at 1000 by the page; the
  -- cap is the surface's to apply at render)
  suggested     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, name),
  -- "not for Date parameters"
  CONSTRAINT contour_parameters_date_single CHECK (NOT multi_value OR param_type <> 'Date')
);
CREATE INDEX contour_parameters_analysis_idx ON public.contour_parameters (analysis_id);
COMMENT ON TABLE public.contour_parameters IS
  'An analysis-level typed value referenced $name in filter and expression configurations — and inline in text widgets and titles, which the surface renders. The default is what the compiled job reads: "Overriding a parameter value will persist until you refresh the page, and will not affect what that other users see" (contour/analysis-parameterize), so overrides are session state, never rows.';
COMMENT ON CONSTRAINT contour_parameters_type_check ON public.contour_parameters IS
  'Values from contour/analysis-parameterize: "The supported types are Date, String, and Number."';
COMMENT ON CONSTRAINT contour_parameters_date_single ON public.contour_parameters IS
  'From the same page: multiple values are "available for String and Number parameters but not for Date parameters."';

-- ── the dashboard: tabs and items ───────────────────────────────────────────

CREATE TABLE public.contour_dashboard_tabs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.contour_analyses(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'New tab',
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX contour_dashboard_tabs_analysis_idx ON public.contour_dashboard_tabs (analysis_id);
COMMENT ON TABLE public.contour_dashboard_tabs IS
  '"You can organize your dashboard into tabs. Tabs can be renamed or dragged into a different order" (contour/dashboards-getting-started). The dashboard itself is the analysis — one each, named on the analysis row.';

CREATE TABLE public.contour_dashboard_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id    uuid NOT NULL REFERENCES public.contour_dashboard_tabs(id) ON DELETE CASCADE,
  row_index integer NOT NULL DEFAULT 0 CHECK (row_index >= 0),
  -- "You can add up to three boards per row"
  slot      integer NOT NULL DEFAULT 0 CHECK (slot BETWEEN 0 AND 2),
  -- an item is a promoted board OR a text widget
  board_id  uuid REFERENCES public.contour_boards(id) ON DELETE CASCADE,
  text_body text,
  title     text NOT NULL DEFAULT '',
  CHECK (num_nonnulls(board_id, text_body) = 1),
  UNIQUE (tab_id, row_index, slot)
);
CREATE INDEX contour_dashboard_items_tab_idx ON public.contour_dashboard_items (tab_id);
CREATE INDEX contour_dashboard_items_board_idx ON public.contour_dashboard_items (board_id);
COMMENT ON TABLE public.contour_dashboard_items IS
  'One dashboard item: a promoted board or a first-class text widget, placed on a row of its tab with at most three slots — "You can add up to three boards per row" (contour/dashboards-getting-started). Board titles shown here are the item''s, addable at promotion ("you can add board titles").';

CREATE FUNCTION public.guard_contour_dashboard_item()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; k record;
BEGIN
  IF NEW.board_id IS NOT NULL THEN
    SELECT cb.*, p.analysis_id INTO b
      FROM public.contour_boards cb JOIN public.contour_paths p ON p.id = cb.path_id
     WHERE cb.id = NEW.board_id;
    -- the board must belong to the tab's analysis
    IF b.analysis_id IS DISTINCT FROM
       (SELECT t.analysis_id FROM public.contour_dashboard_tabs t WHERE t.id = NEW.tab_id) THEN
      RAISE EXCEPTION 'Contour:BoardOutsideAnalysis — a dashboard shows boards of its own analysis';
    END IF;
    -- "You can add all Visualize boards to a dashboard, excluding the Text
    -- and Map boards."
    SELECT * INTO k FROM public.contour_board_kinds() ck WHERE ck.kind = b.kind;
    IF NOT k.visualize OR k.kind = 'map' THEN
      RAISE EXCEPTION 'Contour:NotADashboardBoard — %s is not a Visualize board a dashboard accepts', b.kind;
    END IF;
  END IF;
  -- "rows can only consist of a single item type"
  IF EXISTS (SELECT 1 FROM public.contour_dashboard_items i
              WHERE i.tab_id = NEW.tab_id AND i.row_index = NEW.row_index
                AND i.id <> NEW.id
                AND (i.board_id IS NULL) <> (NEW.board_id IS NULL)) THEN
    RAISE EXCEPTION 'Contour:MixedRow — rows can only consist of a single item type';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_contour_dashboard_item
  BEFORE INSERT OR UPDATE ON public.contour_dashboard_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_contour_dashboard_item();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.contour_parameters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contour_dashboard_tabs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contour_dashboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read parameters" ON public.contour_parameters
  FOR SELECT USING ((SELECT public.can_read_contour_analysis(analysis_id)));
CREATE POLICY "author parameters" ON public.contour_parameters
  FOR ALL USING ((SELECT public.can_edit_contour_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_contour_analysis(analysis_id)));

CREATE POLICY "read tabs" ON public.contour_dashboard_tabs
  FOR SELECT USING ((SELECT public.can_read_contour_analysis(analysis_id)));
CREATE POLICY "author tabs" ON public.contour_dashboard_tabs
  FOR ALL USING ((SELECT public.can_edit_contour_analysis(analysis_id)))
          WITH CHECK ((SELECT public.can_edit_contour_analysis(analysis_id)));

CREATE POLICY "read dashboard items" ON public.contour_dashboard_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.contour_dashboard_tabs t
                             WHERE t.id = tab_id
                               AND public.can_read_contour_analysis(t.analysis_id)));
CREATE POLICY "author dashboard items" ON public.contour_dashboard_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.contour_dashboard_tabs t
                          WHERE t.id = tab_id
                            AND public.can_edit_contour_analysis(t.analysis_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contour_dashboard_tabs t
                       WHERE t.id = tab_id
                         AND public.can_edit_contour_analysis(t.analysis_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_parameters      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_dashboard_tabs  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contour_dashboard_items TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid; p1 uuid; ds uuid;
  tb uuid; hist uuid; filt uuid;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ct-704') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ct-704') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct704@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ct704@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ct_704', 'CT 704') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'sales_704', 'sales_704') RETURNING id INTO ds;
    SELECT public.create_contour_analysis(proj, 'Sales') INTO a;
    INSERT INTO public.contour_paths (analysis_id, name, head_dataset_id)
    VALUES (a, 'Main', ds) RETURNING id INTO p1;
    INSERT INTO public.contour_boards (path_id, position, kind, configuration)
    VALUES (p1, 0, 'histogram', '{"bucket_column": "item"}'::jsonb) RETURNING id INTO hist;
    INSERT INTO public.contour_boards (path_id, position, kind, configuration)
    VALUES (p1, 1, 'filter', '{"mode": "keep", "column": "item", "op": "=", "parameter": "Item"}'::jsonb)
    RETURNING id INTO filt;

    -- 1. The page's Item example: a String parameter defaulting to Sandwich.
    INSERT INTO public.contour_parameters (analysis_id, name, param_type, default_value)
    VALUES (a, 'Item', 'String', '"Sandwich"'::jsonb);

    -- 2. A Date parameter cannot take multiple values; String can.
    BEGIN
      INSERT INTO public.contour_parameters (analysis_id, name, param_type, multi_value)
      VALUES (a, 'AsOf', 'Date', true);
      RAISE EXCEPTION 'a multi-value Date parameter was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.contour_parameters (analysis_id, name, param_type, multi_value)
    VALUES (a, 'Cities', 'String', true);
    BEGIN
      INSERT INTO public.contour_parameters (analysis_id, name, param_type)
      VALUES (a, 'Item', 'Number');
      RAISE EXCEPTION 'a duplicate parameter name was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 3. The dashboard takes the histogram (Visualize yes) and refuses the
    --    filter (Visualize no).
    INSERT INTO public.contour_dashboard_tabs (analysis_id, name) VALUES (a, 'Overview')
    RETURNING id INTO tb;
    INSERT INTO public.contour_dashboard_items (tab_id, row_index, slot, board_id, title)
    VALUES (tb, 0, 0, hist, 'Sales by item');
    BEGIN
      INSERT INTO public.contour_dashboard_items (tab_id, row_index, slot, board_id)
      VALUES (tb, 0, 1, filt);
      RAISE EXCEPTION 'a non-Visualize board reached the dashboard';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:NotADashboardBoard%' THEN RAISE; END IF;
    END;

    -- 4. Rows hold one item type: text beside a board refuses; its own row
    --    is fine. A fourth slot on a row refuses.
    BEGIN
      INSERT INTO public.contour_dashboard_items (tab_id, row_index, slot, text_body)
      VALUES (tb, 0, 1, 'A note beside the chart');
      RAISE EXCEPTION 'a mixed row was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:MixedRow%' THEN RAISE; END IF;
    END;
    INSERT INTO public.contour_dashboard_items (tab_id, row_index, slot, text_body)
    VALUES (tb, 1, 0, 'Sales overview, updated weekly.');
    BEGIN
      INSERT INTO public.contour_dashboard_items (tab_id, row_index, slot, board_id)
      VALUES (tb, 0, 3, hist);
      RAISE EXCEPTION 'a fourth slot was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '704 proved, as the caller: the Item parameter defaults to Sandwich; a Date parameter refuses multiple values while String takes them and a duplicate name refuses; the dashboard takes a Visualize board with a title and refuses a filter board; a row holds one item type, text gets its own row, and a fourth slot refuses';
  END;
END $$;
