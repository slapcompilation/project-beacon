-- The rules-editor surface's missing write path: 654 gave
-- authentication_providers a SELECT policy and no UPDATE, so nothing could
-- enable organization assignment or set the default through the API — the
-- knobs existed with no writer. Administrators get exactly the two columns
-- the Platform-experience-style dialogs need; the identity columns (name,
-- kind, realm) stay unwritable by column privilege, because a realm is a
-- wire identifier (656), not a setting.

REVOKE UPDATE ON public.authentication_providers FROM authenticated;
GRANT UPDATE (org_assignment_enabled, default_organization_id)
  ON public.authentication_providers TO authenticated;

CREATE POLICY "admins turn the org assignment knobs" ON public.authentication_providers
  FOR UPDATE USING ((SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));

-- Proved as the real role: an admin turns the knob, a member cannot, and
-- even the admin cannot rename the realm.
DO $$
DECLARE v_org uuid; v_usr uuid; v_email text; v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe657') RETURNING id INTO v_org;
    v_usr := gen_random_uuid();
    v_email := 'probe657-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    SET LOCAL ROLE authenticated;
    UPDATE public.authentication_providers
       SET org_assignment_enabled = true, default_organization_id = v_org
     WHERE kind = 'internal';
    IF NOT EXISTS (SELECT 1 FROM public.authentication_providers
                    WHERE kind = 'internal' AND org_assignment_enabled) THEN
      RAISE EXCEPTION 'the admin''s knob turn did not land';
    END IF;

    v_ok := false;
    BEGIN
      UPDATE public.authentication_providers SET realm = 'someone-elses-realm'
       WHERE kind = 'internal';
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'the realm identifier was writable'; END IF;
    RESET ROLE;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'member', 'org_id', v_org))::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.authentication_providers SET org_assignment_enabled = false
     WHERE kind = 'internal';
    RESET ROLE;
    -- checked as owner: the member also cannot SEE the row, so the check
    -- itself must not run behind the member's own SELECT policy
    IF NOT EXISTS (SELECT 1 FROM public.authentication_providers
                    WHERE kind = 'internal' AND org_assignment_enabled) THEN
      RAISE EXCEPTION 'a member turned the knob';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '657 proved: the admin turns the two knobs, the member''s update touches nothing, and the realm identifier stays unwritable';
  END;
END $$;
