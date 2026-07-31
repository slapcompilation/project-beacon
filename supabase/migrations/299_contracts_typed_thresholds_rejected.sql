-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 299 — contracts join the ontology; SQL threshold-learning does not.
--
-- Both were left "awaiting a consumer" in 298. Tested against the stage
-- directive rather than picked by interest, they came out opposite ways.
--
-- ══ CONTRACTS: accept ═══════════════════════════════════════════════════════
--
-- The system already has all of this and none of it meets:
--
--   supplier_contracts     table with supplier_id + variant_id foreign keys
--   get_supplier_contracts / upsert_supplier_contract   RPCs
--   ContractsPage.tsx      a full authoring UI
--   get_contract_price     a price lookup, called by nothing
--
-- and meanwhile all three agent prompts instruct the model to go read contract
-- terms out of PROSE — "price clauses, lead-time SLAs, exclusivity windows",
-- "supplier minimum-holding clause", "no-return clause" — via
-- query_variant_documents.
--
-- So an operator can type a contracted price into the Contracts page and the
-- restock advisor will still open a PDF and guess at it. That is not a missing
-- feature; it is two halves of one capability that cannot see each other, and
-- typing the contract is what lets a decision READ a term instead of scraping
-- one.
--
-- Foundry has no "contract" primitive because a contract is domain data, not
-- platform. What Foundry does have is the shape: a real-world thing becomes an
-- object type with links, reached by functions (functions-on-models,
-- ontology-backed). A supplier agreement is about as ontologizable as domain
-- data gets — parties, terms, a validity window — and it is exactly what a
-- hospitality group would expect their system to know.
--
-- ══ THRESHOLD LEARNING: reject ══════════════════════════════════════════════
--
-- update_learned_thresholds writes per-variant learned parameters — alert days,
-- restock multiplier, a confidence — derived from operator dismissals and
-- approvals. That is a MODEL.
--
-- Foundry's shape for a model is objective -> deployment -> function, reached
-- "in the context of the Ontology by using functions that invoke models".
-- CLAUDE.md mirrors it exactly: objectives/<name>/adapter.ts behind
-- runInference(), an eval suite, release stages, and "no code anywhere talks to
-- a model directly". This function has no objective, no adapter, no eval, no
-- release stage, and nothing reads its confidence.
--
-- Worse, it competes with a decision already made. The monitors pattern is a
-- deterministic metric in code plus a TUNABLE TRIGGER the operator owns in
-- org_policy. A learned per-variant threshold is a second source of truth for
-- the same number, and nothing says which wins.
--
-- And CLAUDE.md admits a model only "when a deterministic baseline gets beaten
-- by a trained model on the eval set". No such evidence exists. Building this
-- would be adopting a model because the table was already there.
--
-- The wrongly-shaped writer goes. variant_learned_thresholds STAYS: the
-- proposal-quality briefing counts rows in it, and that count is honestly zero
-- rather than broken. If per-variant thresholds are ever justified, they arrive
-- as a modelling objective behind the adapter seam.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Contracts: the object type ───────────────────────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, 'supplier_contract', 'Supplier Contract', 'endorsed',
       'An agreed price and minimum order for one variant from one supplier, valid between two dates.',
       '[]'::jsonb, 'builtin', 'supplier_contracts',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── Two names in the vocabulary ──────────────────────────────────────────────

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
    -- 299: supplier agreements
    'contracted_with','contract_covers'
  ));

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type,
   backing_hotel_column, backing_time_column, created_by_user_id)
SELECT o.id, s.id, t.id, v.edge_type, v.label, v.tgt_api, v.tgt_label, v.src_api, v.src_label,
       'many_to_one', 'foreign_key', 'supplier_contracts', v.backing_column, 'builtin', v.edge_type,
       'hotel_id', 'created_at',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('contracted_with',  'Contracted With',  'supplier_contract', 'supplier', 'supplier', 'Supplier', 'contracts',      'Contracts',       'supplier_id'),
  ('contract_covers',  'Contract Covers',  'supplier_contract', 'variant',  'variant',  'Variant',  'variantContracts','Variant Contracts','variant_id')
) AS v(edge_type, label, src_type, tgt_type, tgt_api, tgt_label, src_api, src_label, backing_column)
JOIN public.object_types s ON s.api_name = v.src_type AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = v.tgt_type AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

-- The generator earns its keep: registering a link is now a row plus a call,
-- with no hand-copied view body. This is the first link added since 295.
SELECT public.rebuild_relationship_edges_view();

-- ── Threshold learning: the wrongly-shaped writer goes ───────────────────────

DROP FUNCTION IF EXISTS public.update_learned_thresholds(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.update_learned_thresholds();

DELETE FROM public.shape_registry
 WHERE object_kind = 'function' AND object_name = 'update_learned_thresholds';

-- ── The ratchet moves again ──────────────────────────────────────────────────

UPDATE public.shape_registry
   SET classification = 'domain', reason = 'reached by the ontology (299)'
 WHERE object_kind = 'table' AND object_name = 'supplier_contracts';

UPDATE public.shape_registry
   SET reason = (SELECT count(*)::text FROM shape_registry WHERE classification = 'domain_untyped')
 WHERE object_kind = 'meta' AND object_name = 'domain_untyped_baseline';

-- ── Assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE n_untyped int; missing text; alive int;
BEGIN
  -- Both new links must be in the regenerated view, or they are registrations
  -- rather than relationships.
  SELECT string_agg(edge_type, ', ') INTO missing FROM unprojected_link_types();
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 299: link(s) registered but not projected: %', missing;
  END IF;

  SELECT count(*) INTO alive FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_learned_thresholds';
  IF alive > 0 THEN
    RAISE EXCEPTION 'Migration 299: update_learned_thresholds survived the drop';
  END IF;

  SELECT count(*) INTO n_untyped FROM shape_registry WHERE classification = 'domain_untyped';
  IF n_untyped <> 7 THEN
    RAISE EXCEPTION 'Migration 299: expected 7 grandfathered tables, found %', n_untyped;
  END IF;
  RAISE NOTICE 'Migration 299: supplier_contract typed · thresholds rejected · grandfathered 8 -> %', n_untyped;
END $$;

COMMIT;
