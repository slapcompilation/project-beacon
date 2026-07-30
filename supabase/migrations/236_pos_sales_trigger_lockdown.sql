-- Recovered from supabase_migrations version 20260501100506.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

-- Hotfix to migration 117: revoke public EXECUTE on the trigger function.
-- get_advisors flagged it WARN (anon + authenticated callable via REST). The
-- trigger machinery invokes the function directly via the trigger definition,
-- not through REST, so this revoke does not affect cron or trigger paths.
REVOKE EXECUTE ON FUNCTION public.trg_pos_sales_accelerated_depletion() FROM PUBLIC, anon, authenticated;
