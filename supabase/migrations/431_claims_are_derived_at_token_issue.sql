-- Claims derived at token issue, instead of fossilised at signup.
--
-- 430 fixed the value and kept the failure mode. `hotel_id` sat in
-- `raw_app_meta_data` for months, naming a row in a table that had been dropped,
-- because `app_metadata` is written once at signup and never revalidated.
-- Moving it to `org_id` made it correct today and no less able to rot tomorrow.
--
-- Supabase's custom access token hook is the supported way out. It "runs before
-- a token is issued and allows you to add additional claims", it is an ordinary
-- Postgres function, and it may read our own tables — so `org_id` and `role`
-- become a SELECT against `public.users` at every token issue rather than a
-- copy taken once.
--
-- ── WHY THIS SHAPE, FROM THE FOUNDRY SIDE ──────────────────────────────────
--   "Every user is a member of only one organization, but can be a guest member
--    of multiple organizations. To meet access requirements, users must be a
--    member or guest member of at least one organization applied to a Project."
--                                                 (security/orgs-and-spaces)
--
-- One `org_id`, singular, is therefore right and stays. Guest membership is
-- plural, is not modelled yet, and is deliberately NOT emitted here — an empty
-- array would be a shape invented ahead of the table that defines it.
--
-- ── IT MUST NEVER RAISE ────────────────────────────────────────────────────
-- This is an auth-time dependency on our own schema, which is exactly what
-- locked everyone out last week. The difference is not that it cannot fail; it
-- is that this one is written not to. Every failure path returns the event
-- unchanged, so the worst case is a token with the claims it would have had
-- anyway — a user with no organization scope, not a user who cannot log in.
--
-- ── ENABLING IT IS A SEPARATE, REVERSIBLE STEP ─────────────────────────────
-- The function is inert until the hook is switched on in project config, so
-- applying this migration cannot break sign-in. Until then the static claim in
-- `raw_app_meta_data` still answers; once on, the hook overrides it with the
-- derived value. Both agree today, which is what makes flipping it safe.
--
-- `raw_app_meta_data.org_id` is deliberately left in place. Stripping it while
-- the hook is off would remove the only source of scope there is.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  u      record;
BEGIN
  claims := coalesce(event->'claims', '{}'::jsonb);

  SELECT organization_id, role INTO u
    FROM public.users WHERE id = (event->>'user_id')::uuid;

  -- No row is not an error. A user who has not been given an organization gets
  -- a token without one and sees nothing, which is a readable state; a raise
  -- here would mean nobody can sign in at all.
  IF NOT FOUND THEN
    RETURN event;
  END IF;

  IF u.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, org_id}', to_jsonb(u.organization_id::text), true);
  END IF;
  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(u.role), true);

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  -- Whatever went wrong, a login is worth more than a claim. The token falls
  -- back to what signup put in app_metadata.
  RETURN event;
END $$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Derives org_id and role from public.users at every token issue, so a claim cannot go stale the way hotel_id did. Never raises: every failure path returns the event unchanged, because this runs on the sign-in path.';

-- Only GoTrue calls this. A caller who could invoke it directly could not do
-- anything with the result, but it reads a table across every organization, so
-- it is not one to leave executable by the world.
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; usr uuid := gen_random_uuid(); got jsonb; ev jsonb;
BEGIN
  SELECT id INTO org FROM public.organizations LIMIT 1;

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'hook431@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'hook431@beacon.test', 'admin', org);

  ev := jsonb_build_object(
    'user_id', usr::text,
    'claims', jsonb_build_object('sub', usr::text,
                                 'app_metadata', jsonb_build_object('provider','email')));

  -- 1. The claims come out derived, and the ones GoTrue set survive.
  got := public.custom_access_token_hook(ev);
  IF got->'claims'->'app_metadata'->>'org_id' <> org::text THEN
    RAISE EXCEPTION 'org_id was not derived: %', got->'claims'->'app_metadata';
  END IF;
  IF got->'claims'->'app_metadata'->>'role' <> 'admin' THEN
    RAISE EXCEPTION 'role was not derived';
  END IF;
  IF got->'claims'->'app_metadata'->>'provider' <> 'email' THEN
    RAISE EXCEPTION 'the hook dropped a claim GoTrue had set';
  END IF;
  IF got->'claims'->>'sub' <> usr::text THEN
    RAISE EXCEPTION 'the hook dropped a required claim';
  END IF;

  -- 2. It overrides a stale claim rather than deferring to it. This is the
  --    whole point: hotel_id rotted because nothing ever recomputed it.
  got := public.custom_access_token_hook(jsonb_set(ev, '{claims,app_metadata,org_id}',
           to_jsonb(gen_random_uuid()::text)));
  IF got->'claims'->'app_metadata'->>'org_id' <> org::text THEN
    RAISE EXCEPTION 'a stale org_id in the token won over the database';
  END IF;

  -- 3. A user with no row logs in anyway, with whatever claims they had.
  got := public.custom_access_token_hook(jsonb_build_object(
    'user_id', gen_random_uuid()::text,
    'claims', jsonb_build_object('sub','x')));
  IF got->'claims'->>'sub' <> 'x' THEN
    RAISE EXCEPTION 'an unknown user did not get their token back untouched';
  END IF;

  -- 4. Garbage in does not raise. Nothing on the sign-in path may.
  got := public.custom_access_token_hook('{"user_id":"not-a-uuid"}'::jsonb);
  IF got IS NULL THEN RAISE EXCEPTION 'the hook returned null instead of the event'; END IF;

  -- 5. Only GoTrue may call it.
  IF has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute the token hook';
  END IF;
  IF NOT has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'supabase_auth_admin cannot execute the token hook — enabling it would break sign-in';
  END IF;

  RAISE NOTICE '431: claims derive from public.users, override a stale token, and never raise';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
