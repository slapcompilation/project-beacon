-- Undoing an over-grant in 430.
--
-- 430 set `org_id` on every account that lacked one:
--
--   UPDATE auth.users SET raw_app_meta_data = … || jsonb_build_object('org_id', org)
--    WHERE raw_app_meta_data ? 'hotel_id'
--       OR NOT (coalesce(raw_app_meta_data,'{}'::jsonb) ? 'org_id');
--
-- The first arm was the fix. The second arm was too wide: it also caught two
-- accounts that had never had an organization claim and have no `public.users`
-- row at all — one a real person who has never signed in, one debris from
-- migration 419's assertions. Both came out of it holding a claim to an
-- organization they are not recorded in.
--
-- Nothing was exposed: neither has ever signed in, and neither carries a `role`,
-- so `auth_role()` gives them `limited_access` and the policies that matter
-- demand owner or admin. But a claim is the whole of our access control, and
-- handing one out as a side effect of a repair is not a thing to leave standing.
--
-- Found by the audit written for 431, one commit later, which is the argument
-- for writing the audit at all: 430 asserted its own postcondition ("every
-- account has an org_id") and that assertion is exactly what was wrong.
--
-- ── THE INVARIANT, STATED PROPERLY ─────────────────────────────────────────
-- Not "every account has an organization" — an account that has never been
-- onboarded legitimately has none. It is:
--
--   a claim to an organization ⟺ a `public.users` row in that organization
--
-- 431's token hook enforces this going forward by construction: it derives the
-- claim from `public.users`, so an account with no row cannot get one. This
-- migration brings the existing rows up to what the hook would already produce.

UPDATE auth.users a
   SET raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb) - 'org_id' - 'role'
 WHERE coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'org_id'
   AND NOT EXISTS (
     SELECT 1 FROM public.users p
      WHERE p.id = a.id AND p.organization_id IS NOT NULL);

-- Migration 419 cleaned up after itself by hand — explicit DELETEs for branches,
-- ontologies and spaces — and missed the `auth.users` rows it had created.
-- Every migration since rolls back by raising instead, which cannot miss
-- anything; `ws426`–`ws431` left nothing behind. The row itself is left alone:
-- deleting an account is not something a schema migration should decide.
COMMENT ON TABLE public.users IS
  'Application users. An account with no row here has not been onboarded and gets no organization claim — the token hook derives the claim from this table, so the two cannot disagree.';

-- ── and a bug in 431's hook, found by the assertion below ──────────────────
-- `jsonb_set(claims, '{app_metadata, org_id}', …)` can create the LAST key of a
-- path but not an intermediate one. Given claims with no `app_metadata` object
-- it returns them unchanged — silently, no error. GoTrue does normally send an
-- app_metadata, so this would most likely never have fired in production; on
-- the sign-in path "most likely" is not a standard. The object is now ensured
-- before anything is set into it.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  claims jsonb;
  u      record;
BEGIN
  claims := coalesce(event->'claims', '{}'::jsonb);
  -- jsonb_set will not build this for us.
  IF jsonb_typeof(claims->'app_metadata') IS DISTINCT FROM 'object' THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
  END IF;

  SELECT organization_id, role INTO u
    FROM public.users WHERE id = (event->>'user_id')::uuid;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  IF u.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, org_id}', to_jsonb(u.organization_id::text), true);
  END IF;
  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(u.role), true);

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END $fn$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Derives org_id and role from public.users at every token issue, so a claim cannot go stale the way hotel_id did. Builds app_metadata if the incoming claims lack it — jsonb_set creates only the last key of a path. Never raises: every failure path returns the event unchanged, because this runs on the sign-in path.';

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

DO $$
DECLARE bad text; got jsonb;
BEGIN
  -- The bug, as its smallest case: claims with no app_metadata at all.
  got := public.custom_access_token_hook(jsonb_build_object(
    'user_id', (SELECT id::text FROM public.users WHERE organization_id IS NOT NULL LIMIT 1),
    'claims', '{}'::jsonb));
  IF got->'claims'->'app_metadata'->>'org_id' IS NULL THEN
    RAISE EXCEPTION 'claims arriving without app_metadata still come back without an org_id';
  END IF;
  SELECT string_agg(a.email, ', ') INTO bad
    FROM auth.users a
   WHERE coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'org_id'
     AND NOT EXISTS (SELECT 1 FROM public.users p
                      WHERE p.id = a.id AND p.organization_id IS NOT NULL);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'still claiming an organization with no record in it: %', bad;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'an onboarded user has no organization';
  END IF;

  -- The account that can still sign in must still come out scoped, or this
  -- repair has broken the thing 430 was repairing.
  IF (SELECT public.custom_access_token_hook(
        jsonb_build_object('user_id', a.id::text, 'claims', '{}'::jsonb))
        -> 'claims' -> 'app_metadata' ->> 'org_id'
        FROM auth.users a WHERE a.email = 'pansampanidis@gmail.com') IS NULL THEN
    RAISE EXCEPTION 'the signed-in account no longer derives an organization';
  END IF;

  RAISE NOTICE '432: a claim to an organization now requires a record in it';
END $$;
