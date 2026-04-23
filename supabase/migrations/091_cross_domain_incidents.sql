-- Migration 091: Cross-Domain Incident Correlation Engine
-- Layer: Eye — cross-domain synthesis (Palantir Principle 6)
--
-- The Palantir insight: a waste spike is more meaningful when correlated with
-- a team member's shift and a supplier's late delivery.
-- That is NOT three separate widgets — it is ONE correlated incident.
--
-- This function scans for active signals across three domains simultaneously:
--
--   1. WASTE domain   — variants where last-7d write-offs exceed 1.5× 4-week baseline
--   2. STOCK domain   — variants that hit zero stock, or sustained below PAR >40% of window
--   3. SUPPLY domain  — variants with overdue POs or >14-day supply gap
--
-- For each primary signal it probes three correlation axes:
--   team_correlation    — who logged the most waste/consumption and how concentrated?
--   supply_correlation  — days since last receive, open/overdue PO context
--   occupancy_context   — avg 7d occupancy (explains or contradicts demand-driven anomalies)
--
-- correlation_count = number of axes with a notable finding (0–3)
-- incident_severity:
--   critical  = correlation_count ≥ 3, OR waste_rate > 30%
--   elevated  = correlation_count ≥ 2, OR waste_rate > 15%
--   watch     = at least one active signal
--
-- Each row is one incident — not one signal. The narrative field fuses all
-- correlated findings into a single operator-readable sentence.

SET search_path = public;

