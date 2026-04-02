-- Sprint 22: Add missing tables to Supabase Realtime publication
-- stocktake_lines needed for live collaborative counting
-- stocktake_sessions needed for session status changes

ALTER PUBLICATION supabase_realtime ADD TABLE stocktake_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE stocktake_sessions;
