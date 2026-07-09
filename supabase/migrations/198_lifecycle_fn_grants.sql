-- Trigger fns are invoked by triggers, never via REST — same lockdown as
-- migrations 176/177 applied to the other definer fns (advisor:
-- anon/authenticated_security_definer_function_executable).
REVOKE EXECUTE ON FUNCTION enforce_lifecycle() FROM anon, authenticated, public;
