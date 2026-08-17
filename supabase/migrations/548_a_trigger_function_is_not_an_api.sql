-- A trigger function is never called directly, so nothing needs EXECUTE on it.
--
-- 547 fixed one function and swept the rest, finding 54 SECURITY DEFINER
-- functions in public executable by `anon`. This closes the subset where the
-- answer needs no judgement at all: functions that RETURN trigger. They are
-- invoked by the executor when a trigger fires, never by a caller, so an
-- EXECUTE grant on one is surface with no use.
--
-- The reason this was not done in 547 is that it rested on an unverified claim
-- — that revoking EXECUTE does not stop the trigger firing. Postgres checks
-- EXECUTE at CREATE TRIGGER time; whether it re-checks at fire time decides
-- whether this migration is safe or breaks every write path in the platform.
--
-- Verified before writing this, against this database, in a rolled-back
-- transaction: a table with a BEFORE INSERT trigger whose function had been
-- revoked from PUBLIC, anon and authenticated. As `authenticated`, with
-- has_function_privilege reporting false, the INSERT succeeded and the trigger
-- ran — NEW.touched came back true. So the executor does not re-check.
--
-- (The first attempt at that probe reported the opposite, and was wrong: the
--  INSERT failed on RLS, which this database enables automatically on every new
--  public table, not on EXECUTE. A test that fails for the wrong reason answers
--  the wrong question. It is recorded here because the assertions below could
--  make the same mistake.)

BEGIN;

DO $do$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.prorettype = 'pg_catalog.trigger'::regtype
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '548: closed % trigger function(s)', n;
END $do$;

-- ── assertions, which execute the path ──────────────────────────────────────
DO $do$
DECLARE n int; touched boolean;
BEGIN
  -- No trigger function in public is reachable by anon any more.
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.prorettype = 'pg_catalog.trigger'::regtype
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n <> 0 THEN
    RAISE EXCEPTION '% trigger function(s) are still executable by anon', n;
  END IF;

  -- And a trigger still FIRES with its function revoked, which is the whole
  -- premise. Proven on a probe rather than asserted, and RLS is disabled on it
  -- so that a refusal here can only be about EXECUTE.
  CREATE TABLE public.t_probe_548 (id int, touched boolean DEFAULT false);
  ALTER TABLE public.t_probe_548 DISABLE ROW LEVEL SECURITY;
  CREATE FUNCTION public.probe_guard_548() RETURNS trigger
    LANGUAGE plpgsql AS $fn$ BEGIN NEW.touched := true; RETURN NEW; END $fn$;
  CREATE TRIGGER probe_trg BEFORE INSERT ON public.t_probe_548
    FOR EACH ROW EXECUTE FUNCTION public.probe_guard_548();
  REVOKE ALL ON FUNCTION public.probe_guard_548() FROM PUBLIC, anon, authenticated;
  GRANT INSERT, SELECT ON public.t_probe_548 TO authenticated;

  IF has_function_privilege('authenticated', 'public.probe_guard_548()', 'EXECUTE') THEN
    RAISE EXCEPTION 'the probe did not actually revoke, so it proves nothing';
  END IF;

  SET LOCAL ROLE authenticated;
  INSERT INTO public.t_probe_548 (id) VALUES (1);
  SELECT t.touched INTO touched FROM public.t_probe_548 t WHERE t.id = 1;
  RESET ROLE;
  IF NOT coalesce(touched, false) THEN
    RAISE EXCEPTION 'the trigger did not run with its function revoked';
  END IF;

  DROP TABLE public.t_probe_548;
  DROP FUNCTION public.probe_guard_548();

  RAISE NOTICE '548: a trigger function is not an api';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $do$;

COMMIT;
