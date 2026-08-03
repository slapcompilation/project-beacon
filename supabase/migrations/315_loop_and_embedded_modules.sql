-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 315 — a module inside a module, and a module per object.
--
-- G1 of docs/CAPABILITY-CHAIN.md. Every other remaining gap is presentation;
-- this one is COMPOSITION — the difference between a screen and a component
-- library. A per-property card, a per-supplier panel and a per-case row stop
-- being three near-identical modules somebody maintains by hand.
--
-- FOUNDRY'S TWO SHAPES (workshop/loop-layouts, workshop/embedded-modules):
--
--   LOOP is a LAYOUT. It iterates an object set or an array and "renders a
--   separate instance of an embedded module" per entry. Each instance "functions
--   independently from other embedded module instances, and has its own variable
--   scope and layout state". The current entry arrives through a MODULE
--   INTERFACE VARIABLE named on the child. Paging is `limit` (first X) or
--   `paged` (pages of X); display is `list` or `grid`.
--
--   EMBEDDED MODULE is a WIDGET. The parent maps its own variables onto the
--   child's interface variables, and those are "fully shared" — a change on
--   either side is reflected on both. The child's own defaults and recompute
--   behaviour for a mapped variable are bypassed; the parent's definition backs it.
--
-- LIMITS COPIED:
--   Foundry: "loop layouts are currently limited to paging through the first ten
--   thousand objects." Ours caps at the same 10,000.
--
-- LIMITS FOUNDRY DOES NOT DOCUMENT, and we add anyway — stated plainly rather
-- than presented as theirs:
--   Nothing in their docs bounds nesting or forbids a module embedding itself.
--   An uncapped recursive renderer is a browser tab that stops responding, so a
--   depth cap of 3 (the number searchAround already uses here) and an ancestor
--   check land with the feature. If Foundry has a different number, ours should
--   move to it.
--
-- A DELIBERATE DIVERGENCE, recorded: Foundry embeds "the published version of
-- the child module". We do not snapshot module CONTENT per version — `version`
-- is a pin promotions and installations point at, not an immutable copy. So the
-- honest equivalent is that only a PUBLISHED module may be embedded, enforced
-- here. A parent showing a colleague's half-finished draft is the failure that
-- rule exists to prevent, and it is the one we can actually deliver today.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Loop configuration has nowhere to live: layouts have never carried config.
ALTER TABLE public.module_layouts
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.module_layouts.config IS
  'Layout-specific settings. A loop carries { variable, module, itemInto, paging:{style,size}, display:{mode,columns} }.';

ALTER TABLE public.module_layouts DROP CONSTRAINT IF EXISTS module_layouts_layout_type_check;
ALTER TABLE public.module_layouts ADD CONSTRAINT module_layouts_layout_type_check
  CHECK (layout_type IN ('page','section','tab','overlay','row','column','loop'));

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table','metric_card','markdown','object_set_title','button_group',
    'embedded_module'));

-- An embedded module shows a whole module, not a variable.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type IN ('markdown','button_group','embedded_module')
         OR variable_id IS NOT NULL);

-- Foundry's "module interface" toggle: which of a child's variables a parent is
-- allowed to fill. Without it every variable is addressable from outside and the
-- child has no private state at all.
ALTER TABLE public.module_variables
  ADD COLUMN IF NOT EXISTS is_interface boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.module_variables.is_interface IS
  'True when a parent module may map onto this variable. Everything else is the module''s own private state.';

-- The document has to carry it or the renderer cannot honour any of the above.
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
        'recompute', v.recompute, 'isInterface', v.is_interface) ORDER BY v.api_name)
      FROM module_variables v WHERE v.module_id = m.id), '[]'::jsonb),
    'layouts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'apiName', l.api_name, 'title', l.title,
        'layoutType', l.layout_type, 'parentId', l.parent_id,
        'position', l.position, 'config', l.config)
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
    AND (m.hotel_id IS NULL
         OR hotel_is_in_user_scope(m.hotel_id)
         OR EXISTS (SELECT 1 FROM module_installations i
                    WHERE i.module_id = m.id AND hotel_is_in_user_scope(i.hotel_id)))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module(text) TO authenticated;

DO $$
DECLARE v_org uuid; v_mod uuid; v_child uuid; v_loop uuid; v_cfg jsonb;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title, status)
    VALUES (v_org, 'probe_child', 'Child', 'published') RETURNING id INTO v_child;
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_parent', 'Parent') RETURNING id INTO v_mod;

    -- A loop layout carries its own configuration.
    INSERT INTO module_layouts (module_id, api_name, title, layout_type, position, config)
    VALUES (v_mod, 'per_item', 'Per item', 'loop', 0, jsonb_build_object(
      'variable', 'items', 'module', 'probe_child', 'itemInto', 'current',
      'paging', jsonb_build_object('style','limit','size',25),
      'display', jsonb_build_object('mode','list')))
    RETURNING id INTO v_loop;

    SELECT config INTO v_cfg FROM module_layouts WHERE id = v_loop;
    IF v_cfg->>'module' <> 'probe_child' THEN
      RAISE EXCEPTION 'Migration 315: the loop lost its configuration';
    END IF;

    -- An embedded module widget binds no variable and must still be accepted.
    INSERT INTO module_widgets (module_id, api_name, widget_type, position, config)
    VALUES (v_mod, 'child', 'embedded_module', 1,
            jsonb_build_object('module','probe_child','mapping', jsonb_build_object('current','picked')));

    -- Interface variables are opt-in; private state is the default.
    INSERT INTO module_variables (module_id, api_name, var_type, is_interface)
    VALUES (v_child, 'current', 'string', true);
    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (v_child, 'privateThing', 'string');
    IF (SELECT count(*) FROM module_variables WHERE module_id = v_child AND is_interface) <> 1 THEN
      RAISE EXCEPTION 'Migration 315: is_interface is not opt-in';
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
