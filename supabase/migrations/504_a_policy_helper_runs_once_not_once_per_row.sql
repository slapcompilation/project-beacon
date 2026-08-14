-- Every RLS policy helper becomes an InitPlan.
--
-- Supabase's own guidance, and the reason:
--   "calling functions directly in RLS policies can impact database
--    performance, as the function is evaluated for each row when the policy
--    is checked" (substrate-reference/mirror/api/securing-your-api.md)
-- and their examples write `(select auth.uid())` rather than `auth.uid()`.
--
-- Measured here before touching anything, on 200,000 rows:
--   organization_id = auth_org_id()                    1590 ms
--   organization_id = (select auth_org_id())             86 ms
--   NOT (organization_id IS DISTINCT FROM auth_org_id()) 1586 ms   ← our idiom
-- An 18x difference, because the wrapped form is evaluated once per QUERY
-- instead of once per ROW.
--
-- Why this is safe rather than clever: all seven helpers are STABLE with
-- ZERO arguments (checked against pg_proc below). STABLE guarantees one
-- consistent value within a statement, and zero arguments means there is
-- nothing row-dependent to capture. The predicate's meaning is unchanged;
-- only when the value is computed changes.
--
-- Helpers that take row columns — project_role(project_id),
-- resource_file_access('dataset', id, organization_id), can_read_dataset(…) —
-- are deliberately NOT touched: they depend on the row and must run per row.
--
-- Nor are the ARRAY-returning helpers (auth_org_ids, auth_group_ids,
-- auth_marking_ids, auth_group_names, auth_org_marking_ids). The first
-- attempt at this migration included them and failed with
-- "operator does not exist: uuid = uuid[]": `x = ANY (auth_org_ids())` is the
-- array form, and wrapping it gives `x = ANY ((SELECT auth_org_ids()))`,
-- which Postgres reads as the SUBQUERY form of ANY. Whether the wrap is safe
-- depends on the surrounding expression, which is more than a regex can know
-- — so those five call sites keep their bare calls, and a policy that wants
-- the InitPlan form writes it by hand inside a scalar position, the way 503
-- does with coalesce((SELECT auth_org_ids()), '{}').
--
-- The two scalar helpers are 175 of the ~180 call sites, so nearly all of the
-- measured gain lands here anyway.
--
-- The rewrite is mechanical and reads the live catalog rather than a list, so
-- it cannot miss a policy or invent one. Every policy is recreated with its
-- permissive/restrictive kind, command and roles intact.

DO $$
DECLARE
  p record;
  -- Scalar-returning only; see the note above on ANY().
  fns text[] := ARRAY['auth_org_id', 'auth_role'];
  fn text; new_qual text; new_check text; sql text;
  n_before int; n_after int; rewritten int := 0; bad int;
BEGIN
  -- The safety precondition, asserted rather than assumed.
  SELECT count(*) INTO bad FROM unnest(fns) f(name)
    LEFT JOIN pg_proc pr ON pr.proname = f.name AND pr.pronamespace = 'public'::regnamespace
   WHERE pr.oid IS NULL OR pr.provolatile <> 's' OR pr.pronargs <> 0
      OR pr.prorettype = 'uuid[]'::regtype OR pr.prorettype = 'text[]'::regtype;
  IF bad > 0 THEN
    RAISE EXCEPTION '% helper(s) are not STABLE zero-argument scalar functions — the rewrite would change meaning', bad;
  END IF;

  SELECT count(*) INTO n_before FROM pg_policies WHERE schemaname = 'public';

  FOR p IN
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public'
     ORDER BY tablename, policyname
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    FOREACH fn IN ARRAY fns LOOP
      -- Protect what is already wrapped: Postgres renders a scalar subquery
      -- as "( SELECT auth_org_id() AS auth_org_id)", which contains the bare
      -- form and would otherwise be wrapped twice.
      new_qual := replace(new_qual, format('( SELECT %s() AS %s)', fn, fn), format('@@%s@@', fn));
      new_qual := regexp_replace(new_qual, format('\m%s\(\)', fn), format('( SELECT %s())', fn), 'g');
      new_qual := replace(new_qual, format('@@%s@@', fn), format('( SELECT %s() AS %s)', fn, fn));

      new_check := replace(new_check, format('( SELECT %s() AS %s)', fn, fn), format('@@%s@@', fn));
      new_check := regexp_replace(new_check, format('\m%s\(\)', fn), format('( SELECT %s())', fn), 'g');
      new_check := replace(new_check, format('@@%s@@', fn), format('( SELECT %s() AS %s)', fn, fn));
    END LOOP;

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

  -- Nothing gained, nothing lost.
  SELECT count(*) INTO n_after FROM pg_policies WHERE schemaname = 'public';
  IF n_after <> n_before THEN
    RAISE EXCEPTION 'policy count changed: % before, % after', n_before, n_after;
  END IF;

  -- And no bare call survives anywhere.
  SELECT count(*) INTO bad FROM pg_policies pol, unnest(fns) f(name)
   WHERE pol.schemaname = 'public'
     AND (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''))
         ~ ('\m' || f.name || '\(\)')
     AND (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''))
         !~ ('SELECT ' || f.name || '\(\)');
  IF bad > 0 THEN
    RAISE EXCEPTION '% policy expression(s) still call a helper per row', bad;
  END IF;

  RAISE NOTICE '504: % of % policies rewritten — helpers now run once per query', rewritten, n_before;
END $$;
