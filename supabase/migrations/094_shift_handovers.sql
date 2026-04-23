-- Migration 094: Shift Handover Reports
-- Layer: Flow
-- Purpose: Allows outgoing managers to document what happened during their
-- shift and flag priority items for the incoming team. The app already captures
-- all the raw activity (stock_logs); this table stores the curated summary +
-- handover notes the outgoing manager writes on top of that data.
--
-- Design: lightweight — no duplicate of stock_log data. The UI queries
-- stock_logs live for the shift window and this table stores only the note
-- and the flagged items the manager explicitly called out.

CREATE TABLE IF NOT EXISTS shift_handovers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  window_hours  integer     NOT NULL DEFAULT 8
                            CHECK (window_hours BETWEEN 1 AND 24),
  started_at    timestamptz NOT NULL,  -- shift start (now() - window_hours)
  notes         text,                 -- freeform handover note from manager
  flagged_items jsonb       NOT NULL DEFAULT '[]',
  -- flagged_items schema: [{variant_id, product_name, note, priority}]
  -- priority: 'urgent' | 'watch' | 'info'
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_members_read_handovers"
  ON shift_handovers FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "hotel_members_write_handovers"
  ON shift_handovers FOR INSERT
  WITH CHECK (hotel_id = auth_hotel_id());

GRANT SELECT, INSERT ON shift_handovers TO authenticated;

-- Index for fast recent-handovers lookup
CREATE INDEX IF NOT EXISTS idx_shift_handovers_hotel_created
  ON shift_handovers (hotel_id, created_at DESC);

-- ─── get_shift_handovers() ────────────────────────────────────────────────────
-- Returns the N most recent handovers for the calling user's hotel,
-- joined with the author's email from profiles.

CREATE OR REPLACE FUNCTION get_shift_handovers(p_limit int DEFAULT 10)
RETURNS TABLE (
  id            uuid,
  created_by    uuid,
  author_email  text,
  window_hours  integer,
  started_at    timestamptz,
  notes         text,
  flagged_items jsonb,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      sh.id,
      sh.created_by,
      p.email       AS author_email,
      sh.window_hours,
      sh.started_at,
      sh.notes,
      sh.flagged_items,
      sh.created_at
    FROM shift_handovers sh
    LEFT JOIN profiles p ON p.id = sh.created_by
    WHERE sh.hotel_id = auth_hotel_id()
    ORDER BY sh.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shift_handovers(int) TO authenticated;
