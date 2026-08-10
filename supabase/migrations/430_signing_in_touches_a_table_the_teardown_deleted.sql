-- Sign-in has been broken since the teardown, and nothing noticed.
--
--   Database error granting user
--
-- GoTrue reports that when the token grant fails. The grant updates
-- `auth.users` (last_sign_in_at), and `auth.users` still carried a trigger from
-- the hospitality product:
--
--   CREATE TRIGGER on_auth_user_change AFTER INSERT OR UPDATE ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_auth_user_change()
--
-- whose body is `INSERT INTO profiles (id, hotel_id, email, role) …`. `profiles`
-- was deleted with the rest of the hospitality schema. Reproduced exactly:
--
--   UPDATE auth.users SET last_sign_in_at = now() WHERE email = …
--   → 42P01 relation "profiles" does not exist
--
-- It only fires for users whose `app_metadata` carries a `hotel_id`, which is
-- why the teardown's own migrations never hit it — they create users without
-- one. Every real account has one, so every real account was locked out.
--
-- **What this says about the teardown.** Dropping the tables did not drop what
-- pointed at them, because the pointer lived on `auth.users` — a table outside
-- `public` that no audit of ours reads. A trigger is not a foreign key; nothing
-- cascades.

DROP TRIGGER IF EXISTS on_auth_user_change ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_change();

-- ── the claims the trigger was maintaining ─────────────────────────────────
-- `auth_org_id()` reads `app_metadata.org_id` and nothing else:
--
--   SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
--
-- No account has one. They carry `hotel_id`, which names a row in a table that
-- no longer exists. So fixing the trigger alone gets you through the door into
-- an application where every RLS policy returns nothing — the same failure one
-- step later, and harder to read.
--
-- `public.users.organization_id` is NULL for the same reason and is what the
-- FKs actually point at, so both halves are set from the one organization that
-- exists. If there were several this would have to be a question rather than a
-- migration; there is one.
DO $$
DECLARE org uuid; n int;
BEGIN
  SELECT count(*) INTO n FROM public.organizations;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Ontology:AmbiguousOrganization — % organizations exist, so which one each account belongs to is not derivable', n
      USING HINT = 'Set app_metadata.org_id per account instead of running this block.';
  END IF;
  SELECT id INTO org FROM public.organizations;

  UPDATE auth.users
     SET raw_app_meta_data =
           (coalesce(raw_app_meta_data, '{}'::jsonb) - 'hotel_id')
           || jsonb_build_object('org_id', org::text)
   WHERE raw_app_meta_data ? 'hotel_id'
      OR NOT (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'org_id');

  UPDATE public.users SET organization_id = org WHERE organization_id IS NULL;

  RAISE NOTICE '430: accounts moved from hotel_id to org_id on %', org;
END $$;

-- ── the trigger is gone, and a sign-in works ───────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;
  IF n <> 0 THEN
    RAISE EXCEPTION 'auth.users still carries % non-internal trigger(s)', n;
  END IF;

  -- The write the token grant makes. This is the whole bug, as one statement.
  UPDATE auth.users SET last_sign_in_at = now()
   WHERE email = 'pansampanidis@gmail.com';

  IF EXISTS (SELECT 1 FROM auth.users WHERE raw_app_meta_data ? 'hotel_id') THEN
    RAISE EXCEPTION 'an account still carries hotel_id, which names a deleted table';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'an account still has no organization, so every policy would return nothing';
  END IF;

  RAISE NOTICE '430: a sign-in touch of auth.users succeeds';
END $$;
