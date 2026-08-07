-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 347 — concept 2, Property: a description belongs on the property.
--
-- Foundry's property metadata reference lists it plainly:
--
--   "Description: Explanatory text about the property that anyone can read in
--    user applications. For example, the description of the `start date`
--    property may be `The day the employee began new hire training`."
--
-- and the first deep-dive course shows the payoff — "property mouseover reveals
-- its definition" — a reader learning what ICAO means from the ontology rather
-- than from a colleague.
--
-- WHERE OURS WERE. `PropertyDef.description` has existed since the shared-
-- property work, and across 307 registered properties exactly ZERO carried one.
-- The definitions existed — thirteen of them, hand-written in
-- apps/web/src/lib/objectPresentation.ts as GLOSSARY, whose own comment says
-- they are "plain-language definitions THE ONTOLOGY SERVES as tooltips, so
-- 'what does PAR mean?' is answered by the graph, not a training doc." The
-- intent was right and the storage was a TypeScript const, readable only by the
-- surfaces that import it and invisible to the ontology, the copilot, and any
-- generated Object View.
--
-- This moves the four that describe a real registered property onto that
-- property, and adds the rest of the definitions worth stating. The nine
-- remaining GLOSSARY entries describe COMPUTED metrics, not stored properties
-- (days_until_zero, reorder_point, stock_value…), so they stay where they are
-- until computed properties carry descriptions too — a different concept, not
-- this one.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Rewrites one property's description in place, leaving every other key intact.
CREATE OR REPLACE FUNCTION public.set_property_description(
  p_api_name text, p_key text, p_description text
) RETURNS int LANGUAGE sql AS $$
  WITH updated AS (
    UPDATE public.object_types o
       SET properties = (
         SELECT jsonb_agg(
           CASE WHEN p->>'key' = p_key
                THEN p || jsonb_build_object('description', p_description)
                ELSE p END
           ORDER BY ord)
         FROM jsonb_array_elements(o.properties) WITH ORDINALITY AS t(p, ord)
       )
     WHERE o.api_name = p_api_name
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p WHERE p->>'key' = p_key)
     RETURNING 1
  )
  SELECT count(*)::int FROM updated;
$$;

COMMENT ON FUNCTION public.set_property_description(text, text, text) IS
  'Sets one property''s description without disturbing the rest of the properties array. Returns rows touched — 0 means the property does not exist on that type.';

DO $$
DECLARE
  d text[][] := ARRAY[
    -- The four GLOSSARY terms that describe a stored property.
    ARRAY['variant','low_stock_threshold','The stock level this item should be kept at (its PAR). Falling below it flags the item as low.'],
    ARRAY['supplier','on_time_pct','Share of this supplier''s orders delivered by the promised date in the last 90 days.'],
    ARRAY['supplier','cost_variance_pct','How far invoiced prices drift from contracted prices. Positive means paying more than agreed.'],
    ARRAY['purchase_order','total_amount','The full monetary value of this purchase order across all line items.'],
    -- Properties whose name does not give away the meaning, which is the test
    -- Foundry's example applies ("the day the employee began new hire training").
    ARRAY['variant','par_source','Where the PAR level came from — set by an operator, or derived from consumption history.'],
    ARRAY['variant','current_stock','Units on hand right now, after every counted movement including reverts.'],
    ARRAY['variant','forecast_basis','Which method produced the projected demand — a rolling average, or a trained model.'],
    ARRAY['variant','forecast_confidence','How much to trust the projection, 0 to 1. Low confidence widens the safety buffer.'],
    ARRAY['variant','projected_demand','Units expected to be consumed over the forecast horizon.'],
    ARRAY['variant','has_stock_history','Whether this item has enough counted movement to forecast from at all.'],
    ARRAY['supplier','lead_time_days','Days from order to delivery, measured from this supplier''s own deliveries rather than their quote.'],
    ARRAY['supplier','lead_time_source','Whether the lead time was measured from deliveries or fell back to a stated default.'],
    ARRAY['supplier','lead_time_stddev','How much the lead time swings. A large spread means the average cannot be planned against.'],
    ARRAY['supplier','reliability_sample_size','How many deliveries the reliability figures rest on. A small sample is not yet evidence.'],
    ARRAY['restock_request','is_auto_proposed','Whether an agent raised this request rather than a person.'],
    ARRAY['restock_request','required_approval_tier','Which approval level this request needs before it can be sent.'],
    ARRAY['restock_request','escalation_count','How many times this request has been escalated for going unanswered.'],
    ARRAY['stock_log','is_revert','Whether this entry undoes an earlier one. Stock logs are never edited; a correction is a new, opposite entry.'],
    ARRAY['stock_log','balance_after','Stock on hand immediately after this movement — the running total, not the change.'],
    ARRAY['stock_log','quantity_change','Units added or removed. Negative is a removal.'],
    ARRAY['proposal','confidence','How sure the agent is of this proposal, 0 to 1. High-confidence proposals may auto-execute; low ones always wait for a person.']
  ];
  i int; touched int; missed text := '';
BEGIN
  FOR i IN 1 .. array_length(d, 1) LOOP
    SELECT set_property_description(d[i][1], d[i][2], d[i][3]) INTO touched;
    IF touched = 0 THEN missed := missed || d[i][1] || '.' || d[i][2] || ' '; END IF;
  END LOOP;

  -- A description aimed at a property that does not exist is a silent no-op,
  -- which is how the GLOSSARY drifted in the first place.
  IF missed <> '' THEN
    RAISE EXCEPTION 'Migration 347: description(s) target no such property: %', missed;
  END IF;
END $$;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM object_types o, jsonb_array_elements(o.properties) p
   WHERE p ? 'description' AND btrim(p->>'description') <> '';
  IF n <> 21 THEN RAISE EXCEPTION 'Migration 347: expected 21 described properties, found %', n; END IF;

  -- Descriptions must not disturb the registration itself.
  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 347: % drift row(s) after describing properties', n; END IF;

  SELECT count(*) INTO n FROM object_types WHERE title_key IS NOT NULL;
  IF n <> 36 THEN RAISE EXCEPTION 'Migration 347: title keys disturbed — % of 36', n; END IF;
END $$;

COMMIT;
