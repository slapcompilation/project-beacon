-- 678: the rest of the User wire shape — username, the two names, status,
-- and the attributes map 656 said our one conditions attribute foreshadowed.
--
--   "The Foundry username of the User. This is unique within the realm."
--   — api/admin-v2-resources-users-get-user.md
--
--   "The given name of the User."
--   — api/admin-v2-resources-users-get-user.md
--
--   "The family name (last name) of the User."
--   — api/admin-v2-resources-users-get-user.md
--
--   "The current status of the user."
--   — api/admin-v2-resources-users-get-user.md
--
--   "A map of the User's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change. Additional attributes may be configured by Foundry administrators in Control Panel and populated by the User's SSO provider upon login."
--   — api/admin-v2-resources-users-get-user.md
--
-- DELETION IS SOFT. The troubleshooting section walks an administrator
-- through undeleting an account, which only works if the row survived:
--
--   "If a login fails with the error `Your account has been disabled`, it means the user account has been deleted. You can reach out to an administrator to find and "undelete" the account using the `getDeletedUsers` and `undeleteExternalUser` endpoints, respectively."
--   — platform-security-management/manage-users.md
--
-- so status is an UPDATE, never a DELETE, and every path that grants a
-- deleted user anything refuses by the published error name, UserDeleted.
--
-- Inactivity is NOT a third status — 30 days without a login invalidates
-- tokens while "Inactive accounts behave in the same way as active accounts
-- in Foundry", and login reactivates automatically. Token-layer, and
-- Supabase owns sessions here; recorded, not built (readings/users-wire-
-- shape.md, Decision 5).
--
-- The username backfill is the email rather than an invention: our internal
-- realm authenticates by email, and preregistration requires the created
-- username to match the login username exactly (same page).

ALTER TABLE public.users ADD COLUMN username text;
UPDATE public.users SET username = email WHERE username IS NULL;
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_username_not_blank
  CHECK (length(btrim(username)) > 0);
-- "unique within the realm" — the scope is the realm, not the platform.
CREATE UNIQUE INDEX users_realm_username_key ON public.users (realm, username);
COMMENT ON COLUMN public.users.username IS
  'The Foundry username, "unique within the realm" (api/admin-v2-resources-users-get-user). Backfilled from the email: the internal realm authenticates by email and preregistration requires the created username to match the login username exactly.';

ALTER TABLE public.users ADD COLUMN given_name text;
ALTER TABLE public.users ADD COLUMN family_name text;
COMMENT ON COLUMN public.users.given_name IS
  'The given name of the User (api/admin-v2-resources-users-get-user). Optional on the wire, optional here.';
COMMENT ON COLUMN public.users.family_name IS
  'The family name (last name) of the User (api/admin-v2-resources-users-get-user). Optional on the wire, optional here.';

ALTER TABLE public.users ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
  CONSTRAINT users_status_check CHECK (status = ANY (ARRAY['ACTIVE', 'DELETED']));
COMMENT ON CONSTRAINT users_status_check ON public.users IS
  'Values from api/admin-v2-resources-users-get-user, whose status enum publishes exactly ACTIVE and DELETED. Wire vocabulary verbatim (the 656 rule). Inactivity is not a third value: an inactive account behaves like an active one and only its tokens are invalid.';
COMMENT ON COLUMN public.users.status IS
  'ACTIVE or DELETED. Deletion is soft — the documented undelete depends on the row surviving — so nothing DELETEs a user row to remove them.';

-- ── the attributes map, as rows ─────────────────────────────────────────────
-- AttributeName -> AttributeValues (a LIST), so one row per name with a
-- text[] of values. The reserved prefix is enforced rather than documented.

CREATE TABLE public.user_attributes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name    text NOT NULL CHECK (length(btrim(name)) > 0),
  values  text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, name)
);
COMMENT ON TABLE public.user_attributes IS
  'The User attributes map (api/admin-v2-resources-users-get-user): one row per AttributeName holding its AttributeValues list. The capture renders them as name-over-values pairs, a reserved multipass: name beside a custom one (platform-security-management/images/manage-users.png).';

ALTER TABLE public.user_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see attributes of visible users" ON public.user_attributes
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id));
CREATE POLICY "admins author attributes" ON public.user_attributes
  FOR ALL USING ((SELECT public.auth_role()) IN ('owner','admin'))
          WITH CHECK ((SELECT public.auth_role()) IN ('owner','admin'));

