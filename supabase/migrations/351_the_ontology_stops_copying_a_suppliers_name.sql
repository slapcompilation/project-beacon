-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 351 — the ontology stops modelling one fact twice.
--
-- Foundry (`mirror/ontology/ontology-structural-guidance.md`): "Store each fact
-- once. Use derived properties for convenience", and in the anti-pattern list,
-- "Properties go stale because they are copies of values maintained elsewhere."
-- Their ✗ example is an Employee carrying `managerName` copied from the linked
-- Manager, which "breaks if the manager's name changes".
--
-- Four registrations carried exactly that: purchase_order.supplier_name,
-- po_discrepancy.supplier_name, supplier_contract.supplier_name and
-- restock_request.supplier — a supplier's name copied onto four other object
-- types, every one of which now has a link to the supplier itself (350 added the
-- last two). The ontology is where the duplicate does the damage, because it is
-- what every generated surface, tool and agent reads.
--
-- STAGE ONE OF FOUR, and the boundary is deliberate. The physical columns stay
-- for now: about twenty-five functions read them and two WRITE them
-- (create_purchase_order inserts the name, detect_po_discrepancies copies it
-- onto the discrepancy). Rewriting twenty-five SECURITY DEFINER bodies in one
-- motion is how a transcription bug gets shipped, so the order is: the ontology
-- stops presenting the copy (here), the writers stop producing it, the readers
-- move to the join, and only then do the columns go.
--
-- RE-TITLING, because a title key must name a property of its own type and the
-- name is now reached across a link:
--   * supplier_contract — a contract's natural title IS its supplier, so there
--     is no perfect answer. contract_start is the honest one: the contract that
--     began on a date. Every row has one.
--   * po_discrepancy — detected_at, for the same reason. It is the fact that
--     brought the row into existence.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Re-title BEFORE the property goes; the drift guard refuses a title key that
-- names no property, and would fail mid-migration otherwise.
UPDATE public.object_types SET title_key = 'contract_start'
 WHERE api_name = 'supplier_contract' AND title_key = 'supplier_name';

UPDATE public.object_types SET title_key = 'detected_at'
 WHERE api_name = 'po_discrepancy' AND title_key = 'supplier_name';

-- The copies leave the ontology. The link is how the name is reached now.
UPDATE public.object_types o
   SET properties = (
     SELECT coalesce(jsonb_agg(p ORDER BY ord), '[]'::jsonb)
     FROM jsonb_array_elements(o.properties) WITH ORDINALITY AS t(p, ord)
     WHERE p->>'key' <> CASE o.api_name WHEN 'restock_request' THEN 'supplier' ELSE 'supplier_name' END
   )
 WHERE o.api_name IN ('purchase_order', 'po_discrepancy', 'supplier_contract', 'restock_request');

DO $$
DECLARE n int; leftover text; t text;
BEGIN
  -- No registration may still carry a supplier's name as its own property.
  SELECT string_agg(o.api_name || '.' || (p->>'key'), ', ') INTO leftover
  FROM object_types o, jsonb_array_elements(o.properties) p
  WHERE p->>'key' IN ('supplier_name', 'supplier');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 351: the ontology still copies a supplier name: %', leftover;
  END IF;

  -- Both re-titled types must still have a title, and it must be a real property.
  FOR t IN SELECT unnest(ARRAY['supplier_contract', 'po_discrepancy']) LOOP
    SELECT count(*) INTO n FROM object_types o
     WHERE o.api_name = t AND o.title_key IS NOT NULL
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p WHERE p->>'key' = o.title_key);
    IF n <> 1 THEN RAISE EXCEPTION 'Migration 351: % has no usable title key', t; END IF;
  END LOOP;

  -- Every one of the four keeps a link to the supplier, or the name became
  -- unreachable rather than derived.
  SELECT count(DISTINCT s.api_name) INTO n
  FROM link_types lt
  JOIN object_types s ON s.id = lt.source_object_type_id
  JOIN object_types tg ON tg.id = lt.target_object_type_id
  WHERE tg.api_name = 'supplier'
    AND s.api_name IN ('purchase_order', 'po_discrepancy', 'supplier_contract', 'restock_request');
  IF n <> 4 THEN
    RAISE EXCEPTION 'Migration 351: only % of 4 types can still reach a supplier', n;
  END IF;

  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 351: % drift row(s)', n; END IF;

  -- 346 titled 36 types; this moves two of them, it does not lose any.
  SELECT count(*) INTO n FROM object_types WHERE title_key IS NOT NULL;
  IF n <> 36 THEN RAISE EXCEPTION 'Migration 351: expected 36 titled types, found %', n; END IF;
END $$;

COMMIT;
