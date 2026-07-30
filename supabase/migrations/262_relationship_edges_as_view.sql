-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 262 — relationship_edges becomes a VIEW over the real backings.
--
-- 260 rebuilt the table from the backings and called it a projection. It was a
-- SNAPSHOT: a projection recomputes, a snapshot rots. Meanwhile eight edge types
-- were still being written directly, so the link_* tables — now the real store —
-- were going stale, which C26 was added to catch.
--
-- A view removes the whole class. Every row is computed from the backing that
-- owns it, so drift is not merely detected, it is impossible. All thirteen
-- readers keep working unchanged.
--
-- WRITES ARE THE HARD PART, and they are handled rather than broken:
--   • FK-backed relationships accept the write and DISCARD it — the column is
--     the write, and the row was already true before the insert. Silently
--     correct, not silently lost.
--   • Join-backed relationships route to their link_* table.
--   • Anything not yet backed goes to relationship_edges_store, which is what
--     the old table becomes. That residue is the honest measure of how much of
--     the graph is still un-modelled.
--
-- So the seven writers — create_relationship_edge, the two triggers,
-- commit_stocktake, ingest_pos_sale, seed_demo_world, and the app's
-- edgesForAction — keep working without being touched today.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The old table becomes the residue for relationships with no backing ───

ALTER TABLE public.relationship_edges RENAME TO relationship_edges_store;
ALTER INDEX IF EXISTS relationship_edges_pkey RENAME TO relationship_edges_store_pkey;

COMMENT ON TABLE public.relationship_edges_store IS
  'Residue: edges whose relationship has no link type backing yet. Everything backed is computed by the relationship_edges view. A shrinking row count here is the measure of Tier 2 progress.';

-- Rows for backed relationships are now derived, so storing them would double them.
DELETE FROM public.relationship_edges_store s
 WHERE EXISTS (SELECT 1 FROM public.link_types lt WHERE lt.edge_type = s.edge_type);

-- ── 2. The view ──────────────────────────────────────────────────────────────
-- A stable synthetic id per derived row: readers return it, and it must not
-- change between calls.

CREATE OR REPLACE VIEW public.relationship_edges
WITH (security_invoker = true) AS
  -- Join-table backed (258)
  SELECT md5('causes'||source_id::text||target_id::text)::uuid id, 'causes' edge_type,
         'pos_sale' source_type, source_id, 'stock_log' target_type, target_id,
         hotel_id, 'system'::text triggered_by, NULL::uuid actor_id, '{}'::jsonb metadata, created_at
    FROM public.link_causes
  UNION ALL SELECT md5('influenced_by_occupancy'||source_id::text||target_id::text)::uuid,'influenced_by_occupancy','stock_log',source_id,'occupancy_log',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_influenced_by_occupancy
  UNION ALL SELECT md5('influenced_by_principle'||source_id::text||target_id::text)::uuid,'influenced_by_principle','proposal',source_id,'principle',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_influenced_by_principle
  UNION ALL SELECT md5('mentions'||source_id::text||target_id::text)::uuid,'mentions','chunk',source_id,'entity',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_mentions
  UNION ALL SELECT md5('linked_to_po'||source_id::text||target_id::text)::uuid,'linked_to_po','restock_request',source_id,'purchase_order',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_linked_to_po
  UNION ALL SELECT md5('triggered_alert'||source_id::text||target_id::text)::uuid,'triggered_alert','stock_log',source_id,'alert',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_triggered_alert
  UNION ALL SELECT md5('log_fulfills_request'||source_id::text||target_id::text)::uuid,'log_fulfills_request','stock_log',source_id,'restock_request',target_id,hotel_id,'system',NULL,'{}'::jsonb,created_at FROM public.link_log_fulfills_request

  -- Foreign-key backed (256/261) — the column IS the relationship
  UNION ALL SELECT md5('consumes'||l.id::text||l.variant_id::text)::uuid,'consumes','stock_log',l.id,'variant',l.variant_id,l.hotel_id,'system',NULL,'{}'::jsonb,l.timestamp
    FROM public.stock_logs l WHERE l.variant_id IS NOT NULL
  UNION ALL SELECT md5('reverts'||l.id::text||l.revert_of::text)::uuid,'reverts','stock_log',l.id,'stock_log',l.revert_of,l.hotel_id,'system',NULL,'{}'::jsonb,l.timestamp
    FROM public.stock_logs l WHERE l.revert_of IS NOT NULL
  UNION ALL SELECT md5('sourced_from'||v.id::text||v.default_supplier_id::text)::uuid,'sourced_from','variant',v.id,'supplier',v.default_supplier_id,p.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.default_supplier_id IS NOT NULL
  UNION ALL SELECT md5('restocks'||r.variant_id::text||r.id::text)::uuid,'restocks','variant',r.variant_id,'restock_request',r.id,r.hotel_id,'system',NULL,'{}'::jsonb,r.created_at
    FROM public.restock_requests r WHERE r.variant_id IS NOT NULL
  UNION ALL SELECT md5('approved_by'||r.id::text||r.approved_by::text)::uuid,'approved_by','restock_request',r.id,'user',r.approved_by,r.hotel_id,'system',NULL,'{}'::jsonb,r.created_at
    FROM public.restock_requests r WHERE r.approved_by IS NOT NULL
  UNION ALL SELECT md5('fulfills'||rc.id::text||rc.request_id::text)::uuid,'fulfills','restock_receive',rc.id,'restock_request',rc.request_id,r.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.restock_receives rc JOIN public.restock_requests r ON r.id = rc.request_id
  UNION ALL SELECT md5('invoiced_by'||i.po_id::text||i.id::text)::uuid,'invoiced_by','purchase_order',i.po_id,'po_invoice',i.id,i.hotel_id,'system',NULL,'{}'::jsonb,i.created_at
    FROM public.po_invoices i WHERE i.po_id IS NOT NULL
  UNION ALL SELECT md5('batch_of'||b.id::text||b.variant_id::text)::uuid,'batch_of','product_batch',b.id,'variant',b.variant_id,b.hotel_id,'system',NULL,'{}'::jsonb,now()
    FROM public.product_batches b WHERE b.variant_id IS NOT NULL
  UNION ALL SELECT md5('derived_from'||f.proposal_id::text||f.id::text)::uuid,'derived_from','proposal',f.proposal_id,'forecast_observation',f.id,f.hotel_id,'system',NULL,'{}'::jsonb,f.created_at
    FROM public.forecast_observations f WHERE f.proposal_id IS NOT NULL
  UNION ALL SELECT md5('cited_in'||ch.document_id::text||ch.id::text)::uuid,'cited_in','document',ch.document_id,'chunk',ch.id,ch.hotel_id,'system',NULL,'{}'::jsonb,ch.created_at
    FROM public.document_chunks ch WHERE ch.document_id IS NOT NULL

  -- Not yet backed
  UNION ALL SELECT id, edge_type, source_type, source_id, target_type, target_id,
                   hotel_id, triggered_by, actor_id, metadata, created_at
    FROM public.relationship_edges_store;

