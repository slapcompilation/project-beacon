-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 350 — two objects knew their supplier's name and had no link to it.
--
-- Foundry's anti-pattern list is explicit
-- (`mirror/ontology/ontology-structural-guidance.md`):
--
--   "Properties go stale because they are copies of values maintained elsewhere"
--
-- with the worked example being an Employee carrying `managerName: "Alice"`
-- copied from the linked Manager, which "breaks if the manager's name changes".
-- Their rule above it: "Store each fact once. Use derived properties for
-- convenience."
--
-- Five of our tables carry a supplier's name. Three — purchase_orders,
-- supplier_contracts, supplier_scorecard — carry it beside a supplier_id, which
-- is their ✗ column exactly: a copy next to the link.
--
-- THESE TWO WERE WORSE. po_discrepancies and restock_requests carried the name
-- with NO FOREIGN KEY AT ALL, so the stale copy was the only handle. There was
-- nothing to traverse: the ontology could not answer "which supplier is this
-- discrepancy against", and no derived property could fix it because there was
-- no link to derive across. A missing link is a different defect from a
-- redundant copy, and it is the one that has to be fixed first.
--
-- Every named row resolves to a real supplier — 8 of 8 discrepancies and 11 of
-- 11 named requests — so the link is recoverable rather than guessed.
--
-- WHAT THIS DOES NOT DO. The five name columns stay for now. Dropping them
-- touches 56 references across a dozen web files, and Foundry itself allows the
-- copy as "a conscious, documented decision and not the default". This migration
-- makes it conscious by creating the link the copy was standing in for; removing
-- the copies is its own pass with its own consumer sweep.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.po_discrepancies
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.restock_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_discrepancies_supplier ON public.po_discrepancies (supplier_id);
CREATE INDEX IF NOT EXISTS idx_restock_requests_supplier ON public.restock_requests (supplier_id);

-- Matched within the property, never across one. Two hotels may both stock from
-- "Ada Foods" and they are different supplier rows.
UPDATE public.po_discrepancies d
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE d.supplier_id IS NULL AND d.supplier_name IS NOT NULL
   AND s.name = d.supplier_name AND s.hotel_id = d.hotel_id;

UPDATE public.restock_requests r
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE r.supplier_id IS NULL AND r.supplier IS NOT NULL
   AND s.name = r.supplier AND s.hotel_id = r.hotel_id;

COMMENT ON COLUMN public.po_discrepancies.supplier_id IS
  'The supplier this discrepancy is against. Added in 350; supplier_name predates it and is a copy, kept until its consumers move.';
COMMENT ON COLUMN public.restock_requests.supplier_id IS
  'The supplier this request is aimed at. Added in 350; `supplier` predates it and is a copy, kept until its consumers move.';

-- The ontology has to know about the link, not just the column. Shape copied
-- from po_sourced_from, the FK-backed supplier link that already works.
INSERT INTO public.link_types (
  organization_id, source_object_type_id, target_object_type_id,
  api_name, label, source_api_name, target_api_name, source_label, target_label,
  cardinality, backing_kind, backing_table, backing_column, backing_hotel_column,
  edge_type, projected, kind, status, created_by_user_id)
SELECT o.id, src.id, tgt.id,
       v.api_name, v.label, v.source_api_name, v.target_api_name, v.source_label, v.target_label,
       'many_to_one', 'foreign_key', v.backing_table, 'supplier_id', 'hotel_id',
       v.edge_type, true, 'builtin', 'active',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('discrepancy_sourced_from', 'Supplier', 'discrepancies', 'supplier',
   'Discrepancies', 'Supplier', 'po_discrepancies', 'discrepancy_sourced_from'),
  ('request_sourced_from', 'Supplier', 'requests', 'supplier',
   'Requests', 'Supplier', 'restock_requests', 'request_sourced_from')
) AS v(api_name, label, source_api_name, target_api_name, source_label, target_label, backing_table, edge_type)
JOIN public.object_types src
  ON src.organization_id = o.id
 AND src.api_name = CASE v.backing_table WHEN 'po_discrepancies' THEN 'po_discrepancy' ELSE 'restock_request' END
JOIN public.object_types tgt ON tgt.organization_id = o.id AND tgt.api_name = 'supplier'
WHERE NOT EXISTS (
  SELECT 1 FROM public.link_types lt
   WHERE lt.organization_id = o.id AND lt.api_name = v.api_name);

SELECT public.rebuild_relationship_edges_view();

DO $$
DECLARE n int; unresolved int;
BEGIN
  SELECT count(*) INTO unresolved FROM po_discrepancies
   WHERE supplier_name IS NOT NULL AND supplier_id IS NULL;
  IF unresolved > 0 THEN
    RAISE EXCEPTION 'Migration 350: % discrepancy row(s) name a supplier that could not be linked', unresolved;
  END IF;

  SELECT count(*) INTO unresolved FROM restock_requests
   WHERE supplier IS NOT NULL AND supplier_id IS NULL;
  IF unresolved > 0 THEN
    RAISE EXCEPTION 'Migration 350: % request row(s) name a supplier that could not be linked', unresolved;
  END IF;

  -- The link must never cross a property boundary.
  SELECT count(*) INTO n FROM po_discrepancies d JOIN suppliers s ON s.id = d.supplier_id
   WHERE s.hotel_id IS DISTINCT FROM d.hotel_id;
  IF n > 0 THEN RAISE EXCEPTION 'Migration 350: % discrepancy link(s) cross a property', n; END IF;

  SELECT count(*) INTO n FROM restock_requests r JOIN suppliers s ON s.id = r.supplier_id
   WHERE s.hotel_id IS DISTINCT FROM r.hotel_id;
  IF n > 0 THEN RAISE EXCEPTION 'Migration 350: % request link(s) cross a property', n; END IF;

  SELECT count(*) INTO n FROM link_types
   WHERE api_name IN ('discrepancy_sourced_from', 'request_sourced_from');
  IF n < 2 THEN RAISE EXCEPTION 'Migration 350: expected both link types, found %', n; END IF;

  -- Projected link types must actually surface, or the ontology declares a
  -- traversal that answers nothing.
  SELECT count(DISTINCT edge_type) INTO n FROM relationship_edges
   WHERE edge_type IN ('discrepancy_sourced_from', 'request_sourced_from');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 350: % of 2 new link types reach relationship_edges', n;
  END IF;
END $$;

COMMIT;
