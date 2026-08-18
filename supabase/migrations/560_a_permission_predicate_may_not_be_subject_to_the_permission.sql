-- `project_role` is SECURITY INVOKER and reads `project_role_grants`, which is
-- RLS-guarded — so the predicate that decides access was itself subject to the
-- access it decides.
--
-- ── HOW IT SURFACED, AND WHY IT WAS INVISIBLE BEFORE ────────────────────────
-- 558 put `project_role` on the read path and 559 taught it about guests. The
-- guest case still failed, and the reason is not in either function:
--
--     members read grants:  organization_id = auth_org_id()
--
-- The caller's PRIMARY organization only. A guest of the host organization
-- cannot SELECT the grant row that was made to them, so `project_role` — being
-- SECURITY INVOKER — sees no grant and answers NULL. Called as the owner it
-- answers `viewer`; called as `authenticated` it answers NULL. The predicate
-- disagreed with itself depending on who asked, which is the whole hazard.
--
-- Verified before writing, as the real role: with the grant in place,
-- `project_role` returns `viewer`, `resource_file_access` returns true and the
-- markings pass, while `SELECT ... FROM projects` as `authenticated` returns
-- zero rows.
--
-- ── AND A RECURSION THAT WAS SITTING THERE ─────────────────────────────────
-- `role holders grant` is FOR ALL on `project_role_grants` and its USING calls
-- `project_role(project_id)`, which SELECTs `project_role_grants`, which
-- consults the policies on `project_role_grants`. A policy reading the table it
-- guards is the shape that put two infinite recursions into production before,
-- and the standing rule from that repair is exactly this: **a policy may not
-- read the table it guards.** Making the predicate SECURITY DEFINER removes
-- the loop as well as the bug.
--
-- ── WHY DEFINER IS THE RIGHT ANSWER AND NOT A WIDENING ─────────────────────
-- The alternative was to widen `members read grants` to `auth_in_org`, which
-- would let a guest READ the grant table. That is a different, larger decision
-- about who may see the grant ledger, and it would not remove the recursion.
-- Every sibling predicate is already SECURITY DEFINER for this reason —
-- `auth_in_org`, `auth_org_ids`, `auth_group_ids`.
--
-- The function stays safe because its body already answers only about the
-- caller: `g.user_id = auth.uid()`, groups from `auth_group_ids()`, and
-- `auth_in_org` on every arm. It can see every grant and can still only report
-- the caller's own, in organizations the caller belongs to.

BEGIN;

CREATE OR REPLACE FUNCTION public.project_role(p_project uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT r.role
    FROM (
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.user_id = auth.uid()
         AND public.auth_in_org(g.organization_id)
      UNION ALL
      SELECT g.role
        FROM public.project_role_grants g
       WHERE g.project_id = p_project
         AND g.group_id = ANY (public.auth_group_ids())
         AND public.auth_in_org(g.organization_id)
      UNION ALL
      SELECT p.default_role
        FROM public.projects p
       WHERE p.id = p_project
         AND p.default_role IS NOT NULL
         AND public.auth_in_org(p.organization_id)
    ) r
   ORDER BY public.role_rank(r.role) DESC
   LIMIT 1
$fn$;

-- 547's lesson: restate the boundary whenever the function is rewritten.
REVOKE ALL ON FUNCTION public.project_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_role(uuid) TO authenticated;

COMMENT ON FUNCTION public.project_role(uuid) IS
  'The caller''s strongest role on one project — direct, via a group, or the project default — in any organization they belong to. SECURITY DEFINER because a predicate that decides access may not be subject to it, and because the grants policy calls this function.';

-- ── assertions, which execute the path AS THE REAL ROLE ─────────────────────
DO $do$
DECLARE org uuid; away uuid; usr uuid; proj uuid; n int; as_owner text; as_caller text;
BEGIN
  SELECT p.id, p.organization_id INTO proj, org
    FROM public.projects p WHERE p.api_name = 'example_data';
  SELECT g.user_id INTO usr FROM public.project_role_grants g
   WHERE g.project_id = proj AND g.user_id IS NOT NULL LIMIT 1;
  IF proj IS NULL OR usr IS NULL THEN
    RAISE EXCEPTION '560: no granted project to assert against';
  END IF;

  -- The bug, stated as a test: the predicate must give the same answer to the
  -- owner and to the caller. Asking it only as the owner is what hid this.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
  as_owner := public.project_role(proj);
  SET LOCAL ROLE authenticated;
  as_caller := public.project_role(proj);
  RESET ROLE;
  IF as_owner IS DISTINCT FROM as_caller THEN
    RAISE EXCEPTION 'project_role answers % as owner and % as authenticated', as_owner, as_caller;
  END IF;

  -- And the read it gates now succeeds for the grantee, as the real role.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  RESET ROLE;
  IF n <> 1 THEN
    RAISE EXCEPTION 'a grantee reading as authenticated saw % project(s)', n;
  END IF;

  -- A stranger in the same organization still sees nothing: 558 holds.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text,
      'app_metadata', json_build_object('role', 'limited_access', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.projects WHERE id = proj;
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'a caller with no role reads the project again';
  END IF;

  RAISE NOTICE '560: a permission predicate may not be subject to the permission';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
