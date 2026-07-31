-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 287 — review_queue_load has never worked.
--
-- Found the moment 275's function got its first consumer. Called as a real
-- authenticated user rather than service role:
--
--   review_queue_load  403  42501  permission denied for table users
--
-- It is SECURITY INVOKER (correctly — the load should be scoped to what the
-- caller can see) and joins auth.users for the email. `authenticated` has no
-- read on auth.users, so every call fails. Service role masked it, which is why
-- it passed review: the only thing that ever called it was a superuser probe.
--
-- profiles already carries id + email and is RLS-scoped to the caller's hotel,
-- which is exactly the population an assignee can belong to. Join that instead
-- and the function stays INVOKER with no privilege escalation.
--
-- Kept LEFT JOIN: a proposal assigned to somebody outside the caller's scope
-- still has to appear in the load, as '(unknown)' rather than vanishing —
-- silently dropping rows would understate the queue.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.review_queue_load()
RETURNS TABLE (assignee uuid, assignee_email text, pending integer, oldest_days integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT p.assigned_to_user_id,
         coalesce(pr.email, CASE WHEN p.assigned_to_user_id IS NULL THEN '(unassigned)' ELSE '(unknown)' END),
         count(*)::int,
         coalesce(max(extract(day from now() - p.created_at))::int, 0)
  FROM proposals p
  LEFT JOIN profiles pr ON pr.id = p.assigned_to_user_id
  WHERE p.status = 'pending' AND hotel_is_in_user_scope(p.hotel_id)
  GROUP BY 1, 2
  ORDER BY 3 DESC;
$$;

COMMENT ON FUNCTION public.review_queue_load() IS
  'Pending review per assignee, unassigned included as its own row. Reads profiles, not auth.users: the function is SECURITY INVOKER and authenticated has no read on auth.users, so the auth.users version failed for every real caller and only worked under service role.';
