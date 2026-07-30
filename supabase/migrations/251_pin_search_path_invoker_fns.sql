-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 251 — pin search_path on the six SECURITY INVOKER functions the
-- advisor flags (function_search_path_mutable).
--
-- Found by running get_advisors after 248-250, which CLAUDE.md requires and
-- which had not been run since the MCP was unavailable. None of the six came
-- from that work; all predate it.
--
-- Why our own guard missed them: security_invariants.sql invariant 2 checks
-- SECURITY DEFINER functions only, and these are INVOKER — RLS still applies, so
-- the blast radius is small. But an unqualified reference inside any of them
-- still resolves through the caller's search_path, and three of these are read
-- by the ontology drift tripwire and the document search path. Pin them.
--
-- Invariant 2 is deliberately NOT widened to all functions here: that is a
-- separate decision with a much larger surface, and widening a guard in the same
-- migration that fixes its findings hides whether the fix was complete.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.user_tool_params_valid(jsonb)                  SET search_path TO 'public';
ALTER FUNCTION public.derive_object_type_properties(text)            SET search_path TO 'public';
ALTER FUNCTION public.builtin_property_drift()                       SET search_path TO 'public';
ALTER FUNCTION public.match_document_chunks(uuid, vector, double precision, integer)
                                                                     SET search_path TO 'public';
ALTER FUNCTION public.documents_referencing_node(uuid, text, uuid)   SET search_path TO 'public';
ALTER FUNCTION public.resolve_node_labels(jsonb)                     SET search_path TO 'public';
