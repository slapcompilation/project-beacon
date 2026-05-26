-- Hosted summaries for the AIP shell + topbar counters.
--
-- Why: the web client was pulling 2000 proposals and aggregating in JS
-- (lossy past the cap) and firing 3 separate hot queries from the topbar
-- (queue + approvals + entity-links). Both belong server-side.
--
-- Two surfaces:
--   agent_run_summary view   — per-agent counts + last-run, RLS-scoped
--   aip_signal_counts() rpc  — one round-trip for the topbar strip

-- ── 1. Per-agent run summary ────────────────────────────────────────────────
-- Aggregates the proposals table (which already has RLS on hotel_id).
-- Selecting from the view applies the underlying RLS automatically.

create or replace view public.agent_run_summary
with (security_invoker = true) as
select
  p.hotel_id,
  p.agent_name,
  count(*)::int                                          as total_runs,
  count(*) filter (where p.status = 'pending')::int     as pending,
  count(*) filter (where p.status = 'approved')::int    as approved,
  count(*) filter (where p.status = 'rejected')::int    as rejected,
  count(*) filter (where p.status = 'superseded')::int  as superseded,
  round(avg(p.confidence)::numeric, 2)                  as avg_confidence,
  max(p.created_at)                                     as last_run_at,
  (array_agg(p.status order by p.created_at desc))[1]   as last_run_status
from public.proposals p
group by p.hotel_id, p.agent_name;

comment on view public.agent_run_summary is
  'Per-agent operational stats for Agent Studio. Total runs, status breakdown, avg confidence, last-run timestamp + status. RLS-scoped via security_invoker.';

grant select on public.agent_run_summary to authenticated;

-- ── 2. Topbar AIP signal counts ─────────────────────────────────────────────
-- One round-trip instead of three. Each count respects RLS via the
-- underlying tables (proposals, pending_action_approvals,
-- entity_link_suggestions all have hotel-scoped policies).

create or replace function public.aip_signal_counts(p_hotel_id uuid)
returns table (
  queue_pending          int,
  approvals_pending      int,
  entity_links_pending   int
)
language sql
stable
security invoker
as $$
  select
    (select count(*)::int from public.proposals
       where hotel_id = p_hotel_id and status = 'pending'),
    (select count(*)::int from public.pending_action_approvals
       where hotel_id = p_hotel_id and status = 'pending'),
    (select count(*)::int from public.entity_link_suggestions
       where hotel_id = p_hotel_id and status = 'pending');
$$;

comment on function public.aip_signal_counts(uuid) is
  'Single round-trip for the topbar AIP signal strip. Each subquery is RLS-scoped via security_invoker.';

grant execute on function public.aip_signal_counts(uuid) to authenticated;