-- "Attributes prefixed with "multipass:" are reserved for internal use by
-- Foundry" — reserved means the platform writes them, an administrator does
-- not. beacon.platform_attributes is the platform's own window.
CREATE FUNCTION public.guard_reserved_attribute()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name LIKE 'multipass:%'
     AND coalesce(current_setting('beacon.platform_attributes', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Users:ReservedAttribute — attributes prefixed with "multipass:" are reserved for internal use by Foundry';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reserved_attribute
  BEFORE INSERT OR UPDATE ON public.user_attributes
  FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_attribute();

-- The capture shows multipass:realm-name carrying the provider's display
-- name, so the platform stamps it and keeps it true.
CREATE FUNCTION public.stamp_realm_name_attribute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_name text;
BEGIN
  SELECT p.name INTO v_name FROM public.authentication_providers p WHERE p.id = NEW.realm;
  IF v_name IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('beacon.platform_attributes', 'on', true);
  INSERT INTO public.user_attributes (user_id, name, values)
  VALUES (NEW.id, 'multipass:realm-name', ARRAY[v_name])
  ON CONFLICT (user_id, name) DO UPDATE SET values = EXCLUDED.values;
  PERFORM set_config('beacon.platform_attributes', '', true);
  RETURN NEW;
END $$;
CREATE TRIGGER stamp_realm_name_attribute AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.stamp_realm_name_attribute();

-- Backfill what the trigger would have stamped.
DO $$
BEGIN
  PERFORM set_config('beacon.platform_attributes', 'on', true);
  INSERT INTO public.user_attributes (user_id, name, values)
  SELECT u.id, 'multipass:realm-name', ARRAY[p.name]
    FROM public.users u JOIN public.authentication_providers p ON p.id = u.realm
  ON CONFLICT (user_id, name) DO NOTHING;
  PERFORM set_config('beacon.platform_attributes', '', true);
END $$;

-- ── login_attribute reads the store, keeping its email fallback ─────────────
-- The conditions engine calls this for every rule at login; the email arm
-- stays exactly as it was, so a rule written against it answers the same.

CREATE OR REPLACE FUNCTION public.login_attribute(p_user uuid, p_attribute text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  -- the stored attributes first (first value of the list), then the columns
  -- the directory has always answered; an unknown name resolves NULL and
  -- matches nothing, fail-closed
  SELECT coalesce(
    (SELECT a.values[1] FROM public.user_attributes a
      WHERE a.user_id = p_user AND a.name = p_attribute),
    CASE p_attribute
      WHEN 'email' THEN (SELECT u.email FROM public.users u WHERE u.id = p_user)
      WHEN 'username' THEN (SELECT u.username FROM public.users u WHERE u.id = p_user)
      WHEN 'givenName' THEN (SELECT u.given_name FROM public.users u WHERE u.id = p_user)
      WHEN 'familyName' THEN (SELECT u.family_name FROM public.users u WHERE u.id = p_user)
      ELSE NULL END)
$$;
COMMENT ON FUNCTION public.login_attribute(uuid, text) IS
  'Resolves one attribute of a user for the group-assignment conditions engine: the stored user_attributes map first, then the wire shape''s own fields. An unknown name resolves NULL and matches nothing, fail-closed.';

-- ── a deleted user is granted nothing ───────────────────────────────────────
-- "The user is deleted." is the one name every per-user endpoint refuses
-- with, so every grant path here refuses with it too.

CREATE FUNCTION public.guard_grant_to_deleted_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_user uuid;
BEGIN
  -- one expression may not name a column the other table lacks, so the row
  -- is read as json and the principal picked by name
  v_user := coalesce(to_jsonb(NEW) ->> 'member_user_id', to_jsonb(NEW) ->> 'user_id')::uuid;
  IF v_user IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND u.status = 'DELETED') THEN
    RAISE EXCEPTION 'Users:UserDeleted — the user is deleted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_grant_to_deleted_user
  BEFORE INSERT OR UPDATE ON public.project_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.guard_grant_to_deleted_user();
CREATE TRIGGER guard_grant_to_deleted_user
  BEFORE INSERT OR UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_grant_to_deleted_user();
CREATE TRIGGER guard_grant_to_deleted_user
  BEFORE INSERT OR UPDATE ON public.marking_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_grant_to_deleted_user();

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; pr uuid; grp uuid; cat uuid; mk uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text; v text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('users-678') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('users-678') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'users678a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'users678b@beacon.test');
    INSERT INTO public.users (id, email, username, given_name, family_name, role, organization_id)
    VALUES (u1, 'users678a@beacon.test', 'lsegura', 'Linda', 'Segura', 'admin', org);
    INSERT INTO public.users (id, email, username, role, organization_id)
    VALUES (u2, 'users678b@beacon.test', 'users678b@beacon.test', 'admin', org);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    -- 1. Every existing row got a username, and it is unique within the realm.
    SELECT count(*) INTO n FROM public.users WHERE username IS NULL;
    IF n <> 0 THEN RAISE EXCEPTION 'the backfill left % users without a username', n; END IF;
    BEGIN
      INSERT INTO public.users (id, email, username, role, organization_id)
      VALUES (gen_random_uuid(), 'dup678@beacon.test', 'lsegura', 'admin', org);
      RAISE EXCEPTION 'a duplicate username within one realm was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- 2. status defaults ACTIVE and admits only the two published tokens.
    SELECT u.status INTO v FROM public.users u WHERE u.id = u1;
    IF v <> 'ACTIVE' THEN RAISE EXCEPTION 'status should default ACTIVE, got %', v; END IF;
    BEGIN
      UPDATE public.users SET status = 'INACTIVE' WHERE id = u1;
      RAISE EXCEPTION 'a third status value was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 3. The platform stamped the reserved realm-name attribute, and an
    --    administrator cannot write one itself.
    SELECT a.values[1] INTO v FROM public.user_attributes a
     WHERE a.user_id = u1 AND a.name = 'multipass:realm-name';
    IF v IS NULL THEN RAISE EXCEPTION 'the realm-name attribute was not stamped'; END IF;
    BEGIN
      INSERT INTO public.user_attributes (user_id, name, values)
      VALUES (u1, 'multipass:invented', ARRAY['x']);
      RAISE EXCEPTION 'a reserved attribute name was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Users:ReservedAttribute%' THEN RAISE; END IF;
    END;

    -- 4. login_attribute reads the store, and the email arm is unchanged.
    IF public.login_attribute(u1, 'email') IS DISTINCT FROM 'users678a@beacon.test' THEN
      RAISE EXCEPTION 'the email attribute stopped answering as it did';
    END IF;
    IF public.login_attribute(u1, 'givenName') IS DISTINCT FROM 'Linda' THEN
      RAISE EXCEPTION 'givenName should answer from the column';
    END IF;
    IF public.login_attribute(u1, 'unknown-name') IS NOT NULL THEN
      RAISE EXCEPTION 'an unknown attribute should resolve NULL, fail-closed';
    END IF;
    INSERT INTO public.user_attributes (user_id, name, values)
    VALUES (u1, 'location:country', ARRAY['Germany', 'Austria']);
    IF public.login_attribute(u1, 'location:country') IS DISTINCT FROM 'Germany' THEN
      RAISE EXCEPTION 'a stored attribute should answer with its first value';
    END IF;
    -- The store wins over a column of the same name, which is how an SSO
    -- provider's value overrides the directory's.
    INSERT INTO public.user_attributes (user_id, name, values)
    VALUES (u1, 'email', ARRAY['sso@beacon.test']);
    IF public.login_attribute(u1, 'email') IS DISTINCT FROM 'sso@beacon.test' THEN
      RAISE EXCEPTION 'the stored attribute should take precedence';
    END IF;
    DELETE FROM public.user_attributes WHERE user_id = u1 AND name = 'email';

    -- 5. A deleted user is granted nothing, by the published name.
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'users_678', 'Users 678') RETURNING id INTO pr;
    INSERT INTO public.groups (organization_id, name, created_by) VALUES (org, 'Users 678', u1)
    RETURNING id INTO grp;
    INSERT INTO public.marking_categories (name, category_type, organization_id)
    VALUES ('USERS-678', 'conjunctive', org) RETURNING id INTO cat;
    INSERT INTO public.markings (category_id, name) VALUES (cat, 'USERS 678 SECRET') RETURNING id INTO mk;

    UPDATE public.users SET status = 'DELETED' WHERE id = u2;
    BEGIN
      INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (pr, u2, 'viewer', org);
      RAISE EXCEPTION 'a deleted user was granted a project role';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Users:UserDeleted%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u2);
      RAISE EXCEPTION 'a deleted user was added to a group';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Users:UserDeleted%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, u2);
      RAISE EXCEPTION 'a deleted user was granted a marking';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Users:UserDeleted%' THEN RAISE; END IF;
    END;

    -- 6. Undelete is the same UPDATE, and the row was there to undelete.
    UPDATE public.users SET status = 'ACTIVE' WHERE id = u2;
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, u2);
    SELECT count(*) INTO n FROM public.group_members WHERE group_id = grp AND member_user_id = u2;
    IF n <> 1 THEN RAISE EXCEPTION 'an undeleted user should be grantable again'; END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '678 proved: every user carries a username unique within its realm, status defaults ACTIVE and admits only the two published tokens, the reserved multipass: prefix is refused to administrators while the platform stamps realm-name, login_attribute answers from the store then the columns with email unchanged and unknown names NULL, all three grant paths refuse a deleted user by the published name, and undelete restores grantability';
  END;
END $$;
