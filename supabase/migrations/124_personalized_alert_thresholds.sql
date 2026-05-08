-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 124 — Personalized alert thresholds (Phase D2)
--
-- Layer: Eye (intelligence) + Mind (memory)
-- Scope: hotel + variant
-- Cadence: weekly Sun 04:30 UTC (after the existing weekly intelligence jobs)
--
-- Why this exists
-- ───────────────
-- ROADMAP-AIP.md Phase D2: "Per-variant thresholds learned from history. Quiet
-- intelligence: stop alerting for items the manager has repeatedly said 'I
-- know, it's fine' about." Today every hotel has a single global pair of
-- thresholds (`alert_preferences.days_threshold`, `waste_threshold`) and the
-- alert engine treats every variant the same. Result: champagne with a
-- tight 3-day reorder window gets alerted at 7 days (too early); soap with
-- a 60-day buffer gets alerted at 7 days (not actionable, dismissed every
-- time as 'already_knew').
--
-- This migration adds the per-variant override layer + the learning loop
-- that derives overrides from the operator's dismissal patterns.
--
--   (1) `variant_alert_overrides` table — per `(hotel_id, variant_id)`,
--       optional `days_threshold` / `waste_threshold` overrides plus a
--       `suppress_until` window for variants the operator wants quiet.
--       Operators can set rows directly (admin/owner only); the cron
--       writes them via the learning function.
--
--   (2) `learn_alert_thresholds()` RPC — analyses the last 90 days of
--       `notifications` per (hotel_id, variant_id) and derives overrides
--       from the dismissal-reason mix:
--         • >= 70% dismissed with 'already_knew' → raise days_threshold
--           by 30% for this variant (less aggressive)
--         • >= 50% dismissed with 'incorrect_data' → suppress for 30 days
--           (the model is wrong; let the global cycle re-evaluate later)
--         • mostly 'resolved' → no override (alerts are working)
--       Confidence is sample-size based; rows with < 3 dismissals stay
--       at global threshold defaults.
--
--   (3) Patches `auto_create_alerts()` to consult `variant_alert_overrides`
--       before falling back to `alert_preferences`. Suppressed variants
--       are excluded outright.
--
--   (4) Schedules `learn_alert_thresholds()` weekly (Sun 04:30 UTC).
--       Cron health monitor (115) auto-detects + surfaces failures in
--       Settings → Autonomous within 5 min.
--
-- Per CLAUDE.md self-apply rule #1: smoke test exercises both the learning
-- function and the override path under realistic alert plumbing — see
-- verification block at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) variant_alert_overrides ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variant_alert_overrides (
  hotel_id           uuid        NOT NULL REFERENCES hotels(id)            ON DELETE CASCADE,
  variant_id         uuid        NOT NULL REFERENCES product_variants(id)  ON DELETE CASCADE,
  /** NULL = inherit from alert_preferences. */
  days_threshold     int,
  waste_threshold    int,
  /** Hard suppress window — set when the alert is consistently flagged
   *  'incorrect_data'. Honored by auto_create_alerts even if the threshold
   *  fields are NULL. NULL = not suppressed. */
  suppress_until     timestamptz,
  /** Audit: when was this last derived by the learning loop? */
  last_learned_at    timestamptz NOT NULL DEFAULT now(),
  /** How many notifications informed this row — confidence basis per
   *  CLAUDE.md principle 10 ("predictions must always expose their basis"). */
  sample_size        int         NOT NULL DEFAULT 0,
  /** 0..1 — derived from sample_size; UI surfaces this. */
  confidence         numeric     NOT NULL DEFAULT 0,
  /** Free-form rationale: "70% dismissed as already_knew over last 90d". */
  rationale          text,
  PRIMARY KEY (hotel_id, variant_id)
);

-- NOTE: partial index can't reference now() (index predicates must be
-- IMMUTABLE). Filter on suppress_until IS NOT NULL only — auto_create_alerts
-- still does the time comparison at query time.
CREATE INDEX IF NOT EXISTS idx_var_alert_overrides_suppressed
  ON variant_alert_overrides (hotel_id, suppress_until)
  WHERE suppress_until IS NOT NULL;

