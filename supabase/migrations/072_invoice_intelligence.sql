-- Layer: Mind — Invoicing Intelligence (Sprint 17, Phase 8)
-- Detects per-supplier invoice pricing PATTERNS, not just averages.
-- The key innovation over get_cost_variance_report() and get_price_variance_by_supplier():
--   consecutive_above_count — how many of the most recent deliveries IN A ROW
--   have been above the expected cost. This is the overcharging streak.
--   A one-time overcharge is noise. Three in a row is a pattern.
--
-- anomaly_flag = true when:
--   - streak ≥ 3 consecutive overcharges, OR
--   - avg overcharge > 10% across the window
--
-- leverage_score (0–100):
--   - 12 pts per consecutive overcharge in current streak (max ~36 for 3+)
--   - up to 40 pts for avg overcharge magnitude (2× pct, capped at 40)
--   - up to 20 pts for total financial impact (>500 = 20, >100 = 10, >0 = 5)
--
-- Sorted: leverage_score DESC then total_financial_impact DESC
-- Filtered: ≥2 deliveries required (can't detect patterns with single data point)

SET search_path = public;

CREATE OR REPLACE FUNCTION get_invoice_intelligence(p_days int DEFAULT 90)
RETURNS TABLE (
  supplier_name             text,
  total_deliveries          int,
  deliveries_above_baseline int,
  consecutive_above_count   int,    -- current streak of above-baseline deliveries (most recent first)
  avg_variance_pct          numeric, -- positive = overcharged on average vs expected cost
  total_financial_impact    numeric, -- sum of (actual - expected) × qty across all deliveries
  last_delivery_at          timestamptz,
  anomaly_flag              boolean,
  leverage_score            int      -- 0–100 negotiation signal
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(rr.supplier, '—')                                              AS supplier,
      rr2.received_at,
      CASE WHEN rr2.unit_cost > pv.cost THEN 1 ELSE 0 END                    AS is_above,
      ROUND((rr2.unit_cost - pv.cost) / pv.cost * 100.0, 2)                 AS variance_pct,
      ROUND((rr2.unit_cost - pv.cost) * rr2.quantity_received::numeric, 2)   AS variance_amount
    FROM restock_receives rr2
    JOIN restock_requests rr ON rr.id  = rr2.request_id
    JOIN product_variants pv ON pv.id  = rr.variant_id
    WHERE rr2.hotel_id  = auth_hotel_id()
      AND rr2.unit_cost IS NOT NULL
      AND pv.cost       IS NOT NULL
      AND pv.cost       > 0
      AND rr2.received_at >= NOW() - (p_days || ' days')::interval
  ),

  -- Newest-first row numbers per supplier
  ranked AS (
    SELECT
      supplier,
      received_at,
      is_above,
      variance_pct,
      variance_amount,
      ROW_NUMBER() OVER (PARTITION BY supplier ORDER BY received_at DESC) AS rn
    FROM base
  ),

  -- Classic consecutive-streak detection:
  --   grp = rn − row_number_within_(supplier, is_above, ordered by rn)
  --   Rows with same is_above AND same grp value form a contiguous block.
  --   The block that includes rn=1 (most recent) has grp=0 for is_above=1.
  streak_groups AS (
    SELECT
      supplier,
      is_above,
      rn,
      rn - ROW_NUMBER() OVER (PARTITION BY supplier, is_above ORDER BY rn) AS grp
    FROM ranked
  ),

  -- Count how many consecutive above-baseline deliveries END at the most recent delivery
  current_streak AS (
    SELECT supplier, COUNT(*)::int AS consecutive_above
    FROM streak_groups
    WHERE is_above = 1 AND grp = 0
    GROUP BY supplier
  ),

  summary AS (
    SELECT
      supplier,
      COUNT(*)::int                                   AS total_deliveries,
      COUNT(*) FILTER (WHERE is_above = 1)::int       AS deliveries_above,
      ROUND(AVG(variance_pct)::numeric, 2)            AS avg_variance_pct,
      ROUND(SUM(variance_amount)::numeric, 2)         AS total_financial_impact,
      MAX(received_at)                                AS last_delivery_at
    FROM ranked
    GROUP BY supplier
  )

  SELECT
    s.supplier                                                AS supplier_name,
    s.total_deliveries,
    s.deliveries_above                                        AS deliveries_above_baseline,
    COALESCE(cs.consecutive_above, 0)                        AS consecutive_above_count,
    s.avg_variance_pct,
    s.total_financial_impact,
    s.last_delivery_at,

    -- anomaly: 3+ consecutive overcharges OR avg > 10%
    (   COALESCE(cs.consecutive_above, 0) >= 3
     OR COALESCE(s.avg_variance_pct,   0) > 10.0 )          AS anomaly_flag,

    -- leverage score: consecutive streak weight + magnitude weight + impact weight
    LEAST(100, GREATEST(0,
      COALESCE(cs.consecutive_above, 0) * 12
      + LEAST(40, GREATEST(0, ROUND(COALESCE(s.avg_variance_pct, 0) * 2.0)::int))
      + CASE
          WHEN s.total_financial_impact > 500 THEN 20
          WHEN s.total_financial_impact > 100 THEN 10
          WHEN s.total_financial_impact > 0   THEN  5
          ELSE 0
        END
    ))::int                                                   AS leverage_score

  FROM summary s
  LEFT JOIN current_streak cs ON cs.supplier = s.supplier
  WHERE s.total_deliveries >= 2
  ORDER BY leverage_score DESC, total_financial_impact DESC;
$$;

GRANT EXECUTE ON FUNCTION get_invoice_intelligence(int) TO authenticated;
