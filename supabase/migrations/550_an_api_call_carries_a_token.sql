-- The 46 SECURITY DEFINER functions anon can execute, closed on one principle.
--
-- 547 swept and found 54; 548 closed the eight that RETURN trigger, where no
-- judgement was needed. What remained needed a principle, and Foundry publishes
-- it in `api/v1/general-overview-authentication`: "To authenticate against the
-- API, you must include an API token, generally referred to as a bearer token,
-- in each API call." Each call. A caller with no token reaches nothing, and
-- `anon` is precisely the caller with no token.
--
-- The counterpart decision is who KEEPS access, and the same page settles that
-- too: "a granted scope evaluates only to a set of permissions, not an explicit
-- set of Foundry endpoints" — an authenticated call is gated by the permission
-- checks inside the service, not by an endpoint allowlist. So `authenticated`
-- and `service_role` keep exactly what they have today: captured per function
-- before the revoke, restated after, nothing widened. In particular the two
-- functions where `authenticated` was already revoked (simulated_dataset_markings,
-- search_index_payload) stay revoked.
--
-- The full reading, with the Slate public-applications exception and why it
-- does not apply here, is `readings/api-authentication.md`. The list is derived
-- from the catalog rather than spelled out, for the same reason 548's was: the
-- signature list is the thing that drifts.

BEGIN;

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
       AND p.prosecdef
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    -- Access that flowed through PUBLIC dies with it; restate what was real.
    IF r.had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF r.had_svc THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '550: closed % SECURITY DEFINER function(s) to anon', n;
END $do$;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; ok boolean;
BEGIN
  -- 547's WARN, promoted to the failure it always described.
  SELECT count(*) INTO n
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.prosecdef
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n > 0 THEN
    RAISE EXCEPTION '% SECURITY DEFINER function(s) in public are still executable by anon', n;
  END IF;

  -- The callers that are real kept their access, by name.
  IF NOT has_function_privilege('authenticated', 'public.evaluate_object_set(uuid,jsonb,jsonb,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost evaluate_object_set';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.save_object_set(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lost save_object_set';
  END IF;

  -- And the two that were already closed to authenticated were not widened by
  -- the restatement loop.
  IF has_function_privilege('authenticated', 'public.search_index_payload(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.simulated_dataset_markings(uuid,uuid,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'the restatement loop widened a function authenticated had lost';
  END IF;

  -- Executed as the roles in question, not inferred from the catalog: the
  -- tokenless caller is refused at the door, and the authenticated one is not.
  SET LOCAL ROLE anon;
  ok := false;
  BEGIN
    PERFORM public.default_ontology();
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  IF NOT ok THEN
    RAISE EXCEPTION 'anon called default_ontology() and was not refused';
  END IF;

  -- The authenticated caller gets PAST the door. The function may still refuse
  -- on its own terms — with no JWT it raises Ontology:NoOntology — and that is
  -- the function answering, not the boundary. Only insufficient_privilege fails.
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.default_ontology();
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'authenticated was refused at the door of default_ontology()';
    WHEN OTHERS THEN NULL;
  END;
  RESET ROLE;

  RAISE NOTICE '550: an api call carries a token';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
