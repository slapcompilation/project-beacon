-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 173 — aip_signal_counts() also returns cases_open
--
-- The Decisions rail (useAipCounts) fetched FIVE full datasets just to show
-- badge counts. aip_signal_counts() already server-aggregates 3 of them in one
-- round-trip (and the topbar already calls it). Add cases_open so the rail can
-- reuse the same RPC for queue/approvals/cases/entity-links — one shared call
-- instead of four full-table reads.
--
-- Adding a RETURNS TABLE column changes the return type, so DROP then CREATE.
-- Backward-compatible for callers: the topbar reads the first three columns and
-- ignores the new one.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.aip_signal_counts(uuid);

CREATE OR REPLACE FUNCTION public.aip_signal_counts(p_hotel_id uuid)
RETURNS TABLE(queue_pending integer, approvals_pending integer, entity_links_pending integer, cases_open integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    (select count(*)::int from public.proposals
       where hotel_id = p_hotel_id and status = 'pending'),
    (select count(*)::int from public.pending_action_approvals
       where hotel_id = p_hotel_id and status = 'pending'),
    (select count(*)::int from public.entity_link_suggestions
       where hotel_id = p_hotel_id and status = 'pending'),
    (select count(*)::int from public.cases
       where hotel_id = p_hotel_id and status = 'open');
$function$;

REVOKE ALL ON FUNCTION public.aip_signal_counts(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aip_signal_counts(uuid) TO authenticated;
