-- ─────────────────────────────────────────────────────────────────────────────
-- Project Beacon — Enable Realtime
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the tables that need live updates to the Supabase Realtime publication.
-- After running this, changes to these tables will be streamed to subscribed clients.

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE product_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE restock_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
