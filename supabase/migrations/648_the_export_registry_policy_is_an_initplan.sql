-- The platform suite refused 647's registry policy within the hour it landed:
-- `auth_role()` was called bare, once per row, where every other policy wraps
-- the zero-argument helpers in a scalar subquery so the planner runs them
-- once as an InitPlan — the cost 619 measured and the rlsInitPlan suite now
-- refuses mechanically. Same predicate, wrapped; `auth_in_org` stays bare
-- because it takes the row's column and cannot be an InitPlan.

DROP POLICY "org admins see their exports" ON public.audit_exports;
CREATE POLICY "org admins see their exports" ON public.audit_exports
  FOR SELECT USING (public.auth_in_org(organization_id)
                    AND (SELECT public.auth_role()) IN ('owner', 'admin'));

DO $$
DECLARE q text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO q FROM pg_policy
   WHERE polname = 'org admins see their exports'
     AND polrelid = 'public.audit_exports'::regclass;
  IF q !~ 'SELECT auth_role' THEN
    RAISE EXCEPTION 'the helper is still called per row: %', q;
  END IF;
  RAISE NOTICE '648: the registry policy runs auth_role once, as an InitPlan';
END $$;
