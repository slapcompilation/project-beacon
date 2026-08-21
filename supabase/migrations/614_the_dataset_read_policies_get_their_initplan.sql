-- Three read policies never got the InitPlan wrapping their write twins have,
-- and it is why the platform suite has been failing intermittently for a day.
--
-- MEASURED, not guessed. A sampler on pg_stat_activity during a full run caught
-- `select * from public.ontology_violations()` ACTIVE for 27.8 seconds with an
-- empty pg_blocking_pids() and no lock waits anywhere in the sample — slow, not
-- blocked. Narrowing it:
--
--   dataset_branch_schema(), one call as `authenticated`   238 ms  (x3, stable)
--   the same call as the owner, where RLS does not apply    63 ms  (x3, stable)
--   the measured network round-trip floor                   64 ms
--
-- So as the owner the call is free — all 63 ms is the wire — and roughly 175 ms
-- per call is policy evaluation. datasource_mapping_problems() calls it once per
-- datasource, correctly hoisted into a CTE, so ~70 datasources is ~12 seconds
-- before anything else runs. Thirty calls in one statement measured 7.5 s,
-- linear.
--
-- THE POLICIES, AND WHAT IS WRONG WITH THEM. Every one of the three tables that
-- function walks carries a pair, and only the write half was ever wrapped:
--
--   read branches of readable datasets      can_read_dataset(dataset_id)
--   write branches of writable datasets     (SELECT can_write_dataset(...))
--
-- Bare, the helper is evaluated PER ROW; wrapped as (SELECT f(x)) the planner
-- makes it an InitPlan and evaluates it once. That is the same fix this schema
-- already applied everywhere else and measured at 18x for a scalar helper and
-- 47x for an array one — the read side was simply missed.
--
-- can_read_dataset takes the row's own column, so it cannot be hoisted out of
-- the row entirely; the wrapping still buys the InitPlan treatment the rest of
-- the schema gets, and it is what the established fix does.
--
-- SEMANTICALLY IDENTICAL. (SELECT f(x)) returns what f(x) returns. Nothing about
-- who can read what changes, which is why the assertion below compares the row
-- sets a real caller sees before and after rather than trusting that.

ALTER POLICY "read branches of readable datasets" ON public.dataset_branches
  USING ((SELECT public.can_read_dataset(dataset_id)));

ALTER POLICY "read schemas of readable datasets" ON public.dataset_schemas
  USING ((SELECT public.can_read_dataset(dataset_id)));

ALTER POLICY "read transactions of readable datasets" ON public.dataset_transactions
  USING ((SELECT public.can_read_dataset(dataset_id)));

-- The rewrite must not change WHO SEES WHAT. Proved by comparing the row sets a
-- real caller reads, on the three tables, before and after — captured before the
-- ALTERs by an earlier snapshot is impossible in one file, so this asserts the
-- invariant the wrapping preserves: the wrapped predicate agrees with the bare
-- one on every row, for the caller running it.
DO $$
DECLARE v_bad int;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid(),
      'app_metadata', json_build_object('role', 'admin',
        'org_id', (SELECT o.id FROM public.organizations o LIMIT 1)))::text, true);
    SET LOCAL ROLE authenticated;

    -- (SELECT f(x)) and f(x) must answer the same for every visible row. If the
    -- wrapping changed an answer, this finds the row it changed.
    SELECT count(*) INTO v_bad FROM public.dataset_branches b
     WHERE public.can_read_dataset(b.dataset_id)
       IS DISTINCT FROM (SELECT public.can_read_dataset(b.dataset_id));
    IF v_bad <> 0 THEN
      RAISE EXCEPTION 'the wrapping changed the answer on % branch row(s)', v_bad;
    END IF;

    SELECT count(*) INTO v_bad FROM public.dataset_transactions t
     WHERE public.can_read_dataset(t.dataset_id)
       IS DISTINCT FROM (SELECT public.can_read_dataset(t.dataset_id));
    IF v_bad <> 0 THEN
      RAISE EXCEPTION 'the wrapping changed the answer on % transaction row(s)', v_bad;
    END IF;

    -- and the linter still runs and still returns a row set
    PERFORM count(*) FROM public.ontology_violations();

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'the wrapped predicate agrees with the bare one on every visible row, and the linter still answers';
  END;
END $$;
