-- Migration 194: pin get_integration_health's search_path.
--
-- It shipped (190) without SET search_path, tripping the advisor
-- function_search_path_mutable. It's SECURITY INVOKER so RLS still applies, but
-- pinning is harmless and clears the warning. ALTER (not re-CREATE) keeps the
-- body in one place — migration 190.

ALTER FUNCTION get_integration_health() SET search_path = public;
