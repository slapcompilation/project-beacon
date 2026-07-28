-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 230 — G4: the first interface over BUILT-IN types.
--
-- This is what G1–G3 were for. `assert_interface_conformance` (224) never had a
-- `kind` restriction: built-in types satisfied no interface purely because their
-- `properties` were `[]`. G2 derived them, so a real shared shape can now be
-- named across the operational domain.
--
-- Perishable is not contrived — product_variants and product_batches genuinely
-- both carry expiry_date, lot_number and status. `product` is deliberately NOT
-- an implementer: it has shelf_life_days but no expiry_date, so the trigger
-- refuses it, which is the rule doing its job on code-owned types.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.ontology_interfaces
  (organization_id, api_name, label, description, properties, created_by_user_id)
SELECT o.id, 'perishable', 'Perishable',
       'Anything that expires and carries a lot number.',
       '[{"key":"expiry_date","label":"Expiry date","type":"date"},
         {"key":"lot_number","label":"Lot number","type":"text"},
         {"key":"status","label":"Status","type":"text"}]'::jsonb,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;

-- Conformance is checked by the trigger; a type without the shape is refused.
INSERT INTO public.object_type_interfaces (object_type_id, interface_id, organization_id)
SELECT t.id, i.id, t.organization_id
FROM public.object_types t
JOIN public.ontology_interfaces i
  ON i.organization_id = t.organization_id AND i.api_name = 'perishable'
WHERE t.kind = 'builtin' AND t.api_name IN ('variant', 'product_batch')
ON CONFLICT DO NOTHING;

-- One tool, one definition, answering across every implementer — including any
-- type that implements Perishable later.
INSERT INTO public.user_tools
  (organization_id, name, api_name, description, subject_type_id, subject_interface_id,
   parameters, filters, aggregation, created_by_user_id)
SELECT o.id, 'Perishables expiring by', 'perishables_expiring_by',
       'Count of every Perishable where Expiry date is at or below {before}',
       NULL, (SELECT id FROM public.ontology_interfaces WHERE organization_id = o.id AND api_name = 'perishable'),
       '[{"key":"before","label":"Expiring before","type":"date","required":true}]'::jsonb,
       '[{"property":"expiry_date","op":"lte","value":"","param":"before"}]'::jsonb,
       '{"fn":"count"}'::jsonb,
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
ON CONFLICT (organization_id, api_name) DO NOTHING;
