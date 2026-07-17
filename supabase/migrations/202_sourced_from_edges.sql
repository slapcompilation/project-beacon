-- Migration 202 — model which supplier actually sources a variant, as typed edges.
--
-- Layer: data · Scope: hotel.
--
-- rank_alternative_suppliers declares `traversableLinks: ['sourced_from']` and
-- 'sourced_from' has been in EdgeType since migration 056 — but nothing ever
-- wrote one, and getSuppliersForVariant is variant-blind (it returns EVERY
-- supplier in the hotel). So the tool ranked suppliers that don't stock the item,
-- and lead-time scoring made the fastest one win.
--
-- Live consequence, observed: 2 of 3 restock proposals told the operator to buy
-- Soda Water and Tonic Water (mixers) from Premium Spirits Co — a spirits
-- supplier — because its 3-day lead beat Bar Essentials' 7-day.
--
-- The sourcing link already exists as a bare FK (product_variants.default_supplier_id).
-- CLAUDE.md: "All data is nodes + typed edges. No bare foreign keys." This lifts
-- it into the graph so the declared traversal is finally true, and so a variant
-- can carry MORE than one supplier later (a real alternatives set) without a
-- schema change.

-- Backfill: variant --sourced_from--> supplier, from the FK we already have.
INSERT INTO relationship_edges (hotel_id, edge_type, source_type, source_id, target_type, target_id, triggered_by, actor_id)
SELECT p.hotel_id, 'sourced_from', 'variant', pv.id, 'supplier', pv.default_supplier_id, 'user', NULL
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.default_supplier_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM relationship_edges e
    WHERE e.source_type = 'variant' AND e.source_id = pv.id
      AND e.edge_type = 'sourced_from' AND e.target_id = pv.default_supplier_id
  );

-- Keep the graph honest as the FK changes: re-point the edge when a variant's
-- supplier is reassigned. Without this the edge is a one-off backfill that rots.
CREATE OR REPLACE FUNCTION public.tg_sync_sourced_from_edge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_hotel uuid;
BEGIN
  IF NEW.default_supplier_id IS DISTINCT FROM OLD.default_supplier_id THEN
    SELECT hotel_id INTO v_hotel FROM products WHERE id = NEW.product_id;
    DELETE FROM relationship_edges
     WHERE source_type = 'variant' AND source_id = NEW.id AND edge_type = 'sourced_from';
    IF NEW.default_supplier_id IS NOT NULL THEN
      INSERT INTO relationship_edges (hotel_id, edge_type, source_type, source_id, target_type, target_id, triggered_by, actor_id)
      VALUES (v_hotel, 'sourced_from', 'variant', NEW.id, 'supplier', NEW.default_supplier_id, 'user', NULL);
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_sourced_from_edge ON public.product_variants;
CREATE TRIGGER trg_sync_sourced_from_edge
  AFTER UPDATE OF default_supplier_id ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION tg_sync_sourced_from_edge();
