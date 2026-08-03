-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 318 — the Filter List, and a variable type that has been dead since W1.
--
-- `object_set_filter` has been in the module_variables var_type CHECK since
-- migration 306, the builder OFFERS it in its type dropdown, and NOTHING HAS
-- EVER CONSUMED IT. An author could create one and watch it do nothing. That is
-- the dead vocabulary this codebase keeps removing, except the shape ratchet
-- cannot see it: it is a CHECK value, not a database object.
--
-- So: build the consumer, or admit the type is dead. This builds the consumer.
--
-- FOUNDRY'S TWO HALVES (workshop/object-set-filter-variables, widgets-filter-list):
--
--   THE VARIABLE "stores a set of property type / property value pairs used to
--   filter object set variables". It is state, produced by widgets or given a
--   default, and an object set variable "may be optionally filtered by property
--   values or Filter variables".
--
--   THE WIDGET takes an object set as input, shows a configured set of
--   properties, and has ONE output variable that plays two roles: the live
--   filter state, and the default filter applied on load.
--
-- THE OPERATORS, copied exactly, including the limit that would otherwise be
-- silently wrong:
--
--   IS       "objects that have a property value that matches exactly"
--   NULL     "objects that have a property value that is null"
--   CONTAIN  "objects that have a property that contains the filter query …
--             This matching behavior is currently limited to PREFIXES; matching
--             arbitrary portions of strings is not currently supported."
--
-- Implementing CONTAIN as a substring match would look more useful and be a
-- different feature. Their example is explicit: `id000123` matches `id0001` but
-- NOT `d0001`.
--
-- Why this pairs with 317: filtering the set variable re-filters everything
-- downstream — the table, the loop, and every aggregation over it. One filter,
-- one set, N numbers that all move together.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table','metric_card','markdown','object_set_title','button_group',
    'embedded_module','tabs','filter_list'));

-- A filter list shows an object set, so it binds one like any display widget.
ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (widget_type IN ('markdown','button_group','embedded_module','tabs')
         OR variable_id IS NOT NULL);

DO $$
DECLARE v_org uuid; v_mod uuid; v_set uuid; v_filter uuid; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_filter', 'Probe') RETURNING id INTO v_mod;

    INSERT INTO module_variables (module_id, api_name, var_type, definition_kind, definition)
    VALUES (v_mod, 'items', 'object_set', 'object_set_definition', '{}'::jsonb)
    RETURNING id INTO v_set;

    -- The type that has had no consumer until now.
    INSERT INTO module_variables (module_id, api_name, var_type, definition_kind, definition)
    VALUES (v_mod, 'shortlist', 'object_set_filter', 'static',
            '{"value":[{"property":"status","op":"IS","value":"open"}]}'::jsonb)
    RETURNING id INTO v_filter;

    -- The set says which filter applies to it.
    UPDATE module_variables
       SET definition = definition || '{"filterVariable":"shortlist"}'::jsonb
     WHERE id = v_set;

    INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, position, config)
    VALUES (v_mod, 'filters', 'filter_list', v_set, 0, jsonb_build_object(
      'output', 'shortlist',
      'properties', jsonb_build_array(
        jsonb_build_object('property','status','component','multi_select'),
        jsonb_build_object('property','name','component','keyword'))));

    SELECT count(*) INTO n FROM module_variables
     WHERE module_id = v_mod AND var_type = 'object_set_filter';
    IF n <> 1 THEN RAISE EXCEPTION 'Migration 318: the filter variable did not persist'; END IF;

    -- A filter list without a set to show must be refused.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, position)
      VALUES (v_mod, 'orphan', 'filter_list', 1);
      RAISE EXCEPTION 'Migration 318: an unbound filter list was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