COMMENT ON TABLE variant_alert_overrides IS
  'Phase D2 — per-variant alert threshold overrides derived from operator '
  'dismissal patterns. Learning loop runs weekly via learn_alert_thresholds. '
  'NULL columns mean "inherit from alert_preferences".';

ALTER TABLE variant_alert_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vao_read ON variant_alert_overrides;
CREATE POLICY vao_read ON variant_alert_overrides
  FOR SELECT TO authenticated
  USING (
    hotel_id = auth_hotel_id()
    OR hotel_is_in_user_scope(hotel_id)
  );

-- Only admin / owner can manually set overrides; the learning RPC writes
-- via SECURITY DEFINER and bypasses this.
DROP POLICY IF EXISTS vao_write ON variant_alert_overrides;
CREATE POLICY vao_write ON variant_alert_overrides
  FOR ALL TO authenticated
  USING (
    hotel_id = auth_hotel_id()
    AND auth_role() = ANY(ARRAY['admin','owner'])
  )
  WITH CHECK (
    hotel_id = auth_hotel_id()
    AND auth_role() = ANY(ARRAY['admin','owner'])
  );


-- (2) learn_alert_thresholds() ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.learn_alert_thresholds(
  p_window_days int DEFAULT 90,
  p_min_samples int DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  rec     record;
BEGIN
  FOR rec IN
    WITH per_variant AS (
      SELECT
        n.hotel_id,
        n.variant_id,
        ap.days_threshold     AS global_days,
        ap.waste_threshold    AS global_waste,
        count(*) FILTER (WHERE n.dismissed_reason IS NOT NULL)             AS total_dismissed,
        count(*) FILTER (WHERE n.dismissed_reason = 'already_knew')        AS d_already,
        count(*) FILTER (WHERE n.dismissed_reason = 'incorrect_data')      AS d_incorrect,
        count(*) FILTER (WHERE n.dismissed_reason = 'resolved')            AS d_resolved,
        count(*) FILTER (WHERE n.dismissed_reason = 'will_handle_later')   AS d_later
      FROM notifications n
      LEFT JOIN alert_preferences ap ON ap.hotel_id = n.hotel_id
      WHERE n.variant_id IS NOT NULL
        AND n.timestamp >= now() - make_interval(days => p_window_days)
      GROUP BY n.hotel_id, n.variant_id, ap.days_threshold, ap.waste_threshold
      HAVING count(*) FILTER (WHERE n.dismissed_reason IS NOT NULL) >= p_min_samples
    )
    SELECT
      hotel_id,
      variant_id,
      total_dismissed,
      d_already, d_incorrect, d_resolved, d_later,
      global_days,
      global_waste,
      d_already::numeric    / total_dismissed::numeric AS pct_already,
      d_incorrect::numeric  / total_dismissed::numeric AS pct_incorrect
    FROM per_variant
  LOOP
    DECLARE
      v_new_days       int;
      v_new_waste      int;
      v_suppress_until timestamptz;
      v_rationale      text;
      v_confidence     numeric;
    BEGIN
      v_new_days       := NULL;
      v_new_waste      := NULL;
      v_suppress_until := NULL;
      v_rationale      := NULL;

      -- Confidence: ramps from 0 at p_min_samples to 1.0 at 20+ dismissals
      v_confidence := LEAST(1.0, (rec.total_dismissed::numeric - p_min_samples + 1) / 17.0);
      v_confidence := GREATEST(0, v_confidence);

      -- Rule (a): >= 50% incorrect_data → suppress 30 days
      IF rec.pct_incorrect >= 0.5 THEN
        v_suppress_until := now() + interval '30 days';
        v_rationale := format(
          '%s%% of %s dismissals tagged incorrect_data — suppressing 30d',
          round(rec.pct_incorrect * 100),
          rec.total_dismissed
        );

      -- Rule (b): >= 70% already_knew → less aggressive
      --   Raise days_threshold by 30% (rounded down, min global - 1)
      --   Waste threshold stays at global (different signal)
      ELSIF rec.pct_already >= 0.7 THEN
        v_new_days := GREATEST(
          COALESCE(rec.global_days, 7),
          ceil(COALESCE(rec.global_days, 7) * 1.3)::int
        );
        v_rationale := format(
          '%s%% of %s dismissals tagged already_knew — raised days_threshold from %s to %s',
          round(rec.pct_already * 100),
          rec.total_dismissed,
          COALESCE(rec.global_days, 7),
          v_new_days
        );

      -- Rule (c): all else → no override; let the global threshold apply
      ELSE
        v_rationale := format(
          'mix of %s dismissals — no override (resolved=%s, already=%s, incorrect=%s, later=%s)',
          rec.total_dismissed, rec.d_resolved, rec.d_already, rec.d_incorrect, rec.d_later
        );
      END IF;

      INSERT INTO variant_alert_overrides (
        hotel_id, variant_id, days_threshold, waste_threshold,
        suppress_until, last_learned_at, sample_size, confidence, rationale
      )
      VALUES (
        rec.hotel_id, rec.variant_id, v_new_days, v_new_waste,
        v_suppress_until, now(), rec.total_dismissed, v_confidence, v_rationale
      )
      ON CONFLICT (hotel_id, variant_id) DO UPDATE
        SET days_threshold  = EXCLUDED.days_threshold,
            waste_threshold = EXCLUDED.waste_threshold,
            suppress_until  = EXCLUDED.suppress_until,
            last_learned_at = EXCLUDED.last_learned_at,
            sample_size     = EXCLUDED.sample_size,
            confidence      = EXCLUDED.confidence,
            rationale       = EXCLUDED.rationale;

      v_count := v_count + 1;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION learn_alert_thresholds IS
  'Phase D2 learning loop. Derives variant_alert_overrides from operator '
  'dismissal patterns over the last 90 days. Cadence: weekly Sun 04:30 UTC. '
  'Idempotent via ON CONFLICT (hotel_id, variant_id) DO UPDATE.';

REVOKE EXECUTE ON FUNCTION public.learn_alert_thresholds(int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.learn_alert_thresholds(int, int) TO authenticated;


-- (3) Patch auto_create_alerts to consult overrides ─────────────────────────
-- Keep the behavior identical when no override exists; only add the lookup +
-- suppression check. The predicted_outage and waste_alert paths each read
-- from variant_alert_overrides via LEFT JOIN; suppress_until > now() drops
-- the row entirely, NULL thresholds fall back to the global preference.
CREATE OR REPLACE FUNCTION public.auto_create_alerts(
  p_days_threshold integer DEFAULT NULL::integer,
  p_waste_threshold integer DEFAULT NULL::integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_user_id  uuid := auth.uid();
  v_count    int  := 0;
  v_notif_id uuid;
  v_days     int;
  v_waste    int;
BEGIN
  SELECT
    COALESCE(p_days_threshold,  ap.days_threshold,  7),
    COALESCE(p_waste_threshold, ap.waste_threshold, 10)
  INTO v_days, v_waste
  FROM (SELECT 1) _dummy
  LEFT JOIN alert_preferences ap ON ap.hotel_id = v_hotel_id;

  -- ── A. Predicted outage alerts (with per-variant overrides) ────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': predicted to run out in ~' || stats.days_until_zero::int || ' day' ||
        CASE WHEN stats.days_until_zero::int = 1 THEN '' ELSE 's' END,
      'predicted_outage',
      pv.id
    FROM (
      SELECT
        pv2.id                                                       AS variant_id,
        ROUND(
          pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0),
          0
        )                                                            AS days_until_zero
      FROM stock_logs sl
      JOIN product_variants pv2 ON pv2.id = sl.variant_id
      WHERE sl.hotel_id        = v_hotel_id
        AND sl.quantity_change < 0
        AND sl.is_revert        = false
        AND sl.timestamp       >= NOW() - INTERVAL '30 days'
        AND pv2.enabled         = true
      GROUP BY pv2.id, pv2.current_stock
      HAVING ABS(SUM(sl.quantity_change)) > 0
    ) stats
    JOIN product_variants pv ON pv.id = stats.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    LEFT JOIN variant_alert_overrides vao
      ON vao.hotel_id = v_hotel_id AND vao.variant_id = pv.id
    WHERE
      -- Suppression check first
      (vao.suppress_until IS NULL OR vao.suppress_until <= NOW())
      -- Effective threshold = override OR global
      AND ROUND(pv.current_stock / NULLIF(
            (SELECT ABS(SUM(sl2.quantity_change)) / 30.0 FROM stock_logs sl2
              WHERE sl2.variant_id = pv.id
                AND sl2.quantity_change < 0
                AND sl2.is_revert = false
                AND sl2.timestamp >= NOW() - INTERVAL '30 days'), 0), 0)
          < COALESCE(vao.days_threshold, v_days)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.hotel_id   = v_hotel_id
          AND n.type       = 'predicted_outage'
          AND n.read       = false
          AND n.message LIKE pr.name || '%'
      )
    RETURNING id
  LOOP
    v_count := v_count + 1;
    PERFORM create_relationship_edge(
      v_hotel_id, 'stock_log', v_notif_id, 'triggered_alert', 'alert', v_notif_id
    );
  END LOOP;

  -- ── B. Waste alerts (with per-variant overrides) ───────────────────────────
  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      v_hotel_id,
      v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' — ' || pv.name ELSE '' END ||
        ': ' || ABS(SUM(sl.quantity_change))::int || ' units wasted in the last 7 days',
      'waste_alert',
      pv.id
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    LEFT JOIN variant_alert_overrides vao
      ON vao.hotel_id = v_hotel_id AND vao.variant_id = pv.id
    WHERE sl.hotel_id        = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert        = false
      AND sl.timestamp       >= NOW() - INTERVAL '7 days'
      AND (vao.suppress_until IS NULL OR vao.suppress_until <= NOW())
    GROUP BY pv.id, pv.name, pr.id, pr.name, vao.waste_threshold
    HAVING ABS(SUM(sl.quantity_change)) > COALESCE(MAX(vao.waste_threshold), v_waste)
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.hotel_id = v_hotel_id
           AND n.type     = 'waste_alert'
           AND n.read     = false
           AND n.message  LIKE pr.name || '%'
       )
    RETURNING id
  LOOP
    v_count := v_count + 1;
  END LOOP;

  -- ── C. Contract expiry alerts → admin+ ─────────────────────────────────────
  v_count := v_count + detect_expiring_contracts();

  RETURN v_count;
