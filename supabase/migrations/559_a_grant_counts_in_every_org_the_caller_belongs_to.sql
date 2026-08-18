-- `project_role` restated the organization test more narrowly than the
-- predicate it was guarding beside, and 558 made that visible.
--
-- ── HOW IT SURFACED ─────────────────────────────────────────────────────────
-- 558 added the published role conjunct to the read path, and one standing
-- test failed: "a guest views the host org read-only" (492). The failure is
-- correct and it found two separate things.
--
-- ── ONE: A GUEST IS NOT GRANTED BY BEING A GUEST ────────────────────────────
-- The test expected a guest of the host organization to READ the host's
-- project while holding no role at all. Three pages say otherwise.
--
--   "Organizations are access requirements applied to Projects that enforce
--    strict silos between groups of users and resources. Every user is a
--    member of only one Organization but can be a guest member of multiple
--    Organizations."
--
-- An access *requirement* is a gate, not a grant. The same page then does the
-- granting explicitly, and it is a separate act:
--
--   "We need to grant both Sunrise Airlines and Sky Industries administrators
--    roles on the shared space so they can create Projects and change space
--    settings."
--                            (security/cross-organization-collaboration)
--
-- and `security/projects-and-roles` states the asymmetry outright: mandatory
-- controls "will always prevent an ineligible user from accessing a resource,
-- regardless of the user's role". Prevent — never permit. So guest membership
-- satisfies the organization clause and nothing else; the role clause still
-- has to be satisfied on its own. The test is corrected alongside this
-- migration rather than the conjunct being weakened to fit it.
--
-- ── TWO: THE RESTATEMENT, WHICH IS THE ACTUAL BUG HERE ──────────────────────
-- Even a guest who IS granted a role could not have held it. `project_role`
-- tested each grant with
--
--     g.organization_id IS NOT DISTINCT FROM public.auth_org_id()
--
-- and its comment explains the intent — "a grant in another organization is
-- not a grant" — which is right. But `auth_org_id()` is the caller's PRIMARY
-- organization only, while the mandatory predicate it sits beside,
-- `resource_file_access`, accepts `auth_org_ids()`: primary *and* guest. Two
-- statements of one rule, disagreeing.
--
-- `auth_in_org(uuid)` is already that rule, composed: primary union guest. So
-- this replaces the restatement with the predicate, which is the standing
-- lesson — compose, never restate. The intent is unchanged: a grant in an
-- organization the caller does not belong to still counts for nothing.

BEGIN;

CREATE OR REPLACE FUNCTION public.project_role(p_project uuid)
RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT r.role
    FROM (
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.user_id = auth.uid()
         -- Composed, not restated: every organization the caller belongs to,
         -- primary or guest, exactly as resource_file_access reads it.
         AND public.auth_in_org(g.organization_id)
      UNION ALL
      -- "Access to Projects and resources are usually granted to groups
      -- rather than individual users." (security/users-and-groups.md)
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.group_id = ANY (public.auth_group_ids())
         AND public.auth_in_org(g.organization_id)
      UNION ALL
      -- "Everyone from <org> … is granted the <role> role." A default reaches
      -- the members of the project's own organization; a guest is a member of
      -- it for access purposes, so the same predicate serves.
      SELECT p.default_role
        FROM public.projects p
       WHERE p.id = p_project
         AND p.default_role IS NOT NULL
         AND public.auth_in_org(p.organization_id)
    ) r
   ORDER BY public.role_rank(r.role) DESC
   LIMIT 1
$fn$;

-- ── assertions, which execute the path and insert nothing ───────────────────
DO $do$
DECLARE org uuid; away uuid; usr uuid; proj uuid; got text; n int;
BEGIN
  SELECT p.id, p.organization_id INTO proj, org
    FROM public.projects p WHERE p.api_name = 'example_data';
  SELECT g.user_id INTO usr FROM public.project_role_grants g
   WHERE g.project_id = proj AND g.user_id IS NOT NULL LIMIT 1;
  IF proj IS NULL OR usr IS NULL THEN
    RAISE EXCEPTION '559: no granted project to assert against';
  END IF;

  -- The primary-organization case is unchanged.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  got := public.project_role(proj);
  IF got IS NULL THEN
    RAISE EXCEPTION 'a direct grantee in their own organization lost their role';
  END IF;

  -- THE FIX: the same grant, reached as a GUEST. The caller's primary
  -- organization is elsewhere and the host is in guest_org_ids — which is
  -- precisely the shape the old restatement rejected.
  away := gen_random_uuid();
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object(
        'role', 'admin', 'org_id', away,
        'guest_org_ids', json_build_array(org)))::text, true);
  IF public.project_role(proj) IS DISTINCT FROM got THEN
    RAISE EXCEPTION 'a guest could not hold a grant made to them in the host organization';
  END IF;

  -- And the intent the restatement was protecting still holds: an
  -- organization the caller does not belong to at all confers nothing.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', away))::text, true);
  IF public.project_role(proj) IS NOT NULL THEN
    RAISE EXCEPTION 'a grant counted for a caller who belongs to neither organization';
  END IF;

  -- A guest who was never granted anything still holds nothing, which is the
  -- behaviour 492 asserted the opposite of.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text,
      'app_metadata', json_build_object(
        'role', 'admin', 'org_id', away,
        'guest_org_ids', json_build_array(org)))::text, true);
  IF public.project_role(proj) IS NOT NULL THEN
    RAISE EXCEPTION 'guest membership alone conferred a role';
  END IF;

  RAISE NOTICE '559: a grant counts in every org the caller belongs to';
END $do$;

COMMIT;
