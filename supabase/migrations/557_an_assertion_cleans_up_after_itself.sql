-- 554 and 555 left their fixtures in production, and this removes them.
--
-- ── THE MISTAKE, PLAINLY ────────────────────────────────────────────────────
-- A migration file with no COMMIT of its own is wrapped in one transaction by
-- `scripts/db.mjs` — so everything its assertions INSERT is COMMITTED with the
-- schema change. 552 and 553 knew this and dropped their probes
-- (`t_probe_552`, `t_probe_553`). 554 and 555 did not, and left behind:
--
--   3 organizations, 4 spaces, 3 projects (A, B, Hidden), 2 portfolios
--   (Hospital Operations, Second), 2 auth users, 1 space role grant and 1
--   custom space role.
--
-- Nothing was wrong with asserting against real inserts — that is the point of
-- executing the path rather than grepping for it. What was missing is the
-- other half: an assertion that writes must unwind, or it is seeding.
--
-- The rule, for the next migration that asserts against rows it creates:
-- either wrap the fixture in a SAVEPOINT and roll back to it, or delete what
-- you made before the block ends. A probe TABLE gets dropped; probe ROWS get
-- deleted. This one deletes.
--
-- Deletion runs child-first rather than trusting cascades, so that a missing
-- ON DELETE rule shows up as an error here instead of as an orphan later.

BEGIN;

-- Portfolios first: projects reference them ON DELETE SET NULL, and the
-- curators list hangs off them.
DELETE FROM public.portfolios
 WHERE space_id IN (SELECT id FROM public.spaces
                     WHERE name LIKE 'caps554%' OR name LIKE 'pf555%');

DELETE FROM public.projects WHERE api_name LIKE 'pf555%';

DELETE FROM public.space_role_grants
 WHERE space_id IN (SELECT id FROM public.spaces
                     WHERE name LIKE 'caps554%' OR name LIKE 'pf555%');

-- Custom roles belong to the space that made them; the three defaults have a
-- NULL space_id and must survive.
DELETE FROM public.space_roles
 WHERE space_id IN (SELECT id FROM public.spaces
                     WHERE name LIKE 'caps554%' OR name LIKE 'pf555%');

DELETE FROM public.space_organizations
 WHERE space_id IN (SELECT id FROM public.spaces
                     WHERE name LIKE 'caps554%' OR name LIKE 'pf555%');

DELETE FROM public.spaces WHERE name LIKE 'caps554%' OR name LIKE 'pf555%';
DELETE FROM public.organizations WHERE name LIKE 'caps554%' OR name LIKE 'pf555%';
DELETE FROM auth.users WHERE email IN ('caps554@beacon.test', 'pf555@beacon.test');

-- ── assertions, which check both directions ─────────────────────────────────
DO $do$
DECLARE n int;
BEGIN
  -- Nothing of the fixtures is left.
  SELECT (SELECT count(*) FROM public.organizations WHERE name LIKE 'caps554%' OR name LIKE 'pf555%')
       + (SELECT count(*) FROM public.spaces        WHERE name LIKE 'caps554%' OR name LIKE 'pf555%')
       + (SELECT count(*) FROM public.projects      WHERE api_name LIKE 'pf555%')
       + (SELECT count(*) FROM auth.users WHERE email IN ('caps554@beacon.test','pf555@beacon.test'))
    INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION '% fixture row(s) survived the cleanup', n;
  END IF;

  -- And no portfolio or curator is orphaned, since those tables only ever held
  -- 555's fixtures.
  SELECT count(*) INTO n FROM public.portfolio_curators c
   WHERE NOT EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = c.portfolio_id);
  IF n <> 0 THEN
    RAISE EXCEPTION '% orphaned curator row(s)', n;
  END IF;

  -- The OTHER direction, which is the one a cleanup gets wrong: real data is
  -- still here. The three default space roles are the platform vocabulary and
  -- have a NULL space_id, so a careless delete would have taken them.
  SELECT count(*) INTO n FROM public.space_roles WHERE space_id IS NULL;
  IF n <> 3 THEN
    RAISE EXCEPTION 'the three default space roles should survive, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.space_role_workflows w
    JOIN public.space_roles r ON r.id = w.role_id WHERE r.space_id IS NULL;
  IF n <> 5 THEN
    RAISE EXCEPTION 'Contributor should still carry its published 5, found %', n;
  END IF;

  SELECT count(*) INTO n FROM public.projects WHERE api_name = 'example_data';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the example project was removed, which was never the plan';
  END IF;

  RAISE NOTICE '557: an assertion cleans up after itself';
END $do$;

COMMIT;
