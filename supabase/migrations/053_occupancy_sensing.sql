-- Migration 053: Occupancy sensing — rolling demand adjustment
-- Layer: Eye
-- Purpose: Store per-day occupancy forecasts so the Eye Layer can scale the
-- consumption forecast for known busy/quiet periods before stockouts occur.
-- Key formula: adjusted_burn = avg_daily × (upcoming_avg_occ / historical_avg_occ)
-- e.g. 85% occupancy vs 62% baseline → 1.37× burn rate → 27% fewer days until zero

SET search_path = public;

-- ─── 1. occupancy_logs table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS occupancy_logs (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  date           date         NOT NULL,
  occupancy_pct  numeric(5,2) NOT NULL CHECK (occupancy_pct >= 0 AND occupancy_pct <= 100),
  occupied_rooms integer      CHECK (occupied_rooms >= 0),
  total_rooms    integer      CHECK (total_rooms > 0),
  source         text         NOT NULL DEFAULT 'manual',
  notes          text,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, date)
);

ALTER TABLE occupancy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occ_select" ON occupancy_logs FOR SELECT USING (hotel_id = auth_hotel_id());
CREATE POLICY "occ_insert" ON occupancy_logs FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());
CREATE POLICY "occ_update" ON occupancy_logs FOR UPDATE USING (hotel_id = auth_hotel_id());
CREATE POLICY "occ_delete" ON occupancy_logs FOR DELETE USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_occupancy_hotel_date ON occupancy_logs (hotel_id, date);

COMMENT ON TABLE occupancy_logs IS
  'Per-day occupancy data for demand sensing. The Eye Layer computes '
  'upcoming_avg / historical_avg as a burn-rate multiplier, making the '
  'consumption forecast forward-looking rather than purely backwards-looking.';

COMMENT ON COLUMN occupancy_logs.occupancy_pct IS
  '0–100 percentage. Source of truth for the demand adjustment factor.';

-- ─── 2. upsert_occupancy() ────────────────────────────────────────────────────
-- Idempotent — safe to call multiple times for the same date.

CREATE OR REPLACE FUNCTION upsert_occupancy(
  p_date           date,
  p_occupancy_pct  numeric,
  p_occupied_rooms integer DEFAULT NULL,
  p_total_rooms    integer DEFAULT NULL,
  p_notes          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id       uuid;
  v_hotel_id uuid;
BEGIN
  v_hotel_id := auth_hotel_id();

  INSERT INTO occupancy_logs (hotel_id, date, occupancy_pct, occupied_rooms, total_rooms, notes)
  VALUES (v_hotel_id, p_date, p_occupancy_pct, p_occupied_rooms, p_total_rooms, p_notes)
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET occupancy_pct  = EXCLUDED.occupancy_pct,
        occupied_rooms = EXCLUDED.occupied_rooms,
        total_rooms    = EXCLUDED.total_rooms,
        notes          = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_occupancy(date, numeric, integer, integer, text) TO authenticated;

-- ─── 3. delete_occupancy() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_occupancy(p_date date)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM occupancy_logs WHERE hotel_id = auth_hotel_id() AND date = p_date;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_occupancy(date) TO authenticated;
