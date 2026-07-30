-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 261 — link-type API names are unique PER OBJECT TYPE, not per org.
--
-- Foundry (create-link-type), on a side's API name:
--   "Be unique across all link types associated with the same object type."
--
-- 256 indexed (organization_id, api_name) instead — stricter than the rule. So
-- `stock_log -> variant` (consumes) claimed the name `variant`, and
-- `product_batch -> variant` (batch_of) collided with it and was silently
-- dropped by ON CONFLICT DO NOTHING. Both are legal in Foundry: they are named
-- from different object types.
--
-- Two mistakes worth naming, because they compounded:
--   1. A limit copied WRONGER THAN THE SOURCE. The stage directive says to copy
--      Foundry's limits because they encode a reason; making one stricter has
--      its own failure mode, and this is it.
--   2. ON CONFLICT DO NOTHING turned a constraint violation into silence. The
--      registration reported success while dropping a link type on the floor.
--
-- The correct rule needs TWO indexes, because each side is named from its own
-- object type's perspective and both are used for traversal.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP INDEX IF EXISTS public.idx_link_types_org_api_name;

-- The side traversed source -> target is named from the SOURCE type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_types_source_side
  ON public.link_types (organization_id, source_object_type_id, target_api_name);

-- The side traversed target -> source is named from the TARGET type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_types_target_side
  ON public.link_types (organization_id, target_object_type_id, source_api_name)
  WHERE source_api_name IS NOT NULL;

-- Recover the link type 256 dropped.
INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type, created_by_user_id)
SELECT o.id, s.id, t.id,
       'batch_of', 'Batch Of', 'variant', 'Variant', 'batches', 'Batches',
       'many_to_one', 'foreign_key', 'product_batches', 'variant_id', 'builtin', 'batch_of',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
JOIN public.object_types s ON s.organization_id = o.id AND s.api_name = 'product_batch' AND s.kind = 'builtin'
JOIN public.object_types t ON t.organization_id = o.id AND t.api_name = 'variant'       AND t.kind = 'builtin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.link_types x
  WHERE x.organization_id = o.id AND x.edge_type = 'batch_of'
);

-- Every relationship that has rows must now have a link type. Fail loudly rather
-- than discovering another silent drop later.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(DISTINCT e.edge_type, ', ') INTO missing
  FROM relationship_edges e
  WHERE NOT EXISTS (SELECT 1 FROM link_types lt WHERE lt.edge_type = e.edge_type);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 261: edge type(s) with rows but no link type: %', missing;
  END IF;
END $$;

COMMIT;
