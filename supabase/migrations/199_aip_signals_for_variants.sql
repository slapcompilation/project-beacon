-- P0 of the AIP-native OPERATE arc (docs/AIP-OPERATE-INLINE.md): the per-item
-- signal spine. One round-trip resolves, for a batch of variants, whether the
-- agent has a take there — open proposals, a paused action awaiting sign-off,
-- and the open Case wrapping it. Every OPERATE list row reads this instead of
-- N per-row queries.
--
-- INVOKER + explicit hotel filter (mirrors aip_signal_counts): RLS on the
-- source tables scopes rows to the caller; the hotel arg keeps org users to
-- their active property. Proposals/approvals link to a variant through
-- action_payload->>'variantId' (proposals carry no variant column); cases via
-- input_refs @> {kind:variant}. Returns ONLY variants that have a signal, so a
-- 200-row list ships back the handful that matter.
CREATE OR REPLACE FUNCTION public.aip_signals_for_variants(
  p_hotel_id    uuid,
  p_variant_ids uuid[]
)
RETURNS TABLE(
  variant_id        uuid,
  open_proposals    int,
  pending_approvals int,
  open_case_id      uuid
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  with vids as (select unnest(p_variant_ids) as vid),
  props as (
    select action_payload->>'variantId' as vid, count(*)::int as n
    from proposals
    where hotel_id = p_hotel_id and status = 'pending'
      and action_payload->>'variantId' = any(p_variant_ids::text[])
    group by 1
  ),
  apprs as (
    select action_payload->>'variantId' as vid, count(*)::int as n
    from pending_action_approvals
    where hotel_id = p_hotel_id and status = 'pending'
      and action_payload->>'variantId' = any(p_variant_ids::text[])
    group by 1
  ),
  cs as (
    select (r->>'ref') as vid, (array_agg(c.id order by c.created_at desc))[1] as case_id
    from cases c, jsonb_array_elements(c.input_refs) as r
    where c.hotel_id = p_hotel_id and c.status in ('open','in_review')
      and r->>'kind' = 'variant'
      and (r->>'ref') = any(p_variant_ids::text[])
    group by 1
  )
  select
    v.vid,
    coalesce(p.n, 0),
    coalesce(a.n, 0),
    c.case_id
  from vids v
  left join props p on p.vid = v.vid::text
  left join apprs a on a.vid = v.vid::text
  left join cs    c on c.vid = v.vid::text
  where coalesce(p.n, 0) > 0 or coalesce(a.n, 0) > 0 or c.case_id is not null;
$function$;

-- Definer-fn lockdown parity (migrations 176/177/198): keep it callable by
-- signed-in users only, not anon.
REVOKE ALL ON FUNCTION public.aip_signals_for_variants(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.aip_signals_for_variants(uuid, uuid[]) TO authenticated;
