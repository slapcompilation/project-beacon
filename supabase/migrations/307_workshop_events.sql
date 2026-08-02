-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 307 — events: what a widget does when somebody touches it.
--
-- W2 of docs/WORKSHOP-PLAN.md. W1 gave modules state and a way to draw it;
-- without events a module is a report. Events are what make it an application.
--
-- FOUNDRY'S MODEL (workshop/concepts-events), adopted whole:
--
--   TRIGGERS are widget interactions — Button Group click, Object Table row
--   selection, String Dropdown selection, Tabs switch.
--
--   EFFECTS come in five groups, and the grouping is theirs:
--     Layer        open / close overlay
--     Layout       switch page, switch tab, expand-collapse-toggle section
--     Variable     set, reset, recompute, stream LLM response into
--     Application  open another module (with variable mapping), open object view
--     Other        refresh module data, toggle theme
--
-- THE SEMANTIC THAT MUST BE COPIED VERBATIM, because approximating it produces
-- a bug nobody can reproduce:
--
--   "events do not wait for the downstream computations of previous events to
--    complete before executing"
--
-- Effects dispatch in order; they do not dispatch on completion. An effect that
-- reads what the previous one computed will read the OLD value. Foundry's own
-- guidance is to split those into separate user-triggered events, and ours says
-- the same in the column comment rather than leaving the next person to find it.
--
-- The full effect vocabulary is in the CHECK even though W2 implements the
-- Layer, Layout, Variable and refresh effects — same discipline as W1's
-- definition_kind, so W3/W4 fill in `open_module` and `open_object_view`
-- instead of widening a constraint.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,

  -- What is touched. NULL widget = a module-load event (on_load).
  source_widget_id uuid REFERENCES public.module_widgets(id) ON DELETE CASCADE,
  trigger          text NOT NULL CHECK (trigger IN
                     ('click','row_select','selection_change','tab_change','on_load')),

  -- Foundry's five effect groups, named as they name them.
  effect_type      text NOT NULL CHECK (effect_type IN (
                     -- Layer
                     'open_overlay','close_overlay',
                     -- Layout
                     'switch_page','switch_tab','toggle_section',
                     -- Variable
                     'set_variable','reset_variable','recompute_variable','stream_llm_into_variable',
                     -- Application
                     'open_module','open_object_view',
                     -- Other
                     'refresh_module','toggle_theme')),

  -- Effect-specific target: which layout to switch to, which variable to set,
  -- what value to set it from. Domain-validated — a jsonb-shape CHECK is the
  -- kind of half-enforcement that lies about what it guarantees.
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Dispatch ORDER, not completion order. See the table comment.
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.module_events IS
  'What a widget does when touched. One row per EFFECT: a trigger with three effects is three rows sharing a source widget and trigger, ordered by position.';

COMMENT ON COLUMN public.module_events.position IS
  'Dispatch order, NOT completion order. Copied from Foundry: "events do not wait for the downstream computations of previous events to complete before executing." An effect that reads what the previous effect computed reads the OLD value — split those into separate user-triggered events.';

CREATE INDEX IF NOT EXISTS idx_module_events_module
  ON public.module_events (module_id, source_widget_id, position);

ALTER TABLE public.module_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read module_events in scope" ON public.module_events;
CREATE POLICY "members read module_events in scope" ON public.module_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id
                 AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
                 AND (m.hotel_id IS NULL OR hotel_is_in_user_scope(m.hotel_id))));

DROP POLICY IF EXISTS "admins author module_events" ON public.module_events;
CREATE POLICY "admins author module_events" ON public.module_events
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND EXISTS (
           SELECT 1 FROM modules m WHERE m.id = module_id
           AND m.organization_id IS NOT DISTINCT FROM auth_org_id()))
  WITH CHECK (auth_role() IN ('owner','admin') AND EXISTS (
           SELECT 1 FROM modules m WHERE m.id = module_id
           AND m.organization_id IS NOT DISTINCT FROM auth_org_id()));

-- ── The module document carries its events ──────────────────────────────────

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
      FROM module_widgets w WHERE w.module_id = m.id), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'sourceWidgetId', e.source_widget_id, 'trigger', e.trigger,
        'effectType', e.effect_type, 'config', e.config, 'position', e.position)
        ORDER BY e.position, e.id)
      FROM module_events e WHERE e.module_id = m.id), '[]'::jsonb)
  )
  FROM modules m
  WHERE m.api_name = p_api_name
    AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (m.hotel_id IS NULL OR hotel_is_in_user_scope(m.hotel_id))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module(text) TO authenticated;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table','module_events','platform','What a module widget does when touched')
ON CONFLICT (object_kind, object_name) DO NOTHING;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_mod uuid; v_var uuid; v_w uuid; n_ev int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_events', 'Probe') RETURNING id INTO v_mod;
    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (v_mod, 'sel', 'string') RETURNING id INTO v_var;
    INSERT INTO module_widgets (module_id, api_name, widget_type, config)
    VALUES (v_mod, 'note', 'markdown', '{"body":"x"}'::jsonb) RETURNING id INTO v_w;

    -- One trigger, three ordered effects — the shape Foundry describes.
    INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type, config, position)
    VALUES
      (v_mod, v_w, 'click', 'set_variable',   jsonb_build_object('variableId', v_var, 'value','a'), 0),
      (v_mod, v_w, 'click', 'switch_tab',     '{"layoutApiName":"second"}'::jsonb, 1),
      (v_mod, v_w, 'click', 'refresh_module', '{}'::jsonb, 2);

    SELECT count(*) INTO n_ev FROM module_events
     WHERE module_id = v_mod AND source_widget_id = v_w AND trigger = 'click';
    IF n_ev <> 3 THEN
      RAISE EXCEPTION 'Migration 307: expected 3 ordered effects, found %', n_ev;
    END IF;

    -- An unknown effect must be refused rather than stored and ignored later.
    BEGIN
      INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type)
      VALUES (v_mod, v_w, 'click', 'delete_everything');
      RAISE EXCEPTION 'Migration 307: an unknown effect_type was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
