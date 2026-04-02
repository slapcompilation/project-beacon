-- Migration 057: Floor Layer — Pending Scans (Ghost Entry Resolution)
-- Layer: Floor
-- When a barcode scan finds no matching product, floor staff can log it as a
-- pending scan rather than blocking their workflow. Managers resolve ghost
-- entries by linking them to the correct variant or marking them skipped.

SET search_path = public;

CREATE TABLE pending_scans (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  scanned_code        text        NOT NULL,
  location_id         uuid        REFERENCES locations(id) ON DELETE SET NULL,
  approx_quantity     integer     CHECK (approx_quantity IS NULL OR approx_quantity > 0),
  notes               text,
  resolved_variant_id uuid        REFERENCES product_variants(id) ON DELETE SET NULL,
  status              text        NOT NULL DEFAULT 'unresolved'
    CONSTRAINT pending_scan_status_check
    CHECK (status IN ('unresolved', 'resolved', 'skipped')),
  created_by          uuid        REFERENCES users(id) ON DELETE SET NULL,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pending_scans IS 'Barcodes scanned on the floor that did not resolve to a known variant. Managers review and link or dismiss.';

ALTER TABLE pending_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_hotel_isolation ON pending_scans
  FOR ALL USING (hotel_id = auth_hotel_id());

CREATE INDEX idx_pending_scans_hotel_status ON pending_scans (hotel_id, status, created_at DESC);

-- ─── record_pending_scan() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_pending_scan(
  p_scanned_code    text,
  p_location_id     uuid    DEFAULT NULL,
  p_approx_quantity integer DEFAULT NULL,
  p_notes           text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO pending_scans (hotel_id, scanned_code, location_id, approx_quantity, notes, created_by)
  VALUES (auth_hotel_id(), p_scanned_code, p_location_id, p_approx_quantity, p_notes, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_pending_scan(text, uuid, integer, text) TO authenticated;

-- ─── resolve_pending_scan() ───────────────────────────────────────────────────
-- Links a ghost entry to a variant and optionally writes the barcode back onto
-- the variant so future scans resolve automatically.

CREATE OR REPLACE FUNCTION resolve_pending_scan(
  p_scan_id       uuid,
  p_variant_id    uuid,
  p_update_barcode boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT scanned_code INTO v_code
  FROM pending_scans
  WHERE id = p_scan_id AND hotel_id = auth_hotel_id() AND status = 'unresolved';

  IF NOT FOUND THEN RAISE EXCEPTION 'Pending scan not found or already resolved'; END IF;

  UPDATE pending_scans
  SET status = 'resolved', resolved_variant_id = p_variant_id, resolved_at = now()
  WHERE id = p_scan_id;

  -- Optionally backfill barcode on the variant so future scans auto-resolve
  IF p_update_barcode THEN
    UPDATE product_variants
    SET barcode = v_code
    WHERE id = p_variant_id
      AND hotel_id IN (SELECT hotel_id FROM products WHERE id = product_id)
      AND (barcode IS NULL OR barcode = '');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_pending_scan(uuid, uuid, boolean) TO authenticated;

-- ─── skip_pending_scan() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION skip_pending_scan(p_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pending_scans
  SET status = 'skipped', resolved_at = now()
  WHERE id = p_scan_id AND hotel_id = auth_hotel_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending scan not found'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION skip_pending_scan(uuid) TO authenticated;

-- ─── get_pending_scans() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pending_scans()
RETURNS TABLE (
  id              uuid,
  scanned_code    text,
  location_id     uuid,
  location_name   text,
  approx_quantity integer,
  notes           text,
  status          text,
  created_at      timestamptz,
  created_by_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.id,
    ps.scanned_code,
    ps.location_id,
    l.name AS location_name,
    ps.approx_quantity,
    ps.notes,
    ps.status,
    ps.created_at,
    u.email AS created_by_email
  FROM pending_scans ps
  LEFT JOIN locations l ON l.id = ps.location_id
  LEFT JOIN users u ON u.id = ps.created_by
  WHERE ps.hotel_id = auth_hotel_id()
  ORDER BY
    CASE ps.status WHEN 'unresolved' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
    ps.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_pending_scans() TO authenticated;
