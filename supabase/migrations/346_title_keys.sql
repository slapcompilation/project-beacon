-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 346 — every object type gets the display name Foundry requires.
--
--   "Title key: The property that acts as a display name for objects of this
--    type." (`mirror/object-link-types/create-object-type.md`)
--
-- and from the course capture, on what to do when no column reads as a name:
-- "Title: the human-readable name used in search results and most apps; derive
-- one if the key is opaque." Deriving one is the instruction. Leaving it unset
-- is not an option Foundry offers.
--
-- 29 of 43 types had no title key, and because the ontology did not know, three
-- code paths invented their own answer: one fell back to "<label> <short id>",
-- and two GUESSED THE FIRST TEXT PROPERTY — a guess that silently retitles a
-- type the moment a text column is added or reordered. One of them even carried
-- the note "Provisional title: the first text property. G2 replaces this with
-- the explicit title key Foundry requires on every object type." G2 is this.
--
-- THREE GROUPS, THREE ANSWERS:
--
-- 1. 22 backed types have a property that reads as a name — set below.
-- 2. The 3 authored types need nothing: `object_records.title` is NOT NULL, so
--    every authored record already carries a mandatory title. That IS the title
--    key, fixed to one column by the storage model rather than chosen per type.
-- 3. 4 backed types have NO title-bearing column at all — menu_item_ingredient,
--    pick_list_item, purchase_order_line, stocktake_line. Their columns are a
--    parent id, a variant id and some numbers; their identity is entirely
--    relational. Rather than invent a bad title, they are recorded as the known
--    exception, and the guard added to ontology_drift.sql names them so the set
--    cannot grow silently.
--
--    These four are also the clearest candidates for Foundry's OBJECT-BACKED
--    LINK TYPES (`ontology-structural-guidance.md` §"Links and object-backed
--    link types") — a join carrying properties. That is concept 5's question,
--    not this one's, and is flagged rather than answered here.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE public.object_types t SET title_key = v.title_key
FROM (VALUES
  ('alert',                'message'),          -- what the alert says
  ('booking_forecast',     'date'),             -- the day forecast
  ('budget_allocation',    'period_month'),
  ('category',             'name'),
  ('chunk',                'summary'),          -- matches the doc-ingestion walkthrough
  ('delivery_event',       'expected_date'),
  ('forecast_observation', 'as_of'),
  ('gl_account_mapping',   'gl_account_name'),
  ('menu_item',            'name'),
  ('occupancy_log',        'date'),
  ('pick_list',            'name'),
  ('po_discrepancy',       'supplier_name'),
  ('po_invoice',           'invoice_number'),
  ('pos_sale',             'sale_time'),
  ('purchase_order',       'po_number'),
  ('restock_receive',      'received_at'),
  ('restock_request',      'date'),
  ('shift_handover',       'started_at'),
  ('stock_log',            'timestamp'),        -- no name column; when it happened is the handle
  ('stocktake_session',    'started_at'),
  ('supplier_contract',    'supplier_name'),
  ('user',                 'email')
) AS v(api_name, title_key)
WHERE t.api_name = v.api_name
  AND t.source_table IS NOT NULL
  AND t.title_key IS NULL;

COMMENT ON COLUMN public.object_types.title_key IS
  'Foundry title key: the property that acts as the display name for objects of this type. NULL is legitimate in exactly two cases — an authored type (object_records.title is NOT NULL and carries it) or one of the four relational line types with no title-bearing column, which ontology_drift.sql enumerates.';

DO $$
DECLARE n int; offenders text; bad text;
BEGIN
  -- A title key that is not a property of its type would be a dangling
  -- reference; builtin_property_drift already refuses that, so this must hold.
  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 346: % drift row(s) after setting title keys', n; END IF;

  -- Every backed type now has one, except the four recorded relational types.
  SELECT string_agg(api_name, ', ' ORDER BY api_name) INTO offenders
  FROM object_types
  WHERE source_table IS NOT NULL AND title_key IS NULL
    AND api_name NOT IN ('menu_item_ingredient','pick_list_item','purchase_order_line','stocktake_line');
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 346: backed type(s) still without a title key: %', offenders;
  END IF;

  -- And each title key names a real property of its own type.
  SELECT string_agg(o.api_name || '.' || o.title_key, ', ') INTO bad
  FROM object_types o
  WHERE o.title_key IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p WHERE p->>'key' = o.title_key);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 346: title key(s) naming no property: %', bad;
  END IF;

  SELECT count(*) INTO n FROM object_types WHERE title_key IS NOT NULL;
  IF n <> 36 THEN RAISE EXCEPTION 'Migration 346: expected 36 titled types, found %', n; END IF;
END $$;

COMMIT;
