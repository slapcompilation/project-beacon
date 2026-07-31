-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 286 — a share with no denominator is unknown, not zero.
--
-- Found the moment 274's adoption_metrics got its first consumer (the Flywheel
-- adoption band). Called where auth_org_id() resolves to nothing, it returned:
--
--   authors        2   "2 of 0 members have authored ..."
--   author_share   0   "percent of members who have authored something"
--
-- Two people have authored and the dashboard says 0%. The guard was there —
-- CASE WHEN members = 0 THEN 0 — it just guarded against the division and not
-- against the lie. Zero is a real reading that means "nobody is authoring";
-- this is "we cannot tell", and those must not render the same.
--
-- Same for decided_share and decided_within_a_day: no proposals in the window,
-- or none decided, is an empty denominator rather than a zero percent.
--
-- NULL rather than 0 so the surface renders an em dash. This is the audit's own
-- recurring failure in miniature — not an error, an answer that looks right.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adoption_metrics(p_days integer DEFAULT 30)
RETURNS TABLE (metric text, value numeric, detail text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH since AS (SELECT now() - make_interval(days => p_days) AS t),
  members AS (
    SELECT count(*)::numeric n FROM user_org_memberships m
    WHERE m.organization_id IS NOT DISTINCT FROM auth_org_id()
  ),
  authors AS (
    SELECT count(DISTINCT u)::numeric n FROM (
      SELECT created_by_user_id u FROM user_tools   WHERE created_by_user_id IS NOT NULL
      UNION SELECT created_by_user_id FROM object_sets  WHERE created_by_user_id IS NOT NULL
      UNION SELECT created_by_user_id FROM automations  WHERE created_by_user_id IS NOT NULL
      UNION SELECT created_by_user_id FROM object_types WHERE kind = 'authored' AND created_by_user_id IS NOT NULL
      UNION SELECT authored_by_user_id FROM principles  WHERE authored_by_user_id IS NOT NULL
    ) a
  ),
  props AS (
    SELECT count(*)::numeric n FROM proposals p, since WHERE p.created_at >= since.t
  ),
  decided AS (
    SELECT count(*)::numeric n,
           count(*) FILTER (WHERE p.decided_at - p.created_at <= interval '24 hours')::numeric fast,
           count(DISTINCT p.decided_by_user_id)::numeric deciders
    FROM proposals p, since WHERE p.decided_at IS NOT NULL AND p.created_at >= since.t
  )
  SELECT 'authors', (SELECT n FROM authors),
         format('%s of %s members have authored a tool, cohort, automation, type or principle',
                (SELECT n FROM authors)::int, (SELECT n FROM members)::int)
  UNION ALL
  -- NULL, not 0: no members means the share is unknowable. Zero would read as
  -- "nobody authors here", which is a different and wrong statement.
  SELECT 'author_share',
         CASE WHEN (SELECT n FROM members) = 0 THEN NULL
              ELSE round((SELECT n FROM authors) / (SELECT n FROM members) * 100, 0) END,
         'percent of members who have authored something'
  UNION ALL
  SELECT 'proposals', (SELECT n FROM props), format('proposals raised in the last %s days', p_days)
  UNION ALL
  SELECT 'decided_share',
         CASE WHEN (SELECT n FROM props) = 0 THEN NULL
              ELSE round((SELECT n FROM decided) / (SELECT n FROM props) * 100, 0) END,
         'percent of those proposals decided'
  UNION ALL
  SELECT 'decided_within_a_day',
         CASE WHEN (SELECT n FROM decided) = 0 THEN NULL
              ELSE round((SELECT fast FROM decided) / (SELECT n FROM decided) * 100, 0) END,
         'percent of decisions made within 24 hours of the proposal'
  UNION ALL
  SELECT 'deciders', (SELECT deciders FROM decided), 'distinct people who decided anything'
  UNION ALL
  SELECT 'quiet_properties',
         (SELECT count(*)::numeric FROM hotels h
          WHERE h.organization_id IS NOT DISTINCT FROM auth_org_id()
            AND NOT EXISTS (SELECT 1 FROM proposals p, since WHERE p.hotel_id = h.id AND p.created_at >= since.t)),
         format('properties with no proposal activity in %s days', p_days);
$$;

COMMENT ON FUNCTION public.adoption_metrics(integer) IS
  'Whether operators are USING the system, as against whether it is learning — the §11.2 blind spot. Counts and shares, never a composite score. A share with an empty denominator is NULL, not 0: "we cannot tell" and "nobody does this" must not render the same.';

-- The bug this migration exists for: authors > 0 while the share reads 0%.
DO $$
DECLARE v_authors numeric; v_share numeric;
BEGIN
  SELECT value INTO v_authors FROM adoption_metrics(90) WHERE metric = 'authors';
  SELECT value INTO v_share   FROM adoption_metrics(90) WHERE metric = 'author_share';
  IF v_authors > 0 AND v_share = 0 THEN
    RAISE EXCEPTION 'Migration 286: % authors but author_share still reports 0', v_authors;
  END IF;
END $$;
