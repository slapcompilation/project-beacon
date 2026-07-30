-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 258 — a join table per relationship that has no foreign key.
--
-- Foundry allows a datasource to back exactly ONE link type
-- (Phonograph2:DatasetAndBranchAlreadyRegistered), so these seven cannot share
-- relationship_edges. Each gets its own table, its own link type registration,
-- and — because each table now serves one typed relationship — REAL FOREIGN KEYS
-- to both endpoints, which the polymorphic table could never have.
--
-- That is the substantive gain: relationship_edges stores source_id/target_id as
-- bare uuids with a text discriminator, so nothing stops an edge pointing at a
-- row that does not exist. These tables cannot hold a dangling link.
--
-- Metadata is deliberately not carried across. The audit found that every
-- payload restated a column of one endpoint or was a seeding marker; Foundry's
-- test for an object-backed link ("the relationship carries its own metadata")
-- is met by none of them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  r record;
  tbl text;
  moved int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- edge_type,                src type,     src table,        tgt type,          tgt table,        cardinality
      ('causes',                  'pos_sale',   'pos_sales',      'stock_log',       'stock_logs',      'many_to_many'),
      ('influenced_by_occupancy', 'stock_log',  'stock_logs',     'occupancy_log',   'occupancy_logs',  'many_to_one'),
      ('influenced_by_principle', 'proposal',   'proposals',      'principle',       'principles',      'many_to_many'),
      ('mentions',                'chunk',      'document_chunks','entity',          'entities',        'many_to_many'),
      ('linked_to_po',            'restock_request','restock_requests','purchase_order','purchase_orders','many_to_one'),
      ('triggered_alert',         'stock_log',  'stock_logs',     'alert',           'notifications',   'many_to_one'),
      ('log_fulfills_request',    'stock_log',  'stock_logs',     'restock_request', 'restock_requests','many_to_one')
    ) AS t(edge_type, src_type, src_table, tgt_type, tgt_table, cardinality)
  LOOP
    tbl := 'link_' || r.edge_type;

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.%I (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
        hotel_id        uuid REFERENCES hotels(id) ON DELETE CASCADE,
        source_id       uuid NOT NULL REFERENCES public.%I(id) ON DELETE CASCADE,
        target_id       uuid NOT NULL REFERENCES public.%I(id) ON DELETE CASCADE,
        created_at      timestamptz NOT NULL DEFAULT now(),
        UNIQUE (source_id, target_id)
      )$f$, tbl, r.src_table, r.tgt_table);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (source_id)', 'idx_' || tbl || '_src', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (target_id)', 'idx_' || tbl || '_tgt', tbl);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "read links in scope" ON public.%I', tbl);
    EXECUTE format($f$
      CREATE POLICY "read links in scope" ON public.%I FOR SELECT TO authenticated
      USING (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))$f$, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "write links in scope" ON public.%I', tbl);
    EXECUTE format($f$
      CREATE POLICY "write links in scope" ON public.%I FOR ALL TO authenticated
      USING (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
      WITH CHECK (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))$f$, tbl);

    -- Copy the edges, skipping any whose endpoint no longer exists — the
    -- polymorphic table allowed dangling ids, and the new FKs will not.
    EXECUTE format($f$
      INSERT INTO public.%I (hotel_id, source_id, target_id, created_at)
      SELECT e.hotel_id, e.source_id, e.target_id, e.created_at
      FROM relationship_edges e
      WHERE e.edge_type = %L
        AND EXISTS (SELECT 1 FROM public.%I s WHERE s.id = e.source_id)
        AND EXISTS (SELECT 1 FROM public.%I t WHERE t.id = e.target_id)
      ON CONFLICT (source_id, target_id) DO NOTHING$f$,
      tbl, r.edge_type, r.src_table, r.tgt_table);
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE '% -> % : % links', r.edge_type, tbl, moved;

    -- Register the link type over its own backing.
    EXECUTE format($f$
      INSERT INTO public.link_types
        (organization_id, source_object_type_id, target_object_type_id,
         api_name, label, target_api_name, target_label, source_api_name, source_label,
         cardinality, backing_kind, backing_table, kind, edge_type, created_by_user_id)
      SELECT o.id, s.id, t.id, %L, %L, %L, %L, %L, %L, %L, 'join_table', %L, 'builtin', %L,
             coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                      '00000000-0000-0000-0000-000000000000'::uuid)
      FROM organizations o
      JOIN public.object_types s ON s.organization_id = o.id AND s.api_name = %L AND s.kind = 'builtin'
      JOIN public.object_types t ON t.organization_id = o.id AND t.api_name = %L AND t.kind = 'builtin'
      ON CONFLICT (organization_id, api_name) DO NOTHING$f$,
      r.edge_type, initcap(replace(r.edge_type,'_',' ')),
      r.edge_type, initcap(replace(r.edge_type,'_',' ')),
      r.src_type || 's', initcap(replace(r.src_type,'_',' ')) || 's',
      r.cardinality, tbl, r.edge_type, r.src_type, r.tgt_type);
  END LOOP;
END $$;

COMMIT;
