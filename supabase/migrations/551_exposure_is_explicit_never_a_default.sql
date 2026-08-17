-- Two mechanisms mint anonymous reach on every migration, and nobody ever
-- wrote either grant: CREATE FUNCTION hands EXECUTE to PUBLIC, and Supabase's
-- default ACL stamps EXECUTE to anon onto every new function postgres creates
-- in public. 528 reopening the indexer was these, not carelessness — 547's
-- restate-the-revoke habit treats the symptom, this removes the minting.
--
-- Foundry's shape for the boundary is in `slate/applications-create`: the one
-- unauthenticated surface it has cannot arrive by accident — "public
-- applications cannot be automatically published and the version intended for
-- publication needs to be confirmed every time to prevent accidental
-- publication". Exposure is an explicit act. A grant that appears because a
-- function was created is the opposite of that.
--
-- Two statements, and the split is load-bearing, verified live in a rolled-back
-- transaction first: a per-schema default-privileges entry ADDS to the built-in
-- defaults and cannot remove them, so revoking PUBLIC needs the GLOBAL form,
-- while the anon stamp is Supabase's per-schema entry and is removed there.
--
-- The same loop then closes the invoker functions anon can already execute —
-- same principle as 550 ("you must include an API token, generally referred to
-- as a bearer token, in each API call", `api/v1/general-overview-authentication`),
-- same capture-and-restate for authenticated and service_role. Extension-owned
-- functions are left alone: pgvector's operators are type machinery, not
-- endpoints, and their ACLs belong to the extension. The anon DML the same
-- default ACL stamps onto new TABLES is recorded in
-- `readings/api-authentication.md` as its own pass, not smuggled in here.

BEGIN;

-- New functions are born unexposed. The global form strips the built-in PUBLIC
-- grant; the per-schema form strips Supabase's anon stamp. authenticated and
-- service_role keep their default — the platform's callers are those two.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- And the stock that already exists: every invoker function we own that anon
-- can execute, closed the same way 550 closed the definer ones.
DO $do$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS had_auth,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS had_svc
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND NOT p.prosecdef
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND pg_has_role(current_user, p.proowner, 'USAGE')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.classid = 'pg_proc'::regclass
                          AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF r.had_svc THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '551: closed % invoker function(s) to anon', n;
END $do$;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; ok boolean;
BEGIN
  -- The minting is over: a function created NOW is born unreachable by anon.
  -- This executes the defaults path rather than reading pg_default_acl back,
  -- because the per-schema/global split above is exactly the kind of fact a
  -- catalog read gets wrong.
  CREATE FUNCTION public.probe_551() RETURNS int LANGUAGE sql AS 'SELECT 1';
  IF has_function_privilege('anon', 'public.probe_551()', 'EXECUTE') THEN
    RAISE EXCEPTION 'a fresh function is still born executable by anon';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.probe_551()', 'EXECUTE') THEN
    RAISE EXCEPTION 'a fresh function lost authenticated, which was not the deal';
  END IF;
  DROP FUNCTION public.probe_551();

  -- The stock is closed: nothing we own in public is executable by anon,
  -- SECURITY DEFINER or not.
  SELECT count(*) INTO n
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND pg_has_role(current_user, p.proowner, 'USAGE')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.classid = 'pg_proc'::regclass
                        AND d.objid = p.oid AND d.deptype = 'e');
  IF n > 0 THEN
    RAISE EXCEPTION '% function(s) we own are still executable by anon', n;
  END IF;

  -- Executed as the roles in question: the tokenless caller is refused, the
  -- authenticated one is not.
  SET LOCAL ROLE anon;
  ok := false;
  BEGIN
    PERFORM public.property_base_types();
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  IF NOT ok THEN
    RAISE EXCEPTION 'anon called property_base_types() and was not refused';
  END IF;

  -- Past the door; a domain error of the function's own is not a refusal.
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.property_base_types();
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'authenticated was refused at the door of property_base_types()';
    WHEN OTHERS THEN NULL;
  END;
  RESET ROLE;

  RAISE NOTICE '551: exposure is explicit, never a default';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
