-- Recovered from supabase_migrations version 20260508193308.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

CREATE TABLE IF NOT EXISTS variant_alert_overrides (
  hotel_id           uuid        NOT NULL REFERENCES hotels(id)            ON DELETE CASCADE,
  variant_id         uuid        NOT NULL REFERENCES product_variants(id)  ON DELETE CASCADE,
  days_threshold     int,
  waste_threshold    int,
  suppress_until     timestamptz,
  last_learned_at    timestamptz NOT NULL DEFAULT now(),
  sample_size        int         NOT NULL DEFAULT 0,
  confidence         numeric     NOT NULL DEFAULT 0,
  rationale          text,
  PRIMARY KEY (hotel_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_var_alert_overrides_suppressed
  ON variant_alert_overrides (hotel_id, suppress_until)
  WHERE suppress_until IS NOT NULL;

ALTER TABLE variant_alert_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vao_read ON variant_alert_overrides;
CREATE POLICY vao_read ON variant_alert_overrides
  FOR SELECT TO authenticated
  USING (
    hotel_id = auth_hotel_id()
    OR hotel_is_in_user_scope(hotel_id)
  );

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
      hotel_id, variant_id, total_dismissed,
      d_already, d_incorrect, d_resolved, d_later,
      global_days, global_waste,
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

      v_confidence := LEAST(1.0, (rec.total_dismissed::numeric - p_min_samples + 1) / 17.0);
      v_confidence := GREATEST(0, v_confidence);

      IF rec.pct_incorrect >= 0.5 THEN
        v_suppress_until := now() + interval '30 days';
        v_rationale := format(
          '%s%% of %s dismissals tagged incorrect_data - suppressing 30d',
          round(rec.pct_incorrect * 100), rec.total_dismissed
        );
      ELSIF rec.pct_already >= 0.7 THEN
        v_new_days := GREATEST(
          COALESCE(rec.global_days, 7),
          ceil(COALESCE(rec.global_days, 7) * 1.3)::int
        );
        v_rationale := format(
          '%s%% of %s dismissals tagged already_knew - raised days_threshold from %s to %s',
          round(rec.pct_already * 100), rec.total_dismissed,
          COALESCE(rec.global_days, 7), v_new_days
        );
      ELSE
        v_rationale := format(
          'mix of %s dismissals - no override (resolved=%s, already=%s, incorrect=%s, later=%s)',
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

REVOKE EXECUTE ON FUNCTION public.learn_alert_thresholds(int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.learn_alert_thresholds(int, int) TO authenticated;

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

  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      v_hotel_id, v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' - ' || pv.name ELSE '' END ||
        ': predicted to run out in ~' || stats.days_until_zero::int || ' day' ||
        CASE WHEN stats.days_until_zero::int = 1 THEN '' ELSE 's' END,
      'predicted_outage', pv.id
    FROM (
      SELECT pv2.id AS variant_id,
             ROUND(pv2.current_stock / NULLIF(ABS(SUM(sl.quantity_change)) / 30.0, 0), 0) AS days_until_zero
      FROM stock_logs sl
      JOIN product_variants pv2 ON pv2.id = sl.variant_id
      WHERE sl.hotel_id = v_hotel_id
        AND sl.quantity_change < 0
        AND sl.is_revert = false
        AND sl.timestamp >= NOW() - INTERVAL '30 days'
        AND pv2.enabled = true
      GROUP BY pv2.id, pv2.current_stock
      HAVING ABS(SUM(sl.quantity_change)) > 0
    ) stats
    JOIN product_variants pv ON pv.id = stats.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    LEFT JOIN variant_alert_overrides vao
      ON vao.hotel_id = v_hotel_id AND vao.variant_id = pv.id
    WHERE
      (vao.suppress_until IS NULL OR vao.suppress_until <= NOW())
      AND ROUND(pv.current_stock / NULLIF(
            (SELECT ABS(SUM(sl2.quantity_change)) / 30.0 FROM stock_logs sl2
              WHERE sl2.variant_id = pv.id
                AND sl2.quantity_change < 0
                AND sl2.is_revert = false
                AND sl2.timestamp >= NOW() - INTERVAL '30 days'), 0), 0)
          < COALESCE(vao.days_threshold, v_days)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.hotel_id = v_hotel_id
          AND n.type     = 'predicted_outage'
          AND n.read     = false
          AND n.message LIKE pr.name || '%'
      )
    RETURNING id
  LOOP
    v_count := v_count + 1;
    PERFORM create_relationship_edge(
      v_hotel_id, 'stock_log', v_notif_id, 'triggered_alert', 'alert', v_notif_id
    );
  END LOOP;

  FOR v_notif_id IN
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT
      v_hotel_id, v_user_id,
      pr.name ||
        CASE WHEN pv.name <> 'Standard' THEN ' - ' || pv.name ELSE '' END ||
        ': ' || ABS(SUM(sl.quantity_change))::int || ' units wasted in the last 7 days',
      'waste_alert', pv.id
    FROM stock_logs sl
    JOIN product_variants pv ON pv.id = sl.variant_id
    JOIN products pr         ON pr.id = pv.product_id
    LEFT JOIN variant_alert_overrides vao
      ON vao.hotel_id = v_hotel_id AND vao.variant_id = pv.id
    WHERE sl.hotel_id = v_hotel_id
      AND sl.quantity_change < 0
      AND sl.is_revert = false
      AND sl.timestamp >= NOW() - INTERVAL '7 days'
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

  v_count := v_count + detect_expiring_contracts();

  RETURN v_count;
END;
$$;

DO $$
DECLARE v_existing int;
BEGIN
  SELECT count(*) INTO v_existing
  FROM cron.job WHERE jobname = 'beacon-alert-thresholds-weekly';

  IF v_existing = 0 THEN
    PERFORM cron.schedule(
      'beacon-alert-thresholds-weekly',
      '30 4 * * 0',
      $cmd$ SELECT learn_alert_thresholds() $cmd$
    );
  END IF;
END $$;
