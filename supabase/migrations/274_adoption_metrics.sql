-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 274 — is anyone driving? Tier 5.4.
--
-- Audit §11.2, and the sharpest finding in that section: we measure whether the
-- SYSTEM is learning — calibration, the Flywheel, approval lift, vocabulary
-- growth — and never whether OPERATORS are using it. For a product whose entire
-- thesis is that the operator authors the system, that is the blind spot that
-- matters most.
--
--   The Flywheel answers "is it getting smarter."
--   Nothing answered "is anyone driving."
--
-- The three questions the audit named, made answerable:
--   • how many people authored something
--   • how many proposals are reviewed within a day
--   • which properties never show up at all
--
-- Reported as counts and shares, never as a score. A composite "adoption index"
-- would hide exactly the thing worth seeing — that decisions are concentrated in
-- one person, or that a property has gone quiet.
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
  -- Who is authoring at all. One person authoring everything is a different
  -- product from a team authoring, and the count is the only way to tell.
  SELECT 'authors', (SELECT n FROM authors),
         format('%s of %s members have authored a tool, cohort, automation, type or principle',
                (SELECT n FROM authors)::int, (SELECT n FROM members)::int)
  UNION ALL
  SELECT 'author_share',
         CASE WHEN (SELECT n FROM members) = 0 THEN 0
              ELSE round((SELECT n FROM authors) / (SELECT n FROM members) * 100, 0) END,
         'percent of members who have authored something'
  UNION ALL
  -- A proposal nobody decides is the system talking to itself.
  SELECT 'proposals', (SELECT n FROM props), format('proposals raised in the last %s days', p_days)
  UNION ALL
  SELECT 'decided_share',
         CASE WHEN (SELECT n FROM props) = 0 THEN 0
              ELSE round((SELECT n FROM decided) / (SELECT n FROM props) * 100, 0) END,
         'percent of those proposals decided'
  UNION ALL
  -- The audit's own phrasing: "how many proposals are reviewed within a day".
  SELECT 'decided_within_a_day',
         CASE WHEN (SELECT n FROM decided) = 0 THEN 0
              ELSE round((SELECT fast FROM decided) / (SELECT n FROM decided) * 100, 0) END,
         'percent of decisions made within 24 hours of the proposal'
  UNION ALL
  -- Concentration. A high decision rate carried by one person is a key-person
  -- risk wearing the costume of healthy adoption.
  SELECT 'deciders', (SELECT deciders FROM decided), 'distinct people who decided anything'
  UNION ALL
  -- Which properties never show up. Silence at one hotel is invisible in a
  -- portfolio total, which is exactly why it needs its own line.
  SELECT 'quiet_properties',
         (SELECT count(*)::numeric FROM hotels h
          WHERE h.organization_id IS NOT DISTINCT FROM auth_org_id()
            AND NOT EXISTS (SELECT 1 FROM proposals p, since WHERE p.hotel_id = h.id AND p.created_at >= since.t)),
         format('properties with no proposal activity in %s days', p_days);
$$;

COMMENT ON FUNCTION public.adoption_metrics(integer) IS
  'Whether operators are USING the system, as against whether it is learning — the §11.2 blind spot. Counts and shares, never a composite score: an index would hide that decisions are concentrated in one person, or that a property has gone quiet.';
