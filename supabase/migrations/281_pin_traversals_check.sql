-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 281 — pin the search_path on the traversals grammar check.
--
-- get_advisors after 280 surfaced one function with a mutable search_path, and
-- it was ours: 265's CHECK helper on object_sets.traversals. Low risk — it is
-- SECURITY INVOKER, pure SQL, and everything it calls lives in pg_catalog,
-- which is searched first regardless. Pinned anyway because a CHECK constraint
-- runs on every write to the table, and "low risk" is not a reason to leave the
-- only advisory finding attributable to this arc sitting open.
--
-- security_invariants.sql did not catch it: that check covers unpinned
-- SECURITY DEFINER functions, and this one is INVOKER. Noted rather than
-- widened — a CHECK helper is a different risk shape and the invariant should
-- not blur the two.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.object_set_traversals_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT jsonb_typeof(p) = 'array'
     AND jsonb_array_length(p) <= 3
     AND coalesce(bool_and(
           jsonb_typeof(e) = 'object'
           AND coalesce(e->>'edgeType','') <> ''
           AND coalesce(e->>'direction','') IN ('forward','reverse')
           AND (e->'filters' IS NULL OR jsonb_typeof(e->'filters') = 'array')
         ), true)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END) e;
$$;

-- The constraint still has to accept what it accepted before and reject what it
-- rejected. Depth 3 is Foundry's Search Around cap and the reason this exists.
DO $$
BEGIN
  IF NOT public.object_set_traversals_valid('[]'::jsonb)
     OR NOT public.object_set_traversals_valid('[{"edgeType":"causes","direction":"forward"}]'::jsonb)
     OR public.object_set_traversals_valid('[{"edgeType":"causes","direction":"sideways"}]'::jsonb)
     OR public.object_set_traversals_valid(
          '[{"edgeType":"a","direction":"forward"},{"edgeType":"b","direction":"forward"},
            {"edgeType":"c","direction":"forward"},{"edgeType":"d","direction":"forward"}]'::jsonb)
  THEN
    RAISE EXCEPTION 'Migration 281: pinning search_path changed the traversals grammar';
  END IF;
END $$;

COMMIT;
