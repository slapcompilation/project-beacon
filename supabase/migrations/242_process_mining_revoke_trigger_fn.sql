-- Recovered from supabase_migrations version 20260722033655.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Trigger functions are invoked by the trigger as owner, never as an RPC.
-- Revoke the default PUBLIC execute so it isn't exposed on /rest/v1/rpc.
REVOKE ALL ON FUNCTION log_lifecycle_transition() FROM PUBLIC, anon, authenticated;
