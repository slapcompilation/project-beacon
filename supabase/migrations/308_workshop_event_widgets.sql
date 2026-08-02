-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 308 — the two widgets an event model needs to exist.
--
-- 307 gave modules events. Without something to press, nothing can fire one:
-- W1's four widgets are all display. These are Foundry's "event-trigger and
-- navigational" group (workshop/concepts-widgets), and they are the two it
-- names first — Button Group and Tabs.
--
-- Still demand-gated, not a catalogue import: six of Foundry's ~forty, and each
-- of the six is consumed by the renderer in the same change.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table','metric_card','markdown','object_set_title',
    'button_group','tabs'));

-- A widget that displays data needs a variable to display. One that only fires
-- events does not — the binding rule follows the widget's job.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type IN ('markdown','button_group','tabs') OR variable_id IS NOT NULL);

DO $$
DECLARE v_org uuid; v_mod uuid;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_widgets', 'Probe') RETURNING id INTO v_mod;

    -- A button group carries no variable and must be accepted.
    INSERT INTO module_widgets (module_id, api_name, widget_type, config)
    VALUES (v_mod, 'actions', 'button_group',
            '{"buttons":[{"key":"go","label":"Go"}]}'::jsonb);

    -- A display widget with no variable must still be refused.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type)
      VALUES (v_mod, 'orphan', 'object_table');
      RAISE EXCEPTION 'Migration 308: an unbound object_table was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