CREATE OR REPLACE FUNCTION get_active_incidents(
  p_window_days int DEFAULT 7
)
RETURNS TABLE (
  variant_id              uuid,
  variant_label           text,
  category_name           text,
  current_stock           int,
  par_level               int,

  -- Primary signal
  primary_signal_type     text,     -- 'waste_spike' | 'stockout' | 'below_par_sustained' | 'supply_gap'
  primary_signal          text,     -- one-sentence description of the leading signal

  -- Waste domain
  waste_units_7d          int,
  waste_avg_weekly        numeric,
  waste_spike_pct         numeric,  -- how far above baseline (null if no baseline)
  waste_rate_pct          numeric,  -- write-offs / (consumption + write-offs) * 100

  -- Stock domain
  stockout_days           int,      -- days stock hit 0 in window
  below_par_days          int,

  -- Team correlation
  team_correlated         boolean,
  top_actor_email         text,     -- who logged the most anomalous activity
  top_actor_share_pct     numeric,  -- % of waste/consumption logged by top actor

  -- Supply correlation
  supply_correlated       boolean,
  days_since_last_receive int,      -- NULL = never received
  supplier_name           text,
  has_open_po             boolean,
  open_po_overdue         boolean,  -- expected_delivery_date < today

  -- Occupancy context
  occupancy_7d_avg        numeric,  -- NULL = no occupancy data
  occupancy_explains      boolean,  -- true if occ >= 75 (high demand explains stock drop)
  occupancy_contradicts   boolean,  -- true if occ < 50 (low demand makes waste worse)

  -- Synthesis
  correlation_count       int,      -- 0–3: how many domains had notable findings
  incident_severity       text,     -- 'critical' | 'elevated' | 'watch'
  narrative               text      -- fused one-paragraph operator summary
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_hotel_id     uuid;
  v_window_start timestamptz;
BEGIN
  v_hotel_id     := auth_hotel_id();
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  v_window_start := NOW() - (p_window_days || ' days')::interval;

  RETURN QUERY
  WITH

  -- ── 1. Variants ───────────────────────────────────────────────────────────
  variants AS (
    SELECT
      pv.id          AS variant_id,
      p.name || CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END AS variant_label,
      c.name         AS category_name,
      pv.current_stock,
      COALESCE(pv.low_stock_threshold, 0) AS par_level,
      COALESCE(pv.cost, 0)                AS unit_cost
    FROM product_variants pv
    JOIN products p    ON p.id  = pv.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.hotel_id    = v_hotel_id
      AND pv.is_deleted = false
  ),

  -- ── 2. Waste in window ────────────────────────────────────────────────────
  waste_window AS (
    SELECT
      sl.variant_id,
      SUM(ABS(sl.quantity_change))::int AS waste_units_7d
    FROM stock_logs sl
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.quantity_change   < 0
      AND sl.removal_category IN ('Breakage', 'Theft', 'Spoilage', 'Expired', 'Other')
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY sl.variant_id
  ),

  -- ── 3. Consumption in window ──────────────────────────────────────────────
  consumption_window AS (
    SELECT
      sl.variant_id,
      SUM(ABS(sl.quantity_change))::int AS consumption_units
    FROM stock_logs sl
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.quantity_change   < 0
      AND sl.removal_category IS NULL
      AND sl.is_revert          = false
      AND sl.timestamp         >= v_window_start
    GROUP BY sl.variant_id
  ),

  -- ── 4. Waste baseline (weeks 2–4 prior, 3-week avg) ───────────────────────
  waste_baseline AS (
    SELECT
      sl.variant_id,
      COALESCE(
        SUM(ABS(sl.quantity_change)) FILTER (WHERE sl.removal_category IS NOT NULL) / 3.0,
        0
      ) AS avg_weekly
    FROM stock_logs sl
    WHERE sl.hotel_id          = v_hotel_id
      AND sl.quantity_change   < 0
      AND sl.timestamp        >= NOW() - INTERVAL '28 days'
      AND sl.timestamp        <  NOW() - (p_window_days || ' days')::interval
      AND sl.is_revert          = false
    GROUP BY sl.variant_id
  ),

  -- ── 5. Running stock → stockout & below-par days ─────────────────────────
  net_window_change AS (
    SELECT sl.variant_id, SUM(sl.quantity_change) AS net_change
    FROM stock_logs sl
    WHERE sl.hotel_id   = v_hotel_id
      AND sl.timestamp >= v_window_start
      AND sl.is_revert  = false
    GROUP BY sl.variant_id
  ),
  start_stock AS (
    SELECT v.variant_id,
           v.current_stock - COALESCE(nwc.net_change, 0) AS stock_at_start
    FROM variants v
    LEFT JOIN net_window_change nwc ON nwc.variant_id = v.variant_id
  ),
  running_balance AS (
    SELECT sl.variant_id,
           DATE(sl.timestamp AT TIME ZONE 'UTC') AS day,
           ss.stock_at_start + SUM(sl.quantity_change) OVER (
             PARTITION BY sl.variant_id ORDER BY sl.timestamp
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS running_stock
    FROM stock_logs sl
    JOIN start_stock ss ON ss.variant_id = sl.variant_id
    WHERE sl.hotel_id   = v_hotel_id
      AND sl.timestamp >= v_window_start
      AND sl.is_revert  = false
  ),
  daily_min AS (
    SELECT rb.variant_id, rb.day, MIN(rb.running_stock) AS min_stock
    FROM running_balance rb
    GROUP BY rb.variant_id, rb.day
  ),
  availability AS (
    SELECT
      dm.variant_id,
      COUNT(DISTINCT dm.day) FILTER (WHERE dm.min_stock <= 0)::int        AS stockout_days,
      COUNT(DISTINCT dm.day) FILTER (
        WHERE dm.min_stock < COALESCE(
          (SELECT par_level FROM variants v2 WHERE v2.variant_id = dm.variant_id), 0
        )
      )::int AS below_par_days
    FROM daily_min dm
    GROUP BY dm.variant_id
  ),

  -- ── 6. Top actor per variant (waste + consumption) ────────────────────────
  actor_activity AS (
    SELECT
      sl.variant_id,
      u.email,
      SUM(ABS(sl.quantity_change))::int AS activity_units
    FROM stock_logs sl
    LEFT JOIN users u ON u.id = sl.user_id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= v_window_start
    GROUP BY sl.variant_id, u.email
  ),
  total_activity AS (
    SELECT variant_id, SUM(activity_units) AS total_units
    FROM actor_activity
    GROUP BY variant_id
  ),
  top_actor AS (
    SELECT DISTINCT ON (aa.variant_id)
      aa.variant_id,
      aa.email               AS top_actor_email,
      ROUND(aa.activity_units::numeric / NULLIF(ta.total_units, 0) * 100, 1) AS top_actor_share_pct
    FROM actor_activity aa
    JOIN total_activity ta ON ta.variant_id = aa.variant_id
    ORDER BY aa.variant_id, aa.activity_units DESC
  ),

  -- ── 7. Supply context ─────────────────────────────────────────────────────
  last_receive AS (
    SELECT DISTINCT ON (rr.variant_id)
      rr.variant_id,
      EXTRACT(DAY FROM NOW() - rr.received_at)::int AS days_since,
      s.name AS supplier_name
    FROM restock_receives rr
    LEFT JOIN suppliers s ON s.id = rr.supplier_id
    WHERE rr.hotel_id = v_hotel_id
    ORDER BY rr.variant_id, rr.received_at DESC
  ),
  open_po AS (
    SELECT DISTINCT ON (pl.variant_id)
      pl.variant_id,
      po.expected_delivery_date < CURRENT_DATE AS is_overdue
    FROM po_lines pl
    JOIN purchase_orders po ON po.id = pl.po_id
    WHERE po.hotel_id = v_hotel_id
      AND po.status  IN ('sent', 'confirmed', 'partially_received')
    ORDER BY pl.variant_id, po.created_at DESC
  ),

  -- ── 8. Occupancy last 7d ──────────────────────────────────────────────────
  occ AS (
    SELECT ROUND(AVG(occupancy_pct)::numeric, 1) AS avg_occ
    FROM occupancy_logs
    WHERE hotel_id = v_hotel_id
      AND date >= CURRENT_DATE - p_window_days
  ),

  -- ── 9. Candidate incidents: variants with at least one active signal ──────
  candidates AS (
    SELECT
      v.variant_id,
      v.variant_label,
      v.category_name,
      v.current_stock,
      v.par_level,
      v.unit_cost,

      COALESCE(ww.waste_units_7d, 0)  AS waste_units_7d,
      COALESCE(wb.avg_weekly, 0)      AS waste_avg_weekly,
      COALESCE(cw.consumption_units, 0) AS consumption_units,

      COALESCE(av.stockout_days,   0) AS stockout_days,
      COALESCE(av.below_par_days,  0) AS below_par_days,

      ta.top_actor_email,
      COALESCE(ta.top_actor_share_pct, 0) AS top_actor_share_pct,

      lr.days_since   AS days_since_last_receive,
      lr.supplier_name,
      (op.variant_id IS NOT NULL) AS has_open_po,
      COALESCE(op.is_overdue, false) AS open_po_overdue,

      COALESCE(o.avg_occ, 0) AS occupancy_7d_avg,
      o.avg_occ IS NULL      AS no_occ_data,

      -- Pre-compute correlation count so severity and ORDER BY can reference it cleanly
      (
        CASE WHEN ta.top_actor_email IS NOT NULL
              AND COALESCE(ta.top_actor_share_pct, 0) >= 50
             THEN 1 ELSE 0 END +
        CASE WHEN (EXTRACT(DAY FROM NOW() - lr.received_at)::int > 14
                   AND op.variant_id IS NULL)
              OR COALESCE(op.is_overdue, false)
             THEN 1 ELSE 0 END +
        CASE WHEN o.avg_occ IS NOT NULL
              AND (COALESCE(o.avg_occ, 0) >= 75 OR COALESCE(o.avg_occ, 0) < 50)
             THEN 1 ELSE 0 END
      ) AS corr_count

    FROM variants v
    LEFT JOIN waste_window       ww ON ww.variant_id = v.variant_id
    LEFT JOIN waste_baseline     wb ON wb.variant_id = v.variant_id
    LEFT JOIN consumption_window cw ON cw.variant_id = v.variant_id
    LEFT JOIN availability       av ON av.variant_id = v.variant_id
    LEFT JOIN top_actor          ta ON ta.variant_id = v.variant_id
    LEFT JOIN last_receive       lr ON lr.variant_id = v.variant_id
    LEFT JOIN open_po            op ON op.variant_id = v.variant_id
    CROSS JOIN occ               o

    WHERE
      -- At least one active signal
      (COALESCE(ww.waste_units_7d, 0) > 0 AND (
         wb.avg_weekly = 0 OR
         COALESCE(ww.waste_units_7d, 0) > wb.avg_weekly * 1.5
       ))
      OR COALESCE(av.stockout_days,   0) >= 1
      OR COALESCE(av.below_par_days,  0)::numeric / p_window_days > 0.40
      OR (lr.days_since > 14 AND v.current_stock < COALESCE(v.par_level, 0) * 1.5)
  )

  -- ── 10. Compute correlation axes and synthesise narrative ────────────────
  SELECT
    c.variant_id,
    c.variant_label,
    c.category_name,
    c.current_stock,
    c.par_level,

    -- Primary signal type: whichever is most severe
    CASE
      WHEN c.waste_avg_weekly > 0 AND c.waste_units_7d > c.waste_avg_weekly * 1.5 THEN 'waste_spike'
      WHEN c.stockout_days >= 1                                                     THEN 'stockout'
      WHEN c.below_par_days::numeric / p_window_days > 0.40                         THEN 'below_par_sustained'
      ELSE 'supply_gap'
    END AS primary_signal_type,

    -- Primary signal sentence
    CASE
      WHEN c.waste_avg_weekly > 0 AND c.waste_units_7d > c.waste_avg_weekly * 1.5
        THEN c.variant_label || ': ' || c.waste_units_7d || ' write-offs this week vs '
             || ROUND(c.waste_avg_weekly, 1) || ' 3-week avg ('
             || ROUND((c.waste_units_7d - c.waste_avg_weekly) / NULLIF(c.waste_avg_weekly,0)*100,0)
             || '% above baseline)'
      WHEN c.stockout_days >= 1
        THEN c.variant_label || ': stock hit zero on ' || c.stockout_days || ' day'
             || CASE WHEN c.stockout_days > 1 THEN 's' ELSE '' END || ' in window'
      WHEN c.below_par_days::numeric / p_window_days > 0.40
        THEN c.variant_label || ': below PAR (' || c.par_level || ') for '
             || c.below_par_days || ' of ' || p_window_days || ' days'
      ELSE c.variant_label || ': ' || COALESCE(c.days_since_last_receive::text, 'no') || ' days since last receive'
    END AS primary_signal,

    c.waste_units_7d,
    ROUND(c.waste_avg_weekly, 2) AS waste_avg_weekly,

    CASE WHEN c.waste_avg_weekly > 0
         THEN ROUND((c.waste_units_7d - c.waste_avg_weekly) / c.waste_avg_weekly * 100, 1)
         ELSE NULL END AS waste_spike_pct,

    CASE WHEN c.consumption_units + c.waste_units_7d > 0
         THEN ROUND(c.waste_units_7d::numeric / (c.consumption_units + c.waste_units_7d) * 100, 1)
         ELSE NULL END AS waste_rate_pct,

    c.stockout_days,
    c.below_par_days,

    -- Team correlation: share > 50% is notable
    (c.top_actor_email IS NOT NULL AND c.top_actor_share_pct >= 50) AS team_correlated,
    c.top_actor_email,
    c.top_actor_share_pct,

    -- Supply correlation: notable if >14d gap AND no open PO, or overdue PO
    (
      (c.days_since_last_receive > 14 AND NOT c.has_open_po)
      OR c.open_po_overdue
    ) AS supply_correlated,
    c.days_since_last_receive,
    c.supplier_name,
    c.has_open_po,
    c.open_po_overdue,

    NULLIF(c.occupancy_7d_avg, 0) AS occupancy_7d_avg,
    (NOT c.no_occ_data AND c.occupancy_7d_avg >= 75) AS occupancy_explains,
    (NOT c.no_occ_data AND c.occupancy_7d_avg < 50)  AS occupancy_contradicts,

    -- Correlation count (from pre-computed value in candidates CTE)
    c.corr_count AS correlation_count,

    -- Severity
    CASE
      WHEN c.corr_count >= 3
        OR (c.waste_avg_weekly > 0
            AND c.waste_units_7d::numeric / NULLIF(c.waste_avg_weekly, 0) > 1.5
            AND (c.consumption_units + c.waste_units_7d) > 0
            AND c.waste_units_7d::numeric / (c.consumption_units + c.waste_units_7d) > 0.30)
        THEN 'critical'
      WHEN c.corr_count >= 2
        OR (c.waste_avg_weekly > 0
            AND (c.consumption_units + c.waste_units_7d) > 0
            AND c.waste_units_7d::numeric / (c.consumption_units + c.waste_units_7d) > 0.15)
        THEN 'elevated'
      ELSE 'watch'
    END AS incident_severity,

    -- Narrative: fused cross-domain summary
    CONCAT_WS(' ',
      -- Waste thread
      CASE WHEN c.waste_avg_weekly > 0 AND c.waste_units_7d > c.waste_avg_weekly * 1.5
        THEN ROUND((c.waste_units_7d - c.waste_avg_weekly) / NULLIF(c.waste_avg_weekly,0)*100,0)::text
             || '% waste spike on ' || c.variant_label || '.'
      END,
      -- Team thread
      CASE WHEN c.top_actor_email IS NOT NULL AND c.top_actor_share_pct >= 50
        THEN c.top_actor_email || ' logged ' || ROUND(c.top_actor_share_pct)::text || '% of activity.'
      END,
      -- Occupancy thread
      CASE
        WHEN NOT c.no_occ_data AND c.occupancy_7d_avg < 50
          THEN 'Occupancy only ' || ROUND(c.occupancy_7d_avg)::text || '% — waste not explained by demand.'
        WHEN NOT c.no_occ_data AND c.occupancy_7d_avg >= 75
          THEN 'High occupancy (' || ROUND(c.occupancy_7d_avg)::text || '%) — elevated demand context.'
      END,
      -- Supply thread
      CASE
        WHEN c.open_po_overdue
          THEN 'PO overdue from ' || COALESCE(c.supplier_name, 'supplier') || '.'
        WHEN c.days_since_last_receive > 14 AND NOT c.has_open_po
          THEN 'No receive for ' || c.days_since_last_receive || ' days, no open PO.'
      END,
      -- Stock thread
      CASE
        WHEN c.stockout_days >= 1
          THEN 'Stockout ' || c.stockout_days || ' day' || CASE WHEN c.stockout_days > 1 THEN 's' ELSE '' END || '.'
        WHEN c.below_par_days::numeric / p_window_days > 0.40
          THEN 'Below PAR for ' || c.below_par_days || '/' || p_window_days || ' days.'
      END
    ) AS narrative

  FROM candidates c

  ORDER BY
    CASE
      WHEN c.corr_count >= 3
        OR (c.waste_avg_weekly > 0
            AND c.waste_units_7d::numeric / NULLIF(c.waste_avg_weekly, 0) > 1.5
            AND (c.consumption_units + c.waste_units_7d) > 0
            AND c.waste_units_7d::numeric / (c.consumption_units + c.waste_units_7d) > 0.30)
        THEN 0
      WHEN c.corr_count >= 2
        OR (c.waste_avg_weekly > 0
            AND (c.consumption_units + c.waste_units_7d) > 0
            AND c.waste_units_7d::numeric / (c.consumption_units + c.waste_units_7d) > 0.15)
        THEN 1
      ELSE 2
    END,
    c.waste_units_7d DESC,
    c.variant_label
  ;

END;
$$;

GRANT EXECUTE ON FUNCTION get_active_incidents(int) TO authenticated;
