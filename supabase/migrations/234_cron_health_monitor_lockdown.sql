-- Recovered from supabase_migrations version 20260430223059.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Hotfix to migration 115: revoke public EXECUTE on monitor_cron_health.
-- Reason: get_advisors flagged it WARN (anon + authenticated can call via /rest/v1/rpc).
-- It's an SRE/infra tool, not an operator surface. Only postgres + service_role keep EXECUTE.
REVOKE EXECUTE ON FUNCTION public.monitor_cron_health() FROM PUBLIC, anon, authenticated;
-- pg_cron runs as `postgres` so the scheduled invocation is unaffected.
