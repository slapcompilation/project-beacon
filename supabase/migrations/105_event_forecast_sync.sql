-- ═══════════════════════════════════════════════════════════════════════════════
-- 105 — Event-to-Forecast Sync (Demand Sensing Refinement)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Unify event demand (weddings, conferences, etc.) with the occupancy-driven
--   forecast engine. Currently events are a parallel demand model that never
--   reaches the automated restock pipeline. This migration:
--
--   1. Extends booking_forecasts.horizon_source to accept 'event'
--   2. Creates a trigger that syncs events → booking_forecasts (occupancy signal)
--   3. Overlays event demand_factors into get_occupancy_adjusted_forecast() (category-specific boost)
--
--   Hybrid approach: the trigger captures occupancy uplift (so compute_optimal_par
--   and other booking_forecasts consumers benefit), while the RPC overlay captures
--   category-specific demand multipliers that occupancy alone can't express.
--
-- Depends on: 035 (events), 053 (occupancy_logs), 064 (booking_forecasts), 103 (get_occupancy_adjusted_forecast)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 0. Ensure booking_forecasts table exists (idempotent) ─────────────────────
-- Migration 064 defines this table but may not have been applied to the database.
-- CREATE TABLE IF NOT EXISTS is safe to run even if 064 was already applied.

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_forecasts' AND policyname = 'bkf_select') THEN
    CREATE POLICY "bkf_select" ON booking_forecasts FOR SELECT USING (hotel_id = auth_hotel_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_forecasts' AND policyname = 'bkf_insert') THEN
    CREATE POLICY "bkf_insert" ON booking_forecasts FOR INSERT WITH CHECK (hotel_id = auth_hotel_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_forecasts' AND policyname = 'bkf_update') THEN
    CREATE POLICY "bkf_update" ON booking_forecasts FOR UPDATE USING (hotel_id = auth_hotel_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_forecasts' AND policyname = 'bkf_delete') THEN
    CREATE POLICY "bkf_delete" ON booking_forecasts FOR DELETE USING (hotel_id = auth_hotel_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bkf_hotel_date ON booking_forecasts (hotel_id, date);

-- ─── 1. Extend horizon_source CHECK constraint ─────────────────────────────────

ALTER TABLE booking_forecasts
  DROP CONSTRAINT IF EXISTS booking_forecasts_horizon_source_check;

ALTER TABLE booking_forecasts
  ADD CONSTRAINT booking_forecasts_horizon_source_check
    CHECK (horizon_source IN ('manual', 'pms', 'event'));

-- ─── 2. sync_event_to_booking_forecast() trigger function ───────────────────────
-- When events are created/updated/deleted, sync the occupancy signal into
-- booking_forecasts so the forecast engine (and PAR calculations) pick it up.
--
-- Occupancy derivation: guest_count / total_rooms (from most recent occupancy_logs).
-- ON CONFLICT: takes GREATEST occupancy — events can only raise forecasts, never lower.
-- DELETE: only removes rows where horizon_source = 'event' (preserves manual/pms).

CREATE OR REPLACE FUNCTION sync_event_to_booking_forecast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_rooms int;
  v_added_occ   numeric;
  v_existing    numeric;
  v_final_occ   numeric;
BEGIN
  -- On DELETE: remove the event-sourced forecast only
  IF TG_OP = 'DELETE' THEN
    DELETE FROM booking_forecasts
     WHERE hotel_id       = OLD.hotel_id
       AND date           = OLD.event_date
       AND horizon_source = 'event';
    RETURN OLD;
  END IF;

  -- On UPDATE: if event_date changed, clean up the old date first
  IF TG_OP = 'UPDATE' AND OLD.event_date <> NEW.event_date THEN
    DELETE FROM booking_forecasts
     WHERE hotel_id       = OLD.hotel_id
       AND date           = OLD.event_date
       AND horizon_source = 'event';
  END IF;

  -- Get total_rooms from the most recent occupancy_logs entry for this hotel
  SELECT ol.total_rooms INTO v_total_rooms
    FROM occupancy_logs ol
   WHERE ol.hotel_id    = NEW.hotel_id
     AND ol.total_rooms IS NOT NULL
   ORDER BY ol.date DESC
   LIMIT 1;

  -- If we can't determine total_rooms, skip the forecast upsert.
  -- The RPC overlay in get_occupancy_adjusted_forecast will still catch the event.
  IF v_total_rooms IS NULL OR v_total_rooms <= 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate occupancy contribution from event guests
  v_added_occ := LEAST(100.0, (NEW.guest_count::numeric / v_total_rooms) * 100);

  -- Check if there's already a non-event forecast for this date
  SELECT expected_occupancy_pct INTO v_existing
    FROM booking_forecasts
   WHERE hotel_id       = NEW.hotel_id
     AND date           = NEW.event_date
     AND horizon_source <> 'event'
   LIMIT 1;

  -- Final occupancy: add event guests on top of existing forecast (or baseline 50%)
  v_final_occ := LEAST(100.0, COALESCE(v_existing, 50.0) + v_added_occ);

  -- Upsert the event-sourced forecast
  INSERT INTO booking_forecasts
    (hotel_id, date, expected_occupancy_pct, horizon_source, created_by, updated_at)
  VALUES
    (NEW.hotel_id, NEW.event_date, v_final_occ, 'event', NEW.created_by, now())
  ON CONFLICT (hotel_id, date) DO UPDATE
    SET expected_occupancy_pct = GREATEST(
          booking_forecasts.expected_occupancy_pct,
          EXCLUDED.expected_occupancy_pct
        ),
        -- Preserve the original source if it was manual/pms (don't overwrite)
        horizon_source = CASE
          WHEN booking_forecasts.horizon_source = 'event' THEN 'event'
          ELSE booking_forecasts.horizon_source
        END,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_sync_forecast ON events;

CREATE TRIGGER trg_event_sync_forecast
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION sync_event_to_booking_forecast();

-- ─── 3. Extend get_occupancy_adjusted_forecast() with event overlay ─────────────
-- Adds event_demand_factor and event_name to the return type.
-- Event demand is averaged across the forecast window: a wedding with factor 2.5
-- on 1 of 14 forecast days adds (2.5-1.0)/14 = 0.107 to the base multiplier.
-- This accounts for the need to stock up BEFORE the event.
-- Combined multiplier: occupancy_multiplier × (1.0 + event_boost)

-- Must DROP first — PostgreSQL cannot change return type via CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_occupancy_adjusted_forecast(int, int);

CREATE OR REPLACE FUNCTION get_occupancy_adjusted_forecast(
  p_forecast_days int DEFAULT 14,
  p_lookback_days int DEFAULT 30
)
RETURNS TABLE (
  variant_id               uuid,
  product_name             text,
  variant_name             text,
  sku                      text,
  category_name            text,
  current_stock            int,
  base_avg_daily           numeric,
  occupancy_sensitivity    numeric,
  baseline_occupancy_pct   numeric,
  forecast_occupancy_pct   numeric,
  demand_multiplier        numeric,
  adjusted_avg_daily       numeric,
  adjusted_days_until_zero numeric,
  adjusted_order_qty       int,
  demand_spike             boolean,
  has_open_request         boolean,
  event_demand_factor      numeric,
  event_name               text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id     uuid := auth_hotel_id();
  v_baseline_occ numeric;
  v_forecast_occ numeric;
  v_event_boost  numeric;
  v_event_names  text;
BEGIN
  -- Calculate baseline occupancy from recent history
  SELECT COALESCE(AVG(occupancy_pct), 60)
    INTO v_baseline_occ
    FROM occupancy_logs
   WHERE hotel_id = v_hotel_id
     AND date >= CURRENT_DATE - p_lookback_days;

  -- Calculate average forecasted occupancy for the next N days
  SELECT COALESCE(AVG(expected_occupancy_pct), v_baseline_occ)
    INTO v_forecast_occ
    FROM booking_forecasts
   WHERE hotel_id = v_hotel_id
     AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_forecast_days;

  -- Calculate event demand boost: sum of (demand_factor - 1.0) spread across forecast window.
  -- A wedding (2.5×) on 1 of 14 days → boost = (2.5-1.0)/14 = 0.107
  -- Multiple events stack: two events of 2.0× each → boost = 2×(2.0-1.0)/14 = 0.143
  SELECT
    COALESCE(SUM(e.demand_factor - 1.0) / GREATEST(p_forecast_days, 1), 0),
    STRING_AGG(e.name, ', ' ORDER BY e.event_date)
    INTO v_event_boost, v_event_names
    FROM events e
   WHERE e.hotel_id = v_hotel_id
     AND e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_forecast_days;

  RETURN QUERY
  SELECT
    pv.id                                                               AS variant_id,
    pr.name                                                             AS product_name,
    pv.name                                                             AS variant_name,
    pv.sku                                                              AS sku,
    COALESCE(cat.name, 'Uncategorized')                                 AS category_name,
    pv.current_stock                                                    AS current_stock,
    ROUND(ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric, 4)   AS base_avg_daily,
    COALESCE(cat.occupancy_sensitivity, 0.5)                            AS occupancy_sensitivity,
    ROUND(v_baseline_occ, 1)                                            AS baseline_occupancy_pct,
    ROUND(v_forecast_occ, 1)                                            AS forecast_occupancy_pct,

    -- Combined demand multiplier: occupancy adjustment × event boost
    -- occupancy_adj = 1.0 + sensitivity × (forecast - baseline) / baseline
    -- event_boost applied proportionally to sensitivity (high-sensitivity categories
    -- are more affected by events, e.g., towels/F&B vs cleaning chemicals)
    ROUND(
      CASE
        WHEN v_baseline_occ <= 0 THEN 1.0
        ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                    * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
      END
      * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
    , 3)                                                                AS demand_multiplier,

    -- Adjusted daily consumption (with combined multiplier)
    ROUND(
      ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
      * CASE
          WHEN v_baseline_occ <= 0 THEN 1.0
          ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                      * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
        END
      * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
    , 4)                                                                AS adjusted_avg_daily,

    -- Adjusted days until zero (with combined multiplier)
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN NULL
      ELSE ROUND(
        pv.current_stock / (
          ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
          * CASE
              WHEN v_baseline_occ <= 0 THEN 1.0
              ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                          * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
            END
          * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
        ), 1
      )
    END                                                                 AS adjusted_days_until_zero,

    -- Adjusted order quantity (30-day supply target with combined multiplier)
    GREATEST(
      0,
      CEIL(
        (ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
         * CASE
             WHEN v_baseline_occ <= 0 THEN 1.0
             ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                         * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
           END
         * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
        ) * 30 - pv.current_stock
      )
    )::int                                                              AS adjusted_order_qty,

    -- Demand spike: combined multiplier > 1.15 (15%+ increase from occupancy + events)
    (
      CASE
        WHEN v_baseline_occ <= 0 THEN 1.0
        ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                    * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
      END
      * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
    ) > 1.15                                                            AS demand_spike,

    EXISTS (
      SELECT 1 FROM restock_requests rr
       WHERE rr.variant_id = pv.id
         AND rr.hotel_id   = v_hotel_id
         AND rr.status     IN ('pending', 'pending_manager', 'pending_director', 'approved')
    )                                                                   AS has_open_request,

    -- Event-specific columns
    ROUND(1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost, 3) AS event_demand_factor,
    v_event_names                                                       AS event_name

  FROM stock_logs sl
  JOIN product_variants pv ON pv.id = sl.variant_id
  JOIN products pr         ON pr.id = pv.product_id
  LEFT JOIN categories cat ON cat.id = pr.category_id
  WHERE sl.hotel_id       = v_hotel_id
    AND sl.quantity_change < 0
    AND sl.is_revert       = false
    AND sl.timestamp      >= NOW() - (p_lookback_days || ' days')::interval
    AND pv.enabled         = true
  GROUP BY pv.id, pv.name, pv.sku, pv.current_stock, pr.name, cat.name, cat.occupancy_sensitivity
  HAVING ABS(SUM(sl.quantity_change)) > 0
  ORDER BY
    -- Demand spikes first, then most urgent
    CASE
      WHEN (
        CASE
          WHEN v_baseline_occ <= 0 THEN 1.0
          ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                      * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
        END
        * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
      ) > 1.15
      THEN 0
      ELSE 1
    END,
    CASE
      WHEN ABS(SUM(sl.quantity_change)) = 0 THEN 99999
      ELSE pv.current_stock / (
        ABS(SUM(sl.quantity_change)) / p_lookback_days::numeric
        * CASE
            WHEN v_baseline_occ <= 0 THEN 1.0
            ELSE 1.0 + COALESCE(cat.occupancy_sensitivity, 0.5)
                        * GREATEST((v_forecast_occ - v_baseline_occ) / v_baseline_occ, -0.5)
          END
        * (1.0 + COALESCE(cat.occupancy_sensitivity, 0.5) * v_event_boost)
      )
    END ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_occupancy_adjusted_forecast(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupancy_adjusted_forecast(int, int) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - booking_forecasts.horizon_source now accepts 'event'
--   - events INSERT/UPDATE/DELETE auto-sync to booking_forecasts via trigger
--   - get_occupancy_adjusted_forecast() returns event_demand_factor + event_name
--   - Combined multiplier: occupancy_adj × (1 + sensitivity × event_boost)
-- ═══════════════════════════════════════════════════════════════════════════════
