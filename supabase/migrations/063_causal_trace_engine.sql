-- Migration 063: Causal Trace Engine — Reality Graph traversal
-- Layer: Eye → Mind (cross-layer intelligence)
-- Purpose:
--   Given any node in the Reality Graph (notification, variant, restock_request),
--   construct a human-readable causal chain explaining why the current state exists.
--   The spine is relationship_edges. Gaps are filled by heuristic queries against
--   the operational tables (stock_logs, restock_requests/receives).
--
-- No LLM required. Pure graph traversal + structured enrichment.
--
-- 1. causal_trace_logs  — log every query for accuracy tracking and future training
-- 2. log_causal_trace() — VOLATILE INSERT into the log table
-- 3. get_causal_trace() — STABLE traversal returning an ordered event chain
--
-- Root types supported:
--   'notification'      — start from an alert; walk back through removals, pending
--                         requests, and last supply events
--   'variant'           — start from a variant's current state; walk recent
--                         consumption, open requests, and active alerts
--   'restock_request'   — start from a request; show the consumption that drove it,
--                         the approval chain, and any fulfillment receives

SET search_path = public;

-- ─── 1. causal_trace_logs ─────────────────────────────────────────────────────
-- One row per traversal. Used to identify which nodes are queried most often
-- (prioritise enriching their graph edges) and to measure feature adoption.

CREATE TABLE IF NOT EXISTS causal_trace_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id     uuid,       -- auth.uid() at call time; NULL when called from cron
  root_type   text        NOT NULL,  -- 'notification' | 'variant' | 'restock_request'
  root_id     uuid        NOT NULL,
  queried_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trace_logs_hotel_time
  ON causal_trace_logs (hotel_id, queried_at DESC);

CREATE INDEX IF NOT EXISTS idx_trace_logs_root
  ON causal_trace_logs (root_type, root_id);

ALTER TABLE causal_trace_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_isolation" ON causal_trace_logs
  USING  (hotel_id = auth_hotel_id())
  WITH CHECK (hotel_id = auth_hotel_id());

-- ─── 2. log_causal_trace() ────────────────────────────────────────────────────
-- VOLATILE — side-effecting. Called by the frontend after each successful trace.
-- Fire-and-forget: callers should not block on the response.

