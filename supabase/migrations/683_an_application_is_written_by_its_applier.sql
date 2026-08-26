-- 683: an application is written by its applier.
--
-- 682 gave action_applications RLS and a SELECT policy, and stopped there.
-- apply_action is INVOKER — deliberately, so every edit it writes is subject
-- to the caller's own policies — so the INSERT it now makes was refused for
-- every authenticated caller, Postgres reporting a row-level security
-- violation on action_applications. Fourteen platform tests said so, and none
-- of them is about reverts: the failure surfaced as the WRONG error on
-- unrelated action assertions, because the refusal happened before the
-- action could raise its own.
--
-- The rule the policies hold is the page's own:
--
--   "Currently, actions can only be reverted by the user who applied the action."
--   — action-types/action-reverts.md
--
-- so a caller writes only their own application, and updates only their own
-- — which is the whole of who may revert, held where the row is rather than
-- restated in the function.

CREATE POLICY "apply your own action" ON public.action_applications
  FOR INSERT WITH CHECK (
    applied_by_user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.action_types a WHERE a.id = action_type_id));

CREATE POLICY "revert your own application" ON public.action_applications
  FOR UPDATE USING (applied_by_user_id = (SELECT auth.uid()))
          WITH CHECK (applied_by_user_id = (SELECT auth.uid()));

GRANT INSERT, UPDATE ON public.action_applications TO authenticated;

-- ── PROVED BY DOING, as the real role ───────────────────────────────────────
-- 682's probe ran as the owner, which is exactly why it missed this. This
-- one asserts through the policies, not around them.

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; at1 uuid; app uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text; ok boolean;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('app-683') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('app-683') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app683a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app683b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'app683a@beacon.test', 'admin', org),
      (u2, 'app683b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'app_683', 'Applications 683') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label)
    VALUES (sp, 'app_683', 'Applications 683') RETURNING id INTO ont;
    INSERT INTO public.action_types (ontology_id, api_name, label, project_id)
    VALUES (ont, 'app683-noop', 'Noop 683', proj) RETURNING id INTO at1;

    SET LOCAL ROLE authenticated;

    -- 1. The applier writes their own application — the insert 682 refused.
    INSERT INTO public.action_applications (action_type_id, applied_by_user_id, revertible)
    VALUES (at1, u1, true) RETURNING id INTO app;

    -- 2. Nobody writes an application in someone else's name.
    BEGIN
      INSERT INTO public.action_applications (action_type_id, applied_by_user_id, revertible)
      VALUES (at1, u2, true);
      RAISE EXCEPTION 'an application was written in another user''s name';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- 3. The applier marks their own reverted; nobody marks another's.
    UPDATE public.action_applications SET reverted_at = clock_timestamp() WHERE id = app;
    IF (SELECT ap.reverted_at FROM public.action_applications ap WHERE ap.id = app) IS NULL THEN
      RAISE EXCEPTION 'the applier could not mark their own application reverted';
    END IF;
    RESET ROLE;
    INSERT INTO public.action_applications (action_type_id, applied_by_user_id, revertible)
    VALUES (at1, u2, true) RETURNING id INTO app;
    SET LOCAL ROLE authenticated;
    UPDATE public.action_applications SET reverted_at = clock_timestamp() WHERE id = app;
    IF (SELECT ap.reverted_at FROM public.action_applications ap WHERE ap.id = app) IS NOT NULL THEN
      RAISE EXCEPTION 'a caller marked someone else''s application reverted';
    END IF;

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '683 proved, as authenticated: an applier writes and reverts their own application, and may neither write one in another name nor mark another''s reverted';
  END;
END $$;
