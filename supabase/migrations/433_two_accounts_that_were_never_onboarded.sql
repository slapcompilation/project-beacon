-- Removing two accounts, on the operator's instruction.
--
--   419b@beacon.test      debris. Migration 419 cleaned up after itself with
--                         explicit DELETEs and missed the auth.users rows it
--                         had created. Every migration since rolls back by
--                         raising instead, which cannot miss anything.
--   paulossaba@gmail.com  a real person with no application record. To be
--                         added back properly later, with a role.
--
-- Both had their over-granted claim stripped in 432; this removes the rows.
--
-- Deliberately not a blanket "delete accounts with no public.users row". That
-- rule would delete an account in the window between signing up and being
-- onboarded, which is a legitimate state and the exact thing paulossaba was in.
-- The two are named, and the guard below refuses if either has become something
-- other than what was described above.

DO $$
DECLARE
  targets text[] := ARRAY['419b@beacon.test', 'paulossaba@gmail.com'];
  wrong   text;
  n       integer;
BEGIN
  -- Refuse if either has been onboarded or has ever signed in since 432. The
  -- instruction was about two accounts in a known state, not about these
  -- addresses whatever they turn out to hold.
  SELECT string_agg(a.email, ', ') INTO wrong
    FROM auth.users a
   WHERE a.email = ANY (targets)
     AND (a.last_sign_in_at IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.users p WHERE p.id = a.id));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'OntologyMetadata:AccountNoLongerOrphan — % has been onboarded or signed in since this was written', wrong
      USING HINT = 'Re-check why before deleting anything.';
  END IF;

  DELETE FROM auth.users WHERE email = ANY (targets);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '433: removed % account(s)', n;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = ANY (targets)) THEN
    RAISE EXCEPTION 'an account survived its own deletion';
  END IF;

  -- The two that remain are the signed-in operator and the CI smoke user, and
  -- both must still be whole: a record, an organization, and a derivable claim.
  SELECT count(*) INTO n FROM auth.users;
  IF n <> (SELECT count(*) FROM public.users) THEN
    RAISE EXCEPTION 'auth.users and public.users no longer agree: % vs %',
      n, (SELECT count(*) FROM public.users);
  END IF;

  SELECT string_agg(p.email, ', ') INTO wrong
    FROM public.users p
   WHERE public.custom_access_token_hook(
           jsonb_build_object('user_id', p.id::text, 'claims', '{}'::jsonb))
           -> 'claims' -> 'app_metadata' ->> 'org_id' IS NULL;
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'no organization derives for %', wrong;
  END IF;
END $$;
