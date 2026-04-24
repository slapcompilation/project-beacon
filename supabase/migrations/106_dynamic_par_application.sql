-- ═══════════════════════════════════════════════════════════════════════════════
-- 106 — Dynamic PAR Application (Demand Sensing Refinement)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Close the loop between compute_optimal_par() (migration 084) and the actual
--   PAR levels stored in product_variants.low_stock_threshold. Currently the
--   engine calculates probabilistic PAR but never applies the results.
--
--   This migration:
--   1. Adds par_source column to distinguish manual vs auto-computed PAR
--   2. Creates apply_optimal_par() RPC that runs the engine and updates variants
--   3. Schedules weekly PAR recalculation via pg_cron (Sundays 04:00 UTC)
--
-- Depends on: 084 (compute_optimal_par)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add par_source column ───────────────────────────────────────────────────
-- 'manual' = operator set this PAR explicitly, auto-engine won't overwrite
-- 'auto'   = engine-managed, auto-updated weekly based on consumption + occupancy

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS par_source text NOT NULL DEFAULT 'manual'
    CHECK (par_source IN ('manual', 'auto'));

COMMENT ON COLUMN product_variants.par_source IS
  'Whether low_stock_threshold is set manually by an operator or auto-computed '
  'by apply_optimal_par(). Variants with par_source = ''auto'' are updated weekly.';

-- ─── 2. apply_optimal_par() RPC ─────────────────────────────────────────────────
-- Runs compute_optimal_par() and applies recommended values to product_variants.
-- Only updates variants meeting confidence and source criteria.
--
-- Parameters:
--   p_service_level: target service level (0.95 = 95% fill rate, default)
--   p_only_auto:     when true, only update variants with par_source = 'auto' (default)
--                    when false, updates all variants regardless of par_source
--
-- Returns: table of all changes made for audit/transparency.

CREATE OR REPLACE FUNCTION apply_optimal_par(
  p_service_level float8 DEFAULT 0.95,
  p_only_auto     boolean DEFAULT true
)
RETURNS TABLE (
  variant_id       uuid,
  product_name     text,
  sku              text,
  old_par          int,
  new_par          int,
  par_delta        int,
  change_type      text,
  confidence_score float8,
  rationale        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      opar.variant_id,
      opar.product_name,
      opar.sku,
      opar.current_par          AS old_par,
      opar.recommended_par      AS new_par,
      opar.par_delta,
      opar.change_type,
      opar.confidence_score,
      opar.rationale,
      pv.par_source
    FROM compute_optimal_par(p_service_level) opar
    JOIN product_variants pv ON pv.id = opar.variant_id
    WHERE opar.change_type IN ('increase', 'decrease')  -- skip no_data / calibrated / no_lead_time
      AND opar.confidence_score >= 0.5                   -- don't apply low-confidence recommendations
      AND opar.recommended_par <> opar.current_par       -- actual change needed
      AND (
        NOT p_only_auto                                  -- override: update all
        OR pv.par_source = 'auto'                        -- default: only auto-managed variants
      )
  LOOP
    -- Apply the new PAR level
    UPDATE product_variants
       SET low_stock_threshold = v_row.new_par,
           par_source          = 'auto'
     WHERE id = v_row.variant_id;

    -- Return the change for audit
    variant_id       := v_row.variant_id;
    product_name     := v_row.product_name;
    sku              := v_row.sku;
    old_par          := v_row.old_par;
    new_par          := v_row.new_par;
    par_delta        := v_row.par_delta;
    change_type      := v_row.change_type;
    confidence_score := v_row.confidence_score;
    rationale        := v_row.rationale;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_optimal_par(float8, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_optimal_par(float8, boolean) TO service_role;

-- ─── 3. Weekly PAR cron schedule ────────────────────────────────────────────────
-- Runs Sundays 04:00 UTC (before Monday operations begin).
-- Only updates par_source = 'auto' variants (p_only_auto = true).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — weekly PAR schedule not applied. Enable pg_cron and re-run.';
    RETURN;
  END IF;

  -- Clear stale job if exists
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname = 'beacon-weekly-par-update';

  -- Schedule weekly PAR recalculation
  PERFORM cron.schedule(
    'beacon-weekly-par-update',
    '0 4 * * 0',
    'SELECT * FROM apply_optimal_par(0.95, true)'
  );

  RAISE NOTICE 'Weekly PAR update scheduled: Sundays 04:00 UTC.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Summary:
--   - product_variants.par_source: 'manual' (default) or 'auto'
--   - apply_optimal_par(): runs compute_optimal_par + applies results
--   - Weekly cron: Sundays 04:00 UTC for auto-managed variants
--
-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ PAR Update Flow:                                                          │
-- │   compute_optimal_par(0.95)                                               │
-- │     → filter: change_type IN (increase, decrease)                         │
-- │     → filter: confidence_score >= 0.5                                     │
-- │     → filter: par_source = 'auto' (or all if p_only_auto = false)         │
-- │     → UPDATE product_variants SET low_stock_threshold = recommended_par   │
-- └────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════
