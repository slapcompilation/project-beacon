-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 223 — one ontology: register the built-in types alongside authored ones
--
-- Foundry's Ontology is "the digital twin of an organization … integrating the
-- organization's digital assets into a coherent whole." Ours was coherent in TWO
-- halves that could not reference each other:
--
--   * built-in types (Variant, Supplier, PurchaseOrder …) existed only as a
--     TypeScript union in reality-graph/src/types.ts
--   * object_types held only what an operator authored
--
-- Because link_types FKs both sides to object_types, a Maintenance Request could
-- never link to a Variant. Because user_tools.subject_type_id FKs to it, an
-- authored tool could never ask about the real operational domain.
--
-- This registers the built-in types as rows. The row is a REGISTRATION, not a
-- definition: code remains the source of truth for their schema and behaviour,
-- and `source_table` records where their records actually live (they are NOT in
-- object_records). `kind` separates the two so surfaces can ask for the half they
-- mean, and so users cannot edit or delete a code-owned type.
--
-- Deliberately partial: the operationally addressable types are registered, not
-- all 33 node types. A registration with no backing table would be a dead node
-- on the canvas. The rest can be added as they gain views.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.object_types
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'authored'
    CHECK (kind IN ('authored','builtin')),
  -- NULL for authored types: their records live in object_records.
  ADD COLUMN IF NOT EXISTS source_table text;

COMMENT ON COLUMN public.object_types.kind IS
  'authored = operator-defined, records in object_records. builtin = code-owned, records in source_table.';

-- Built-in types are org-scoped like everything else, so each org sees its own
-- registration row. Seeded for every existing organization.
INSERT INTO public.object_types
  (organization_id, api_name, label, icon, description, properties, kind, source_table, created_by_user_id)
SELECT o.id, t.api_name, t.label, t.icon, t.description, '[]'::jsonb, 'builtin', t.source_table,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  ('hotel',           'Hotel',            'office',          'A property in the organization.',              'hotels'),
  ('product',         'Product',          'box',             'A stocked product.',                           'products'),
  ('variant',         'Variant',          'cube',            'A specific variant of a product — the unit inventory is counted in.', 'product_variants'),
  ('supplier',        'Supplier',         'truck',           'A vendor the organization orders from.',       'suppliers'),
  ('restock_request', 'Restock Request',  'refresh',         'A request to replenish a variant.',            'restock_requests'),
  ('stock_log',       'Stock Log',        'history',         'An immutable record of a stock movement.',     'stock_logs'),
  ('purchase_order',  'Purchase Order',   'shopping-cart',   'An order placed with a supplier.',             'purchase_orders'),
  ('location',        'Zone',             'map-marker',      'A location within a property.',                'locations'),
  ('product_batch',   'Product Batch',    'layers',          'A batch of stock with its own expiry.',        'product_batches'),
  ('stock_transfer',  'Stock Transfer',   'exchange',        'A lateral move of stock between properties.',  'stock_transfers'),
  ('document',        'Document',         'document',        'An ingested document with page-level provenance.', 'documents'),
  ('proposal',        'Proposal',         'lightbulb',       'A typed action an agent proposed.',            'proposals'),
  ('principle',       'Principle',        'learning',        'Operator feedback that shapes future proposals.', 'principles'),
  ('case',            'Case',             'folder-open',     'A workflow envelope: trigger, proposals, outcome.', 'cases'),
  ('constraint',      'Constraint',       'ban-circle',      'A rule evaluated at action submission.',       'constraints')
) AS t(api_name, label, icon, description, source_table)
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- Code owns built-in types: no user may write them, at any role. The three
-- existing per-command policies keep their exact semantics and gain the guard.
DROP POLICY IF EXISTS "admins author object types" ON public.object_types;
CREATE POLICY "admins author object types" ON public.object_types
  FOR INSERT
  WITH CHECK (
    kind = 'authored'
    AND auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "admins update object types" ON public.object_types;
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE
  USING (
    kind = 'authored'
    AND auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
  )
  WITH CHECK (
    kind = 'authored'
    AND auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
  );

DROP POLICY IF EXISTS "admins delete object types" ON public.object_types;
CREATE POLICY "admins delete object types" ON public.object_types
  FOR DELETE
  USING (
    kind = 'authored'
    AND auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
  );
