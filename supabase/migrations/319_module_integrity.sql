-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 319 — a module's parts may only belong to that module, and the
-- test debris goes.
--
-- AUDIT FINDINGS, from sweeping the live data:
--
--   87 of 92 modules were e2e leftovers. The tests create modules and never
--   remove them, so the demo org's application list was 95% debris and growing
--   one module per run. Cleaned here; the specs now clean up after themselves.
--
--   Referential integrity was otherwise sound — no dangling event targets, no
--   promotions pinning a version that had moved, no filter variable without a
--   reader. But that is luck, not enforcement:
--
--   NOTHING STOPPED A WIDGET SHOWING ANOTHER MODULE'S VARIABLE. The foreign keys
--   guarantee the referenced row EXISTS; they say nothing about which module it
--   belongs to. A widget could legally bind a variable from a different module,
--   an event could fire from a foreign widget, a layout could nest under a
--   foreign parent. None of it is in the data today and all of it was possible.
--
-- The fix is the standard composite-key one: make (id, module_id) unique on each
-- child table, then reference the PAIR. Postgres then refuses a cross-module
-- reference the same way it refuses a missing one — structurally, not by
-- convention and not by a check somebody has to remember to run.
--
-- This matters more now than it did at W1: G1 made modules embed each other, so
-- "which module does this belong to" stopped being obvious by inspection.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── The debris ──────────────────────────────────────────────────────────────

DO $$
DECLARE n int;
BEGIN
  DELETE FROM modules
  WHERE api_name ~ '^(builder|loop|agg|authored)_probe_'
     OR api_name ~ '^probe_';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Migration 319: removed % leftover test module(s)', n;
END $$;

-- w1_probe was the first demo, and it has pointed at no object set since the day
-- it was made — W1 shipped before any saved set existed. It is the module the
-- audit calls "points nowhere", and it has no purpose now that real demos exist.
DELETE FROM modules WHERE api_name = 'w1_probe';

-- ── Same-module enforcement ─────────────────────────────────────────────────

ALTER TABLE public.module_variables DROP CONSTRAINT IF EXISTS module_variables_id_module_key;
ALTER TABLE public.module_variables ADD CONSTRAINT module_variables_id_module_key
  UNIQUE (id, module_id);

ALTER TABLE public.module_layouts DROP CONSTRAINT IF EXISTS module_layouts_id_module_key;
ALTER TABLE public.module_layouts ADD CONSTRAINT module_layouts_id_module_key
  UNIQUE (id, module_id);

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_id_module_key;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_id_module_key
  UNIQUE (id, module_id);

-- A widget shows a variable of its OWN module.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_variable_id_fkey;
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_variable_same_module;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_variable_same_module
  FOREIGN KEY (variable_id, module_id)
  REFERENCES public.module_variables (id, module_id) ON DELETE SET NULL;

-- …and sits in a layout of its own module.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_layout_id_fkey;
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_layout_same_module;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_layout_same_module
  FOREIGN KEY (layout_id, module_id)
  REFERENCES public.module_layouts (id, module_id) ON DELETE SET NULL;

-- A layout nests under a layout of its own module.
ALTER TABLE public.module_layouts DROP CONSTRAINT IF EXISTS module_layouts_parent_id_fkey;
ALTER TABLE public.module_layouts DROP CONSTRAINT IF EXISTS module_layouts_parent_same_module;
ALTER TABLE public.module_layouts ADD CONSTRAINT module_layouts_parent_same_module
  FOREIGN KEY (parent_id, module_id)
  REFERENCES public.module_layouts (id, module_id) ON DELETE CASCADE;

-- An event fires from a widget of its own module.
ALTER TABLE public.module_events DROP CONSTRAINT IF EXISTS module_events_source_widget_id_fkey;
ALTER TABLE public.module_events DROP CONSTRAINT IF EXISTS module_events_widget_same_module;
ALTER TABLE public.module_events ADD CONSTRAINT module_events_widget_same_module
  FOREIGN KEY (source_widget_id, module_id)
  REFERENCES public.module_widgets (id, module_id) ON DELETE CASCADE;

DO $$
DECLARE v_org uuid; m_a uuid; m_b uuid; v_b uuid; l_b uuid; w_b uuid;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_int_a', 'A') RETURNING id INTO m_a;
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_int_b', 'B') RETURNING id INTO m_b;

    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (m_b, 'theirs', 'string') RETURNING id INTO v_b;
    INSERT INTO module_layouts (module_id, api_name, title, layout_type)
    VALUES (m_b, 'theirs', 'Theirs', 'section') RETURNING id INTO l_b;
    INSERT INTO module_widgets (module_id, api_name, widget_type, config)
    VALUES (m_b, 'theirs', 'markdown', '{}'::jsonb) RETURNING id INTO w_b;

    -- Each of these was possible before this migration.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
      VALUES (m_a, 'thief', 'metric_card', v_b, '{}'::jsonb);
      RAISE EXCEPTION 'Migration 319: a widget bound another module''s variable';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, layout_id, config)
      VALUES (m_a, 'squatter', 'markdown', l_b, '{}'::jsonb);
      RAISE EXCEPTION 'Migration 319: a widget sat in another module''s layout';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO module_layouts (module_id, api_name, title, layout_type, parent_id)
      VALUES (m_a, 'nested', 'Nested', 'section', l_b);
      RAISE EXCEPTION 'Migration 319: a layout nested under another module''s layout';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type)
      VALUES (m_a, w_b, 'click', 'refresh_module');
      RAISE EXCEPTION 'Migration 319: an event fired from another module''s widget';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    -- The legitimate shapes must still work, including the nullable ones.
    INSERT INTO module_widgets (module_id, api_name, widget_type, config)
    VALUES (m_a, 'fine', 'markdown', '{"body":"x"}'::jsonb);
    INSERT INTO module_events (module_id, trigger, effect_type)
    VALUES (m_a, 'on_load', 'refresh_module');

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
