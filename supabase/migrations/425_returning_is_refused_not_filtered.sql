-- What `insert … returning` actually does under RLS, corrected.
--
-- 424's header reasoned that PostgREST's `insert into spaces … returning id`
-- would come back as zero rows, the SELECT policy having filtered the row it
-- had just written. Probed as `authenticated`, that is not what happens:
--
--   INSERT INTO public.spaces (name) VALUES ('Probe') RETURNING id
--     → new row violates row-level security policy for table "spaces"
--   INSERT INTO public.spaces (name) VALUES ('Probe2')       -- no RETURNING
--     → succeeds
--
-- The same insert is refused with RETURNING and accepted without it. Postgres
-- folds the SELECT policy into the row's check rather than filtering the output,
-- so the failure is an error at write time, not a quiet empty result. Louder
-- than 424 predicted, and better: a refusal cannot be mistaken for success.
--
-- The `space_organizations` half is also not the NOT NULL violation 424 named.
-- Its WITH CHECK is `organization_id IS NOT DISTINCT FROM auth_org_id()`, and a
-- missing column is NULL, so the policy rejects it before the constraint sees
-- it — also an RLS error.
--
-- Applied migrations are immutable, so 424's prose stands as written and this
-- corrects the part that outlives it: the comment the generated client shows a
-- caller.

COMMENT ON FUNCTION public.create_space(text, text) IS
  'Create a space and attach the caller''s organization to it, in one call. Two separate writes cannot work: `insert into spaces … returning id` is REFUSED outright, because Postgres applies the SELECT policy to a RETURNING clause and that policy reads through space_organizations — a row that does not exist until the space does.';

DO $$
DECLARE org uuid; before text; refused boolean := false;
BEGIN
  before := current_setting('request.jwt.claims', true);
  INSERT INTO public.organizations (name) VALUES ('returning-425') RETURNING id INTO org;
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  -- The claim the corrected comment makes, held as an assertion so it stays true.
  BEGIN
    DECLARE got uuid;
    BEGIN
      INSERT INTO public.spaces (name) VALUES ('Refused') RETURNING id INTO got;
    END;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    refused := true;
  WHEN OTHERS THEN
    refused := true;
  END;

  IF NOT refused THEN
    RAISE EXCEPTION 'insert … returning into spaces was allowed — the reason create_space exists no longer holds';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '425: insert-with-returning into spaces is refused, as the comment now says';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
