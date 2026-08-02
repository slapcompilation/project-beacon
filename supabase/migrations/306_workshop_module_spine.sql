-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 306 — modules: an application you assemble rather than write.
--
-- W1 of docs/WORKSHOP-PLAN.md. Every surface in Beacon today is a React file a
-- developer wrote, which means a workflow built for one property cannot be
-- promoted to twelve. That is the capability being added — not convenience for
-- one operator, but knowledge that compounds as workflows scale out.
--
-- FOUNDRY'S SHAPE, adopted by name (workshop/concepts-*):
--
--   module      the unit — reusable, self-contained, versioned, published
--   variable    module-scoped state, twelve types, six definition kinds
--   widget      the UI, grouped display / visualisation / filtering / event
--   layout      pages, sections, tabs, overlays
--
-- THE GOVERNING RULE: authored as DATA. A module that is code cannot be
-- exported, versioned or installed elsewhere, and that is the whole point.
-- export_ontology_package set the precedent; modules travel the same way.
--
-- SCOPE FROM DAY ONE. organization_id + nullable hotel_id, because W5 promotes
-- a module across properties and retrofitting tenancy is a migration this
-- codebase has already paid for twice (280, and the 4,076 untenanted links).
-- NULL hotel_id = an org-wide module; a hotel_id pins it to one property.
-- Hotel overrides org, as everywhere else here.
--
-- WHAT W1 DELIBERATELY LIMITS. Six variable types of the twelve — the ones we
-- can already source — and four widgets of Foundry's ~forty. A widget nobody
-- has asked for is the dead vocabulary this codebase spent a week removing.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── The module ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL = org-wide, available to every property. A hotel_id pins it local.
  hotel_id         uuid REFERENCES hotels(id) ON DELETE CASCADE,

  api_name         text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  title            text NOT NULL CHECK (length(btrim(title)) > 0),
  description      text NOT NULL DEFAULT '',
  icon             text NOT NULL DEFAULT 'application',

  -- draft -> published is the visibility boundary; W4 adds promotion on top.
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version          integer NOT NULL DEFAULT 1 CHECK (version > 0),

  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.modules IS
  'An application assembled rather than written. Rows, so it can be versioned, promoted and installed at another property — which is the reason this exists.';

-- ── Variables — module-scoped state ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.module_variables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  api_name      text NOT NULL CHECK (api_name ~ '^[a-z][a-zA-Z0-9_]*$'),
  label         text NOT NULL DEFAULT '',

  -- Foundry names twelve types. Six here — the ones we can source today from
  -- object sets, filters and primitives. The rest arrive with a consumer.
  var_type      text NOT NULL CHECK (var_type IN
                  ('object_set','object_set_filter','string','numeric','boolean','date')),

  -- Foundry's six definition kinds. `static` and `object_set_definition` are
  -- W1; `function`, `object_set_aggregation`, `object_property` and
  -- `variable_transformation` are declared here so the grammar is complete and
  -- W2/W3 fill them in rather than widening a CHECK later.
  definition_kind text NOT NULL DEFAULT 'static' CHECK (definition_kind IN
                  ('static','object_set_definition','function','object_set_aggregation',
                   'object_property','variable_transformation')),

  -- Static value, or the reference the definition resolves. Shape depends on
  -- definition_kind and is validated in the domain layer, not here — a CHECK
  -- over jsonb shape is the kind of half-enforcement that lies.
  definition    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- automatic | event | on_load_and_event, copied from Foundry exactly:
  -- recompute behaviour is a performance contract, not a detail.
  recompute     text NOT NULL DEFAULT 'automatic'
                  CHECK (recompute IN ('automatic','event','on_load_and_event')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, api_name)
);

COMMENT ON COLUMN public.module_variables.recompute IS
  'automatic | event | on_load_and_event. Copied from Foundry verbatim — when a variable recomputes is a performance contract, and lazy evaluation (non-visible pages do not compute) depends on it.';

-- ── Layouts — pages, sections, tabs, overlays ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.module_layouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  parent_id    uuid REFERENCES public.module_layouts(id) ON DELETE CASCADE,
  api_name     text NOT NULL CHECK (api_name ~ '^[a-z][a-zA-Z0-9_]*$'),
  title        text NOT NULL DEFAULT '',
  layout_type  text NOT NULL CHECK (layout_type IN ('page','section','tab','overlay')),
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, api_name)
);

-- ── Widgets ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.module_widgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  layout_id    uuid REFERENCES public.module_layouts(id) ON DELETE CASCADE,
  api_name     text NOT NULL CHECK (api_name ~ '^[a-z][a-zA-Z0-9_]*$'),

  -- Four of Foundry's ~forty. Enough for a real operational screen; the rest
  -- are demand-gated individually.
  widget_type  text NOT NULL CHECK (widget_type IN
                 ('object_table','metric_card','markdown','object_set_title')),

  title        text NOT NULL DEFAULT '',
  -- Which variable this widget reads. Most widgets bind to exactly one.
  variable_id  uuid REFERENCES public.module_variables(id) ON DELETE SET NULL,
  -- Per-type settings: columns for a table, format for a metric, body for
  -- markdown. Domain-validated, same reasoning as definition above.
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, api_name)
);

-- A widget that reads nothing renders nothing. Markdown is the exception —
-- it carries its own body and binds to no variable.
ALTER TABLE public.module_widgets
  DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets
  ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type = 'markdown' OR variable_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_module_widgets_module ON public.module_widgets (module_id, position);
