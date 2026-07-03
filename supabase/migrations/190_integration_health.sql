-- Migration 190: Unified data-integration health.
-- Layer: data (observability of the integration layer itself).
--
-- Foundry ships health checks over every dataset/connector — freshness, backlog,
-- failure — as a first-class surface. We already stamp a per-connector heartbeat
-- for POS (pos_connections) but read it through get_pos_health, whose warn/down
-- bands are HARDCODED 2h/24h, and the document-ingestion pipeline has no health
-- at all. This RPC unifies the sub-hour connectors into one normalized readout;
-- classification + the tunable SLA live in packages/reality-graph
-- (monitors/index.ts + policy), so the operator owns the thresholds — the
-- metric/trigger split every other monitor already follows.
--
-- Scope note: covers POS + the document pipeline (both real, sub-hour signals).
-- Occupancy/PMS is daily-grain — a 2h SLA would false-fire — so it's deferred
-- until the policy carries a per-kind (daily) threshold. Deliberately reads only
-- tables present in every lineage (pos_connections, documents); no pms_connections
-- dependency, which isn't universal.
--
-- SECURITY INVOKER (like get_pos_health): the underlying RLS + auth_hotel_id()
-- scope it. No new grants beyond authenticated read of rows already visible.

BEGIN;

CREATE OR REPLACE FUNCTION get_integration_health()
RETURNS TABLE (
  source_key        text,
  label             text,
  kind              text,
  last_activity_at  timestamptz,
  total_events      bigint,
  pending_count     bigint,       -- documents only; NULL for live feeds
  oldest_pending_at timestamptz   -- documents only; the stall signal
)
LANGUAGE sql STABLE AS $$
  -- POS connectors (Square/Toast/…) — one row per registered source.
  SELECT
    'pos:' || source_system         AS source_key,
    source_system || ' (POS)'       AS label,
    'pos'                           AS kind,
    last_received_at                AS last_activity_at,
    total_events,
    NULL::bigint                    AS pending_count,
    NULL::timestamptz               AS oldest_pending_at
  FROM  pos_connections
  WHERE hotel_id = auth_hotel_id()

  UNION ALL

  -- Document-ingestion pipeline — a single aggregate row. Freshness of sporadic
  -- uploads is uninformative, so the health signal is the backlog: how many docs
  -- are still awaiting the first processing step and how long the oldest has
  -- waited. Emitted only when the hotel has documents.
  SELECT
    'documents'                                                          AS source_key,
    'Document ingestion'                                                 AS label,
    'documents'                                                          AS kind,
    max(updated_at)                                                      AS last_activity_at,
    count(*)::bigint                                                     AS total_events,
    (count(*) FILTER (WHERE ingestion_stage = 'raw'))::bigint            AS pending_count,
    min(created_at) FILTER (WHERE ingestion_stage = 'raw')              AS oldest_pending_at
  FROM  documents
  WHERE hotel_id = auth_hotel_id()
  HAVING count(*) > 0

  ORDER BY kind, source_key;
$$;

GRANT EXECUTE ON FUNCTION get_integration_health() TO authenticated;

COMMENT ON FUNCTION get_integration_health() IS
  'Unified connector + ingestion-pipeline freshness for the caller''s hotel '
  '(POS + documents; occupancy/PMS deferred — daily-grain). Classification and '
  'the tunable SLA live in @beacon/reality-graph (the metric/trigger split); '
  'this only gathers the raw metric. Supersedes the hardcoded bands in '
  'get_pos_health.';

COMMIT;
