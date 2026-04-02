-- Migration 080: Persistent Intelligence Pipeline
-- Layer: Cross-layer synthesis (Sprint 2)
--
-- Moves from on-demand computation to a persistent daily record of intelligence.
-- Operators see "Analyzed today at 06:14" instead of "Loading…" and the system
-- builds a 30-day history enabling the SituationTimeline sparkline in Briefing.
--
-- 1. intelligence_snapshots table — one row per hotel per day
-- 2. capture_intelligence_snapshot() — idempotent, called on Briefing mount
-- 3. get_intelligence_history(days) — last N days for sparkline

SET search_path = public;

-- ─── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id         uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  captured_at      timestamptz NOT NULL DEFAULT now(),
  situation_level  text        NOT NULL CHECK (situation_level IN ('nominal','elevated','critical')),
  situation_score  int         NOT NULL DEFAULT 0,
  act_now_count    int         NOT NULL DEFAULT 0,
  monitor_count    int         NOT NULL DEFAULT 0,
  proposal_count   int         NOT NULL DEFAULT 0,
  incidents        jsonb       NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_intel_snapshots_hotel_captured
  ON intelligence_snapshots (hotel_id, captured_at DESC);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel members can view snapshots"
  ON intelligence_snapshots FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "Hotel members can insert snapshots"
  ON intelligence_snapshots FOR INSERT
  WITH CHECK (hotel_id = auth_hotel_id());

-- ─── 3. capture_intelligence_snapshot() ──────────────────────────────────────
-- Idempotent: no-ops if a snapshot already exists for today (UTC).
-- Called once per day from the Briefing page on mount.

CREATE OR REPLACE FUNCTION capture_intelligence_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel    uuid := auth_hotel_id();
  v_sit      jsonb;
  v_act_now  int := 0;
  v_monitor  int := 0;
  v_proposal int := 0;
BEGIN
  -- Skip if already captured today
  IF EXISTS (
    SELECT 1 FROM intelligence_snapshots
    WHERE  hotel_id    = v_hotel
      AND  DATE(captured_at AT TIME ZONE 'UTC') = CURRENT_DATE
  ) THEN RETURN; END IF;

  v_sit := get_situation_score();

  SELECT
    COUNT(*) FILTER (WHERE priority <= 1 AND action_type <> 'restock_proposal')::int,
    COUNT(*) FILTER (WHERE priority BETWEEN 2 AND 3)::int,
    COUNT(*) FILTER (WHERE action_type = 'restock_proposal')::int
  INTO v_act_now, v_monitor, v_proposal
  FROM get_briefing_actions();

  INSERT INTO intelligence_snapshots (
    hotel_id, situation_level, situation_score,
    act_now_count, monitor_count, proposal_count, incidents
  ) VALUES (
    v_hotel,
    v_sit ->> 'level',
    (v_sit ->> 'score')::int,
    v_act_now, v_monitor, v_proposal,
    COALESCE(v_sit -> 'incidents', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION capture_intelligence_snapshot() TO authenticated;

-- ─── 4. get_intelligence_history(days) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_intelligence_history(p_days int DEFAULT 30)
RETURNS TABLE (
  captured_at      timestamptz,
  situation_level  text,
  situation_score  int,
  act_now_count    int,
  monitor_count    int,
  proposal_count   int
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT captured_at, situation_level, situation_score,
         act_now_count, monitor_count, proposal_count
  FROM   intelligence_snapshots
  WHERE  hotel_id     = auth_hotel_id()
    AND  captured_at >= now() - (p_days || ' days')::interval
  ORDER  BY captured_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_intelligence_history(int) TO authenticated;
