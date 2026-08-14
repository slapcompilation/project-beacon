-- The six call sites 504's regex could not safely reach.
--
-- 504 wrapped the two scalar helpers and stopped, because a blind rewrite of
-- an array-returning helper breaks: `group_id = ANY (auth_group_ids())` is the
-- ARRAY form of ANY, and `ANY ((SELECT auth_group_ids()))` is the SUBQUERY
-- form, which compares uuid against uuid[]. That is not a reason to leave the
-- calls bare — it is a reason to write them by hand, in the scalar position
-- where the wrap is legal:
--
--   ANY (COALESCE((SELECT auth_group_ids()), '{}'::uuid[]))
--
-- The subquery sits inside COALESCE, so ANY still receives an array. This is
-- the shape 503 already uses and 492 wrote without it.
--
-- Semantics are unchanged including the NULL case: `x = ANY (NULL)` is NULL
-- (row excluded) and `x = ANY ('{}')` is false (row excluded).
--
-- §2 does the same for `auth.uid()`, which Supabase's guidance names directly:
--   "You can use `(select auth.uid())` instead of `auth.uid()` to improve
--    performance" ... "the function is evaluated for each row"
--   (substrate-reference/mirror/api/securing-your-api.md)
-- All eleven of our policies called it bare. It is STABLE, zero-argument and
-- scalar, so the same mechanical loop 504 used applies without the ANY caveat.
--
-- After this migration NO policy calls any of these helpers per row, which is
-- what lets rlsInitPlan.test.ts assert zero with no exception list. A guard
-- with carve-outs decays; this one cannot.

-- ── §1 auth.uid(), mechanically ─────────────────────────────────────────────
DO $$
DECLARE
  p record; new_qual text; new_check text; sql text;
  n_before int; n_after int; rewritten int := 0; bad int;
BEGIN
  SELECT count(*) INTO bad FROM pg_proc pr
   WHERE pr.proname = 'uid' AND pr.pronamespace = 'auth'::regnamespace
     AND (pr.provolatile <> 's' OR pr.pronargs <> 0 OR pr.prorettype <> 'uuid'::regtype);
  IF bad > 0 THEN
    RAISE EXCEPTION 'auth.uid() is not a STABLE zero-argument uuid function — the rewrite would change meaning';
  END IF;

  SELECT count(*) INTO n_before FROM pg_policies WHERE schemaname = 'public';

  FOR p IN
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public'
     ORDER BY tablename, policyname
  LOOP
    -- Postgres renders the wrapped form as "( SELECT auth.uid() AS uid)",
    -- which contains the bare call; protect it before rewriting.
    new_qual := replace(p.qual, '( SELECT auth.uid() AS uid)', '@@uid@@');
    new_qual := regexp_replace(new_qual, '\mauth\.uid\(\)', '( SELECT auth.uid())', 'g');
    new_qual := replace(new_qual, '@@uid@@', '( SELECT auth.uid() AS uid)');

    new_check := replace(p.with_check, '( SELECT auth.uid() AS uid)', '@@uid@@');
    new_check := regexp_replace(new_check, '\mauth\.uid\(\)', '( SELECT auth.uid())', 'g');
    new_check := replace(new_check, '@@uid@@', '( SELECT auth.uid() AS uid)');

    CONTINUE WHEN new_qual IS NOT DISTINCT FROM p.qual
             AND new_check IS NOT DISTINCT FROM p.with_check;

    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
                  p.policyname, p.tablename, p.permissive, p.cmd,
                  array_to_string(p.roles, ', '));
    IF new_qual IS NOT NULL THEN sql := sql || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN sql := sql || format(' WITH CHECK (%s)', new_check); END IF;
    EXECUTE sql;
    rewritten := rewritten + 1;
  END LOOP;

  SELECT count(*) INTO n_after FROM pg_policies WHERE schemaname = 'public';
  IF n_after <> n_before THEN
    RAISE EXCEPTION 'policy count changed: % before, % after', n_before, n_after;
  END IF;
  RAISE NOTICE '505: % policies stopped calling auth.uid() per row', rewritten;
END $$;

-- ── §2 the five array-helper sites, by hand ─────────────────────────────────
-- Each is recreated with its kind, command and roles intact; only where the
-- helper runs changes.