CREATE OR REPLACE FUNCTION log_causal_trace(
  p_root_type text,
  p_root_id   uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO causal_trace_logs (hotel_id, user_id, root_type, root_id)
  VALUES (auth_hotel_id(), auth.uid(), p_root_type, p_root_id);
$$;

GRANT EXECUTE ON FUNCTION log_causal_trace(text, uuid) TO authenticated;

-- ─── 3. get_causal_trace() ────────────────────────────────────────────────────
-- STABLE — pure query; no side effects.
-- Returns an ordered event chain as rows. Columns:
--
--   step        — logical depth (0 = root, 1 = direct causes, 2 = prior context…)
--   node_type   — 'notification' | 'stock_log' | 'restock_request' |
--                 'restock_receive' | 'variant' | <graph edge target type>
--   node_id     — uuid of the actual record
--   happened_at — timestamp of the event; NOW() for current-state rows
--   actor       — email of the user who performed the action; 'System' otherwise
--   event_label — short human-readable label ('Stock Removal', 'Pending Restock'…)
--   description — full explanation with numbers ('47 units removed — Consumed…')
--   causal_link — how this event connects to the overall chain; NULL for the root
--
-- All results are for auth_hotel_id() — no cross-hotel data leakage.

CREATE OR REPLACE FUNCTION get_causal_trace(
  p_root_type text,
  p_root_id   uuid,
  p_max_depth integer DEFAULT 6
)
RETURNS TABLE (
  step         integer,
  node_type    text,
  node_id      uuid,
  happened_at  timestamptz,
  actor        text,
  event_label  text,
  description  text,
  causal_link  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id     uuid := auth_hotel_id();
  v_variant_id   uuid;
  v_notif_type   text;
  v_notif_time   timestamptz;
  v_window_start timestamptz;
BEGIN

-- ══ A. NOTIFICATION ROOT ══════════════════════════════════════════════════════
IF p_root_type = 'notification' THEN

  -- Resolve the notification and confirm hotel ownership
  SELECT type, timestamp, variant_id
    INTO v_notif_type, v_notif_time, v_variant_id
    FROM notifications
   WHERE id = p_root_id AND hotel_id = v_hotel_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Step 0 — The alert itself (the thing being explained)
  RETURN QUERY
    SELECT 0,
           'notification'::text,
           n.id,
           n.timestamp,
           'System'::text,
           REPLACE(n.type, '_', ' ')::text,
           n.message,
           NULL::text
      FROM notifications n
     WHERE n.id = p_root_id;

  IF v_variant_id IS NULL THEN RETURN; END IF;

  -- Time window: how far back to look for contributing stock events
  v_window_start := CASE v_notif_type
    WHEN 'consumption_spike' THEN CURRENT_DATE::timestamptz    -- today's removals
    WHEN 'low_stock'         THEN v_notif_time - INTERVAL '7 days'
    WHEN 'predicted_outage'  THEN v_notif_time - INTERVAL '14 days'
    ELSE                          v_notif_time - INTERVAL '7 days'
  END;

  -- Step 1 — Stock removals that contributed to triggering the alert
  RETURN QUERY
    SELECT
      1,
      'stock_log'::text,
      sl.id,
      sl.timestamp,
      COALESCE(u.email, 'unknown actor')::text,
      'Stock Removal'::text,
      ABS(sl.quantity_change)::text || ' units removed'
        || CASE WHEN sl.reason IS NOT NULL AND sl.reason <> ''
                THEN ' — ' || sl.reason ELSE '' END
        || ' (balance after: ' || sl.balance_after || ')',
      'contributed to alert'::text
    FROM stock_logs sl
    LEFT JOIN users u ON u.id = sl.user_id
   WHERE sl.variant_id      = v_variant_id
     AND sl.hotel_id        = v_hotel_id
     AND sl.quantity_change < 0
     AND sl.is_revert       = false
     AND sl.timestamp      >= v_window_start
     AND sl.timestamp      <= v_notif_time
   ORDER BY sl.timestamp DESC
   LIMIT 5;

  -- Step 2 — Open restock requests that existed at alert time (explains the gap)
  RETURN QUERY
    SELECT
      2,
      'restock_request'::text,
      rr.id,
      rr.created_at,
      COALESCE(u.email, 'unknown')::text,
      'Pending Restock'::text,
      rr.quantity_needed::text || ' units — status: ' || rr.status
        || ' · ' || EXTRACT(DAY FROM (v_notif_time - rr.created_at))::int::text || ' days old'
        || CASE WHEN rr.required_approval_tier <> 'none'
                THEN ' · awaiting ' || rr.required_approval_tier || ' approval'
                ELSE '' END
        || CASE WHEN rr.escalation_count > 0
                THEN ' · escalated ' || rr.escalation_count || '×'
                ELSE '' END,
      'unresolved at alert time'::text
    FROM restock_requests rr
    LEFT JOIN users u ON u.id = rr.requestor_id
   WHERE rr.variant_id = v_variant_id
     AND rr.hotel_id   = v_hotel_id
     AND rr.status    IN ('pending', 'pending_manager', 'pending_director')
     AND rr.created_at < v_notif_time
   ORDER BY rr.created_at ASC
   LIMIT 3;

  -- Step 3 — Most recent supply event (establishes the baseline before the gap)
  RETURN QUERY
    SELECT
      3,
      'restock_receive'::text,
      rec.id,
      rec.received_at,
      COALESCE(u.email, 'system')::text,
      'Last Supply'::text,
      rec.quantity_received::text || ' units received'
        || CASE WHEN s.name IS NOT NULL THEN ' from ' || s.name ELSE '' END
        || CASE WHEN rec.lot_number IS NOT NULL THEN ' · lot ' || rec.lot_number ELSE '' END
        || CASE WHEN rec.unit_cost IS NOT NULL
                THEN ' · ' || rec.unit_cost::text || ' per unit' ELSE '' END,
      'most recent supply before alert'::text
    FROM restock_receives rec
    JOIN restock_requests rr ON rr.id  = rec.request_id
    LEFT JOIN suppliers   s  ON s.id   = rec.supplier_id
    LEFT JOIN users       u  ON u.id   = rec.received_by
   WHERE rr.variant_id   = v_variant_id
     AND rec.hotel_id    = v_hotel_id
     AND rec.received_at < v_notif_time
   ORDER BY rec.received_at DESC
   LIMIT 1;

  -- Step 4 — Graph edges from relationship_edges (supplementary context where wired)
  RETURN QUERY
    SELECT
      4,
      re.target_type::text,
      re.target_id,
      re.created_at,
      'Reality Graph'::text,
      re.edge_type::text,
      re.source_type || ' →[' || re.edge_type || ']→ ' || re.target_type
        || CASE WHEN re.metadata IS NOT NULL AND re.metadata <> '{}'::jsonb
                THEN ' · ' || LEFT(re.metadata::text, 120)
                ELSE '' END,
      'graph edge'::text
    FROM relationship_edges re
   WHERE re.hotel_id    = v_hotel_id
     AND (
       (re.source_type = 'variant'      AND re.source_id = v_variant_id) OR
       (re.source_type = 'notification' AND re.source_id = p_root_id)
     )
     AND re.created_at >= v_window_start
   ORDER BY re.created_at DESC
   LIMIT p_max_depth;

-- ══ B. VARIANT ROOT ═══════════════════════════════════════════════════════════
ELSIF p_root_type = 'variant' THEN

  v_variant_id := p_root_id;

  PERFORM 1
    FROM product_variants pv
    JOIN products pr ON pr.id = pv.product_id
   WHERE pv.id = v_variant_id AND pr.hotel_id = v_hotel_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Step 0 — Current state snapshot
  RETURN QUERY
    SELECT
      0,
      'variant'::text,
      pv.id,
      NOW()::timestamptz,
      'System'::text,
      'Current State'::text,
      pr.name || ' — ' || pv.name || ': '
        || pv.current_stock::text || ' units on hand'
        || CASE WHEN pv.low_stock_threshold > 0
                THEN ' · threshold ' || pv.low_stock_threshold
                ELSE '' END
        || CASE WHEN pv.current_stock = 0
                THEN ' · OUT OF STOCK'
                WHEN pv.low_stock_threshold > 0
                 AND pv.current_stock <= pv.low_stock_threshold
                THEN ' · BELOW THRESHOLD'
                ELSE '' END,
      NULL::text
    FROM product_variants pv
    JOIN products pr ON pr.id = pv.product_id
   WHERE pv.id = v_variant_id;

  -- Step 1 — Recent removals (last 7 days)
  RETURN QUERY
    SELECT
      1,
      'stock_log'::text,
      sl.id,
      sl.timestamp,
      COALESCE(u.email, 'system')::text,
      CASE WHEN sl.is_revert THEN 'Reversal'::text ELSE 'Removal'::text END,
      ABS(sl.quantity_change)::text || ' units '
        || CASE WHEN sl.is_revert THEN 'reversed' ELSE 'removed' END
        || CASE WHEN sl.reason IS NOT NULL AND sl.reason <> ''
                THEN ' — ' || sl.reason ELSE '' END
        || ' (balance after: ' || sl.balance_after || ')',
      'recent consumption'::text
    FROM stock_logs sl
    LEFT JOIN users u ON u.id = sl.user_id
   WHERE sl.variant_id      = v_variant_id
     AND sl.hotel_id        = v_hotel_id
     AND sl.quantity_change < 0
     AND sl.timestamp      >= NOW() - INTERVAL '7 days'
   ORDER BY sl.timestamp DESC
   LIMIT 8;

  -- Step 2 — Open restock requests
  RETURN QUERY
    SELECT
      2,
      'restock_request'::text,
      rr.id,
      rr.created_at,
      COALESCE(u.email, 'unknown')::text,
      'Pending Restock'::text,
      rr.quantity_needed::text || ' units · ' || rr.status
        || ' · ' || EXTRACT(DAY FROM (NOW() - rr.created_at))::int::text || ' days old',
      'open request'::text
    FROM restock_requests rr
    LEFT JOIN users u ON u.id = rr.requestor_id
   WHERE rr.variant_id = v_variant_id
     AND rr.hotel_id   = v_hotel_id
     AND rr.status    IN ('pending', 'pending_manager', 'pending_director')
   ORDER BY rr.created_at DESC
   LIMIT 3;

  -- Step 3 — Unread alerts for this variant
  RETURN QUERY
    SELECT
      3,
      'notification'::text,
      n.id,
      n.timestamp,
      'System'::text,
      REPLACE(n.type, '_', ' ')::text,
      n.message,
      'active alert'::text
    FROM notifications n
   WHERE n.variant_id = v_variant_id
     AND n.hotel_id   = v_hotel_id
     AND n.read       = false
   ORDER BY n.timestamp DESC
   LIMIT 3;

  -- Step 4 — Last supply
  RETURN QUERY
    SELECT
      4,
      'restock_receive'::text,
      rec.id,
      rec.received_at,
      COALESCE(u.email, 'system')::text,
      'Last Supply'::text,
      rec.quantity_received::text || ' units received'
        || CASE WHEN s.name IS NOT NULL THEN ' from ' || s.name ELSE '' END,
      'prior supply'::text
    FROM restock_receives rec
    JOIN restock_requests rr ON rr.id = rec.request_id
    LEFT JOIN suppliers   s  ON s.id  = rec.supplier_id
    LEFT JOIN users       u  ON u.id  = rec.received_by
   WHERE rr.variant_id = v_variant_id
     AND rec.hotel_id  = v_hotel_id
   ORDER BY rec.received_at DESC
   LIMIT 1;

-- ══ C. RESTOCK REQUEST ROOT ═══════════════════════════════════════════════════
ELSIF p_root_type = 'restock_request' THEN

  PERFORM 1 FROM restock_requests WHERE id = p_root_id AND hotel_id = v_hotel_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT variant_id INTO v_variant_id FROM restock_requests WHERE id = p_root_id;

  -- Step 0 — The request itself
  RETURN QUERY
    SELECT
      0,
      'restock_request'::text,
      rr.id,
      rr.created_at,
      COALESCE(u.email, 'unknown')::text,
      'Restock Request'::text,
      rr.quantity_needed::text || ' units needed · status: ' || rr.status
        || CASE WHEN rr.required_approval_tier <> 'none'
                THEN ' · requires ' || rr.required_approval_tier || ' approval'
                ELSE '' END
        || CASE WHEN rr.estimated_cost IS NOT NULL
                THEN ' · est. cost ' || rr.estimated_cost::text
                ELSE '' END,
      NULL::text
    FROM restock_requests rr
    LEFT JOIN users u ON u.id = rr.requestor_id
   WHERE rr.id = p_root_id;

  -- Step 1 — Recent consumption that drove the request
  RETURN QUERY
    SELECT
      1,
      'stock_log'::text,
      sl.id,
      sl.timestamp,
      COALESCE(u.email, 'system')::text,
      'Prior Consumption'::text,
      ABS(sl.quantity_change)::text || ' units removed'
        || CASE WHEN sl.reason IS NOT NULL AND sl.reason <> ''
                THEN ' — ' || sl.reason ELSE '' END
        || ' (balance: ' || sl.balance_after || ')',
      'drove the request'::text
    FROM restock_requests base_rr
    JOIN stock_logs sl
      ON sl.variant_id = base_rr.variant_id
     AND sl.hotel_id   = base_rr.hotel_id
    LEFT JOIN users u ON u.id = sl.user_id
   WHERE base_rr.id        = p_root_id
     AND sl.quantity_change < 0
     AND sl.is_revert       = false
     AND sl.timestamp      >= base_rr.created_at - INTERVAL '14 days'
     AND sl.timestamp       < base_rr.created_at
   ORDER BY sl.timestamp DESC
   LIMIT 5;

  -- Step 2 — Approval chain status
  RETURN QUERY
    SELECT
      2,
      'restock_request'::text,
      rr.id,
      COALESCE(rr.approved_at, rr.rejected_at, rr.last_escalated_at, rr.created_at),
      COALESCE(
        (SELECT email FROM users WHERE id = COALESCE(rr.approved_by, rr.rejected_by)),
        'pending'
      )::text,
      CASE
        WHEN rr.approved_at IS NOT NULL THEN 'Approved'
        WHEN rr.rejected_at IS NOT NULL THEN 'Rejected'
        ELSE 'Awaiting approval'
      END::text,
      CASE
        WHEN rr.approved_at IS NOT NULL
          THEN 'Approved after '
               || EXTRACT(HOUR FROM (rr.approved_at - rr.created_at))::int::text
               || ' hours'
        WHEN rr.rejected_at IS NOT NULL
          THEN 'Rejected: ' || COALESCE(rr.rejected_reason, 'no reason recorded')
        ELSE
          'Waiting ' || EXTRACT(DAY FROM (NOW() - rr.created_at))::int::text || ' days'
          || CASE WHEN rr.escalation_count > 0
                  THEN ' · escalated ' || rr.escalation_count || '×'
                  ELSE '' END
      END,
      'approval chain'::text
    FROM restock_requests rr
   WHERE rr.id = p_root_id;

  -- Step 3 — Fulfillment receives (if any)
  RETURN QUERY
    SELECT
      3,
      'restock_receive'::text,
      rec.id,
      rec.received_at,
      COALESCE(u.email, 'system')::text,
      'Received'::text,
      rec.quantity_received::text || ' units'
        || CASE WHEN s.name IS NOT NULL THEN ' from ' || s.name ELSE '' END
        || CASE WHEN rec.unit_cost IS NOT NULL
                THEN ' at ' || rec.unit_cost::text || '/unit'
                ELSE '' END,
      'fulfillment event'::text
    FROM restock_receives rec
    LEFT JOIN suppliers s ON s.id   = rec.supplier_id
    LEFT JOIN users     u ON u.id   = rec.received_by
   WHERE rec.request_id = p_root_id
     AND rec.hotel_id   = v_hotel_id
   ORDER BY rec.received_at ASC;

END IF;

RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION get_causal_trace(text, uuid, integer) TO authenticated;

-- ─── Acceptance smoke test ─────────────────────────────────────────────────────
-- Replace <notification_id> with a real unread notification UUID:
--
--   SELECT step, event_label, description, happened_at
--     FROM get_causal_trace('notification', '<notification_id>', 6)
--    ORDER BY step, happened_at;
--
-- Expected: step 0 = the alert, step 1 = removals, step 2 = pending requests,
--           step 3 = last supply. Missing steps mean data gaps (no history yet).
