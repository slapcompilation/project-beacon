-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 303 — the grandfathered seven, and a correction to why they waited.
--
-- 293 grandfathered ten domain tables and I justified the remainder as "mostly
-- empty; typing an empty table means guessing its shape". The contracts arc
-- disproved that heuristic: supplier_contracts was EMPTY and its shape was
-- perfectly settled, because a UI and two RPCs already defined it.
--
-- The right test is whether a CONSUMER has settled the shape, not whether rows
-- exist. Re-checked on that basis, the remaining seven look very different:
--
--   categories           37 web files · self-hierarchy · products.category_id
--   shift_handovers       4 web files
--   stocktake_sessions    2 web files · commit_stocktake, get_stocktake_variance
--   stocktake_lines       2 web files · session_id + variant_id, a clean chain
--   pick_lists            1 web file  · its ITEMS are already typed (263)
--   gl_account_mappings   1 web file  · upsert_gl_mapping
--   budget_allocations    0 web files · but FK'd to categories
--
-- My recorded reason for `categories` — "superseded in practice by product and
-- variant naming" — was simply wrong. It has thirty-seven consumers and carries
-- the FK that classifies every product.
--
-- WHAT THIS FIXES BEYOND TIDINESS:
--
--   • belongs_to_session is IN the vocabulary and UNREGISTERED — it has been
--     falling through to the generic store. It backs stocktake_lines.session_id.
--   • product -> category is a real relationship with 37 consumers that the
--     ontology could not see, so "which categories is this supplier's stock
--     concentrated in" was not expressible as a traversal.
--   • pick_list_item was typed in 263 and its PARENT was not — the same
--     half-typed chain the PO lines had, mirrored.
--
-- NOT REGISTERED, deliberately: categories.parent_id. The self-hierarchy has
-- FOUR rows and NONE has a parent, so the shape of a category tree here is a
-- guess. The FK stays; the link waits for a tree that exists.
--
-- Tenancy and authorship columns (hotel_id, created_by, assigned_to) are not
-- edges. That decision was made when the edge audit removed 35 such pushes.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Seven object types ────────────────────────────────────────────────────

INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, t.api_name, t.label, t.icon, t.description, '[]'::jsonb, 'builtin', t.source_table,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('stocktake_session',  'Stocktake Session',  'clipboard',    'A counting round: what was counted, by whom, when.',        'stocktake_sessions'),
  ('stocktake_line',     'Stocktake Line',     'th-list',      'One counted variant in a session, with its variance.',      'stocktake_lines'),
  ('pick_list',          'Pick List',          'list-columns', 'A set of items to be picked, assigned to somebody.',        'pick_lists'),
  ('shift_handover',     'Shift Handover',     'exchange',     'What one shift told the next.',                             'shift_handovers'),
  ('budget_allocation',  'Budget Allocation',  'bank-account', 'Money allotted to a category for a period.',                'budget_allocations'),
  ('gl_account_mapping', 'GL Account Mapping', 'key',          'How a movement maps onto a general-ledger account.',        'gl_account_mappings'),
  ('category',           'Category',           'folder-close', 'How products are grouped. Carries the FK every product classifies by.', 'categories')
) AS t(api_name, label, icon, description, source_table)
ON CONFLICT (organization_id, api_name) DO NOTHING;

UPDATE public.object_types t
   SET properties = public.derive_object_type_properties(t.source_table), updated_at = now()
 WHERE t.kind = 'builtin' AND t.source_table IS NOT NULL AND jsonb_array_length(t.properties) = 0;

-- ── 2. Vocabulary ────────────────────────────────────────────────────────────
-- belongs_to_session is already present and merely unregistered; the other four
-- are new.

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
    'contracted_with','contract_covers','evidenced_by',
    -- 303
    'counts_variant','item_of','categorised_as','allocated_to'
  ));

-- ── 3. Five links, each over a foreign key that already exists ──────────────

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type,
   backing_hotel_column, backing_time_column, created_by_user_id)
SELECT o.id, s.id, t.id, v.edge_type, v.label, v.tgt_api, v.tgt_label, v.src_api, v.src_label,
       'many_to_one', 'foreign_key', v.backing_table, v.backing_column, 'builtin', v.edge_type,
       v.hotel_col, v.time_col,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('belongs_to_session','Belongs To Session','stocktake_line','stocktake_session','session','Session','lines','Lines','stocktake_lines','session_id','hotel_id',NULL),
  ('counts_variant',    'Counts Variant',    'stocktake_line','variant',          'variant','Variant','countedOn','Counted On','stocktake_lines','variant_id','hotel_id',NULL),
  ('item_of',           'Item Of',           'pick_list_item','pick_list',        'pickList','Pick List','items','Items','pick_list_items','pick_list_id',NULL,NULL),
  ('categorised_as',    'Categorised As',    'product',       'category',         'category','Category','products','Products','products','category_id','hotel_id','created_at'),
  ('allocated_to',      'Allocated To',      'budget_allocation','category',      'category','Category','allocations','Allocations','budget_allocations','category_id','hotel_id',NULL)
) AS v(edge_type, label, src_type, tgt_type, tgt_api, tgt_label, src_api, src_label,
       backing_table, backing_column, hotel_col, time_col)
JOIN public.object_types s ON s.api_name = v.src_type AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = v.tgt_type AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

SELECT public.rebuild_relationship_edges_view();

-- ── 4. The ratchet reaches zero ─────────────────────────────────────────────

UPDATE public.shape_registry
   SET classification = 'domain', reason = 'reached by the ontology (303)'
 WHERE object_kind = 'table' AND classification = 'domain_untyped';

UPDATE public.shape_registry
   SET reason = (SELECT count(*)::text FROM shape_registry WHERE classification = 'domain_untyped')
 WHERE object_kind = 'meta' AND object_name = 'domain_untyped_baseline';

-- ── 5. Assertions ───────────────────────────────────────────────────────────

DO $$
DECLARE missing text; n_links int; n_untyped int; n_types int;
BEGIN
  SELECT count(*) INTO n_types FROM object_types
   WHERE kind='builtin' AND api_name IN
     ('stocktake_session','stocktake_line','pick_list','shift_handover',
      'budget_allocation','gl_account_mapping','category');
  IF n_types <> 7 THEN
    RAISE EXCEPTION 'Migration 303: expected 7 new object types, found %', n_types;
  END IF;

  -- Every link must have found both endpoints; ON CONFLICT DO NOTHING would
  -- otherwise hide a typo in an api_name as a silently missing relationship.
  SELECT count(*) INTO n_links FROM link_types
   WHERE edge_type IN ('belongs_to_session','counts_variant','item_of','categorised_as','allocated_to');
  IF n_links <> 5 THEN
    RAISE EXCEPTION 'Migration 303: expected 5 links registered, found % — an endpoint api_name did not resolve', n_links;
  END IF;

  SELECT string_agg(edge_type, ', ') INTO missing FROM unprojected_link_types();
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 303: registered but not projected: %', missing;
  END IF;

  SELECT count(*) INTO n_untyped FROM shape_registry WHERE classification = 'domain_untyped';
  IF n_untyped <> 0 THEN
    RAISE EXCEPTION 'Migration 303: expected the grandfathered set to reach 0, found %', n_untyped;
  END IF;

  RAISE NOTICE 'Migration 303: 7 types, 5 links · grandfathered 7 -> 0';
END $$;

COMMIT;
