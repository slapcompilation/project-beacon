-- Layer: Mind — Supplier intelligence foundation
-- Adds delivery_events (the immutable record of every delivery) and
-- supplier_scorecard (the live view that powers performance scoring).
-- On-time rate, fill rate, and price drift are the three axes of trust.

SET search_path = public;

-- ─── Ensure suppliers table exists (idempotent — no-op if already present) ───

CREATE TABLE IF NOT EXISTS suppliers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suppliers' AND policyname = 'hotel_isolation'
  ) THEN
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "hotel_isolation" ON suppliers
      USING  (hotel_id = auth_hotel_id())
      WITH CHECK (hotel_id = auth_hotel_id());
  END IF;
END $$;

-- ─── delivery_events ─────────────────────────────────────────────────────────

CREATE TABLE delivery_events (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              uuid          NOT NULL REFERENCES hotels(id)           ON DELETE CASCADE,
  supplier_id           uuid          NOT NULL REFERENCES suppliers(id)        ON DELETE CASCADE,
  restock_request_id    uuid                   REFERENCES restock_requests(id) ON DELETE SET NULL,
  ordered_qty           numeric(12,3) NOT NULL CHECK (ordered_qty > 0),
  received_qty          numeric(12,3) NOT NULL CHECK (received_qty >= 0),
  expected_date         date          NOT NULL,
  actual_date           date,                    -- NULL = in transit / not yet received
  unit_cost_expected    numeric(12,4),           -- from PO / last known price
  unit_cost_actual      numeric(12,4),           -- from invoice at delivery
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON delivery_events
  USING  (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

-- ─── supplier_scorecard view ──────────────────────────────────────────────────
-- Aggregates delivery_events per supplier.
-- on_time_rate  : % completed deliveries that arrived on or before expected date
-- avg_fill_rate : avg received_qty / ordered_qty as a percentage
-- avg_price_drift_pct : avg % deviation of actual cost vs expected (positive = overcharged)
-- avg_days_late : avg calendar days between expected and actual date (negative = early)

CREATE OR REPLACE VIEW supplier_scorecard AS
SELECT
  de.supplier_id,
  s.name                                                                  AS supplier_name,
  de.hotel_id,

  COUNT(*)                                                                AS total_deliveries,
  COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL)                      AS completed_deliveries,
  COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL
                     AND de.actual_date <= de.expected_date)              AS on_time_deliveries,

  -- On-time rate: only among completed deliveries
  ROUND(
    COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL
                       AND de.actual_date <= de.expected_date)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE de.actual_date IS NOT NULL), 0) * 100
  , 1)                                                                    AS on_time_rate,

  -- Fill rate: average across all deliveries (even in-transit uses ordered_qty denominator)
  ROUND(
    AVG(de.received_qty / NULLIF(de.ordered_qty, 0)) * 100
  , 1)                                                                    AS avg_fill_rate,

  -- Price drift: positive = being overcharged vs expected; only rows with both costs
  ROUND(
    AVG(
      CASE
        WHEN de.unit_cost_expected > 0 AND de.unit_cost_actual IS NOT NULL
        THEN (de.unit_cost_actual - de.unit_cost_expected) / de.unit_cost_expected * 100
        ELSE NULL
      END
    )
  , 2)                                                                    AS avg_price_drift_pct,

  -- Avg days late (negative = arrived early); only completed deliveries
  ROUND(
    AVG(
      CASE
        WHEN de.actual_date IS NOT NULL
        THEN (de.actual_date - de.expected_date)::numeric
        ELSE NULL
      END
    )
  , 1)                                                                    AS avg_days_late,

  MAX(de.actual_date)                                                     AS last_delivery_date,

  -- Total spend = received units × actual cost (fallback to expected cost)
  SUM(
    de.received_qty * COALESCE(de.unit_cost_actual, de.unit_cost_expected, 0)
  )                                                                       AS total_received_value,

  -- Pending = ordered but not yet received
  COUNT(*) FILTER (WHERE de.actual_date IS NULL)                          AS pending_deliveries

FROM delivery_events de
JOIN suppliers s ON s.id = de.supplier_id
GROUP BY de.supplier_id, s.name, de.hotel_id;
