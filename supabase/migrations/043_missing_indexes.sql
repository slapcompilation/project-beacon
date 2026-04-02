-- Performance: add missing indexes on commonly-filtered columns.
-- These tables had no indexes beyond PK, causing full table scans on every RPC.

SET search_path = public;

-- restock_requests: filtered by hotel_id + status in nearly every query
CREATE INDEX IF NOT EXISTS idx_restock_requests_hotel_id
  ON restock_requests (hotel_id);

CREATE INDEX IF NOT EXISTS idx_restock_requests_variant_status
  ON restock_requests (variant_id, status)
  WHERE status IN ('pending', 'approved');

-- delivery_events: aggregated by supplier_id and hotel_id in scorecard RPCs
CREATE INDEX IF NOT EXISTS idx_delivery_events_hotel_supplier
  ON delivery_events (hotel_id, supplier_id);

-- actual_date is the delivery date column (NULL = in transit)
CREATE INDEX IF NOT EXISTS idx_delivery_events_actual_date
  ON delivery_events (hotel_id, actual_date DESC);

-- suppliers: filtered by hotel_id on every fetch
CREATE INDEX IF NOT EXISTS idx_suppliers_hotel_id
  ON suppliers (hotel_id);

-- notifications: hotel-wide deduplication check in auto_create_alerts()
-- existing idx_notifications_unread is on (user_id, read) — add hotel-level index
CREATE INDEX IF NOT EXISTS idx_notifications_hotel_type
  ON notifications (hotel_id, type, read)
  WHERE read = false;

-- pick_lists: idx_pick_lists_hotel (hotel_id, status, created_at) exists from 031.
-- Add a covering index for hotel_id-only lookups used in count queries.
CREATE INDEX IF NOT EXISTS idx_pick_lists_hotel_id
  ON pick_lists (hotel_id);

-- events: filtered by hotel_id
CREATE INDEX IF NOT EXISTS idx_events_hotel_id
  ON events (hotel_id);
