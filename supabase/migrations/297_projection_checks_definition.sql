-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 297 — projection is a property of the view, not of the data.
--
-- 296's check asked "does this link type have rows in relationship_edges" and
-- called a no on that "REGISTERED BUT NOT PROJECTED". It fired on seven links
-- immediately — causes, reverts, triggered_alert and friends — every one of
-- them correctly projected and simply EMPTY. link_causes has no rows; nothing
-- has been reverted.
--
-- "No data" and "no branch" are different states and a guard that conflates them
-- is worse than none: it cries wolf on an empty table and would stay silent the
-- day a branch went missing from a populated one.
--
-- The right question is whether the view's DEFINITION names the edge type,
-- which is exactly what a dropped branch changes and what data never does.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.unprojected_link_types()
RETURNS TABLE (edge_type text, backing_kind text, reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT l.edge_type, l.backing_kind, 'REGISTERED BUT NOT IN THE VIEW'::text
  FROM link_types l
  WHERE l.edge_type IS NOT NULL
    AND l.backing_kind IN ('foreign_key','join_table')
    AND l.projected
    -- The generated body emits each branch as '<edge_type>'::text. A missing
    -- branch changes this; an empty backing table does not.
    AND position('''' || l.edge_type || '''::text' IN
                 pg_get_viewdef('public.relationship_edges'::regclass, true)) = 0
$$;

COMMENT ON FUNCTION public.unprojected_link_types() IS
  'Projected link types the view definition does not name. Tests the DEFINITION, not row counts: an empty backing table is not a missing branch, and a guard that confuses the two is silent on the failure that matters.';

-- The guard must be quiet now, and it must still have teeth: a link type the
-- view does not name has to be found.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM unprojected_link_types();
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 297: % link type(s) still unprojected after the definition fix', n;
  END IF;

  -- Teeth check: a name the view certainly does not carry must be reported.
  IF (SELECT count(*) FROM link_types l
       WHERE l.projected AND l.edge_type IS NOT NULL
         AND position('''' || 'no_such_edge_type' || '''::text' IN
                      pg_get_viewdef('public.relationship_edges'::regclass, true)) = 0) = 0 THEN
    RAISE EXCEPTION 'Migration 297: the projection test cannot detect a missing branch';
  END IF;
END $$;

COMMIT;
