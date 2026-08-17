-- The other half of the default-ACL stamp: tables.
--
-- 550 and 551 closed the function surface on the published principle — "you
-- must include an API token, generally referred to as a bearer token, in each
-- API call" (`api/v1/general-overview-authentication`) — and found the minting
-- mechanism: Supabase's default ACL stamps grants onto every object postgres
-- creates in public. Functions were one arm. The other is tables: the same
-- entry hands anon INSERT, SELECT, UPDATE, DELETE and MAINTAIN on every new
-- table, and 92 tables carry that stamp today. 549 closed one of them by hand
-- without knowing why the grants were there.
--
-- Probed before writing, so the blast radius is known: every one of the 92 is
-- RLS-guarded (none bare), no policy names anon in its role list, no relation
-- carries a PUBLIC grant, and no migration ever granted a table to anon on
-- purpose. So a plain REVOKE FROM anon touches nothing any caller uses — 549
-- said it of one table, this says it of all of them: the only thing between an
-- unauthenticated caller and each table is that nobody has written a matching
-- permissive policy yet. After this, the refusal is a grant refusal, the same
-- one an API call without a token gets.
--
-- Tables here means every relation kind PostgREST could serve (tables, views,
-- materialized views, foreign tables, partitioned tables) plus sequences,
-- which ride the same stamp. authenticated and service_role are untouched —
-- their access is the point of the platform, gated by RLS.

BEGIN;

-- New relations are born unreachable by anon. Per-schema is sufficient here —
-- unlike functions, the built-in defaults grant PUBLIC nothing on tables or
-- sequences — and the probe below executes that claim rather than trusting it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- The stock: every relation and sequence carrying the stamp.
DO $do$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel, c.relkind
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND c.relkind IN ('r','v','m','f','p','S')
       AND pg_has_role(current_user, c.relowner, 'USAGE')
       AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) a
                    JOIN pg_roles g ON g.oid = a.grantee
                   WHERE g.rolname = 'anon')
  LOOP
    IF r.relkind = 'S' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', r.rel);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', r.rel);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '552: closed % relation(s) to anon', n;
END $do$;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; ok boolean;
BEGIN
  -- The stock is closed, by the catalog's own answer.
  SELECT count(*) INTO n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public'
     AND c.relkind IN ('r','v','m','f','p','S')
     AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) a
                  JOIN pg_roles g ON g.oid = a.grantee
                 WHERE g.rolname = 'anon');
  IF n > 0 THEN
    RAISE EXCEPTION '% relation(s) in public still carry an anon grant', n;
  END IF;

  -- The minting is over: a table born NOW carries no anon grant, and kept its
  -- authenticated one — executed by creating one, because the per-schema/global
  -- default-privileges split is exactly what a catalog read gets wrong.
  CREATE TABLE public.t_probe_552 (id bigint GENERATED ALWAYS AS IDENTITY, v text);
  IF has_table_privilege('anon', 'public.t_probe_552', 'SELECT') THEN
    RAISE EXCEPTION 'a fresh table is still born readable by anon';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.t_probe_552', 'SELECT') THEN
    RAISE EXCEPTION 'a fresh table lost authenticated, which was not the deal';
  END IF;
  DROP TABLE public.t_probe_552;

  -- Executed as the roles in question: anon is refused at the grant layer —
  -- insufficient_privilege, not an empty RLS result — and authenticated reads.
  SET LOCAL ROLE anon;
  ok := false;
  BEGIN
    PERFORM count(*) FROM public.object_types;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  IF NOT ok THEN
    RAISE EXCEPTION 'anon read object_types and was not refused';
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM count(*) FROM public.object_types;  -- RLS may filter; must not refuse
  RESET ROLE;

  RAISE NOTICE '552: a table is not reachable without a token either';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
