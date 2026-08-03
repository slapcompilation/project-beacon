-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 316 — the Tabs widget, which does exist after all.
--
-- Migration 313 deleted our `tabs` widget on the grounds that "Foundry's Tabs is
-- a layout option on a section, not a widget you place". Mirroring the Workshop
-- docs (438-page mirror, 2026-08-03) showed that Foundry has BOTH, doing
-- different jobs:
--
--   TABS AS A SECTION LAYOUT OPTION — "adds tabs to the top of a section and
--   allows module builders to configure different configurations of widgets
--   within each tab". 313 implemented exactly this and was right to; a container
--   draws the bar for its own tab children.
--
--   THE TABS WIDGET — "displays configurable tabs that trigger Workshop events
--   to navigate throughout pages and overlays of a module". It owns no layouts.
--   It is navigation.
--
-- So the behaviour in 313 was correct and its stated reason was not. This brings
-- back the widget it removed, for the job it actually does.
--
-- Worth having: the runtime has implemented `switch_page`, `switch_tab` and
-- `open_overlay` since W2, and a Button Group has been the only thing able to
-- trigger any of them. This is the widget those effects were built for.
--
-- No per-tab schema: a tab's events are ordinary module_events keyed by
-- `config.button`, exactly as Button Group already does. A second mechanism for
-- the same idea is how vocabularies rot.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table','metric_card','markdown','object_set_title','button_group',
    'embedded_module','tabs'));

-- Tabs show labels and fire events; they display no variable of their own.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type IN ('markdown','button_group','embedded_module','tabs')
         OR variable_id IS NOT NULL);

DO $$
DECLARE v_org uuid; v_mod uuid; v_w uuid; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_tabs', 'Probe') RETURNING id INTO v_mod;

    INSERT INTO module_widgets (module_id, api_name, widget_type, position, config)
    VALUES (v_mod, 'nav', 'tabs', 0, jsonb_build_object('tabs', jsonb_build_array(
      jsonb_build_object('key','now','label','Now'),
      jsonb_build_object('key','all','label','Everything'))))
    RETURNING id INTO v_w;

    -- A tab's events are keyed by button, like a Button Group's.
    INSERT INTO module_layouts (module_id, api_name, title, layout_type, position)
    VALUES (v_mod, 'first', 'First', 'tab', 0), (v_mod, 'second', 'Second', 'tab', 1);
    INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type, config, position)
    VALUES
      (v_mod, v_w, 'click', 'switch_tab', '{"button":"now","layoutApiName":"first"}'::jsonb, 0),
      (v_mod, v_w, 'click', 'switch_tab', '{"button":"all","layoutApiName":"second"}'::jsonb, 1);

    SELECT count(*) INTO n FROM module_events WHERE source_widget_id = v_w;
    IF n <> 2 THEN RAISE EXCEPTION 'Migration 316: expected 2 tab events, found %', n; END IF;

    -- It carries no variable and must still be accepted.
    IF (SELECT variable_id FROM module_widgets WHERE id = v_w) IS NOT NULL THEN
      RAISE EXCEPTION 'Migration 316: a tabs widget somehow bound a variable';
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