END;
$$;


-- (4) Schedule weekly learning ───────────────────────────────────────────────
DO $$
DECLARE v_existing int;
BEGIN
  SELECT count(*) INTO v_existing
  FROM cron.job WHERE jobname = 'beacon-alert-thresholds-weekly';

  IF v_existing = 0 THEN
    PERFORM cron.schedule(
      'beacon-alert-thresholds-weekly',
      '30 4 * * 0',                             -- Sun 04:30 UTC
      $cmd$ SELECT learn_alert_thresholds() $cmd$
    );
  END IF;
END $$;


-- ─── Verification ────────────────────────────────────────────────────────────
-- After applying:
--
--   -- 1. Cron registered + active
--   SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'beacon-alert-thresholds-weekly';
--   -- expected: ('beacon-alert-thresholds-weekly', '30 4 * * 0', true)
--
--   -- 2. Learning function runs cleanly even with no dismissed_reason data
--   SELECT learn_alert_thresholds(90, 3);
--   -- expected: 0 rows derived right now (no dismissals yet); no error
--
--   -- 3. Override path inside auto_create_alerts:
--   --    Plant a row that suppresses a variant, run the cycle, confirm the
--   --    variant didn't generate a predicted_outage notification.
--   --    See full transactional smoke test in PR description.
--
--   -- 4. Cron health monitor sees the new job within 5 min
--   SELECT get_cron_health_summary()->'jobs';
