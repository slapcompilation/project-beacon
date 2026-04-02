-- Sprint 17: Reality Graph — relationship_edges
-- Every existing entity is an implicit graph node.
-- This table stores explicit directed edges between them,
-- recording causal relationships across the four layers.
--
-- Auto-edges are created by triggers:
--   stock_log  --consumes-->  variant         (every adjustment)
--   stock_log  --reverts-->   stock_log       (undo/correction)
--   restock    --restocks-->  variant         (when fulfilled)
--
-- Manual edges can be inserted by RPCs for higher-layer relationships.

-- ─── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationship_edges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid        NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  source_type text        NOT NULL,
  source_id   uuid        NOT NULL,
  edge_type   text        NOT NULL
              CHECK (edge_type IN (
                'belongs_to_hotel', 'created_by', 'causes',
                'consumes', 'restocks', 'reverts',
                'belongs_to_session', 'triggered_alert'
              )),
  target_type text        NOT NULL,
  target_id   uuid        NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, edge_type, target_id)
);

ALTER TABLE relationship_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON relationship_edges
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON relationship_edges
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_re_source
  ON relationship_edges (hotel_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_re_target
  ON relationship_edges (hotel_id, target_type, target_id);

-- ─── 2. Helper — idempotent edge upsert ──────────────────────────────────────

CREATE OR REPLACE FUNCTION create_relationship_edge(
  p_hotel_id    uuid,
  p_source_type text,
  p_source_id   uuid,
  p_edge_type   text,
  p_target_type text,
  p_target_id   uuid,
  p_metadata    jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO relationship_edges
    (hotel_id, source_type, source_id, edge_type, target_type, target_id, metadata)
  VALUES
    (p_hotel_id, p_source_type, p_source_id, p_edge_type, p_target_type, p_target_id, p_metadata)
  ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
END;
$$;

-- ─── 3. Trigger: stock_log edges ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_stock_log_edges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT p.hotel_id INTO v_hotel_id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.id = NEW.variant_id;

  IF v_hotel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- stock_log --consumes--> variant (every adjustment)
  PERFORM create_relationship_edge(
    v_hotel_id,
    'stock_log', NEW.id,
    'consumes',
    'variant', NEW.variant_id,
    jsonb_build_object('delta', NEW.quantity_change, 'reason', NEW.reason)
  );

  -- stock_log --reverts--> stock_log (undo/correction)
  IF NEW.revert_of IS NOT NULL THEN
    PERFORM create_relationship_edge(
      v_hotel_id,
      'stock_log', NEW.id,
      'reverts',
      'stock_log', NEW.revert_of,
      jsonb_build_object('reason', NEW.reason)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_log_edges
  AFTER INSERT ON stock_logs
  FOR EACH ROW EXECUTE FUNCTION trg_stock_log_edges();

-- ─── 4. Trigger: restock fulfilled edge ───────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_restock_fulfilled_edge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled' AND (OLD.status IS DISTINCT FROM 'fulfilled') THEN
    PERFORM create_relationship_edge(
      NEW.hotel_id,
      'restock_request', NEW.id,
      'restocks',
      'variant', NEW.variant_id,
      jsonb_build_object('quantity_received', NEW.quantity_received)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restock_fulfilled_edge
  AFTER UPDATE ON restock_requests
  FOR EACH ROW EXECUTE FUNCTION trg_restock_fulfilled_edge();

-- ─── 5. get_variant_flow() — query all edges touching a variant ───────────────

CREATE OR REPLACE FUNCTION get_variant_flow(p_variant_id uuid)
RETURNS TABLE (
  id          uuid,
  edge_type   text,
  source_type text,
  source_id   uuid,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.edge_type,
    re.source_type,
    re.source_id,
    re.target_type,
    re.target_id,
    re.metadata,
    re.created_at
  FROM relationship_edges re
  WHERE re.hotel_id = auth_hotel_id()
    AND (
      (re.target_type = 'variant' AND re.target_id = p_variant_id)
      OR (re.source_type = 'variant' AND re.source_id = p_variant_id)
    )
  ORDER BY re.created_at DESC
  LIMIT 200;
END;
$$;
