-- Sprint 16: Stocktake sessions
-- Replaces the ephemeral in-memory batch approach with a persisted session model.
-- Staff can start a count, work through it across interruptions, and commit atomically.
--
-- 1. stocktake_sessions  — one row per stocktake run
-- 2. stocktake_lines     — one counted line per variant per session
-- 3. begin_stocktake()   — creates session + snapshots current stock for all active variants
-- 4. commit_stocktake()  — applies deltas via batch_stocktake(), marks session committed

-- ─── 1. Sessions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stocktake_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid        NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  created_by   uuid        REFERENCES auth.users (id),
  status       text        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'committed', 'cancelled')),
  note         text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);

ALTER TABLE stocktake_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON stocktake_sessions
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON stocktake_sessions
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_hotel_status
  ON stocktake_sessions (hotel_id, status);

-- ─── 2. Lines ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stocktake_lines (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid    NOT NULL REFERENCES stocktake_sessions (id) ON DELETE CASCADE,
  hotel_id     uuid    NOT NULL REFERENCES hotels (id),
  variant_id   uuid    NOT NULL REFERENCES product_variants (id),
  system_qty   integer NOT NULL,  -- stock snapshot taken when session began
  counted_qty  integer,           -- NULL = not yet counted by staff
  UNIQUE (session_id, variant_id)
);

ALTER TABLE stocktake_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON stocktake_lines
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_insert" ON stocktake_lines
  WITH CHECK (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_stocktake_lines_session
  ON stocktake_lines (session_id);

-- ─── 3. begin_stocktake() ─────────────────────────────────────────────────────
-- Creates a draft session and snapshots the current stock of every active variant
-- in one transaction. Fails if the hotel already has an open draft session.

CREATE OR REPLACE FUNCTION begin_stocktake(p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id  uuid := auth_hotel_id();
  v_session_id uuid;
BEGIN
  -- Guard: only one draft session at a time per hotel
  IF EXISTS (
    SELECT 1 FROM stocktake_sessions
    WHERE hotel_id = v_hotel_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'A stocktake session is already in progress for this hotel';
  END IF;

  INSERT INTO stocktake_sessions (hotel_id, created_by, note)
  VALUES (v_hotel_id, auth.uid(), p_note)
  RETURNING id INTO v_session_id;

  -- Snapshot current stock for every enabled variant in the hotel
  INSERT INTO stocktake_lines (session_id, hotel_id, variant_id, system_qty)
  SELECT
    v_session_id,
    v_hotel_id,
    pv.id,
    pv.current_stock
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE p.hotel_id = v_hotel_id
    AND p.enabled = true
    AND pv.enabled = true;

  RETURN v_session_id;
END;
$$;

-- ─── 4. commit_stocktake() ────────────────────────────────────────────────────
-- Computes delta = counted_qty - system_qty for every counted line,
-- then calls batch_stocktake() with those deltas, and marks the session committed.
-- Lines where counted_qty IS NULL are skipped (not counted = no adjustment).
-- Lines where delta = 0 are also skipped (count matches system).

CREATE OR REPLACE FUNCTION commit_stocktake(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_adjustments jsonb;
BEGIN
  -- Verify session belongs to this hotel and is still a draft
  IF NOT EXISTS (
    SELECT 1 FROM stocktake_sessions
    WHERE id = p_session_id
      AND hotel_id = v_hotel_id
      AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Session not found or already committed';
  END IF;

  -- Build adjustment payload for batch_stocktake (only counted lines with a delta)
  SELECT jsonb_agg(
    jsonb_build_object(
      'variant_id', variant_id,
      'delta',      counted_qty - system_qty,
      'reason',     'Stocktake adjustment'
    )
  )
  INTO v_adjustments
  FROM stocktake_lines
  WHERE session_id = p_session_id
    AND counted_qty IS NOT NULL
    AND counted_qty <> system_qty;

  -- Apply all deltas atomically (batch_stocktake handles empty/null gracefully)
  IF v_adjustments IS NOT NULL AND jsonb_array_length(v_adjustments) > 0 THEN
    PERFORM batch_stocktake(v_adjustments);
  END IF;

  -- Mark committed
  UPDATE stocktake_sessions
  SET status = 'committed', committed_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ─── 5. cancel_stocktake() ────────────────────────────────────────────────────
-- Marks session cancelled without applying any adjustments.

CREATE OR REPLACE FUNCTION cancel_stocktake(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stocktake_sessions
  SET status = 'cancelled'
  WHERE id = p_session_id
    AND hotel_id = auth_hotel_id()
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or not cancellable';
  END IF;
END;
$$;
