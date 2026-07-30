-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 256 — link_types takes Foundry's shape, and the FK-backed
-- relationships are registered against the columns that already hold them.
--
-- Foundry (link-types-overview): "A link type is bidirectional: it always has two
-- SIDES, one for each of the two object types it relates. Each side ... has its
-- own display name and API name." And: "Creating a single link type ... does not
-- implicitly create a second, reverse link type."
--
-- Ours was single-directional with one api_name, which is why relationship_edges
-- grew reverse pairs by hand. One link type, two named sides, no reverse row.
--
-- Backing follows cardinality mechanically (create-link-type):
--   one-to-one / many-to-one  -> object type foreign keys
--   many-to-many              -> join table dataset
--   many-to-one, extended     -> backing object type
--
-- STAGED DELIBERATELY. This registers only the FK-backed relationships, whose
-- backing column already exists, so it adds no storage. The relationships with no
-- FK need a join table each — Foundry allows a datasource to back exactly one
-- link type (Phonograph2:DatasetAndBranchAlreadyRegistered), so they cannot share
-- relationship_edges — and that is the next migration.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The two sides, cardinality, and the backing ───────────────────────────

ALTER TABLE public.link_types
  -- Traversing source -> target, named from the SOURCE's perspective ("a Flight's
  -- assignedAircraft"). The existing api_name/label are exactly this side.
  ADD COLUMN IF NOT EXISTS target_api_name text,
  ADD COLUMN IF NOT EXISTS target_label    text,
  -- Traversing target -> source, named from the TARGET's perspective ("an
  -- Aircraft's flights"). This is the side we never had.
  ADD COLUMN IF NOT EXISTS source_api_name text,
  ADD COLUMN IF NOT EXISTS source_label    text,
  ADD COLUMN IF NOT EXISTS cardinality  text,
  ADD COLUMN IF NOT EXISTS backing_kind text,
  ADD COLUMN IF NOT EXISTS backing_table  text,
  ADD COLUMN IF NOT EXISTS backing_column text,
  ADD COLUMN IF NOT EXISTS backing_object_type_id uuid REFERENCES public.object_types(id) ON DELETE RESTRICT,
  -- Code-owned registrations vs operator-authored links, mirroring object_types.
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'authored',
  -- The relationship_edges edge_type this link type describes, while both exist.
  ADD COLUMN IF NOT EXISTS edge_type text;

-- Carry the existing single-sided row onto the new shape. Authored links are
-- backed by object_links, which is a join table in Foundry's terms.
UPDATE public.link_types
   SET target_api_name = coalesce(target_api_name, api_name),
       target_label    = coalesce(target_label, label),
       cardinality     = coalesce(cardinality, 'many_to_many'),
       backing_kind    = coalesce(backing_kind, 'join_table'),
       backing_table   = coalesce(backing_table, 'object_links')
 WHERE target_api_name IS NULL OR cardinality IS NULL;

ALTER TABLE public.link_types
  ADD CONSTRAINT link_types_cardinality_check CHECK (
    cardinality IN ('one_to_one','one_to_many','many_to_one','many_to_many')),
  ADD CONSTRAINT link_types_kind_check CHECK (kind IN ('authored','builtin')),
  -- Cardinality picks the backing, and each backing needs its own coordinates.
  ADD CONSTRAINT link_types_backing_check CHECK (
    (backing_kind = 'foreign_key'   AND backing_table IS NOT NULL AND backing_column IS NOT NULL)
 OR (backing_kind = 'join_table'    AND backing_table IS NOT NULL)
 OR (backing_kind = 'object_backed' AND backing_object_type_id IS NOT NULL));

COMMENT ON COLUMN public.link_types.target_api_name IS
  'Side traversed source -> target, named from the source''s perspective. Foundry: each side of a link type has its own API name; there is no separate reverse link type.';
COMMENT ON COLUMN public.link_types.source_api_name IS
  'Side traversed target -> source, named from the target''s perspective.';
COMMENT ON COLUMN public.link_types.backing_kind IS
  'foreign_key | join_table | object_backed. Chosen by cardinality, per Foundry create-link-type. A datasource backs exactly one link type.';

-- Foundry: a side's API name must "be unique across all link types associated
-- with the same object type". Enforced here org-wide on the link type's api_name,
-- which is stricter and simpler, and gives the registration below something to
-- conflict on so re-running is safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_types_org_api_name
  ON public.link_types (organization_id, api_name);

-- ── 2. Register the FK-backed relationships ──────────────────────────────────
-- Every one of these already has its backing column; nothing is created here.

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type, created_by_user_id)
SELECT o.id, s.id, t.id,
       v.target_api_name, v.target_label, v.target_api_name, v.target_label,
       v.source_api_name, v.source_label,
       v.cardinality, 'foreign_key', v.backing_table, v.backing_column, 'builtin', v.edge_type,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
CROSS JOIN (VALUES
  -- source type,          target type,             target side,        target label,        source side,       source label,        cardinality,    backing table,           backing column,          edge_type
  ('stock_log',       'variant',              'variant',          'Variant',           'stockLogs',       'Stock Logs',        'many_to_one',  'stock_logs',            'variant_id',            'consumes'),
  ('variant',         'supplier',             'defaultSupplier',  'Default Supplier',  'variants',        'Variants',          'many_to_one',  'product_variants',      'default_supplier_id',   'sourced_from'),
  ('variant',         'restock_request',      'restockRequests',  'Restock Requests',  'variant',         'Variant',           'one_to_many',  'restock_requests',      'variant_id',            'restocks'),
  ('restock_request', 'user',                 'approvedBy',       'Approved By',       'approvedRequests','Approved Requests', 'many_to_one',  'restock_requests',      'approved_by',           'approved_by'),
  ('restock_receive', 'restock_request',      'request',          'Request',           'receipts',        'Receipts',          'many_to_one',  'restock_receives',      'request_id',            'fulfills'),
  ('purchase_order',  'po_invoice',           'invoices',         'Invoices',          'purchaseOrder',   'Purchase Order',    'one_to_many',  'po_invoices',           'po_id',                 'invoiced_by'),
  ('product_batch',   'variant',              'variant',          'Variant',           'batches',         'Batches',           'many_to_one',  'product_batches',       'variant_id',            'batch_of'),
  ('proposal',        'forecast_observation', 'forecasts',        'Forecasts',         'proposal',        'Proposal',          'one_to_many',  'forecast_observations', 'proposal_id',           'derived_from'),
  ('document',        'chunk',                'chunks',           'Chunks',            'document',        'Document',          'one_to_many',  'document_chunks',       'document_id',           'cited_in'),
  ('stock_log',       'stock_log',            'reverts',          'Reverts',           'revertedBy',      'Reverted By',       'many_to_one',  'stock_logs',            'revert_of',             'reverts')
) AS v(source_api, target_api, target_api_name, target_label, source_api_name, source_label, cardinality, backing_table, backing_column, edge_type)
JOIN public.object_types s ON s.organization_id = o.id AND s.api_name = v.source_api AND s.kind = 'builtin'
JOIN public.object_types t ON t.organization_id = o.id AND t.api_name = v.target_api AND t.kind = 'builtin'
ON CONFLICT (organization_id, api_name) DO NOTHING;

COMMIT;
