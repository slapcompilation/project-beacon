-- 679: a username is stamped the way a realm is.
--
-- 678 added users.username NOT NULL and backfilled it from the email, but
-- left every INSERT to supply one. Nothing in the platform does: users are
-- provisioned from auth, which knows an email. Every platform suite that
-- creates a user broke on the not-null.
--
-- The fix is 656's own pattern rather than a weaker column — realm is
-- stamped BEFORE INSERT and username now is too, by exactly the rule 678's
-- backfill used:
--
--   "The created username needs to match the user’s login username exactly for the preregistered actions to work."
--   — platform-security-management/manage-users.md
--
-- Our internal realm's login username IS the email, so email is the stamp,
-- and an explicitly supplied username still wins — an external realm brings
-- its own, and preregistration types one in.

CREATE FUNCTION public.stamp_username()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    NEW.username := NEW.email;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.stamp_username() IS
  'Fills username from the email when an insert omits it (678/679). The internal realm authenticates by email and preregistration requires the created username to match the login username exactly, so the email is the faithful default; a supplied username always wins.';

CREATE TRIGGER stamp_username BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.stamp_username();

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); v text;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('username-679') RETURNING id INTO org;
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'un679a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'un679b@beacon.test');

    -- 1. An insert that names no username gets the email, as 678 backfilled.
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'un679a@beacon.test', 'admin', org);
    SELECT u.username INTO v FROM public.users u WHERE u.id = u1;
    IF v IS DISTINCT FROM 'un679a@beacon.test' THEN
      RAISE EXCEPTION 'the username should be stamped from the email, got %', v;
    END IF;

    -- 2. A supplied username wins — an external realm brings its own.
    INSERT INTO public.users (id, email, username, role, organization_id)
    VALUES (u2, 'un679b@beacon.test', 'lsegura679', 'admin', org);
    SELECT u.username INTO v FROM public.users u WHERE u.id = u2;
    IF v IS DISTINCT FROM 'lsegura679' THEN
      RAISE EXCEPTION 'a supplied username should survive the stamp, got %', v;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '679 proved: an omitted username is stamped from the email and a supplied one survives';
  END;
END $$;
