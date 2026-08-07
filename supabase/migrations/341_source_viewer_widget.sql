-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 341 — the last link in the ontology-augmented-generation chain.
--
-- ontology-augmented-generation gives the chain in four steps: a chunking
-- strategy, chunk objects with a media reference property, a semantic search
-- workflow, and "the PDF Viewer widget in Workshop". The first three are built
-- (migrations 338-340). This is the fourth, and its job is stated in
-- functions/chunking: render the source "on the side for SOURCE-OF-TRUTH
-- CROSS-VALIDATION for the users".
--
-- FOUNDRY'S BINDING, COPIED EXACTLY (`mirror/workshop/widgets-pdf-viewer.md`):
--
--   "Define an object set with a SINGLE OBJECT and select the media reference
--    typed property for the PDF."
--
-- So: an object_set variable plus a property name. Not a document id, not a
-- path — the widget reads the property, which is why registering
-- document.storage_path as a media_reference in 340 had to come first.
--
-- Their input variables are theirs too: a page number that "will navigate users
-- to the specified page", and a text input that "will be populated into the
-- search bar, and a keyword search will be executed against that term".
--
-- NAMED `source_viewer`, NOT `pdf_viewer`. Theirs is one of several specialised
-- media widgets and is PDF-specific; ours renders whatever the media reference
-- points at, which today is far more often extracted text than a PDF. Calling it
-- pdf_viewer would promise a renderer we do not have — the divergence is
-- recorded rather than hidden behind the name.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_widget_type_check;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_widget_type_check
  CHECK (widget_type IN (
    'object_table', 'metric_card', 'markdown', 'object_set_title', 'button_group',
    'embedded_module', 'tabs', 'filter_list',
    'chart_xy', 'object_view', 'inline_action',
    'source_viewer'
  ));

ALTER TABLE public.module_widgets DROP CONSTRAINT IF EXISTS module_widgets_needs_binding;
ALTER TABLE public.module_widgets ADD CONSTRAINT module_widgets_needs_binding
  CHECK (
    (widget_type IN ('object_table', 'object_set_title', 'filter_list', 'chart_xy',
                     'object_view', 'source_viewer')
      AND variable_id IS NOT NULL)
    OR (widget_type = 'metric_card' AND variable_id IS NOT NULL)
    OR widget_type IN ('markdown', 'button_group', 'embedded_module', 'tabs', 'inline_action')
  );

COMMENT ON CONSTRAINT module_widgets_needs_binding ON public.module_widgets IS
  'Which widgets must name a variable. source_viewer takes an object set holding ONE object and reads a media reference property off it — Foundry''s PDF Viewer binding.';

DO $$
DECLARE v_org uuid; v_hotel uuid; v_mod uuid; v_var uuid; n int;
BEGIN
  SELECT id, (SELECT id FROM hotels WHERE organization_id = o.id LIMIT 1)
    INTO v_org, v_hotel FROM organizations o LIMIT 1;

  BEGIN
    INSERT INTO modules (organization_id, hotel_id, api_name, title)
    VALUES (v_org, v_hotel, 'probe_viewer', 'Probe Viewer') RETURNING id INTO v_mod;
    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (v_mod, 'the_doc', 'object_set') RETURNING id INTO v_var;

    INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
    VALUES (v_mod, 'source', 'source_viewer', v_var, '{"property":"storage_path"}'::jsonb);
    SELECT count(*) INTO n FROM module_widgets WHERE module_id = v_mod;
    IF n <> 1 THEN RAISE EXCEPTION 'Migration 341: the widget did not insert'; END IF;

    -- A viewer with no object set has nothing to read the property off.
    BEGIN
      INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
      VALUES (v_mod, 'source2', 'source_viewer', NULL, '{}'::jsonb);
      RAISE EXCEPTION 'Migration 341: a source_viewer was accepted with no variable';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
