-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 407 — the second recursion, found by the check 406 added.
--
-- 406 taught check:datasets to read every guarded table as `authenticated`
-- rather than as the connection owner. It immediately found a second infinite
-- recursion, in a migration written four steps earlier:
--
--     select count(*) from markings
--     ERROR: infinite recursion detected in policy for relation "marking_permissions"
--
-- 399 wrote the marking_permissions policy as "an org admin, OR someone holding
-- `manage` on this marking" — and expressed the second half as a subquery
-- **against marking_permissions itself**:
--
--     USING (auth_role() IN ('owner','admin')
--            OR EXISTS (SELECT 1 FROM marking_permissions p WHERE …))
--
-- A policy that reads its own table re-enters itself. Same shape as 403's
-- datasets policy, different table, and neither was reachable by a guard that
-- connects as the owner.
--
-- `can_see_marking_category` has it too, one level removed: it is called from the
-- `markings` policy and reads `markings`.
--
-- THE RULE, stated so it can be applied rather than rediscovered:
--
--   **A policy may not read the table it guards, directly or through a function
--   with invoker rights.** The membership test belongs in a SECURITY DEFINER
--   resolution function; the policy composes it.
--
-- That is the same separation 406 drew: resolution functions answer "what does
-- this resource demand" or "what does this caller hold" and run as owner;
-- policies make the decision and run as the caller.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

/** Does the caller hold `manage` on this marking. Reads marking_permissions, so
 *  it must not run with invoker rights — the policy on that table calls it. */
CREATE OR REPLACE FUNCTION public.can_manage_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.marking_permissions p
                  WHERE p.marking_id = p_marking AND p.user_id = auth.uid()
                    AND p.permission = 'manage')
$$;

DROP POLICY IF EXISTS "managers grant permissions" ON public.marking_permissions;
CREATE POLICY "managers grant permissions" ON public.marking_permissions
  FOR ALL
  USING (public.auth_role() IN ('owner','admin')
         OR public.can_manage_marking(marking_id))
  WITH CHECK (public.auth_role() IN ('owner','admin')
         OR public.can_manage_marking(marking_id));

-- Called from the policies on `markings` and `marking_categories`, and reads
-- both. Same reason.
CREATE OR REPLACE FUNCTION public.can_see_marking_category(p_category uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_categories c
     WHERE c.id = p_category
       AND (c.organization_id IS NULL
            OR c.organization_id IS NOT DISTINCT FROM public.auth_org_id())
       AND (c.visibility = 'visible'
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_members mm ON mm.marking_id = m.id
                       WHERE m.category_id = c.id AND mm.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_permissions p ON p.marking_id = m.id
                       WHERE m.category_id = c.id AND p.user_id = auth.uid())))
$$;

-- Same class: called from the scoped-session policies and reads scoped_sessions
-- and scoped_session_markings.
CREATE OR REPLACE FUNCTION public.can_choose_scoped_session(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.scoped_sessions s
                  WHERE s.id = p_session
                    AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id())
     AND NOT EXISTS (
       SELECT 1 FROM public.scoped_session_markings sm
        WHERE sm.scoped_session_id = p_session
          AND NOT EXISTS (SELECT 1 FROM public.marking_members mm
                           WHERE mm.marking_id = sm.marking_id AND mm.user_id = auth.uid()))
$$;

-- passes_scoped_session reads four tables and is called from the datasets and
-- projects policies via resource_file_access. It is resolution, not decision.
CREATE OR REPLACE FUNCTION public.passes_scoped_session(p_markings uuid[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE st record; sess uuid; chosen boolean; sess_markings uuid[];
BEGIN
  SELECT * INTO st FROM public.organization_scoped_session_settings
   WHERE organization_id IS NOT DISTINCT FROM public.auth_org_id();
  IF st IS NULL OR NOT st.enabled THEN RETURN true; END IF;

  SELECT true, u.scoped_session_id INTO chosen, sess
    FROM public.user_scoped_session u WHERE u.user_id = auth.uid();

  IF sess IS NULL THEN
    IF coalesce(chosen, false) OR st.allow_no_session THEN
      IF st.allow_no_session THEN RETURN true; END IF;
    END IF;
    sess_markings := '{}'::uuid[];
  ELSIF NOT public.can_choose_scoped_session(sess) THEN
    sess_markings := '{}'::uuid[];
  ELSE
    SELECT coalesce(array_agg(sm.marking_id), '{}'::uuid[]) INTO sess_markings
      FROM public.scoped_session_markings sm WHERE sm.scoped_session_id = sess;
  END IF;

  IF p_markings IS NULL OR array_length(p_markings, 1) IS NULL THEN RETURN true; END IF;
  RETURN p_markings && sess_markings;
END $$;

-- satisfies_markings reads marking_members, and the datasets policy calls it.
CREATE OR REPLACE FUNCTION public.satisfies_markings(p_markings uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p_markings, '{}'::uuid[])) AS m(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.marking_members mm
        WHERE mm.marking_id = m.id AND mm.user_id = auth.uid()))
$$;

DO $$
DECLARE n int;
BEGIN
  -- Every resolution function called from a policy must run as owner. Listed
  -- explicitly rather than inferred, so adding one to a policy without adding it
  -- here is a visible omission.
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname IN ('effective_file_markings','effective_data_markings',
                     'satisfies_markings','passes_scoped_session',
                     'can_see_marking_category','can_choose_scoped_session',
                     'can_manage_marking')
     AND NOT prosecdef;
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 407: % resolution function(s) called from a policy still run with invoker rights', n;
  END IF;

  -- The policy that caused it must no longer name its own table.
  IF (SELECT pg_get_expr(p.polqual, p.polrelid) FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'marking_permissions' AND p.polname = 'managers grant permissions')
     LIKE '%FROM marking_permissions%' THEN
    RAISE EXCEPTION 'Migration 407: the marking_permissions policy still reads its own table';
  END IF;
END $$;

COMMIT;