-- 492's guest reach: the organization list is scalar inside COALESCE.
DROP POLICY "guests view the registry" ON public.users;
CREATE POLICY "guests view the registry" ON public.users FOR SELECT
  USING (organization_id = ANY (COALESCE((SELECT public.auth_org_ids()), '{}'::uuid[])));

DROP POLICY "guests see groups" ON public.groups;
CREATE POLICY "guests see groups" ON public.groups FOR SELECT
  USING (organization_id = ANY (COALESCE((SELECT public.auth_org_ids()), '{}'::uuid[])));

-- 489's group arm on both marking ledgers.
DROP POLICY "see own membership" ON public.marking_members;
CREATE POLICY "see own membership" ON public.marking_members FOR SELECT
  USING (user_id = (SELECT auth.uid())
         OR group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[]))
         OR (SELECT public.auth_role()) = ANY (ARRAY['owner', 'admin']));

DROP POLICY "see own permissions" ON public.marking_permissions;
CREATE POLICY "see own permissions" ON public.marking_permissions FOR SELECT
  USING (user_id = (SELECT auth.uid())
         OR group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[]))
         OR (SELECT public.auth_role()) = ANY (ARRAY['owner', 'admin']));

DROP POLICY "members see their org's guests" ON public.organization_guests;
CREATE POLICY "members see their org's guests" ON public.organization_guests FOR SELECT
  USING (organization_id = (SELECT public.auth_org_id())
         OR user_id = (SELECT auth.uid())
         OR group_id = ANY (COALESCE((SELECT public.auth_group_ids()), '{}'::uuid[])));

-- ── assertions ──────────────────────────────────────────────────────────────
-- The rewritten arms, exercised as the role PostgREST connects as. The group
-- arm is the one whose SQL shape changed, so it is the one proved here.
DO $$
DECLARE
  org uuid; grp uuid; cat uuid; mk uuid;
  u uuid := gen_random_uuid(); before text; n int; bad int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('initplan-505') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ip505@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u, 'ip505@beacon.test', 'admin', org);

  INSERT INTO public.groups (organization_id, name) VALUES (org, 'Analysts 505') RETURNING id INTO grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u);

  INSERT INTO public.marking_categories (name) VALUES ('m505') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII 505') RETURNING id INTO mk;
  INSERT INTO public.marking_members (marking_id, group_id) VALUES (mk, grp);
  INSERT INTO public.marking_permissions (marking_id, group_id, permission) VALUES (mk, grp, 'apply');

  -- A member reads both ledgers through the group arm. 'member' role, so the
  -- owner/admin arm cannot be what answers.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', org))::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.marking_members WHERE marking_id = mk;
  IF n <> 1 THEN RAISE EXCEPTION 'the group arm of marking_members stopped answering (% rows)', n; END IF;
  SELECT count(*) INTO n FROM public.marking_permissions WHERE marking_id = mk;
  IF n <> 1 THEN RAISE EXCEPTION 'the group arm of marking_permissions stopped answering (% rows)', n; END IF;
  -- And the group itself is still visible to its own organization.
  SELECT count(*) INTO n FROM public.groups WHERE id = grp;
  IF n <> 1 THEN RAISE EXCEPTION 'a member lost sight of a group in their own organization'; END IF;

  RESET ROLE;

  -- Nothing anywhere calls one of these per row any more.
  SELECT count(*) INTO bad FROM pg_policies pol, unnest(ARRAY[
      'auth_org_id', 'auth_role', 'auth_org_ids', 'auth_group_ids',
      'auth_marking_ids', 'auth_group_names', 'auth_org_marking_ids']) f(name)
   WHERE pol.schemaname = 'public'
     AND regexp_replace(coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''),
                        '\( SELECT ' || f.name || '\(\)[^)]*\)', '', 'g')
         ~ ('\m' || f.name || '\(\)');
  IF bad > 0 THEN
    RAISE EXCEPTION '% policy expression(s) still call a helper per row', bad;
  END IF;

  SELECT count(*) INTO bad FROM pg_policies pol
   WHERE pol.schemaname = 'public'
     AND regexp_replace(coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''),
                        '\( SELECT auth\.uid\(\)[^)]*\)', '', 'g')
         LIKE '%auth.uid()%';
  IF bad > 0 THEN
    RAISE EXCEPTION '% policy expression(s) still call auth.uid() per row', bad;
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '505: every policy helper is an InitPlan';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
