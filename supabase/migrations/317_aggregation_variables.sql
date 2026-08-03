-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 317 — the aggregating moves off the card and onto a variable.
--
-- No schema change: `object_set_aggregation` has been in the definition_kind
-- CHECK since W1 (migration 306), which put Foundry's full vocabulary in the
-- constraint ahead of the runtime. Third time that has paid for itself.
--
-- WHAT THIS IS, from the docs (mirrored 2026-08-03):
--
--   widgets-metric-card: "The value used to populate the metric must be backed
--   by a Workshop variable of the corresponding type. So, if the value type is
--   set to String, the user will have to select a string variable... if the
--   value type is set to Number, the user will have to select a numeric
--   variable."
--
--   scenarios-getting-started, configuring a real one: "we're creating a new
--   numeric metric with a value defined by a new Object set aggregation
--   variable."
--
-- So FOUNDRY'S METRIC CARD DOES NOT AGGREGATE. It displays a variable. The
-- aggregating is a variable definition kind, and an aggregation reads another
-- object-set VARIABLE. That is the co-link, and it is exactly why you do not end
-- up with four saved sets of the same object type to show four numbers: one set
-- variable backs a count, a sum, an average and a distinct count.
--
-- Our metric card had `config.aggregation` + `config.property` and aggregated
-- inline. This converts every one of those into the shape above: an aggregation
-- variable per card, and the card rebound to it.
--
-- The metric vocabulary is Foundry's own, from functions/api-object-sets
-- "Choosing an aggregation metric" — count, sum, average, min, max, cardinality.
-- Ours had `avg`; that becomes `average`, because a name that differs from the
-- docs is a name nobody can look up.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  r record;
  v_metric text;
  v_prop text;
  v_new uuid;
  n_converted int := 0;
BEGIN
  FOR r IN
    SELECT w.id AS widget_id, w.module_id, w.api_name, w.config, w.title,
           v.api_name AS set_name
    FROM module_widgets w
    JOIN module_variables v ON v.id = w.variable_id
    WHERE w.widget_type = 'metric_card' AND v.var_type = 'object_set'
  LOOP
    v_metric := coalesce(r.config->>'aggregation', 'count');
    IF v_metric = 'avg' THEN v_metric := 'average'; END IF;
    v_prop := nullif(r.config->>'property', '');

    -- count takes no property; anything else without one cannot be computed, so
    -- it degrades to a count rather than becoming a card that shows nothing.
    IF v_metric <> 'count' AND v_prop IS NULL THEN v_metric := 'count'; END IF;

    INSERT INTO module_variables (module_id, api_name, label, var_type,
                                  definition_kind, definition, recompute)
    VALUES (
      r.module_id,
      -- Deterministic and collision-proof within a module.
      left(regexp_replace(r.set_name || '_' || v_metric || coalesce('_' || v_prop, ''),
                          '[^a-zA-Z0-9_]', '_', 'g'), 60),
      coalesce(nullif(r.title, ''), initcap(v_metric)),
      'numeric', 'object_set_aggregation',
      jsonb_strip_nulls(jsonb_build_object(
        'objectSet', r.set_name, 'metric', v_metric, 'property', v_prop)),
      'automatic')
    ON CONFLICT (module_id, api_name) DO UPDATE SET definition = EXCLUDED.definition
    RETURNING id INTO v_new;

    UPDATE module_widgets
       SET variable_id = v_new,
           config = (config - 'aggregation') - 'property'
     WHERE id = r.widget_id;

    n_converted := n_converted + 1;
  END LOOP;

  RAISE NOTICE 'Migration 317: % metric card(s) now read an aggregation variable', n_converted;

  -- Nothing may be left aggregating inside a widget.
  IF EXISTS (
    SELECT 1 FROM module_widgets w
    JOIN module_variables v ON v.id = w.variable_id
    WHERE w.widget_type = 'metric_card' AND v.var_type = 'object_set'
  ) THEN
    RAISE EXCEPTION 'Migration 317: a metric card is still bound to an object set';
  END IF;
END $$;

DO $$
DECLARE v_org uuid; v_mod uuid; v_set uuid; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  BEGIN
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_agg', 'Probe') RETURNING id INTO v_mod;
    INSERT INTO module_variables (module_id, api_name, var_type, definition_kind, definition)
    VALUES (v_mod, 'items', 'object_set', 'object_set_definition', '{}'::jsonb)
    RETURNING id INTO v_set;

    -- One set, three numbers — the whole point.
    INSERT INTO module_variables (module_id, api_name, var_type, definition_kind, definition) VALUES
      (v_mod, 'lines',  'numeric', 'object_set_aggregation',
       '{"objectSet":"items","metric":"count"}'::jsonb),
      (v_mod, 'onHand', 'numeric', 'object_set_aggregation',
       '{"objectSet":"items","metric":"sum","property":"current_stock"}'::jsonb),
      (v_mod, 'kinds',  'numeric', 'object_set_aggregation',
       '{"objectSet":"items","metric":"cardinality","property":"unit_of_measure"}'::jsonb);

    SELECT count(*) INTO n FROM module_variables
     WHERE module_id = v_mod AND definition->>'objectSet' = 'items';
    IF n <> 3 THEN
      RAISE EXCEPTION 'Migration 317: expected 3 aggregations over one set, found %', n;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
