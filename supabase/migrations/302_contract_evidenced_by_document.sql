-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 302 — a record can point at the document that evidences it.
--
-- Recorded as an open gap in #458 and it turned out to be wider than written:
-- NO link type anywhere targets `document`. A document can be cited — cited_in
-- runs document -> chunk — but nothing in the ontology can say "this record is
-- evidenced by that document". The document is a thing you search, not a thing
-- an object can reference.
--
-- That is the missing half of the contracts arc. Today a contracted price is a
-- number with no provenance: an agent quoting it can say what the price is and
-- not where it comes from, while the SAME agent citing a clause from the
-- document path carries a page reference. One of those is auditable.
--
-- ON DELETE SET NULL, not CASCADE. Deleting a document must never delete the
-- agreement it evidenced — that is invariant 4's rule and this is exactly the
-- provenance-column shape it exists for. Losing the scan is losing the
-- evidence, not losing the contract.
--
-- Named `evidenced_by` rather than `sourced_from` or `cited_in`: sourced_from
-- already means "which supplier does this come from" and cited_in means "this
-- chunk is part of that document". A record pointing at its supporting paper is
-- a third relationship and gets a third name, per the split-names rule 263
-- established.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.supplier_contracts
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supplier_contracts.document_id IS
  'The ingested agreement this row was read from. SET NULL on delete: losing the scan loses the evidence, not the contract.';

CREATE INDEX IF NOT EXISTS idx_supplier_contracts_document
  ON public.supplier_contracts (document_id) WHERE document_id IS NOT NULL;

-- ── The name ─────────────────────────────────────────────────────────────────

ALTER TABLE public.relationship_edges_store DROP CONSTRAINT IF EXISTS relationship_edges_edge_type_check;
ALTER TABLE public.relationship_edges_store
  ADD CONSTRAINT relationship_edges_edge_type_check CHECK (edge_type IN (
    'causes','consumes','restocks','reverts','belongs_to_session','triggered_alert',
    'approved_by','rejected_by','modified_by','fulfills','log_fulfills_request',
    'sourced_from','batch_of','discarded_via','linked_to_po','invoiced_by',
    'influenced_by_occupancy','influenced_by_principle','similar_to','transfers',
    'proposed_by','benchmarks','harmonized_to','describes_entity','cited_in',
    'applies_to','derived_from','mentions','resolved_to',
    'delivery_sourced_from','receipt_sourced_from','po_sourced_from',
    'recipe_consumes','pick_consumes','transfer_approved_by',
    'sold','ingredient_of',
    'line_of','line_orders','line_fulfills_request','discrepancy_of',
    'contracted_with','contract_covers',
    -- 302: the paper behind the record
    'evidenced_by'
  ));

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type,
   backing_hotel_column, backing_time_column, created_by_user_id)
SELECT o.id, s.id, t.id, 'evidenced_by', 'Evidenced By', 'document', 'Document',
       'contracts', 'Contracts', 'many_to_one', 'foreign_key',
       'supplier_contracts', 'document_id', 'builtin', 'evidenced_by',
       'hotel_id', 'created_at',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
JOIN public.object_types s ON s.api_name = 'supplier_contract' AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = 'document'          AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

SELECT public.rebuild_relationship_edges_view();

-- ── The term now carries where it came from ─────────────────────────────────

DROP FUNCTION IF EXISTS public.get_contract_terms(uuid, uuid);

CREATE FUNCTION public.get_contract_terms(p_variant_id uuid, p_supplier_id uuid)
RETURNS TABLE (
  contracted_price   numeric,
  min_order_qty      integer,
  valid_from         date,
  valid_until        date,
  in_force           boolean,
  pricing_basis      text,
  payment_terms_days integer,
  document_id        uuid,
  document_title     text,
  basis              text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT sc.contracted_price,
         sc.min_order_qty,
         sc.contract_start,
         sc.contract_end,
         (sc.is_active
          AND (sc.contract_start IS NULL OR sc.contract_start <= current_date)
          AND (sc.contract_end   IS NULL OR sc.contract_end   >= current_date)),
         sc.pricing_basis,
         sc.payment_terms_days,
         sc.document_id,
         d.title,
         CASE
           WHEN NOT sc.is_active THEN 'contract marked inactive'
           WHEN sc.contract_end IS NOT NULL AND sc.contract_end < current_date
             THEN 'contract expired ' || sc.contract_end::text
           WHEN sc.contract_start IS NOT NULL AND sc.contract_start > current_date
             THEN 'contract starts ' || sc.contract_start::text
           WHEN sc.pricing_basis = 'per_purchase_order'
             THEN 'agreement in force; price is set on each purchase order'
           WHEN sc.pricing_basis = 'quoted_on_request'
             THEN 'agreement in force; price quoted on request'
           ELSE 'contracted price, in force'
         END
  FROM supplier_contracts sc
  -- LEFT JOIN: a hand-entered agreement with no scan is still an agreement.
  LEFT JOIN documents d ON d.id = sc.document_id
  WHERE sc.supplier_id = p_supplier_id
    AND (sc.variant_id = p_variant_id OR sc.variant_id IS NULL)
    AND hotel_is_in_user_scope(sc.hotel_id)
  ORDER BY (sc.variant_id IS NOT NULL) DESC,
           sc.contract_start DESC NULLS LAST, sc.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contract_terms(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contract_terms(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_contract_terms(uuid, uuid) IS
  'The agreed terms for a variant from a supplier, with the document they were read from when one exists. A term an agent can cite beats a number it cannot source.';

-- ── Assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE missing text; n_doc_links int; v_rule text;
BEGIN
  SELECT string_agg(edge_type, ', ') INTO missing FROM unprojected_link_types();
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 302: registered but not projected: %', missing;
  END IF;

  -- Something in the ontology must now point AT a document.
  SELECT count(*) INTO n_doc_links
  FROM link_types lt JOIN object_types t ON t.id = lt.target_object_type_id
  WHERE t.api_name = 'document';
  IF n_doc_links = 0 THEN
    RAISE EXCEPTION 'Migration 302: still nothing links to a document';
  END IF;

  -- Provenance must not cascade. Invariant 4 enforces this globally; assert it
  -- here too because this is precisely the column shape it was written for.
  SELECT confdeltype::text INTO v_rule
  FROM pg_constraint c
  WHERE c.conrelid = 'public.supplier_contracts'::regclass AND c.contype = 'f'
    AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid = 'public.supplier_contracts'::regclass
                            AND attname = 'document_id')];
  IF v_rule <> 'n' THEN
    RAISE EXCEPTION 'Migration 302: document_id delete rule is %, expected SET NULL', v_rule;
  END IF;

  RAISE NOTICE 'Migration 302: evidenced_by projected · % link type(s) now target a document', n_doc_links;
END $$;

COMMIT;
