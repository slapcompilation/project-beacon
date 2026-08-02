-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 313 — rows and columns, and the tabs widget that should never have
-- existed.
--
-- W6 of docs/WORKSHOP-PLAN.md. Both corrections come from reading
-- workshop/concepts-layouts AFTER building W2, and both are load-bearing for a
-- builder: without them there is nothing to arrange and one thing to un-invent.
--
-- 1. ARRANGEMENT. Foundry's layout types are pages, sections, tabs, ROWS,
--    COLUMNS, flow, toolbar, loop, overlays. Ours were page/section/tab/overlay
--    — every layout type except the two that actually position anything. A
--    module could only ever stack vertically, so a builder's only layout act
--    would be "append to the bottom".
--
--    `row` and `column` land here and the renderer consumes them in the same
--    change. `flow`, `toolbar` and `loop` stay out: loop means embedded modules,
--    which is a phase, and the other two are presentation nobody has asked for.
--
-- 2. TABS ARE A SECTION'S BUSINESS. Foundry: "adds tabs to the top of a
--    section". W2 modelled the tab layouts correctly and then invented a `tabs`
--    WIDGET to draw the bar — our shape, no citation. A container that has tab
--    children now renders its own bar, so the widget has nothing left to do.
--
--    The existing tabs widgets are deleted here rather than left as rows the
--    renderer ignores. A widget that renders nothing is exactly the dead
--    vocabulary the shape ratchet exists to prevent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_layouts DROP CONSTRAINT IF EXISTS module_layouts_layout_type_check;
ALTER TABLE public.module_layouts ADD CONSTRAINT module_layouts_layout_type_check
  CHECK (layout_type IN ('page','section','tab','overlay','row','column'));

COMMENT ON COLUMN public.module_layouts.layout_type IS
  'page | section | tab | overlay | row | column. Rows arrange children horizontally, columns vertically — Foundry''s flow/toolbar/loop are deliberately absent until asked for.';

-- Data first: the CHECK below would reject these rows.
DELETE FROM public.module_widgets WHERE widget_type = 'tabs';

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table','metric_card','markdown','object_set_title','button_group'));

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type IN ('markdown','button_group') OR variable_id IS NOT NULL);

DO $$
DECLARE v_org uuid; v_mod uuid; v_sec uuid; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_layout', 'Probe') RETURNING id INTO v_mod;

    -- A row holding two columns is the arrangement the builder needs.
    INSERT INTO module_layouts (module_id, api_name, title, layout_type, position)
    VALUES (v_mod, 'top', 'Top', 'row', 0) RETURNING id INTO v_sec;
    INSERT INTO module_layouts (module_id, api_name, title, layout_type, parent_id, position) VALUES
      (v_mod, 'left',  'Left',  'column', v_sec, 0),
      (v_mod, 'right', 'Right', 'column', v_sec, 1);

    SELECT count(*) INTO n FROM module_layouts
     WHERE module_id = v_mod AND parent_id = v_sec AND layout_type = 'column';
    IF n <> 2 THEN
      RAISE EXCEPTION 'Migration 313: a row could not hold two columns (% found)', n;
    END IF;

    -- The retired widget type must be refused, not merely unused.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type)
      VALUES (v_mod, 'nav', 'tabs');
      RAISE EXCEPTION 'Migration 313: the tabs widget was still accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
