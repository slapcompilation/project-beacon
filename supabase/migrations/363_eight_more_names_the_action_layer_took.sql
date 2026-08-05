-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 363 — the shipped action layer took eight link names with it.
--
-- edgesForAction() wrote these whenever a BeaconAction ran: modified_by,
-- transfers, transfer_approved_by, the three sourced_from variants for
-- deliveries/receipts/POs, and the two recipe/pick consumption links. The union
-- and its edge writer are gone, so all three of the guard's tests now fail for
-- each of them — no code, no row, no declaration.
--
-- Nothing here is Foundry vocabulary. A link type is a row in link_types
-- (`mirror/object-link-types/link-types-overview.md`); these were names our
-- inventory actions happened to write, and the ontology has been empty since
-- migration 353.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  dead text[] := ARRAY['modified_by','transfers','delivery_sourced_from','receipt_sourced_from',
                       'po_sourced_from','recipe_consumes','pick_consumes','transfer_approved_by'];
  v text; def text; n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.relationship_edges_store WHERE edge_type = ANY(dead);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 363: % row(s) still hold a retired name', n; END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 363: the edge_type CHECK is missing'; END IF;

  FOREACH v IN ARRAY dead LOOP
    IF position('''' || v || '''::text' IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 363: the CHECK does not list %', v;
    END IF;
    def := replace(def, '''' || v || '''::text, ', '');
    def := replace(def, ', ''' || v || '''::text', '');
  END LOOP;

  EXECUTE 'ALTER TABLE public.relationship_edges_store DROP CONSTRAINT relationship_edges_edge_type_check';
  EXECUTE 'ALTER TABLE public.relationship_edges_store ADD CONSTRAINT relationship_edges_edge_type_check ' || def;
END $$;

DO $$
DECLARE def text; v text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
   WHERE ns.nspname='public' AND t.relname='relationship_edges_store'
     AND c.conname='relationship_edges_edge_type_check';
  IF def IS NULL THEN RAISE EXCEPTION 'Migration 363: the CHECK did not come back'; END IF;
  FOREACH v IN ARRAY ARRAY['modified_by','transfers','delivery_sourced_from','receipt_sourced_from',
                           'po_sourced_from','recipe_consumes','pick_consumes','transfer_approved_by'] LOOP
    IF position('''' || v || '''::text' IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 363: % survived', v;
    END IF;
  END LOOP;
  -- sourced_from shares a suffix with three of the eight.
  IF position('''sourced_from''::text' IN def) = 0 THEN
    RAISE EXCEPTION 'Migration 363: the rewrite took sourced_from with it';
  END IF;
END $$;

COMMIT;
