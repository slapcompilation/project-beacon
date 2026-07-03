-- Migration 192: operator notification when a data feed goes down.
--
-- Closes the loop on the integration-health monitor (migration 190): the readout
-- shows connector freshness, but an operator not watching the Monitors tab needs
-- to be told when a feed stops. Classification (fresh/stale/down) stays in code —
-- the single source of truth — so this RPC is a dumb persister: given a source
-- the caller has already judged 'down' (or 'never'), it raises one notification,
-- deduped so a persistently-down feed doesn't spam every sweep. Mirrors
-- auto_create_alerts (migration 025): notify auth.uid(), dedup on an unread row.

BEGIN;

-- Extend the notification type set (latest was migration 119).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'low_stock'::text, 'expiry'::text, 'restock_request'::text,
    'waste_spike'::text, 'pos_variance'::text, 'po_discrepancy'::text,
    'contract_expiry'::text, 'approval'::text, 'system'::text,
    'predicted_outage'::text, 'waste_alert'::text, 'consumption_spike'::text,
    'price_drift'::text,
    'accelerated_depletion'::text,
    'occupancy_spike'::text,
    'theft_alert'::text,
    'integration_health'::text
  ]));

CREATE OR REPLACE FUNCTION raise_integration_health_alert(
  p_source_key text,
  p_label      text,
  p_status     text,   -- 'down' | 'never' (the caller's classification)
  p_detail     text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
  v_user_id  uuid := auth.uid();
  v_prefix   text := format('Data feed · %s', p_label);
  v_msg      text := format('%s: %s (%s)', v_prefix,
                       CASE p_status WHEN 'down' THEN 'not receiving data' ELSE 'never connected' END,
                       p_detail);
BEGIN
  IF v_hotel_id IS NULL OR v_user_id IS NULL THEN RETURN 0; END IF;

  -- One open alert per feed per operator until they clear it.
  IF EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.hotel_id = v_hotel_id
      AND n.user_id  = v_user_id
      AND n.type     = 'integration_health'
      AND n.read     = false
      AND n.message LIKE v_prefix || '%'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (hotel_id, user_id, message, type)
  VALUES (v_hotel_id, v_user_id, v_msg, 'integration_health');
  RETURN 1;
END;
$$;

REVOKE ALL   ON FUNCTION raise_integration_health_alert(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION raise_integration_health_alert(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION raise_integration_health_alert(text, text, text, text) IS
  'Raises one deduped operator notification for a data feed the caller has '
  'classified down/never (integration-health monitor, migration 190). '
  'Classification stays in code; this only persists + dedups.';

COMMIT;
