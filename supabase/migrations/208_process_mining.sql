-- P11 Process Mining (Foundry Machinery parity). We already author the state
-- machines (lifecycle_transitions) and enforce them (enforce_lifecycle), but the
-- guard was validate-only — it recorded nothing. This adds the missing middle
-- layer: an immutable transition event log + a mine_process() RPC that turns it
-- into per-state (count/duration/throughput) and per-transition (lead-time)
-- metrics for the process explorer.

-- ── Event log (append-only, like StockLog) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lifecycle_transition_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type       text NOT NULL,
  node_id         uuid NOT NULL,
  from_status     text,             -- null = the seeded "entered initial state" event
  to_status       text NOT NULL,
  at              timestamptz NOT NULL DEFAULT now(),
  actor_id        uuid,             -- auth.uid(); null under cron/service role
  hotel_id        uuid,
  organization_id uuid
);

CREATE INDEX IF NOT EXISTS idx_lte_mine    ON lifecycle_transition_events (node_type, hotel_id, node_id, at);
CREATE INDEX IF NOT EXISTS idx_lte_state   ON lifecycle_transition_events (node_type, hotel_id, to_status);

ALTER TABLE lifecycle_transition_events ENABLE ROW LEVEL SECURITY;
-- Read-only for users in scope; writes happen only through the SECURITY DEFINER
-- trigger below (which bypasses RLS), so there is no user write policy — the log
-- is immutable audit.
DROP POLICY IF EXISTS lte_read ON lifecycle_transition_events;
CREATE POLICY lte_read ON lifecycle_transition_events
  FOR SELECT TO authenticated
  USING (hotel_is_in_user_scope(hotel_id));

-- ── Logging trigger ─────────────────────────────────────────────────────────
-- Generic across every lifecycle table. Columns differ (only cases/proposals
-- carry organization_id), so read fields out of to_jsonb(NEW) — a missing key is
-- simply NULL rather than a compile error. Fires AFTER, so illegal transitions
-- (already aborted by enforce_lifecycle in BEFORE) never reach here.
CREATE OR REPLACE FUNCTION log_lifecycle_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb := to_jsonb(NEW);
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO lifecycle_transition_events
      (node_type, node_id, from_status, to_status, hotel_id, organization_id, actor_id)
    VALUES
      (TG_ARGV[0], (r->>'id')::uuid, OLD.status, NEW.status,
       (r->>'hotel_id')::uuid, (r->>'organization_id')::uuid, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions run as owner via the trigger, never as an RPC — revoke the
-- default PUBLIC execute so it isn't exposed on /rest/v1/rpc (get_advisors).
REVOKE ALL ON FUNCTION log_lifecycle_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_transition_restock ON restock_requests;
CREATE TRIGGER trg_log_transition_restock
  AFTER UPDATE OF status ON restock_requests
  FOR EACH ROW EXECUTE FUNCTION log_lifecycle_transition('restock_request');

DROP TRIGGER IF EXISTS trg_log_transition_po ON purchase_orders;
CREATE TRIGGER trg_log_transition_po
  AFTER UPDATE OF status ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION log_lifecycle_transition('purchase_order');

DROP TRIGGER IF EXISTS trg_log_transition_case ON cases;
CREATE TRIGGER trg_log_transition_case
  AFTER UPDATE OF status ON cases
  FOR EACH ROW EXECUTE FUNCTION log_lifecycle_transition('case');

DROP TRIGGER IF EXISTS trg_log_transition_proposal ON proposals;
CREATE TRIGGER trg_log_transition_proposal
  AFTER UPDATE OF status ON proposals
  FOR EACH ROW EXECUTE FUNCTION log_lifecycle_transition('proposal');

-- ── Backfill: one "entered current state" event per existing row ─────────────
-- Gives the explorer a current-state distribution on day one; real transitions
-- accrue forward. Guarded so re-running never double-seeds.
INSERT INTO lifecycle_transition_events (node_type, node_id, from_status, to_status, at, hotel_id, organization_id)
SELECT 'restock_request', t.id, NULL, t.status, t.created_at, t.hotel_id, NULL
FROM restock_requests t
WHERE NOT EXISTS (SELECT 1 FROM lifecycle_transition_events e WHERE e.node_id = t.id AND e.node_type = 'restock_request');

INSERT INTO lifecycle_transition_events (node_type, node_id, from_status, to_status, at, hotel_id, organization_id)
SELECT 'purchase_order', t.id, NULL, t.status, t.created_at, t.hotel_id, NULL
FROM purchase_orders t
WHERE NOT EXISTS (SELECT 1 FROM lifecycle_transition_events e WHERE e.node_id = t.id AND e.node_type = 'purchase_order');

INSERT INTO lifecycle_transition_events (node_type, node_id, from_status, to_status, at, hotel_id, organization_id)
SELECT 'case', t.id, NULL, t.status, t.created_at, t.hotel_id, t.organization_id
FROM cases t
WHERE NOT EXISTS (SELECT 1 FROM lifecycle_transition_events e WHERE e.node_id = t.id AND e.node_type = 'case');

INSERT INTO lifecycle_transition_events (node_type, node_id, from_status, to_status, at, hotel_id, organization_id)
SELECT 'proposal', t.id, NULL, t.status, t.created_at, t.hotel_id, t.organization_id
FROM proposals t
WHERE NOT EXISTS (SELECT 1 FROM lifecycle_transition_events e WHERE e.node_id = t.id AND e.node_type = 'proposal');

-- ── mine_process(): the process graph with metrics ──────────────────────────
-- Returns { states: [...], transitions: [...] }. SECURITY INVOKER so the event
-- log's RLS scopes it to the caller; p_hotel_id narrows to one property.
CREATE OR REPLACE FUNCTION mine_process(p_node_type text, p_hotel_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT node_id, from_status, to_status, at,
           LEAD(at) OVER (PARTITION BY node_id ORDER BY at, id) AS next_at,
           LAG(at)  OVER (PARTITION BY node_id ORDER BY at, id) AS prev_at
    FROM lifecycle_transition_events
    WHERE node_type = p_node_type AND hotel_id = p_hotel_id
  ),
  states AS (
    SELECT to_status AS state,
           COUNT(*)                                   AS entered_count,
           COUNT(*) FILTER (WHERE next_at IS NULL)    AS current_count,
           COUNT(*) FILTER (WHERE next_at IS NOT NULL) AS exited_count,
           AVG(EXTRACT(EPOCH FROM (COALESCE(next_at, now()) - at))) AS avg_duration_s
    FROM ev
    GROUP BY to_status
  ),
  transitions AS (
    SELECT from_status AS "from", to_status AS "to",
           COUNT(*)                                         AS count,
           AVG(EXTRACT(EPOCH FROM (at - prev_at)))          AS avg_lead_time_s
    FROM ev
    WHERE from_status IS NOT NULL
    GROUP BY from_status, to_status
  )
  SELECT jsonb_build_object(
    'states',      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.entered_count DESC) FROM states s), '[]'::jsonb),
    'transitions', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.count DESC)         FROM transitions t), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION mine_process(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mine_process(text, uuid) TO authenticated;
