-- A guarantee that rests on the absence of a policy is one deletion away from
-- gone. 423 said exactly that and mandated the belt-and-braces; 533 claimed the
-- guarantee and did not apply it.
--
-- 533's header says the refusal is "verified as authenticated". No assertion in
-- it sets the role, and none attempts the write it claims RLS refuses — the
-- weekly adversary found that, and it is right.
--
-- What is actually true of `object_type_indexes` today:
--
--   RLS is enabled, and there is exactly ONE policy — a SELECT policy, "read
--   index status of visible object types". No INSERT, UPDATE or DELETE policy
--   exists, so RLS denies those by default. The refusal is real.
--
--   But the TABLE GRANTS are INSERT, UPDATE, DELETE and SELECT to BOTH
--   `authenticated` AND `anon`.
--
-- So the only thing standing between an unauthenticated caller and this ledger
-- is that nobody has written a write policy yet. Add one — or disable RLS on
-- this table for any reason — and the ledger is open, with no error anywhere to
-- say so.
--
-- The ledger is written by the indexer, which is SECURITY DEFINER and therefore
-- runs as the owner. It does not need, and has never needed, a grant on any
-- caller's role. Taking the grants away costs nothing and removes the coupling.
--
-- Doing it for `anon` as well is not theatre: 547 found `index_object_type`
-- itself had been callable by `anon` for eighteen migrations, and 548 closed 73
-- trigger functions in the same state. This table is the thing that bug reached.

BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.object_type_indexes FROM authenticated, anon;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; t uuid; ok boolean;
BEGIN
  -- The grants are gone, from the catalog's own answer.
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'object_type_indexes'
     AND grantee IN ('authenticated', 'anon')
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF n <> 0 THEN
    RAISE EXCEPTION '% write grant(s) remain on the index ledger', n;
  END IF;

  -- SELECT survives, because the read policy is the point of the table.
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'object_type_indexes'
     AND grantee = 'authenticated' AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'authenticated lost SELECT on the index ledger';
  END IF;

  -- And the write is refused for a caller, which 533 claimed and never tried.
  -- Attempted as `authenticated`, so the refusal is the one a real caller gets.
  SELECT ot.id INTO t FROM public.object_types ot LIMIT 1;
  IF t IS NULL THEN
    RAISE EXCEPTION '549: no object type to attempt the write against';
  END IF;

  SET LOCAL ROLE authenticated;
  ok := false;
  BEGIN
    INSERT INTO public.object_type_indexes (object_type_id) VALUES (t);
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
    -- Only THIS refusal counts. Accepting any error would let a NOT NULL
    -- violation stand in for the guarantee, which is the "assertion that tests
    -- nothing" the same audit found in ten other migrations.
  END;
  RESET ROLE;
  IF NOT ok THEN
    RAISE EXCEPTION 'authenticated wrote the index ledger directly';
  END IF;

  RAISE NOTICE '549: the index ledger is written by the indexer only';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
