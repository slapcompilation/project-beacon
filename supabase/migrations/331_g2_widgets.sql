-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 331 — three widgets that were waiting to be asked for.
--
-- CAPABILITY-CHAIN G2/G3 named these and said to wait: "a widget earns its place
-- by being asked for". They have now been asked for, and each is the single
-- registry entry that design was built to make cheap.
--
-- CHART XY (widgets-chart). Foundry's is layered — an array of layers, each with
-- its own data input and type. We take ONE layer, and that is the divergence to
-- record: multi-layer exists to overlay a forecast on an actual, and nothing here
-- has asked for two series on one axis yet.
--   "Layer type: Selects the type of chart displayed. Current options include
--    Bar Chart, Line Chart, and Scatter Chart."
-- Their aggregations for a layer are count / sum / average, which is a subset of
-- the ones object_set_aggregation already computes, so the chart reuses that
-- vocabulary rather than inventing a second one.
--
-- OBJECT VIEW (widgets-object-view). "Provides detailed information about a
-- SINGLE object by displaying an embedded object view within a Workshop module...
-- Choose the input object set, which determines the object that will be
-- displayed." So its input is a set and it renders one member — the set is how
-- you say WHICH object, not how many. Full vs panel is theirs; we render the
-- panel view, because the full view owns a page and a module already has one.
--
-- INLINE ACTION (widgets-inline-action-form). "Enables users to interact with the
-- Ontology to create, modify, or delete one or multiple objects... The widget
-- supports both form and table interfaces." We take the FORM: "Action forms
-- trigger one Action at a time and are recommended for small-scale datasets where
-- guided form interaction is desired." The table layout is for bulk CSV-scale
-- editing, which is a different product.
--
-- This is G3 as well as G2 — the plan called it "presentation, not capability",
-- and it is: the same Action Registry, rendered in the page instead of a modal.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table', 'metric_card', 'markdown', 'object_set_title', 'button_group',
    'embedded_module', 'tabs', 'filter_list',
    'chart_xy', 'object_view', 'inline_action'
  ));

-- What each widget must bind. Chart and Object View both read an object set;
-- Inline Action carries its action in config, like button_group.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (
    (widget_type IN ('object_table', 'object_set_title', 'filter_list', 'chart_xy', 'object_view')
      AND variable_id IS NOT NULL)
    OR (widget_type = 'metric_card' AND variable_id IS NOT NULL)
    OR widget_type IN ('markdown', 'button_group', 'embedded_module', 'tabs', 'inline_action')
  );

COMMENT ON CONSTRAINT module_widgets_needs_binding ON public.module_widgets IS
  'Which widgets must name a variable. Chart XY and Object View both take an object set — the Object View renders ONE member of it, since the set is how you say which object.';

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_hotel uuid; v_mod uuid; v_var uuid; n int;
BEGIN
  SELECT id, (SELECT id FROM hotels WHERE organization_id = o.id LIMIT 1)
    INTO v_org, v_hotel FROM organizations o LIMIT 1;

  BEGIN
    INSERT INTO modules (organization_id, hotel_id, api_name, title)
    VALUES (v_org, v_hotel, 'probe_g2', 'Probe G2') RETURNING id INTO v_mod;
    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (v_mod, 'rows', 'object_set') RETURNING id INTO v_var;

    -- The three new types are accepted.
    INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
    VALUES (v_mod, 'chart',  'chart_xy',    v_var, '{"layerType":"bar"}'::jsonb),
           (v_mod, 'detail', 'object_view', v_var, '{}'::jsonb),
           (v_mod, 'act',    'inline_action', NULL, '{"actionType":"ADJUST_STOCK"}'::jsonb);
    SELECT count(*) INTO n FROM module_widgets WHERE module_id = v_mod;
    IF n <> 3 THEN RAISE EXCEPTION 'Migration 331: expected 3 widgets, got %', n; END IF;

    -- A chart with nothing to chart is refused.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
      VALUES (v_mod, 'chart2', 'chart_xy', NULL, '{}'::jsonb);
      RAISE EXCEPTION 'Migration 331: a chart_xy was accepted with no variable';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- So is an object view with no set to pick its object from.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
      VALUES (v_mod, 'detail2', 'object_view', NULL, '{}'::jsonb);
      RAISE EXCEPTION 'Migration 331: an object_view was accepted with no variable';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