COMMENT ON VIEW public.relationship_edges IS
  'Computed from the backing that owns each relationship — link_* tables, foreign key columns, and the residue in relationship_edges_store. Writes are routed by an INSTEAD OF trigger; a write to an FK-backed relationship is discarded because the column already carries it.';

-- ── 3. Writes are routed, not refused ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.relationship_edges_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  lt record;
  link_tbl text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO lt FROM link_types WHERE edge_type = OLD.edge_type LIMIT 1;
    IF lt.backing_kind = 'join_table' THEN
      EXECUTE format('DELETE FROM public.%I WHERE source_id = $1 AND target_id = $2', 'link_' || OLD.edge_type)
        USING OLD.source_id, OLD.target_id;
    ELSIF lt.backing_kind IS NULL THEN
      DELETE FROM relationship_edges_store WHERE id = OLD.id;
    END IF;
    -- An FK-backed relationship is deleted by clearing its column, never here.
    RETURN OLD;
  END IF;

  SELECT * INTO lt FROM link_types WHERE edge_type = NEW.edge_type LIMIT 1;

  IF lt.backing_kind = 'join_table' THEN
    link_tbl := 'link_' || NEW.edge_type;
    EXECUTE format(
      'INSERT INTO public.%I (hotel_id, source_id, target_id) VALUES ($1,$2,$3)
       ON CONFLICT (source_id, target_id) DO NOTHING', link_tbl)
      USING NEW.hotel_id, NEW.source_id, NEW.target_id;
  ELSIF lt.backing_kind = 'foreign_key' THEN
    -- Discarded on purpose: the caller already set the column that carries this
    -- relationship, so the row it is asking for is true before it asks.
    NULL;
  ELSE
    INSERT INTO relationship_edges_store
      (id, edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, actor_id, metadata, created_at)
    VALUES (coalesce(NEW.id, gen_random_uuid()), NEW.edge_type, NEW.source_type, NEW.source_id,
            NEW.target_type, NEW.target_id, NEW.hotel_id, coalesce(NEW.triggered_by,'system'),
            NEW.actor_id, coalesce(NEW.metadata,'{}'::jsonb), coalesce(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.relationship_edges_write() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_relationship_edges_write
  INSTEAD OF INSERT OR DELETE ON public.relationship_edges
  FOR EACH ROW EXECUTE FUNCTION public.relationship_edges_write();

GRANT SELECT, INSERT, DELETE ON public.relationship_edges TO authenticated;

COMMIT;