CREATE INDEX IF NOT EXISTS idx_module_layouts_module ON public.module_layouts (module_id, position);
CREATE INDEX IF NOT EXISTS idx_module_variables_module ON public.module_variables (module_id);

-- ── RLS — read in scope, author admin-only ──────────────────────────────────

ALTER TABLE public.modules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_variables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_widgets    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read modules in scope" ON public.modules;
CREATE POLICY "members read modules in scope" ON public.modules
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins author modules" ON public.modules;
CREATE POLICY "admins author modules" ON public.modules
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- The three child tables inherit their module's visibility. One EXISTS each,
-- so a module's parts can never be more visible than the module.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['module_variables','module_layouts','module_widgets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "members read %I in scope" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "members read %I in scope" ON public.%I
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id
                     AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
                     AND (m.hotel_id IS NULL OR hotel_is_in_user_scope(m.hotel_id))))$p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "admins author %I" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "admins author %I" ON public.%I
      FOR ALL TO authenticated
      USING (auth_role() IN ('owner','admin') AND EXISTS (
               SELECT 1 FROM modules m WHERE m.id = module_id
               AND m.organization_id IS NOT DISTINCT FROM auth_org_id()))
      WITH CHECK (auth_role() IN ('owner','admin') AND EXISTS (
               SELECT 1 FROM modules m WHERE m.id = module_id
               AND m.organization_id IS NOT DISTINCT FROM auth_org_id()))$p$, t, t);
  END LOOP;
END $$;

-- ── Reading a module is one call ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_module(p_api_name text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'apiName', m.api_name, 'title', m.title,
    'description', m.description, 'icon', m.icon,
    'status', m.status, 'version', m.version,
    'hotelId', m.hotel_id,
    'variables', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'apiName', v.api_name, 'label', v.label, 'varType', v.var_type,
        'definitionKind', v.definition_kind, 'definition', v.definition,
        'recompute', v.recompute) ORDER BY v.api_name)
      FROM module_variables v WHERE v.module_id = m.id), '[]'::jsonb),
    'layouts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'apiName', l.api_name, 'title', l.title,
        'layoutType', l.layout_type, 'parentId', l.parent_id, 'position', l.position)
        ORDER BY l.position, l.api_name)
      FROM module_layouts l WHERE l.module_id = m.id), '[]'::jsonb),
    'widgets', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'apiName', w.api_name, 'widgetType', w.widget_type,
        'title', w.title, 'layoutId', w.layout_id, 'variableId', w.variable_id,
        'config', w.config, 'position', w.position) ORDER BY w.position, w.api_name)
      FROM module_widgets w WHERE w.module_id = m.id), '[]'::jsonb)
  )
  FROM modules m
  WHERE m.api_name = p_api_name
    AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (m.hotel_id IS NULL OR hotel_is_in_user_scope(m.hotel_id))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module(text) TO authenticated;

COMMENT ON FUNCTION public.get_module(text) IS
  'A whole module — variables, layouts, widgets — in one call, so the renderer makes one request rather than four. SECURITY INVOKER: a caller sees only modules in their org and hotel scope.';

-- ── The registry must know what these tables are ────────────────────────────
-- Platform metadata, not domain data: a module is how the system works, the way
-- object_types and automations are. Declared so check:shape stays green.

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table','modules',          'platform','Workshop module — an assembled application, platform metadata like automations'),
  ('table','module_variables', 'platform','Module-scoped state'),
  ('table','module_layouts',   'platform','Pages, sections, tabs, overlays'),
  ('table','module_widgets',   'platform','Widget instances bound to variables')
ON CONFLICT (object_kind, object_name) DO NOTHING;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_mod uuid; v_var uuid; doc jsonb;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;

  BEGIN
    INSERT INTO modules (organization_id, api_name, title, description)
    VALUES (v_org, 'probe_module', 'Probe', 'rolled back')
    RETURNING id INTO v_mod;

    INSERT INTO module_variables (module_id, api_name, label, var_type, definition_kind, definition)
    VALUES (v_mod, 'atRisk', 'At-risk stock', 'object_set', 'object_set_definition',
            '{"subject":"variant"}'::jsonb)
    RETURNING id INTO v_var;

    INSERT INTO module_widgets (module_id, api_name, widget_type, title, variable_id)
    VALUES (v_mod, 'table', 'object_table', 'At risk', v_var);

    -- A non-markdown widget with no variable must be refused: a widget that
    -- reads nothing renders nothing.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, title, variable_id)
      VALUES (v_mod, 'bad', 'metric_card', 'Unbound', NULL);
      RAISE EXCEPTION 'Migration 306: an unbound metric_card was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Markdown carries its own body and binds to nothing.
    INSERT INTO module_widgets (module_id, api_name, widget_type, title, variable_id, config)
    VALUES (v_mod, 'note', 'markdown', '', NULL, '{"body":"# Hello"}'::jsonb);

    -- Asserted against the ROWS, not through get_module. The function filters on
    -- auth_org_id() and this migration runs with no scope, so calling it here
    -- returns null and proves nothing — the same trap 300 and 301 hit. RLS
    -- contracts cover the scoping; this covers the assembly.
    SELECT jsonb_build_object(
      'variables', (SELECT count(*) FROM module_variables WHERE module_id = v_mod),
      'widgets',   (SELECT count(*) FROM module_widgets   WHERE module_id = v_mod))
      INTO doc;
    IF (doc->>'variables')::int <> 1 OR (doc->>'widgets')::int <> 2 THEN
      RAISE EXCEPTION 'Migration 306: module assembled as %', doc::text;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
