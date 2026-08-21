-- 614 claimed to fix the slow linter. It did not, and an applied migration
-- cannot be edited, so the correction lands here.
--
-- 614 wrapped the three READ policies as (SELECT can_read_dataset(dataset_id)).
-- Measured before and after, same probe, same shape:
--
--   dataset_branch_schema() as `authenticated`   before 238/238/237 ms
--                                                after  251/244/243 ms
--
-- No improvement. Two reasons, and I had written the first one INTO 614's own
-- header before expecting a win anyway:
--
--   1. can_read_dataset(dataset_id) takes the ROW'S OWN COLUMN, so
--      (SELECT f(row.col)) is a CORRELATED subquery. There is no InitPlan to
--      be had; it still runs per row.
--   2. The read policy is not what runs. EXPLAIN ANALYZE of the function's
--      body, as `authenticated`, shows the filter as
--
--        Filter: ((id = '…'::uuid) AND (can_write_dataset(dataset_id) OR (SubPlan 1)))
--          SubPlan 1 -> (never executed)
--
--      SubPlan 1 IS the read policy 614 wrapped, and it never executes.
--
-- WHAT IS ACTUALLY SLOW. All three tables carry a `write …` policy with
-- cmd = ALL, so it is evaluated on SELECT as well. RLS is permissive-OR and
-- can_write_dataset comes first, so every row pays it and the read half short
-- circuits away. Measured: can_write_dataset ~7 ms of server time per call,
-- against a 64 ms network floor, evaluated per row of a SEQ SCAN over tables
-- that grow. That is the ~174 ms per dataset_branch_schema() call, the ~250 ms
-- per call across thirty, and the 27.8 s that a sampler caught
-- ontology_violations() sitting at during a real failure.
--
-- THE FIX IS NOT APPLIED HERE, ON PURPOSE. Scoping those policies to
-- INSERT/UPDATE/DELETE would stop SELECT paying for can_write_dataset — but it
-- also NARROWS who can read: today a caller who can write but not read still
-- passes the OR, and afterwards would not. That is a security boundary moving,
-- and this schema has been bitten by permissive-OR before. It wants a decision
-- and a proof that write implies read, not a performance patch at the end of a
-- long session.
--
-- 614 IS LEFT IN PLACE. It is semantically identical — its own assertion proved
-- the wrapped predicate agrees with the bare one on every visible row — and it
-- makes the read policies consistent with their write twins. It is simply not a
-- fix, and this file is here so the next reader is not told that it was.

COMMENT ON POLICY "read branches of readable datasets" ON public.dataset_branches IS
  'Wrapped by 614 for consistency with the write policy, NOT for speed: the wrapping is a correlated subquery and buys nothing, and this policy short-circuits away behind the FOR ALL write policy anyway. See 615.';
COMMENT ON POLICY "read schemas of readable datasets" ON public.dataset_schemas IS
  'Wrapped by 614 for consistency with the write policy, NOT for speed. See 615.';
COMMENT ON POLICY "read transactions of readable datasets" ON public.dataset_transactions IS
  'Wrapped by 614 for consistency with the write policy, NOT for speed. See 615.';

-- The claim this file makes is the one worth asserting: on a SELECT, the write
-- policy is in the predicate. If someone scopes those policies later, this stops
-- being true and the assertion below is where they will find out.
DO $$
DECLARE v_all int;
BEGIN
  SELECT count(*) INTO v_all FROM pg_policies
   WHERE tablename IN ('dataset_branches', 'dataset_transactions', 'dataset_schemas')
     AND policyname LIKE 'write%' AND cmd = 'ALL';
  IF v_all <> 3 THEN
    RAISE NOTICE 'the three write policies are no longer FOR ALL (% found) — 615''s explanation is stale', v_all;
  ELSE
    RAISE NOTICE 'confirmed: three FOR ALL write policies, so every SELECT on these tables evaluates can_write_dataset per row';
  END IF;
END $$;
