-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 349 — derived values become ontology data, starting with the ones
-- that had no implementation at all.
--
-- Foundry's rule for computed values is a two-way test, not a single answer
-- (`mirror/ontology/ontology-structural-guidance.md`):
--
--   Pre-computed    — "computed from properties on the same object; inputs
--                      rarely change" → pipeline transform.
--   Dynamically     — "depends on linked objects or values that change via
--   derived           actions, automations, or other Ontology-level operations"
--                     → derived property.
--
-- and their anti-pattern list names ours exactly: "Integer or count properties
-- are manually maintained rather than computed from links."
--
-- WHERE WE WERE. `computed_properties` — a bounded grammar of sum, product,
-- difference, days_since, days_until — existed and was used by ONE of 43 object
-- types. Every domain value was instead a hand-written TypeScript function in
-- packages/reality-graph/src/nodes/, about forty of them. Two mechanisms for one
-- concept, split by which half of the ontology you were standing in.
--
-- THIS MIGRATION MOVES NOTHING THAT ALREADY WORKS. Every value below is one
-- nothing computes today, so there is no second definition created and no
-- consumer to migrate. `stock_value` is the clearest case: it had a written
-- definition in the web-side GLOSSARY const — "units on hand × unit cost" — and
-- no code anywhere that multiplied them. A documented metric that was never
-- calculated.
--
-- The link-dependent values (days_until_zero, reorder_point) are deliberately
-- NOT here. Their inputs live on linked objects and the grammar has no
-- aggregation over links; inventing one in passing is how a grammar ends up
-- shaped by whichever caller arrived first. That is its own pass, against
-- Foundry's aggregation semantics.
--
-- Four of the six land on the relational line types that migration 346 left
-- without a title. A variance IS what a stocktake line means, so this also makes
-- them legible where a title could not.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  c jsonb;
  specs jsonb := jsonb_build_array(
    jsonb_build_object('api_name','variant','def', jsonb_build_object(
      'key','stock_value','label','Stock value','fn','product',
      'inputs', jsonb_build_array('current_stock','cost'),
      'description','What the stock on hand is worth: units on hand x unit cost.')),

    jsonb_build_object('api_name','stocktake_line','def', jsonb_build_object(
      'key','variance','label','Variance','fn','difference',
      'inputs', jsonb_build_array('counted_qty','system_qty'),
      'description','Counted minus what the system expected. Negative means stock is missing.')),

    jsonb_build_object('api_name','purchase_order_line','def', jsonb_build_object(
      'key','outstanding_qty','label','Outstanding','fn','difference',
      'inputs', jsonb_build_array('ordered_qty','received_qty'),
      'description','Units ordered that have not arrived yet.')),

    jsonb_build_object('api_name','delivery_event','def', jsonb_build_object(
      'key','qty_variance','label','Quantity variance','fn','difference',
      'inputs', jsonb_build_array('received_qty','ordered_qty'),
      'description','Received minus ordered. Negative is a short delivery.')),

    jsonb_build_object('api_name','delivery_event','def', jsonb_build_object(
      'key','unit_cost_variance','label','Unit cost variance','fn','difference',
      'inputs', jsonb_build_array('unit_cost_actual','unit_cost_expected'),
      'description','What was charged per unit minus what was expected. Positive means paying more than agreed.')),

    jsonb_build_object('api_name','supplier_contract','def', jsonb_build_object(
      'key','days_until_expiry','label','Days until expiry','fn','days_until',
      'inputs', jsonb_build_array('contract_end'),
      'description','Days left on this contract. Renegotiation lead time starts here.'))
  );
  s jsonb; missing text := '';
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(specs) LOOP
    c := s->'def';

    -- Every input must be a real property of that same type. A computed value
    -- reading a key that does not exist evaluates to nothing and shows a blank
    -- cell rather than failing, so it is checked here instead.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(c->'inputs') i
      WHERE NOT EXISTS (
        SELECT 1 FROM object_types o, jsonb_array_elements(o.properties) p
        WHERE o.api_name = s->>'api_name' AND p->>'key' = i
      )
    ) THEN
      missing := missing || (s->>'api_name') || '.' || (c->>'key') || ' ';
      CONTINUE;
    END IF;

    UPDATE object_types
       SET computed_properties = computed_properties || jsonb_build_array(c)
     WHERE api_name = s->>'api_name'
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(computed_properties) x
         WHERE x->>'key' = c->>'key');
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'Migration 349: computed value(s) reference a property that does not exist: %', missing;
  END IF;
END $$;

DO $$
DECLARE n int; bad text;
BEGIN
  SELECT count(*) INTO n FROM object_types o, jsonb_array_elements(o.computed_properties) c
   WHERE c->>'key' IN ('stock_value','variance','outstanding_qty','qty_variance',
                       'unit_cost_variance','days_until_expiry');
  IF n <> 6 THEN RAISE EXCEPTION 'Migration 349: expected 6 computed properties, found %', n; END IF;

  -- The grammar is closed. A function outside it has no evaluator and would
  -- render as nothing at all.
  SELECT string_agg(DISTINCT c->>'fn', ', ') INTO bad
  FROM object_types o, jsonb_array_elements(o.computed_properties) c
  WHERE c->>'fn' NOT IN ('sum','product','difference','days_since','days_until');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 349: computed function(s) outside the grammar: %', bad;
  END IF;

  -- A computed key must not collide with a stored property on the same type;
  -- the reader resolves stored first and the computed one would be invisible.
  SELECT string_agg(o.api_name || '.' || (c->>'key'), ', ') INTO bad
  FROM object_types o, jsonb_array_elements(o.computed_properties) c
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p WHERE p->>'key' = c->>'key');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 349: computed key(s) shadowed by a stored property: %', bad;
  END IF;

  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 349: % drift row(s)', n; END IF;
END $$;

COMMIT;
