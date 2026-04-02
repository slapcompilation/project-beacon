-- Migration 064: Occupancy Automation — Mews + Booking Horizon
-- Layer: Eye (data model) + Floor (webhook ingestion)
-- Purpose:
--   1. Extend occupancy_logs with source_system tracking (PMS vs manual)
--   2. Add pms_connections table for health monitoring
--   3. Add booking_forecasts table for forward-looking occupancy horizon
--   4. Add ingest_occupancy_webhook() SECURITY DEFINER for Edge Function use
--   5. Add get_pms_health() for the UI health indicator

SET search_path = public;

-- ─── 1. Extend occupancy_logs ─────────────────────────────────────────────────

-- source_system: finer-grained source tracking ('manual' | 'mews' | 'opera' | etc.)
-- external_reference_id: opaque PMS event id, stored for audit (no uniqueness required —
--   dedup is handled by the existing UNIQUE (hotel_id, date) constraint)
ALTER TABLE occupancy_logs
  ADD COLUMN IF NOT EXISTS source_system          text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_reference_id  text;

COMMENT ON COLUMN occupancy_logs.source_system IS
  'Originating system: manual | mews | opera | etc.';
COMMENT ON COLUMN occupancy_logs.external_reference_id IS
  'PMS event / snapshot ID stored for audit trail. Not enforced unique because '
  'multiple webhook retries for the same date are collapsed by (hotel_id, date).';

-- ─── 2. pms_connections ───────────────────────────────────────────────────────
-- One row per (hotel, source_system). Updated by every successful webhook ingest.
-- Used to surface "PMS disconnected" warnings when last_received_at > 2 hours ago.

CREATE TABLE IF NOT EXISTS pms_connections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source_system    text        NOT NULL,
  last_received_at timestamptz,
  total_events     bigint      NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, source_system)
);

ALTER TABLE pms_connections ENABLE ROW LEVEL SECURITY;

-- Read-only for hotel members — health status is informational
CREATE POLICY "pms_conn_select" ON pms_connections
  FOR SELECT USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_pms_conn_hotel
  ON pms_connections (hotel_id);

COMMENT ON TABLE pms_connections IS
  'Tracks last webhook receipt per PMS source per hotel. Used to surface '
  '"PMS disconnected" warnings in the Demand Sensing UI.';

-- ─── 3. booking_forecasts ─────────────────────────────────────────────────────
-- Forward-looking occupancy entries. Managers enter expected occupancy here
-- for 7/14/30-day horizon planning. PMS webhooks also write here when the
-- source system sends booking-curve data.
-- Demand sensing reads this table alongside occupancy_logs.

CREATE TABLE IF NOT EXISTS booking_forecasts (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id                uuid         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  date                    date         NOT NULL,
  expected_occupancy_pct  numeric(5,2) NOT NULL CHECK (expected_occupancy_pct >= 0 AND expected_occupancy_pct <= 100),
  horizon_source          text         NOT NULL DEFAULT 'manual'
                            CHECK (horizon_source IN ('manual', 'pms')),
  created_by              uuid         REFERENCES auth.users(id),
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, date)
);

ALTER TABLE booking_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bkf_select" ON booking_forecasts FOR SELECT USING (hotel_id = auth_hotel_id());
CREATE POLICY "bkf_insert" ON booking_forecasts FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());
CREATE POLICY "bkf_update" ON booking_forecasts FOR UPDATE USING (hotel_id = auth_hotel_id());
CREATE POLICY "bkf_delete" ON booking_forecasts FOR DELETE USING (hotel_id = auth_hotel_id());

CREATE INDEX IF NOT EXISTS idx_bkf_hotel_date
  ON booking_forecasts (hotel_id, date);

COMMENT ON TABLE booking_forecasts IS
  'Forward-looking occupancy forecasts. Source-tracked (manual vs PMS). '
  'Demand sensing uses these to adjust burn rates before actuals are known.';

-- ─── 4. get_pms_health() ──────────────────────────────────────────────────────
-- Returns one row per registered PMS source for the authenticated hotel.
-- status: connected (<2h) | warning (2–24h) | disconnected (>24h) | never_connected

