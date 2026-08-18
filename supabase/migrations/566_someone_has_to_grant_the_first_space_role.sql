-- Portfolios cannot be created by anyone, and the reason is a deadlock.
--
-- ── THE DEADLOCK, MEASURED ──────────────────────────────────────────────────
-- Production holds ZERO organization_role_grants and ZERO space_role_grants, so
-- no principal holds any workflow. That is not a seeding oversight; it is
-- unreachable by construction:
--
--   * `portfolios.managers create portfolios` needs
--     `manage_portfolios_within_the_space`.
--   * `space_role_grants.space administrators grant roles` needs
--     `manage_space_permissions`, so granting the role that would confer the
--     first workflow itself needs a workflow.
--
-- Verified as `authenticated`, as the organization's own admin: creating a
-- portfolio is refused 42501, and granting a space role is refused 42501. 555
-- shipped a feature nobody could use, and 554 built the door it is locked
-- behind.
--
-- ── THE FIX IS THIS REPOSITORY'S OWN PRECEDENT ─────────────────────────────
-- `enforce_grant_ceiling` already solved the identical problem one scope down,
-- and says so in its body:
--
--     -- An org admin is the bootstrap: someone has to grant the first Owner.
--     IF mine IS NULL AND auth_role() IN ('owner', 'admin') THEN RETURN NEW;
--
-- Project roles bootstrap through the organization's admin. Space roles get the
-- same arm, and nothing wider: the caller must be an owner or admin of an
-- organization the space actually serves.
--
-- This is also how the product works. Space permissions live in Control Panel
-- — "From the Space permissions page in Control Panel, you can set the roles
-- users have in the space" — which is administered from outside the space, by
-- someone whose authority does not come from a role inside it.
--
-- ── WHY ONLY THE GRANT PATH ─────────────────────────────────────────────────
-- `portfolios` is deliberately NOT given a bootstrap arm. Once an administrator
-- can grant, they grant `space_administrator`, which subsumes the five
-- published workflows — including `manage_portfolios_within_the_space` — and
-- the feature works through the mechanism rather than around it. Adding an
-- admin arm to every workflow policy would make the workflows decorative.
--
-- `manage_space_permissions` stays carried by no role, per 563: no card names
-- the workflow that confers granting, and the bootstrap is what makes that
-- honest rather than fatal.

BEGIN;

DROP POLICY "space administrators grant roles" ON public.space_role_grants;
CREATE POLICY "space administrators grant roles" ON public.space_role_grants
  FOR ALL TO authenticated
  USING (
    public.has_space_workflow(space_id, 'manage_space_permissions')
    OR (
      (SELECT public.auth_role()) IN ('owner', 'admin')
      AND EXISTS (SELECT 1 FROM public.space_organizations so
                   WHERE so.space_id = space_role_grants.space_id
                     AND so.organization_id = (SELECT public.auth_org_id()))
    )
  )
  WITH CHECK (
    public.has_space_workflow(space_id, 'manage_space_permissions')
    OR (
      (SELECT public.auth_role()) IN ('owner', 'admin')
      AND EXISTS (SELECT 1 FROM public.space_organizations so
                   WHERE so.space_id = space_role_grants.space_id
                     AND so.organization_id = (SELECT public.auth_org_id()))
    )
  );

-- ── assertions, which execute the whole chain the deadlock blocked ──────────
DO $do$
DECLARE org uuid; sp uuid; usr uuid; other uuid; n int; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe566') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe566') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe566@beacon.test') RETURNING id INTO usr;

    -- 1. The administrator grants the first space role. This was refused before.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', usr::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public.space_role_grants (space_id, role_id, user_id)
      VALUES (sp, (SELECT id FROM public.space_roles
                    WHERE space_id IS NULL AND api_name = 'space_administrator'), usr);
    RESET ROLE;

    -- 2. Holding it, they now hold the published workflows by subsumption...
    SET LOCAL ROLE authenticated;
    IF NOT public.has_space_workflow(sp, 'manage_portfolios_within_the_space') THEN
      RESET ROLE;
      RAISE EXCEPTION 'a Space Administrator does not hold the portfolio workflow';
    END IF;

    -- 3. ...and the feature 555 shipped finally works.
    INSERT INTO public.portfolios (space_id, name) VALUES (sp, 'Bootstrapped');
    RESET ROLE;
    SELECT count(*) INTO n FROM public.portfolios WHERE space_id = sp;
    IF n <> 1 THEN RAISE EXCEPTION 'the portfolio was not created'; END IF;

    -- 4. And the arm is no wider than stated: an admin of ANOTHER organization
    --    cannot grant here, so the bootstrap is not a skeleton key.
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe566b@beacon.test') RETURNING id INTO other;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', other::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', gen_random_uuid()))::text, true);
    SET LOCAL ROLE authenticated;
    ok := false;
    BEGIN
      INSERT INTO public.space_role_grants (space_id, role_id, user_id)
        VALUES (sp, (SELECT id FROM public.space_roles
                      WHERE space_id IS NULL AND api_name = 'space_administrator'), other);
    EXCEPTION WHEN insufficient_privilege THEN ok := true;
    END;
    RESET ROLE;
    IF NOT ok THEN
      RAISE EXCEPTION 'an administrator of an unrelated organization granted a role on this space';
    END IF;

    RAISE EXCEPTION 'probe566:done';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF sqlerrm <> 'probe566:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe566';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '566: someone has to grant the first space role';
END $do$;

COMMIT;
