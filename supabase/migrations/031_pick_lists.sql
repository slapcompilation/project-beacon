-- Pick Lists — Layer: Flow
-- Operators create a list of items needed for a job, event, or service round.
-- A picker works through the list, marking quantities as picked.
-- Stock only deducts when the pick list is committed (commit_pick_list RPC).
-- This mirrors Sortly's Pick Lists feature.

-- ─── 1. pick_lists ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pick_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid        NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  notes       text,
  status      text        NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid        REFERENCES profiles (id) ON DELETE SET NULL,
  due_date    date,
  created_by  uuid        NOT NULL REFERENCES profiles (id),
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pick_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pl_select" ON pick_lists FOR SELECT  USING (hotel_id = auth_hotel_id());
CREATE POLICY "pl_insert" ON pick_lists FOR INSERT  WITH CHECK (hotel_id = auth_hotel_id());
CREATE POLICY "pl_update" ON pick_lists FOR UPDATE  USING (hotel_id = auth_hotel_id());
CREATE POLICY "pl_delete" ON pick_lists FOR DELETE  USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_pick_lists_hotel ON pick_lists (hotel_id, status, created_at DESC);

-- ─── 2. pick_list_items ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pick_list_items (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id     uuid    NOT NULL REFERENCES pick_lists (id) ON DELETE CASCADE,
  variant_id       uuid    NOT NULL REFERENCES product_variants (id),
  quantity_planned integer NOT NULL CHECK (quantity_planned > 0),
  quantity_picked  integer NOT NULL DEFAULT 0 CHECK (quantity_picked >= 0),
  notes            text,
  picked_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pick_list_id, variant_id)
);

ALTER TABLE pick_list_items ENABLE ROW LEVEL SECURITY;

-- RLS through the parent pick_list's hotel_id
CREATE POLICY "pli_select" ON pick_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND pl.hotel_id = auth_hotel_id()
  ));
CREATE POLICY "pli_insert" ON pick_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND pl.hotel_id = auth_hotel_id()
  ));
CREATE POLICY "pli_update" ON pick_list_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND pl.hotel_id = auth_hotel_id()
  ));
CREATE POLICY "pli_delete" ON pick_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pick_lists pl
    WHERE pl.id = pick_list_id AND pl.hotel_id = auth_hotel_id()
  ));

CREATE INDEX IF NOT EXISTS idx_pli_list_id ON pick_list_items (pick_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_variant_id ON pick_list_items (variant_id);

-- ─── 3. commit_pick_list() — deducts stock for all picked items ───────────────

CREATE OR REPLACE FUNCTION commit_pick_list(p_pick_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid;
  v_item     RECORD;
BEGIN
  -- Auth check
  SELECT hotel_id INTO v_hotel_id
  FROM pick_lists
  WHERE id = p_pick_list_id AND hotel_id = auth_hotel_id();

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Pick list not found or not authorized';
  END IF;

  -- Deduct stock for each picked item
  FOR v_item IN
    SELECT pli.variant_id, pli.quantity_picked
    FROM pick_list_items pli
    WHERE pli.pick_list_id = p_pick_list_id AND pli.quantity_picked > 0
  LOOP
    INSERT INTO stock_logs (variant_id, quantity_change, reason, created_by)
    VALUES (
      v_item.variant_id,
      -v_item.quantity_picked,
      'Pick list: ' || (SELECT name FROM pick_lists WHERE id = p_pick_list_id),
      auth.uid()
    );
  END LOOP;

  -- Mark as completed
  UPDATE pick_lists
  SET status = 'completed', completed_at = now()
  WHERE id = p_pick_list_id;
END;
$$;

-- ─── 4. Enable realtime on pick_lists ─────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE pick_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE pick_list_items;