CREATE OR REPLACE FUNCTION get_pms_health()
RETURNS TABLE (
  source_system    text,
  last_received_at timestamptz,
  hours_since_last numeric,
  status           text,
  total_events     bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    source_system,
    last_received_at,
    CASE
      WHEN last_received_at IS NULL THEN NULL
      ELSE ROUND(EXTRACT(EPOCH FROM (now() - last_received_at)) / 3600.0, 1)
    END                                                                    AS hours_since_last,
    CASE
      WHEN last_received_at IS NULL                               THEN 'never_connected'
      WHEN now() - last_received_at < interval '2 hours'         THEN 'connected'
      WHEN now() - last_received_at < interval '24 hours'        THEN 'warning'
      ELSE                                                             'disconnected'
    END                                                                    AS status,
    total_events
  FROM  pms_connections
  WHERE hotel_id = auth_hotel_id()
  ORDER BY source_system;
$$;

GRANT EXECUTE ON FUNCTION get_pms_health() TO authenticated;

-- ─── 5. upsert_booking_forecast() ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_booking_forecast(
  p_date                 date,
  p_expected_occupancy   numeric,
  p_horizon_source       text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id       uuid;
  v_hotel_id uuid;
BEGIN
  v_hotel_id := auth_hotel_id();

  INSERT INTO booking_forecasts
    (hotel_id, date, expected_occupancy_pct, horizon_source, created_by, updated_at)
  VALUES
    (v_hotel_id, p_date, p_expected_occupancy, p_horizon_source, auth.uid(), now())
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET expected_occupancy_pct = EXCLUDED.expected_occupancy_pct,
        horizon_source         = EXCLUDED.horizon_source,
        created_by             = EXCLUDED.created_by,
        updated_at             = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_booking_forecast(date, numeric, text) TO authenticated;

-- ─── 6. delete_booking_forecast() ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_booking_forecast(p_date date)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM booking_forecasts WHERE hotel_id = auth_hotel_id() AND date = p_date;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_booking_forecast(date) TO authenticated;

-- ─── 7. ingest_occupancy_webhook() ───────────────────────────────────────────
-- SECURITY DEFINER — called by Edge Functions using the service role key.
-- Upserts a single occupancy event and bumps the PMS connection health row.
-- Callers: ingest-occupancy (generic) and mews-webhook (Mews-specific).

CREATE OR REPLACE FUNCTION ingest_occupancy_webhook(
  p_hotel_id              uuid,
  p_source_system         text,
  p_date                  date,
  p_occupancy_pct         numeric,
  p_occupied_rooms        integer DEFAULT NULL,
  p_total_rooms           integer DEFAULT NULL,
  p_external_reference_id text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Upsert occupancy log. Conflict is on (hotel_id, date) — one value per day.
  INSERT INTO occupancy_logs (
    hotel_id, date, occupancy_pct, occupied_rooms, total_rooms,
    source, source_system, external_reference_id
  ) VALUES (
    p_hotel_id, p_date, p_occupancy_pct, p_occupied_rooms, p_total_rooms,
    p_source_system, p_source_system, p_external_reference_id
  )
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET occupancy_pct         = EXCLUDED.occupancy_pct,
        occupied_rooms        = COALESCE(EXCLUDED.occupied_rooms, occupancy_logs.occupied_rooms),
        total_rooms           = COALESCE(EXCLUDED.total_rooms,   occupancy_logs.total_rooms),
        source                = EXCLUDED.source,
        source_system         = EXCLUDED.source_system,
        external_reference_id = COALESCE(EXCLUDED.external_reference_id, occupancy_logs.external_reference_id)
  RETURNING id INTO v_id;

  -- Bump PMS connection health tracker
  INSERT INTO pms_connections (hotel_id, source_system, last_received_at, total_events)
  VALUES (p_hotel_id, p_source_system, now(), 1)
  ON CONFLICT (hotel_id, source_system) DO UPDATE
    SET last_received_at = now(),
        total_events     = pms_connections.total_events + 1;

  RETURN v_id;
END;
$$;

-- Only service_role can call this (Edge Functions use service role key)
GRANT EXECUTE ON FUNCTION ingest_occupancy_webhook(uuid, text, date, numeric, integer, integer, text)
  TO service_role;
