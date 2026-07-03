-- Migration 193: lock down the integration-health SECURITY DEFINER functions.
--
-- New functions inherit Supabase's default anon/authenticated (+ PUBLIC) EXECUTE
-- grants; 191/192 revoked only a subset, so advance_document_to_linked and
-- raise_integration_health_alert were still anon-executable definer functions —
-- the exact class security_invariants.sql Invariant 1 flags (cf. migrations
-- 176/177). Revoke broadly, re-grant only what's needed.
--
-- advance_document_to_linked is a trigger function: it fires as the table owner
-- regardless of grants, so no role needs direct EXECUTE.
-- raise_integration_health_alert is called by the web, so authenticated keeps it.

REVOKE ALL ON FUNCTION advance_document_to_linked()                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION raise_integration_health_alert(text, text, text, text)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION raise_integration_health_alert(text, text, text, text) TO authenticated;
